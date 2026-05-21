# Laporan Implementasi & Perbaikan ADSPL — EduScanner AI (EduAI)

## Ringkasan Perubahan

Berdasarkan analisis ADSPL, telah dilakukan perbaikan pada **2 area critical**, **2 area high**, dan **4 area medium**. Perubahan mencakup backend FastAPI (Python), frontend React, dan konfigurasi proyek.

---

## 1. Keamanan & Autentikasi

### ❌ Critical — Hardcoded Gemini API Key Fallback Dihapus
- **File:** `backend/server.py:57`
- **Sebelum:** `GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY', "AIzaSyAhVnCOblQvDvq9VIG6A4ztOdGh_yqarfk")`
- **Sesudah:** `GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY')` — jika tidak diset, server **gagal startup** dengan `RuntimeError`.
- **Rasional:** Key hardcoded di source code adalah **celah keamanan kritis**. Siapa pun yang mengakses repositori bisa menggunakan key tersebut.

### ✅ Sedang — Environment Variables Tidak Lagi Tergit
- **File:** `.gitignore` (dibersihkan, duplikat dihapus)
- **File baru:** `backend/.env.example` (template environment)
- **File baru:** `frontend/.env.example` (sudah ada, diperiksa kelengkapannya)
- **Rasional:** `.env` dan `.env.*` sudah masuk `.gitignore` sejak awal, tetapi file `.gitignore` mengandung baris duplikat dan baris `-e` yang rusak. Dibersihkan.

---

## 2. Manajemen Data & Validasi

### ❌ Critical — Soft Delete untuk Dokumen (seperti Folder)
- **File:** `backend/server.py:1931-1958`
- **Sebelum:** `delete_document()` melakukan **hard delete**:
  - Menghapus dokumen, quiz, hasil quiz, file PDF, dan Supabase storage secara permanen
  - `db.documents.delete_one()`, `db.quizzes.delete_many()`, `db.quiz_results.delete_many()`
- **Sesudah:** Soft delete dengan pola yang sama seperti folder:
  - Status diubah menjadi `"deleted"`, ditambah timestamp `deleted_at`
  - Data tetap di database (dapat dipulihkan)
  - Hanya file fisik PDF dan Supabase Storage yang dibersihkan
  - `db.documents.find()` (list) otomatis memfilter `status: {"$ne": "deleted"}`
- **Rasional:** Mencegah kehilangan data akibat penghapusan tidak sengaja. Konsisten dengan mekanisme folder.

### ❌ High — Validasi Ukuran File Sebelum Read
- **File:** `backend/server.py:1693-1700` dan `1783-1805`
- **Sebelum:** File dibaca penuh ke memory (`await file.read()`), **baru** diperiksa ukurannya
- **Sesudah:** Pengecekan `Content-Length` header **sebelum** membaca body
  ```python
  content_length = request.headers.get("content-length")
  if content_length and int(content_length) > MAX_UPLOAD_BYTES:
      raise HTTPException(413, "File terlalu besar...")
  ```
- **Rasional:** Mencegah memory overflow/DoS. Ukuran maksimal: **15MB** (dikonfigurasi via env).

### ✅ Medium — Explicit Database Indexes
- **File:** `backend/server.py` — fungsi baru `_ensure_db_indexes()` dipanggil di startup
- Indexes ditambahkan untuk koleksi: `documents`, `folders`, `quizzes`, `quiz_results`, `pdf_files`, `messages`, `friend_requests`, `notifications`, `recaps`
- **Rasional:** Sebelumnya hanya mengandalkan implicit indexes MongoDB. Dengan explicit indexes, query lebih cepat dan predictable.

---

## 3. Arsitektur AI & Real-time

### ❌ High — Polling Diganti WebSocket
- **File:** `frontend/src/lib/api.js` — fungsi baru `waitForStatus()` dengan dukungan AbortSignal
- **File:** `frontend/src/pages/DocumentDetail.jsx` — `startQuiz()` (status quiz)
- **File:** `frontend/src/pages/FolderDetail.jsx` — `doCreateRecap()` (status recap) dan `doStartQuiz()` (status quiz)
- **File:** `frontend/src/pages/Quiz.jsx` — `submitQuiz()` (status quiz_result / grading)
- **File usang:** `frontend/src/lib/poll.js` — `pollUntilReady()` sudah tidak dipakai lagi
- **Sebelum:** Polling setiap 2,5 detik dengan timeout 180 detik membebani server
- **Sesudah:** WebSocket event-driven:
  - Membuat koneksi WS sementara
  - Menunggu event `quiz_status` / `recap_status` dengan `quiz_id` / `recap_id` yang sesuai
  - Resolve promise ketika status `"ready"`, reject jika `"failed"` atau `"cancelled"`
  - Timeout otomatis jika 180 detik tidak ada respons
