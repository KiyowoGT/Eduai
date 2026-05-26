import sys
import asyncio
sys.path.append("c:\\Users\\ganxa\\Downloads\\My Project\\Eduai\\backend")

from core.database import db

async def main():
    # Find all documents with status "pending_review"
    docs = await db.documents.find({"status": "pending_review"}).to_list(100)
    print(f"Total pending documents: {len(docs)}")
    for d in docs:
        print(f"ID: {d['document_id']}")
        print(f"Title: {d.get('title')}")
        print(f"Subject: {d.get('subject_name')}")
        print(f"User ID: {d.get('user_id')}")
        print(f"Institution: {d.get('institution_code')}")
        print(f"Status: {d.get('status')}")
        
        # Let's also fetch the user who owns this document
        user = await db.users.find_one({"user_id": d.get("user_id")})
        if user:
            print(f"User Role: {user.get('role')}")
            print(f"User Title: {user.get('title')}")
            print(f"User Education Level: {user.get('education_level')}")
        else:
            print("User not found")
        print("-" * 40)

if __name__ == "__main__":
    asyncio.run(main())
