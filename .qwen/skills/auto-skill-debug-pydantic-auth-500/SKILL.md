---
name: debug-pydantic-auth-500
description: Debug and fix 500 errors during Supabase auth callback caused by Pydantic model validation failures in FastAPI get_current_user dependency
source: auto-skill
extracted_at: '2026-06-30T05:12:06.103Z'
---

# Debug FastAPI Auth 500 from Pydantic Validation Failure

## Problem
User sees "Network Error" / 500 on auth callback (`GET /api/auth/me`). Backend logs show no stack trace — only `Response status: 500` or generic error. Root cause: `get_current_user` dependency catches `ValidationError` from `User(**user_doc)` and wraps it as `HTTPException(500, f"Data profil tidak valid: {str(e)}")`.

## Root Cause Pattern
MongoDB documents have **stale or inconsistent fields** that violate Pydantic `model_validator` rules. Common in this codebase:
- `account_type == "pribadi"` but `title` / `titles` still set (legacy data, or set via `active_role` during portal switching)
- Enum values stored as strings that no longer match current `TeacherTitle` / `UserRole` / `AccountType` enums
- Required fields missing after role/account type changes

## Debugging Procedure

### 1. Enable verbose validation error logging
In `backend/deps/auth.py`, find the `try/except ValidationError` block in `get_current_user`:
```python
try:
    return User(**user_doc)
except ValidationError as e:
    logger.error(f"User validation error (session): {e.json()}")  # Already there
    raise HTTPException(500, f"Data profil tidak valid: {str(e)}")
```
**Add temporary debug**: Print the raw `user_doc` before `User(**user_doc)` to see exactly what's in MongoDB.

### 2. Check the specific validator
Read `backend/models/user.py` → `User` model → `@model_validator(mode="after")` → `check_title_fields`.
- Does it raise `ValueError` on invalid combos?
- Does it auto-clean (preferred) or hard-fail?

### 3. Fix the validator to auto-clean instead of raising
**Before (causes 500):**
```python
if self.account_type == AccountType.pribadi:
    if self.title is not None or (self.titles and len(self.titles) > 0):
        raise ValueError("Guru mandiri (akun pribadi) tidak boleh memiliki sub-role (title)")
```

**After (auto-clean, no 500):**
```python
if self.account_type == AccountType.pribadi:
    self.title = None
    self.titles = []
    return self
```

### 4. Verify fix
1. Restart backend
2. Trigger auth callback again
3. Should return 200 with user data, or 401 if token invalid (not 500)

## Prevention
- **Self-heal in deps**: `backend/deps/auth.py` already has `_ensure_teacher_scopes()` and `_apply_active_context()` that mutate `user_doc` before validation. Add similar cleanup for `account_type="pribadi"` title fields.
- **Schema migrations**: When changing enum values or required fields, write a MongoDB migration script.
- **Validator design rule**: In `model_validator(mode="after")`, prefer **auto-correction** (`self.field = corrected_value`) over `raise ValueError`. Only raise for truly unrecoverable data corruption.

## Key Files
| File | Role |
|------|------|
| `backend/deps/auth.py` | `get_current_user` dependency — catches `ValidationError` → 500 |
| `backend/models/user.py` | `User` model with `check_title_fields` validator |
| `backend/routers/auth.py` | `/auth/me` endpoint using `get_current_user` |

## Quick Verification Checklist
- [ ] `backend/.env` has `KAFKA_ENABLED=false` (Kafka loops can obscure the real error in logs)
- [ ] Backend running from `backend/` directory (not project root)
- [ ] Port not occupied by ghost process (use 8002 if 8000 is stuck)
- [ ] ngrok tunnel points to correct local port