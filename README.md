# EduAI - Intelligent Learning Platform

## 📝 Recent Implementation Log

**Last Updated**: 2026-05-14

### Implemented Features

1. **Adaptive Chunked PDF Analysis** (Backend)
   - PDF >4 pages dibagi menjadi batch 2-5 halaman dengan overlap 50%
   - Setiap batch dianalisis terpisah, hasil di-merge (dedup, synthesize summary)
   - Fallback ke single-pass jika hasil chunked <5 concepts
   - Unit tests passed (`backend/test_chunked_analysis.py`)

2. **Collapsible Sidebar** (Frontend)
   - Desktop: tombol toggle untuk full (240px) dan icon-only (64px)
   - Mobile: hamburger menu → drawer slide-in dengan overlay backdrop
   - Bottom navigation bar untuk mobile
   - Transisi smooth dengan `transition-all duration-300`

3. **AI Model Configuration Update**
   - **Recap (folder summary)**: now uses **Gemini** (`_call_gemini`) for higher quality synthesis
   - **Quiz generation**: now uses **Llama** via Groq (`llama-3.3-70b-versatile` by default)
   - **Quiz feedback & chat**: still uses Groq (Llama)
   - **PDF analysis**: still uses Gemini (unchanged)

### Modified Files

| File | Changes |
|------|---------|
| `backend/server.py` | Added chunked analysis helpers, fixed legacy async, changed `generate_recap` to use Gemini, changed default `GROQ_MODEL` to Llama3 70B |
| `frontend/src/components/AppLayout.jsx` | Added sidebar state + toggle + mobile drawer |
| `backend/test_chunked_analysis.py` | New unit tests |
| `backend/CHUNKED_ANALYSIS_IMPLEMENTATION.md` | New technical doc |
| `backend/CHUNKED_ANALYSIS_FLOW.md` | New flow diagrams |
| `README.md` | Updated with full documentation |

---

## 📋 Project Overview

EduAI adalah platform pembelajaran berbasis AI untuk analisis dokumen PDF dan generasi quiz HOTS (Higher Order Thinking Skills). Platform ini mendukung:

- **Authentication**: Supabase (email/password + Google OAuth)
- **Document Management**: Upload, organize, analyze PDF documents
- **AI Analysis**: Automatic extraction of concepts, diagrams, learning objectives
- **Quiz Generation**: HOTS questions based on document content
- **Detailed Feedback**: AI-powered grading with explanations and references
- **Study Materials**: AI-generated learning materials per subject
- **Social Features**: Friend system, document discussions

---

## 🏗️ Architecture

```
┌─────────────┐
│   Frontend  │ React 19 + React Router + Tailwind CSS
│  (Create    │ Port: 3010
│   React App)│
└──────┬──────┘
       │ HTTP + Bearer Token (Supabase)
       ▼
┌─────────────┐
│  Backend    │ FastAPI + MongoDB (Motor async)
│  (Uvicorn)  │ Port: 8000
│             │
│  server.py  │ Main entry point, all routes under /api
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  AI Models  │
│             │ • Gemini 2.5/3.0 Flash (PDF analysis, folder recap)
│             │ • Groq Llama 3.3 70B (quiz generation, feedback, chat)
│             │
└─────────────┘
```

---

## 📁 Project Structure

```
EduAI/
├── backend/
│   ├── server.py              # Main FastAPI application (2332 lines)
│   ├── requirements.txt        # Python dependencies
│   ├── test_chunked_analysis.py   # Unit tests for chunking logic
│   ├── CHUNKED_ANALYSIS_IMPLEMENTATION.md  # Detailed docs
│   ├── CHUNKED_ANALYSIS_FLOW.md        # Visual flow diagrams
│   └── tests/                 # Integration tests
│
├── frontend/
│   ├── src/
│   │   ├── pages/             # Route components
│   │   │   ├── Login.jsx
│   │   │   ├── SignUp.jsx
│   │   │   ├── AuthCallback.jsx
│   │   │   ├── Onboarding.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Documents.jsx
│   │   │   ├── DocumentDetail.jsx
│   │   │   ├── Quiz.jsx
│   │   │   ├── QuizResult.jsx
│   │   │   └── ...
│   │   ├── context/          # AuthContext.jsx
│   │   ├── lib/              # api.js, supabase.js, poll.js
│   │   └── components/       # Reusable UI components
│   ├── package.json
│   └── tailwind.config.js
│
├── api/                      # Legacy/alternative API
├── .env.example              # Environment variables template
├── vercel.json               # Vercel deployment config
└── README.md                # This file
```

