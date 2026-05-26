import asyncio
import os
from datetime import datetime

from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv


async def main():
    load_dotenv("backend/.env")
    mongo_url = os.environ.get("MONGO_URL")
    db_name = os.environ.get("DB_NAME")
    if not mongo_url or not db_name:
        raise SystemExit("Missing MONGO_URL/DB_NAME in backend/.env")

    email = (os.environ.get("INSPECT_EMAIL") or "").strip().lower()
    if not email:
        raise SystemExit("Set INSPECT_EMAIL env var, e.g. $env:INSPECT_EMAIL='me@school.id'")

    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]

    user = await db.users.find_one({"email": {"$regex": f"^{email}$", "$options": "i"}}, {"_id": 0})
    if not user:
        raise SystemExit(f"User not found by email: {email}")

    user_id = user.get("user_id")
    inst = user.get("institution_code")
    print(f"User: {user.get('email')} user_id={user_id}")
    print(f"  role={user.get('role')} title={user.get('title')} titles={user.get('titles')}")
    print(f"  institution_code={inst} assigned_class={user.get('assigned_class')} assigned_subject={user.get('assigned_subject')}")
    print("")

    # Documents by ownership
    own_count = await db.documents.count_documents({"user_id": user_id, "status": {"$ne": "deleted"}})
    own_processing = await db.documents.count_documents({"user_id": user_id, "status": "processing"})
    print(f"documents (own): {own_count} (processing={own_processing})")

    # Documents by institution visibility
    if inst:
        inst_count = await db.documents.count_documents({"institution_code": inst, "visibility": "institution", "status": {"$ne": "deleted"}})
        print(f"documents (institution visibility): {inst_count}")
    else:
        print("documents (institution visibility): n/a (no institution_code)")

    # Teacher-materials API logic approximation
    # - own uploads OR institution visibility
    teacher_materials_query = {
        "status": {"$ne": "deleted"},
        "$or": [{"user_id": user_id}],
    }
    if inst:
        teacher_materials_query["$or"].append({"institution_code": inst, "visibility": "institution"})
    tm_count = await db.documents.count_documents(teacher_materials_query)
    print(f"documents (teacher/materials base query): {tm_count}")

    # Schedules
    if inst:
        schedules_total = await db.shared_schedules.count_documents({"institution_code": inst})
        print(f"shared_schedules (institution): {schedules_total}")
    else:
        print("shared_schedules (institution): n/a (no institution_code)")

    # Samples (latest docs)
    latest = await db.documents.find(
        {"user_id": user_id, "status": {"$ne": "deleted"}},
        {"_id": 0, "file_path": 0, "key_concepts": 0, "diagrams": 0},
    ).sort("created_at", -1).limit(5).to_list(5)
    if latest:
        print("\nLatest own documents:")
        for d in latest:
            print(
                f"- {d.get('document_id')} status={d.get('status')} visibility={d.get('visibility')} "
                f"inst={d.get('institution_code')} subject={d.get('subject_name')} "
                f"created_at={d.get('created_at')}"
            )
    else:
        print("\nLatest own documents: (none)")

    print(f"\nChecked at {datetime.now().isoformat()}")


if __name__ == "__main__":
    asyncio.run(main())

