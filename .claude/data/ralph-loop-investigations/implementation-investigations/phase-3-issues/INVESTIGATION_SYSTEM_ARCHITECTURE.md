# System Architecture Investigation: Parallel Browser Access in Ralph Loop

**Date**: January 19, 2026
**Purpose**: Design system architecture for supporting parallel browser instance coordination in Ralph Loop automation
**Status**: Completed Investigation

---

## Executive Summary

Ralph Loop currently spawns sequential Claude sessions that share a single Chrome DevTools MCP connection. This creates bottlenecks for parallel feature implementation and risks of browser state conflicts. This investigation proposes a multi-layered architecture supporting both sequential and parallel browser access patterns while maintaining session isolation and resource efficiency.

---

## 1. Current MCP Configuration Analysis

### 1.1 Current Setup

**Settings Location**: `.claude/settings.local.json`

```json
{
  "enableAllProjectMcpServers": true,
  "enabledMcpjsonServers": ["supabase"]
}
```

**Chrome DevTools MCP Usage**:
- Enabled via `enableAllProjectMcpServers: true`
- Provides browser automation via Chrome DevTools Protocol (CDP)
- Currently assumes single Chrome instance with remote debugging enabled
- Default CDP port: `9222`

**Current Permission Grants**:
- `mcp__chrome-devtools__*` - All Chrome DevTools operations permitted
- `mcp__playwright__browser_*` - Playwright browser operations also available

### 1.2 MCP Server Lifecycle Management

The Claude CLI manages MCP servers automatically:

1. **Server Startup**: Triggered when Claude session needs MCP tools
2. **Connection Management**: Auto-establishes connection to CDP port 9222
3. **Session Lifetime**: Server persists for duration of Claude session
4. **Cleanup**: Automatic when session ends (connection closes)

**Key Finding**: MCP servers are spawned per Claude session, NOT globally managed. Each `claude` command creates its own MCP context.

### 1.3 Chrome DevTools Protocol (CDP) Connection Model

**Single Connection Model** (Current):
- One CDP connection per Chrome process
- Multiple tabs can be accessed through single CDP connection
- Port 9222 is standard CDP debugging port

**Limitations**:
- If multiple Claude sessions try to connect simultaneously, they share CDP connection
- Can cause race conditions on browser state (navigation, clicks)
- No native concept of "session ownership" in CDP

---

## 2. Proposed System Architecture

### 2.1 Three-Tier Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    ORCHESTRATION LAYER                           │
│  ralph-orchestrator.sh - Manages feature queue and iteration   │
│  Decision: Sequential vs Parallel execution per feature         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                 SESSION COORDINATION LAYER                       │
│  Browser Session Manager - Allocates browser instances to tasks │
│  Port Registry - Tracks which ports are in use                  │
│  Lock Mechanism - Prevents resource conflicts                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   EXECUTION LAYER                                │
│  Claude Sessions - Execute individual features                  │
│  Git Worktrees - Isolated code environments (optional)          │
│  Browser Instances - Dev servers with unique ports             │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Browser Instance Management Strategy

**Recommendation**: Hybrid Model - Sequential-by-default, Parallel-capable

#### Sequential Execution (Current Model - Recommended)
```bash
# ralph-orchestrator.sh runs features one at a time
Iteration 1: Feature A → Claude Session → Dev Server (port 5007) → Chrome DevTools
             (3-5 minutes)
Iteration 2: Feature B → Claude Session → Dev Server (port 5007) → Chrome DevTools
             (3-5 minutes)
```

**Advantages**:
- Single dev server instance
- No port conflicts
- Minimal resource usage
- Simpler debugging
- Current setup works

**Limitations**:
- Cannot parallelize independent features
- Total time = sum of all feature times

#### Parallel Execution (Advanced Model - For Future)
```bash
# Multiple Ralph Loop orchestrators run simultaneously
┌─ Ralph Loop 1: Feature A → Worktree 1 → Dev Server (port 5008) → Chrome 1
├─ Ralph Loop 2: Feature B → Worktree 2 → Dev Server (port 5009) → Chrome 2
└─ Ralph Loop 3: Feature C → Worktree 3 → Dev Server (port 5010) → Chrome 3
```

