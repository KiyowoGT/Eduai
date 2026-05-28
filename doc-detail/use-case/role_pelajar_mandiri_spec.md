# Role: Pelajar Mandiri

Summary: Pelajar mandiri menggunakan Portal Mandiri untuk mengakses quiz via redeem code, atau mengunggah materi pribadi untuk belajar mandiri.

Primary Use Cases
1. Redeem & Take Quiz
   - Pre: have redeem code
   - Main Flow: enter code → POST /api/portal/redeem/validate → GET /api/quiz/{id} → complete quiz → POST /api/results
   - Post: score & deep feedback available
   - Alternative: invalid/expired code
   - Mapping: pages/PortalMandiri.jsx, components/Quiz.jsx

2. Personal Document Quiz Generation
   - Pre: document ready (PDF)
   - Main Flow: upload → POST /api/documents/upload → POST /api/quiz/generate → waitForStatus → GET quiz
   - Mapping: pages/PersonalQuiz.jsx, generateQuiz()

3. Document Chat / Study Buddy
   - Pre: document analyzed
   - Main Flow: open DocumentAiChat → POST /api/documents/{id}/chat
   - Mapping: components/DocumentAiChat.jsx

Notes: store history in user profile; audio generation (generateDocumentAudio) optional.