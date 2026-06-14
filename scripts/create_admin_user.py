#!/usr/bin/env python3
"""
Create the demo admin user with email confirmation bypassed using Supabase Service Role Key:
    email : admin-schooly@schooly.ac.id
    password : admin 123
"""

import os
import asyncio
import httpx
from pathlib import Path
from dotenv import load_dotenv

# Load .env from backend root
load_dotenv(Path(__file__).parents[1] / "backend" / ".env")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")

ADMIN_EMAIL = "admin-schooly@schooly.ac.id"
ADMIN_PASS = "admin 123"

async def main():
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise SystemExit("❌ SUPABASE_URL / SERVICE_ROLE_KEY not set")

    async with httpx.AsyncClient(timeout=15.0) as client:
        # Create user via admin API (bypasses confirmation email)
        headers = {
            "apikey": SUPABASE_SERVICE_ROLE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
            "Content-Type": "application/json"
        }
        
        # 1️⃣ Check if user already exists
        print("Checking if user exists...")
        r = await client.get(
            f"{SUPABASE_URL}/auth/v1/admin/users",
            headers=headers
        )
        user_id = None
        if r.status_code == 200:
            users_list = r.json()
            # If the format is standard Supabase Admin response (usually a dict with "users" key)
            if isinstance(users_list, dict) and "users" in users_list:
                users_list = users_list["users"]
            for u in users_list:
                if u.get("email") == ADMIN_EMAIL:
                    user_id = u.get("id")
                    print("User already exists in Supabase.")
                    break
        
        # 2️⃣ Create user if not exists
        if not user_id:
            print("Creating user via admin API...")
            r = await client.post(
                f"{SUPABASE_URL}/auth/v1/admin/users",
                json={
                    "email": ADMIN_EMAIL,
                    "password": ADMIN_PASS,
                    "email_confirm": True
                },
                headers=headers
            )
            if r.status_code in (200, 201):
                user_id = r.json().get("id")
                print("User created successfully.")
            else:
                print("⚠️ Failed to create user via admin API, checking if we can just update MongoDB status.")
        
        # 3️⃣ Ensure MongoDB users collection contains this user with role = "admin"
        # We can write directly to MongoDB
        from motor.motor_asyncio import AsyncIOMotorClient
        from datetime import datetime, timezone
        
        mongo_url = os.getenv("MONGO_URL")
        if not mongo_url:
            raise SystemExit("❌ MONGO_URL not found")
            
        m_client = AsyncIOMotorClient(mongo_url)
        db = m_client.get_database("eduscanner_ai")
        
        if not user_id:
            # generate placeholder uuid
            import uuid
            user_id = str(uuid.uuid4())

        await db.users.update_one(
            {"email": ADMIN_EMAIL},
            {"$set": {
                "user_id": user_id,
                "email": ADMIN_EMAIL,
                "name": "Super Admin",
                "role": "admin",
                "onboarded": True,
                "created_at": datetime.now(timezone.utc)
            }},
            upsert=True
        )
        print(f"✅ Admin user fully synced to MongoDB: {ADMIN_EMAIL} with role: admin")

if __name__ == "__main__":
    asyncio.run(main())
