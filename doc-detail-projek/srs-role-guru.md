# Software Requirements Specification (SRS) Addendum

## Sistem Ekosistem Akademik Terintegrasi EduAI

**Pembaruan Struktur Multi-Level Role Pengajar & Mekanisme Kode Kelas Otomatis (SD hingga Universitas)**

* **Penyusun:** Syahid Ahmad Yasin
* **Program Studi:** Informatika
* **Institusi:** Universitas Bina Sarana Informatika (UBSI)
* **Versi Dokumen:** 1.1 (Pembaruan Fitur Manajemen Rumah & Alur Jabatan Sekolah)
* **Tanggal:** 21 Mei 2026

---

## 1. Pendahuluan (Introduction)

### 1.1 Tujuan Pembaruan Dokumen

Dokumen ini merupakan addendum (pembaruan resmi) dari dokumen SRS versi 1.0. Tujuan pembaruan ini adalah untuk merestrukturisasi hierarki fungsional pada **Portal Kantor Digital Pengajar** agar sesuai dengan ekosistem sekolah nyata dari jenjang SD hingga Universitas, sekaligus mengunci visi utama EduAI sebagai **perangkat bantu pengajaran dan pemantauan belajar mandiri siswa di rumah**.

Pembaruan ini berfokus pada:

1. **Pemberantasan Bottleneck Birokrasi:** Mengganti sistem persetujuan manual antar-pengajar dengan mekanisme **Passcode Jabatan Instan**.
2. **Pemberantasan Privilege Escalation Pelajar:** Memisahkan kode institusi induk (`institution_code`) milik pengajar dengan **Kode Kelas Otomatis (*Class Token*)** khusus untuk pendaftaran pelajar.
3. **Penyaringan Jabatan Efisien (Fokus Akademis Rumah):** Menghapus fungsi non-akademis rumah seperti Bimbingan Konseling (BK), Kepala Perpustakaan, dan Kepala Laboratorium untuk merampingkan proses soding backend FastAPI + MongoDB.

---

## 2. Deskripsi Keseluruhan (Overall Description)

### 2.1 Perspektif Produk (Arsitektur Manajemen Rumah Terpusat)

EduAI diposisikan sebagai platform belajar-mengajar rumah pintar yang menjembatani kurikulum institusi formal dengan aktivitas mandiri harian siswa. Sistem mengeliminasi seluruh birokrasi fisik sekolah dan mengubahnya menjadi visualisasi grafik analitik performa kognitif siswa.

### 2.2 Karakteristik Pengguna Berjenjang (User Classes Hierarchies)

```text
                                [INISIATOR UTAMA / KEPALA SEKOLAH]
                                (Membuat & Memantau Sub-Role Global)
                                                 |
         +---------------------------------------+---------------------------------------+
         |                                       |                                       |
         v                                       v                                       v
[WAKASEK KURIKULUM]                    [GURU KELAS / WALI KELAS]               [GURU MATA PELAJARAN]
- Menyusun Master Jadwal               - Mengontrol Profil Siswa Per Kelas     - Upload PDF Materi Sekolah
- Memetakan Plotting Guru              - Pantau Rapor Grafik Nilai Total       - Edit & Publish Rangkuman/Kuis AI
- Manajemen Kalender Akademik          - Manajemen Token Registrasi Kelas      - Monitor Diskusi & Trigger @bot

```

#### A. Role PENGAJAR (Sub-Role Bertingkat):

1. **Inisiator Utama / Kepala Sekolah:** Pendaftar pertama dari institusi terkait. Bertindak sebagai pemilik utama kode induk institusi (`institution_owner: true`) yang berhak memantau grafik makro seluruh sekolah.
2. **Wakasek Kurikulum / Kaprodi:** Pengajar yang bertanggung jawab menyusun master jadwal mingguan belajar rumah, mengunci daftar mata pelajaran resmi, serta memetakan beban mengajar guru.
3. **Guru Kelas / Wali Kelas (Mentor Rumah):** Pengajar yang memegang otoritas kontrol berbasis **Unit Kelas** (misal: Kelas 4-A atau Kelas 10-A). Bertanggung jawab mendistribusikan kode pendaftaran siswa, memantau riwayat kepatuhan belajar rumah, serta melihat ringkasan rapor grafik nilai total siswa di kelasnya.
4. **Guru Mata Pelajaran (Spesialis Konten):** Pengajar yang memegang otoritas berbasis **Topik Bidang Studi**. Bertanggung jawab melakukan kurasi dokumen lewat AI Studio (Upload PDF materi, validasi rangkuman cerdas Gemini, perilisan kuis HOTS) serta memantau statistik kesalahan butir soal kuis.

#### B. Role PELAJAR (Terisolasi):

* Pengguna didik yang dikunci hak aksesnya hanya pada ruang lingkup kelas yang tertera pada *Class Token* saat pendaftaran. Tidak memiliki hak akses struktural atau administratif ke kantor digital pengajar.

---

## 3. Kebutuhan Fungsional & Alur Kerja (Functional Requirements)