**Trade-offs**:
- Increases total resource usage (multiple Node processes, Chrome tabs)
- Requires elaborate port/profile management
- Needs distributed lock mechanism
- Better parallelization of unrelated features

**Decision**: **Recommend staying with sequential model** unless feature implementation time becomes critical bottleneck.

---

## 3. Session Coordination Strategy

### 3.1 Sequential Model (Recommended Implementation)

```bash
# .claude/scripts/ralph-loop/session-manager.sh
SESSION_MANAGER_LOCK_FILE="/tmp/ralph-loop-session.lock"

acquire_session_lock() {
    local timeout=300
    local elapsed=0

    while [ -f "$SESSION_MANAGER_LOCK_FILE" ]; do
        if [ $elapsed -gt $timeout ]; then
            echo "ERROR: Session lock timeout"
            return 1
        fi
        sleep 1
        elapsed=$((elapsed + 1))
    done

    # Atomic lock creation
    mkdir -p "$(dirname "$SESSION_MANAGER_LOCK_FILE")"
    echo "$$" > "$SESSION_MANAGER_LOCK_FILE"
    return 0
}

release_session_lock() {
    rm -f "$SESSION_MANAGER_LOCK_FILE"
}
```

**Implementation in ralph-orchestrator.sh**:
```bash
# Before running Claude session
if ! acquire_session_lock; then
    log_session "$iteration" "$attempt" "lock_timeout"
    return 1
fi

# Run iteration
claude --model "$model" ... || exit_code=$?

# Always release lock
release_session_lock
```

**Advantages**:
- Simple to implement
- Guarantees browser state consistency
- Works with current Chrome setup
- Easy to debug

### 3.2 Future Parallel Model (Reference Design)

For future consideration when parallelizing independent features:

```bash
# .claude/scripts/ralph-loop/port-registry.sh
PORT_REGISTRY_FILE="/tmp/ralph-loop-ports.json"

register_port() {
    local feature_id="$1"
    local port="$2"

    # Atomic update: read-modify-write with lock
    flock -x 10
    jq --arg id "$feature_id" --arg port "$port" \
       '.[$id] = $port' "$PORT_REGISTRY_FILE" \
       > "$PORT_REGISTRY_FILE.tmp"
    mv "$PORT_REGISTRY_FILE.tmp" "$PORT_REGISTRY_FILE"
    flock -u 10
}

get_available_port() {
    local start_port=5008
    local max_port=5100

    for port in $(seq $start_port $max_port); do
        if ! grep -q "\"$port\"" "$PORT_REGISTRY_FILE"; then
            if ! lsof -Pi :$port -sTCP:LISTEN -t > /dev/null; then
                echo $port
                return 0
            fi
        fi
    done

    return 1
}
```

---

## 4. Authentication Workflow Design

### 4.1 Login Pattern for Automated Sessions

**Challenge**: How to handle credential input without exposing secrets in prompts?

**Solution**: Environment-based Credential Pre-staging

```bash
# ralph-orchestrator.sh - Before spawning Claude session

setup_session_credentials() {
    local feature_json="$1"
    local needs_auth=$(echo "$feature_json" | jq -r '.requiresAuth // false')

    if [ "$needs_auth" = true ]; then
        # Create temporary credential file
        local cred_file="/tmp/ralph-loop-creds-$$.json"

        # Read from secure location (encrypted vault, env vars, keychain)
        {
            jq -n \
                --arg user "$AUTOMATION_USERNAME" \
                --arg pass "$AUTOMATION_PASSWORD" \
                '{username: $user, password: $pass}'
        } > "$cred_file"

        # Pass file path to Claude via environment variable
        export RALPH_CREDS_FILE="$cred_file"

        # Clean up after session
        trap "rm -f $cred_file" RETURN
    fi
}
```

