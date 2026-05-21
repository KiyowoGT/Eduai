import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

async def test_conn():
    load_dotenv()
    mongo_url = os.environ.get('MONGO_URL')
    db_name = os.environ.get('DB_NAME')
    print(f"DEBUG: Connecting to {mongo_url}")
    print(f"DEBUG: Using Database: {db_name}")
    
    client = AsyncIOMotorClient(mongo_url, serverSelectionTimeoutMS=5000)
    try:
        # The ping command is cheap and does not require auth on some setups, 
        # but Atlas will fail auth during the connection process if the string is wrong.
        await client.admin.command('ping')
        print("✅ MongoDB Connection Successful (Ping)!")
        
        # Test writing to the specific database
        db = client[db_name]
        res = await db.test_collection.insert_one({"test": "data"})
        print(f"✅ MongoDB Write Successful! ID: {res.inserted_id}")
        await db.test_collection.delete_one({"_id": res.inserted_id})
        print("✅ MongoDB Delete Successful!")
        
    except Exception as e:
        print(f"❌ MongoDB Error: {type(e).__name__} - {e}")
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(test_conn())
