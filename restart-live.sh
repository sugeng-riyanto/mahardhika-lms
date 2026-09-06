#!/usr/bin/env bash
# restart-live.sh — start backend (Django) + frontend (Vite) + ngrok at once,
# then print the new public URL for the owner trial.
#
# Usage:
#   ./restart-live.sh                       # start whatever is missing, print URL
#   NGROK=/path/to/ngrok ./restart-live.sh  # override ngrok binary
#   PYTHON_BIN=python3 ./restart-live.sh    # override Python binary
#
# Idempotent: if a server (or tunnel) is already running, it is reused, not
# restarted. Logs: .freebuff/live-{backend,frontend,ngrok}.log; PIDs saved to
# .freebuff/live-*.pid.

set -u

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT/backend"
FRONTEND_DIR="$ROOT/frontend"
LOG_DIR="$ROOT/.freebuff"
mkdir -p "$LOG_DIR"

# ---- Resolve binaries -----------------------------------------------------
PYTHON_BIN="${PYTHON_BIN:-}"
if [ -z "$PYTHON_BIN" ]; then
  if [ -x "/c/Users/User/AppData/Local/Programs/Python/Python312/python.exe" ]; then
    PYTHON_BIN="/c/Users/User/AppData/Local/Programs/Python/Python312/python.exe"
  else
    PYTHON_BIN="python"
  fi
fi

NGROK="${NGROK:-}"
if [ -z "$NGROK" ]; then
  for cand in "$HOME/ngrok/ngrok" "$HOME/ngrok/ngrok.exe" "$(command -v ngrok 2>/dev/null)"; do
    if [ -n "$cand" ] && [ -x "$cand" ]; then
      NGROK="$cand"
      break
    fi
  done
fi

NGROK_URL=""

# ---- Helpers --------------------------------------------------------------
port_listening() { netstat -ano 2>/dev/null | grep "LISTENING" | grep -E "[:.]$1[[:space:]]" >/dev/null 2>&1; }

wait_for_http() {
  local url="$1" name="$2" tries="${3:-60}"
  for _ in $(seq 1 "$tries"); do
    if curl -fsS -o /dev/null "$url" 2>/dev/null; then
      echo "  ✓ $name is up"
      return 0
    fi
    sleep 1
  done
  echo "  ⚠ $name did not answer within ${tries}s — see $LOG_DIR/live-$name.log"
  return 1
}

# ---- 1. Backend -----------------------------------------------------------
echo "▶ Backend (Django, :8000)"
if port_listening 8000; then
  echo "  ✓ already running — reusing"
else
  echo "  starting…"
  (cd "$BACKEND_DIR" && nohup "$PYTHON_BIN" manage.py runserver 8000 >"$LOG_DIR/live-backend.log" 2>&1 & echo $! >"$LOG_DIR/live-backend.pid")
  wait_for_http "http://localhost:8000/api/v1/health/" backend 60
fi

# ---- 2. Frontend ----------------------------------------------------------
echo "▶ Frontend (Vite, :5173)"
if port_listening 5173; then
  echo "  ✓ already running — reusing"
else
  echo "  starting…"
  (cd "$FRONTEND_DIR" && nohup npm run dev >"$LOG_DIR/live-frontend.log" 2>&1 & echo $! >"$LOG_DIR/live-frontend.pid")
  wait_for_http "http://localhost:5173/" frontend 90
fi

# ---- 3. ngrok tunnel ------------------------------------------------------
echo "▶ ngrok tunnel"
if curl -fsS http://127.0.0.1:4040/api/tunnels >/dev/null 2>&1; then
  NGROK_URL="$(curl -fsS http://127.0.0.1:4040/api/tunnels 2>/dev/null | grep -o '"public_url":"[^"]*"' | head -1 | cut -d'"' -f4)"
  if [ -n "$NGROK_URL" ]; then
    echo "  ✓ already running: $NGROK_URL"
  fi
fi
if [ -z "$NGROK_URL" ]; then
  if [ -z "$NGROK" ]; then
    echo "  ✗ ngrok binary not found — set NGROK=/path/to/ngrok or add it to PATH"
  else
    echo "  starting… ($NGROK http 5173)"
    (nohup "$NGROK" http 5173 --log=stdout >"$LOG_DIR/live-ngrok.log" 2>&1 & echo $! >"$LOG_DIR/live-ngrok.pid")
    for _ in $(seq 1 30); do
      NGROK_URL="$(curl -fsS http://127.0.0.1:4040/api/tunnels 2>/dev/null | grep -o '"public_url":"[^"]*"' | head -1 | cut -d'"' -f4)"
      [ -n "$NGROK_URL" ] && break
      sleep 1
    done
    if [ -n "$NGROK_URL" ]; then
      echo "  ✓ tunnel live"
    else
      echo "  ⚠ ngrok did not report a tunnel — see $LOG_DIR/live-ngrok.log"
    fi
  fi
fi

# ---- 4. Print the live URL ------------------------------------------------
echo ""
echo "══════════════════════════════════════════════════════════"
echo "  🔗 LIVE URL: ${NGROK_URL:-'(tunnel tidak tersedia)'}"
echo "══════════════════════════════════════════════════════════"
echo ""
echo "Login demo (8 role, password sesuai SEED_PASSWORD / dev-password-2026 di dev):"
echo "  owner@mahardhika.id · admin@mahardhika.id · instructor@mahardhika.id"
echo "  student@mahardhika.id · parent@mahardhika.id · treasurer@mahardhika.id"
echo "  sponsor@mahardhika.id · thirdparty@mahardhika.id"
echo ""
echo "Catatan:"
echo "  - Saat pertama dibuka di browser, ngrok menampilkan 'Visit Site' sekali — klik saja."
echo "  - URL berubah setiap kali script ini dijalankan ulang."
echo "  - Panduan lengkap & cara restart manual: LIVE_ACCESS.md"