**RALPH_PROMPT.md Integration**:
```markdown
## Authentication

If `process.env.RALPH_CREDS_FILE` is set:
1. Read credentials from that file path
2. Use automated login before feature testing
3. Delete file after login (security)

Example:
```javascript
const credsFile = process.env.RALPH_CREDS_FILE;
if (credsFile && fs.existsSync(credsFile)) {
    const creds = JSON.parse(fs.readFileSync(credsFile, 'utf8'));
    await page.fill('input[name="username"]', creds.username);
    await page.fill('input[name="password"]', creds.password);
    await page.click('button[type="submit"]');
    await page.waitForNavigation();
    fs.unlinkSync(credsFile); // Clean up
}
```
```

**Security Considerations**:
1. Never pass credentials in prompt text
2. Use file path variables instead
3. Always clean up credential files after use
4. Consider OS-level credential stores:
   - macOS: Keychain
   - Linux: Secret Service
   - Windows: Credential Manager

### 4.2 Credential Sources (Priority Order)

1. **System Keychain** (Most Secure)
   - `security find-generic-password -s "ralph-loop" -w` (macOS)
   - `secret-tool lookup automation credentials` (Linux)

2. **Encrypted Env Files** (Medium Security)
   - `.env.local` (gitignored, encrypted at rest)
   - Requires key management

3. **GitHub Secrets** (For CI/CD Only)
   - Not applicable for local Ralph Loop
   - Use only if running in GitHub Actions

4. **Temporary Files** (Current Fallback)
   - File-based with secure cleanup
   - Moderate risk if not cleaned properly

---

## 5. Ralph Loop Orchestration Modifications

### 5.1 Current Orchestrator Architecture

**File**: `.claude/scripts/ralph-loop/ralph-orchestrator.sh`

Current flow:
```
validate_environment()
  ↓
for iteration in 1..MAX_ITERATIONS
  ├─ get_incomplete_features()
  ├─ run_iteration_with_retry()
  │   ├─ check_browser_health()
  │   └─ claude --model "$model" ... (spawn session)
  └─ sleep 3s
```

### 5.2 Proposed Enhanced Architecture

```bash
# .claude/scripts/ralph-loop/ralph-orchestrator-v3.sh

main() {
    # Layer 0: Pre-flight validation (unchanged)
    validate_environment "$RALPH_DIR"

    # Layer 1: Session coordination setup (NEW)
    init_session_registry
    init_port_registry  # For future parallel use

    # Layer 2: Main loop (modified)
    for iteration in $(seq 1 $MAX_ITERATIONS); do
        # NEW: Acquire session lock for sequential safety
        if ! acquire_session_lock; then
            log_session "$iteration" "1" "lock_failed"
            continue
        fi

        # Existing: Get next feature and model
        local next_feature=$(get_next_feature)
        local model=$(get_feature_model "$next_feature")

        # NEW: Check for auth requirements
        setup_session_credentials "$next_feature"

        # Existing: Run with retry
        if ! run_iteration_with_retry "$iteration" "$model" "$next_feature"; then
            log_session "$iteration" "$attempt" "feature_failed"
        fi

        # NEW: Release lock
        release_session_lock

        # Existing: Pause between iterations
        sleep 3
    done
}
```

### 5.3 init.sh Enhancement

Current `init.sh`:
- Checks frontend/backend servers running
- Verifies build passes

**Enhanced version should also**:
```bash
# NEW: Ensure Chrome has DevTools debugging enabled
check_chrome_debugging() {
    if ! curl -s http://localhost:9222/json > /dev/null 2>&1; then
        echo "❌ Chrome DevTools not accessible on port 9222"
        echo "   Start Chrome with: open -a 'Google Chrome' --args --remote-debugging-port=9222"
        return 1
    fi
    echo "✓ Chrome debugging enabled (port 9222)"
}

# NEW: Verify clean session state
clean_session_state() {
    # Clear any stale lock files
    rm -f /tmp/ralph-loop-session.lock
    rm -f /tmp/ralph-loop-ports.json

    # Reset port registry
    echo '{}' > /tmp/ralph-loop-ports.json

    echo "✓ Session state cleaned"
}
```

---

## 6. Worktree-Specific Configuration

### 6.1 Worktree Structure for Parallel Execution

