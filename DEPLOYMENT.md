# AKADEMI Digital Campus — Deployment Guide

## Architecture

```
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│   Vercel         │────▶│   Railway             │────▶│   Supabase      │
│   (Frontend)     │     │   (Django Backend)    │     │   (PostgreSQL + │
│   React + Vite   │     │   gunicorn + Celery   │     │    Auth + RLS)  │
└─────────────────┘     └──────────────────────┘     └─────────────────┘
```

## Staging Environment

| Service | URL | Provider |
|---------|-----|----------|
| Frontend | https://akademi-staging.vercel.app | Vercel |
| Backend API | https://akademi-staging-api.up.railway.app | Railway |
| Database | stfrztjpunetsekovlsk.supabase.co | Supabase |
| Redis | Railway Redis addon | Railway |

## Setup Instructions

### 1. Railway (Backend)

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Create project
railway init akademi-staging

# Add PostgreSQL addon
railway add --database PostgreSQL

# Add Redis addon
railway add --database Redis

# Set environment variables (see backend/.env.staging.example)
railway variables set DEBUG=False
railway variables set DJANGO_SECRET_KEY="<random-64-chars>"
railway variables set DJANGO_ALLOWED_HOSTS="akademi-staging-api.up.railway.app"
railway variables set DJANGO_CORS_ALLOWED_ORIGINS="https://akademi-staging.vercel.app"
railway variables set SUPABASE_URL="https://stfrztjpunetsekovlsk.supabase.co"
railway variables set SUPABASE_SECRET_KEY="<from-dashboard>"
railway variables set SUPABASE_PUBLISHABLE_KEY="<from-dashboard>"
railway variables set EMAIL_PROVIDER=mock
railway variables set WHATSAPP_PROVIDER=mock
railway variables set PAYMENT_PROVIDER=mock

# Deploy
railway up
```

### 2. Vercel (Frontend)

```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Link project
cd frontend
vercel link

# Set environment variables
vercel env add VITE_SUPABASE_URL production
vercel env add VITE_SUPABASE_PUBLISHABLE_KEY production

# Deploy
vercel --prod
```

### 3. GitHub Secrets

Add these secrets in GitHub → Settings → Secrets → Actions:

| Secret | Description |
|--------|-------------|
| `RAILWAY_TOKEN` | Railway API token (`railway login` → Settings → Tokens) |
| `RAILWAY_PROJECT_ID` | Railway project ID |
| `VERCEL_TOKEN` | Vercel API token (`vercel tokens create`) |
| `VERCEL_ORG_ID` | Vercel org ID (`vercel link` → `.vercel/project.json`) |
| `VERCEL_PROJECT_ID` | Vercel project ID |
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon key |

### 4. Auto-Deploy

Once secrets are configured, every push to `main` triggers:
1. Backend tests → Railway deploy
2. Frontend typecheck + unit tests → Vercel deploy
3. Post-deploy E2E tests against staging

## Manual Deployment

```bash
# Deploy both
bash scripts/deploy-staging.sh all

# Deploy backend only
bash scripts/deploy-staging.sh backend

# Deploy frontend only
bash scripts/deploy-staging.sh frontend
```

## First-Time Database Setup

After first deploy, seed the staging database:

```bash
# SSH into Railway or use Railway CLI
railway run python manage.py seed_data --settings=config.settings
```

## Environment Variables

### Backend (.env.staging)

See `backend/.env.staging.example` for the full template.

### Frontend (.env.staging)

See `frontend/.env.staging.example` for the full template.

## Monitoring

- **Railway**: Dashboard → Deployments → Logs
- **Vercel**: Dashboard → Deployments → Function Logs
- **Supabase**: Dashboard → Database → Logs

## Rollback

```bash
# Railway: rollback to previous deploy
railway rollback

# Vercel: promote a previous deployment
vercel rollback
```

## Cost Estimate

| Service | Free Tier | Staging Usage |
|---------|-----------|---------------|
| Vercel | 100GB bandwidth/mo | ~2GB/mo |
| Railway | $5 credit/mo | ~$3-4/mo |
| Supabase | 500MB database | ~100MB |
| Redis | Included in Railway | ~50MB |
