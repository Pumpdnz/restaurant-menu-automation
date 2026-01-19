# Phase 3: Parallel Browser Verification - Progress Summary

**Date:** January 19, 2026
**Status:** ✅ COMPLETE
**Duration:** ~2 hours

---

## Problem Statement

Ralph Loop sessions running in parallel worktrees experienced browser conflicts when using Chrome DevTools MCP. The error:

```
Error: The browser is already running for /Users/giannimunro/.cache/chrome-devtools-mcp/chrome-profile
```

Multiple concurrent Claude sessions could not use browser verification tools simultaneously.

---

## Investigation Journey

### Initial Approaches Considered

1. **`--browserUrl` with separate Chrome instances per worktree**
   - Each worktree would have its own Chrome on a unique debugging port (9222, 9223, etc.)
   - Required per-worktree `.mcp.json` configuration
   - Required manual Chrome launching
   - ❌ **Rejected:** Would prevent parallel processes *within* a worktree

2. **Playwright MCP migration**
   - Native browser context isolation
   - Storage state API for auth sharing
   - ❌ **Rejected:** Overcomplicated for the use case

3. **`--isolated` flag (existing configuration)**
   - Each MCP session creates its own temporary Chrome profile
   - No configuration needed per worktree
   - Supports parallel processes both across AND within worktrees
   - ✅ **Selected:** Simplest solution, already configured

### Key Insight

The `--isolated` flag was already configured in `~/.claude.json` and solves the parallel conflict problem automatically. Each Claude session spawns its own isolated Chrome instance with a temporary profile.

**Trade-off:** Authentication state is not persisted between sessions. Each session must log in fresh.

**Solution:** Add authentication step to Ralph Loop workflow.

---

## Final Architecture

```
Terminal 1                    Terminal 2                    Terminal 3
    │                             │                             │
    ▼                             ▼                             ▼
trees/feature-1/              trees/feature-2/              trees/feature-3/
├── UberEats-Image-Extractor/ ├── UberEats-Image-Extractor/ ├── UberEats-Image-Extractor/
│   ├── .env (PORT=3008)      │   ├── .env (PORT=3009)      │   ├── .env (PORT=3010)
│   └── vite.config.ts (5008) │   └── vite.config.ts (5009) │   └── vite.config.ts (5010)
└── .ralph-config             └── .ralph-config             └── .ralph-config

Browser: --isolated flag (automatic)
Each Claude session spawns its own isolated Chrome instance
```

### Port Allocation

| Worktree | Backend | Frontend | Tmux Session |
|----------|---------|----------|--------------|
| Main     | 3007    | 5007     | (manual)     |
| 1        | 3008    | 5008     | worktree-{name}-1 |
| 2        | 3009    | 5009     | worktree-{name}-2 |
| 3        | 3010    | 5010     | worktree-{name}-3 |

---

## Implementation Completed

### 1. Worktree Initialization Script

**File:** `.claude/scripts/init-parallel-worktree.sh`

**Features:**
- Creates git worktree on feature branch
- Copies and updates `.env` with unique ports
- Updates `vite.config.ts` with unique port and proxy target
- Creates `.ralph-config` for reference
- Installs npm dependencies (with `--legacy-peer-deps`)
- Starts dev server in named tmux session
- Verifies servers are running on correct ports

**Usage:**
```bash
./.claude/scripts/init-parallel-worktree.sh dashboard-tabs 1
# Creates: trees/dashboard-tabs-1/
# Tmux: worktree-dashboard-tabs-1
# Ports: 3008/5008
```

### 2. Ralph Loop Template Updates

**File:** `.claude/skills/plan-ralph-loop/templates/RALPH_PROMPT.md.template`

**Changes:**
- Added `{TEST_USER_EMAIL}` and `{TEST_USER_PASSWORD}` to configuration table
- Added step 7 "Authenticate if required" to Session Start Procedure
- Added new "Session Authentication" section with:
  - Authentication steps
  - Explanation of why auth is needed (--isolated mode)
  - Troubleshooting tips

### 3. Init Script Template Updates

**File:** `.claude/skills/plan-ralph-loop/templates/init.sh.template`

**Changes:**
- Added logic to load `.ralph-config` if present (overrides template defaults)
- Added note about browser isolation mode requiring authentication

### 4. Gitignore Updates

**File:** `.gitignore`

**Added:**
```
# Parallel Worktrees
trees/
.ralph-config
```

