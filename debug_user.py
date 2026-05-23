import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

async def check_user():
    load_dotenv('backend/.env')
    client = AsyncIOMotorClient(os.environ['MONGO_URL'])
    db = client[os.environ['DB_NAME']]
    users = await db.users.find().sort('created_at', -1).to_list(1)
    if users:
        print(f"Latest user: {users[0].get('email')} - Role: {users[0].get('role')} - Onboarded: {users[0].get('onboarded')}")
        print(f"Details: {users[0]}")
    else:
        print("No users found")

if __name__ == "__main__":
    asyncio.run(check_user())
