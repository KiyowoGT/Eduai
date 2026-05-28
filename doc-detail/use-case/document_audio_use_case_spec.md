# Use Case: Generate Document Audio (TTS / Voice Clone)

Actor: Student / Teacher

Description: Menghasilkan file audio (narasi) dari ringkasan dokumen atau study notes; mendukung voice cloning jika pengguna mengaktifkan clone voice.

Preconditions:
- User mengklik Generate Audio di DocumentDetail.
- Jika voice clone: user telah menyimpan clone_voice_url and clone_voice_enabled in profile.

Postconditions:
- Audio file URL tersedia (temporary storage or CDN) dan dikembalikan ke client.
- Jika clone voice used, respect privacy settings and quota.

Main Flow:
1. User klik "Play Audio" di DocumentDetail; jika audio belum ada, client POST /api/documents/{id}/generate-audio.
2. Server memanggil generateDocumentAudio(documentId) yang memilih voice model (default TTS or clone URL) dan menghasilkan audio.
3. Server menyimpan file ke UPLOAD_DIR or cloud storage dan mengembalikan audio_url.
4. Client memutar audio via audio element.

Alternative Flows:
- 2a. Clone voice invalid: fallback to default voice and notify user.
- 2b. Audio generation fails: return 500 with message and allow retry.

Mapping ke kode:
- Frontend: DocumentDetail.jsx handleDocPlayAudio(), audioRef
- API: POST /api/documents/{id}/generate-audio, GET /api/documents/{id}/audio
- Backend: generateDocumentAudio() util, uses TTS service or voice cloning provider (respecting user settings).