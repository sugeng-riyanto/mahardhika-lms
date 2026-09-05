# Melany AI Integration Guide

## Overview
Dokumen ini menjelaskan integrasi Melany AI ke dalam Mahardhika LMS sebagai bagian dari Dharma Mardika Education Roadmap 2027.

## Architecture

```
Frontend (MelanyAssistant.tsx)
    ↓ POST /api/v1/ai/melany-chat/
Backend (views.py → services.py)
    ↓ httpx POST
LM Studio (localhost:1234) / OpenAI-compatible API
    ↓
Response → Frontend chat UI
```

## Setup Steps

### 1. Database Migration
Jalankan file `supabase/migrations/009_ai_features.sql` di Supabase SQL Editor untuk membuat tabel `ai_interactions` dan `ai_canvas_feedback` dengan RLS policies.

### 2. Backend Configuration
Tambahkan ke `backend/settings.py` atau environment variables:
```python
LM_STUDIO_URL = os.getenv('LM_STUDIO_URL', 'http://localhost:1234/v1/chat/completions')
LM_STUDIO_MODEL = os.getenv('LM_STUDIO_MODEL', 'deepseek-v4')
LM_STUDIO_API_KEY = os.getenv('LM_STUDIO_API_KEY', 'lm-studio')
```

### 3. LM Studio Setup
1. Download LM Studio dari https://lmstudio.ai
2. Load model `deepseek-v4` (atau model lain yang kompatibel)
3. Start local server di port 1234

### 4. Frontend Integration
MelanyAssistant sudah diintegrasikan ke:
- Activity Player (`/activities/:id/play`) — mode `canvas` atau `chat`
- Essay Workspace (`/essays/:id`) — mode `essay`

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/ai/melany-chat/` | POST | Chat dengan Melany AI |
| `/api/v1/ai/health/` | GET | Cek kesehatan layanan AI |

### POST /api/v1/ai/melany-chat/
```json
{
  "activity_id": "uuid",
  "context_type": "chat|canvas|essay",
  "message": "Pertanyaan siswa",
  "canvas_data": {} // optional
}
```

Response:
```json
{
  "success": true,
  "response": "Jawaban Melany AI",
  "context_type": "chat"
}
```

## RBAC
- **Student**: Can chat about activities they're enrolled in
- **Instructor**: Can view AI interactions for their activities
- **Admin/Owner**: Can view all interactions
- **Parent**: Can view child's AI interactions (future)

## System Prompt
Located at `backend/config/melany_system_prompt.txt`. Key behaviors:
- Never gives direct answers — uses Socratic questioning
- Guides through scientific method (HOTS)
- Adapts to grade level
- Aware of LMS context (canvas, essay, branching)
- Redirects to Camp/Pathway info when relevant
- Safeguarding: no answer keys, no complete code, distress → Guru Wali

## Files
| File | Purpose |
|------|---------|
| `backend/apps/ai/services.py` | LM Studio API integration |
| `backend/apps/ai/views.py` | DRF API views |
| `backend/apps/ai/urls.py` | URL routing |
| `backend/config/melany_system_prompt.txt` | System prompt |
| `frontend/src/components/ai/MelanyAssistant.tsx` | React chat UI |
| `supabase/migrations/009_ai_features.sql` | Database schema + RLS |
| `docs/AI_INTEGRATION_GUIDE.md` | This file |
