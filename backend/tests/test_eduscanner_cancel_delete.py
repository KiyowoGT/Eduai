"""Iteration 4: cancel & delete endpoints + cascade for EduScanner AI."""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
API = f"{BASE_URL}/api"


def _poll(client, url, timeout=180, interval=3):
    deadline = time.time() + timeout
    last = None
    while time.time() < deadline:
        r = client.get(url, timeout=30)
        if r.status_code != 200:
            return {"status": "http_error", "code": r.status_code}
        last = r.json()
        if last.get("status") in ("ready", "failed", "cancelled", "deleted"):
            return last
        time.sleep(interval)
    return last or {"status": "timeout"}


def _upload_pdf(auth_client, sample_pdf):
    with open(sample_pdf, "rb") as f:
        files = {"file": ("sample.pdf", f, "application/pdf")}
        headers = {k: v for k, v in auth_client.headers.items() if k.lower() != "content-type"}
        r = requests.post(f"{API}/documents/upload", files=files, headers=headers, timeout=60)
    assert r.status_code == 200, r.text
    return r.json()


# ============== Document cancel ==============
class TestDocumentCancel:
    def test_cancel_processing_then_not_overwritten(self, auth_client, sample_pdf):
        """Upload, immediately cancel, wait >=90s, verify status stays 'cancelled'."""
        doc = _upload_pdf(auth_client, sample_pdf)
        doc_id = doc["document_id"]
        assert doc["status"] == "processing"

        # Cancel immediately (within 5s of upload)
        r = auth_client.post(f"{API}/documents/{doc_id}/cancel", timeout=20)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["document_id"] == doc_id
        assert body["status"] == "cancelled"

        # Confirm immediately persisted
        r2 = auth_client.get(f"{API}/documents/{doc_id}")
        assert r2.status_code == 200
        assert r2.json()["status"] == "cancelled"

        # Wait 95s to ensure bg Gemini call finishes and would have tried to write 'ready'
        time.sleep(95)
        r3 = auth_client.get(f"{API}/documents/{doc_id}")
        assert r3.status_code == 200
        final_status = r3.json()["status"]
        assert final_status == "cancelled", (
            f"Background task overwrote cancelled status to '{final_status}' — "
            "the status-guard in _bg_analyze_document is not effective."
        )

        # Cleanup
        auth_client.delete(f"{API}/documents/{doc_id}", timeout=20)

    def test_cancel_ready_doc_400(self, auth_client, sample_pdf):
        doc = _upload_pdf(auth_client, sample_pdf)
        doc_id = doc["document_id"]
        final = _poll(auth_client, f"{API}/documents/{doc_id}", timeout=180)
        if final.get("status") != "ready":
            pytest.skip(f"Doc didn't reach ready: {final.get('status')}")
        r = auth_client.post(f"{API}/documents/{doc_id}/cancel", timeout=20)
        assert r.status_code == 400, r.text
        # Cleanup
        auth_client.delete(f"{API}/documents/{doc_id}", timeout=20)

    def test_cancel_nonexistent_doc_404(self, auth_client):
        r = auth_client.post(f"{API}/documents/does-not-exist-zzz/cancel", timeout=20)
        assert r.status_code == 404


# ============== Document delete (simple) ==============
class TestDocumentDelete:
    def test_delete_nonexistent_404(self, auth_client):
        r = auth_client.delete(f"{API}/documents/no-such-doc-xyz", timeout=20)
        assert r.status_code == 404

    def test_delete_ready_doc_then_404(self, auth_client, sample_pdf):
        doc = _upload_pdf(auth_client, sample_pdf)
        doc_id = doc["document_id"]
        final = _poll(auth_client, f"{API}/documents/{doc_id}", timeout=180)
        if final.get("status") != "ready":
            pytest.skip(f"Doc didn't reach ready: {final.get('status')}")

        r = auth_client.delete(f"{API}/documents/{doc_id}", timeout=20)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["document_id"] == doc_id
        assert body["deleted"] is True

        # GET should now 404
        r2 = auth_client.get(f"{API}/documents/{doc_id}")
        assert r2.status_code == 404

        # Not in list either
        r3 = auth_client.get(f"{API}/documents")
        assert r3.status_code == 200
        assert doc_id not in [d["document_id"] for d in r3.json()]


