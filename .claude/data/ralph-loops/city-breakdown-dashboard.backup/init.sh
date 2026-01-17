#!/bin/bash
# init.sh - Environment verification for Ralph Loop: city-breakdown-dashboard
# Generated: 2026-01-15
#
# This script verifies the dev server is running.
# The server should be started BEFORE beginning the Ralph Loop.
# This script only checks - it does NOT start the server.

set -e

FRONTEND_PORT=5007
BACKEND_PORT=3007
PROJECT_PATH="/Users/giannimunro/Desktop/cursor-projects/automation"

echo "=== Ralph Loop Environment Check ==="
echo "Task: city-breakdown-dashboard"
echo "Frontend Port: $FRONTEND_PORT"
echo "Backend Port: $BACKEND_PORT"

# Navigate to project directory
cd "$PROJECT_PATH"

# Check frontend server
echo ""
echo "Checking frontend server..."
if curl -s "http://localhost:$FRONTEND_PORT" > /dev/null 2>&1; then
    echo "✅ Frontend server running on port $FRONTEND_PORT"
else
    echo "❌ Frontend server NOT running on port $FRONTEND_PORT"
    echo ""
    echo "Please start the dev server before running the Ralph Loop:"
    echo "  cd $PROJECT_PATH/UberEats-Image-Extractor && npm run dev"
    exit 1
fi

# Check backend server
echo ""
echo "Checking backend server..."
if curl -s "http://localhost:$BACKEND_PORT" > /dev/null 2>&1; then
    echo "✅ Backend server running on port $BACKEND_PORT"
else
    echo "⚠️  Backend server NOT running on port $BACKEND_PORT (may be optional)"
fi

echo ""
echo "=== Environment Ready ==="
echo "Frontend URL: http://localhost:$FRONTEND_PORT"
