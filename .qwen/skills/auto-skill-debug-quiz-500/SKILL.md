---
name: debug-quiz-500
description: Debug and fix 500 errors on quiz generation endpoint by verifying DB constraints and service dependencies.
source: auto-skill
extracted_at: '2026-06-30T05:34:34.076Z'
---

# Debug Quiz 500 Error Procedure

When a `500 Internal Server Error` occurs on `/api/teacher/quizzes/generate`:

1.  **Check logs** for traceback.
2.  **Verify payload structure** against `TeacherQuizGeneratePayload`.
3.  **Inspect database state** (especially `documents` and `quizzes` collections).
4.  **Validate `_bg_generate_quiz` service call** (ensuring dependencies are satisfied and no database collisions occur).
5.  **Check for missing fields** in `quiz_doc` before insertion.
