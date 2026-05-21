# Software Requirements Specification (SRS)
## Sistem Ekosistem Akademik Terintegrasi EduAI
**Mekanisme "Shared Workspace" Pelajar & Kantor Digital Pengajar (SD hingga Universitas)**

* **Penyusun:** Syahid Ahmad Yasin
* **Program Studi:** Informatika
* **Institusi:** Universitas Bina Sarana Informatika (UBSI)
* **Versi Dokumen:** 1.0 (Final Release)
* **Tanggal:** 21 Mei 2026

---

## 1. Pendahuluan (Introduction)

### 1.1 Tujuan Proyek
Tujuan dari proyek pembangunan EduAI ini adalah untuk mentransformasikan aplikasi asisten akademik asinkronus tunggal menjadi sebuah **Platform Ekosistem Akademik Terintegrasi (B2B2C)** yang skalabel dari jenjang Sekolah Dasar (SD) hingga Perguruan Tinggi (Universitas). Sistem ini dirancang untuk mendigitalisasi lingkungan kerja pendidik menjadi sebuah **"Kantor Digital Pengajar"** sekaligus mengotomatisasi penyediaan sumber daya belajar terverifikasi AI langsung ke dalam **"Halaman Belajar Pelajar"** melalui pemanfaatan satu kode sinkronisasi institusi (*School/Univ Joint Code*).

Proyek ini berkomitmen penuh menjaga prinsip **Human-in-the-Loop (HITL)**, di mana peran strategis, otoritas kurasi, serta kendali akademis penuh tetap berada di tangan Pengajar manusia, sedangkan kecerdasan buatan (Generative AI) difungsikan sebagai generator infrastruktur data kognitif yang mempercepat administrasi pengajaran.

### 1.2 Cakupan Produk (Product Scope)

#### A. Apa yang BISA Dilakukan Aplikasi (In-Scope):
* **Autentikasi Berbasis Role Dinamis:** Memfasilitasi pendaftaran pengguna dengan opsi tegas sebagai "Pelajar" atau "Pengajar".
* **Sistem Sinkronisasi Kode Khusus:** Men-generate kode institusi unik bagi pengajar pertama, memvalidasi pengajar sekunder ke dalam institusi yang sama, dan mengotomatisasi pengisian jadwal serta materi pada akun pelajar berdasarkan kode tersebut.
* **Infrastruktur Kantor Digital Pengajar:** Menyediakan dashboard analitik performa belajar siswa, kalender manajemen jadwal pengajaran, serta studio kurasi AI (multimodal teks/gambar) untuk pembuatan materi rangkuman dan kuis HOTS (*Higher Order Thinking Skills*).
* **Infrastruktur Halaman Belajar Pelajar:** Menyediakan jadwal belajar terkelola otomatis, akses materi rangkuman tervalidasi pengajar, konversi teks-ke-suara (TTS), simulasi kuis interaktif, serta chatbot asisten akademik dalam grup diskusi kolaboratif.

#### B. Apa yang TIDAK BISA Dilakukan Aplikasi (Out-of-Scope):
* Sistem ini tidak menangani pembayaran gaji pengajar, biaya SPP/UKT, atau sistem administrasi keuangan internal sekolah/universitas.
* Sistem ini tidak menyediakan layanan video conference mandiri (seperti Zoom/Meet bawaan), melainkan hanya menaruh tautan (URL) kelas sinkronus jika diinput oleh pengajar.
* Sistem tidak memperbolehkan kecerdasan buatan (AI) mempublikasikan materi kuis atau rangkuman secara langsung ke ruang publik pelajar tanpa verifikasi klik (Otorisasi Manual) dari pengajar terkait.

### 1.3 Glosarium / Definisi

