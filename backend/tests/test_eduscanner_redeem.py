import os
import uuid
import time
from datetime import datetime, timezone, timedelta
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'http://127.0.0.1:8000').rstrip('/')
API = f"{BASE_URL}/api"

def reset_rate_limit(ip: str = "127.0.0.1"):
    # Since rate limit is in-memory in the server, E2E tests might trigger it.
    # We can just wait or use a unique IP/Client if needed, but since it's 10 req/min,
    # we can run it or check status.
    pass

def test_rate_limiter():
    """
    Test that hitting the redeem validation endpoint more than 10 times in 1 minute
    returns a 429 Too Many Requests response.
    """
    code = f"MAT-LES-RL-{uuid.uuid4().hex[:6]}"
    
    # Hit 10 times - should return 404 since code doesn't exist
    for i in range(10):
        response = requests.get(f"{API}/redeem/{code}")
        assert response.status_code == 404
        assert response.json()["detail"] != "Terlalu banyak permintaan (maksimal 10 per menit). Silakan coba lagi nanti."

    # 11th hit should trigger the rate limiter (429)
    response = requests.get(f"{API}/redeem/{code}")
    assert response.status_code == 429
    assert "Terlalu banyak permintaan" in response.json()["detail"]


def test_code_expiration(mongo_db):
    """
    Test that an expired redeem code returns a 404 validation error.
    """
    code = f"BIO-LES-EXP-{uuid.uuid4().hex[:6]}"
    quiz_id = uuid.uuid4().hex
    
    # Create an expired redeem code in DB
    past_date = (datetime.now(timezone.utc) - timedelta(minutes=10)).isoformat()
    mongo_db.redeem_codes.insert_one({
        "code": code,
        "quiz_id": quiz_id,
        "created_by": "tutor_1",
        "expires_at": past_date,
        "usage_count": 0,
        "created_at": (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
    })
    
    try:
        # Test validation
        response = requests.get(f"{API}/redeem/{code}")
        assert response.status_code == 404
        assert "kadaluwarsa" in response.json()["detail"].lower()
    finally:
        # Clean up
        mongo_db.redeem_codes.delete_one({"code": code})


def test_double_submit_prevention(mongo_db):
    """
    Test that submitting answers for an already ready/processing session is rejected with a 409.
    """
    code = f"MAT-LES-SUB-{uuid.uuid4().hex[:6]}"
    quiz_id = uuid.uuid4().hex
    session_id = uuid.uuid4().hex
    session_token = uuid.uuid4().hex
    
    # Insert an active redeem code
    mongo_db.redeem_codes.insert_one({
        "code": code,
        "quiz_id": quiz_id,
        "created_by": "tutor_1",
        "expires_at": None,
        "usage_count": 0,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Insert a student session that is already processed
    mongo_db.student_sessions.insert_one({
        "session_id": session_id,
        "session_token": session_token,
        "redeem_code": code,
        "quiz_id": quiz_id,
        "status": "ready",
        "started_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Prepare mock quiz in DB
    mongo_db.quizzes.insert_one({
        "quiz_id": quiz_id,
        "user_id": "tutor_1",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "document_id": "doc_1",
        "document_ids": ["doc_1"],
        "folder_id": "folder_1",
        "source_titles": ["Doc 1"],
        "status": "published",
        "questions": [
            {
                "id": "q1",
                "question": "1+1?",
                "options": ["2", "3", "4", "5"],
                "correct_index": 0,
                "skill_type": "concept",
                "source_title": "Doc 1"
            }
        ]
    })

    try:
        # Try to submit again
        payload = {
            "student_identifier": "Budi",
            "answers": [0],
            "session_token": session_token
        }
        
        response = requests.post(f"{API}/redeem/{code}/submit", json=payload)
        assert response.status_code == 409
        assert "sudah dikirimkan" in response.json()["detail"].lower()
    finally:
        # Clean up
        mongo_db.redeem_codes.delete_one({"code": code})
        mongo_db.student_sessions.delete_one({"session_id": session_id})
        mongo_db.quizzes.delete_one({"quiz_id": quiz_id})


def test_shadow_workspace_firewall(auth_client, mongo_db, test_session):
    """
    Test B2B student submitting private quiz:
    1. Results are saved in db.quiz_results for student portfolio with institution_code = None (Shadow workspace).
    2. Verification that B2B school teacher (who queries db.quiz_results with institution_code='SCHOOL_A')
       CANNOT see this shadow quiz result.
    """
    code = f"PHY-LES-SHD-{uuid.uuid4().hex[:6]}"
    quiz_id = uuid.uuid4().hex
    session_id = uuid.uuid4().hex
    session_token = uuid.uuid4().hex
    student_user_id = test_session["user_id"]
    
    # Set the test user to be a B2B student (enrolled in School A)
    mongo_db.users.update_one(
        {"user_id": student_user_id},
        {"$set": {
            "role": "pelajar",
            "institution_code": "SCHOOL_A",
            "enrolled_class": "10-A"
        }}
    )

    # Setup tutor private quiz
    mongo_db.quizzes.insert_one({
        "quiz_id": quiz_id,
        "user_id": "private_tutor_1",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "document_id": "doc_456",
        "document_ids": ["doc_456"],
        "folder_id": "folder_456",
        "source_titles": ["Materi Fisika"],
        "status": "published",
        "subject_name": "Fisika",
        "questions": [
            {
                "id": "q1",
                "question": "1+1?",
                "options": ["2", "3", "4", "5"],
                "correct_index": 0,
                "skill_type": "concept",
                "source_title": "Materi Fisika"
            }
        ]
    })

    # Setup active redeem code
    mongo_db.redeem_codes.insert_one({
        "code": code,
        "quiz_id": quiz_id,
        "created_by": "private_tutor_1",
        "expires_at": None,
        "usage_count": 0,
        "created_at": datetime.now(timezone.utc).isoformat()
    })

    # Setup student session
    mongo_db.student_sessions.insert_one({
        "session_id": session_id,
        "session_token": session_token,
        "redeem_code": code,
        "quiz_id": quiz_id,
        "status": "started",
        "started_at": datetime.now(timezone.utc).isoformat()
    })

    try:
        # B2B Student Submits Quiz with auth header
        payload = {
            "student_identifier": "B2B Student",
            "answers": [0],
            "session_token": session_token
        }
        
        # Submit using auth_client (authenticated as our test student user)
        response = auth_client.post(f"{API}/redeem/{code}/submit", json=payload)
        assert response.status_code == 200
        
        # Check that shadow copy in quiz_results exists with institution_code = None
        shadow_result = mongo_db.quiz_results.find_one({"quiz_id": quiz_id, "user_id": student_user_id})
        assert shadow_result is not None
        assert shadow_result["institution_code"] is None
        assert shadow_result["source"] == "saas_redeem"

        # Check B2B School Teacher Analytics Query (must filter by institution_code)
        class_results = list(mongo_db.quiz_results.find({
            "institution_code": "SCHOOL_A",
            "student_class": "10-A"
        }))
        
        # The shadow result should NOT be in this B2B school list
        matching = [res for res in class_results if res["quiz_id"] == quiz_id]
        assert len(matching) == 0, "Security Leak: Shadow kuis result leaked to school dashboard!"
        
    finally:
        # Restore test user to original state
        mongo_db.users.update_one(
            {"user_id": student_user_id},
            {"$set": {"institution_code": None, "enrolled_class": None}}
        )
        # Clean up
        mongo_db.quizzes.delete_one({"quiz_id": quiz_id})
        mongo_db.redeem_codes.delete_one({"code": code})
        mongo_db.student_sessions.delete_one({"session_id": session_id})
        mongo_db.quiz_results.delete_many({"quiz_id": quiz_id})


def test_insights_caching(auth_client, mongo_db, test_session):
    """
    Test that AI insights are cached for 15 minutes unless new submissions arrive.
    """
    quiz_id = f"quiz_insight_{uuid.uuid4().hex[:6]}"
    tutor_user_id = test_session["user_id"] # Use the logged-in test user
    
    # We need to set the tutor user's account_type to 'pribadi' so they can access insights as Guru Mandiri
    mongo_db.users.update_one(
        {"user_id": tutor_user_id},
        {"$set": {"account_type": "pribadi", "role": "pengajar"}}
    )

    # Insert a published quiz matching the schema
    mongo_db.quizzes.insert_one({
        "quiz_id": quiz_id,
        "user_id": tutor_user_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "document_id": "doc_123",
        "document_ids": ["doc_123"],
        "folder_id": "folder_123",
        "source_titles": ["Materi Matematika"],
        "status": "published",
        "subject_name": "Matematika",
        "questions": [
            {
                "id": "q1",
                "question": "1+1?",
                "options": ["2", "3", "4", "5"],
                "correct_index": 0,
                "skill_type": "penjumlahan",
                "source_title": "Materi Matematika"
            }
        ]
    })

    # Add 1 ready student session submission
    mongo_db.student_sessions.insert_one({
        "session_id": "session_1",
        "quiz_id": quiz_id,
        "status": "ready",
        "score": 100,
        "answers": [0],
        "student_identifier": "Anak Les 1",
        "started_at": datetime.now(timezone.utc).isoformat()
    })

    try:
        # First call: cache miss, triggers Gemini call (which will write to quiz_insights)
        response1 = auth_client.get(f"{API}/teacher/quizzes/{quiz_id}/insights")
        assert response1.status_code == 200
        
        # Check that quiz_insights entry was created in DB
        insight_doc = mongo_db.quiz_insights.find_one({"quiz_id": quiz_id})
        assert insight_doc is not None
        
        # Override the cached insight text in the database to a recognizable test string
        custom_cached_text = "Custom Cached Insight String XYZ"
        mongo_db.quiz_insights.update_one(
            {"quiz_id": quiz_id},
            {"$set": {"insight_text": custom_cached_text}}
        )
        
        # Second call (submission count unchanged, time < 15 min): should return cached text
        response2 = auth_client.get(f"{API}/teacher/quizzes/{quiz_id}/insights")
        assert response2.status_code == 200
        assert response2.json()["insight_text"] == custom_cached_text
        
        # Insert another student session to change the submission count
        mongo_db.student_sessions.insert_one({
            "session_id": "session_2",
            "quiz_id": quiz_id,
            "status": "ready",
            "score": 50,
            "answers": [1],
            "student_identifier": "Anak Les 2",
            "started_at": datetime.now(timezone.utc).isoformat()
        })
        
        # Third call: cache invalidated due to new submission, triggers Gemini and returns new content (not our custom cached string)
        response3 = auth_client.get(f"{API}/teacher/quizzes/{quiz_id}/insights")
        assert response3.status_code == 200
        assert response3.json()["insight_text"] != custom_cached_text
        
    finally:
        # Restore user role/account_type
        mongo_db.users.update_one(
            {"user_id": tutor_user_id},
            {"$set": {"account_type": None, "role": "pelajar"}}
        )
        # Clean up
        mongo_db.quizzes.delete_one({"quiz_id": quiz_id})
        mongo_db.student_sessions.delete_many({"quiz_id": quiz_id})
        mongo_db.quiz_insights.delete_one({"quiz_id": quiz_id})