---

## 🚀 Quick Start

### Prerequisites
- Python 3.10+
- Node.js 18+
- MongoDB (local or Atlas)
- Supabase project (auth + storage)
- Gemini API key
- Groq API key

### 1. Clone & Install

```bash
# Clone repository
cd "C:\Users\ganxa\Downloads\My Project\Eduai"

# Install all dependencies (root, frontend, backend)
npm run install:all
```

### 2. Environment Setup

```bash
# Backend (.env in backend/)
cd backend
cp .env.example .env

# Edit .env with your credentials:
MONGO_URL=mongodb+srv://<username>:<password>@<cluster>/<db>?retryWrites=true&w=majority
DB_NAME=eduscanner_ai
GEMINI_API_KEY=your_gemini_key
GEMINI_MODEL=gemini-2.5-flash
GEMINI_ANALYSIS_MODEL=gemini-2.5-flash
GROQ_API_KEY=your_groq_key
GROQ_MODEL=llama-3.3-70b-versatile  # or other Llama variant on Groq
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key
CORS_ORIGINS=http://localhost:3010,https://yourdomain.com
UPLOAD_DIR=./uploads
```

### 3. Run Development Servers

```bash
# From root directory (runs both backend + frontend concurrently)
npm run dev

# Or separately:
# Terminal 1 - Backend
npm run dev:backend

# Terminal 2 - Frontend
npm run dev:frontend
```

**Access**:
- Frontend: http://localhost:3010
- Backend API: http://localhost:8000/api
- API Docs: http://localhost:8000/docs (Swagger UI)

---

## 🔐 Authentication Flow

### Login Methods
1. **Email/Password** → Supabase Auth
2. **Google OAuth** → Supabase OAuth

### Backend Auth Validation
```
Frontend (supabase.auth.signIn...) 
    ↓
Supabase returns access_token
    ↓
Frontend calls /auth/session with token
    ↓
Backend validates token via Supabase API /auth/v1/user
    ↓
Backend fetches/creates local user in MongoDB
    ↓
Returns user profile + session
```

### Endpoints
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/auth/session` | POST | Exchange Supabase token for local session |
| `/auth/me` | GET | Get current user profile |
| `/auth/logout` | POST | Invalidate session |

---

## 📄 Document Upload & Analysis Pipeline

### Step-by-Step

```
1. User uploads PDF (frontend)
   └─> POST /documents/upload (multipart/form-data)
       
2. Backend saves file:
   ├─> Local: UPLOAD_DIR/{doc_id}.pdf
   ├─> MongoDB: pdf_files collection (Binary)
   └─> Supabase Storage (async background task)
   
3. Insert document record:
   └─> documents collection (status="processing")
   
4. Trigger background analysis:
   └─> _bg_analyze_document() in asyncio task
       
5. **Adaptive Chunked Analysis** (NEW):
   ├─> Count total pages via PdfReader
   ├─> If ≤4 pages → use legacy single-pass
   ├─> Else → chunked analysis:
   │   ├─> Determine chunk size (2/3/4/5 pages)
   │   ├─> Overlap 50% between batches
   │   ├─> Sequential batch processing
   │   ├─> Each batch: call Gemini (GEMINI_ANALYSIS_MODEL)
   │   └─> Extract: summary (50w), concepts (2-4), diagrams (≤1), objectives
   ├─> Merge results:
   │   ├─> Deduplicate concepts (normalized name)
   │   ├─> Merge diagrams (name+type)
   ├─> Synthesize final summary:
   │   ├─> If <300 words → concatenate
   │   └─> Else → LLM merge (GEMINI_MODEL)
   └─> Fallback: if concepts <5 and pages>10, rerun legacy + merge
   
