# Use Case: Adaptive Chunked PDF Analysis

Actor: System (backend) triggered by Document Upload / Admin request

Description: Pipeline untuk menganalisis dokumen PDF panjang dengan memecahnya menjadi batch kecil (2-5 pages) dengan overlap, memanggil LLM per-batch, lalu menggabungkan hasil menjadi summary, concepts, diagrams, objectives.

Preconditions:
- Dokumen ter-upload dan dapat dibaca (PdfReader dapat mengekstrak halaman).
- GEMINI_API_KEY dan model konfigurasi tersedia di env.

Postconditions:
- Document record di-update dengan fields: summary, key_concepts, diagrams, learning_objectives.
- Jika threshold tidak terpenuhi (konsep < minimal), fallback legacy pass dijalankan.

Main Flow:
1. File disimpan → background task _bg_analyze_document(documentId) dijalankan.
2. _determine_chunk_size(totalPages) menentukan chunk_size & overlap.
3. Untuk setiap batch: _extract_pages_text(range) lalu _analyze_batch(batchText) yang memanggil _call_gemini.
4. Hasil tiap batch dikoleksi; _deduplicate_concepts() dan _merge_diagrams() dipanggil.
5. _synthesize_summary_from_chunks() membuat ringkasan akhir (concat atau LLM merge jika > threshold).
6. Document record diupdate status="ready" dan notifikasi dikirim (useRealtimeSocket event document_status).

Alternative Flows:
- 2a. Jika PDF ≤ 4 pages: jalankan legacy single-pass analyze_pdf_legacy().
- 3a. Jika _call_gemini gagal untuk batch tertentu: retry limited times; jika semua gagal, mark analysis failed.

Mapping ke kode:
- Backend: backend/server.py functions _determine_chunk_size, _analyze_batch, _call_gemini, _synthesize_summary_from_chunks
- Tests: backend/test_chunked_analysis.py
- Frontend: DocumentDetail.jsx reads doc.ai_content fields after analysis completes.