| Istilah / Singkatan | Definisi / Penjelasan |
| :--- | :--- |
| **Pengajar** | Entitas pengguna profesional yang mencakup Guru (SD/SMP/SMA/SMK) dan Dosen (Perguruan Tinggi). |
| **Pelajar** | Entitas pengguna didik yang mencakup Siswa sekolah (Kelas 1-12) dan Mahasiswa perkuliahan (Semester 1-8). |
| **Joint Code** | Kode unik alfanumerik yang merepresentasikan entitas institusi, jurusan/departemen, dan rombongan belajar spesifik untuk sinkronisasi data antar-role. |
| **HOTS Quiz** | Evaluasi pembelajaran berbasis kemampuan berpikir tingkat tinggi yang digenerasikan oleh model LLM (Gemini 2.5 Flash) dan disetujui pengajar. |
| **HITL** | *Human-in-the-Loop*; model interaksi yang mewajibkan intervensi manusia (pengajar) dalam menyetujui output cerdas mesin sebelum dirilis massal. |

---

## 2. Deskripsi Keseluruhan (Overall Description)

### 2.1 Perspektif Produk
EduAI merupakan sistem ekosistem terdistribusi yang berdiri sendiri (*standalone ecosystem*) namun memiliki fleksibilitas integrasi tingkat tinggi. Backend berbasis FastAPI bertindak sebagai penyedia API tersentralisasi, MongoDB berfungsi sebagai media penyimpanan dokumen skema dinamis berskala besar, sedangkan sisi klien dikembangkan menggunakan React/Next.js untuk menjamin responsivitas antarmuka. Sistem memanfaatkan infrastruktur LLM eksternal milik Google GenAI API untuk melakukan pemrosesan asisten kognitif.

### 2.2 Karakteristik Pengguna (User Classes)
* **Role Pengajar (Guru / Dosen):** Memiliki hak akses penuh (*Write/Read/Update/Delete*) terhadap data komparatif instruksional kelas, penjadwalan, kurasi materi rangkuman AI, pembuatan bank soal kuis, serta moderasi ruang diskusi kolaboratif.
* **Role Pelajar (Siswa / Mahasiswa):** Memiliki hak akses terbatas (*Read-only*) terhadap jadwal dan materi terverifikasi institusi, memiliki hak eksekusi (*Execute/Write*) untuk menjawab kuis pribadi, menggunakan layanan Audio TTS, serta mengirimkan pesan diskusi/pemanggilan `@bot` AI.

### 2.3 Batasan Desain & Implementasi
* **Teknologi Backend:** Wajib menggunakan Python 3.10+ dengan framework FastAPI untuk mengelola komunikasi asinkronus tingkat tinggi.
* **Teknologi Database:** Wajib menggunakan MongoDB dengan *library* Motor (AsyncIOMotorClient) guna mendukung skalabilitas skema data multinilai (SD hingga Perguruan Tinggi).
* **Prinsip Penamaan Variabel AI:** Prompting AI wajib menggunakan parameter dinamis berbasis data tingkat pendidikan pengguna (`SD`, `SMP`, `SMA`, `Universitas`) guna mencegah kesalahan interpretasi semantik bahasa oleh LLM.

---

## 3. Kebutuhan Fungsional (Functional Requirements)

### 3.1 Skenario Fitur / User Story

> **User Story 1: Registrasi Pengajar & Pembuatan / Sinkronisasi Kode Kantor Digital**
> * **Sebagai seorang** Pengajar Baru, 
> * **Saya ingin** mendaftar akun dan memasukkan nama institusi/sekolah saya, 
> * **Sehingga** sistem dapat men-generate sebuah kode unik khusus yang bisa saya bagikan kepada rekan sejawat pengajar lain dan pelajar saya agar kami berada dalam kantor digital yang sama tanpa perlu input data dari awal.

> **User Story 2: Integrasi Sinkronisasi Jadwal Otomatis di Sisi Pelajar**
> * **Sebagai seorang** Pelajar, 
> * **Saya ingin** memasukkan kode khusus dari pengajar saya saat registrasi atau di halaman pengaturan, 
> * **Sehingga** halaman belajar saya langsung terisi otomatis dengan jadwal pelajaran, rangkuman materi PDF, serta tautan kuis yang sudah disiapkan oleh pengajar saya.

### 3.2 Use Case Diagram & Descriptions