If implementing parallel features in future:

```
/project
├── UberEats-Image-Extractor/
│   ├── .env (port 3007, vite port 5007)
│   └── vite.config.ts
│
├── trees/
│   ├── feature-1/
│   │   ├── UberEats-Image-Extractor/
│   │   │   ├── .env (port 3008, API URL localhost:3008)
│   │   │   └── vite.config.ts (port 5008)
│   │   └── .git/
│   │
│   └── feature-2/
│       ├── UberEats-Image-Extractor/
│       │   ├── .env (port 3009, API URL localhost:3009)
│       │   └── vite.config.ts (port 5009)
│       └── .git/
```

### 6.2 Port Assignment Algorithm

For parallel worktrees, use deterministic port allocation:

```bash
# .claude/scripts/ralph-loop/port-allocator.sh

allocate_port_for_worktree() {
    local worktree_index="$1"  # 0, 1, 2, ...
    local base_backend_port=3007
    local base_frontend_port=5007

    local backend_port=$((base_backend_port + worktree_index + 1))
    local frontend_port=$((base_frontend_port + worktree_index + 1))

    # Verify ports are available
    if lsof -Pi :$backend_port -sTCP:LISTEN -t > /dev/null; then
        echo "ERROR: Port $backend_port already in use"
        return 1
    fi

    echo "$backend_port:$frontend_port"
}

# Usage
ports=$(allocate_port_for_worktree 0)
backend_port="${ports%:*}"
frontend_port="${ports##*:}"
```

### 6.3 MCP Server Per Worktree (Advanced)

Currently not implemented, but feasible design:

```bash
# For truly isolated parallel sessions, each could have own MCP configuration
# via .claude/mcp.json per worktree

# .claude/mcp.json (project-level default)
{
  "chrome": {
    "port": 9222  // Main instance
  }
}

# trees/feature-1/.claude/mcp.json (worktree override)
{
  "chrome": {
    "port": 9223  // Separate debugging port
  }
}
```

**Requirement**: Claude CLI would need support for `.claude/mcp.json` hierarchical resolution.

---

## 7. Resource Considerations

### 7.1 Sequential Model Resource Profile

**Single Running Iteration**:
- Chrome process: ~200-400 MB RAM
- Node dev server (Vite): ~100-150 MB RAM
- Node backend server: ~80-150 MB RAM
- Claude session (MCP overhead): ~50-100 MB RAM
- **Total**: ~430-800 MB per active iteration

**Typical Session**:
- Max 1 iteration running at a time
- Background: previous logs, feature lists (~10 MB)
- **Total sustained**: ~450-850 MB

### 7.2 Parallel Model Resource Profile (3 Worktrees)

**Hypothetical 3-feature Parallel**:
- 3x Chrome processes: ~600-1200 MB
- 3x Vite dev servers: ~300-450 MB
- 3x Node backends: ~240-450 MB
- 3x Claude sessions: ~150-300 MB
- **Total**: ~1.3-2.4 GB RAM

**CPU Impact**:
- Sequential: Single feature test at a time, even CPU utilization
- Parallel: 3-4x CPU spikes during compilation/dev server startup

**Disk I/O**:
- Sequential: Single dev server hot-reload cache
- Parallel: 3 separate node_modules, 3 build caches

**Recommendation**: Sequential model appropriate for most machines. Consider parallel only if:
- Machine has 16GB+ RAM available
- Features are truly independent (no shared state)
- Total time savings > 30% (parallelization overhead)

---

## 8. Authentication Workflow Implementation

### 8.1 Complete Login Flow Example

Feature requires logged-in state:

