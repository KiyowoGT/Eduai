---
name: start-dev-stack
description: Start EduAI local dev stack (Kafka, backend, ngrok) and fix common connection issues
source: auto-skill
extracted_at: '2026-06-29T16:59:37.178Z'
---

# Start EduAI Local Dev Stack

## Services to start
1. **Kafka** (via Docker Compose)
2. **FastAPI Backend** (uvicorn on port 8000)
3. **ngrok** tunnel to backend (port 8000)

## Procedure

### 1. Start Kafka + UI + topic initializer
```bash
docker compose up -d kafka kafka-init kafka-ui
```
- Kafka broker: `localhost:9092` (internal), `localhost:9094` (external/host)
- Kafka UI: `http://localhost:8090`

### 2. Create missing Kafka topics (init script has bash escaping bug)
```bash
docker compose exec kafka kafka-topics.sh --bootstrap-server localhost:9092 --create --if-not-exists --topic eduai.document.analyze --partitions 3 --replication-factor 1
docker compose exec kafka kafka-topics.sh --bootstrap-server localhost:9092 --create --if-not-exists --topic eduai.quiz.generate --partitions 3 --replication-factor 1
docker compose exec kafka kafka-topics.sh --bootstrap-server localhost:9092 --create --if-not-exists --topic eduai.quiz.grade --partitions 3 --replication-factor 1
docker compose exec kafka kafka-topics.sh --bootstrap-server localhost:9092 --create --if-not-exists --topic eduai.recap.generate --partitions 3 --replication-factor 1
docker compose exec kafka kafka-topics.sh --bootstrap-server localhost:9092 --create --if-not-exists --topic eduai.music.generate --partitions 3 --replication-factor 1
docker compose exec kafka kafka-topics.sh --bootstrap-server localhost:9092 --create --if-not-exists --topic eduai.chat.respond --partitions 3 --replication-factor 1
docker compose exec kafka kafka-topics.sh --bootstrap-server localhost:9092 --create --if-not-exists --topic eduai.quiz.grade.student --partitions 3 --replication-factor 1
docker compose exec kafka kafka-topics.sh --bootstrap-server localhost:9092 --create --if-not-exists --topic eduai.quiz.auto-publish --partitions 3 --replication-factor 1
docker compose exec kafka kafka-topics.sh --bootstrap-server localhost:9092 --create --if-not-exists --topic eduai.storage.upload --partitions 3 --replication-factor 1
docker compose exec kafka kafka-topics.sh --bootstrap-server localhost:9092 --create --if-not-exists --topic eduai.tasks.cleanup --partitions 3 --replication-factor 1
docker compose exec kafka kafka-topics.sh --bootstrap-server localhost:9092 --create --if-not-exists --topic eduai.dlq --partitions 3 --replication-factor 1
```

### 3. Start backend (adjust Kafka bootstrap server in code first)
**File**: `backend/core/kafka.py`
```python
KAFKA_BOOTSTRAP_SERVERS = os.environ.get("KAFKA_BOOTSTRAP_SERVERS", "localhost:9094")  # NOT 9092
```
Then run:
```bash
cd backend && python -m uvicorn server:app --reload --host 127.0.0.1 --port 8000
```

### 4. Start ngrok tunnel
```bash
ngrok http 8000
```
Get public URL from `http://localhost:4040/api/tunnels`

## Verification
```bash
# Kafka health
curl http://127.0.0.1:8000/api/diag/kafka
# Should return: "producer_alive": true, "broker_connected": true

# Backend serving frontend
curl http://127.0.0.1:8000/
```

## No Kafka / Docker not available
When Docker isn't running or Kafka isn't needed, disable Kafka via `backend/.env` file:
```powershell
cd C:\Users\ganxa\Downloads\My Project\Eduai\backend
```
**CRITICAL**: Edit `backend/.env` and set `KAFKA_ENABLED=false`. python-dotenv loads `.env` at import time, so shell env vars (`$env:KAFKA_ENABLED='false'` or `set KAFKA_ENABLED=false`) are **overridden** by the `.env` file. Only editing the file works.
```powershell
python -m uvicorn server:app --port 8002 --host 0.0.0.0
```
Backend will skip Kafka producer/consumer startup entirely. AI jobs fall back to inline execution.

## Start backend (must run from `backend/` directory)
**Critical**: Must `cd backend` first — running `uvicorn backend.server:app` from project root fails with `ModuleNotFoundError: No module named 'core'`. Backend imports use relative paths (`from core.config import ...`).
```bash
cd backend && python -m uvicorn server:app --port 8002 --host 0.0.0.0
```

## Start ngrok tunnel (point to actual running port)
```bash
ngrok http 8002
```
> **Note**: `--host-header` is deprecated in newer ngrok versions. Don't use it.
Get public URL from `python get_tunnels.py` or `http://localhost:4040/api/tunnels`

## Common Issues
| Issue | Fix |
|-------|-----|
| Topics missing | Run topic creation commands above |
| Backend `getaddrinfo failed` for `kafka:9092` | Change `KAFKA_BOOTSTRAP_SERVERS` to `localhost:9094` (external listener) |
| ngrok not showing URL | Check `http://localhost:4040/api/tunnels` |
| Port 8000 ghost processes (can't kill PID) | Windows ghost socket — use different port (e.g. 8002). `Get-NetTCPConnection -LocalPort 8000` shows phantom PID that `tasklist` can't find. Don't waste time trying to kill it. |
| `ModuleNotFoundError: No module named 'core'` | Must `cd backend` before running uvicorn. Cannot use `uvicorn backend.server:app` from project root. |
| Kafka loops flood startup logs | Edit `backend/.env` → `KAFKA_ENABLED=false` (shell env vars won't work — python-dotenv overrides them) |
| 500 error on `/auth/me` | Check Pydantic validation failure. MongoDB docs may have stale fields violating `model_validator` in `backend/models/user.py`. Auto-clean fields instead of raising `ValueError`. |