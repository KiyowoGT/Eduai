---
name: fix-onboarding-payload
description: Debug and fix onboarding form submission failures caused by frontend-backend payload mismatch
source: auto-skill
extracted_at: '2026-06-30T00:00:00.000Z'
---

# Fix Onboarding Payload Mismatches

## Symptoms
- Onboarding form submits but redirects to landing page instead of dashboard
- User data not persisted (role, onboarded flag missing)
- Backend returns 422 validation error

## Root Causes (check in order)

### 1. Wrong API endpoint
Frontend calls `updateProfile` (PUT /profile) instead of `onboardingComplete` (POST /onboarding/complete).
- `updateProfile` does NOT set `role` or `onboarded: true`
- Fix: Change submit handler to call `onboardingComplete(payload)` for both roles

### 2. Payload fields don't match Pydantic model
Frontend sends fields that `OnboardingCompletePayload` doesn't accept (e.g. `full_name`, `identity_number`).
- Check `backend/models/user.py` → `OnboardingCompletePayload` for accepted fields
- Check frontend `buildPayload()` output matches exactly

### 3. Missing fields in Pydantic model
Frontend sends extra fields (e.g. `hobby`, `music_genre`) not in the backend model.
- Add missing fields to `OnboardingCompletePayload`
- Add handling in `backend/routers/auth.py` → `onboarding_complete` endpoint

## Field Mapping Reference (pengajar)

| Frontend field | Backend `OnboardingCompletePayload` field | Notes |
|---|---|---|
| `instituteType === "mandiri"` | `account_type: "pribadi"` | Guru mandiri |
| `instituteType === "institut"` | `account_type: "perusahaan"` | Staff at institution |
| `identityNumber` (institut) | `staff_passcode` | Passcode to join institution |
| `username` (mandiri) | `username` | Display username |

## Field Mapping Reference (pelajar)

| Frontend field | Backend field | Notes |
|---|---|---|
| `level` | `education_level` | SD/SMP/SMA/SMK/MA/MAK |
| `grade` | `current_semester` | Grade number |
| `major` | `major` | Only if SMA/SMK/MA |
| `institution` | `institution` | School name |
| `hobby` | `hobby` | Added to payload model |
| `musicGenre` | `music_genre` | Added to payload model |

## Procedure

### Step 1: Identify the failing path
Read `frontend/src/pages/Onboarding.jsx` → `submit()` function. Trace which API call is made for each role.

### Step 2: Compare payload to schema
Read `backend/models/user.py` → `OnboardingCompletePayload`. Ensure frontend `buildPayload()` returns only accepted fields.

### Step 3: Fix frontend payload
Update `buildPayload()` to map form state to correct backend fields:
```js
// pengajar mandiri
{ role: "pengajar", account_type: "pribadi", username: username.trim() }
// pengajar institut
{ role: "pengajar", account_type: "perusahaan", staff_passcode: identityNumber.trim(), institution: institution.trim() }
// pelajar mandiri
{ role: "pelajar", education_level, major, institution, current_semester, hobby, music_genre }
```

### Step 4: Fix submit handler
Ensure `submit()` calls `onboardingComplete(payload)` for BOTH roles, not `updateProfile`.

### Step 5: Update backend if needed
If frontend sends fields not in `OnboardingCompletePayload`:
1. Add fields to `OnboardingCompletePayload` in `backend/models/user.py`
2. Add handling in `backend/routers/auth.py` → `onboarding_complete()` under the correct role branch
3. Ensure the `User` model also has the fields for MongoDB persistence

## Verification
1. Select "pengajar" role in onboarding
2. Choose "mandiri" or "institut" account type
3. Submit form
4. Confirm redirect to `/dashboard` (not landing page)
5. Confirm `user.role === "pengajar"` and `user.onboarded === true` in context
