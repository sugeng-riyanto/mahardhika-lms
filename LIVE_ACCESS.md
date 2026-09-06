# LIVE_ACCESS — Akses Uji Coba Owner (ngrok Tunnel)

App ini bisa dicoba live oleh owner lewat tunnel ngrok. Satu URL sudah mencakup
frontend (Vite :5173) + API (Django :8000 via proxy `/api`).

## 🔗 URL Live Saat Ini

Tunnel terakhir yang dibuat (berlaku selama proses tunnel masih hidup):

```
https://0540-2404-8000-100c-11f6-7571-dce6-47cf-8d0.ngrok-free.app
```

> ⚠️ Subdomain ngrok **berubah setiap tunnel di-restart**. Untuk mendapat URL
> terbaru, lihat `http://127.0.0.1:4040/api/tunnels` (dashboard lokal ngrok)
> atau jalankan ulang tunnel lalu baca output `Forwarding`.

## 🔑 Akun Login (8 Role)

Password semua akun: **`dev-password-2026`**

| Role | Email |
|------|-------|
| Owner (pemilik) | `owner@mahardhika.id` |
| Admin | `admin@mahardhika.id` |
| Instructor | `instructor@mahardhika.id` |
| Student | `student@mahardhika.id` |
| Parent | `parent@mahardhika.id` |
| Treasurer | `treasurer@mahardhika.id` |
| Sponsor | `sponsor@mahardhika.id` |
| Third Party | `thirdparty@mahardhika.id` |

## 🚀 Cara Restart (Server + Tunnel)

1. **Backend** (Django, port 8000):
   ```powershell
   cd F:\akademi-lms-mahardhika\backend
   Start-Process python -ArgumentList 'manage.py','runserver' -WindowStyle Hidden
   ```

2. **Frontend** (Vite, port 5173) — pastikan `allowedHosts` sudah menyertakan
   `.ngrok-free.app` (sudah ada di `frontend/vite.config.ts`):
   ```powershell
   cd F:\akademi-lms-mahardhika\frontend
   Start-Process npm.cmd -ArgumentList 'run','dev' -WindowStyle Hidden
   ```

3. **Tunnel ngrok** (binary di `C:\Users\User\ngrok\ngrok.exe`):
   ```powershell
   cd F:\akademi-lms-mahardhika
   Start-Process 'C:\Users\User\ngrok\ngrok.exe' -ArgumentList 'http','5173' -WindowStyle Hidden
   ```
   Ambil URL publik dari `http://127.0.0.1:4040/api/tunnels`.

## ✅ Verifikasi

- Frontend termuat: buka URL → klik **Visit Site** sekali saat pertama kali.
- API lewat tunnel: `curl https://<subdomain>.ngrok-free.app/api/v1/health/`
  → `{"status": "healthy", "database": "connected"}`.

## ⚠️ Catatan

- Ini **dev server** (DEBUG=True) — untuk uji coba, bukan produksi.
- URL berubah tiap restart tunnel; untuk URL permanen perlu deploy (Render untuk
  backend, Cloudflare Pages/Vercel untuk frontend — lihat `backend/render.yaml`
  dan `docs/EMAIL_SETUP.md`).