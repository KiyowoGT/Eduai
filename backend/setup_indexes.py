import asyncio
import os
import pymongo
from motor.motor_asyncio import AsyncIOMotorClient
from core.config import MONGO_URL, DB_NAME

async def setup_database_indexes():
    mongo_uri = MONGO_URL or "mongodb://localhost:27017"
    db_name = DB_NAME or "eduscanner_ai"
    print(f"Connecting to MongoDB database: {db_name}")
    client = AsyncIOMotorClient(mongo_uri)
    db = client[db_name]

    # 1. Unique Indexes (Integrity Constraints)
    await db.institutions.create_index("institution_code", unique=True)
    await db.staff_passcodes.create_index("passcode", unique=True)
    await db.class_tokens.create_index("class_token", unique=True)
    await db.redeem_codes.create_index("code", unique=True)
    await db.student_sessions.create_index("session_id", unique=True)
    await db.archived_email_mapping.create_index("original_email", unique=True)

    # 2. Compound Performance Indexes
    await db.shared_schedules.create_index([
        ("institution_code", pymongo.ASCENDING),
        ("target_class_room", pymongo.ASCENDING),
        ("day", pymongo.ASCENDING)
    ])
    await db.quiz_results.create_index([
        ("institution_code", pymongo.ASCENDING),
        ("student_class", pymongo.ASCENDING),
        ("subject_name", pymongo.ASCENDING)
    ])
    await db.quiz_results.create_index([("created_by", pymongo.ASCENDING)])
    await db.redeem_codes.create_index("quiz_id")
    await db.student_sessions.create_index("redeem_code")
    await db.student_sessions.create_index("quiz_id")
    await db.student_sessions.create_index([("redeem_code", 1), ("score", -1)])

    # B2B Enterprise Indexes
    await db.role_assignments.create_index([("user_id", 1), ("status", 1)])
    await db.academic_years.create_index([("institution_code", 1), ("is_active", 1)])
    await db.classes.create_index([("institution_code", 1), ("academic_year_id", 1)])
    await db.courses.create_index([("institution_code", 1), ("curriculum_code", 1)])
    await db.course_assignments.create_index([("teacher_id", 1), ("academic_year_id", 1)])
    await db.quiz_results.create_index(
        [("institution_code", 1), ("source", 1), ("academic_year_id", 1), ("quiz_id", 1)],
        name="idx_firewall_analytics"
    )

    print("Success: Semua database index berhasil dibuat.")
    client.close()

if __name__ == "__main__":
    asyncio.run(setup_database_indexes())
