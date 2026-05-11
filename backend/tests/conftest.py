"""Shared fixtures for EduScanner AI backend tests."""
import os
import time
import pytest
import requests
from pymongo import MongoClient
from pathlib import Path
from fpdf import FPDF

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://akademik-scan.preview.emergentagent.com').rstrip('/')
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'test_database')


@pytest.fixture(scope="session")
def mongo_db():
    cli = MongoClient(MONGO_URL)
    yield cli[DB_NAME]
    cli.close()


@pytest.fixture(scope="session")
def test_session(mongo_db):
    """Create a fresh test user + session directly in MongoDB."""
    ts = int(time.time() * 1000)
    user_id = f"test-user-{ts}"
    token = f"test_session_{ts}"
    from datetime import datetime, timezone, timedelta
    mongo_db.users.insert_one({
        "user_id": user_id,
        "email": f"test.student.{ts}@example.com",
        "name": "Budi Test",
        "picture": None,
        "onboarded": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    mongo_db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": token,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    yield {"user_id": user_id, "token": token}
    # Teardown
    mongo_db.users.delete_one({"user_id": user_id})
    mongo_db.user_sessions.delete_many({"user_id": user_id})
    mongo_db.documents.delete_many({"user_id": user_id})
    mongo_db.quizzes.delete_many({"user_id": user_id})
    mongo_db.quiz_results.delete_many({"user_id": user_id})
    mongo_db.audit_logs.delete_many({"user_id": user_id})
    mongo_db.folders.delete_many({"user_id": user_id})
    mongo_db.recaps.delete_many({"user_id": user_id})


@pytest.fixture(scope="session")
def auth_client(test_session):
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {test_session['token']}"})
    return s


@pytest.fixture(scope="session")
def sample_pdf(tmp_path_factory):
    p = tmp_path_factory.mktemp("pdf") / "sample.pdf"
    pdf = FPDF()
    pdf.add_page()
    pdf.set_margins(15, 15, 15)
    pdf.set_font("helvetica", size=12)
    paragraphs = [
        "Pengenalan Basis Data Relasional",
        "",
        "Basis data relasional adalah kumpulan data terstruktur yang menyimpan informasi dalam bentuk tabel.",
        "Setiap tabel terdiri dari baris (record) dan kolom (field). Primary key memastikan setiap baris unik.",
        "Foreign key digunakan untuk merelasikan dua tabel berbeda.",
        "",
        "Normalisasi adalah teknik untuk mengurangi redudansi data. Bentuk normal yang umum adalah 1NF, 2NF, 3NF.",
        "Structured Query Language (SQL) digunakan untuk memanipulasi data. Perintah utama: SELECT, INSERT, UPDATE, DELETE.",
        "Index dipakai untuk mempercepat query. ACID (Atomicity, Consistency, Isolation, Durability) menjamin transaksi.",
        "Contoh kode: SELECT nama FROM mahasiswa WHERE semester = 4;",
        "ERD (Entity Relationship Diagram) merupakan diagram untuk memodelkan entitas dan relasinya.",
    ]
    for line in paragraphs:
        if line:
            pdf.multi_cell(180, 8, line)
        else:
            pdf.ln(4)
    pdf.output(str(p))
    return str(p)
