# User Flow: Pengajar Institut - Kepala Sekolah

Ringkasan: Kepala sekolah mengelola kebijakan sekolah, audit, dan overview akademik makro.

Preconditions:
- Kepsek memiliki hak admin pada tenant sekolah.
- Data akademik dan audit log tersinkronisasi.

Postconditions:
- Kebijakan terproses (contoh: aktivasi tahun ajaran) dan hasil tercatat di audit log.

Main Flow:
1. Kepsek buka School Dashboard → GET /api/schools/{schoolId}/summary.
2. Filter dan analisa metrics, export reports jika diperlukan.
3. Untuk activation: POST /api/schools/{schoolId}/activate-academic-year → system runs promotion and updates access.
4. Manage staff: POST/PUT /api/admin/users untuk menambah/ubah guru; actions logged.

Alternative Flows:
- If audit data missing: schedule a data sync and notify data admin.
- If activation fails due to constraint: rollback and alert admin.

Mapping to code:
- Frontend: pages/admin/SchoolDashboard.jsx, components/AcademicSummary.jsx
- API: GET /api/schools/{id}/summary, POST /api/schools/{id}/activate-academic-year, GET /api/schools/{id}/audit-log

