# Use Case: Quiz Lab (Teacher-driven Quiz Generation)

Actor: Pengajar (Mandiri / Institusi)

Description: Pengajar membuat kuis interaktif dari dokumen yang diunggah atau dari question bank, mengatur jumlah soal, jenis (HOTS), dan distribusi ke siswa atau lewat redeem code.

Preconditions:
- Pengajar terautentikasi dan memiliki hak membuat kuis pada folder/institution.
- Dokumen tersedia di library dan sudah dianalisis (opsional).

Postconditions:
- Quiz dibuat, tersimpan dengan quiz_id; visibility/distribution sesuai pengaturan (institutional or redeem code).
- Jika diatur approval flow, kuis tercatat sebagai "pending" untuk review sebelum publikasi.

Main Flow:
1. Pengajar membuka Quiz Lab → pilih dokumen atau buat dari blank.
2. Pengajar atur parameter (jumlah soal, difficulty) dan klik Generate.
3. Client POST /api/quiz/generate {documentId, questionCount, options}.
4. Server memproses asinkronus, memanggil LLM (generate_quiz), menyimpan draft kuis.
5. Jika berhasil, server mengirim event quiz_status; client GET /api/quiz/{quizId} untuk menampilkan.
6. Pengajar dapat publish ke class atau buat redeem code (POST /api/portal/redeem).

Alternative Flows:
- 3a. Generate memakan waktu lama: tampilkan spinner & notifikasi via useRealtimeSocket.
- 4a. Model menghasilkan item yang tidak sesuai: pengajar dapat edit soal manual di UI.

Mapping ke kode:
- Frontend: pages/QuizLab.jsx, components/QuizEditor.jsx
- API: POST /api/quiz/generate, GET /api/quiz/{quizId}, POST /api/quiz/{quizId}/publish
- Backend: generate_quiz(), _call_groq() handlers

Quality:
- Include human-in-the-loop review option and draft editing before publish.