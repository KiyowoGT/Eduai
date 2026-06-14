#!/usr/bin/env python3
"""
Reset the password of the admin user to 'admin 123' in Supabase Auth.
"""

import os
import asyncio
import httpx
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parents[1] / "backend" / ".env")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

ADMIN_EMAIL = "admin-schooly@schooly.ac.id"
ADMIN_PASS = "admin 123"

async def main():
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise SystemExit("❌ SUPABASE_URL / SERVICE_ROLE_KEY not set")

    async with httpx.AsyncClient(timeout=15.0) as client:
        headers = {
            "apikey": SUPABASE_SERVICE_ROLE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
            "Content-Type": "application/json"
        }
        
        # Get users to find ID
        r = await client.get(
            f"{SUPABASE_URL}/auth/v1/admin/users",
            headers=headers
        )
        if r.status_code != 200:
            raise SystemExit(f"❌ Failed to fetch users: {r.text}")
            
        users_list = r.json()
        if isinstance(users_list, dict) and "users" in users_list:
            users_list = users_list["users"]
            
        user_id = None
        for u in users_list:
            if u.get("email") == ADMIN_EMAIL:
                user_id = u.get("id")
                break
                
        if not user_id:
            raise SystemExit(f"❌ User {ADMIN_EMAIL} not found in Supabase")
            
        # Update user password using admin API
        print(f"Resetting password for user ID: {user_id}...")
        r = await client.put(
            f"{SUPABASE_URL}/auth/v1/admin/users/{user_id}",
            json={"password": ADMIN_PASS},
            headers=headers
        )
        if r.status_code == 200:
            print("✅ Password successfully reset to 'admin 123'!")
        else:
            print(f"❌ Failed to reset password: {r.text}")

if __name__ == "__main__":
    asyncio.run(main())
