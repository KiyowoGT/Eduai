# Use Case: Pengajar Institut - Guru Mapel
**Peran:** Pengajar mata pelajaran yang menyiapkan materi dan evaluasi untuk siswa di institusi.

## Fitur Utama
- Studio Materi: upload dan atur visibilitas materi (Institution).
- Quiz Lab (generateQuiz): buat kuis HOTS dari dokumen dengan konfigurasi jumlah soal.
- Quiz Analytics: analisis butir soal untuk mengetahui item sulit.
- AI Pedagogi: rekomendasi pengajaran berdasarkan error patterns.

## Alur Kerja & Mapping ke Kode
1. Upload materi → backend.analyze_pdf() (adaptive chunked analysis) mengekstrak konsep dan ringkasan.
2. Buat kuis di Quiz Lab → panggil generateQuiz() → pantau status via useRealtimeSocket / waitForStatus() → ambil kuis dengan getQuiz().
3. Setelah kuis dilaksanakan, buka Quiz Analytics (frontend) untuk melihat success rate per soal.

## Mapping ke kode
- Frontend pages/components:
  - pages/QuizLab.jsx
  - components/PdfViewer.jsx
  - components/Quiz.jsx / components/QuizAnalytics.jsx
- API:
  - POST /api/quiz/generate (generateQuiz)
  - GET /api/quiz/{quizId}
  - GET /api/quiz/{quizId}/results
  - POST /api/documents/{documentId}/analyze (analyze_pdf)
- AI internals:
  - _call_groq() — Llama/Groq used for quiz generation
  - _call_gemini() — Gemini used for document analysis and recap
- Hooks:
  - useRealtimeSocket for quiz_status updates
  - waitForStatus helper pattern for asynchronous workflows