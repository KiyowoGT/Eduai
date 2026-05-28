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

## Mapping ke kode
- Frontend: pages/PortalMandiri.jsx, components/DocumentAiChat.jsx, components/PdfViewer.jsx
- API: generateQuiz(), getQuiz(), generateDocumentAudio(), getLatestDocResult()
- Hook: useRealtimeSocket untuk menerima notifikasi status kuis/dokumen.