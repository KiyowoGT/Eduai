# 📚 Panduan Pengguna & Pengujian - EduAI (EduScanner AI)

Selamat datang di **EduAI**! Panduan ini dirancang untuk memudahkan Anda (dan rekan penguji) dalam memahami, menjelajahi, dan menguji semua fitur canggih yang tersedia di platform pembelajaran cerdas berbasis AI ini.

---

## 🔍 1. Apa itu EduAI?

**EduAI** adalah platform pembelajaran cerdas berbasis kecerdasan buatan (AI) yang dirancang untuk membantu pelajar, mahasiswa, dan pengajar memahami dokumen akademis dengan lebih cepat dan mendalam. 

Platform ini menggabungkan kemampuan pemrosesan dokumen PDF dengan AI untuk secara otomatis mengekstrak konsep penting, membuat visualisasi/diagram alir, menyusun tujuan pembelajaran, dan menghasilkan kuis berbasis **HOTS (Higher Order Thinking Skills)** guna menguji pemahaman pengguna secara interaktif.

---

## 🌐 2. Cara Mengakses Platform

Aplikasi saat ini telah aktif di server lokal dan diekspos secara publik melalui ngrok. Anda dan teman Anda dapat langsung mengaksesnya melalui link berikut:

🔗 **Link Akses**: [https://uncrushed-unroll-cold.ngrok-free.dev](https://uncrushed-unroll-cold.ngrok-free.dev)

> [!NOTE]
> Pastikan koneksi internet stabil saat mengakses platform karena proses pengolahan berkas oleh AI memerlukan pertukaran data secara real-time.

---

## 🛠️ 3. Langkah Penggunaan & Pengujian Fitur

Berikut adalah alur penggunaan lengkap yang dapat Anda gunakan sebagai panduan pengujian langkah demi langkah:

### Langkah Awal: Registrasi & Masuk (Authentication)
1. **Daftar Akun Baru**:
   * Buka halaman login di link akses di atas.
   * Pilih opsi **Daftar** (Sign Up).
   * Masukkan email dan password baru (atau gunakan metode Google OAuth jika diaktifkan).
   * Verifikasi akun Anda sesuai petunjuk layar.
2. **Masuk (Login)**:
   * Masuk menggunakan akun yang telah dibuat pada langkah sebelumnya.

### Langkah Kedua: Pengisian Data Profil (Onboarding)
* Saat pertama kali masuk, Anda akan diarahkan ke halaman **Onboarding**.
* Isi detail profil berupa:
  * Tingkat pendidikan (SMP/SMA/Kuliah, dll.).
  * Bidang studi atau jurusan (misalnya: Teknologi Informasi, Biologi, Ekonomi).
  * Minat subjek atau mata pelajaran.
* Klik **Selesai** untuk melanjutkan ke Dashboard utama.

### Langkah Ketiga: Mengunggah & Menganalisis Dokumen PDF
1. Masuk ke menu **Dokumen** (atau klik tombol **Upload PDF** di Dashboard).
2. Pilih file dokumen PDF pembelajaran dari komputer/HP Anda (disarankan dokumen teks akademis seperti jurnal, bab buku, atau materi kuliah/sekolah).
3. Klik tombol **Unggah & Analisis**.
4. **Proses AI di Background**:
   * AI (Gemini) akan bekerja di latar belakang untuk membaca dan memecah isi dokumen secara cerdas (*Adaptive Chunked Analysis*).
   * Status dokumen akan berubah menjadi **Processing** (Sedang Diproses).
   * Tunggu beberapa saat (durasi bergantung pada ketebalan halaman PDF) hingga status berubah menjadi **Ready** (Siap).

### Langkah Keempat: Menjelajahi Hasil Analisis AI
Klik dokumen yang telah dianalisis untuk melihat rangkuman detail yang dihasilkan oleh AI:
* **Ringkasan (Summary)**: Rangkuman komprehensif isi dokumen dalam bahasa yang mudah dipahami.
* **Konsep Kunci (Key Concepts)**: Daftar istilah penting lengkap dengan penjelasan detail dan contoh kodenya (jika relevan).
* **Tujuan Pembelajaran (Learning Objectives)**: Target pemahaman yang harus dicapai setelah membaca dokumen tersebut.
* **Visualisasi / Diagram**: Diagram alir (flowchart) atau bagan yang menjelaskan proses atau keterkaitan konsep dalam dokumen.

### Langkah Kelima: Membuat & Mengerjakan Kuis HOTS
1. Di dalam halaman detail dokumen, cari dan klik tombol **Mulai Kuis**.
2. Tentukan jumlah soal kuis yang ingin dihasilkan oleh AI (biasanya default 5 soal).
3. Tunggu beberapa detik selagi AI (Llama 3.3 via Groq) merancang pertanyaan kuis berbasis pemikiran kritis (HOTS).
4. Kerjakan kuis tersebut secara interaktif satu per satu soal hingga selesai.
5. Klik **Kirim Jawaban** (Submit) untuk mengakhiri kuis.

### Langkah Keenam: Melihat Penilaian & Umpan Balik AI
Setelah kuis dikirimkan, AI akan memproses penilaian secara otomatis dan menampilkan:
* **Skor Akhir**: Nilai kelulusan kuis Anda.
* **Umpan Balik Mendalam (Deep Feedback)**: Penjelasan menyeluruh mengenai performa kuis Anda.
* **Review Per Soal**:
  * Jawaban yang Anda pilih vs jawaban yang benar.
  * Penjelasan rinci mengapa jawaban tersebut benar atau salah.
  * **Referensi Akademik**: Buku, jurnal, atau sumber ilmiah yang mendukung penjelasan soal tersebut.

### Langkah Ketujuh: Fitur Sosial & Kolaborasi
* **Tambah Teman (Friend System)**: Anda bisa mencari pengguna lain berdasarkan nama/email dan mengirimkan permintaan pertemanan.
* **Diskusi Dokumen (Document Chat & Discussion)**:
  * Anda bisa membuka ruang obrolan cerdas bersama AI mengenai dokumen tertentu.
  * Anda juga dapat mengundang teman untuk bergabung ke dalam ruang obrolan dokumen untuk berdiskusi bersama.

---

## 📝 4. Lembar Pengujian untuk Teman Anda (Checklist)

Beri tahu teman Anda untuk menguji fungsi-fungsi krusial berikut dan melaporkan jika ada kegagalan atau bug:

- [ ] **Registrasi & Login**: Apakah proses pendaftaran dan masuk akun berjalan dengan mulus?
- [ ] **Onboarding**: Apakah profil pendidikan berhasil disimpan tanpa error?
- [ ] **Upload Dokumen**: 
  - Cobalah unggah file PDF kecil (1-4 halaman). Apakah proses analisisnya cepat?
  - Cobalah unggah file PDF besar (>15 halaman) untuk menguji fitur *Adaptive Chunking*. Apakah berhasil disintesis dengan baik?
- [ ] **Generasi Kuis**: Apakah soal kuis yang dihasilkan menantang (HOTS) dan relevan dengan isi PDF?
- [ ] **Sistem Skor & Feedback**: Apakah koreksi jawaban salah/benar yang diberikan AI logis dan informatif?
- [ ] **Diskusi Dokumen**: Apakah pesan chat di dokumen dapat terkirim dan direspon dengan cepat?
- [ ] **Responsivitas Tampilan (UI/UX)**:
  - Coba buka dari laptop (Desktop). Apakah menu sidebar bisa dilipat (*collapse*) dengan lancar?
  - Coba buka dari HP (Mobile). Apakah hamburger menu dan navigasi bawah (*bottom bar*) terasa nyaman digunakan?

---
*Selamat mencoba dan semoga pengujian berjalan dengan lancar!*
