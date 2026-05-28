# Role: Pengajar Institut - Kepala Sekolah (Kepsek)

Summary: Kepala sekolah memegang otoritas kebijakan, activations (year), audit, dan school-wide monitoring.

Primary Use Cases
1. School-wide Academic Summary
   - Pre: data aggregated from departments/classes
   - Main Flow: GET /api/schools/{schoolId}/summary → review distribution and engagement
   - Post: strategic decisions (training, resource allocation)
   - Mapping: pages/admin/SchoolDashboard.jsx, API endpoints

2. Academic Year Activation
   - Pre: admin approval
   - Main Flow: POST /api/schools/{schoolId}/activate-academic-year → system runs promotion flows
   - Post: students promoted, schedules updated
   - Mapping: backend promotion scripts and API

3. Governance & Approval Flow
   - Pre: institution config enables approval
   - Main Flow: review submitted quizzes/materials → approve/reject (POST /api/approval/{resourceId})
   - Post: approved resources published

Notes: Requires high privilege; audit logs (GET /api/schools/{id}/audit-log) must be available.