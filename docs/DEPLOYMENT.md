# AKADEMI Digital Campus — Deployment Guide

> **Free Tier Stack:** Cloudflare Pages (frontend) + Render (backend)
> **Total Cost:** $0/month
> **Limitations:** Render cold starts (30-50s), PostgreSQL expires after 30 days

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                  Cloudflare Pages                     │
│              (Frontend — React/Vite)                  │
│          Free: unlimited bandwidth, 500 builds/mo    │
│          https://akademi.pages.dev                   │
└──────────────────────┬──────────────────────────────┘
                       │ API calls
                       ▼
┌─────────────────────────────────────────────────────┐
│                    Render                             │
│              (Backend — Django)                       │
│          Free: 750 hrs/mo, 512MB RAM                 │
│          https://akademi-api.onrender.com            │
└──────────────────────┬──────────────────────────────┘
                       │ Database
                       ▼
┌─────────────────────────────────────────────────────┐
│              Supabase PostgreSQL                      │
│          (Already configured)                         │
│          Free: 500MB storage, 50K rows               │
│          db.stfrztjpunetsekovlsk.supabase.co         │
└─────────────────────────────────────────────────────┘
```

---

## Prerequisites

1. GitHub account (already have)
2. Cloudflare account (free) — https://dash.cloudflare.com/sign-up
3. Render account (free) — https://dashboard.render.com/register
4. Supabase project (already have) — https://supabase.com/dashboard

---

## Step 1: Deploy Backend to Render

### 1.1 Create Render Account
1. Go to https://dashboard.render.com/register
2. Sign up with GitHub
3. Authorize Render to access your repositories

### 1.2 Create Web Service
1. Click **"New +"** → **"Web Service"**
2. Connect your GitHub repo: `sugeng-riyanto/mahardhika-lms`
3. Configure:
   - **Name:** `akademi-api`
   - **Region:** Singapore (or closest)
   - **Branch:** `main`
   - **Root Directory:** `backend`
   - **Runtime:** Python 3
   - **Build Command:** `pip install -r requirements.txt && python manage.py collectstatic --noinput`
   - **Start Command:** `gunicorn config.wsgi:application --bind 0.0.0.0:$PORT`
   - **Plan:** Free

### 1.3 Set Environment Variables
In Render dashboard → Settings → Environment Variables:

| Key | Value |
|-----|-------|
| `PYTHON_VERSION` | `3.12` |
| `DJANGO_SETTINGS_MODULE` | `config.settings` |
| `DEBUG` | `False` |
| `DJANGO_SECRET_KEY` | *(generate random 64-char string)* |
| `DJANGO_ALLOWED_HOSTS` | `akademi-api.onrender.com` |
| `DJANGO_CORS_ALLOWED_ORIGINS` | `https://akademi.pages.dev,http://localhost:5173` |
| `DATABASE_URL` | *(from Supabase — see below)* |
| `SUPABASE_URL` | `https://stfrztjpunetsekovlsk.supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY` | *(your Supabase anon key)* |
| `SUPABASE_SECRET_KEY` | *(your Supabase service role key — keep secret!)* |
| `SUPABASE_JWKS_URL` | `https://stfrztjpunetsekovlsk.supabase.co/auth/v1/.well-known/jwks.json` |
| `EMAIL_PROVIDER` | `mock` |
| `WHATSAPP_PROVIDER` | `mock` |
| `PAYMENT_PROVIDER` | `mock` |
| `SEED_PASSWORD` | `dev-password-2026` |

### 1.4 Get DATABASE_URL from Supabase
1. Go to Supabase Dashboard → Settings → Database
2. Copy the **Connection string** → **URI** (Transaction mode)
3. Format: `postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres`
4. Paste as `DATABASE_URL` in Render

### 1.5 Deploy
1. Click **"Create Web Service"**
2. Wait for first deploy (~5 min)
3. Note your URL: `https://akademi-api.onrender.com`

### 1.6 Run Migrations
After first deploy, go to Render dashboard → Shell:

```bash
python manage.py migrate
python manage.py seed_data  # Optional: load sample data
```

---

## Step 2: Deploy Frontend to Cloudflare Pages

### 2.1 Create Cloudflare Account
1. Go to https://dash.cloudflare.com/sign-up
2. Sign up (free, no credit card)

