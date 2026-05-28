# Use Case: Pelajar Institut
**Peran:** Siswa resmi di institusi (sekolah/kampus) yang terhubung melalui Token Kelas atau integrasi institutional.

## Fitur Utama
- Autopilot Sync / Onboarding: sinkronisasi materi & jadwal saat memasukkan Token Kelas.
- Assigned Quizzes: mengerjakan kuis yang ditugaskan guru.
- Institutional Library: akses materi terverifikasi.
- Class Dashboard & AI Insights: rekomendasi belajar harian dan topik prioritas.

## Alur Kerja
1. Onboarding: masukkan Token Kelas → platform membuat folder mapel dan assignment otomatis.
2. Daily flow: buka Learner Today → baca materi → kerjakan assigned quiz → terima Deep Feedback & referensi.
3. Remedial: guru/section head melihat analytics dan memicu materi tambahan atau kuis remedial.

## Mapping ke kode
- Frontend pages/components:
  - pages/ClassDashboard.jsx
  - pages/DocumentDetail.jsx (PdfViewer, DocumentAiChat)
  - pages/PortalMandiri.jsx
- API endpoints:
  - GET /api/classes/{classId}/assignments
  - GET /api/results/latest?documentId={documentId}
  - POST /api/documents/{documentId}/analyze
- Hooks:
  - useRealtimeSocket to receive assigned quiz and result updates
- Notes: Assigned quizzes are surfaced in the student dashboard and teacher-assigned flows.