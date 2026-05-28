# Role: Admin / System Operator

Summary: Admin mengelola tenants, audit logs, system settings, API keys, model quotas, and user management.

Primary Use Cases
1. Tenant & User Management
   - Pre: admin privileges
   - Main Flow: create/update users & institutions → POST/PUT /api/admin/users
   - Post: users created with roles

2. API Keys & Model Quotas
   - Main Flow: configure GEMINI/GROQ keys in env or admin settings → monitor usage
   - Post: quotas enforced; alerts if exceeded

3. Audit & Logs
   - Main Flow: GET /api/admin/audit?range → review actions
   - Post: export logs for compliance

4. System Maintenance
   - Main Flow: trigger re-analysis, clear caches, run background tasks

Mapping:
- Frontend admin pages under pages/admin/*
- Backend admin endpoints under /api/admin/*

Notes: High-risk operations require 2FA and audit trail.