```markdown
# RALPH_PROMPT.md

## Prerequisites

1. **Auto-login handling**:
   - If `process.env.RALPH_CREDS_FILE` is set, use it for login
   - Otherwise, assume user is already logged in

2. **State verification**:
   - Check for logged-in indicators (user avatar, logged-in URL)
   - If not logged in and no credentials, return error

## Authentication Code Template

\`\`\`javascript
// At start of test, before any feature work
async function ensureLoggedIn(page) {
    const currentUrl = page.url();
    const isLoggedIn = currentUrl.includes('/dashboard') ||
                      await page.$('[data-testid="user-avatar"]');

    if (!isLoggedIn && process.env.RALPH_CREDS_FILE) {
        // Use provided credentials
        const credsFile = process.env.RALPH_CREDS_FILE;
        const fs = require('fs');
        const creds = JSON.parse(fs.readFileSync(credsFile, 'utf8'));

        // Navigate to login
        await page.goto('http://localhost:5007/login');

        // Fill and submit login form
        await page.fill('input[name="email"]', creds.username);
        await page.fill('input[name="password"]', creds.password);
        await page.click('button[type="submit"]');

        // Wait for dashboard
        await page.waitForURL('**/dashboard', { timeout: 5000 });

        // Clean up credentials file
        fs.unlinkSync(credsFile);
    }
}
\`\`\`
```

### 8.2 Environment Variable Setup

In `ralph-orchestrator.sh`:

```bash
# Read credentials from system keychain (macOS example)
get_credentials() {
    local creds_json=$(security find-generic-password -s "ralph-loop" -w | base64 -D)
    echo "$creds_json"
}

# Create temporary credential file
setup_session_credentials() {
    local feature_json="$1"
    local needs_auth=$(echo "$feature_json" | jq -r '.requiresAuth // false')

    if [ "$needs_auth" = true ]; then
        # Create secure temp file with restrictive permissions
        local cred_file=$(mktemp)
        chmod 600 "$cred_file"

        get_credentials > "$cred_file"
        export RALPH_CREDS_FILE="$cred_file"

        # Register cleanup trap
        trap "rm -f '$cred_file'" RETURN INT TERM
    fi
}
```

### 8.3 Credential Lifecycle

```
1. Feature requires auth? Check feature_list.json
   ↓
2. Read from system keychain (encrypted)
   ↓
3. Write to temporary secure file (/tmp, 600 perms)
   ↓
4. Pass file path via RALPH_CREDS_FILE env var
   ↓
5. Claude session reads and uses file
   ↓
6. File deleted immediately after login
   ↓
7. Session proceeds with authenticated browser state
```

---

## 9. Changes Needed to Ralph Loop Orchestration

### 9.1 Core Changes to `ralph-orchestrator.sh`

1. **Add session coordination module**:
   ```bash
   source "$SCRIPT_DIR/session-coordinator.sh"
   ```

2. **Wrap iteration execution**:
   ```bash
   # Before run_iteration_with_retry
   acquire_session_lock
   setup_session_credentials "$next_feature"

   # After run_iteration_with_retry
   release_session_lock
   cleanup_session_credentials
   ```

3. **Enhanced logging**:
   ```bash
   log_session_event() {
       local iteration="$1"
       local event="$2"
       local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
       echo "$timestamp | Iteration $iteration | $event" >> "$LOG_DIR/session-events.log"
   }
   ```

### 9.2 New Helper Scripts Required

| Script | Purpose |
|--------|---------|
| `session-coordinator.sh` | Lock/unlock mechanisms |
| `port-allocator.sh` | Port management for parallel (future) |
| `credential-manager.sh` | Auth credential handling |
| `mcp-monitor.sh` | MCP connection health checks |

### 9.3 init.sh Enhancements

```bash
#!/bin/bash
# Enhanced init.sh with session setup

# 1. Validate environment (existing)
validate_environment "$RALPH_DIR"

# 2. Check Chrome debugging (NEW)
if ! check_chrome_debugging; then
    exit 1
fi

# 3. Clean session state (NEW)
clean_session_state

# 4. Verify credentials available (NEW - conditional)
if grep -q '"requiresAuth": true' "$RALPH_DIR/feature_list.json"; then
    if ! verify_credentials_available; then
        echo "WARNING: Some features require auth, but credentials not configured"
        echo "Set up keychain credentials or RALPH_CREDS_FILE"
    fi
fi

echo "✅ Ralph Loop environment ready"
```

---

## 10. Recommendations Summary

### 10.1 Immediate Implementation (Phase 1)

