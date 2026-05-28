# Use Case: Redeem Code (Portal Mandiri)

Actor: Pelajar Mandiri (user tidak terikat institusi) / Tutor (pemberi kode)

Description: Siswa memasukkan kode redeem untuk mengakses kuis yang dibuat tutor/pengajar tanpa memerlukan akun institutional.

Preconditions:
- Redeem code sudah dibuat oleh tutor (createRedeemCode) dan masih aktif.
- Pelajar memiliki akses ke Portal Mandiri (halaman input kode).
- Backend menyimpan metadata kuis (quiz_id) yang terkait dengan kode.

Postconditions:
- Jika sukses: pelajar dialihkan ke halaman kuis, hasil akan disimpan saat selesai.
- Jika gagal (kode invalid/expired): tidak ada akses diberikan.
- Semua akses ter-logging untuk audit.

Main Flow:
1. Pelajar membuka Portal Mandiri → navigasi ke form Redeem Code.
2. Pelajar memasukkan kode dan menekan Submit.
3. Client memanggil POST /api/portal/redeem/validate (body: {code}).
4. Server memverifikasi status kode, mengembalikan quiz_id dan metadata jika valid.
5. Client memanggil GET /api/quiz/{quizId} untuk memuat kuis dan menampilkan UI kuis.
6. Pelajar mengerjakan kuis; saat submit, POST /api/results dikirim; server menyimpan hasil dan meng-trigger generate_deep_feedback (optional).

Alternative / Exception Flows:
- 3a. Kode tidak valid atau expired: server mengembalikan 400/410; client menampilkan pesan error dan opsi kontak tutor.
- 4a. Quiz telah dipakai maksimum peserta: tampilkan pesan "Kuota penuh".
- 5a. Kuis gagal dimuat (server error): retry atau tampilkan pesan, tawarkan opsi refresh.

Mapping ke kode:
- Frontend: pages/PortalMandiri.jsx, components/RedeemCodeForm.jsx
- API: POST /api/portal/redeem/validate, GET /api/quiz/{quizId}, POST /api/results
- Hooks: useRealtimeSocket (opsional) untuk notifikasi status quiz
- Notes: gunakan client helper waitForStatus untuk kuis yang diproses asinkronus.