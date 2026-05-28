# Use Case: Pelajar Mandiri
**Peran:** Pelajar independen yang ingin belajar mandiri, praktik soal, atau mengikuti kuis dari tutor privat.

## Fitur Utama (dengan nama fungsi di kode)
- Redeem Kode Kuis (Portal Mandiri) — ikut kuis tanpa akun institutional.
- Personal Quiz Generation — unggah dokumen dan gunakan generateQuiz() untuk membuat soal latihan.
- AI Study Buddy / Document Chat — DocumentAiChat component untuk bertanya tentang isi dokumen.
- Deep Feedback — feedback yang dihasilkan AI setelah kuis (generate_deep_feedback / getLatestDocResult).

## Alur Kerja
1. Buka Portal Mandiri → masukkan kode redeem → kerjakan kuis → terima skor & deep feedback.
2. Atau: unggah PDF pribadi → sistem menjalankan analyze_pdf (adaptive chunking) → generate quiz → diskusi lanjutan via DocumentAiChat.

## Preconditions
- Pelajar memiliki akun atau akses ke Portal Mandiri (untuk kuis via redeem).
- Dokumen yang diunggah memenuhi persyaratan format.

## Postconditions
- Pelajar menerima skor dan deep feedback yang tersimpan di riwayat mereka.
- Dokumen yang dianalisis tersimpan dengan ringkasan & konsep untuk diskusi lebih lanjut.

## Main Flow
1. Pelajar membuka Portal Mandiri dan memasukkan redeem code (POST /api/portal/redeem/validate).
2. Sistem memberikan akses ke kuis; pelajar menyelesaikan kuis → hasil disimpan (POST /api/results).
3. Sistem memicu generate_deep_feedback (jika tersedia) dan menyajikan ringkasan & rekomendasi.
4. Pelajar bisa membuka DocumentAiChat untuk menanyakan bagian yang belum dimengerti.

## Alternative Flows
- Jika redeem code tidak valid atau kadaluarsa: tampilkan pesan error dan kontak tutor.
- Jika generate_deep_feedback belum tersedia: tampilkan hasil sementara dan jadwalkan analisis background.

## Mapping ke kode
- Frontend pages/components:
  - pages/PortalMandiri.jsx (entry redeem code)
  - components/DocumentAiChat.jsx (chat with document context)
  - components/PdfViewer.jsx (document preview)
- API/helpers:
  - generateQuiz(documentId, questionCount)
  - getQuiz(quizId)
  - generateDocumentAudio(documentId)
  - getLatestDocResult(documentId)
  - waitForStatus(type, id)
- Hook:
  - useRealtimeSocket(callback) — receives events: quiz_status, document_status, discussion_message

> Note: For offline/local testing, generateQuiz may be mocked; check backend/test_chunked_analysis.py for PDF analysis tests.