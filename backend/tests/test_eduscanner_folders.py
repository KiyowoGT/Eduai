"""Iteration 5 — Folders + Multi-source Quiz + Recap for EduScanner AI."""
import os
import time
import pytest
import requests
from pathlib import Path
from fpdf import FPDF

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
API = f"{BASE_URL}/api"

POLL_INTERVAL = 3
POLL_TIMEOUT = 240


# ============== Helpers ==============
def _poll(client, url, timeout=POLL_TIMEOUT, interval=POLL_INTERVAL):
    deadline = time.time() + timeout
    last = None
    while time.time() < deadline:
        r = client.get(url, timeout=30)
        if r.status_code != 200:
            return {"status": "http_error", "code": r.status_code, "text": r.text[:300]}
        last = r.json()
        if last.get("status") in ("ready", "failed", "cancelled", "deleted"):
            return last
        time.sleep(interval)
    return last or {"status": "timeout"}


def _make_pdf(path: Path, title: str, body_lines):
    pdf = FPDF()
    pdf.add_page()
    pdf.set_margins(15, 15, 15)
    pdf.set_font("helvetica", size=12)
    pdf.multi_cell(180, 10, title)
    pdf.ln(4)
    for line in body_lines:
        if line:
            pdf.multi_cell(180, 8, line)
        else:
            pdf.ln(3)
    pdf.output(str(path))
    return str(path)


@pytest.fixture(scope="module")
def pdf_basisdata(tmp_path_factory):
    p = tmp_path_factory.mktemp("multi") / "basisdata.pdf"
    return _make_pdf(p, "Pengenalan Basis Data", [
        "Basis data relasional menyimpan informasi dalam tabel yang terdiri atas baris dan kolom.",
        "Primary key memastikan setiap baris unik, foreign key digunakan untuk merelasikan tabel.",
        "Normalisasi (1NF, 2NF, 3NF) digunakan untuk mengurangi redundansi data.",
        "Bahasa SQL digunakan untuk SELECT, INSERT, UPDATE, DELETE.",
        "ACID menjamin transaksi yang aman: Atomicity, Consistency, Isolation, Durability.",
    ])


@pytest.fixture(scope="module")
def pdf_polimorfisme(tmp_path_factory):
    p = tmp_path_factory.mktemp("multi") / "polimorfisme.pdf"
    return _make_pdf(p, "Polimorfisme dalam OOP", [
        "Polimorfisme adalah kemampuan sebuah objek untuk mengambil banyak bentuk.",
        "Dalam OOP, polimorfisme sering diwujudkan lewat method overriding dan overloading.",
        "Subclass dapat mengubah perilaku method dari superclass-nya melalui override.",
        "Polimorfisme parametrik menggunakan generics atau templates.",
        "Manfaat polimorfisme: code reuse, fleksibilitas, dan kemudahan ekstensi.",
    ])


def _upload(auth_client, pdf_path, name):
    with open(pdf_path, "rb") as f:
        files = {"file": (name, f, "application/pdf")}
        headers = {k: v for k, v in auth_client.headers.items() if k.lower() != "content-type"}
        r = requests.post(f"{API}/documents/upload", files=files, headers=headers, timeout=60)
    assert r.status_code == 200, r.text
    return r.json()


