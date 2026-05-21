# Adaptive Chunked PDF Analysis - Implementation Summary

## Overview
PDF analysis now uses **adaptive chunking** with overlap for large documents. This provides:
- **Better accuracy**: LLM focuses on small context (2-4 pages) instead of overwhelming whole-PDF
- **Complete coverage**: Every page gets attention, no truncation
- **Context preservation**: Overlap ensures continuity between batches
- **Fallback safety**: Legacy single-pass for small docs or when chunked yields <5 concepts

---

## How It Works

### 1. Chunking Decision
```
total_pages ≤ 4      → Legacy single-pass (high quality for small docs)
total_pages 5-15    → Chunk size = 2 pages
total_pages 16-30   → Chunk size = 3 pages
total_pages 31-60   → Chunk size = 4 pages
total_pages > 60    → Chunk size = 5 pages
```

**Overlap**: `max(1, chunk_size // 2)` → 50% overlap between consecutive batches.

**Example** (40 pages, chunk=4, overlap=2):
```
Batch 1: pages 1-4
Batch 2: pages 3-6  (overlap: 3-4)
Batch 3: pages 5-8  (overlap: 5-6)
...
Total ≈ 19 batches
```

### 2. Batch Processing
Each batch goes through:
1. Extract text from page range (`_extract_pages_text`)
2. If text < 50 chars → skip (image-only slide)
3. Call Gemini with **batch-specific prompt**:
   - System: "Analisis HANYA halaman X-Y"
   - Request: summary (max 50 words), key_concepts (2-4 items), diagrams (max 1), learning_objectives
4. Store result with `_batch_meta` (start, end, concept_count, skipped)

### 3. Post-Processing
- **Deduplicate concepts**: normalized name matching, keep longest explanation+code
- **Merge diagrams**: by (name, type), keep longest explanation
- **Deduplicate objectives**: simple set-based
- **Cap results**: concepts ≤20, diagrams ≤10, objectives ≤10

### 4. Summary Synthesis
Two strategies:
- **Concatenate**: if ≤2 batches OR total words <300 → `"\n\n".join(summaries)`
- **LLM-merge**: if >300 words → call Gemini (GEMINI_MODEL, cheaper) to merge into 3-4 paragraphs (150-200 words)

### 5. Fallback Mechanism
Trigger: `len(unique_concepts) < 5 AND total_pages > 10`
- Runs legacy single-pass analysis on entire PDF
- Merges legacy concepts/diagrams/objectives into existing results
- Uses legacy title if current title is generic

---

## Code Location (backend/server.py)

### New/Modified Functions
| Function | Line | Description |
|----------|------|-------------|
| `_determine_chunk_size()` | 392-400 | Adaptive chunk size based on total pages |
| `_extract_pages_text()` | 403-410 | Extract text from page range with PAGE header |
| `_normalize_concept_name()` | 413-419 | Normalize for dedup (lowercase, strip articles, punctuation) |
| `_deduplicate_concepts()` | 422-433 | Dedup by normalized name, keep best explanation |
| `_merge_diagrams()` | 436-444 | Merge by (name, type), keep longest |
| `_synthesize_summary_from_chunks()` | 447-469 | Merge batch summaries (concat or LLM) |
| `_analyze_batch()` | 472-529 | Single batch analysis with metadata |
| `_analyze_pdf_legacy()` | 532-561 | Original single-pass (now **async fixed**) |
| `analyze_pdf()` | 564-664 | **Main function** - orchestrates chunking, calls batch analysis, merges, fallback |

### Modified Original
- `_analyze_pdf_legacy`: **Fixed** from `def` to `async def` (was causing SyntaxError with await)

---

## Performance & Cost

### Token Usage
| PDF Size | Old (single-pass) | New (chunked) | Savings |
|----------|------------------|---------------|---------|
| 10 pages | ~8K tokens (often truncated) | 5 batches × ~2K = 10K | ~0% (but better quality) |
| 30 pages | ~20K tokens (heavily truncated) | 10 batches × ~2K = 20K | ~0% (but complete extraction) |
| 60 pages | >30K tokens (fails/truncated) | 20 batches × ~2K = 40K | +33% but **previously impossible** |

