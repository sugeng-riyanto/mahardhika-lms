# Staging Deployment Guide — Free Tier

## Overview

| Component | Service | Free Tier | URL |
|-----------|---------|-----------|-----|
| Frontend | Cloudflare Pages | 500 builds/mo, unlimited bandwidth | https://akademi.pages.dev |
| Backend | Render | 750 hrs/mo, cold start 30-50s | https://akademi-api.onrender.com |
| Database | Supabase (existing) | 500MB, 50K MAU | Already connected |

## Prerequisites

1. GitHub account with repo access
2. Cloudflare account (free)
3. Render account (free)
4. Supabase project (existing: `stfrztjpunetsekovlsk`)

## Step 1: Cloudflare Pages (Frontend)

### 1.1 Create Cloudflare Pages Project

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com)
2. Click **Workers & Pages** → **Create** → **Pages**
3. Connect to GitHub repo: `sugeng-riyanto/mahardhika-lms`
4. Configure:
   - **Production branch:** `main`
   - **Build command:** `cd frontend && npm install && npm run build`
   - **Build output directory:** `frontend/dist`
   - **Node.js version:** `20`
5. Click **Save and Deploy**

### 1.2 Set Environment Variables

In Cloudflare Dashboard → Pages → akademi → Settings → Environment variables:

| Variable | Value |
|----------|-------|
| `VITE_API_URL` | `/api/v1` |
| `VITE_SUPABASE_URL` | `https://stfrztjpunetsekovlsk.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Your Supabase anon key |

### 1.3 Configure Custom Domain (Optional)

1. In Pages → Custom domains
2. Add `akademi.pages.dev` or your domain
3. Update DNS records as shown

## Step 2: Render (Backend)

### 2.1 Create Render Web Service

1. Go to [render.com](https://render.com)
2. Click **New** → **Web Service**
3. Connect to GitHub repo: `sugeng-riyanto/mahardhika-lms`
4. Configure:
   - **Name:** `akademi-api`
   - **Region:** Singapore (or closest)
   - **Branch:** `main`
   - **Root directory:** `backend`
   - **Runtime:** Python 3
   - **Build command:** `pip install -r requirements.txt`
   - **Start command:** `gunicorn config.wsgi:application --bind 0.0.0.0:$PORT`
   - **Plan:** Free
5. Click **Create Web Service**

### 2.2 Set Environment Variables

In Render Dashboard → akademi-api → Environment:

| Variable | Value |
|----------|-------|
| `DJANGO_SETTINGS_MODULE` | `config.settings` |
| `DJANGO_SECRET_KEY` | *(generate random 50-char string)* |
| `DJANGO_ALLOWED_HOSTS` | `akademi-api.onrender.com` |
| `DJANGO_DEBUG` | `False` |
| `DATABASE_URL` | *(from Supabase: postgresql://postgres:PASSWORD@db.stfrztjpunetsekovlsk.supabase.co:6543/postgres)* |
| `SUPABASE_URL` | `https://stfrztjpunetsekovlsk.supabase.co` |
| `SUPABASE_SECRET_KEY` | *(from Supabase Dashboard → Settings → API)* |
| `SUPABASE_PUBLISHABLE_KEY` | *(from Supabase Dashboard → Settings → API)* |
| `SUPABASE_JWKS_URL` | `https://stfrztjpunetsekovlsk.supabase.co/auth/v1/.well-known/jwks.json` |
| `EMAIL_PROVIDER` | `mock` |
| `WHATSAPP_PROVIDER` | `mock` |
| `PAYMENT_PROVIDER` | `mock` |
| `SEED_PASSWORD` | *(production password)* |

### 2.3 Run Migrations

After first deploy, open Render Shell and run:

```bash
python manage.py migrate
python manage.py seed_data
```

## Step 3: GitHub Actions Secrets

In GitHub repo → Settings → Secrets and variables → Actions:

| Secret | Value |
|--------|-------|
| `CLOUDFLARE_API_TOKEN` | *(from Cloudflare → My Profile → API Tokens)* |
| `CLOUDFLARE_ACCOUNT_ID` | *(from Cloudflare → Dashboard → right sidebar)* |
| `RENDER_SERVICE_ID` | *(from Render → Settings → JSON)* |
| `RENDER_API_KEY` | *(from Render → Account Settings → API Keys)* |

## Step 4: First Deploy

### Option A: Automatic (via GitHub Actions)

1. Push to `main` branch
2. GitHub Actions will run `deploy-staging.yml`
3. Frontend deploys to Cloudflare Pages
4. Backend deploys to Render

### Option B: Manual

```bash
# Frontend (Cloudflare Pages)
cd frontend
npm run build
npx wrangler pages deploy dist --project-name=akademi

# Backend (Render)
# Just push to main — Render auto-deploys
```

## Step 5: Verify Deployment

1. **Frontend:** https://akademi.pages.dev → Should show login page
2. **Backend:** https://akademi-api.onrender.com/api/v1/health/ → Should return `{"status":"healthy"}`
3. **Login:** Use any seed account (`admin@mahardhika.id` / `dev-password-2026`)

## Free Tier Limitations

| Service | Limit | Mitigation |
|---------|-------|------------|
| Render | 750 hrs/mo, cold start 30-50s | Keep-alive pings |
| Cloudflare | 500 builds/mo | Manual deploys for big changes |
| Supabase | 500MB storage | Monitor usage |

## Troubleshooting

### Backend cold start (30-50s)
Render free tier spins down after 15 min inactivity. First request is slow.
**Fix:** Use a cron job to ping `/api/v1/health/` every 10 minutes.

### CORS errors
Ensure `DJANGO_ALLOWED_HOSTS` includes the Cloudflare Pages domain.

### Build failures
Check Render build logs. Common issues:
- Missing `requirements.txt`
- Wrong Python version
- Missing environment variables

## Production Upgrade Path

When ready for production (October):

1. **Render:** Upgrade to Starter plan ($7/mo) — no cold start
2. **Cloudflare:** Already free for production
3. **Supabase:** Upgrade to Pro plan ($25/mo) — more storage, point-in-time recovery
4. **Total:** ~$32/month for production hosting
