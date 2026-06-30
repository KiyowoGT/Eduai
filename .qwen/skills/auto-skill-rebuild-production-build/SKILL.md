---
name: rebuild-production-build
description: Fix stale UI changes by rebuilding the production build served via ngrok/static server
source: auto-skill
extracted_at: '2026-06-30T12:00:00.000Z'
---

## Problem
Source code changes (e.g. removing sidebar items, renaming labels) don't appear in the browser even after `grep` confirms the string is gone from `frontend/src/`. The app is served via ngrok tunneling to a **production build** in `blue/` (or `green/`), not the dev server.

## How to detect
1. `grep -r "removed-string" frontend/src/` → no matches → source is clean
2. `grep -r "removed-string" blue/` → match found → stale build is being served
3. Check `deploy.sh` and `current_live.txt` to confirm which folder is live

## Fix
```bash
# 1. Delete stale build
rm -rf blue/

# 2. Rebuild frontend
cd frontend && npm run build

# 3. Copy new build to blue/
cp -r frontend/build/* blue/
```

## Key files
- `deploy.sh` — blue/green deployment script
- `current_live.txt` — tracks which env is live ("blue" or "green")
- `blue/` and `green/` — production build folders at project root
- `frontend/package.json` — `"build": "craco build"`

## Gotcha
- Incognito mode does NOT help if the stale file is on the **server side** (the `blue/` folder)
- The dev server (`npm run dev`, port 3010) uses hot-reload and shows changes immediately, but ngrok may be tunneling to the static `blue/` folder instead
- Always rebuild AND copy after source changes when serving from `blue/` or `green/`
