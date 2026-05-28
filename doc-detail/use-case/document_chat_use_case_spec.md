# Use Case: Document Chat (AI Study Buddy)

Actor: Pelajar (mandiri atau institusi), Guru

Description: User berdialog interaktif dengan model AI yang memiliki konteks dari dokumen (hasil analyze_pdf), memungkinkan tanya jawab, klarifikasi konsep, dan pembuatan ringkasan tambahan.

Preconditions:
- Dokumen sudah dianalisis (analyze_pdf) dan konteks telah disimpan (chunks/summaries).
- User memiliki akses ke documentId dan terautentikasi jika dokumen bersifat private.

Postconditions:
- Percakapan tersimpan (opsional), dan rekomendasi/fragmen yang dihasilkan dapat dimasukkan ke study notes.

Main Flow:
1. User membuka Document Detail → memilih tab "AI" atau "Chat".
2. Client membuka komponen DocumentAiChat dan inisialisasi context dengan GET /api/documents/{id}/context.
3. User mengirim pesan; client POST /api/documents/{id}/chat with message + context pointers.
4. Server memanggil LLM (_call_gemini atau _call_groq) dengan konteks; mengembalikan reply dan sumber (page refs).
5. Client menampilkan balasan; user dapat minta referensi atau permintaan soal/kuis berdasarkan bagian chat.

Alternative Flows:
- 3a. Context tidak tersedia: tawarkan untuk memicu analyze_pdf atau tampilkan fallback generik.
- 4a. LLM rate-limit → queue request or show "busy" message.

Mapping ke kode:
- Frontend: components/DocumentAiChat.jsx, pages/DocumentDetail.jsx
- API: GET /api/documents/{id}/context, POST /api/documents/{id}/chat
- Backend: server.py handlers that call _call_gemini/_call_groq and attach citations
- Hooks: useRealtimeSocket for long-running tasks or asynchronous chat features (streaming optional)