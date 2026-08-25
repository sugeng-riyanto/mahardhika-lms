#!/bin/bash
# AKADEMI Staging Deployment Script
# Usage: bash scripts/deploy-staging.sh [backend|frontend|all]
#
# Prerequisites:
#   - Railway CLI: npm install -g @railway/cli
#   - Vercel CLI: npm install -g vercel
#   - RAILWAY_TOKEN, VERCEL_TOKEN set as environment variables
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
SERVICE="${1:-all}"

echo "============================================"
echo "  AKADEMI Staging Deployment"
echo "  Service: $SERVICE"
echo "============================================"

deploy_backend() {
    echo ""
    echo "── Deploying Backend to Railway ──"
    cd "$ROOT_DIR/backend"

    echo "  Running migrations..."
    python manage.py migrate --settings=config.settings 2>&1 | tail -5

    echo "  Deploying..."
    railway up --service akademi-staging-api --environment staging 2>&1 | tail -10

    echo "  ✅ Backend deployed"
}

deploy_frontend() {
    echo ""
    echo "── Deploying Frontend to Vercel ──"
    cd "$ROOT_DIR/frontend"

    echo "  Building..."
    npm run build 2>&1 | tail -5

    echo "  Deploying..."
    vercel deploy --prod --yes 2>&1 | tail -10

    echo "  ✅ Frontend deployed"
}

case "$SERVICE" in
    backend)
        deploy_backend
        ;;
    frontend)
        deploy_frontend
        ;;
    all)
        deploy_backend
        deploy_frontend
        ;;
    *)
        echo "Usage: $0 [backend|frontend|all]"
        exit 1
        ;;
esac

echo ""
echo "============================================"
echo "  Deployment complete!"
echo "  Frontend: https://akademi-staging.vercel.app"
echo "  Backend:  https://akademi-staging-api.up.railway.app"
echo "============================================"
