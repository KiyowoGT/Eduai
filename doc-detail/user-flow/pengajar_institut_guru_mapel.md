# User Flow: Pengajar Institut - Guru Mapel

Ringkasan: Guru mapel mem-publish materi institutional, membuat kuis untuk kelas, dan menggunakan analitik butir soal untuk memperbaiki pengajaran.

Preconditions:
- Guru memiliki hak upload institutional.
- Dokumen compliant (format/size) dan telah dianalisis bila diperlukan.

Postconditions:
- Kuis tersedia untuk assigned students; analytics tersedia setelah pengerjaan.
- Jika approval flow aktif, kuis berstatus pending sampai disetujui.

Main Flow:
1. Guru upload materi → POST /api/documents/upload (set visibility=Institution).
2. Guru buka Quiz Lab → pilih dokumen → POST /api/quiz/generate (target class).
3. System processes quiz generation async; notify via useRealtimeSocket.
4. Guru review & publish; assigned quizzes appear on students' dashboards.
5. Setelah pengerjaan, GET /api/quiz/{id}/results → compute item stats and call AI Insights if requested.

Alternative Flows:
- Approval required: kuis masuk ke reviewer queue; publish only after approval.
- Insufficient concepts from analysis: suggest manual enhancement or reupload.

Mapping to code:
- Frontend: pages/QuizLab.jsx, pages/StudioMateri.jsx, components/QuizAnalytics.jsx
- API: POST /api/documents/upload, POST /api/quiz/generate, GET /api/quiz/{id}/results
- Backend: analyze_pdf(), generate_quiz(), _call_groq(), _call_gemini()

