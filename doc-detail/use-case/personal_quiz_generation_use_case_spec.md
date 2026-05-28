# Use Case: Personal Quiz Generation (Unggah Dokumen)

Actor: Pelajar Mandiri / Pengajar Mandiri

Description: Pengguna mengunggah dokumen (PDF) untuk otomatisasi pembuatan kuis HOTS menggunakan pipeline analyze_pdf + generateQuiz.

Preconditions:
- Pengguna terautentikasi (opsional untuk Portal Mandiri depending on flow).
- File memenuhi batas ukuran & format (PDF, max configured size).
- Backend memiliki API keys untuk model AI (Gemini/Groq) tersedia.

Postconditions:
- Jika sukses: quiz_id dibuat dan tersedia; metadata dokumen (summary, concepts) tersimpan.
- Jika gagal: upload gagal atau analisis gagal, tidak ada quiz dibuat.

Main Flow:
1. User membuka Personal Quiz page dan memilih "Unggah PDF".
2. Client menampilkan file picker; user memilih file dan submit.
3. Client meng-upload file ke POST /api/documents/upload (multipart). Server menyimpan file dan mengembalikan documentId.
4. Client memanggil POST /api/quiz/generate {documentId, questionCount} atau server memulai background task: _bg_analyze_document() lalu generateQuiz.
5. Server menjalankan analyze_pdf() (adaptive chunking jika diperlukan) dan menyimpan hasil analisis.
6. Server memanggil LLM untuk generateQuiz (GROQ/Llama) dan menyimpan quiz; mengirim event quiz_status quando ready.
7. Client menerima event (useRealtimeSocket) atau polling waitForStatus, lalu GET /api/quiz/{quizId} untuk menampilkan kuis.

Alternative Flows:
- 3a. File bukan PDF atau rusak: server mengembalikan 415/400; client menampilkan pesan validasi.
- 4a. File besar → server otomatis chunking; jika chunking gagal, tawarkan retry atau pengurangan ukuran.
- 6a. LLM timeout/error → sistem menjadwalkan retry atau fallback ke model berbeda; jika gagal, kirim notifikasi kegagalan.

Mapping ke kode:
- Frontend: pages/PersonalQuiz.jsx, components/PdfUploader.jsx, components/PdfViewer.jsx
- API: POST /api/documents/upload, POST /api/quiz/generate, GET /api/quiz/{quizId}
- Backend: backend/server.py -> analyze_pdf(), _analyze_batch(), generate_quiz(), _call_gemini(), _call_groq()

Security/Rate limits:
- Batasi upload rate per user, batasi jumlah generate per waktu (quota).