| ID Use Case | Nama Use Case | Aktor Utama | Deskripsi Singkat |
| :--- | :--- | :--- | :--- |
| **UC-01** | Registrasi & Verifikasi Kode | Pengajar, Pelajar | Proses pendaftaran akun dengan memilih role dan melakukan validasi/generate kode institusi bersama. |
| **UC-02** | Manajemen & Validasi Materi AI | Pengajar, Sistem AI | Pengajar mengupload PDF/Foto, AI memproses draf rangkuman/kuis, Pengajar mengedit dan melakukan rilis resmi. |
| **UC-03** | Akses Sesi Belajar Autopilot | Pelajar | Pelajar melihat jadwal dinamis, membaca rangkuman terverifikasi, dan mendengarkan kloning audio. |
| **UC-04** | Eksekusi Kuis & Evaluasi | Pelajar, Pengajar, Sistem AI | Pelajar menjawab kuis, AI mengoreksi dan menghitung nilai, Pengajar menerima log analitik progres siswa. |

#### Deskripsi Detail Use Case: UC-02 (Manajemen & Validasi Materi AI)
* **Aktor:** Pengajar, Sistem AI (Gemini Agent Core).
* **Kondisi Awal (Pre-condition):** Pengajar sudah login dan terverifikasi masuk ke kode institusi yang valid.
* **Alur Utama (Basic Flow):**
  1. Pengajar masuk ke menu "AI Content Studio" di Portal Pengajar.
  2. Pengajar mengunggah dokumen referensi (PDF/Gambar Buku Cetak).
  3. Sistem AI mengeksekusi ekstraksi teks multimodal sesuai jenjang pendidikan target.
  4. Sistem AI menampilkan draf rangkuman materi dan rancangan kuis HOTS pada panel *Artifacts*.
  5. Pengajar melakukan penyuntingan (*editing*) manual pada bagian draf yang dinilai kurang sesuai.
  6. Pengajar menekan tombol "Publish ke Kelas".
  7. Sistem menyinkronkan data materi tersebut ke seluruh kalender belajar pelajar yang memiliki kode institusi yang sama.
* **Kondisi Akhir (Post-condition):** Materi rangkuman dan kuis aktif di halaman pelajar, database memperbarui status dokumen menjadi `status: "published"`.

### 3.3 Activity Diagram / User Flow (Representasi Tekstual)

