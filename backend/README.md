---
title: EduAI Backend
emoji: 🎓
colorFrom: blue
colorTo: green
sdk: docker
pinned: false
short_description: EduScanner AI FastAPI backend
---

# EduAI Backend

FastAPI backend for EduScanner AI.

## Environment Variables (Set as HF Space Secrets)

| Variable | Description |
|---|---|
| `MONGO_URL` | MongoDB connection string |
| `DB_NAME` | Database name (default: `eduscanner_ai`) |
| `GEMINI_API_KEYS` | Comma-separated Gemini API keys |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anon key |
| `CORS_ORIGINS` | Comma-separated allowed origins (include your Vercel URL) |

## Local Dev

```bash
python -m uvicorn server:app --reload --port 8000
```
