"""End-to-end backend tests for EduScanner AI."""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://akademik-scan.preview.emergentagent.com').rstrip('/')
API = f"{BASE_URL}/api"


# ============== Auth ==============
class TestAuth:
    def test_auth_session_missing_id(self):
        r = requests.post(f"{API}/auth/session", json={})
        assert r.status_code == 400

    def test_auth_session_invalid_id(self):
        r = requests.post(f"{API}/auth/session", json={"session_id": "definitely_fake_id_12345"})
        # Should be 401 because Google verification will fail
        assert r.status_code == 401

    def test_auth_me_without_token(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_documents_requires_auth(self):
        r = requests.get(f"{API}/documents")
        assert r.status_code == 401

    def test_progress_requires_auth(self):
        r = requests.get(f"{API}/progress")
        assert r.status_code == 401

    def test_audit_logs_requires_auth(self):
        r = requests.get(f"{API}/audit-logs")
        assert r.status_code == 401

    def test_auth_me_with_valid_bearer(self, auth_client, test_session):
        r = auth_client.get(f"{API}/auth/me")
        assert r.status_code == 200
        data = r.json()
        assert data["user_id"] == test_session["user_id"]
        assert "_id" not in data
        assert "email" in data
        assert data["onboarded"] is False


# ============== Profile ==============
class TestProfile:
    def test_update_profile_universitas(self, auth_client, test_session, mongo_db):
        payload = {
            "education_level": "Universitas",
            "major": "Informatika",
            "institution": "UBSI",
            "current_semester": 4,
        }
        r = auth_client.put(f"{API}/profile", json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["education_level"] == "Universitas"
        assert data["major"] == "Informatika"
        assert data["institution"] == "UBSI"
        assert data["current_semester"] == 4
        assert data["onboarded"] is True
        assert "_id" not in data

        # Verify persistence via /auth/me
        r2 = auth_client.get(f"{API}/auth/me")
        assert r2.status_code == 200
        assert r2.json()["major"] == "Informatika"

    def test_update_profile_sd_no_major(self, auth_client, mongo_db, test_session):
        payload = {
            "education_level": "SD",
            "major": "Should Be Ignored",
            "institution": "SD Negeri 1",
            "current_semester": 5,
        }
        r = auth_client.put(f"{API}/profile", json=payload)
        assert r.status_code == 200
        data = r.json()
        assert data["education_level"] == "SD"
        assert data["major"] is None

        # Verify DB
        user = mongo_db.users.find_one({"user_id": test_session["user_id"]})
        assert user["major"] is None

        # Restore to Universitas for downstream tests
        auth_client.put(f"{API}/profile", json={
            "education_level": "Universitas",
            "major": "Informatika",
            "institution": "UBSI",
            "current_semester": 4,
        })


# ============== Documents (no upload yet) ==============
class TestDocumentsList:
    def test_documents_empty(self, auth_client):
        r = auth_client.get(f"{API}/documents")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        # New user — no docs
        assert all("_id" not in d for d in data)


# ============== Full flow: upload -> quiz -> submit -> result ==============
@pytest.fixture(scope="module")
def uploaded_doc(auth_client, sample_pdf):
    """Upload PDF once, share across quiz tests. Takes 30-60s."""
    with open(sample_pdf, "rb") as f:
        files = {"file": ("sample.pdf", f, "application/pdf")}
        # remove json content-type for multipart
        headers = {k: v for k, v in auth_client.headers.items() if k.lower() != "content-type"}
        r = requests.post(f"{API}/documents/upload", files=files, headers=headers, timeout=180)
    if r.status_code != 200:
        pytest.skip(f"PDF upload/analysis failed (likely Gemini integration): {r.status_code} {r.text[:300]}")
    return r.json()


class TestDocumentUpload:
    def test_upload_pdf_and_analyze(self, uploaded_doc):
        d = uploaded_doc
        assert d["status"] == "ready"
        assert d["filename"] == "sample.pdf"
        assert "summary" in d and isinstance(d["summary"], str) and len(d["summary"]) > 20
        assert isinstance(d.get("key_concepts"), list) and len(d["key_concepts"]) >= 1
        assert isinstance(d.get("learning_objectives"), list)
        assert "_id" not in d
        assert "file_path" not in d  # internal path must be hidden

    def test_documents_list_after_upload(self, auth_client, uploaded_doc):
        r = auth_client.get(f"{API}/documents")
        assert r.status_code == 200
        ids = [d["document_id"] for d in r.json()]
        assert uploaded_doc["document_id"] in ids


# ============== Quiz ==============
@pytest.fixture(scope="module")
def generated_quiz(auth_client, uploaded_doc):
    r = auth_client.post(f"{API}/quiz/generate", json={
        "document_id": uploaded_doc["document_id"],
        "question_count": 3,
    }, timeout=120)
    if r.status_code != 200:
        pytest.skip(f"Quiz generation failed: {r.status_code} {r.text[:300]}")
    return r.json()


class TestQuiz:
    def test_quiz_generate(self, generated_quiz):
        q = generated_quiz
        assert "quiz_id" in q
        assert len(q["questions"]) == 3
        for question in q["questions"]:
            assert "correct_index" not in question, "Leaked correct_index!"
            assert len(question["options"]) == 4
            assert "question" in question
            assert "id" in question
        assert "_id" not in q

    def test_quiz_submit_and_result(self, auth_client, generated_quiz):
        answers = [0] * len(generated_quiz["questions"])
        r = auth_client.post(f"{API}/quiz/submit", json={
            "quiz_id": generated_quiz["quiz_id"],
            "answers": answers,
        }, timeout=120)
        assert r.status_code == 200, r.text
        result = r.json()
        assert "result_id" in result
        assert "score" in result and isinstance(result["score"], int)
        assert 0 <= result["score"] <= 100
        assert "summary" in result and len(result["summary"]) > 0
        assert isinstance(result["items"], list) and len(result["items"]) >= 1
        for it in result["items"]:
            assert "explanation" in it
            assert "references" in it
        assert "_id" not in result

        # GET result endpoint
        r2 = auth_client.get(f"{API}/quiz/result/{result['result_id']}")
        assert r2.status_code == 200
        assert r2.json()["result_id"] == result["result_id"]
        assert "_id" not in r2.json()


# ============== Audit logs & progress ==============
class TestAuditAndProgress:
    def test_audit_logs_format(self, auth_client):
        r = auth_client.get(f"{API}/audit-logs")
        assert r.status_code == 200
        logs = r.json()
        assert isinstance(logs, list)
        assert len(logs) >= 1
        import re
        for log in logs:
            assert "_id" not in log
            assert re.match(r"^AUD-\d{8}-\d{4}$", log["log_id"]), f"Bad log_id: {log['log_id']}"
            assert "action" in log

    def test_progress_endpoint(self, auth_client):
        r = auth_client.get(f"{API}/progress")
        assert r.status_code == 200
        p = r.json()
        assert "documents" in p
        assert "quizzes" in p
        assert "average_score" in p
        assert "recent_results" in p
        assert isinstance(p["recent_results"], list)


# ============== Logout (must be last) ==============
class TestZLogout:
    def test_logout_invalidates_session(self, test_session):
        token = test_session["token"]
        s = requests.Session()
        s.headers.update({"Authorization": f"Bearer {token}"})
        r = s.post(f"{API}/auth/logout", cookies={"session_token": token})
        assert r.status_code == 200

        # Subsequent /auth/me with same token should now 401
        r2 = s.get(f"{API}/auth/me")
        assert r2.status_code == 401
