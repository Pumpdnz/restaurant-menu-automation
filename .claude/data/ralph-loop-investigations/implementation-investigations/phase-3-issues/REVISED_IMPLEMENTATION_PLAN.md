# Revised Implementation Plan: Parallel Browser Verification

**Date:** January 19, 2026
**Approach:** Independent Worktree Processes with `--isolated` MCP

---

## Architecture Overview

Each git worktree runs as a completely independent process. Browser isolation is handled automatically by the `--isolated` flag in Chrome DevTools MCP - each session gets its own temporary Chrome profile.

```
Terminal 1                    Terminal 2                    Terminal 3
    │                             │                             │
    ▼                             ▼                             ▼
trees/feature-1/              trees/feature-2/              trees/feature-3/
├── UberEats-Image-Extractor/ ├── UberEats-Image-Extractor/ ├── UberEats-Image-Extractor/
│   ├── .env (PORT=3008)      │   ├── .env (PORT=3009)      │   ├── .env (PORT=3010)
│   └── vite.config.ts (5008) │   └── vite.config.ts (5009) │   └── vite.config.ts (5010)
└── .ralph-config             └── .ralph-config             └── .ralph-config

Browser isolation: Automatic via --isolated flag
Each Claude session spawns its own isolated Chrome instance
```

---

## How Browser Isolation Works

**Global MCP config (`~/.claude.json`) already has:**
```json
"chrome-devtools": {
  "command": "npx",
  "args": ["chrome-devtools-mcp@latest", "--isolated"]
}
```

**With `--isolated`:**
- Each MCP session creates its own temporary Chrome profile
- Multiple parallel sessions = multiple unique temp profiles
- No "browser already running" conflicts
- Works for parallel worktrees AND parallel processes within a worktree
- Profile cleaned up when session ends

**Trade-off:** Authentication state is not persisted between sessions. Each session must log in fresh.

**Solution:** Add authentication step to Ralph Loop workflow (see below).

---

## Port Allocation Scheme

Only dev server ports need configuration per worktree:

| Worktree | Backend (PORT) | Frontend (Vite) | API URL |
|----------|----------------|-----------------|---------|
| Main     | 3007           | 5007            | localhost:3007 |
| 1        | 3008           | 5008            | localhost:3008 |
| 2        | 3009           | 5009            | localhost:3009 |
| 3        | 3010           | 5010            | localhost:3010 |

Browser ports are NOT configured - `--isolated` handles this automatically.

---

## What We Need

### 1. Worktree Initialization Script

**Purpose:** Initialize a new worktree with dev server port configs

**File:** `.claude/scripts/init-parallel-worktree.sh`

```bash
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

# Install dependencies
echo "Installing npm dependencies..."
cd "$WORKTREE_DIR/UberEats-Image-Extractor" && npm install
cd "$WORKTREE_DIR/scripts" && npm install 2>/dev/null || true
cd "$WORKTREE_DIR/scripts/restaurant-registration" && npm install 2>/dev/null || true

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
echo "To start development:"
echo "  cd $WORKTREE_DIR/UberEats-Image-Extractor"
echo "  npm run dev"
echo ""
echo "To start ralph loop:"
echo "  cd $WORKTREE_DIR"
echo "  claude --print 'run /ralph-loop'"
```

### 2. Ralph Loop Authentication Section

**Purpose:** Each isolated browser session needs to authenticate before verification

**Required Addition to `RALPH_PROMPT.md` template:**

Add a new section after environment setup but before feature verification:

```markdown
## Session Authentication

Before performing browser verification, authenticate with the dashboard:

1. Navigate to the frontend URL: `http://localhost:${FRONTEND_PORT}`
2. If redirected to login page:
   - Enter credentials:
     - Email: `test@example.com`
     - Password: `testpassword123`
   - Click "Sign In"
   - Wait for dashboard to load
3. Verify authentication succeeded by checking for dashboard elements
4. Proceed with feature verification

**Note:** Each isolated browser session requires fresh authentication.
The `--isolated` flag creates a temporary Chrome profile without saved credentials.
```

**Update to `init.sh.template`:**

```bash
#!/bin/bash
# Ralph Loop Initialization Script

# Load worktree-specific config if exists
if [ -f ".ralph-config" ]; then
  echo "Loading worktree config from .ralph-config"
  source .ralph-config
else
  # Defaults for main worktree
  BACKEND_PORT=3007
  FRONTEND_PORT=5007
  FRONTEND_URL="http://localhost:5007"
fi

echo "=== Ralph Loop Config ==="
echo "Backend: $BACKEND_PORT"
echo "Frontend: $FRONTEND_URL"
echo ""

# Check if dev server is running
if ! lsof -i :$BACKEND_PORT > /dev/null 2>&1; then
  echo "WARNING: Backend server not running on port $BACKEND_PORT"
  echo "Start it with: cd UberEats-Image-Extractor && npm run dev"
  exit 1
fi

echo "Dev server running. Browser will be launched automatically by MCP (--isolated mode)."
echo "Remember: Each session requires fresh authentication."