- **Rasional:** WebSocket jauh lebih efisien daripada polling — tidak ada request HTTP berulang, real-time, dan mengurangi beban server.

### ✅ Medium — Gemini API Key Tidak Lagi di URL
- **File:** `backend/server.py:2658`
- **Sebelum:** `url = f"...generateContent?key={GEMINI_API_KEY}"`
- **Sesudah:** Key dikirim via header HTTP: `headers={"X-Goog-Api-Key": GEMINI_API_KEY}`
- **Rasional:** Key di URL query parameter terekspos di server log, proxy log, dan browser history.

---

## 4. Arsitektur Backend & Penyimpanan

### ✅ Medium — Strategi Penyimpanan Ganda (Local + MongoDB)
- **File:** `backend/server.py`
- **Mekanisme:** 
  - **Local Storage (`uploads/` & `audio/`):** Digunakan sebagai *Hot Storage* untuk akses cepat AI (Gemini/OCR) selama proses analisis.
  - **MongoDB Storage (`pdf_files` & `audio_files`):** Digunakan sebagai *Persistent Storage*. Data binary file disimpan permanen di database.
- **Rasional:** Mengatasi karakteristik *ephemeral storage* pada platform seperti Hugging Face Spaces. Jika server restart dan file lokal hilang, sistem otomatis melakukan fallback dengan menarik data dari MongoDB.

### ✅ Medium — Antrean Analisis Dokumen (Semaphore)
- **File:** `backend/server.py:1270, 1800`
- **Mekanisme:** Menggunakan `asyncio.Semaphore(1)` dalam fungsi `run_analysis_queued`.
- **Rasional:** Membatasi proses analisis dokumen AI menjadi satu per satu (concurrency=1). Hal ini krusial untuk menjaga stabilitas server dengan resource terbatas (seperti Hugging Face Free Tier) agar tidak terjadi *Out of Memory* (OOM) saat banyak user melakukan upload bersamaan.

---

## 5. Arsitektur Backend (Legacy)

### ❌ Medium — Dual Backend Dinonaktifkan
- **File:** `api/index.js` — ditandai sebagai **LEGACY / DEPRECATED**
- **Keputusan:** Backend utama adalah **FastAPI Python** (`backend/server.py`)
- **Rasional:** Mempertahankan dua backend (Node.js + Python) dengan endpoint duplikat adalah beban maintenance yang tidak perlu.
  - Vercel API (`api/index.js`) memiliki banyak endpoint yang hanya stub (501)
  - Beberapa endpoint di Vercel API tidak konsisten dengan frontend (parameter `before`, `user_ids` vs `target_user_id`)
  - Semua perbaikan dan fitur baru hanya akan dilakukan di `backend/server.py`

---

## 5. Catatan: Tidak Diubah

| Isu | Alasan |
|-----|--------|
| WebSocket JWT token di URL | Ini adalah **pola standar** yang digunakan oleh Slack, Discord, dan layanan besar lainnya. Browser WebSocket API tidak mendukung custom headers. |
| RBAC (Role-Based Access Control) | Memerlukan perubahan desain sistem yang fundamental (model data baru, middleware baru, UI baru). Direkomendasikan sebagai **pekerjaan fase 2**. |
| Atomic transactions (MongoDB sessions) | MongoDB `start_session()` memerlukan replica set. Untuk development lokal, ini belum diperlukan. |
| Task queue (Redis/Celery) | Memerlukan infrastruktur tambahan. Untuk skala saat ini, semaphore + WebSocket sudah cukup. |

---

## 6. Daftar File yang Diubah

| File | Perubahan |
|------|-----------|
| `backend/server.py` | Hapus hardcoded Gemini key; tambah Content-Length validation; soft delete dokumen; fix Gemini key header; tambah DB indexes; hapus duplicate code |
| `frontend/src/lib/api.js` | Tambah fungsi `waitForStatus()` untuk WebSocket event-driven (dukung AbortSignal) |
| `frontend/src/pages/DocumentDetail.jsx` | Ganti polling → WebSocket untuk status quiz |
| `frontend/src/pages/FolderDetail.jsx` | Ganti polling → WebSocket untuk status quiz & recap |
| `frontend/src/pages/Quiz.jsx` | Ganti polling → WebSocket untuk status grading (quiz_result) |
| `frontend/src/lib/poll.js` | **Tidak dipakai lagi** — semua caller sudah migrasi ke `waitForStatus()` |
| `api/index.js` | Tandai sebagai LEGACY/DEPRECATED |
| `.gitignore` | Bersihkan duplikat, hapus baris rusak |
| `backend/.env.example` | **File baru** — template environment variables |

---

*Laporan dibuat: 21 Mei 2026*
*Berdasarkan analisis ADSPL dan implementasi aktual kode sumber.*
