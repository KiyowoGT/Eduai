# Role: Pengajar Institut - Wali Kelas (Guru Kelas)

Summary: Wali kelas memantau kesejahteraan akademik kelas, memantau kehadiran kuis, dan melakukan bimbingan.

Primary Use Cases
1. Class Roster & Attendance
   - Pre: class roster synced (token/roster)
   - Main Flow: GET /api/classes/{classId}/students → display attendance/assignment status
   - Post: wali kelas dapat mengidentifikasi siswa "missed"
   - Alternative: roster incomplete → provide manual add or sync instruction
   - Mapping: pages/ClassDashboard.jsx, getClassStudents()

2. Student Profil & Counseling
   - Pre: student has results stored
   - Main Flow: GET /api/students/{id}/profile + GET /api/results/latest → request deep feedback if needed (POST /api/feedback/deep)
   - Post: counseling notes and AI insights recorded
   - Alternative: insufficient data → schedule observation or request submissions
   - Mapping: components/StudentProfile.jsx, DocumentResult.jsx

3. Class Summary & Export
   - Pre: aggregated results available
   - Main Flow: GET /api/classes/{classId}/summary → export CSV/PDF
   - Post: report generated for meetings
   - Mapping: components/ExportReport.jsx, API /classes/{id}/summary

Notes: useRealtimeSocket used to receive live updates for document_status and quiz_status.