# ============== Folder CRUD ==============
class TestFolderCRUD:
    def test_folder_create(self, auth_client):
        r = auth_client.post(f"{API}/folders", json={"name": "Semester 4"}, timeout=20)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["name"] == "Semester 4"
        assert "folder_id" in body
        assert body["document_count"] == 0
        assert "_id" not in body
        # cleanup
        auth_client.delete(f"{API}/folders/{body['folder_id']}", timeout=20)

    def test_folder_create_empty_name_400(self, auth_client):
        r = auth_client.post(f"{API}/folders", json={"name": "   "}, timeout=20)
        assert r.status_code == 400

    def test_folder_list_returns_counts(self, auth_client):
        c = auth_client.post(f"{API}/folders", json={"name": "Folder A"}, timeout=20).json()
        r = auth_client.get(f"{API}/folders", timeout=20)
        assert r.status_code == 200
        lst = r.json()
        assert any(f["folder_id"] == c["folder_id"] and f["document_count"] == 0 for f in lst)
        for f in lst:
            assert "_id" not in f
            assert "document_count" in f
        auth_client.delete(f"{API}/folders/{c['folder_id']}", timeout=20)

    def test_folder_get_with_documents_array(self, auth_client):
        c = auth_client.post(f"{API}/folders", json={"name": "Folder B"}, timeout=20).json()
        r = auth_client.get(f"{API}/folders/{c['folder_id']}", timeout=20)
        assert r.status_code == 200
        body = r.json()
        assert body["folder_id"] == c["folder_id"]
        assert isinstance(body["documents"], list)
        assert body["document_count"] == 0
        auth_client.delete(f"{API}/folders/{c['folder_id']}", timeout=20)

    def test_folder_rename(self, auth_client):
        c = auth_client.post(f"{API}/folders", json={"name": "Old"}, timeout=20).json()
        r = auth_client.put(f"{API}/folders/{c['folder_id']}", json={"name": "New Name"}, timeout=20)
        assert r.status_code == 200, r.text
        assert r.json()["name"] == "New Name"
        # GET reflects update
        g = auth_client.get(f"{API}/folders/{c['folder_id']}").json()
        assert g["name"] == "New Name"
        auth_client.delete(f"{API}/folders/{c['folder_id']}", timeout=20)

    def test_folder_get_nonexistent_404(self, auth_client):
        assert auth_client.get(f"{API}/folders/does-not-exist-xyz").status_code == 404

    def test_folder_rename_nonexistent_404(self, auth_client):
        r = auth_client.put(f"{API}/folders/nope", json={"name": "x"}, timeout=20)
        assert r.status_code == 404

    def test_folder_delete_empty(self, auth_client):
        c = auth_client.post(f"{API}/folders", json={"name": "Empty"}, timeout=20).json()
        r = auth_client.delete(f"{API}/folders/{c['folder_id']}", timeout=20)
        assert r.status_code == 200
        body = r.json()
        assert body["deleted"] is True
        assert body["documents_deleted"] == 0
        assert auth_client.get(f"{API}/folders/{c['folder_id']}").status_code == 404


# ============== Move documents ==============
class TestDocumentsMove:
    def test_move_doc_into_folder_and_back(self, auth_client, pdf_basisdata):
        # upload one doc (no need to wait for ready for move test)
        d = _upload(auth_client, pdf_basisdata, "basisdata_move.pdf")
        doc_id = d["document_id"]
        folder = auth_client.post(f"{API}/folders", json={"name": "MoveTarget"}).json()
        fid = folder["folder_id"]

        # Move
        r = auth_client.post(f"{API}/documents/move", json={"document_ids": [doc_id], "folder_id": fid}, timeout=20)
        assert r.status_code == 200, r.text
        assert r.json()["moved"] == 1
        assert r.json()["folder_id"] == fid

        # GET reflects new folder_id
        got = auth_client.get(f"{API}/documents/{doc_id}").json()
        assert got["folder_id"] == fid

        # Unset (folder_id=null)
        r2 = auth_client.post(f"{API}/documents/move", json={"document_ids": [doc_id], "folder_id": None}, timeout=20)
        assert r2.status_code == 200
        got2 = auth_client.get(f"{API}/documents/{doc_id}").json()
        assert got2.get("folder_id") in (None, "")

        # Cleanup
        auth_client.delete(f"{API}/documents/{doc_id}", timeout=20)
        auth_client.delete(f"{API}/folders/{fid}", timeout=20)

    def test_move_to_nonexistent_folder_404(self, auth_client, pdf_basisdata):
        d = _upload(auth_client, pdf_basisdata, "move_404.pdf")
        doc_id = d["document_id"]
        r = auth_client.post(f"{API}/documents/move", json={
            "document_ids": [doc_id], "folder_id": "no-such-folder-xyz"
        }, timeout=20)
        assert r.status_code == 404
        auth_client.delete(f"{API}/documents/{doc_id}", timeout=20)


