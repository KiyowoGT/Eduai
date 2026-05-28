# User Flow: Pengajar Mandiri

Ringkasan: Tutor independen yang mengunggah materi, membuat kuis via AI, membagikan redeem code, dan memonitor peserta.

Preconditions:
- Akun pengajar sudah terdaftar dan terautentikasi.
- File materi (PDF) sesuai format & ukuran yang didukung.
- API key model AI tersedia di backend.

Postconditions:
- Materi tersimpan di library; kuis dibuat dan tersedia (quiz_id).
- Redeem code dibuat bila dipilih; hasil kuis tercatat di DB.

Main Flow:
1. Pengajar masuk ke Studio Materi → pilih atau upload dokumen.
2. Pengajar klik "Buat Kuis (AI)" → isi parameter (jumlah soal, difficulty).
3. Client POST /api/quiz/generate → server memproses asinkron (analyze_pdf jika perlu).
4. Setelah ready, notifikasi dikirim (quiz_status) → pengajar dapat review & edit drafting soal.
5. Pengajar publish: pilih kelas atau buat redeem code (POST /api/portal/redeem).
6. Pantau hasil: GET /api/quiz/{quizId}/results dan gunakan AI Insights untuk analitik.

Alternative Flows:
- Jika file gagal di-upload atau format salah → tampilkan error validasi.
- Jika AI generate gagal/timeout → tawarkan retry atau human-edit pada draft.
- Jika redeem code kuota penuh/expired → tampilkan pesan dan opsi alternatif.

Mapping ke kode:
- Frontend: pages/QuizLab.jsx, components/PdfUploader.jsx, components/RedeemCodeCreate.jsx
- API: POST /api/documents/upload, POST /api/quiz/generate, POST /api/portal/redeem, GET /api/quiz/{quizId}/results
- Backend: analyze_pdf(), generate_quiz(), _call_gemini(), _call_groq()

