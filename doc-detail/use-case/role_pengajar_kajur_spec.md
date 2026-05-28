# Role: Pengajar Institut - Ketua Jurusan (Kajur)

Summary: Ketua jurusan memantau kualitas materi dan performa antar-kelas dalam jurusan.

Primary Use Cases
1. Department Analytics
   - Pre: quiz results aggregated across classes
   - Main Flow: GET /api/departments/{deptId}/analytics → visualize trends
   - Post: identify weak subjects or classes
   - Alternative: missing data → request additional collection
   - Mapping: pages/department/DepartmentDashboard.jsx, API endpoints

2. Material Quality Control
   - Pre: teachers uploaded materials
   - Main Flow: review materials → POST /api/documents/{id}/analyze (on-demand) → flag issues
   - Post: materials accepted/rejected and feedback sent to uploader
   - Mapping: components/AcademicSummary.jsx, backend analyze_pdf()

3. Cross-Class Coordination
   - Pre: analytics show problem areas
   - Main Flow: create coordination request (POST /api/department/actions) → monitor outcomes
   - Post: remedial activities scheduled

Notes: aggregation merges Gemini outputs with quiz stats.