# ============== Multi-source upload fixture (module-scope) ==============
@pytest.fixture(scope="module")
def two_ready_docs(auth_client, pdf_basisdata, pdf_polimorfisme):
    d1 = _upload(auth_client, pdf_basisdata, "basisdata.pdf")
    d2 = _upload(auth_client, pdf_polimorfisme, "polimorfisme.pdf")
    f1 = _poll(auth_client, f"{API}/documents/{d1['document_id']}", timeout=240)
    f2 = _poll(auth_client, f"{API}/documents/{d2['document_id']}", timeout=240)
    if f1.get("status") != "ready" or f2.get("status") != "ready":
        pytest.skip(f"Docs not ready: {f1.get('status')} / {f2.get('status')}")
    yield [f1, f2]
    auth_client.delete(f"{API}/documents/{f1['document_id']}", timeout=20)
    auth_client.delete(f"{API}/documents/{f2['document_id']}", timeout=20)


# ============== Quiz multi-source ==============
class TestQuizMultiSource:
    def test_quiz_no_source_400(self, auth_client):
        r = auth_client.post(f"{API}/quiz/generate", json={"question_count": 3}, timeout=20)
        assert r.status_code == 400

    def test_quiz_not_ready_doc_400(self, auth_client, pdf_basisdata, two_ready_docs):
        # Upload but DON'T wait for ready
        d = _upload(auth_client, pdf_basisdata, "still_processing.pdf")
        r = auth_client.post(f"{API}/quiz/generate", json={
            "document_ids": [d["document_id"]], "question_count": 3
        }, timeout=20)
        # Either 400 ("belum siap") or - if Gemini was very fast - the doc may already be ready.
        # We rely on the fact that upload returns immediately with status=processing.
        if r.status_code == 400:
            assert "belum siap" in r.text.lower() or "not ready" in r.text.lower() or "siap" in r.text.lower()
        else:
            # Fast path: assert it's 200 in that race condition case
            assert r.status_code == 200
        auth_client.delete(f"{API}/documents/{d['document_id']}", timeout=20)

    def test_quiz_multi_source_returns_source_title(self, auth_client, two_ready_docs):
        ids = [d["document_id"] for d in two_ready_docs]
        r = auth_client.post(f"{API}/quiz/generate", json={
            "document_ids": ids, "question_count": 5,
        }, timeout=20)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["status"] == "processing"
        assert set(body["document_ids"]) == set(ids)
        assert isinstance(body["source_titles"], list) and len(body["source_titles"]) == 2

        final = _poll(auth_client, f"{API}/quiz/{body['quiz_id']}", timeout=240)
        if final.get("status") == "failed":
            pytest.fail(f"Multi-source quiz gen failed: {final.get('error')}")
        assert final["status"] == "ready"
        assert isinstance(final["source_titles"], list)
        assert 3 <= len(final["questions"]) <= 7
        for q in final["questions"]:
            assert "correct_index" not in q
            assert "source_title" in q, f"Question missing source_title: {q}"
        # Cleanup
        auth_client.delete(f"{API}/quiz/{body['quiz_id']}", timeout=20)

    def test_quiz_folder_source(self, auth_client, two_ready_docs):
        folder = auth_client.post(f"{API}/folders", json={"name": "QuizFolder"}).json()
        fid = folder["folder_id"]
        ids = [d["document_id"] for d in two_ready_docs]
        auth_client.post(f"{API}/documents/move", json={"document_ids": ids, "folder_id": fid})

        r = auth_client.post(f"{API}/quiz/generate", json={
            "folder_id": fid, "question_count": 5,
        }, timeout=20)
        assert r.status_code == 200, r.text
        body = r.json()
        assert set(body["document_ids"]) == set(ids)
        final = _poll(auth_client, f"{API}/quiz/{body['quiz_id']}", timeout=240)
        if final.get("status") == "failed":
            pytest.fail(f"Folder-source quiz failed: {final.get('error')}")
        assert final["status"] == "ready"
        assert len(final["source_titles"]) == 2

        # Cleanup: move out + delete folder + delete quiz
        auth_client.delete(f"{API}/quiz/{body['quiz_id']}", timeout=20)
        auth_client.post(f"{API}/documents/move", json={"document_ids": ids, "folder_id": None})
        auth_client.delete(f"{API}/folders/{fid}", timeout=20)

    def test_quiz_backward_compat_single_document_id(self, auth_client, two_ready_docs):
        r = auth_client.post(f"{API}/quiz/generate", json={
            "document_id": two_ready_docs[0]["document_id"], "question_count": 3,
        }, timeout=20)
        assert r.status_code == 200, r.text
        body = r.json()
        final = _poll(auth_client, f"{API}/quiz/{body['quiz_id']}", timeout=240)
        if final.get("status") == "failed":
            pytest.fail("BC quiz failed")
        assert final["status"] == "ready"
        auth_client.delete(f"{API}/quiz/{body['quiz_id']}", timeout=20)