6. Update document:
   └─> Set status="ready" with extracted data
```

### Analysis Output Schema

```python
{
  "title": "Document Title",
  "summary": "3-4 paragraphs (150-200 words) - synthesized from batches",
  "key_concepts": [
    {
      "concept": "Concept name",
      "explanation": "Detailed explanation (3-5 sentences)",
      "code_example": "Optional code snippet"
    },
    # ... up to 20 unique concepts
  ],
  "diagrams": [
    {
      "name": "Diagram title",
      "type": "flowchart|diagram|chart|graph",
      "explanation": "Step-by-step flow description"
    },
    # ... up to 10 unique diagrams
  ],
  "learning_objectives": [
    "Menganalisis ...",
    "Mengimplementasi ...",
    # ... up to 10 unique objectives
  ]
}
```

---

## 🖥️ UI/UX Features

### Responsive Sidebar

**Desktop**:
- Sidebar fixed/sticky on left, width 240px (w-60)
- Collapsible: click arrow button to toggle between full (240px) and icon-only (64px)
- In icon-only mode: labels hidden, icons centered
- User info section collapses to just notifications icon + logout icon

**Mobile**:
- Sidebar hidden by default; access via hamburger menu in top bar
- Sidebar slides in as overlay drawer (full height, fixed)
- Backdrop overlay closes sidebar when clicked
- Bottom navigation bar appears for quick access
- Auto-close on route change

**Technical Details** (AppLayout.jsx):
- State: `sidebarOpen` (desktop collapsed state), `mobileSidebarOpen` (mobile drawer)
- Transition: `transition-all duration-300` for smooth width/position changes
- Width classes: `w-60` (full) / `w-16` (collapsed) on desktop
- Mobile: `fixed inset-y-0 left-0` with `-translate-x-full` when closed, `translate-x-0` when open

### Theming
- Primary: `#1D2D50` (dark blue)
- Accent: `#E5A93C` (gold)
- Danger: `#B83A4B` (red)
- Background: `#F8F6F0` (cream paper texture)
- Text: `#1A1B26` (near black), `#646675` (muted gray)

---

## 🧠 AI Models Configuration

### Gemini (Google)
- **Purpose**: PDF analysis (document understanding), recap/folder summary synthesis
- **Models**:
  - `GEMINI_ANALYSIS_MODEL`: e.g., `gemini-2.5-flash` or `gemini-3-flash-preview` — for batch PDF extraction
  - `GEMINI_MODEL`: e.g., `gemini-2.5-flash` — for summary merging, chat
- **Why**: Large context window (1M tokens), excellent at understanding documents and synthesizing summaries
- **Used by**: `analyze_pdf()`, `generate_recap()`

### Groq (Llama)
- **Purpose**: Quiz generation, feedback generation, document chat, study materials
- **Model**: `llama-3.3-70b-versatile` (or any Llama variant supported by Groq)
- **Why**: Extremely low latency (~100ms), cost-effective, strong Indonesian language capability
- **Token limit**: TPM 6000 — token safety implemented in `_call_groq()`
- **Configure**: Set `GROQ_MODEL` environment variable to desired Llama model
- **Used by**: `generate_quiz_questions()`, `generate_deep_feedback()`, `generate_study_material()`, document chat endpoints

---

## 🧩 Adaptive Chunked Analysis (Core Feature)

### Why Chunking?
- **Problem**: Single-pass analysis truncates long PDFs (>30 pages)
- **Solution**: Split PDF into small batches (2-4 pages), analyze each separately, merge results
- **Benefit**: Every page gets attention, no context overflow, better accuracy

### Chunking Strategy

