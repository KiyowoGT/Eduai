import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException

from core.database import db
from models.user import User
from models.friend import FriendRequestPayload, BlockUserPayload
from deps.auth import get_current_user, _create_notification, _is_blocked_pair

router = APIRouter()

@router.get("/users/search")
async def search_users(q: str = "", user: User = Depends(get_current_user)):
    if not q.strip():
        return {"users": []}
    pattern = {"$regex": q.strip(), "$options": "i"}
    found = await db.users.find(
        {
            "$and": [
                {"user_id": {"$ne": user.user_id}},
                {"$or": [
                    {"name": pattern},
                    {"email": pattern},
                    {"friend_code": pattern},
                ]},
            ]
        },
        {"_id": 0, "user_id": 1, "name": 1, "email": 1, "picture": 1, "friend_code": 1, "education_level": 1, "institution": 1},
    ).limit(20).to_list(20)
    visible = []
    for item in found:
        if not await _is_blocked_pair(user.user_id, item["user_id"]):
            visible.append(item)
    return {"users": visible}


@router.post("/friends/request")
async def send_friend_request(payload: FriendRequestPayload, user: User = Depends(get_current_user)):
    target = await db.users.find_one({"user_id": payload.target_user_id}, {"_id": 0})
    if not target:
        raise HTTPException(404, "User tidak ditemukan")
    if target["user_id"] == user.user_id:
        raise HTTPException(400, "Tidak bisa menambahkan diri sendiri")
    if await _is_blocked_pair(user.user_id, payload.target_user_id):
        raise HTTPException(403, "Relasi pertemanan dibatasi oleh salah satu pihak")

    existing = await db.friend_requests.find_one({
        "$or": [
            {"from_user_id": user.user_id, "to_user_id": payload.target_user_id},
            {"from_user_id": payload.target_user_id, "to_user_id": user.user_id},
        ],
    }, {"_id": 0})
    if existing:
        if existing["status"] == "accepted":
            raise HTTPException(400, "Sudah menjadi teman")
        if existing["status"] == "pending":
            if existing["from_user_id"] == user.user_id:
                raise HTTPException(400, "Permintaan pertemanan sudah dikirim")
            else:
                # Auto-accept if they already sent us one
                await db.friend_requests.update_one(
                    {"friend_request_id": existing["friend_request_id"]},
                    {"$set": {"status": "accepted"}},
                )
                await _create_notification(payload.target_user_id, "friend_accepted",
                             f"{user.name} menerima permintaan pertemananmu", {"user_id": user.user_id})
                return {"status": "accepted", "message": "Sekarang kalian berteman"}

    fr_id = uuid.uuid4().hex
    doc = {
        "friend_request_id": fr_id,
        "from_user_id": user.user_id,
        "from_user_name": user.name,
        "to_user_id": payload.target_user_id,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.friend_requests.insert_one(doc)

    # notify target
    await _create_notification(
        payload.target_user_id,
        "friend_request",
        f"{user.name} ingin menjadi temanmu",
        {"from_user_id": user.user_id, "friend_request_id": fr_id},
    )

    return {"friend_request_id": fr_id, "status": "pending"}


@router.get("/friends/requests")
async def list_friend_requests(user: User = Depends(get_current_user)):
    incoming = await db.friend_requests.find(
        {"to_user_id": user.user_id, "status": "pending"},
        {"_id": 0},
    ).sort("created_at", -1).to_list(50)
    return {"requests": incoming}


@router.post("/friends/requests/{request_id}/accept")
async def accept_friend_request(request_id: str, user: User = Depends(get_current_user)):
    fr = await db.friend_requests.find_one({"friend_request_id": request_id}, {"_id": 0})
    if not fr:
        raise HTTPException(404, "Permintaan tidak ditemukan")
    if fr["to_user_id"] != user.user_id:
        raise HTTPException(403, "Bukan permintaan untukmu")
    if fr["status"] != "pending":
        raise HTTPException(400, f"Permintaan sudah {fr['status']}")

    await db.friend_requests.update_one(
        {"friend_request_id": request_id},
        {"$set": {"status": "accepted"}},
    )

    # notify sender
    await _create_notification(
        fr["from_user_id"],
        "friend_accepted",
        f"{user.name} menerima permintaan pertemananmu",
        {"user_id": user.user_id},
    )

    return {"status": "accepted"}


@router.post("/friends/requests/{request_id}/reject")
async def reject_friend_request(request_id: str, user: User = Depends(get_current_user)):
    fr = await db.friend_requests.find_one({"friend_request_id": request_id}, {"_id": 0})
    if not fr:
        raise HTTPException(404, "Permintaan tidak ditemukan")
    if fr["to_user_id"] != user.user_id:
        raise HTTPException(403, "Bukan permintaan untukmu")
    if fr["status"] != "pending":
        raise HTTPException(400, f"Permintaan sudah {fr['status']}")

    await db.friend_requests.update_one(
        {"friend_request_id": request_id},
        {"$set": {"status": "rejected"}},
    )
    return {"status": "rejected"}


@router.get("/friends")
async def list_friends(user: User = Depends(get_current_user)):
    accepted = await db.friend_requests.find(
        {
            "$or": [
                {"from_user_id": user.user_id, "status": "accepted"},
                {"to_user_id": user.user_id, "status": "accepted"},
            ]
        },
        {"_id": 0},
    ).to_list(200)

    friend_ids = set()
    for fr in accepted:
        friend_ids.add(fr["from_user_id"] if fr["to_user_id"] == user.user_id else fr["to_user_id"])

    friends = []
    for fid in friend_ids:
        if await _is_blocked_pair(user.user_id, fid):
            continue
        u = await db.users.find_one({"user_id": fid}, {"_id": 0, "user_id": 1, "name": 1, "picture": 1, "friend_code": 1, "education_level": 1, "institution": 1})
        if u:
            friends.append(u)
    return {"friends": friends}


@router.delete("/friends/{target_user_id}")
async def unfriend(target_user_id: str, user: User = Depends(get_current_user)):
    result = await db.friend_requests.delete_many({
        "status": "accepted",
        "$or": [
            {"from_user_id": user.user_id, "to_user_id": target_user_id},
            {"from_user_id": target_user_id, "to_user_id": user.user_id},
        ],
    })
    return {"removed": result.deleted_count > 0}


@router.post("/friends/block")
async def block_user(payload: BlockUserPayload, user: User = Depends(get_current_user)):
    if payload.target_user_id == user.user_id:
        raise HTTPException(400, "Tidak bisa memblokir diri sendiri")
    target = await db.users.find_one({"user_id": payload.target_user_id}, {"_id": 0, "user_id": 1})
    if not target:
        raise HTTPException(404, "User tidak ditemukan")
    await db.friend_blocks.update_one(
        {"blocker_user_id": user.user_id, "blocked_user_id": payload.target_user_id},
        {"$set": {
            "block_id": uuid.uuid4().hex,
            "blocker_user_id": user.user_id,
            "blocked_user_id": payload.target_user_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True,
    )
    await db.friend_requests.delete_many({
        "$or": [
            {"from_user_id": user.user_id, "to_user_id": payload.target_user_id},
            {"from_user_id": payload.target_user_id, "to_user_id": user.user_id},
        ],
    })
    await db.discussion_participants.delete_many({"user_id": payload.target_user_id, "invited_by": user.user_id})
    return {"blocked": True}


# ============== Notifications ==============

@router.get("/notifications")
async def list_notifications(user: User = Depends(get_current_user), limit: int = 50):
    notifs = await db.notifications.find(
        {"user_id": user.user_id},
        {"_id": 0},
    ).sort("created_at", -1).to_list(limit)
    return {"notifications": notifs}


@router.get("/notifications/unread-count")
async def unread_notification_count(user: User = Depends(get_current_user)):
    count = await db.notifications.count_documents({"user_id": user.user_id, "read": False})
    return {"count": count}


@router.post("/notifications/{notif_id}/read")
async def mark_notification_read(notif_id: str, user: User = Depends(get_current_user)):
    result = await db.notifications.update_one(
        {"notification_id": notif_id, "user_id": user.user_id},
        {"$set": {"read": True}},
    )
    if result.modified_count == 0:
        raise HTTPException(404, "Notifikasi tidak ditemukan")
    return {"ok": True}


@router.post("/notifications/read-all")
async def mark_all_notifications_read(user: User = Depends(get_current_user)):
    await db.notifications.update_many(
        {"user_id": user.user_id, "read": False},
        {"$set": {"read": True}},
    )
    return {"ok": True}
