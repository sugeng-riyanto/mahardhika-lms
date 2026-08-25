# AKADEMI Digital Campus — Environment and Access Checklist

Never paste real secrets into prompts, Markdown, tickets, screenshots, or source control. Configure them in ignored local `.env` files and deployment secret managers.

## Supabase frontend

```env
VITE_SUPABASE_URL=https://PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=replace-locally
VITE_API_URL=http://localhost:8000/api/v1
```

Only the publishable key may be used in React. RLS and least-privilege grants remain mandatory.

## Django/Supabase backend

```env
SUPABASE_URL=https://PROJECT_REF.supabase.co
SUPABASE_SECRET_KEY=replace-in-backend-secret-store
SUPABASE_PROJECT_REF=replace-locally
SUPABASE_DB_PASSWORD=replace-locally
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/postgres
DJANGO_SECRET_KEY=replace-locally
```

Secret/service-role credentials never enter React, `VITE_*`, URLs, logs, or client bundles.

## Private storage

```env
SUPABASE_BUCKET_CONTENT=course-content
SUPABASE_BUCKET_SUBMISSIONS=student-submissions
SUPABASE_BUCKET_CANVAS=canvas-documents
SUPABASE_BUCKET_EXPORTS=canvas-exports
SUPABASE_BUCKET_VIDEOS=learning-videos
SUPABASE_BUCKET_CERTIFICATES=certificates
```

Use RLS/storage policies and short-lived signed delivery after backend authorization.

## Workers

```env
REDIS_URL=redis://localhost:6379/0
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/1
```

Workers process video, canvas PNG/PDF exports, notifications, reports, and finance reconciliation.

## Optional providers

```env
EMAIL_PROVIDER=mock
WHATSAPP_PROVIDER=mock
PAYMENT_PROVIDER=mock
```

Provider credentials are backend-only. Begin in mock/sandbox and activate production after approved evidence. No Coursera, Edpuzzle, Moodle, H5P, Canvas LMS, or LTI credentials are required.

## Access required

- Protected Git repository, pull requests, CI secrets, and production approval.
- Separate Supabase development/staging/production projects where practical.
- Frontend hosting, Django/worker hosting, Redis, domain/DNS/HTTPS, monitoring, and backup ownership.
- Agent has development access; staging mutations require review; production is read-only by default with temporary deployment approval.

## `.gitignore`

```gitignore
.env
.env.*
!.env.example
*.pem
*.key
credentials/
secrets/
```

Tell the agent only which variables are configured or missing. Rotate any credential that appears in chat, logs, Git history, screenshots, or generated artifacts.
