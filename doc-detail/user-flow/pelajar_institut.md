# User Flow: Pelajar Institut

Ringkasan: Siswa terdaftar di institusi mengikuti assigned quizzes, mengakses institutional library, dan menerima AI-driven feedback.

Preconditions:
- Siswa telah terdaftar di kelas (Token Kelas) atau di-import via roster.
- Assigned quizzes published by teacher.

Postconditions:
- Scores and feedback saved; teacher receives grade updates.
- Deep feedback linked to result_id and available for student review.

Main Flow:
1. Onboarding: student enters Token Kelas → POST /api/classes/join → folders/assignments sync.
2. Student opens Learner Today → views assigned quizzes → opens a quiz.
3. Student completes quiz → POST /api/results; server triggers generate_deep_feedback.
4. Student views score & AI recommendations (GET /api/feedback/{resultId}).

Alternative Flows:
- Token invalid: prompt to contact admin.
- Assigned quiz expired: display appropriate message and prevent submission.

Mapping to code:
- Frontend: pages/ClassDashboard.jsx, pages/DocumentDetail.jsx, components/DocumentAiChat.jsx
- API: POST /api/classes/join, GET /api/classes/{id}/assignments, POST /api/results, GET /api/feedback/{resultId}

