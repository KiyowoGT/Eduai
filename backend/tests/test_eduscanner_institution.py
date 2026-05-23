import os
import uuid
import time
from datetime import datetime, timezone, timedelta
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'http://127.0.0.1:8000').rstrip('/')
API = f"{BASE_URL}/api"

def test_sso_and_domain_guard(mongo_db, test_session):
    """
    Test FR-I-01: Onboarding completed as B2B staff requires an email ending in .sch.id.
    """
    # 1. Non-school email must be rejected
    headers = {"Authorization": f"Bearer {test_session['token']}"}
    payload_invalid = {
        "role": "pengajar",
        "account_type": "perusahaan",
        "create_institution": {
            "name": "Sekolah Test",
            "level": "SMA"
        }
    }
    
    # We must temporarily set the user email to non-school email
    mongo_db.users.update_one(
        {"user_id": test_session["user_id"]},
        {"$set": {"email": "guru@gmail.com"}}
    )
    
    response = requests.post(f"{API}/onboarding/complete", json=payload_invalid, headers=headers)
    assert response.status_code == 400
    assert "domain sekolah" in response.json()["detail"].lower()

    # 2. School email must be accepted
    mongo_db.users.update_one(
        {"user_id": test_session["user_id"]},
        {"$set": {"email": "guru@sekolah.sch.id"}}
    )
    payload_valid = {
        "role": "pengajar",
        "account_type": "pribadi",  # Guru mandiri can use any email, but let's test B2B
        "teaching_methods": ["real_world"]
    }
    response = requests.post(f"{API}/onboarding/complete", json=payload_valid, headers=headers)
    assert response.status_code == 200
    assert response.json()["onboarded"] is True


def test_context_switcher(mongo_db, test_session):
    """
    Test FR-I-03 & Q4: Role switching updates title/active scopes in user session and document.
    """
    headers = {"Authorization": f"Bearer {test_session['token']}"}
    user_id = test_session["user_id"]
    
    # Prepare B2B user state
    mongo_db.users.update_one(
        {"user_id": user_id},
        {"$set": {
            "role": "pengajar",
            "institution_code": "SCH-TEST",
            "title": "guru_kelas",
            "assigned_class": "10-A"
        }}
    )
    
    # Setup role assignments in DB
    mongo_db.role_assignments.insert_one({
        "user_id": user_id,
        "role_type": "guru_pengajar",
        "scope_id": "Matematika",
        "status": "active"
    })
    
    try:
        # Switch to an invalid/unassigned role (should return 403)
        response = requests.post(f"{API}/auth/switch-role", json={"role_type": "kurikulum"}, headers=headers)
        assert response.status_code == 403
        
        # Switch to valid assigned role (guru_pengajar)
        response = requests.post(f"{API}/auth/switch-role", json={"role_type": "guru_pengajar"}, headers=headers)
        assert response.status_code == 200
        assert response.json()["active_role"] == "guru_pengajar"
        
        # Verify the user document in database is updated
        user_doc = mongo_db.users.find_one({"user_id": user_id})
        assert user_doc["title"] == "guru_pengajar"
        assert user_doc["assigned_subject"] == "Matematika"
        assert user_doc["assigned_class"] is None
        
    finally:
        # Clean up
        mongo_db.role_assignments.delete_many({"user_id": user_id})


def test_academic_year_archive(mongo_db, test_session):
    """
    Test FR-L-02 & Task 3.2: Activating new academic year archives previous year data.
    """
    headers = {"Authorization": f"Bearer {test_session['token']}"}
    user_id = test_session["user_id"]
    
    # Set user as kepala sekolah so they can access admin endpoints
    mongo_db.users.update_one(
        {"user_id": user_id},
        {"$set": {
            "role": "pengajar",
            "title": "kepala_sekolah",
            "institution_code": "SCH-YEAR",
            "institution_owner": True
        }}
    )
    
    # Create old active academic year
    mongo_db.academic_years.insert_one({
        "academic_year_id": "ACY-OLD",
        "institution_code": "SCH-YEAR",
        "name": "2024/2025",
        "is_active": True,
        "is_archived": False
    })
    
    # Insert old quiz under the old academic year
    quiz_id = f"quiz_old_{uuid.uuid4().hex[:6]}"
    mongo_db.quizzes.insert_one({
        "quiz_id": quiz_id,
        "institution_code": "SCH-YEAR",
        "academic_year_id": "ACY-OLD",
        "status": "ready",
        "source_titles": ["Kuis Lama"]
    })
    
    # Create new academic year
    response = requests.post(
        f"{API}/admin/academic-years",
        json={"name": "2025/2026", "start_date": "2025-07-01", "end_date": "2026-06-30"},
        headers=headers
    )
    assert response.status_code == 200
    new_year_id = response.json()["academic_year"]["academic_year_id"]
    
    try:
        # Activate the new academic year
        response_act = requests.post(f"{API}/admin/academic-years/{new_year_id}/activate", headers=headers)
        assert response_act.status_code == 200
        
        # Give async background task time to run
        time.sleep(1)
        
        # Verify old academic year is deactivated and archived
        old_year = mongo_db.academic_years.find_one({"academic_year_id": "ACY-OLD"})
        assert old_year["is_active"] is False
        assert old_year["is_archived"] is True
        
        # Verify old quizzes are archived
        quiz_doc = mongo_db.quizzes.find_one({"quiz_id": quiz_id})
        assert quiz_doc["status"] == "archived"
        assert quiz_doc["is_locked"] is True
        
    finally:
        # Clean up
        mongo_db.academic_years.delete_many({"institution_code": "SCH-YEAR"})
        mongo_db.quizzes.delete_one({"quiz_id": quiz_id})


