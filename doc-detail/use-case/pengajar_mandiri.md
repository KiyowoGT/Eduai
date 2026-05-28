# Use Case: Pengajar Mandiri
**Peran:** Tutor privat atau pengajar independen yang menyediakan kursus/les di luar institusi.

## Fitur Utama (sesuai implementasi)
- Studio Materi: unggah PDF/slide, atur folder kursus, dan gunakan "Quiz Lab" untuk membuat kuis otomatis.
- Redeem / Share Code: buat kode kuis untuk peserta tanpa akun institutional (portal mandiri).
- Monitoring & Analytics: lihat peserta yang mengerjakan via kode, skor, dan feedback AI.
- AI Assistant: generate_quiz() mendukung pembuatan soal HOTS dari dokumen, termasuk opsi jumlah soal.

## Alur Kerja
1. Unggah materi di Studio Materi (PDF). Sistem menjalankan Adaptive Chunked PDF Analysis untuk ekstraksi konsep.
2. Buka Quiz Lab → Generate Quiz (memanggil generateQuiz) → sistem menyiapkan kuis asinkronus, pantau via WebSocket / waitForStatus.
3. Buat Redeem Code dan bagikan ke siswa; siswa mengerjakan via Portal Mandiri.
4. Pantau hasil dan gunakan AI feedback untuk menentukan materi remidi.

## Preconditions
- Pengajar memiliki akun dan akses ke Studio Materi.
- Dokumen yang diunggah memenuhi ukuran/format yang didukung (PDF).
- API keys untuk model AI dikonfigurasi pada backend.

## Postconditions
- Materi dianalisis dan metadata (konsep, ringkasan) tersimpan.
- Kuis yang dihasilkan tersedia via kode redeem dan tercatat di sistem.
- Statistik pengerjaan peserta tersedia untuk monitoring.

## Main Flow
1. Tutor membuka Quiz Lab dan mengunggah dokumen atau memilih dari library.
2. Tutor mengkonfigurasi jumlah soal dan memulai generateQuiz (POST /api/quiz/generate).
3. Backend mengeksekusi pembuatan kuis asinkron, client menggunakan waitForStatus / useRealtimeSocket untuk notifikasi.
4. Setelah selesai, GET /api/quiz/{quizId} menampilkan kuis siap pakai; tutor membuat redeem code (POST /api/portal/redeem).
5. Tutor membagikan kode dan memonitor hasil melalui API / dashboard.

## Alternative Flows
- Jika PDF terlalu besar atau gagal di-parse: sistem memberikan opsi chunking ulang atau menampilkan pesan error.
- Jika proses generateQuiz dibatalkan: tutor dapat melihat status pembatalan dan mencoba lagi.

## Mapping ke kode
- Frontend pages/components:
  - pages/PortalMandiri.jsx (hosting kuis via redeem code)
  - pages/QuizLab.jsx (UI untuk konfig kuis dan generate)
  - components/PdfViewer.jsx (preview dokumen sebelum generate)
  - components/RedeemCodeCreate.jsx
- API / hooks:
  - POST /api/quiz/generate (generateQuiz(documentId, questionCount))
  - GET /api/quiz/{quizId} (getQuiz)
  - POST /api/quiz/{quizId}/cancel (cancelQuiz)
  - POST /api/portal/redeem (createRedeemCode)
  - waitForStatus(type, id) — helper untuk menunggu status objek via WebSocket
- Backend:
  - backend/server.py: analyze_pdf(), _analyze_batch(), generate_quiz() endpoints
  - AI wrappers: _call_gemini() for document analysis; _call_groq() for quiz generation
- Events:
  - WebSocket events: quiz_status, document_status — client listens via useRealtimeSocket(callback)