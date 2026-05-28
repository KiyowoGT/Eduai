# Role: Pelajar Institut

Summary: Siswa terdaftar yang menerima assigned quizzes, mengakses institutional library, dan mendapat AI feedback.

Primary Use Cases
1. Onboarding (Token Kelas)
   - Pre: token issued by institution
   - Main Flow: enter token → POST /api/classes/join → folders and assignments synced
   - Post: assigned quizzes visible on dashboard

2. Complete Assigned Quiz
   - Pre: student assigned to quiz
   - Main Flow: GET /api/assignments → open quiz → complete → POST /api/results
   - Post: score recorded; teacher and student see feedback

3. Access Institutional Materials
   - Pre: role-based access
   - Main Flow: browse library → GET /api/documents?visibility=institution
   - Mapping: ClassDashboard.jsx, DocumentDetail.jsx

4. Request Help / AI Study Buddy
   - Main Flow: open DocumentAiChat, ask questions → server responds using document context

Notes: real-time notifications via useRealtimeSocket for assignment updates.