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