# ============== Recap ==============
class TestRecap:
    def test_recap_multi_doc(self, auth_client, two_ready_docs):
        ids = [d["document_id"] for d in two_ready_docs]
        r = auth_client.post(f"{API}/recap", json={"document_ids": ids}, timeout=20)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["status"] == "processing"
        assert set(body["document_ids"]) == set(ids)
        assert isinstance(body["source_titles"], list) and len(body["source_titles"]) == 2

        final = _poll(auth_client, f"{API}/recap/{body['recap_id']}", timeout=240)
        if final.get("status") == "failed":
            pytest.fail(f"Recap failed: {final.get('error')}")
        assert final["status"] == "ready"
        assert isinstance(final["title"], str) and len(final["title"]) > 0
        assert isinstance(final["unified_summary"], str) and len(final["unified_summary"]) > 20
        assert isinstance(final["per_document"], list) and len(final["per_document"]) >= 1
        for pd in final["per_document"]:
            assert "source_title" in pd
            assert "highlight" in pd
        assert isinstance(final["shared_concepts"], list)
        assert isinstance(final["study_path"], list)
        assert "_id" not in final

        # Listing
        rl = auth_client.get(f"{API}/recaps", timeout=20)
        assert rl.status_code == 200
        assert any(x["recap_id"] == body["recap_id"] for x in rl.json())

        auth_client.delete(f"{API}/recap/{body['recap_id']}", timeout=20)

    def test_recap_folder_source(self, auth_client, two_ready_docs):
        folder = auth_client.post(f"{API}/folders", json={"name": "RecapFolder"}).json()
        fid = folder["folder_id"]
        ids = [d["document_id"] for d in two_ready_docs]
        auth_client.post(f"{API}/documents/move", json={"document_ids": ids, "folder_id": fid})

        r = auth_client.post(f"{API}/recap", json={"folder_id": fid}, timeout=20)
        assert r.status_code == 200, r.text
        rid = r.json()["recap_id"]
        final = _poll(auth_client, f"{API}/recap/{rid}", timeout=240)
        if final.get("status") == "failed":
            pytest.fail(f"Folder recap failed: {final.get('error')}")
        assert final["status"] == "ready"
        assert len(final["source_titles"]) == 2

        auth_client.delete(f"{API}/recap/{rid}", timeout=20)
        auth_client.post(f"{API}/documents/move", json={"document_ids": ids, "folder_id": None})
        auth_client.delete(f"{API}/folders/{fid}", timeout=20)

    def test_recap_cancel_not_overwritten(self, auth_client, two_ready_docs):
        ids = [d["document_id"] for d in two_ready_docs]
        r = auth_client.post(f"{API}/recap", json={"document_ids": ids}, timeout=20)
        assert r.status_code == 200
        rid = r.json()["recap_id"]
        # Cancel immediately
        rc = auth_client.post(f"{API}/recap/{rid}/cancel", timeout=20)
        assert rc.status_code == 200, rc.text
        assert rc.json()["status"] == "cancelled"

        # Cancel again should 400
        rc2 = auth_client.post(f"{API}/recap/{rid}/cancel", timeout=20)
        assert rc2.status_code == 400

        time.sleep(65)
        rg = auth_client.get(f"{API}/recap/{rid}", timeout=20)
        assert rg.status_code == 200
        assert rg.json()["status"] == "cancelled", (
            f"Recap bg task overwrote cancelled to {rg.json().get('status')}"
        )
        auth_client.delete(f"{API}/recap/{rid}", timeout=20)

    def test_recap_delete_and_404(self, auth_client, two_ready_docs):
        ids = [d["document_id"] for d in two_ready_docs]
        r = auth_client.post(f"{API}/recap", json={"document_ids": ids}, timeout=20)
        rid = r.json()["recap_id"]
        final = _poll(auth_client, f"{API}/recap/{rid}", timeout=240)
        if final.get("status") != "ready":
            pytest.skip(f"recap not ready: {final.get('status')}")
        rd = auth_client.delete(f"{API}/recap/{rid}", timeout=20)
        assert rd.status_code == 200
        assert rd.json()["deleted"] is True
        assert auth_client.get(f"{API}/recap/{rid}").status_code == 404

    def test_recap_no_source_400(self, auth_client):
        r = auth_client.post(f"{API}/recap", json={}, timeout=20)
        assert r.status_code == 400


