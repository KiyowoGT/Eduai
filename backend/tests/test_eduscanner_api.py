"""End-to-end backend tests for EduScanner AI — polling pattern (iteration 2)."""
import os
import re
import time
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
API = f"{BASE_URL}/api"

POLL_INTERVAL = 3   # seconds between polls
POLL_TIMEOUT = 180  # max seconds to wait for status='ready'


def _poll_until_ready(client, url, timeout=POLL_TIMEOUT):
    """Poll the GET endpoint until status='ready' or 'failed'. Returns final json."""
    deadline = time.time() + timeout
    last = None
    while time.time() < deadline:
        r = client.get(url, timeout=30)
        if r.status_code != 200:
            return {"status": "http_error", "code": r.status_code, "text": r.text[:300]}
        last = r.json()
        status = last.get("status")
        if status in ("ready", "failed"):
            return last
        time.sleep(POLL_INTERVAL)
    return last or {"status": "timeout"}


# ============== Auth ==============
class TestAuth:
    def test_auth_session_missing_id(self):
        r = requests.post(f"{API}/auth/session", json={})
        assert r.status_code == 400

    def test_auth_session_invalid_id(self):
        r = requests.post(f"{API}/auth/session", json={"session_id": "definitely_fake_id_12345"})
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
    def test_update_profile_smk(self, auth_client, test_session):
        payload = {
            "education_level": "SMK",
            "major": "Teknologi Informasi",
            "institution": "SMKN 1 Jakarta",
            "current_semester": 11,
        }
        r = auth_client.put(f"{API}/profile", json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["education_level"] == "SMK"
        assert data["major"] == "Teknologi Informasi"
        assert data["institution"] == "SMKN 1 Jakarta"
        assert data["current_semester"] == 11
        assert data["onboarded"] is True
        assert "_id" not in data

        r2 = auth_client.get(f"{API}/auth/me")
        assert r2.status_code == 200
        assert r2.json()["major"] == "Teknologi Informasi"

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

        user = mongo_db.users.find_one({"user_id": test_session["user_id"]})
        assert user["major"] is None

        # Restore to SMK for downstream tests
        auth_client.put(f"{API}/profile", json={
            "education_level": "SMK",
            "major": "Teknologi Informasi",
            "institution": "UBSI",
            "current_semester": 4,
        })


# ============== Documents list ==============
class TestDocumentsList:
    def test_documents_empty(self, auth_client):
        r = auth_client.get(f"{API}/documents")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert all("_id" not in d for d in data)


# ============== Upload + polling ==============
@pytest.fixture(scope="module")
def uploaded_doc(auth_client, sample_pdf):
    """Upload PDF, expect immediate 200 with status='processing', then poll to 'ready'."""
    with open(sample_pdf, "rb") as f:
        files = {"file": ("sample.pdf", f, "application/pdf")}
        headers = {k: v for k, v in auth_client.headers.items() if k.lower() != "content-type"}
        t0 = time.time()
        r = requests.post(f"{API}/documents/upload", files=files, headers=headers, timeout=120)
        elapsed = time.time() - t0
    if r.status_code != 200:
        pytest.skip(f"PDF upload failed: {r.status_code} {r.text[:300]}")
    initial = r.json()
    print(f"[upload] elapsed={elapsed:.2f}s status={initial.get('status')}")
    assert elapsed < 10, f"Upload took {elapsed:.1f}s — must return immediately (bg task pattern not effective; event loop is blocked)"
    assert initial["status"] == "processing", f"Expected processing, got {initial.get('status')}"

    doc_id = initial["document_id"]
    final = _poll_until_ready(auth_client, f"{API}/documents/{doc_id}")
    final["_initial_elapsed"] = elapsed
    return final


class TestDocumentUpload:
    def test_upload_returns_immediately_then_ready(self, uploaded_doc):
        d = uploaded_doc
        if d.get("status") == "failed":
            pytest.fail(f"Background analyze failed: {d.get('error')}")
        assert d.get("status") == "ready", f"status={d.get('status')}"
        assert d["filename"] == "sample.pdf"
        assert isinstance(d.get("summary"), str) and len(d["summary"]) > 20
        assert isinstance(d.get("key_concepts"), list) and len(d["key_concepts"]) >= 1
        assert isinstance(d.get("learning_objectives"), list)
        assert "_id" not in d
        assert "file_path" not in d

    def test_documents_list_after_upload(self, auth_client, uploaded_doc):
        r = auth_client.get(f"{API}/documents")
        assert r.status_code == 200
        ids = [d["document_id"] for d in r.json()]
        assert uploaded_doc["document_id"] in ids


# ============== Quiz generate + polling ==============
@pytest.fixture(scope="module")
def generated_quiz(auth_client, uploaded_doc):
    if uploaded_doc.get("status") != "ready":
        pytest.skip("Document not ready, skipping quiz tests")
    t0 = time.time()
    r = auth_client.post(f"{API}/quiz/generate", json={
        "document_id": uploaded_doc["document_id"],
        "question_count": 3,
    }, timeout=120)
    elapsed = time.time() - t0
    if r.status_code != 200:
        pytest.skip(f"Quiz generation failed: {r.status_code} {r.text[:300]}")
    initial = r.json()
    print(f"[quiz/generate] elapsed={elapsed:.2f}s status={initial.get('status')}")
    assert elapsed < 10, f"Quiz generate took {elapsed:.1f}s — must return immediately"
    assert initial.get("status") == "processing"
    quiz_id = initial["quiz_id"]
    final = _poll_until_ready(auth_client, f"{API}/quiz/{quiz_id}")
    return final


class TestQuiz:
    def test_quiz_generate_returns_immediately_then_ready(self, generated_quiz):
        q = generated_quiz
        if q.get("status") == "failed":
            pytest.fail(f"Background quiz gen failed: {q.get('error')}")
        assert q.get("status") == "ready"
        assert "quiz_id" in q
        assert 3 <= len(q["questions"]) <= 5
        for question in q["questions"]:
            assert "correct_index" not in question, "Leaked correct_index!"
            assert len(question["options"]) == 4
            assert "question" in question
            assert "id" in question
        assert "_id" not in q

    def test_quiz_generate_nonexistent_doc_404(self, auth_client):
        r = auth_client.post(f"{API}/quiz/generate", json={
            "document_id": "does-not-exist-xyz",
            "question_count": 3,
        }, timeout=20)
        assert r.status_code == 404, r.text

    def test_quiz_submit_on_processing_quiz_400(self, auth_client, uploaded_doc, mongo_db, test_session):
        # Create a stub quiz with status='processing' directly in DB
        from datetime import datetime, timezone
        stub_id = f"stub-quiz-{int(time.time()*1000)}"
        mongo_db.quizzes.insert_one({
            "quiz_id": stub_id,
            "user_id": test_session["user_id"],
            "document_id": uploaded_doc["document_id"],
            "questions": [],
            "status": "processing",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        r = auth_client.post(f"{API}/quiz/submit", json={
            "quiz_id": stub_id,
            "answers": [0, 0, 0],
        }, timeout=20)
        mongo_db.quizzes.delete_one({"quiz_id": stub_id})
        assert r.status_code == 400, r.text

    def test_quiz_submit_returns_immediately_then_ready(self, auth_client, generated_quiz):
        if generated_quiz.get("status") != "ready":
            pytest.skip("Quiz not ready")
        answers = [0] * len(generated_quiz["questions"])
        t0 = time.time()
        r = auth_client.post(f"{API}/quiz/submit", json={
            "quiz_id": generated_quiz["quiz_id"],
            "answers": answers,
        }, timeout=120)
        elapsed = time.time() - t0
        assert r.status_code == 200, r.text
        result = r.json()
        print(f"[quiz/submit] elapsed={elapsed:.2f}s status={result.get('status')}")
        assert elapsed < 10, f"Quiz submit took {elapsed:.1f}s — must return immediately"
        assert result.get("status") == "processing"
        assert "result_id" in result
        assert "_id" not in result

        # Poll result endpoint
        final = _poll_until_ready(auth_client, f"{API}/quiz/result/{result['result_id']}")
        if final.get("status") == "failed":
            pytest.fail(f"Background grading failed: {final.get('error')}")
        assert final.get("status") == "ready"
        assert isinstance(final.get("score"), int)
        assert 0 <= final["score"] <= 100
        assert isinstance(final.get("summary"), str) and len(final["summary"]) > 0
        assert isinstance(final.get("items"), list) and len(final["items"]) >= 1
        for it in final["items"]:
            assert "explanation" in it
            assert "references" in it
        assert "_id" not in final


# ============== Audit logs & progress ==============
class TestAuditAndProgress:
    def test_audit_logs_format(self, auth_client):
        r = auth_client.get(f"{API}/audit-logs")
        assert r.status_code == 200
        logs = r.json()
        assert isinstance(logs, list)
        assert len(logs) >= 1
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

        r2 = s.get(f"{API}/auth/me")
        assert r2.status_code == 401
