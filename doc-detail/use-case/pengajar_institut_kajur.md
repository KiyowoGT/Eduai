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

## Mapping ke kode
- Frontend: admin/department pages, Class Dashboard
- API: endpoints untuk aggregated quiz results, analyze_pdf for material quality checks
- AI: reports generated from Gemini-based analysis and aggregated quiz stats