### 3.1 Skenario Fitur Onboarding Dinamis

> **User Story 1: Registrasi Pengajar via Passcode Jabatan Instan**
> * **Sebagai seorang** Rekan Pengajar Baru (Guru Kelas/Guru Mapel),
> * **Saya ingin** memasukkan kode registrasi khusus jabatan saya (Contoh: `SMAN3-BNDG-GURU`) saat pertama kali mendaftar di halaman Onboarding,
> * **Sehingga** akun saya langsung aktif seketika dengan hak akses yang sesuai tanpa perlu menunggu persetujuan manual dari Kepala Sekolah.
> 
> 

> **User Story 2: Registrasi Pelajar Aman via Class Token**
> * **Sebagai seorang** Pelajar,
> * **Saya ingin** memasukkan Kode Kelas (Contoh: `SDN01-KLS4A`) yang diberikan oleh Wali Kelas saya di halaman Onboarding,
> * **Sehingga** seluruh jadwal pelajaran rumah dan folder materi terverifikasi milik kelas 4A saya langsung terisi otomatis tanpa kebocoran hak akses ke portal pengajar.
> 
> 

### 3.2 Alur Distribusi Nilai Kuis (Data View Mapping)

Sistem menerapkan prinsip *Single Data Source, Multiple Analytical Views*. Ketika pelajar mengumpulkan jawaban kuis dari rumah, payload nilai disimpan di satu tempat, namun dilempar ke dua dashboard pengajar dengan visualisasi berbeda:

```text
                     [ PELAJAR SUBMIT KUIS DI RUMAH ]
                                     |
                                     v
                       [ Koleksi `quiz_results` ]
                                     |
         +---------------------------+---------------------------+
         |                                                       |
         v (Query by assigned_subject)                           v (Query by assigned_class)
[ VIEW GURU MATA PELAJARAN ]                            [ VIEW GURU KELAS / WALI KELAS ]
- Fokus pada Kualitas Konten                            - Fokus pada Perkembangan Siswa
- Analitik tingkat kesalahan per nomor soal             - Laporan Rapor Ringkasan Nilai Gabungan
- Evaluasi pemahaman materi AI                          - Deteksi dini siswa malas kuis

```

---

## 4. Kebutuhan Data (Data Requirements)

### 4.1 Pembaruan Skema Dokumen `users` (MongoDB)

Perluasan field dilakukan pada koleksi `users` untuk memetakan batasan query (*scoping mechanism*) di backend FastAPI:

```json
{
  "_id": "ObjectId",
  "name": "String",
  "email": "String",
  "role": "String",                 // "pengajar" atau "pelajar"
  "title": "String",                // "kepala_sekolah", "kurikulum", "guru_kelas", "guru_pengajar"
  "institution_code": "String",     // Referensi Kode Induk (Contoh: "SMAN3-BNDG")
  "assigned_class": "String",       // Terisi "Kelas 4A" jika title == "guru_kelas" (SD-SMA)
  "assigned_subject": "String",     // Terisi "Matematika" jika title == "guru_pengajar"
  "education_level": "String",      // "SD", "SMP", "SMA", "Universitas"
  "current_semester": "Integer"     // Angka Kelas (1-12) atau Semester Kuliah (1-8)
}

```

### 4.2 Koleksi Baru `class_tokens` (Mekanisme Keamanan Autopilot Pelajar)

Koleksi ini digunakan untuk mengamankan proses join pelajar agar langsung terkunci pada level kelas tertentu:

```json
{
  "_id": "ObjectId",
  "class_token": "String (Unique Index)", // Contoh: "SDN01-KLS4A"
  "institution_code": "String",
  "level": "String",                     // "SD"
  "target_class_room": "String",          // "Kelas 4A"
  "target_semester_or_grade": 4,
  "created_by_user_id": "ObjectId",
  "created_at": "DateTime"
}

```

---

## 5. Kebutuhan Non-Fungsional (Non-Functional Requirements)

### 5.1 Keamanan Tingkat Akses (Privilege & Data Isolation)

* **Isolasi Query Dashboard Guru Kelas:** Endpoint `/api/teacher/students` wajib disaring ketat secara backend menggunakan parameter `assigned_class` milik user pengajar aktif. Pengajar kelas tidak diizinkan menarik data array `quiz_results` milik siswa dari kelas lain.
* **Isolasi Query Dashboard Guru Mapel:** Endpoint `/api/teacher/analytics/quiz` wajib memvalidasi apakah properti `subject_name` pada kuis tersebut cocok dengan string `assigned_subject` milik guru pengajar yang sedang melakukan *request*.

### 5.2 Skalabilitas Prompting AI (Agnostik Pendidikan Tanpa BK)

* Seluruh pipeline instruksi sistem (*System Prompt*) pada Core Gemini Agent wajib diisolasi hanya untuk kebutuhan **pedagogi akademis mata pelajaran rumah**. Mesin LLM dilarang keras menerima atau memproses instruksi bertema bimbingan psikologis, BK, konseling personal, ataupun pencatatan inventaris sarana fisik sekolah (Lab/Perpus).