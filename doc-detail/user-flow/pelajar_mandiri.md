# User Flow: Pelajar Mandiri

Ringkasan: Pelajar tanpa institusi yg menggunakan Portal Mandiri untuk ikut kuis via code atau membuat kuis dari dokumen pribadi.

Preconditions:
- Pelajar memiliki akses ke Portal Mandiri atau akun pengguna.
- Redeem code valid (jika memakai kode).
- Dokumen yang diunggah berformat PDF dan tidak melebihi batas ukuran.

Postconditions:
- Hasil kuis tersimpan; deep feedback dihasilkan bila tersedia.
- Dokumen yang dianalisis menyimpan summary & concept list untuk chat/quiz reuse.

Main Flow (Redeem Code):
1. Pelajar buka Portal Mandiri → input redeem code.
2. Client POST /api/portal/redeem/validate → server mengembalikan quiz metadata.
3. Pelajar mengerjakan kuis → POST /api/results untuk menyimpan jawaban.
4. Server memicu generate_deep_feedback (opsional) dan mengembalikan skor & feedback.

Main Flow (Personal Document):
1. Pelajar upload PDF → POST /api/documents/upload → server simpan documentId.
2. Pelajar klik "Generate Quiz" → POST /api/quiz/generate(documentId)
3. Tunggu notifikasi via useRealtimeSocket / waitForStatus → GET /api/quiz/{quizId}
4. Kerjakan kuis → hasil disimpan dan deep feedback disiapkan.

Alternative Flows:
- Redeem code tidak valid: tampilkan pesan error dan kontak tutor.
- Upload gagal atau non-PDF: batalkan dan minta user upload ulang.
- AI gagal memproses: tampilkan status pending dan opsi retry.

Mapping ke kode:
- Frontend: pages/PortalMandiri.jsx, pages/PersonalQuiz.jsx, components/DocumentAiChat.jsx
- API: POST /api/portal/redeem/validate, POST /api/documents/upload, POST /api/quiz/generate, POST /api/results

