#!/bin/bash
# Initialize a worktree for independent ralph loop execution
# Usage: ./init-parallel-worktree.sh <feature-name> <worktree-number>
# Example: ./init-parallel-worktree.sh dashboard-tabs 1

set -e

FEATURE_NAME="$1"
WORKTREE_NUM="${2:-1}"

if [ -z "$FEATURE_NAME" ]; then
  echo "Usage: init-parallel-worktree.sh <feature-name> <worktree-number>"
  echo "Example: init-parallel-worktree.sh dashboard-tabs 1"
  exit 1
fi

# Calculate ports based on worktree number
BACKEND_PORT=$((3007 + WORKTREE_NUM))
FRONTEND_PORT=$((5007 + WORKTREE_NUM))

PROJECT_ROOT=$(pwd)
WORKTREE_DIR="$PROJECT_ROOT/trees/$FEATURE_NAME-$WORKTREE_NUM"

echo "=== Initializing Worktree ==="
echo "Feature: $FEATURE_NAME"
echo "Worktree: $WORKTREE_NUM"
echo "Backend Port: $BACKEND_PORT"
echo "Frontend Port: $FRONTEND_PORT"
echo "Directory: $WORKTREE_DIR"
echo ""

# Create trees directory if needed
mkdir -p "$PROJECT_ROOT/trees"

# Create git worktree
echo "Creating git worktree..."
git worktree add -b "$FEATURE_NAME-$WORKTREE_NUM" "$WORKTREE_DIR"

# Copy .env files (not tracked in git)
echo "Copying .env files..."
cp "$PROJECT_ROOT/UberEats-Image-Extractor/.env" "$WORKTREE_DIR/UberEats-Image-Extractor/.env"
cp "$PROJECT_ROOT/scripts/.env" "$WORKTREE_DIR/scripts/.env" 2>/dev/null || true
cp "$PROJECT_ROOT/scripts/restaurant-registration/.env" "$WORKTREE_DIR/scripts/restaurant-registration/.env" 2>/dev/null || true

# Update backend port in .env
echo "Updating backend port configuration..."
sed -i '' "s/^PORT=.*/PORT=$BACKEND_PORT/" "$WORKTREE_DIR/UberEats-Image-Extractor/.env"
sed -i '' "s|^VITE_RAILWAY_API_URL=.*|VITE_RAILWAY_API_URL=http://localhost:$BACKEND_PORT|" "$WORKTREE_DIR/UberEats-Image-Extractor/.env"

# Update vite.config.ts
echo "Updating frontend port configuration..."
sed -i '' "s/port: 5007/port: $FRONTEND_PORT/" "$WORKTREE_DIR/UberEats-Image-Extractor/vite.config.ts"
sed -i '' "s|target: 'http://localhost:3007'|target: 'http://localhost:$BACKEND_PORT'|" "$WORKTREE_DIR/UberEats-Image-Extractor/vite.config.ts"

# Create ralph-config for reference
echo "Creating ralph config..."
cat > "$WORKTREE_DIR/.ralph-config" << EOF
# Ralph Loop Configuration for worktree: $FEATURE_NAME-$WORKTREE_NUM
# Generated: $(date)

# Server Ports
BACKEND_PORT=$BACKEND_PORT
FRONTEND_PORT=$FRONTEND_PORT
FRONTEND_URL=http://localhost:$FRONTEND_PORT

# Browser: Handled automatically by --isolated flag
# Each Claude session gets its own isolated Chrome instance
EOF

# Install dependencies (use --legacy-peer-deps to handle React version conflicts)
echo "Installing npm dependencies..."
cd "$WORKTREE_DIR/UberEats-Image-Extractor" && npm install --legacy-peer-deps
cd "$WORKTREE_DIR/scripts" && npm install --legacy-peer-deps 2>/dev/null || true
cd "$WORKTREE_DIR/scripts/restaurant-registration" && npm install --legacy-peer-deps 2>/dev/null || true

# Return to project root
cd "$PROJECT_ROOT"

# Verify configuration
echo ""
echo "=== Verifying Configuration ==="
echo "Backend PORT:"
grep "^PORT=" "$WORKTREE_DIR/UberEats-Image-Extractor/.env"
echo "API URL:"
grep "^VITE_RAILWAY_API_URL=" "$WORKTREE_DIR/UberEats-Image-Extractor/.env"

echo ""
echo "=== Worktree Ready ==="
echo ""

# Create tmux session name based on feature
TMUX_SESSION="worktree-$FEATURE_NAME-$WORKTREE_NUM"

echo "Starting dev server in tmux session: $TMUX_SESSION"
echo "Ports: $BACKEND_PORT (backend) / $FRONTEND_PORT (frontend)"
echo ""

# Start the dev server in a tmux session
tmux new-session -d -s "$TMUX_SESSION" -c "$WORKTREE_DIR/UberEats-Image-Extractor" "npm start"

# Wait a moment for server to start
sleep 5

# Verify servers are running
echo "=== Verifying Servers ==="
if lsof -i :$BACKEND_PORT > /dev/null 2>&1; then
    echo "✅ Backend server running on port $BACKEND_PORT"
else
    echo "⚠️  Backend server may still be starting on port $BACKEND_PORT"
fi

if lsof -i :$FRONTEND_PORT > /dev/null 2>&1; then
    echo "✅ Frontend server running on port $FRONTEND_PORT"
else
    echo "⚠️  Frontend server may still be starting on port $FRONTEND_PORT"
fi

echo ""
echo "=== Dev Server Started ==="
echo "Frontend URL: http://localhost:$FRONTEND_PORT"
echo "Backend URL: http://localhost:$BACKEND_PORT"
echo "Tmux session: $TMUX_SESSION"
echo ""
echo "Commands:"
echo "  Attach to server logs:  tmux attach -t $TMUX_SESSION"
echo "  Stop the server:        tmux kill-session -t $TMUX_SESSION"
echo ""
echo "To start ralph loop:"
echo "  cd $WORKTREE_DIR"
echo "  claude --print 'run /ralph-loop'"
