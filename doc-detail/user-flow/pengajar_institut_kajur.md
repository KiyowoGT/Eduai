# User Flow: Pengajar Institut - Ketua Jurusan (Kajur)

Ringkasan: Kepala jurusan meninjau kualitas materi dan performa antar kelas; mengkoordinasi tindakan perbaikan.

Preconditions:
- Kajur memiliki akses department-level.
- Data kuis dan materi tersedia untuk periode analisis.

Postconditions:
- Action items (requests to teachers) tercatat dan hasil monitoring diperbarui.

Main Flow:
1. Kajur membuka Department Dashboard → GET /api/departments/{deptId}/analytics.
2. Inspect materials per mapel → trigger on-demand analysis POST /api/documents/{id}/analyze if needed.
3. Flag materials or request remedial quizzes → POST /api/department/actions.
4. Monitor follow-up results and close action items.

Alternative Flows:
- Data coverage incomplete: show coverage gap report and request teachers to upload missing data.
- Material flagged: notify uploader and allow re-submission after edits.

Mapping to code:
- Frontend: pages/department/DepartmentDashboard.jsx, components/AcademicSummary.jsx
- API: GET /api/departments/{id}/analytics, POST /api/department/actions, POST /api/documents/{id}/analyze