# ============== Cascade folder delete ==============
class TestFolderCascade:
    def test_cascade_delete_folder_removes_docs_quizzes_results_files(
        self, auth_client, mongo_db, pdf_basisdata, pdf_polimorfisme
    ):
        # 1. Upload 2 fresh docs (separate from module-scoped fixture so we can delete them)
        d1 = _upload(auth_client, pdf_basisdata, "cascade_a.pdf")
        d2 = _upload(auth_client, pdf_polimorfisme, "cascade_b.pdf")
        f1 = _poll(auth_client, f"{API}/documents/{d1['document_id']}", timeout=240)
        f2 = _poll(auth_client, f"{API}/documents/{d2['document_id']}", timeout=240)
        if f1.get("status") != "ready" or f2.get("status") != "ready":
            pytest.skip("Cascade docs not ready")

        # Capture file paths from DB for filesystem verification
        raw1 = mongo_db.documents.find_one({"document_id": d1["document_id"]})
        raw2 = mongo_db.documents.find_one({"document_id": d2["document_id"]})
        path1 = raw1.get("file_path")
        path2 = raw2.get("file_path")
        assert path1 and Path(path1).exists(), f"file 1 missing: {path1}"
        assert path2 and Path(path2).exists(), f"file 2 missing: {path2}"

        # 2. Create folder, move both
        folder = auth_client.post(f"{API}/folders", json={"name": "CascadeFolder"}).json()
        fid = folder["folder_id"]
        auth_client.post(f"{API}/documents/move", json={
            "document_ids": [d1["document_id"], d2["document_id"]], "folder_id": fid,
        })

        # 3. Quiz from folder, wait ready, submit, wait result
        qr = auth_client.post(f"{API}/quiz/generate", json={
            "folder_id": fid, "question_count": 3,
        }, timeout=20)
        assert qr.status_code == 200, qr.text
        quiz_id = qr.json()["quiz_id"]
        qfinal = _poll(auth_client, f"{API}/quiz/{quiz_id}", timeout=240)
        if qfinal.get("status") != "ready":
            pytest.skip(f"Cascade quiz not ready: {qfinal.get('status')}")
        answers = [0] * len(qfinal["questions"])
        sr = auth_client.post(f"{API}/quiz/submit", json={
            "quiz_id": quiz_id, "answers": answers,
        }, timeout=20)
        result_id = sr.json()["result_id"]
        rfinal = _poll(auth_client, f"{API}/quiz/result/{result_id}", timeout=240)
        if rfinal.get("status") != "ready":
            pytest.skip("Cascade result not ready")

        # 4. DELETE folder
        rd = auth_client.delete(f"{API}/folders/{fid}", timeout=30)
        assert rd.status_code == 200, rd.text
        body = rd.json()
        assert body["deleted"] is True
        assert body["documents_deleted"] == 2

        # 5. Verify everything is gone
        assert auth_client.get(f"{API}/folders/{fid}").status_code == 404
        assert auth_client.get(f"{API}/documents/{d1['document_id']}").status_code == 404
        assert auth_client.get(f"{API}/documents/{d2['document_id']}").status_code == 404
        assert auth_client.get(f"{API}/quiz/{quiz_id}").status_code == 404
        assert auth_client.get(f"{API}/quiz/result/{result_id}").status_code == 404

        # 6. DB-level check
        assert mongo_db.documents.find_one({"document_id": d1["document_id"]}) is None
        assert mongo_db.documents.find_one({"document_id": d2["document_id"]}) is None
        assert mongo_db.quizzes.find_one({"quiz_id": quiz_id}) is None
        assert mongo_db.quiz_results.find_one({"result_id": result_id}) is None
        assert mongo_db.folders.find_one({"folder_id": fid}) is None

        # 7. Files removed from /app/backend/uploads
        assert not Path(path1).exists(), f"file 1 still on disk: {path1}"
        assert not Path(path2).exists(), f"file 2 still on disk: {path2}"