```python
# Adaptive sizes:
PDF ≤ 15 pages   → chunk = 2 pages
PDF 16-30 pages  → chunk = 3 pages
PDF 31-60 pages  → chunk = 4 pages
PDF > 60 pages   → chunk = 5 pages

# Overlap: 50% of chunk size
overlap = max(1, chunk_size // 2)

# Example: 40-page PDF → chunk=4, overlap=2
# Batches: [1-4], [3-6], [5-8], [7-10], ... [37-40]
```

### Implementation Files

**Main functions** (in `backend/server.py`):
- `analyze_pdf()` — orchestrator (lines 564-664)
- `_analyze_batch()` — single batch analyzer (lines 472-529)
- `_determine_chunk_size()` — adaptive size selector (392-400)
- `_extract_pages_text()` — page range extractor (403-410)
- `_deduplicate_concepts()` — deduplication logic (422-433)
- `_merge_diagrams()` — diagram merging (436-444)
- `_synthesize_summary_from_chunks()` — summary synthesis (447-469)
- `_analyze_pdf_legacy()` — fallback single-pass (532-561)

**Helper utilities**:
- `_normalize_concept_name()` — string normalization (413-419)
- `_call_gemini()` / `_call_groq()` — LLM wrappers (678-736, 442-461)
- `_parse_json_block()` — robust JSON extraction (474-507)

### Testing
```bash
cd backend
python test_chunked_analysis.py

# Expected output:
# [OK] _determine_chunk_size
# [OK] _normalize_concept_name
# [OK] _deduplicate_concepts
# [OK] _merge_diagrams
# [OK] _synthesize_summary_from_chunks
# All unit tests passed!
```

---

## 🧪 Quiz Pipeline

### Generation
```
User clicks "Mulai Kuis" on document
    ↓
POST /quiz/generate {document_id, question_count}
    ↓
Create quiz record (status="processing")
    ↓
Background task _bg_generate_quiz():
    ├─> Fetch document(s) metadata (summary, concepts, objectives)
    ├─> Token optimization: truncate per-doc to fit Groq 6K TPM limit
    ├─> Prompt Groq to generate n HOTS questions
    └─> Update quiz with questions array (status="ready")
```

### Taking Quiz
```
GET /quiz/{quiz_id} → display questions one-by-one
    ↓
User answers all questions
    ↓
POST /quiz/submit {quiz_id, answers: [selected_option_indexes]}
    ↓
Create quiz_result (status="processing")
    ↓
Background task _bg_grade_quiz():
    ├─> Call generate_deep_feedback() (Groq)
    ├─> Batch processing (5 questions per batch to avoid 413)
    ├─> For each batch: score + per-question feedback
    └─> Update quiz_result with score, items, summary (status="ready")
```

### Feedback Structure
```json
{
  "score": 85,
  "summary": "Overall performance paragraph...",
  "items": [
    {
      "question": "...",
      "selected": "User's answer text",
      "correct": "Correct answer text",
      "is_correct": true/false,
      "explanation": "Why correct/wrong with details",
      "references": ["Academic source 1", "Book name"]
    }
  ]
}
```

---

## 🗂️ Database Schema (MongoDB)

### Collections

