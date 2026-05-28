# Role: Pengajar Mandiri (Tutor)

Summary: Pengajar mandiri mengunggah materi, membuat kuis via Quiz Lab, membagikan redeem code, dan memonitor peserta.

Primary Use Cases (per fitur)
1. Studio Materi (Upload & Manage Material)
   - Pre: Pengajar terautentikasi; file PDF/slide valid
   - Main Flow: Upload → POST /api/documents/upload → analyze_pdf (background) → document ready
   - Post: Material tersedia di library; concepts & summary tersimpan
   - Alternative: Upload gagal/format salah → error message
   - Mapping: pages/QuizLab.jsx, components/PdfUploader.jsx, backend.analyze_pdf()

2. Quiz Lab (Generate & Publish)
   - Pre: pilih dokumen atau blank
   - Main Flow: Configure → POST /api/quiz/generate → waitForStatus/useRealtimeSocket → GET /api/quiz/{id} → publish or create redeem
   - Post: quiz_id created; publish/distribute settings saved
   - Alternative: Model timeout → retry or human-edit draft
   - Mapping: pages/QuizLab.jsx, API generateQuiz(), _call_groq()

3. Redeem Code & Distribution
   - Pre: quiz exists
   - Main Flow: POST /api/portal/redeem → return code → share with students
   - Post: students access via Portal Mandiri
   - Alternative: quota/full/expired code → error
   - Mapping: components/RedeemCodeCreate.jsx, POST /api/portal/redeem

4. Monitoring & Analytics
   - Pre: students have taken quiz
   - Main Flow: GET /api/quiz/{id}/results, aggregate stats
   - Post: insights available (topics weak)
   - Mapping: components/QuizAnalytics.jsx, getQuizResults()

Notes: Rate limits and quota apply for model usage. Use deep_feedback_use_case_spec.md for feedback flow.