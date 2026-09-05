# Melany AI Integration Guide

## Overview
Melany AI adalah asisten cerdas native di Mahardhika LMS yang membantu navigasi ekosistem Dharma Mardika - Camp, University Pathways, Materials, dan Certificates.

## Architecture
```
Frontend (MelanyAssistant.tsx)
    ↓ POST /api/v1/ai/melany-chat/
Backend (views.py → services.py)
    ↓ Knowledge Base lokal
Response → Chat UI
```

## Setup

### 1. Database Migration
Jalankan `supabase/migrations/009_ai_features.sql` di Supabase SQL Editor.

### 2. Backend
Tidak perlu konfigurasi tambahan. Service menggunakan knowledge base lokal.

### 3. Frontend
MelanyAssistant sudah terintegrasi ke Layout, muncul di semua halaman.

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/ai/melany-chat/` | POST | Chat dengan Melany AI |
| `/api/v1/ai/health/` | GET | Cek kesehatan layanan |
| `/api/v1/ai/programs/` | GET | Daftar program Dharma Mardika |

### POST /api/v1/ai/melany-chat/
```json
{
  "context_type": "chat|camp|pathway|certificate|registration",
  "message": "Pertanyaan user"
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

## Programs Supported

### Camps (Juni-Juli 2027)
- STEM Camp (Arduino/IoT/Robotics)
- Arts Camp (Visual Arts/Music)
- Explorers Camp (Outdoor/Leadership)
- Life Skills Camp (Financial Literacy/HYROX)

### University Pathways
- **Lokal**: PTN (SNBT/UTBK), PTS, TKA, UN
- **International**: US/Canada, UK, China, Counsellors

### LMS Features
- Content Library (PDF, video, slides)
- Assignments & Essays
- Certificates (blockchain-verified)
- Grades & Progress

## Context Types
| Type | Use Case |
|------|----------|
| `chat` | General questions |
| `camp` | Camp program info |
| `pathway` | University pathway guidance |
| `certificate` | Certificate verification |
| `registration` | Enrollment help |

## Files
| File | Purpose |
|------|---------|
| `backend/apps/ai/services.py` | Knowledge base & response generation |
| `backend/apps/ai/views.py` | DRF API views |
| `backend/apps/ai/urls.py` | URL routing |
| `backend/config/melany_system_prompt.txt` | System prompt |
| `frontend/src/components/ai/MelanyAssistant.tsx` | Chat widget |
| `supabase/migrations/009_ai_features.sql` | Database schema + RLS |
