# GitHub Actions Secrets Setup — AKADEMI Digital Campus

This guide walks you through setting up the 4 required secrets for automated staging deployment.

## Quick Reference

| Secret | Where to Get It | Used By |
|--------|----------------|---------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare Dashboard → My Profile → API Tokens | Frontend deploy |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare Dashboard → right sidebar | Frontend deploy |
| `RENDER_API_KEY` | Render Dashboard → Account Settings → API Keys | Backend deploy |
| `RENDER_SERVICE_ID` | Render Dashboard → Service → Settings → JSON | Backend deploy |

## Step 1: Cloudflare Secrets

### 1.1 Get Cloudflare API Token

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com)
2. Click your profile icon (top right) → **My Profile**
3. Click **API Tokens** tab
4. Click **Create Token**
5. Use the **Edit Cloudflare Workers** template
6. Under **Account Resources**, select your account
7. Under **Zone Resources**, select **All zones** (or specific zone if you have one)
8. Click **Continue to summary**
9. Click **Create Token**
10. **Copy the token immediately** (it won't be shown again)

### 1.2 Get Cloudflare Account ID

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com)
2. Select any domain or go to the home page
3. On the right sidebar, find **Account ID**
4. Copy the 32-character hex string

### 1.3 Set in GitHub

1. Go to your GitHub repo: `https://github.com/sugeng-riyanto/mahardhika-lms`
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add:
   - Name: `CLOUDFLARE_API_TOKEN`
   - Value: *(paste the token from step 1.1)*
5. Click **Add secret**
6. Repeat for:
   - Name: `CLOUDFLARE_ACCOUNT_ID`
   - Value: *(paste the account ID from step 1.2)*

## Step 2: Render Secrets

### 2.1 Get Render API Key

1. Go to [render.com](https://render.com)
2. Click your avatar (top right) → **Account Settings**
3. Click **API Keys** in the left sidebar
4. Click **Create API Key**
5. Name it `github-actions`
6. Click **Create**
7. **Copy the key immediately** (it won't be shown again)

### 2.2 Get Render Service ID

1. In Render Dashboard, click **New** → **Web Service**
2. Connect to GitHub repo: `sugeng-riyanto/mahardhika-lms`
3. Configure:
   - **Name:** `akademi-api`
   - **Region:** Singapore (or closest to your users)
   - **Branch:** `main`
   - **Root directory:** `backend`
   - **Runtime:** Python 3
   - **Build command:** `pip install -r requirements.txt`
   - **Start command:** `gunicorn config.wsgi:application --bind 0.0.0.0:$PORT`
   - **Plan:** Free
4. Click **Create Web Service**
5. After creation, go to **Settings** → **General**
6. Find **Service ID** in the JSON section (or copy from URL: `https://dashboard.render.com/web/svc-XXXXXXXX`)
7. Copy the `svc-XXXXXXXX` part

### 2.3 Set Environment Variables in Render

After creating the service, go to **Environment** tab and add:

| Key | Value |
|-----|-------|
| `DJANGO_SETTINGS_MODULE` | `config.settings` |
| `DJANGO_SECRET_KEY` | *(generate: `python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"`)* |
| `DJANGO_ALLOWED_HOSTS` | `akademi-api.onrender.com` |
| `DJANGO_DEBUG` | `False` |
| `DATABASE_URL` | *(from Supabase: see Step 3)* |
| `SUPABASE_URL` | `https://stfrztjpunetsekovlsk.supabase.co` |
| `SUPABASE_SECRET_KEY` | *(from Supabase Dashboard → Settings → API → service_role key)* |
| `SUPABASE_PUBLISHABLE_KEY` | *(from Supabase Dashboard → Settings → API → anon key)* |
| `SUPABASE_JWKS_URL` | `https://stfrztjpunetsekovlsk.supabase.co/auth/v1/.well-known/jwks.json` |
| `EMAIL_PROVIDER` | `mock` |
| `WHATSAPP_PROVIDER` | `mock` |
| `PAYMENT_PROVIDER` | `mock` |
| `SEED_PASSWORD` | `dev-password-2026` |

### 2.4 Set in GitHub

1. Go to your GitHub repo → **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Add:
   - Name: `RENDER_API_KEY`
   - Value: *(paste the key from step 2.1)*
4. Click **Add secret**
5. Repeat for:
   - Name: `RENDER_SERVICE_ID`
   - Value: *(paste the service ID from step 2.2)*

## Step 3: Get Supabase DATABASE_URL

1. Go to [supabase.com](https://supabase.com) → Select your project
2. Click **Settings** (gear icon) → **Database**
3. Under **Connection string**, click **URI**
4. Copy the full connection string
5. It looks like: `postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres`
6. Set this as `DATABASE_URL` in Render environment variables (Step 2.3)

## Step 4: Verify Secrets Are Set

After adding all 4 secrets, verify they appear in GitHub:

1. Go to repo → **Settings** → **Secrets and variables** → **Actions**
2. You should see:
   - ✅ `CLOUDFLARE_API_TOKEN`
   - ✅ `CLOUDFLARE_ACCOUNT_ID`
   - ✅ `RENDER_API_KEY`
   - ✅ `RENDER_SERVICE_ID`

## Step 5: Test Deployment

### Option A: Automatic (push to main)

```bash
git push origin main
```

GitHub Actions will automatically:
1. Run backend tests
2. Deploy frontend to Cloudflare Pages
3. Deploy backend to Render
4. Run health checks

### Option B: Manual trigger

1. Go to repo → **Actions** tab
2. Click **Deploy to Staging (Free Tier)**
3. Click **Run workflow**
4. Select `main` branch
5. Click **Run workflow**

## Step 6: Verify Deployment

After deployment completes (~5 minutes):

1. **Frontend:** https://akademi.pages.dev → Should show login page
2. **Backend:** https://akademi-api.onrender.com/api/v1/health/ → Should return `{"status":"healthy"}`
3. **Login:** Use `admin@mahardhika.id` / `dev-password-2026`

## Troubleshooting

### "Unauthorized" error in GitHub Actions

- Verify the API token/key hasn't expired
- Check the token has the correct permissions
- For Cloudflare: ensure the token has Workers/Pages edit permission

### Render deployment fails

- Check the Render build logs for errors
- Verify `DATABASE_URL` is correct
- Ensure all environment variables are set

### Cloudflare Pages build fails

- Verify the build command is correct: `cd frontend && npm install && npm run build`
- Check that `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are set in Cloudflare Pages environment variables (not GitHub secrets)

### Health check fails (cold start)

Render free tier spins down after 15 min inactivity. First request takes 30-50 seconds.
**Fix:** The health check retries 3 times with 10-second delays. If it still fails, wait 1 minute and try again.

## Security Notes

- **Never commit secrets to git** — they're stored as encrypted GitHub secrets
- **Rotate keys regularly** — especially if a team member leaves
- **Use least-privilege tokens** — Cloudflare token should only have Pages/Workers edit access
- **Render API key** should only have deploy permission, not admin access

## Production Upgrade (October)

When ready for production:

1. **Render:** Upgrade to Starter plan ($7/mo) — removes cold start
2. **Supabase:** Upgrade to Pro plan ($25/mo) — more storage + backups
3. **Total:** ~$32/month for production hosting

See `docs/STAGING_DEPLOYMENT.md` for full deployment architecture.
