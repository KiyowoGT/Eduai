---
name: cross-platform-dev
description: Make CRA/craco dev scripts work on both Windows and Linux by moving inline env vars to .env files and removing OS-specific flags
source: auto-skill
extracted_at: '2026-06-30T13:45:00.000Z'
---

## Problem
`PORT=3010 BROWSER=none craco start` in `package.json` scripts is Linux-only syntax. On Windows: `'PORT' is not recognized as an internal or external command`.

Similarly, `pip install --break-system-packages` is a Linux-only flag (PEP 668, absent on Windows Python).

## Detection
- `"PORT=3010 BROWSER=none"` inline in any `"scripts"` value in `package.json`
- `--break-system-packages` in any `pip install` command
- `bash` hardcoded in scripts meant to run cross-platform

## Fix: `.env` file approach (zero new dependencies)

### Step 1: Create or update `frontend/.env`
```env
PORT=3010
BROWSER=none
```
CRA/craco reads `.env` automatically. No `cross-env` needed. **Append** to existing `.env` if Supabase/backend config already present.

### Step 2: Simplify `frontend/package.json` scripts
```jsonc
// BEFORE (Linux-only)
"start": "PORT=3010 BROWSER=none craco start",
"dev": "PORT=3010 BROWSER=none craco start",

// AFTER (cross-platform)
"start": "craco start",
"dev": "craco start",
```

### Step 3: Remove `--break-system-packages` from pip commands
```jsonc
// BEFORE (Linux-only)
"postinstall": "cd ../backend && pip install --break-system-packages -r requirements.txt"

// AFTER (cross-platform)
"postinstall": "cd ../backend && pip install -r requirements.txt"
```
Apply to both `frontend/package.json` and root `package.json` postinstall scripts.

## Why `.env` over `cross-env`
- Zero new dependency
- CRA/craco has built-in `.env` support (reads on startup)
- `PORT` and `BROWSER` are CRA-recognized env vars
- Works identically on Windows, Linux, macOS

## Key rule
**Never** use `VAR=value command` syntax in `package.json` scripts. Always use `.env` files or `cross-env` package.

## When NOT to use this pattern
- CI/CD scripts that only run on Linux — keep inline env vars
- `deploy.sh` that targets a specific Linux server — no change needed