| Collection | Purpose | Key Fields |
|------------|---------|------------|
| `users` | User profiles | `user_id`, `email`, `name`, `education_level`, `major`, `institution`, `subjects[]`, `schedule[]`, `onboarded` |
| `documents` | PDF metadata | `document_id`, `user_id`, `filename`, `title`, `summary`, `key_concepts[]`, `diagrams[]`, `status` ("processing"\|"ready"\|"failed"), `ai_generated` |
| `pdf_files` | Binary storage | `document_id`, `user_id`, `data` (Binary) |
| `quizzes` | Generated quizzes | `quiz_id`, `user_id`, `document_id`, `questions[]`, `status` |
| `quiz_results` | Quiz submissions | `result_id`, `quiz_id`, `user_id`, `answers[]`, `score`, `items[]`, `status` |
| `folders` | Document organization | `folder_id`, `user_id`, `name` |
| `study_materials` | AI-generated materials | `material_id`, `user_id`, `subject_id`, `topic`, `title`, `summary`, `key_concepts[]`, `study_notes`, `practice_questions[]` |
| `friend_requests` | Friend system | `friend_request_id`, `from_user_id`, `to_user_id`, `status` ("pending"\|"accepted"\|"rejected") |
| `discussion_messages` | Document discussions | `message_id`, `document_id`, `user_id`, `content` |
| `discussion_participants` | Discussion access | `document_id`, `user_id`, `invited_by` |
| `notifications` | User notifications | `notification_id`, `user_id`, `type`, `message`, `read` |
| `audit_logs` | Action logging | `log_id` (AUD-YYYYMMDD-NNNN), `user_id`, `action`, `details`, `timestamp` |

### Indexes (Implicit)
- `users.email` (unique)
- `users.user_id` (primary)
- `documents.document_id` + `user_id`
- `quizzes.quiz_id` + `user_id`
- `quiz_results.result_id` + `user_id`

---

## 🛠️ Configuration & Tuning

### Adaptive Chunking Parameters

Edit in `backend/server.py` (function `_determine_chunk_size`):

```python
def _determine_chunk_size(total_pages: int) -> int:
    if total_pages <= 15:      # threshold for small docs
        return 2
    elif total_pages <= 30:    # threshold for medium docs
        return 3
    elif total_pages <= 60:    # threshold for large docs
        return 4
    else:
        return 5
```

**Recommendations**:
-如果你的PDF很密集 (dense text) → lower thresholds (use smaller chunks)
-如果你的PDF是slides (few text per page) → current thresholds fine
- Kalau但ingin lebih agresif chunking → ubah `15` jadi `10`, `30` jadi `20`, etc.

### Overlap Ratio
```python
overlap = max(1, chunk_size // 2)  # line 574

# Increase to 75% overlap for tighter context:
overlap = max(1, int(chunk_size * 0.75))
```

### Result Caps
```python
unique_concepts = unique_concepts[:20]      # line 601
merged_diagrams = merged_diagrams[:10]      # line 604
unique_objectives = unique_objectives[:10]  # line 614
```

### Fallback Trigger
```python
if len(unique_concepts) < 5 and total_pages > 10:  # line 621
    # Run legacy analysis and merge
```
- **`<5`**: Minimum acceptable unique concepts
- **`>10`**: Only trigger fallback for larger docs (small docs always use legacy anyway)

---

## 📊 Token Management

### Groq (Llama) TPM Limit: 6000
Implemented in:
- `_call_groq()` (lines 730-749): truncates prompt if >8000 chars (~3000 tokens)
- Quiz generation: per-document budget capped at 1500-3000 chars
- Deep feedback: batch size = 5 questions per API call
- **Model**: `GROQ_MODEL` default `llama-3.3-70b-versatile` (configurable via env)

### Gemini Context Window: 1M tokens
- Batch analysis: each batch 2-4 pages → ~2000 tokens (safe)
- Summary merging: uses `GEMINI_MODEL` (cheaper, sufficient for text synthesis)

---

## 🧪 Testing

### Verification Commands

Run these after changes to verify everything works:

```bash
# 1. Backend syntax validation
cd backend && python -c "import ast; ast.parse(open('server.py').read())"

# 2. Unit tests (chunked analysis)
cd backend && python test_chunked_analysis.py
# Expected: [OK] for all 5 tests

# 3. Frontend build (catch compile errors)
cd frontend && npm run build

# 4. Start development servers
npm run dev
# Backend: http://localhost:8000
# Frontend: http://localhost:3010

# 5. Health check
curl http://localhost:8000/diag/gemini
# Should return gemini: {"ok": true, ...}, supabase: {"ok": true, ...}
```

### Verification Commands

