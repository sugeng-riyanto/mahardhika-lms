#!/bin/bash
# verify-deployment.sh — Verify staging deployment is working
# Usage: bash scripts/verify-deployment.sh

set -e

echo "🔍 Verifying AKADEMI Staging Deployment..."
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Backend health check
echo -n "Backend health check... "
BACKEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://akademi-api.onrender.com/api/v1/health/ 2>/dev/null || echo "000")
if [ "$BACKEND_STATUS" = "200" ]; then
    echo -e "${GREEN}✅ Healthy${NC}"
else
    echo -e "${YELLOW}⚠️  HTTP $BACKEND_STATUS (may be cold-starting)${NC}"
fi

# Frontend check
echo -n "Frontend check... "
FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://akademi.pages.dev/ 2>/dev/null || echo "000")
if [ "$FRONTEND_STATUS" = "200" ] || [ "$FRONTEND_STATUS" = "301" ] || [ "$FRONTEND_STATUS" = "302" ]; then
    echo -e "${GREEN}✅ Available (HTTP $FRONTEND_STATUS)${NC}"
else
    echo -e "${RED}❌ Not available (HTTP $FRONTEND_STATUS)${NC}"
fi

# API root check
echo -n "API root check... "
API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://akademi-api.onrender.com/api/v1/ 2>/dev/null || echo "000")
if [ "$API_STATUS" = "200" ] || [ "$API_STATUS" = "301" ] || [ "$API_STATUS" = "302" ]; then
    echo -e "${GREEN}✅ Available (HTTP $API_STATUS)${NC}"
else
    echo -e "${YELLOW}⚠️  HTTP $API_STATUS${NC}"
fi

echo ""
echo "📋 URLs:"
echo "   Frontend: https://akademi.pages.dev"
echo "   Backend:  https://akademi-api.onrender.com/api/v1/"
echo "   Health:   https://akademi-api.onrender.com/api/v1/health/"
echo ""

# Check if local servers are running
echo "🏠 Local Servers:"
if curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/ 2>/dev/null | grep -q "200"; then
    echo -e "   Frontend: ${GREEN}Running on :5173${NC}"
else
    echo -e "   Frontend: ${YELLOW}Not running${NC}"
fi
if curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/v1/health/ 2>/dev/null | grep -q "200"; then
    echo -e "   Backend:  ${GREEN}Running on :8000${NC}"
else
    echo -e "   Backend:  ${YELLOW}Not running${NC}"
fi

echo ""
echo "✅ Verification complete"
