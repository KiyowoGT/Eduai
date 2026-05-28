# Role: Pengajar Institut - Guru Mapel

Summary: Guru mapel mengelola materi kurikulum, membuat kuis untuk kelas, dan meninjau analitik butir soal.

Primary Use Cases
1. Publish Material to Institutional Library
   - Pre: document vetted by studio; user role has institutional upload rights
   - Main Flow: Upload → set visibility=Institution → POST /api/documents/{id}/visibility
   - Post: document accessible to students in institution
   - Alternative: policy/approval required → submission pending review
   - Mapping: pages/StudioMateri, backend analyze_pdf()

2. Quiz Generation for Assigned Work
   - Pre: material available and analyzed
   - Main Flow: POST /api/quiz/generate with institutional target → waitForStatus/useRealtimeSocket → GET /api/quiz/{id} → assign to class
   - Post: Assigned quiz visible on students' dashboards
   - Alternative: Approval flow required → publish after review
   - Mapping: pages/QuizLab.jsx, generateQuiz(), useRealtimeSocket

3. Item Analysis & Remediation
   - Pre: quiz completed by students
   - Main Flow: GET /api/quiz/{id}/results → compute item stats → identify low-success items
   - Post: teacher receives recommended remedial materials; may create remedial quiz
   - Mapping: components/QuizAnalytics.jsx, backend analytics endpoints

Notes: Maps to _call_gemini for content analysis and _call_groq for quiz generation.