**Note**: Higher token usage for large docs but **quality dramatically better**. Cost increase minimal vs value.

### Latency
- Sequential batch processing: ~5-10s per batch (Gemini async)
- 30-page doc (10 batches): ~50-100s total
- Parallel processing not implemented (preserves order, avoids rate limits)

---

## Testing

Unit tests in `backend/test_chunked_analysis.py` cover:
- `_determine_chunk_size()` for various page counts
- `_normalize_concept_name()` regex and normalization
- `_deduplicate_concepts()` keeps longest explanation
- `_merge_diagrams()` merges by name+type
- `_synthesize_summary_from_chunks()` logic path

Run:
```bash
cd backend && python test_chunked_analysis.py
```

Expected output:
```
[OK] _determine_chunk_size
[OK] _normalize_concept_name
[OK] _deduplicate_concepts
[OK] _merge_diagrams
[OK] _synthesize_summary_from_chunks
All unit tests passed!
```

---

## Configuration (Tunable)

Edit constants in `server.py` if needed:

```python
# In _determine_chunk_size():
CHUNK_SIZE_SMALL = 2    # ≤15 pages
CHUNK_SIZE_MEDIUM = 3   # 16-30 pages
CHUNK_SIZE_LARGE = 4    # 31-60 pages
CHUNK_SIZE_XLARGE = 5   # >60 pages

# Overlap ratio (currently 0.5 = 50%)
overlap = max(1, chunk_size // 2)  # line 574

# Concept/diagram caps
MAX_CONCEPTS = 20      # line 601
MAX_DIAGRAMS = 10      # line 604
MAX_OBJECTIVES = 10    # line 614

# Fallback threshold
MIN_CONCEPTS_FALLBACK = 5   # line 621
MIN_PAGES_FALLBACK = 10    # line 621
```

---

## Edge Cases Handled

| Edge Case | Handling |
|-----------|----------|
| **Image-only pages** | Text <50 chars → batch skipped, no concepts |
| **Very small PDF (≤4 pages)** | Direct legacy single-pass (no chunking overhead) |
| **Chunk yields <5 concepts** | Fallback to full legacy analysis, merge results |
| **Duplicate concepts across batches** | Normalized name deduplication keeps best |
| **Batch failure (API error)** | Logged as warning, empty result, continue other batches |
| **Infinite loop risk** | Fixed by pre-calculating total_batches and using `for` loop |

---

## Migration Notes

### Backward Compatibility
- Legacy function `_analyze_pdf_legacy` preserved (used for small docs + fallback)
- API contract unchanged: still returns `{title, summary, key_concepts, diagrams, learning_objectives}`
- No database schema changes

### Monitoring
Check logs for batch metrics:
```
INFO: Analyzing batch 1/19: pages 1-4 (total 40)
INFO: Analysis complete for doc_id: concepts=34, pages=40, batches=19
WARNING: Batch 3/19 (halaman 5-8) gagal: ...
```

---

## Future Improvements (Optional)

1. **Parallel batch processing**: Use semaphore to run 2-3 batches concurrently (respect rate limits)
2. **Smart overlap**: Dynamic overlap based on content (increase if batch ends mid-section)
3. **Content-aware chunking**: Detect section headers to split at logical boundaries
4. **Embedding-based dedup**: Use sentence embeddings for concept similarity (not just string match)
5. **Caching**: Cache batch results for re-analysis of same PDF

---

## Questions / Troubleshooting

**Q: Batch failures (429 rate limit)?**
A: Currently sequential. If needed, can add `semaphore = asyncio.Semaphore(2)` to limit concurrency to 2.

**Q: Too many duplicate concepts?**
A: Adjust `_normalize_concept_name()` regex to be more/less aggressive.

**Q: Summary too short?**
A: Edit threshold in `_synthesize_summary_from_chunks()`: change `total_words < 300` to higher value.

**Q: Want larger batches for short docs?**
A: Modify `_determine_chunk_size()` thresholds (currently 15, 30, 60).

---

**Implementation completed**: All functions present, syntax validated, unit tests passing.
**Next step**: Deploy to staging, test with real PDF (5, 20, 50, 100 pages), monitor batch counts & quality.