**Status**: Low Risk, High Confidence

1. Add session lock mechanism to prevent concurrent Claude sessions
2. Enhance `init.sh` with Chrome debugging verification
3. Add credential file handling for auth-required features
4. Implement session event logging for debugging

**Estimated Effort**: 2-3 hours
**Files to Modify**:
- `ralph-orchestrator.sh` (add ~30 lines)
- `init.sh` (add ~40 lines)

**Files to Create**:
- `session-coordinator.sh` (100 lines)
- `credential-manager.sh` (80 lines)

### 10.2 Medium-term Enhancement (Phase 2)

**Status**: Medium Risk, Requires Testing

1. Implement port registry system (future-proofing for parallel)
2. Add worktree template system for parallel execution prep
3. Create comprehensive MCP health monitoring
4. Add detailed session coordination diagnostics

**Estimated Effort**: 4-6 hours
**Prerequisites**: Phase 1 completion

### 10.3 Advanced Implementation (Phase 3+)

**Status**: High Risk, Requires Significant Testing

1. Parallel feature execution with lock-free port allocation
2. Multi-worktree orchestration
3. Distributed MCP server management
4. Advanced resource pooling

**Prerequisites**:
- Proof that parallelization improves total time by >30%
- Machines available with 16GB+ RAM
- Complex feature dependency graph analysis

**Recommendation**: **Defer unless sequential Ralph Loop becomes bottleneck**

### 10.4 Stay Sequential, Enhance Within Single Session

**Recommended Approach**:
1. Keep orchestrator simple and sequential
2. Improve individual session capability
3. Allow longer timeout per feature (currently 3s pause)
4. Optimize feature decomposition to reduce total iterations
5. Use session parallelization for verification (different browser tabs)

---

## 11. Implementation Checklist

### Phase 1: Session Coordination (Immediate)

- [ ] Create `session-coordinator.sh` with lock primitives
- [ ] Create `credential-manager.sh` with keychain integration
- [ ] Modify `ralph-orchestrator.sh` to use session locks
- [ ] Enhance `init.sh` with Chrome debugging check
- [ ] Add environment variable documentation to RALPH_PROMPT.md
- [ ] Test with existing dashboard-update-v4 Ralph Loop
- [ ] Verify no regressions in sequential execution
- [ ] Add session coordination logging

### Phase 2: Monitoring & Diagnostics (1-2 weeks)

- [ ] Create `mcp-monitor.sh` for connection health
- [ ] Add MCP error categorization to logs
- [ ] Implement session timeline visualization
- [ ] Create debugging guide for common session issues
- [ ] Document credential setup procedures

### Phase 3: Future Parallelization (Conditional)

- [ ] Design port allocation algorithm
- [ ] Create worktree template system
- [ ] Implement parallel orchestrator variant
- [ ] Load-test with 3+ concurrent features
- [ ] Measure resource usage vs time savings

---

## 12. Reference Architecture Diagrams

### Data Flow for Authenticated Feature