# ============== Quiz cancel + delete ==============
class TestQuizCancelDelete:
    def test_quiz_cancel_and_not_overwritten(self, auth_client, sample_pdf):
        doc = _upload_pdf(auth_client, sample_pdf)
        doc_id = doc["document_id"]
        final = _poll(auth_client, f"{API}/documents/{doc_id}", timeout=180)
        if final.get("status") != "ready":
            pytest.skip("Doc not ready")

        r = auth_client.post(f"{API}/quiz/generate", json={
            "document_id": doc_id, "question_count": 3,
        }, timeout=20)
        assert r.status_code == 200
        quiz = r.json()
        quiz_id = quiz["quiz_id"]
        assert quiz["status"] == "processing"

        # Cancel immediately
        rc = auth_client.post(f"{API}/quiz/{quiz_id}/cancel", timeout=20)
        assert rc.status_code == 200, rc.text
        assert rc.json()["status"] == "cancelled"

        # Wait for bg task to finish
        time.sleep(60)
        rg = auth_client.get(f"{API}/quiz/{quiz_id}")
        assert rg.status_code == 200
        assert rg.json()["status"] == "cancelled", (
            f"Quiz bg task overwrote cancelled status: {rg.json().get('status')}"
        )

        # Cancel on already-cancelled should 400
        rc2 = auth_client.post(f"{API}/quiz/{quiz_id}/cancel", timeout=20)
        assert rc2.status_code == 400

        # Delete the quiz directly
        rd = auth_client.delete(f"{API}/quiz/{quiz_id}", timeout=20)
        assert rd.status_code == 200
        assert rd.json()["deleted"] is True

        # 404 on subsequent GET
        rg2 = auth_client.get(f"{API}/quiz/{quiz_id}")
        assert rg2.status_code == 404

        # Cleanup doc
        auth_client.delete(f"{API}/documents/{doc_id}", timeout=20)

    def test_quiz_delete_nonexistent_404(self, auth_client):
        r = auth_client.delete(f"{API}/quiz/nope-quiz-xyz", timeout=20)
        assert r.status_code == 404


# ============== Result cancel + delete + cascade ==============
class TestResultAndCascade:
    def test_full_cascade_delete(self, auth_client, sample_pdf, mongo_db, test_session):
        """upload→ready→quiz→ready→submit→ready→DELETE doc → quizzes & results gone."""
        doc = _upload_pdf(auth_client, sample_pdf)
        doc_id = doc["document_id"]
        final = _poll(auth_client, f"{API}/documents/{doc_id}", timeout=180)
        if final.get("status") != "ready":
            pytest.skip("Doc not ready")

        # Generate quiz
        r = auth_client.post(f"{API}/quiz/generate", json={
            "document_id": doc_id, "question_count": 3,
        }, timeout=20)
        assert r.status_code == 200
        quiz_id = r.json()["quiz_id"]
        qfinal = _poll(auth_client, f"{API}/quiz/{quiz_id}", timeout=180)
        if qfinal.get("status") != "ready":
            pytest.skip("Quiz not ready")

        # Submit answers
        answers = [0] * len(qfinal["questions"])
        rs = auth_client.post(f"{API}/quiz/submit", json={
            "quiz_id": quiz_id, "answers": answers,
        }, timeout=20)
        assert rs.status_code == 200
        result_id = rs.json()["result_id"]
        rfinal = _poll(auth_client, f"{API}/quiz/result/{result_id}", timeout=180)
        if rfinal.get("status") != "ready":
            pytest.skip("Result not ready")

        # Cancel on a ready result → 400
        rc = auth_client.post(f"{API}/quiz/result/{result_id}/cancel", timeout=20)
        assert rc.status_code == 400

        # Cascade DELETE doc
        rd = auth_client.delete(f"{API}/documents/{doc_id}", timeout=20)
        assert rd.status_code == 200
        assert rd.json()["deleted"] is True

        # quiz GET → 404, result GET → 404
        assert auth_client.get(f"{API}/quiz/{quiz_id}").status_code == 404
        assert auth_client.get(f"{API}/quiz/result/{result_id}").status_code == 404

        # mongo direct check (definitive)
        assert mongo_db.quizzes.find_one({"quiz_id": quiz_id}) is None
        assert mongo_db.quiz_results.find_one({"result_id": result_id}) is None
        assert mongo_db.documents.find_one({"document_id": doc_id}) is None

    def test_result_delete_only_removes_result(self, auth_client, sample_pdf, mongo_db):
        doc = _upload_pdf(auth_client, sample_pdf)
        doc_id = doc["document_id"]
        if _poll(auth_client, f"{API}/documents/{doc_id}", timeout=180).get("status") != "ready":
            pytest.skip("doc not ready")
        rq = auth_client.post(f"{API}/quiz/generate", json={
            "document_id": doc_id, "question_count": 3,
        }, timeout=20)
        quiz_id = rq.json()["quiz_id"]
        qfinal = _poll(auth_client, f"{API}/quiz/{quiz_id}", timeout=180)
        if qfinal.get("status") != "ready":
            pytest.skip("quiz not ready")
        answers = [0] * len(qfinal["questions"])
        rs = auth_client.post(f"{API}/quiz/submit", json={
            "quiz_id": quiz_id, "answers": answers,
        }, timeout=20)
        result_id = rs.json()["result_id"]
        if _poll(auth_client, f"{API}/quiz/result/{result_id}", timeout=180).get("status") != "ready":
            pytest.skip("result not ready")

        rd = auth_client.delete(f"{API}/quiz/result/{result_id}", timeout=20)
        assert rd.status_code == 200
        assert rd.json()["deleted"] is True

        # Result is gone, but quiz and doc still exist
        assert auth_client.get(f"{API}/quiz/result/{result_id}").status_code == 404
        assert auth_client.get(f"{API}/quiz/{quiz_id}").status_code == 200
        assert auth_client.get(f"{API}/documents/{doc_id}").status_code == 200

        # Cleanup
        auth_client.delete(f"{API}/documents/{doc_id}", timeout=20)

    def test_result_delete_nonexistent_404(self, auth_client):
        r = auth_client.delete(f"{API}/quiz/result/no-such-result", timeout=20)
        assert r.status_code == 404