def test_resign_and_email_recycling(mongo_db, test_session):
    """
    Test FR-S-03 & Task 1.4: Resigning a teacher sanitizes their email and marks user as archived.
    """
    headers = {"Authorization": f"Bearer {test_session['token']}"}
    admin_user_id = test_session["user_id"]
    teacher_id = f"guru_{uuid.uuid4().hex[:6]}"
    teacher_email = "yanti@sekolah.sch.id"
    
    # Configure admin user
    mongo_db.users.update_one(
        {"user_id": admin_user_id},
        {"$set": {
            "role": "pengajar",
            "title": "kepala_sekolah",
            "institution_code": "SCH-RESIGN",
            "institution_owner": True
        }}
    )
    
    # Insert teacher to resign
    mongo_db.users.insert_one({
        "user_id": teacher_id,
        "email": teacher_email,
        "name": "Ibu Yanti",
        "role": "pengajar",
        "title": "guru_kelas",
        "institution_code": "SCH-RESIGN",
        "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    try:
        # Resign teacher
        payload = {"email": teacher_email}
        response = requests.post(f"{API}/admin/users/{teacher_id}/resign", json=payload, headers=headers)
        assert response.status_code == 200
        
        # Verify teacher record is archived and email renamed
        teacher_doc = mongo_db.users.find_one({"user_id": teacher_id})
        assert teacher_doc["status"] == "archived"
        assert teacher_doc["email"].startswith("archived_")
        assert teacher_doc["institution_code"] is None
        
        # Verify archived mapping entry exists
        mapping = mongo_db.archived_email_mapping.find_one({"original_email": teacher_email})
        assert mapping is not None
        assert mapping["user_id"] == teacher_id
        
    finally:
        # Clean up
        mongo_db.users.delete_one({"user_id": teacher_id})
        mongo_db.archived_email_mapping.delete_one({"original_email": teacher_email})


def test_audit_log_immutability(mongo_db):
    """
    Test Audit logs collection is write-only / immutable (PermissionError is raised).
    """
    from core.database import db
    
    # Check that trying to update or delete using custom database proxy triggers PermissionError
    with pytest.raises(PermissionError) as exc_info:
        db.audit_logs.update_one({"log_id": "non-existent"}, {"$set": {"action": "HACK"}})
    assert "immutable" in str(exc_info.value)
    
    with pytest.raises(PermissionError) as exc_info:
        db.audit_logs.delete_one({"log_id": "non-existent"})
    assert "immutable" in str(exc_info.value)


def test_shadow_workspace_firewall_queries(mongo_db, test_session):
    """
    Test B2B analytical query firewall filtering out SaaS/redeem results.
    """
    headers = {"Authorization": f"Bearer {test_session['token']}"}
    user_id = test_session["user_id"]
    
    # Set user as kepala sekolah
    mongo_db.users.update_one(
        {"user_id": user_id},
        {"$set": {
            "role": "pengajar",
            "title": "kepala_sekolah",
            "institution_code": "SCH-FIREWALL",
            "institution_owner": True
        }}
    )
    
    # Setup test students
    student1_id = f"std1_{uuid.uuid4().hex[:6]}"
    mongo_db.users.insert_one({
        "user_id": student1_id,
        "email": "student1@sekolah.sch.id",
        "name": "Student A",
        "role": "pelajar",
        "institution_code": "SCH-FIREWALL",
        "enrolled_class": "10-A"
    })
    
    # Setup academic year
    mongo_db.academic_years.insert_one({
        "academic_year_id": "ACY-FW",
        "institution_code": "SCH-FIREWALL",
        "name": "2026/2027",
        "is_active": True,
        "is_archived": False
    })
    
    # Setup results
    # 1. B2B School Result (should be fetched)
    res_b2b_id = f"res_b2b_{uuid.uuid4().hex[:6]}"
    mongo_db.quiz_results.insert_one({
        "result_id": res_b2b_id,
        "quiz_id": "quiz_1",
        "user_id": student1_id,
        "score": 90,
        "status": "ready",
        "source": "institution_class",
        "institution_code": "SCH-FIREWALL",
        "academic_year_id": "ACY-FW",
        "student_class": "10-A",
        "subject_name": "Fisika",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # 2. SaaS/Redeem Result (should be ignored by firewall)
    res_saas_id = f"res_saas_{uuid.uuid4().hex[:6]}"
    mongo_db.quiz_results.insert_one({
        "result_id": res_saas_id,
        "quiz_id": "quiz_1",
        "user_id": student1_id,
        "score": 100,
        "status": "ready",
        "source": "saas_redeem",
        "institution_code": None,
        "student_class": "10-A",
        "subject_name": "Fisika",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    try:
        # Query class summary
        response = requests.get(f"{API}/teacher/analytics/class-summary?class_name=10-A", headers=headers)
        assert response.status_code == 200
        students_summary = response.json()["students"]
        
        # Verify B2B student exists in roster
        student_a_summary = next((s for s in students_summary if s["user_id"] == student1_id), None)
        assert student_a_summary is not None
        
        # Verify the overall average uses B2B score (90) and NOT the SaaS redeem score (100)
        assert student_a_summary["overall_average"] == 90.0
        assert student_a_summary["quiz_count"] == 1
        
    finally:
        # Clean up
        mongo_db.users.delete_one({"user_id": student1_id})
        mongo_db.academic_years.delete_many({"institution_code": "SCH-FIREWALL"})
        mongo_db.quiz_results.delete_many({"result_id": {"$in": [res_b2b_id, res_saas_id]}})