---

## Testing Results

### Full Workflow Test

1. ✅ Worktree created at `trees/test-parallel-1/`
2. ✅ `.env` updated with `PORT=3008` and `VITE_RAILWAY_API_URL=http://localhost:3008`
3. ✅ `vite.config.ts` updated with port 5008 and proxy to 3008
4. ✅ `.ralph-config` created with all port settings
5. ✅ npm dependencies installed successfully
6. ✅ Dev server started in tmux session `worktree-test-parallel-1`
7. ✅ Backend verified running on port 3008
8. ✅ Frontend verified running on port 5008
9. ✅ Worktree cleanup successful

---

## Files Changed

| File | Type | Description |
|------|------|-------------|
| `.claude/scripts/init-parallel-worktree.sh` | New | Worktree initialization with tmux |
| `.claude/skills/plan-ralph-loop/templates/RALPH_PROMPT.md.template` | Modified | Auth section + config vars |
| `.claude/skills/plan-ralph-loop/templates/init.sh.template` | Modified | Load .ralph-config |
| `.gitignore` | Modified | Added trees/, .ralph-config |

---

## Usage Guide

### Creating Parallel Worktrees

```bash
# From main worktree root
cd /Users/giannimunro/Desktop/cursor-projects/automation

# Create worktree 1 for feature A
./.claude/scripts/init-parallel-worktree.sh feature-a 1

# Create worktree 2 for feature B
./.claude/scripts/init-parallel-worktree.sh feature-b 2

# Create worktree 3 for feature C
./.claude/scripts/init-parallel-worktree.sh feature-c 3
```

### Managing Tmux Sessions

```bash
# List all sessions
tmux list-sessions

# Attach to a session
tmux attach -t worktree-feature-a-1

# Kill a session
tmux kill-session -t worktree-feature-a-1
```

### Starting Ralph Loop

```bash
# In a new terminal
cd trees/feature-a-1
claude --print 'run /ralph-loop'
```

### Cleanup

```bash
# Stop server
tmux kill-session -t worktree-feature-a-1

# Remove worktree
git worktree remove trees/feature-a-1 --force
git branch -D feature-a-1
```

---

## What We Didn't Need

| Original Consideration | Why Not Needed |
|------------------------|----------------|
| Per-worktree `.mcp.json` | `--isolated` handles browser isolation automatically |
| Chrome debugging ports | `--isolated` spawns fresh Chrome per session |
| `--browserUrl` configuration | Would limit parallel processes within worktree |
| Manual Chrome launching | MCP handles it with `--isolated` |
| Playwright MCP migration | Chrome DevTools MCP works with `--isolated` |
| Cross-worktree coordination | Each worktree is fully independent |

---

## Key Learnings

1. **Simpler is better:** The `--isolated` flag already solved the core problem
2. **Independent processes:** Each worktree as a standalone process eliminates coordination complexity
3. **Trade-offs are acceptable:** Per-session login is a small price for full parallelism
4. **Tmux for visibility:** Named tmux sessions make server management easy
5. **Port allocation:** Simple formula `base_port + worktree_number` avoids conflicts

---

## Related Documents

| Document | Path |
|----------|------|
| Investigation Plan | `./INVESTIGATION_PLAN.md` |
| Revised Implementation Plan | `./REVISED_IMPLEMENTATION_PLAN.md` |
| Playwright Investigation | `./INVESTIGATION_PLAYWRIGHT_PARALLEL.md` |
| Phase 2 Solution | `../phase-2-issues/BROWSER_VERIFICATION_SOLUTION.md` |

---

## Next Steps (Optional Enhancements)

1. **Integrate into plan-ralph-loop workflow** - Integrate worktree initialization script into existing plan-ralph-loop workflow or create a new dedicated workflow for parallel Ralph Loop execution
2. **Automated cleanup script** - Script to stop all worktree tmux sessions and remove worktrees
3. **Health check endpoint** - Add `/health` endpoint to verify server status programmatically
4. **Auth caching** - Investigate if auth tokens can be pre-seeded to reduce login time
5. **Parallel launcher** - Script to initialize multiple worktrees in one command

---

## Conclusion

Phase 3 parallel browser verification is now fully functional. The solution leverages existing `--isolated` MCP configuration with per-worktree dev server port allocation. Implementation took approximately 2 hours versus the original estimate of 2-3 weeks for more complex approaches.

**Status:** ✅ COMPLETE