```
┌─────────────────────────────────────────────────────────────┐
│ Ralph Orchestrator (Main Process)                           │
│                                                             │
│  feature_list.json ──┐                                      │
│                      ├─→ get_next_feature()                │
│  progress.txt ───────┘                                      │
│                                                             │
│  ┌────────────────────────────────────────────────────┐   │
│  │ For auth-required features:                         │   │
│  │  1. Read creds from keychain                        │   │
│  │  2. Write to /tmp/creds-$$.json (600 perms)       │   │
│  │  3. export RALPH_CREDS_FILE=/tmp/creds-$$.json    │   │
│  │  4. Spawn Claude session                           │   │
│  │  5. Clean up after session                         │   │
│  └────────────────────────────────────────────────────┘   │
│                                                             │
│  Acquires Lock ──────→ /tmp/ralph-loop-session.lock       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────┐
│ Claude CLI Session (Child Process)                          │
│                                                             │
│  Reads: RALPH_CREDS_FILE env var                          │
│  Spawns: Chrome DevTools MCP to port 9222                 │
│                                                             │
│  RALPH_PROMPT.md:                                          │
│    - Check for RALPH_CREDS_FILE                           │
│    - If set: ensureLoggedIn() → delete file after login   │
│    - Then: proceed with feature implementation            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────┐
│ Browser Automation                                          │
│                                                             │
│  Chrome Tab (via CDP)                                       │
│  ├─ mcp__chrome-devtools__navigate_page                   │
│  ├─ mcp__chrome-devtools__evaluate_script                 │
│  ├─ mcp__chrome-devtools__click                          │
│  ├─ mcp__chrome-devtools__take_screenshot                │
│  └─ mcp__chrome-devtools__list_console_messages          │
│                                                             │
│  Dev Server (http://localhost:5007)                        │
│  Frontend (React/Vite)                                     │
│  Backend (Node.js port 3007)                              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────┐
│ Ralph Orchestrator (Main Process)                           │
│                                                             │
│  Session Complete:                                          │
│  1. Release lock (/tmp/ralph-loop-session.lock)           │
│  2. Update feature_list.json (passes: true)              │
│  3. Log iteration result to progress.txt                  │
│  4. Sleep 3s                                              │
│  5. Next iteration                                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### MCP Connection States

```
Initial State:
  ├─ Chrome process running
  ├─ CDP port 9222 listening
  └─ No MCP client connected

Claude Session 1:
  ├─ Connects to port 9222
  ├─ Establishes CDP session
  ├─ Browser operations execute
  └─ Session ends, connection closes

Transition:
  ├─ Port 9222 still listening
  ├─ Previous session cleaned up
  └─ Ready for next client

Claude Session 2:
  ├─ Connects to port 9222 (same as Session 1)
  ├─ Gets fresh CDP session
  ├─ Browser operations execute
  └─ Session ends

Sequential Safety:
  • Lock ensures Session 2 doesn't start until Session 1 fully completes
  • Prevents race conditions on browser state
  • No CDP connection sharing between sessions
```

---

## 13. Conclusion

The proposed system architecture maintains Ralph Loop's simplicity while adding coordination mechanisms for future scalability:

1. **Sequential Model** (Recommended): Keep current workflow, add session locks and credential handling. Low risk, immediate value.

2. **Parallel-Ready Infrastructure**: Port registry and worktree templates positioned for future use without active complexity.

3. **Security-First Credentials**: Credentials never exposed in prompts, always managed via environment files or system keychains.

4. **MCP Reliability**: Chrome DevTools remains single-connection model (sufficient), with health monitoring preventing stale connections.

5. **Extensible Logging**: Session coordination events fully logged for debugging and optimization analysis.

This architecture supports current Ralph Loop operations while providing clear path to parallelization if needed.

---

## Appendix A: Quick Reference - Session Coordination APIs

```bash
# Lock Management
source session-coordinator.sh

acquire_session_lock      # Blocks until lock available
release_session_lock      # Immediately releases lock
is_lock_held             # Check without blocking

# Credentials
source credential-manager.sh

get_credentials_from_keychain "$service_name"
write_secure_temp_file "$data"          # Returns path
ensure_temp_cleanup "$file_path"        # Setup trap

# Monitoring
source mcp-monitor.sh

check_chrome_debugging               # Verify CDP accessible
get_cdp_version                      # Returns Chrome version
is_mcp_healthy                       # Overall health status
```

---

## Appendix B: Environment Variables

| Variable | Purpose | Set By | Used In |
|----------|---------|--------|---------|
| `RALPH_CREDS_FILE` | Path to credential JSON file | orchestrator.sh | RALPH_PROMPT.md |
| `RALPH_SESSION_LOCK` | Session lock file path | orchestrator.sh | session-coordinator.sh |
| `RALPH_PORT_REGISTRY` | Port allocation registry | orchestrator.sh | port-allocator.sh |
| `RALPH_LOOP_DIR` | Current Ralph Loop directory | orchestrator.sh | All scripts |
| `RALPH_DEBUG` | Enable verbose logging | User (optional) | All scripts |

---

**Document Version**: 1.0
**Last Updated**: January 19, 2026
**Next Review**: After Phase 1 implementation