```bash
# 1. Backend syntax validation
cd backend && python -c "import ast; ast.parse(open('server.py').read())"

# 2. Unit tests (chunked analysis)
cd backend && python test_chunked_analysis.py
# Expected: [OK] for all 5 tests

# 3. Frontend build (catch compile errors)
cd frontend && npm run build

# 4. Start development servers
npm run dev
# Backend: http://localhost:8000
# Frontend: http://localhost:3010

# 5. Backend health check
curl http://localhost:8000/diag/gemini
# Should return {"gemini": {"ok": true, ...}, "supabase": {"ok": true, ...}}
```

### Manual UI Test Checklist

```markdown
- [ ] Desktop (>768px): Click toggle button (◀/▶) in sidebar header → collapses to icons / expands
- [ ] Desktop (collapsed): Nav items centered, labels hidden, tooltip appears on hover
- [ ] Desktop (collapsed): User info shows only notifications icon, logout icon-only
- [ ] Mobile (<768px): Tap hamburger menu (☰) in top bar → sidebar drawer slides in
- [ ] Mobile: Tap backdrop overlay OR X button → drawer closes
- [ ] Mobile: Navigate using bottom tab bar → drawer auto-closes
- [ ] Responsive: Resize browser window → layout transitions smoothly
```

### Unit Tests (Backend)
```bash
cd backend
python test_chunked_analysis.py
```

### Integration Tests
```bash
cd backend
pytest tests/ -v
```

### Manual Testing Checklist

1. **Small PDF** (≤4 pages)
   - ✅ Uses legacy single-pass
   - ✅ Analysis completes
   - ✅ Concepts ≥7

2. **Medium PDF** (10-30 pages)
   - ✅ Chunk size = 2 or 3
   - ✅ Batch count correct (ceil division)
   - ✅ All batches processed
   - ✅ Deduplication works
   - ✅ Summary length ~150-200 words

3. **Large PDF** (>60 pages)
   - ✅ Chunk size = 5
   - ✅ No infinite loops
   - ✅ Total batches reasonable
   - ✅ Final concepts ≤20, not >20

4. **Fallback Trigger**
   - ✅ <5 concepts detected → rerun legacy
   - ✅ Results merged correctly

5. **Edge Cases**
   - ✅ Image-only PDF (no text) → document fails gracefully
   - ✅ Corrupted PDF → error logged, status="failed"
   - ✅ Cancel during analysis → status="cancelled" (checked by _bg_analyze_document)

---

## 🐛 Debugging & Monitoring

### Logs to Watch
```python
# In _analyze_batch:
logger.info(f"Analyzing batch {batch_idx+1}/{total_batches}: pages {start}-{end}")

# In _bg_analyze_document:
logger.info(f"Analysis complete: concepts={len(analysis.get('key_concepts',[]))}, pages={total_pages}, batches={batch_count}")

# On errors:
logger.warning(f"Batch ... gagal: {e}")
logger.exception("Background analyze gagal")
```

### Database Queries for Debug

```javascript
// Check analysis status
db.documents.find({"status": "processing"}).pretty()
db.documents.find({"status": "failed"}).pretty()

// See batch meta (if stored; currently not persisted but could be)
// To enable batch tracking, add field `analysis_meta` to documents

// Audit trail
db.audit_logs.find({"action": "DOCUMENT_ANALYZED"}).sort({"timestamp": -1}).limit(10)
```

### Health Check
```bash
# Backend diagnostics
curl http://localhost:8000/diag/gemini

# Response:
{
  "gemini": {"ok": true, "detail": "status=200", ...},
  "supabase": {"ok": true, ...}
}
```

---

## 🔄 Background Tasks

### Running Tasks
All heavy operations run as `asyncio.create_task()` in background:
- `_bg_analyze_document` — PDF analysis
- `_bg_generate_quiz` — Quiz generation
- `_bg_grade_quiz` — Quiz grading
- `_bg_generate_recap` — Multi-doc recap
- `_try_upload_supabase` — Storage redundancy