### 2.2 Create Pages Project
1. Go to Cloudflare Dashboard → Workers & Pages → Create
2. Click **"Pages"** → **"Connect to Git"**
3. Select GitHub → `sugeng-riyanto/mahardhika-lms`
4. Configure:
   - **Project name:** `akademi`
   - **Production branch:** `main`
   - **Build command:** `cd frontend && npm install && npm run build`
   - **Build output directory:** `frontend/dist`

### 2.3 Set Environment Variables
In Cloudflare Pages → Settings → Environment Variables:

| Key | Value |
|-----|-------|
| `VITE_API_URL` | `https://akademi-api.onrender.com/api/v1` |
| `VITE_SUPABASE_URL` | `https://stfrztjpunetsekovlsk.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | *(your Supabase anon key)* |

### 2.4 Deploy
1. Click **"Save and Deploy"**
2. Wait for first build (~2 min)
3. Note your URL: `https://akademi.pages.dev`

### 2.5 Configure Custom Domain (Optional)
1. Go to Pages → Custom Domains
2. Add your domain (e.g., `akademi.example.com`)
3. Follow DNS instructions

---

## Step 3: Update CORS and Auth

### 3.1 Update Supabase Auth Redirect URLs
1. Go to Supabase Dashboard → Authentication → URL Configuration
2. Add to **Redirect URLs**:
   - `https://akademi.pages.dev/*`
   - `http://localhost:5173/*`

### 3.2 Update Django CORS
In Render environment variables, update:
```
DJANGO_CORS_ALLOWED_ORIGINS=https://akademi.pages.dev,http://localhost:5173
```

### 3.3 Update Django ALLOWED_HOSTS
```
DJANGO_ALLOWED_HOSTS=akademi-api.onrender.com,localhost,127.0.0.1
```

---

## Step 4: Verify Deployment

### 4.1 Test Backend
```bash
curl https://akademi-api.onrender.com/api/v1/health/
# Should return: {"status": "healthy"}
```

### 4.2 Test Frontend
1. Open https://akademi.pages.dev
2. Login with dev accounts:
   - `owner@mahardhika.id` / `dev-password-2026`
   - `admin@mahardhika.id` / `dev-password-2026`
   - `student@mahardhika.id` / `dev-password-2026`

### 4.3 Test RBAC
1. Login as each role
2. Verify sidebar shows correct nav items
3. Verify dashboards render correctly

---

## Free Tier Limitations

| Platform | Limitation | Impact | Mitigation |
|----------|-----------|--------|------------|
| **Render** | Cold start after 15min | First request takes 30-50s | Upgrade to Starter ($7/mo) |
| **Render** | 750 hours/month | ~31 days of continuous running | Monitor usage |
| **Render** | 512MB RAM | May be tight for Django | Optimize queries |
| **Cloudflare** | 500 builds/month | ~16 builds/day | Enough for CI/CD |
| **Cloudflare** | No server-side | API must be separate | Already using Render |
| **Supabase** | 500MB storage | File uploads limited | Upgrade if needed |

---

## Upgrade Path (When Budget Allows)

| Service | Free | Paid | Why Upgrade |
|---------|------|------|-------------|
| **Render** | $0 | $7/mo (Starter) | No cold starts, always-on |
| **Render DB** | $0 | $7/mo | PostgreSQL doesn't expire |
| **Cloudflare** | $0 | $20/mo (Pro) | More builds, analytics |
| **Vercel** | $0 | $20/mo (Pro) | Better DX, edge functions |
| **Railway** | $0 | $5/mo | Better than Render for Python |

**Recommended first upgrade:** Render Starter ($7/mo) — eliminates cold starts.

---

## Troubleshooting

### Backend won't start
1. Check Render logs: Dashboard → Logs
2. Common issues:
   - Missing `DATABASE_URL`
   - Wrong `DJANGO_SETTINGS_MODULE`
   - Migration not run

### Frontend shows blank page
1. Check Cloudflare Pages build logs
2. Verify `VITE_API_URL` is set correctly
3. Check browser console for CORS errors

### CORS errors
1. Ensure `DJANGO_CORS_ALLOWED_ORIGINS` includes your frontend URL
2. Ensure Supabase redirect URLs include your frontend URL

### Cold start too slow
1. Upgrade to Render Starter plan ($7/mo)
2. Or add a wake-up cron job (UptimeRobot pings every 5 min)

---

*This guide is for the free tier deployment. For production, see PRODUCTION_READINESS.md*
