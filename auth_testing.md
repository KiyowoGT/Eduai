# EduScanner AI — Auth Testing Playbook

## Background
- Auth: Emergent-managed Google OAuth
- Backend session storage: MongoDB `user_sessions` collection
- Cookie: `session_token` (httpOnly, secure, samesite=none)
- All routes prefixed `/api`

## Step 1: Create test user + session (mongosh)
```js
use('test_database');
var userId = 'test-user-' + Date.now();
var sessionToken = 'test_session_' + Date.now();
db.users.insertOne({
  user_id: userId,
  email: 'test.student.' + Date.now() + '@example.com',
  name: 'Budi Test',
  picture: null,
  education_level: 'Universitas',
  major: 'Informatika / Ilmu Komputer',
  institution: 'UBSI',
  current_semester: 4,
  onboarded: true,
  created_at: new Date().toISOString()
});
db.user_sessions.insertOne({
  user_id: userId,
  session_token: sessionToken,
  expires_at: new Date(Date.now() + 7*24*60*60*1000).toISOString(),
  created_at: new Date().toISOString()
});
print('TOKEN:' + sessionToken);
```

## Step 2: Test backend via curl
```bash
TOKEN=<your_session_token>
BASE=$REACT_APP_BACKEND_URL  # from /app/frontend/.env

# /api/auth/me
curl -s -H "Authorization: Bearer $TOKEN" "$BASE/api/auth/me"

# /api/progress
curl -s -H "Authorization: Bearer $TOKEN" "$BASE/api/progress"

# /api/documents
curl -s -H "Authorization: Bearer $TOKEN" "$BASE/api/documents"
```

## Step 3: Browser cookie
```python
await page.context.add_cookies([{
    "name": "session_token",
    "value": "<token>",
    "domain": "<host without https>",
    "path": "/",
    "httpOnly": True, "secure": True, "sameSite": "None"
}])
```

## Auth-gated routes
- /dashboard, /dokumen, /dokumen/:id, /kuis/:id, /hasil/:id, /audit-log, /profil
- /onboarding (requires user but not onboarded)