### Task Monitoring
Tasks are **fire-and-forget** but status tracked in DB:
- Check `status` field in `documents`, `quizzes`, `quiz_results`
- Cancel via dedicated endpoints: `/documents/{id}/cancel`, `/quiz/{id}/cancel`

---

## 📈 Performance

### Expected Latencies

| Operation | Small PDF (5p) | Medium PDF (20p) | Large PDF (60p) |
|-----------|---------------|-----------------|-----------------|
| Analysis | 10-15s | 30-60s | 90-180s |
| Quiz Gen  | 15-30s | 30-60s | - (single doc only) |
| Grading   | 20-40s | 20-40s | - |

### Optimizations Applied

1. **Chunked analysis** — prevents truncation, improves accuracy
2. **Token safety** — Groq inputs truncated at 8000 chars
3. **Overlap** — ensures context continuity (50%)
4. **Deduplication** — reduces concept count without losing info
5. **Fallback** — guarantees minimum quality threshold
6. **Sequential batch** — avoids rate limits (can parallelize later)

---

## 🚨 Known Issues & TODOs

### Immediate TODOs
- [ ] Migrate from deprecated `google.generativeai` to `google.genai`
- [ ] Add batch result caching (avoid re-analysis same PDF)
- [ ] Parallel batch processing with semaphore (2-3 concurrent)
- [ ] Store batch metadata in document record for debugging
- [ ] Add progress callback for frontend (WebSocket or polling)

### Future Features
- [ ] Embedding-based concept deduplication (semantic, not just string)
- [ ] Section-aware chunking (detect headers, split at boundaries)
- [ ] User feedback loop: "rate this concept extraction"
- [ ] Multi-language support (English, Mandarin)
- [ ] Export: PDF report, Anki cards

---

## 🆘 Troubleshooting

### "Analysis failed" or "timeout"
- Check Gemini API quota
- Verify `GEMINI_API_KEY` correct
- Large PDF may need longer timeout (increase in `_call_gemini`)

### "No concepts extracted"
- PDF might be image-only (no text layer)
- Check PDF text extraction manually:
  ```python
  from pypdf import PdfReader
  reader = PdfReader("file.pdf")
  print(len(reader.pages), "pages")
  print(reader.pages[0].extract_text()[:200])
  ```
- If text is minimal, chunk batches will be skipped

### "Rate limit exceeded" (Groq 429)
- Currently sequential batches avoid this
- If parallelized, add `asyncio.Semaphore(2)` to limit concurrency

### "Quiz generation hangs"
- Check Groq TPM limit (6000)
- Token truncation may cut important content — review `_generate_quiz_questions` token budgets

---

## 📚 Codebase Walkthrough (For AI Assistants)

### Entry Points
1. **Frontend entry**: `frontend/src/App.js` — Router setup, AuthProvider wrapper
2. **Backend entry**: `backend/server.py` line 58 — `app = FastAPI()`
3. **Auth**: `AuthContext.jsx` (frontend) + `/auth/session` (backend)
4. **Document upload**: `Documents.jsx` → `uploadDocument()` → POST `/documents/upload`
5. **Analysis**: `_bg_analyze_document()` → `analyze_pdf()` (chunked)

### Critical Paths

#### Document Analysis Path
```
frontend/src/pages/Documents.jsx (upload)
  → frontend/src/lib/api.js (uploadDocument)
  → backend/server.py:927 (upload_document endpoint)
  → saves file, inserts document record
  → asyncio.create_task(_bg_analyze_document)
      → analyze_pdf (chunked)
      → for each batch: _analyze_batch → _call_gemini
      → merge results
      → update documents collection
```