```text
[Mulai Registrasi di Aplikasi EduAI]
      |
      v
[User Mengisi Data Profil (Nama, Email, Password)]
      |
      v
[User Memilih Opsi Role?]
      |
      +-----> (Jika Pilih: PENGAJAR)
      |         |
      |         v
      |       [Apakah Sekolah/Univ Sudah Terdaftar di Sistem?]
      |         |
      |         +---> (YA)  --> [Input Kode Institusi Eksis] ---> [Verifikasi & Gabung Kantor Digital]
      |         |
      |         +---> (TIDAK)-> [Input Nama Sekolah & Tingkat] -> [Sistem Generate KODE KHUSUS Baru]
      |
      +-----> (Jika Pilih: PELAJAR)
                |
                v
              [Apakah Memiliki Kode Khusus dari Pengajar?]
                |
                +---> (YA)  --> [Input Kode Khusus] ----------> [Sistem Tarik Jadwal + Materi Otomatis]
                |
                +---> (TIDAK)-> [Lewati Langkah] -------------> [Halaman Belajar Kosong / Mode Mandiri]
      |
      v
[Simpan ke Database MongoDB & Alihkan ke Dashboard Role] -> [Selesai]
4. Kebutuhan Data (Data Requirements)4.1 Skema Data / ERD Teoretis (Struktur Relasional MongoDB)Sistem memanfaatkan arsitektur referensi ID objek antardokumen di MongoDB untuk menjaga efisiensi penyimpanan (Data Normalization). Berikut struktur skema koleksinya:JSON// Koleksi `institutions`
{
    "_id": "ObjectId",
    "institution_code": "String (Unique Index)",
    "name": "String",
    "level": "String",  // SD, SMP, SMA, Universitas
    "created_at": "DateTime"
}

// Koleksi `users`
{
    "_id": "ObjectId",
    "name": "String",
    "email": "String",
    "role": "String",   // "pengajar" atau "pelajar"
    "institution_code": "String (References institutions.institution_code)",
    "education_level": "String", // Deteksi Jenjang Konten AI (SD, SMP, SMA, Universitas)
    "current_semester": "Integer" // Menyimpan nomor Kelas (1-12) atau Semester (1-8)
}

// Koleksi `shared_schedules`
{
    "_id": "ObjectId",
    "institution_code": "String",
    "day": "String",
    "start_time": "String",
    "end_time": "String",
    "subject_name": "String",
    "current_topic": "String",
    "validated_recap_id": "ObjectId (References recaps._id)",
    "published_quiz_id": "ObjectId (References quizzes._id)"
}
4.2 Kamus Data (Data Dictionary) - Koleksi usersNama FieldTipe DataMandatoriKeterangan / Batasan_idObjectIdYAPrimary Key bawaan MongoDB.roleStringYAHanya menerima nilai "pengajar" atau "pelajar".institution_codeStringTIDAKBisa bernilai null jika pelajar memilih mode belajar mandiri tanpa sekolah.education_levelStringYAMenerima tipe data string: "SD", "SMP", "SMA", "Universitas".current_semesterIntegerYARentang nilai valid mencakup: Kelas/Semester 1 s.d 12.5. Kebutuhan Antarmuka Eksternal (External Interface Requirements)5.1 User Interface (UI Layout Specification)Portal Kantor Digital Pengajar: Wajib memiliki sidebar navigasi utama yang terdiri dari: Dashboard Kelas, Kalender Jadwal Mengajar, AI Studio Kurasi, dan Log Progres Siswa. Bagian kanan layar didominasi oleh Artifacts Panel interaktif untuk proses penyuntingan teks draf AI sebelum dirilis.Halaman Ruang Belajar Pelajar: Mengadopsi tata letak linear berbasis kronologis waktu (Timeline View). Menu utama langsung menampilkan kartu jadwal hari berjalan yang terintegrasi dengan tombol aksi langsung: "Mulai Membaca Rangkuman AI", "Dengarkan Audio Guru (TTS)", dan "Ambil Ujian Kuis HOTS".5.2 Software Interface (API Endpoints Integration)Backend FastAPI wajib mengekspos dan mengonsumsi beberapa antarmuka pemrograman aplikasi berikut:Google GenAI SDK (gemini-2.5-flash): Digunakan sebagai mesin inferensi utama untuk mengekstrak berkas PDF/Gambar menggunakan fitur Structured Outputs (Pydantic Schema Validation) untuk menjamin output berformat JSON bersih.Endpoint Sinkronisasi internal (/api/v1/schedule/sync): Menggunakan metode GET asinkronus untuk menarik seluruh manifes data dari koleksi shared_schedules berdasarkan token identitas institution_code milik pengguna aktif.6. Kebutuhan Non-Fungsional (Non-Functional Requirements)6.1 Keamanan (Security)Autentikasi Jalur Komunikasi: Seluruh pertukaran data antara klien (React) dan server (FastAPI) wajib berada di bawah enkripsi protokol komunikasi aman HTTPS dan WSS (Secure WebSocket).Manajemen Token Sesi: Autentikasi pengguna wajib menggunakan sistem Token yang divalidasi silang lewat dependensi keamanan FastAPI (Depends(get_current_user_from_access_token)).Pencegahan Kebocoran Kunci Jawaban: Dokumen kuis di MongoDB wajib memisahkan field correct_index dari data pertanyaan mentah. Payload kunci jawaban dilarang keras dikirimkan ke browser pelajar sebelum pelajar menekan tombol submisi akhir kuis.6.2 Performa (Performance)Kecepatan Generasi Teks AI: Waktu respons token dari model Gemini untuk ekstraksi teks dokumen rata-rata tidak boleh melebihi kecepatan 200 token/detik untuk mencegah waktu tunggu berlebih di sisi pengguna.Latensi Endpoint Lokal: Seluruh query database lokal MongoDB (tanpa pemanggilan AI eksternal) wajib diselesaikan dalam waktu kurang dari $t \le 200 \text{ ms}$ berkat pemanfaatan optimal dari explicit composite indexing.6.3 Ketersediaan (Availability)Target Uptime Sistem: Tingkat ketersediaan server backend EduAI ditargetkan mencapai minimal 99.9% waktu aktif operasional sepanjang tahun (menerapkan arsitektur auto-restart kontainer Docker jika terjadi kegagalan sistem tak terduga).Penanganan Kegagalan Jaringan AI: Sistem wajib mengimplementasikan blok kode penanganan eksepsi (try-except) khusus untuk menangani interupsi koneksi API Google GenAI tanpa menyebabkan server FastAPI mengalami crash atau mati total.

Pertanyaan bagus, Syahid! Bagian ini emang krusial banget dipahami biar lo gak bingung nge-bayangin alur sinkronisasi datanya di MongoDB.

Kalau digabungin dengan konsep **"Kantor Digital Pengajar"** dan **"Kode Khusus Institusi"** yang kita bahas tadi, sistem lo gak akan bentrok, justru alurnya jadi otomatis banget (*autopilot*).

Mari kita bedah gimana sistem ini bekerja di latar belakang berdasarkan percakapan sebelumnya:

---

### 1. Skenario Jalur Autopilot (Pelajar Masuk Kode Institusi)

Ketika si Pelajar mendaftar dan memasukkan kode dari Pengajarnya (misal: `UBSI-INF-2026`), halaman folder dan jadwalnya langsung sinkron secara otomatis:

* **Pengajar Menentukan Jadwal & Mapel:** Pengajar membuat jadwal di kantor digitalnya, misalnya: *Hari Senin jam 08:00 ada mata pelajaran "ADSPL"*.
* **Folder Otomatis Terbuat di Sisi Pelajar:** Begitu Pelajar membuka aplikasinya, sistem FastAPI lo akan membaca kode institusi tersebut dan melihat bahwa ada pelajaran "ADSPL". Sistem akan **otomatis membuatkan folder bernama "ADSPL"** di halaman folder si Pelajar.
* **Isi Dokumen di dalam Folder:** Pengajar mengunggah dokumen materi (PDF/Foto) ke folder "ADSPL" di portalnya. Karena kodenya sama, dokumen tersebut langsung muncul di dalam folder "ADSPL" milik Pelajar.
* **Cara Belajarnya (1 atau Banyak Doc):** * Kalau Pelajar klik **1 dokumen** PDF di dalam folder, dia bisa baca rangkuman, dengerin TTS, atau chat privat dengan dokumen itu.
* Kalau Pelajar klik tombol **"Kuis Mingguan"** atau **"Rangkuman Gabungan"** di halaman jadwal/folder, sistem lo akan memicu fungsi `recap_generate` atau `quiz_generate` yang otomatis mengambil **semua dokumen ready** yang ada di dalam folder tersebut untuk dianalisis sekaligus oleh Gemini.



---

### 2. Skenario Jalur Mandiri (Pelajar Belajar Sendiri / Tanpa Kode Guru)

Gimana kalau Pelajarnya gak punya kode institusi dan mau pakai EduAI buat belajar mandiri? Logika kode lo yang ada di `server.py` saat ini sebenarnya sudah mendukung ini:

* **Pelajar Menyusun Jadwal Sendiri:** Di halaman `EducationSettings`, Pelajar ketik manual nama mata pelajarannya, misalnya "Matematika".
* **Sistem Memicu Trigger `update_one` (Baris 517):** Di dalam kode `server.py` lo yang sekarang, lo udah bikin logika: begitu user simpan jadwal, sistem akan mengecek apakah folder dengan nama "Matematika" sudah ada di database. Jika belum ada, sistem otomatis men-generate `folder_id` baru dan membuat folder kosong bernama "Matematika".
* **Pelajar Kelola Dokumen Sendiri:** Pelajar tinggal upload PDF materi belajarnya sendiri ke dalam folder "Matematika" tersebut dan AI akan merangkumnya secara privat.

---

### Kesimpulan Alur Sistem Lo (Sudah Sangat Sesuai ADSPL)

Jadi, kesimpulannya, sistem lo itu menggunakan alur **"Satu Pintu Berbasis Relasi Folder ID"**.

Mau jadwalnya dibuat otomatis oleh Pengajar lewat *Kode Institusi*, atau dibuat manual oleh Pelajar di halaman pengaturan, ujung-ujungnya sistem backend FastAPI lo tetap akan bermuara pada aturan yang sama: **Setiap satu nama Mata Pelajaran unik wajib diikat oleh satu `folder_id` unik di database MongoDB**.

Alur inilah yang menjamin ketika Pelajar membuka kartu jadwal hari Senin, sistem lo bisa tahu dokumen PDF apa saja yang harus ditarik untuk bahan belajar hari itu hanya dengan melihat `folder_id`-nya.

Berdasarkan mockup halaman Pengaturan Belajar (pengaturan-belajar) yang lo kirim, di sana ada input untuk Metode Mengajar, Jenjang Pendidikan, Jurusan/Prodi, Tingkat/Semester, dan tabel Susun Jadwal Mandiri (Hari, Jam, Mata Pelajaran).Jika seorang Pelajar memiliki dan menggunakan Kode Unik Institusi (dari Pengajarnya), maka halaman Pengaturan Belajar ini akan berubah perilakunya menjadi Autopilot / Terkunci (Read-Only) pada bagian-bagian yang disinkronisasikan oleh pengajar.Berikut adalah detail perubahan visual dan fungsi pada komponen halaman tersebut:1. Status Koneksi Institusi (Komponen Baru di Paling Atas)Sebelum masuk ke pengaturan metode, lo perlu menambahkan satu kartu status atau input kecil di bagian atas halaman:Jika belum terhubung: Muncul input "Masukkan Kode Institusi/Kelas" dan tombol "Hubungkan".Jika sudah terhubung: Muncul teks badge sukses:  Terhubung: Universitas Bina Sarana Informatika (Informatika - Semester 4). Di sebelahnya ada tombol kecil "Putuskan Hubungan" jika siswa ingin kembali ke mode mandiri.2. Bagian Profil Akademik (Jenjang, Jurusan, Tingkat)Begitu kode unik dimasukkan dan berhasil divalidasi oleh backend FastAPI, data profil akademik ini akan langsung terisi otomatis berdasarkan manifes kode pengajar:Perilaku UI: Dropdown Jenjang Pendidikan, input Jurusan/Prodi, dan Tingkat/Semester akan otomatis terisi dan statusnya menjadi Disabled (Tidak bisa diklik/diedit manual).Alasan: Biar sinkronisasi jadwal dari database tidak pecah akibat siswa iseng mengubah tingkat atau jurusannya secara sepihak di halaman ini.3. Bagian Metode Mengajar (Pilihan AI)Untuk bagian Metode Mengajar (seperti Real World, Imagination, Confidence), lo bisa memberikan dua opsi desain tergantung keinginan lo:Opsi A (Dikunci Pengajar): Jika pengajar menerapkan standar metode mengajar yang seragam untuk kelas tersebut minggu ini, checkbox ini akan otomatis tercentang sesuai pilihan pengajar dan di-disabled.Opsi B (Tetap Terbuka): Jika pengajar membebaskan siswa memilih gaya belajar personalnya, bagian ini tetap bisa dicentang bebas oleh pelajar sesuai seleranya. (Gue rekomendasiin Opsi B agar sisi Personalized AI Tutor-nya tetap terasa aktif).4. Bagian Tabel "Susun Jadwal Mandiri" $\rightarrow$ "Jadwal Institusi Otomatis"Ini perubahan yang paling drastis dan keren secara arsitektur perangkat lunak.Perilaku UI Lama (Mandiri): Ada tombol "Tambah Jadwal", lalu user ketik manual Hari, Jam, dan nama Mata Pelajaran.Perilaku UI Baru (Berbasis Kode Unik): * Tombol "Tambah Jadwal" manual akan dihilangkan atau disembunyikan.Tabel akan otomatis memuat baris data (Read-Only) yang ditarik dari koleksi shared_schedules milik institusi tersebut.Di dalam kolom tabel, nama Mata Pelajaran (misal: Analisis dan Desain Sistem Perangkat Lunak) akan langsung bertindak sebagai hyperlink atau memiliki indikator folder: 📂 ADSPL.Gimana Logikanya Memengaruhi "Page Folder Mata Pelajaran"?Seperti yang lo bingungkan sebelumnya, karena nama Mata Pelajaran di tabel jadwal ini sudah otomatis terisi dari pengajar (misalnya: Ahad, 08:00, Aljabar Linear), sistem backend lo akan langsung bekerja di latar belakang:Sistem mengecek apakah di dalam akun pelajar tersebut sudah ada folder dengan nama "Aljabar Linear".Jika belum ada, backend otomatis membuatkannya secara gaib saat halaman ini dimuat pertama kali setelah sinkronisasi kode.Di dalam Page Folder, pelajar akan melihat folder "Aljabar Linear" tersebut sudah berisi dokumen-dokumen materi kuliah yang diunggah oleh dosennya dari Portal Pengajar.Visualisasi Perubahan Alur Halaman (UI Flow)Jadi di frontend Next.js lo nanti, lo tinggal mainin kondisi state (true/false) berdasarkan status token user:JavaScript// Contoh logika sederhana di Next.js lo
const isLinkedToInstitution = user.institution_code ? true : false;

return (
  <div>
    {/* Input Dropdown Jenjang */}
    <select disabled={isLinkedToInstitution} value={user.education_level}>
      <option>Universitas</option>
    </select>

    {/* Tabel Jadwal */}
    {isLinkedToInstitution ? (
      <TableJadwalOtomatis data={dataJadwalDariGuru} />
    ) : (
      <TableJadwalMandiri />
    )}
  </div>
);
Dengan cara seperti ini, satu halaman pengaturan-belajar bisa melayani dua tipe user sekaligus: user mandiri yang bebas ketik apa saja, dan user institusi yang hidupnya di dalam aplikasi sudah serba otomatis diatur oleh gurunya.

Jadi maksud lo, alur penentuan role dan input kode unik itu tidak ditaruh di dalam page pengaturan dalam bentuk tombol terpisah, melainkan diselesaikan langsung di awal pada Page Onboarding (Mockup Gambar 2 yang lo kirim) sebelum user bisa menginjakkan kaki di Dashboard utama.

Ini keputusan desain ADSPL yang jauh lebih bersih (Clean UX)! Dengan begini, ketika state user ditarik dari database ke page pengaturan-belajar (Gambar 1), statusnya sudah mutlak: apakah dia masuk jalur mandiri atau jalur institusi autopilot terikat kode guru.

Mari kita bedah bagaimana isi form komponen pada Page Onboarding lo berubah dinamis dan bagaimana dampaknya langsung ke Page Pengaturan Belajar lo:

1. Desain Alur Dinamis di Page Onboarding (Gambar 2)
Pada layar Langkah 1 dari 1 di Gambar 2, sebelum input Jenjang Pendidikan, lo wajib menambahkan satu input biner untuk Memilih Role:

A. Opsi 1: Jika User Memilih Role "Pelajar"
Form di bawahnya akan muncul seperti Gambar 2 yang lo buat saat ini, dengan tambahan satu kolom opsional di paling bawah:

Jenjang Pendidikan: (SD, SMP, SMA, SMK, Perguruan Tinggi).

Nama Sekolah / Kampus: (Input Teks).

Kelas / Semester: (Dropdown Angka).

Kode Institusi Bersama (Opsional): * Jika dikosongkan: Pelajar masuk ke mode mandiri. Saat klik "Lanjat ke Dashboard", page pengaturan-belajar (Gambar 1) akan terbuka penuh untuk diisi manual.

Jika diisi kode guru: Sistem memvalidasi ke database. Begitu cocok, data nomor 1, 2, dan 3 di atas langsung otomatis ditimpa (overwrite) sesuai data asli sekolah/univ tersebut, lalu langsung dilempar ke Dashboard.

B. Opsi 2: Jika User Memilih Role "Pengajar"
Tampilan form Onboarding akan langsung berubah secara dinamis untuk mendeteksi apakah dia inisiator baru atau pengajar sekunder:

Apakah Sekolah/Univ Anda Sudah Terdaftar di EduAI? (Opsi Radio Button: Belum / Sudah).

Jika Jawab "Belum" (Otomatis Generate):

Guru mengisi: Jenjang, Nama Sekolah, dan Unit Kelas/Prodi.

Saat klik "Lanjut", sistem otomatis men-generate kode baru (misal: UBSI-INF-2026) dan menyimpannya di profil guru tersebut sebagai pemilik institusi (Owner).

Jika Jawab "Sudah" (Masukkan Kode):

Muncul satu kolom: Masukkan Kode Institusi Kelas Anda.

Begitu guru memasukkan kode yang valid, dia langsung bergabung ke kantor digital yang sama dengan rekan gurunya yang sudah mendaftar duluan.

2. Dampak Langsung pada Page Atur Kelas & Mapel (Gambar 1)
Karena urusan administrasi kode sudah dikunci mati di page Onboarding, maka saat Pelajar yang terikat kode membuka page Atur Kelas & Mapel (Gambar 1), interaksi halamannya akan mengalami Autopilot Massal:

A. Blok "Mata Pelajaran" & "Jadwal Pelajaran" (Terkunci Otomatis)
Kondisi Aktual di Gambar 1: Ada kolom ketik manual "Nama mapel", tombol +, tombol hapus 🗑️, dan tombol "Tambah Jadwal".

Perubahan Jalur Kode Unik: Seluruh area input teks dan tombol aksi (+, 🗑️, Tambah Jadwal) akan disembunyikan (hidden) atau di-disabled.

Tampilan Siswa: Badge nama mapel (DATA WAREHOUSE, MATEMATIKA DISKRIT) dan baris tabel jam pelajaran langsung terisi otomatis dari data database shared_schedules milik gurunya. Siswa tinggal melihat jadwal resmi mereka hari itu.

B. Blok "Upload Materi Belajar" (Semi-Privat)
Ini area yang menarik di Gambar 1. Lo menampilkan daftar file PDF yang sudah di-upload beserta ikon mata 👁️ untuk melihat rangkuman.

Materi dari Pengajar: File-file PDF materi kuliah yang diunggah oleh gurunya di kantor digital akan langsung nempel di folder mapel masing-masing siswa secara otomatis, lengkap dengan status centang hijau Ready hasil analisis AI multimodal. Siswa tinggal klik tombol mata untuk belajar.

Dokumen Privat Siswa: Tombol "Pilih File" dan "Foto Buku" di Gambar 1 tetap dibiarkan aktif. Gunanya agar siswa tetap bisa menyelipkan catatan pribadi atau foto coretan binder mereka sendiri ke dalam folder mapel tersebut tanpa mengganggu folder global milik teman-teman sekelasnya.

C. Blok "Materi AI" (Pemicu Rangkuman Gabungan / Kuis Massal)
Tombol "Buat Materi" di Gambar 1: Jika siswa berada di bawah kode guru, tombol ini fungsinya bergeser menjadi "Mulai Ujian Kuis Kelas" atau "Akses Rangkuman Terpadu" yang soal-soalnya ditarik langsung dari published_quiz_id yang sudah disetujui kelayakannya oleh gurunya di portal pengajar.

Kesimpulan Logika Koding untuk Frontend Lo:
Dengan memindahkan gerbang verifikasi ke page Onboarding, lo cukup melempar satu kondisi state global dari konteks user untuk merender Gambar 1:

JavaScript
// Jika user.institution_code bernilai string (berarti terikat kode unik pengajar)
const isAutopilot = !!user.institution_code;

// Di dalam return UI Gambar 1:
{ !isAutopilot && <button onClick={tambahJadwalManual}>Tambah Jadwal</button> }