# Continue with rest of init...
```

---

## Implementation Tasks

### Phase 1: Create Init Script (45 min)

| Task | File | Effort |
|------|------|--------|
| Create worktree init script | `.claude/scripts/init-parallel-worktree.sh` | 30 min |
| Make executable | `chmod +x` | 1 min |
| Test with single worktree | - | 15 min |

### Phase 2: Update Ralph Loop Templates (30 min)

| Task | File | Effort |
|------|------|--------|
| Add authentication section | `templates/RALPH_PROMPT.md.template` | 15 min |
| Update init.sh template | `templates/init.sh.template` | 10 min |
| Add trees/ to .gitignore | `.gitignore` | 5 min |

### Phase 3: Testing (45 min)

| Task | Description |
|------|-------------|
| Initialize 2 worktrees | `./init-parallel-worktree.sh feature-a 1` and `./init-parallel-worktree.sh feature-b 2` |
| Start servers in both | Verify different ports |
| Test parallel sessions | Run Ralph Loops simultaneously, verify browser isolation |
| Test authentication flow | Verify login works in isolated sessions |

---

## Files Changed Summary

### New Files
```
.claude/scripts/init-parallel-worktree.sh    # Worktree setup script
```

### Modified Files
```
.claude/skills/plan-ralph-loop/templates/RALPH_PROMPT.md.template  # Add auth section
.claude/skills/plan-ralph-loop/templates/init.sh.template          # Load .ralph-config
.gitignore                                                          # Add trees/
```

### Generated Per-Worktree (not committed)
```
trees/<feature>-<n>/
  ├── .ralph-config                           # Port reference (informational)
  └── UberEats-Image-Extractor/.env          # Modified with unique ports
```

---

## What We DON'T Need

| Original Consideration | Why Not Needed |
|------------------------|----------------|
| Per-worktree `.mcp.json` | `--isolated` handles browser isolation automatically |
| Chrome debugging ports | `--isolated` spawns fresh Chrome per session |
| `--browserUrl` configuration | Would limit parallel processes within worktree |
| Manual Chrome launching | MCP handles it with `--isolated` |
| Chrome profile directories | Temp profiles auto-created and cleaned up |

---

## Quick Start (After Implementation)

```bash
# From main worktree root

# Initialize parallel worktrees
./.claude/scripts/init-parallel-worktree.sh dashboard-tabs 1
./.claude/scripts/init-parallel-worktree.sh dashboard-pagination 2

# Terminal 1 - Feature 1
cd trees/dashboard-tabs-1/UberEats-Image-Extractor
npm run dev  # Runs on ports 3008/5008

# Terminal 2 (same worktree) - Start Ralph Loop
cd trees/dashboard-tabs-1
claude --print 'run /ralph-loop'
# Session will: start isolated Chrome → login → verify features

# Terminal 3 - Feature 2
cd trees/dashboard-pagination-2/UberEats-Image-Extractor
npm run dev  # Runs on ports 3009/5009

# Terminal 4 (same worktree) - Start Ralph Loop
cd trees/dashboard-pagination-2
claude --print 'run /ralph-loop'
# Session will: start isolated Chrome → login → verify features

# Both run in parallel with no conflicts!
```

---

## Authentication Workflow

Each Ralph Loop session follows this browser workflow:

```
1. MCP spawns isolated Chrome (temp profile, no saved auth)
         │
         ▼
2. Navigate to http://localhost:${FRONTEND_PORT}
         │
         ▼
3. Detect login page → Enter credentials → Submit
         │
         ▼
4. Wait for dashboard load
         │
         ▼
5. Perform feature verification
         │
         ▼
6. Session ends → Temp Chrome profile cleaned up
```

**Credentials should be:**
- Stored in environment variables or `.env` file
- Documented in RALPH_PROMPT.md for the session to use
- Test account credentials (not production)

---

## Verification Checklist

After implementation, verify:

- [ ] Worktree created with correct branch
- [ ] `.env` has correct PORT value
- [ ] `.env` has correct VITE_RAILWAY_API_URL
- [ ] `vite.config.ts` has correct port and proxy
- [ ] Dev servers start on correct ports
- [ ] Ralph Loop can launch isolated browser
- [ ] Authentication flow works in isolated session
- [ ] Two parallel Ralph Loops don't conflict
- [ ] No port conflicts between worktrees

---

## Estimated Total Effort

| Phase | Time |
|-------|------|
| Phase 1: Create Init Script | 45 min |
| Phase 2: Update Ralph Loop Templates | 30 min |
| Phase 3: Testing | 45 min |
| **Total** | **2 hours** |

---

## Comparison with Previous Approaches

| Aspect | `--browserUrl` Approach | `--isolated` Approach (Current) |
|--------|-------------------------|--------------------------------|
| Per-worktree MCP config | Required | Not needed |
| Manual Chrome launch | Required | Not needed |
| Parallel within worktree | ❌ No | ✅ Yes |
| Auth persistence | ✅ Yes | ❌ No (login each session) |
| Complexity | Higher | Lower |
| Files to manage | More | Fewer |

**Trade-off:** We accept per-session login in exchange for simpler setup and true parallel support.
