# Use Case: Pengajar Institut - Ketua Jurusan (Kajur)
**Peran:** Kepala jurusan yang memantau performa dan kualitas materi pada tingkat jurusan.

## Fitur Utama
- Cross-Class Monitoring: lihat performa semua kelas di jurusan.
- Quality Control Materi: review materi yang diunggah guru mapel.
- Department Analytics: identifikasi mata pelajaran bermasalah menggunakan AI Insights.

## Alur Kerja & Mapping
1. Review folder materi mapel: gunakan Institutional Library untuk melihat visibilitas dan kualitas.
2. Lihat analytics agregat: ambil data performa kuis/assigned quizzes per kelas.
3. Koordinasi: minta guru membuat kuis remedial atau update materi berdasarkan rekomendasi AI.

## Preconditions
- Kepala jurusan memiliki akses ke dashboard department-level.
- Data kuis dan hasil siswa sudah tersedia dan teragregasi di sistem.

## Postconditions
- Laporan departemen diperbarui dan tersedia untuk pimpinan dan guru terkait.
- Tindakan koordinasi (permintaan remedial atau update materi) tercatat.

## Main Flow
1. Kajur membuka Department Dashboard (GET /api/departments/{deptId}/analytics).
2. Sistem menampilkan metrik agregat dan daftar kelas yang butuh perhatian.
3. Kajur memilih kelas/mapel untuk menjadwalkan tindak lanjut atau meminta guru membuat kuis remedial.
4. Sistem menyimpan permintaan koordinasi dan memonitor hasil setelah tindakan diambil.

## Alternative Flows
- Jika data kuis tidak lengkap untuk beberapa kelas: tunjukkan coverage report dan rekomendasikan pengumpulan data tambahan.
- Jika analisis material menandai kualitas rendah: otomatis kirim notifikasi ke pengunggah untuk review.

## Mapping ke kode
- Frontend pages/components:
  - pages/department/DepartmentDashboard.jsx
  - components/AcademicSummary.jsx (aggregated metrics)
- API endpoints:
  - GET /api/departments/{deptId}/analytics
  - GET /api/quizzes/aggregate?deptId={deptId}
  - POST /api/documents/{documentId}/analyze (for material QC)
- AI:
  - Aggregation uses stored quiz results and Gemini analysis outputs to compute departmental insights.