import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

async def check_user():
    load_dotenv('backend/.env')
    client = AsyncIOMotorClient(os.environ['MONGO_URL'])
    db = client[os.environ['DB_NAME']]
    
    print("--- RESTORING budihartono@sman1.ac.id ACADEMIC DATA ---")
    res = await db.users.update_one(
        {"email": "budihartono@sman1.ac.id"},
        {"$set": {
            "assigned_class": "10 MIPA 1",
            "assigned_subject": "Bahasa Inggris"
        }}
    )
    print(f"Updated count: {res.modified_count}")
    
    user_doc = await db.users.find_one({"email": "budihartono@sman1.ac.id"})
    print(f"User: {user_doc.get('email')} ({user_doc.get('user_id')})")
    print(f"  Assigned Class: {user_doc.get('assigned_class')}, Subject: {user_doc.get('assigned_subject')}")
    print(f"  Title: {user_doc.get('title')}, Titles: {user_doc.get('titles')}")

if __name__ == "__main__":
    asyncio.run(check_user())

if __name__ == "__main__":
    asyncio.run(check_user())
