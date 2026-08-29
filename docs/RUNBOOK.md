# AKADEMI Digital Campus — Operations Runbook

> **Version:** 1.0 — October 2026
> **Owner:** sugeng-riyanto
> **Repository:** https://github.com/sugeng-riyanto/mahardhika-lms

---

## 1. Architecture Overview

```
┌─────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  Frontend    │────▶│  Backend API     │────▶│  Supabase        │
│  (Vercel)    │     │  (Railway)       │     │  PostgreSQL + Auth│
│  React/Vite  │     │  Django REST     │     │  + Storage       │
└─────────────┘     └──────────────────┘     └──────────────────┘
       │                    │
       ▼                    ▼
  Cloudflare CDN      Redis (Railway)
```

**Key URLs:**
- Frontend: `https://akademi.vercel.app` (production)
- Backend: `https://akademi-api.up.railway.app` (production)
- Database: `db.stfrztjpunetsekovlsk.supabase.co:5432/postgres` (pooled:6543)

---

## 2. Deployment Procedures

### 2.1 Frontend Deployment (Vercel)

**Trigger:** Push to `main` branch auto-deploys via Vercel GitHub integration.

**Manual deploy:**
```bash
cd frontend
vercel --prod
```

**Rollback:**
1. Go to Vercel Dashboard → Project → Deployments
2. Find the last working deployment
3. Click "..." → "Promote to Production"

### 2.2 Backend Deployment (Railway)

**Trigger:** Push to `main` branch auto-deploys via Railway GitHub integration.

**Manual deploy:**
```bash
railway up
```

**Rollback:**
1. Go to Railway Dashboard → Project → Deployments
2. Find the last working deployment
3. Click "Rollback to this version"

### 2.3 Database Migrations

```bash
# Apply migrations to production
cd backend
railway run python manage.py migrate --settings=config.settings

# Verify migration status
railway run python manage.py showmigrations
```

**Rollback migration:**
```bash
# Revert specific migration
railway run python manage.py migrate <app> <previous_migration> --settings=config.settings
```

---

## 3. Monitoring & Health Checks

### 3.1 Health Check Endpoints

| Endpoint | Expected Response | Frequency |
|----------|-------------------|-----------|
| `GET /api/v1/health/` | `{"status": "healthy"}` | Every 5 min (UptimeRobot) |
| `GET /` (frontend) | HTTP 200 | Every 5 min |

### 3.2 Error Tracking (Sentry)

- Frontend: `VITE_SENTRY_DSN` env var
- Backend: `SENTRY_DSN` env var
- Alert threshold: > 5 errors in 5 minutes

### 3.3 Log Access

```bash
# Railway backend logs
railway logs

# Vercel frontend logs
vercel logs
```

---

## 4. Incident Response

### 4.1 Service Down

| Step | Action | Time |
|------|--------|------|
| 1 | Check UptimeRobot alerts | 0 min |
| 2 | Verify Supabase status: https://status.supabase.com | 2 min |
| 3 | Check Railway status: https://status.railway.app | 2 min |
| 4 | Check Vercel status: https://www.vercel-status.com | 2 min |
| 5 | If service-specific, rollback to last working deploy | 5 min |
| 6 | If database issue, check Supabase dashboard | 10 min |

### 4.2 Authentication Failure

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| All users can't log in | Supabase Auth down | Check status.supabase.com |
| One user can't log in | Account locked/disabled | Check auth.users in Supabase |
| JWT verification fails | Secret key mismatch | Verify SUPABASE_JWT_SECRET |
| 401 on all API calls | Token expired/invalid | Clear localStorage, re-login |

### 4.3 RBAC / Permission Error

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| 403 on valid endpoint | Role not assigned | Check user_roles table |
| Wrong sidebar items | Frontend roles empty | Check /api/v1/auth/me/ response |
| Cross-role data leak | RLS policy missing | Check pg_policies for table |

### 4.4 Database Issues

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| Connection timeout | Pool exhaustion | Check active connections in Supabase |
| Slow queries | Missing index | Run `EXPLAIN ANALYZE` on query |
| Migration failure | Conflict with existing schema | Check migration dependencies |

---

## 5. Backup & Restore

### 5.1 Automated Backup

Supabase provides daily automatic backups on Pro plan. Manual backup:

```bash
# Via Supabase Dashboard → Database → Backups → Create Backup
```

### 5.2 Manual Backup

```bash
# Dump database
pg_dump "$SUPABASE_DATABASE_URL" > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore database
psql "$SUPABASE_DATABASE_URL" < backup_20260825_120000.sql
```

### 5.3 Storage Backup

```bash
# List all files in storage buckets
supabase storage list content-library
supabase storage list submissions
supabase storage list canvas-exports
supabase storage list certificates
```

---

## 6. Maintenance Windows

### 6.1 Scheduled Maintenance

| Task | Frequency | Window | Duration |
|------|-----------|--------|----------|
| Database vacuum/analyze | Weekly | Sunday 02:00 WIB | 15 min |
| Dependency updates | Bi-weekly | Wednesday 10:00 WIB | 30 min |
| Security patches | As needed | ASAP | 15 min |
| Full test suite | Daily (CI) | Automated | 10 min |

### 6.2 Release Process

1. Create release branch: `git checkout -b release/v1.x.x`
2. Run full test suite: `npm test && cd backend && pytest`
3. Update CHANGELOG.md
4. Create PR → review → merge to main
5. Auto-deploy to staging → verify
6. Promote to production
7. Tag release: `git tag v1.x.x`

---

## 7. Key Contacts

| Role | Contact | Escalation |
|------|---------|------------|
| Technical Lead | sugeng-riyanto | First responder |
| Database Lead | — | Database issues |
| Security Lead | — | Security incidents |
| School Representative | — | UAT sign-off |

---

## 8. Emergency Procedures

### 8.1 Force Logout All Users

```bash
# Rotate Supabase JWT secret (invalidates all tokens)
# Supabase Dashboard → Settings → API → JWT Secret → Regenerate
```

### 8.2 Database Emergency Restore

```bash
# 1. Stop backend (Railway → Pause service)
# 2. Restore database from backup
# 3. Verify data integrity
# 4. Restart backend
```

### 8.3 Kill Switch

```bash
# If compromised, immediately:
# 1. Revoke all API keys in Supabase Dashboard
# 2. Disable email signups: Auth → Providers → Email → Disable
# 3. Pause Railway service
# 4. Set Vercel to maintenance mode
```

---

*This runbook is a living document. Update it as the infrastructure changes.*