#### Quiz Flow Path
```
frontend/src/pages/DocumentDetail.jsx (startQuiz)
  → generateQuiz() in api.js
  → backend/server.py:1204 (quiz_generate)
  → creates quiz record (status=processing)
  → asyncio.create_task(_bg_generate_quiz)
      → generate_quiz_questions → _call_groq
      → update quiz with questions (status=ready)
  → frontend navigates to /kuis/:id
  → Quiz.jsx displays questions
  → submitQuiz() → POST /quiz/submit
  → creates quiz_result (status=processing)
  → asyncio.create_task(_bg_grade_quiz)
      → generate_deep_feedback (batch 5 questions)
      → update quiz_result (status=ready)
  → navigate to /hasil/:id (QuizResult.jsx)
```

### Important Utilities
- `_call_gemini()` — wraps Google Gemini with file upload support
- `_call_groq()` — wraps Groq API with token truncation
- `_parse_json_block()` — robust JSON extraction from LLM markdown response
- `_audience()` — builds audience description string from User object for LLM prompting
- `write_audit()` — audit logging to `audit_logs` collection

---

## 🎯 Key Decisions

| Decision | Rationale |
|----------|-----------|
| **Chunked analysis for >4 pages** | Prevents truncation, better accuracy for long docs |
| **50% overlap** | Ensures context continuity between batches |
| **Sequential batch processing** | Avoids API rate limits, preserves order (important for synthesis) |
| **Deduplication by normalized string** | Simple, fast, deterministic; good enough for concepts |
| **Fallback to legacy if <5 concepts** | Guarantees minimum quality threshold |
| **Cap results (20/10/10)** | Prevents overwhelming frontend, maintains response size |
| **Gemini for PDF analysis & recap** | High-quality extraction + synthesis for documents and folder summaries |
| **Groq (Llama) for quiz/feedback** | Faster (100ms), cost-effective, strong performance on structured tasks |
| **Collapsible sidebar** | Better UX — users can expand to see labels or collapse for more screen space |
| **Mobile drawer + bottom nav** | Mobile-friendly navigation pattern |

---

## 📖 References

### External Docs
- [Supabase Auth Docs](https://supabase.com/docs/guides/auth)
- [FastAPI](https://fastapi.tiangolo.com/)
- [pypdf Documentation](https://pypdf.readthedocs.io/)
- [Google Gemini API](https://ai.google.dev/)
- [Groq API](https://console.groq.com/docs)

### Internal Docs
- `backend/CHUNKED_ANALYSIS_IMPLEMENTATION.md` — full technical spec
- `backend/CHUNKED_ANALYSIS_FLOW.md` — visual flowcharts and data structures
- `backend/server.py` — all backend logic

---

## 🧑‍💻 Contributing (For AI Assistants)

When modifying this codebase:

1. **Read this README first** — understand the chunked analysis pipeline
2. **Check server.py lines 390-664** — see implementation details
3. **Run unit tests** before committing:
   ```bash
   cd backend && python test_chunked_analysis.py
   ```
4. **Validate syntax**:
   ```bash
   python -c "import ast; ast.parse(open('server.py').read())"
   ```
5. **Preserve fallback logic** — never remove `_analyze_pdf_legacy`
6. **Respect token limits** — Groq TPM 6000, Gemini context 1M but batch efficiency
7. **Log batch operations** — for debugging, include page ranges in logs
8. **Test edge cases**:
   - Empty PDF (0 pages) — should fail gracefully
   - Image-only PDF — batches skipped
   - Very large PDF (100+ pages) — ensure no infinite loops

### Code Style
- Python 3.10+ type hints where possible
- Async/await for all I/O operations
- Logging via `logger` (not print)
- Error handling: log warning, continue if batch fails
- No blocking calls in async functions (use `asyncio.to_thread`)

---

## 📄 License & Contact

**Project**: EduAI - Educational Assistant with AI  
**Status**: Active Development  
**Maintainer**: [Your Name/Team]

For questions about the chunked analysis implementation, refer to:
- `backend/CHUNKED_ANALYSIS_IMPLEMENTATION.md`
- `backend/CHUNKED_ANALYSIS_FLOW.md`

---

**Last updated**: 2026-05-13  
**Implementation**: Adaptive Chunked PDF Analysis (v2.0)
