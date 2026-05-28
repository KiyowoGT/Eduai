# Use Case: Pengajar Institut - Guru Kelas (Wali Kelas)
**Peran:** Pengajar yang mengelola satu kelas (wali kelas) dan bertanggung jawab memantau perkembangan akademik siswa.

## Fitur Utama (sesuai kode)
- Ruang Kelas: melihat daftar siswa, status kehadiran kuis, dan ringkasan performa.
- Assigned Quizzes: memantau kuis yang ditugaskan guru-guru lain kepada siswa kelasnya.
- AI Student Insights: laporan AI (gaya belajar, topik lemah, rekomendasi remidi) yang dihasilkan dari hasil kuis dan analisis dokumen.
- Export / Report: mengekspor ringkasan kelas dan statistik.

## Alur Kerja (mapping ke implementasi)
1. Masuk ke halaman kelas → token/pendaftaran kelas (Portal Mandiri / Institutional onboarding).
2. Lihat daftar siswa dan hasil terkini: backend menyediakan endpoint getLatestDocResult / assigned quizzes.
3. Bimbingan: buka profil siswa, gunakan AI Insights (generate_deep_feedback / analysis endpoints) untuk membuat bahan konseling.
4. Monitoring: gunakan dashboard untuk memfilter siswa yang "missed" atau memiliki skor rendah.

## Mapping ke kode
- Frontend: pages/ (Class/Teacher dashboard), components yang relevan seperti DocumentResult, StudentProfile.
- Hooks/API: getLatestDocResult(), getDocument(), endpoints kuis (generateQuiz/getQuiz), useRealtimeSocket untuk notifikasi status.

> Catatan: istilah yang dipakai di UI: "Assigned Quizzes", "Learner Today", dan "AI Insights" — sesuaikan terminologi materi komunikasi dengan UI.