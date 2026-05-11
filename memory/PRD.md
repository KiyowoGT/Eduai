# EduScanner AI - Edisi Pelajar & Mahasiswa - PRD

## Original Problem Statement
EduScanner AI — Asisten akademik AI berbasis Gemini 3 Pro untuk pelajar/mahasiswa Indonesia (SD, SMP, SMA, SMK, MA, Universitas). Fitur:
- Profil cascading (Jenjang → Jurusan → Kelas/Semester); SD/SMP tanpa jurusan
- Upload PDF jurnal/modul → AI ekstrak abstraksi, ringkasan, peta konsep, diagram teknis
- Sesi Kuis HOTS (multiple choice) yang adaptif terhadap jenjang & jurusan
- Deep Feedback dengan referensi akademik / buku pelajaran
- Audit log AUD-YYYYMMDD-NNNN
- Bahasa Indonesia full

## Tech Stack
- Backend: FastAPI + MongoDB (Motor) + emergentintegrations (Gemini 3 Pro & 3 Flash)
- Frontend: React 19 + Tailwind + shadcn/ui + sonner
- Auth: Emergent-managed Google OAuth (cookie session 7 hari)
- Theme: Scholarly Editorial (paper #F8F6F0, ink #1A1B26, brand #1D2D50, maroon #B83A4B, gold #E5A93C)
- Fonts: EB Garamond (heading) · Outfit (body) · JetBrains Mono (log/code)

## Architecture
- Long-running Gemini calls offloaded to worker threads via `asyncio.to_thread(_sync_run, ...)` to avoid 502 ingress timeouts.
- Polling pattern: upload/quiz/submit return immediately with `status='processing'`; clients poll until `status='ready'`.
- Audit counter via atomic `$inc` on counters collection — concurrency-safe AUD ID.

## Implemented (Feb 2026)
- [x] Landing page (hero + features + Google login CTA)
- [x] Emergent Google OAuth (login → callback → onboarding/dashboard; cookie + Bearer fallback)
- [x] Onboarding cascading dropdown (Jenjang → Jurusan opsional → Sekolah/Universitas → Kelas/Semester)
- [x] Dashboard (stats: docs, kuis, avg score; PDF dropzone; recent docs)
- [x] PDF upload + Gemini 3 Pro analysis (summary, key_concepts, diagrams, learning_objectives)
- [x] Document detail (tab Ringkasan, Peta Konsep with code examples, Diagram)
- [x] Quiz generation (HOTS multiple choice via Gemini 3 Flash, hidden correct_index)
- [x] Quiz taking UI (progress bar, A-D selection, animated transitions)
- [x] Deep Feedback (per-question explanation + academic references, score 0-100)
- [x] Audit log page (AUD-YYYYMMDD-NNNN, JetBrains Mono table)
- [x] Profile editor (re-edit jenjang/jurusan/kelas)
- [x] Documents library

## Tested (19/19 backend pytest cases passing — iteration_3.json)
- Auth flow, profile (SD no major + Universitas with major), upload+poll, quiz gen+poll, quiz submit+poll, audit log format, progress aggregate, logout, 401/404/400 edge cases, _id exclusion.

## Prioritized Backlog (post-MVP)
**P1 — Quality of Life**
- Riwayat hasil kuis di Dashboard (link ke /hasil/:id)
- Fallback model otomatis untuk quiz/feedback (sekarang hanya analyze_pdf)
- Validasi panjang `answers` array di QuizSubmission
- Single retry on malformed JSON dari Gemini

**P2 — Conversion / Growth**
- Mode "Belajar Dulu" interaktif (reactflow concept map visual)
- Sharing hasil kuis ke teman (link publik dengan slug)
- Leaderboard per institusi/prodi
- Streak harian + badge gamification

**P3 — Scale**
- Pisah server.py jadi routers (auth/profile/documents/quiz/audit) + services/llm.py
- Background queue (Celery/arq) ganti asyncio.to_thread untuk skala
- Cache referensi akademik dari web search

## Key Files
- `/app/backend/server.py` — semua endpoint
- `/app/backend/.env` — EMERGENT_LLM_KEY
- `/app/frontend/src/App.js` — routing
- `/app/frontend/src/lib/api.js` — axios client + helpers
- `/app/frontend/src/lib/poll.js` — polling helper
- `/app/frontend/src/lib/education.js` — jenjang/jurusan/kelas dataset
- `/app/frontend/src/pages/*` — Landing, AuthCallback, Onboarding, Dashboard, Documents, DocumentDetail, Quiz, QuizResult, AuditLog, Profile
- `/app/design_guidelines.json` — Scholarly Editorial design system
- `/app/memory/test_credentials.md` — testing notes (Google OAuth only)
