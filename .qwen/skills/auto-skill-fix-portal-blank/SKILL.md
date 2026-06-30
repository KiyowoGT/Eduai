---
name: fix-portal-blank
description: Debug blank page on protected React routes (e.g. /portal) — missing imports, stale builds, 500s from Pydantic validation
source: auto-skill
extracted_at: '2026-06-30T12:05:47.616Z'
---

# Fix blank /portal page

A blank page on a React route (e.g. `/portal`) means the component crashed during render. Two common root causes:

1. **Missing import** in the JSX component — `ReferenceError: Loader2 is not defined` crashes React
2. **Stale production build** — `index.html` references old JS bundles after source changes

## Diagnostic flow

### 1. Check browser console / network tab
Open DevTools (F12) → Console tab. Look for:
- `ReferenceError: X is not defined` → **missing import** in the component file
- Blank page with no errors → stale build (assets mismatch)

### 2. If missing import (most common for `/portal`)
Check the page component (e.g. `frontend/src/pages/PortalMandiri.jsx`):
```
grep "FileText.*lucide-react" frontend/src/pages/PortalMandiri.jsx
```
If a lucide-react icon (e.g. `Loader2`) is used in JSX but not imported, add it:

```diff
import {
  ArrowLeft, ChevronLeft, ChevronRight, BookOpen, Award, Code,
-  FileText, Check, X, BookMarked, GraduationCap, Ticket
+  FileText, Check, X, BookMarked, GraduationCap, Ticket, Loader2
} from "lucide-react";
```

Then **rebuild and redeploy** (steps 3–5 below).

### 3. Verify Asset Consistency
Check `blue/index.html` or `green/index.html` — compare hashed filenames against `static/js/` content. If assets are stale, proceed to rebuild.

### 4. Rebuild Frontend
```
cd frontend
npm run build
```

### 5. Deploy to both Blue/Green
```
cp -r frontend/build/* blue/
cp -r frontend/build/* green/
```

### 6. Update Live Pointer
Ensure `current_live.txt` points to the active build (e.g., `green`).

### 7. Restart Backend (if needed)
Backend serves static files; a restart clears file-system-level caching of stale builds. Not always needed — `FrontendMiddleware` reads `current_live.txt` per request.

## Key files
- `frontend/src/pages/PortalMandiri.jsx` — page component, watch for lucide-react imports
- `frontend/src/App.js` — route definition `<Route path="/portal" element={<PortalMandiri />}>`
- `green/` / `blue/` — production build folders
- `current_live.txt` — tracks which env is live
- `backend/server.py` — `FrontendMiddleware` serves static files
