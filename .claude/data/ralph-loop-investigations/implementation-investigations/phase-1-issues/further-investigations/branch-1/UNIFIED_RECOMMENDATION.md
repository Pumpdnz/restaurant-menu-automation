# Branch 1: Unified Recommendation

## Critical Correction: Fresh Sessions Per Feature

**Core Ralph Loop Principle**: Each feature gets a **fresh session** to avoid context rot. The Stop hook `"decision": "block"` approach I initially suggested would keep the same session running indefinitely - this is the **opposite** of what Ralph Loop requires.

**Correct Understanding**:
```
Session 1 → Feature 1 → Exits (fresh context consumed)
Session 2 → Feature 2 → Exits (fresh context consumed)
Session 3 → Feature 3 → Exits (fresh context consumed)
...
```

NOT:
```
Session 1 → Feature 1 → blocks → Feature 2 → blocks → Feature 3 → ...
(Context rot accumulates - defeats the purpose)
```

---

## Architecture Recommendation

### Two-Layer Design

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        ORCHESTRATION LAYER                               │
│                     (Deterministic Loop Control)                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   OPTION A: Outer Bash Loop          OPTION B: Stop Hook Spawner        │
│   ┌─────────────────────────┐        ┌─────────────────────────┐        │
│   │ while [incomplete]; do  │        │ Session completes       │        │
│   │   claude "PROMPT.md"    │   OR   │ Stop hook fires         │        │
│   │   sleep 3               │        │ Hook spawns new session │        │
│   │ done                    │        │ (via CLI, not SDK)      │        │
│   └─────────────────────────┘        └─────────────────────────┘        │
│                                                                          │
│   Benefits:                          Benefits:                           │
│   - Simple, proven pattern           - Self-contained                    │
│   - Terminal stays open              - No external loop needed           │
│   - Easy to monitor                  - More extensible                   │
│                                                                          │
│   Drawbacks:                         Drawbacks:                          │
│   - Requires bash to keep running    - More complex                      │
│   - Less extensible                  - Hook spawning needs care          │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          SESSION LAYER                                   │
│                    (One Feature Per Session)                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   Each session:                                                          │
│   1. Starts fresh with RALPH_PROMPT.md                                   │
│   2. Reads progress.txt to understand current state                      │
│   3. Identifies next incomplete feature from feature_list.json           │
│   4. Implements OR verifies that ONE feature                             │
│   5. Updates feature_list.json (passes: true/false)                      │
│   6. Updates progress.txt with results                                   │
│   7. Exits cleanly (fresh context for next session)                      │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       OBSERVABILITY LAYER                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   Terminal UX (mprocs):              Browser UX (Claude in Chrome):      │
│   ┌─────────────────────────┐        ┌─────────────────────────┐        │
│   │ Single terminal view    │        │ Visible Chrome window   │        │
│   │ Live log streaming      │        │ Real-time browser test  │        │
│   │ Per-iteration log files │        │ User can observe        │        │
│   │ Process management      │        │ GIF/screenshot capture  │        │
│   └─────────────────────────┘        └─────────────────────────┘        │
│                                                                          │
│   File-Based Tracking:                                                   │
│   - progress.txt: Human-readable state, iteration count, session IDs    │
│   - feature_list.json: Machine-readable feature status                  │
│   - logs/iteration-N.log: Full output per iteration                     │
│   - artifacts/feature-N.gif: Verification evidence                      │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Recommended Implementation: Hybrid Approach

Combining the best of both options from the user's Alternative 1:

### Component 1: Outer Bash Orchestrator

```bash
#!/bin/bash
# ralph-orchestrator.sh
# Spawns fresh Claude sessions until all features pass or max iterations reached

RALPH_DIR="$1"
MAX_ITERATIONS="${2:-20}"
FEATURE_LIST="$RALPH_DIR/feature_list.json"
PROGRESS_TXT="$RALPH_DIR/progress.txt"
LOG_DIR="$RALPH_DIR/logs"

mkdir -p "$LOG_DIR"

for ITER in $(seq 1 $MAX_ITERATIONS); do
    echo "=== Ralph Loop Iteration $ITER/$MAX_ITERATIONS ==="

    # Check if all features pass
    INCOMPLETE=$(jq '[.features[] | select(.passes != true)] | length' "$FEATURE_LIST")
    if [ "$INCOMPLETE" -eq 0 ]; then
        echo "✅ All features pass! Loop complete."
        # Update status
        sed -i '' 's/^- Status:.*/- Status: COMPLETE/' "$PROGRESS_TXT"
        exit 0
    fi

    # Get next feature info for logging
    NEXT_FEATURE=$(jq -r '[.features[] | select(.passes != true)][0].description' "$FEATURE_LIST")
    NEXT_MODEL=$(jq -r '[.features[] | select(.passes != true)][0].model // "opus"' "$FEATURE_LIST")

    echo "Next feature: $NEXT_FEATURE"
    echo "Model: $NEXT_MODEL"

    # Update iteration count in progress.txt
    sed -i '' "s/^- Iteration:.*/- Iteration: $ITER/" "$PROGRESS_TXT"

    # Spawn fresh Claude session
    LOGFILE="$LOG_DIR/iteration-$ITER.log"
    echo "=== Iteration $ITER started at $(date) ===" > "$LOGFILE"

    claude --model "$NEXT_MODEL" \
           --dangerously-skip-permissions \
           "$(cat $RALPH_DIR/RALPH_PROMPT.md)" 2>&1 | tee -a "$LOGFILE"

    echo "=== Iteration $ITER completed at $(date) ===" >> "$LOGFILE"

    # Brief pause between iterations
    sleep 3
done

echo "⚠️ Max iterations ($MAX_ITERATIONS) reached."
sed -i '' 's/^- Status:.*/- Status: REACHED_LIMIT/' "$PROGRESS_TXT"
exit 1
```

**Why Bash Orchestrator (not Agents SDK)**:
- Claude CLI supports OAuth tokens (Max Plan works)
- Agents SDK requires API keys (Max Plan blocked)
- Simple, proven, ~99% reliable
- No dependencies beyond bash + jq

### Component 2: Stop Hook for Session Cleanup

The Stop hook runs AFTER each session completes (not to block stopping, but to ensure clean handoff):

```python
#!/usr/bin/env python3
"""
ralph_session_cleanup.py

Stop hook that runs when a Ralph session ends.
Does NOT block stopping - ensures clean state before exit.
"""

import json
import sys
import os
from pathlib import Path
from datetime import datetime

def main():
    # Read hook input
    try:
        stdin_data = json.loads(sys.stdin.read())
        session_id = stdin_data.get('session_id', 'unknown')
    except:
        session_id = 'unknown'

    ralph_dir = os.environ.get('RALPH_LOOP_DIR')
    if not ralph_dir:
        sys.exit(0)  # Not a Ralph session

    loop_path = Path(ralph_dir)
    progress_path = loop_path / 'progress.txt'

    # Log session completion to progress.txt
    try:
        content = progress_path.read_text()
        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M')

        # Append session to history if tracking section exists
        if '## Session History' in content:
            # Find current iteration
            for line in content.split('\n'):
                if line.startswith('- Iteration:') and 'Max' not in line:
                    current_iter = line.split(':')[1].strip().split()[0]
                    break
            else:
                current_iter = '?'

            # Append to history
            history_line = f"| {current_iter} | {session_id} | {timestamp} | completed |"
            content = content.replace('## Session History',
                                      f'## Session History\n{history_line}')
            progress_path.write_text(content)
    except Exception as e:
        print(f"Warning: Could not update progress.txt: {e}", file=sys.stderr)

    # Allow session to stop (return null decision)
    print(json.dumps({"decision": None, "session_id": session_id}))
    sys.exit(0)

if __name__ == '__main__':
    main()
```

### Component 3: Permission Configuration

`.claude/settings.local.json`:
```json
{
  "permissions": {
    "allow": [
      "Read",
      "Glob",
      "Grep",
      "Edit",
      "Write",
      "Task",
      "WebFetch",
      "Bash(npm:*)",
      "Bash(npx:*)",
      "Bash(node:*)",
      "Bash(git:*)",
      "Bash(ls:*)",
      "Bash(pwd)",
      "Bash(cat:*)",
      "Bash(mkdir:*)",
      "Bash(jq:*)",
      "mcp__supabase__*",
      "mcp__firecrawl__*",
      "mcp__claude-in-chrome__*"
    ],
    "deny": [
      "Bash(rm -rf /*)",
      "Bash(rm -rf /)",
      "Bash(sudo:*)",
      "Bash(chmod 777:*)",
      "Read(.env)",
      "Read(.env.*)",
      "Read(**/secrets/**)",
      "Edit(.env)",
      "Edit(.env.*)"
    ]
  },
  "hooks": {
    "Stop": [{
      "matcher": "",
      "hooks": [{
        "type": "command",
        "command": "python $CLAUDE_PROJECT_DIR/.claude/hooks/ralph_session_cleanup.py"
      }]
    }]
  }
}
```

### Component 4: mprocs Configuration

`.claude/data/ralph-loops/{task}/mprocs.yaml`:
```yaml
procs:
  ralph-loop:
    shell: "../../scripts/ralph-orchestrator.sh . 20"
    cwd: "."
    log_dir: "./logs"
    env:
      RALPH_LOOP_DIR: "."

  dev-server:
    shell: "npm run dev -- --port 5007"
    cwd: "../../../../UberEats-Image-Extractor"
    log_dir: "./logs"
    autostart: true

settings:
  proc_list_width: 25
  scrollback: 10000
```

---

## Addressing User's Alternative 1 Requirements

The user's proposed Alternative 1 had specific extensibility points. Here's how each is addressed:

| Extensibility Point | How Addressed |
|---------------------|---------------|
| Kill terminal windows for old sessions | Not needed - bash loop runs sequentially in same terminal |
| Spawn new terminal window | Not needed - mprocs handles single-terminal UX |
| Dynamically assign model per session | ✅ Orchestrator reads `model` field from next feature |
| Dynamically assign allowed tools | Configured via settings.local.json, same for all sessions |
| Dynamically assign skills | Sessions use RALPH_PROMPT.md which can reference skills |
| Dynamically assign testing method | Feature's `category` field can indicate browser vs unit test |
| Notify user | ✅ Can add `osascript` notification in orchestrator |
| Print session ID for resumability | ✅ Stop hook logs session ID to progress.txt |
| Save session history for debugging | ✅ Per-iteration logs + session history in progress.txt |
| Status: REACHED_LIMIT handling | ✅ Orchestrator sets status, exits with code 1 |
| Status: COMPLETE handling | ✅ Orchestrator sets status, exits with code 0 |
| Run analysis on limit | Can add post-loop analysis script call |
| Create PR on complete | Can add post-loop PR creation script call |

---

## Key Constraints Discovered

### 1. OAuth Blocker for Agents SDK

**Problem**: Claude Agents SDK requires `ANTHROPIC_API_KEY` - it does NOT support OAuth tokens.

**Impact**: Cannot use Agents SDK to spawn sessions if using Max Plan subscription.

**Solution**: Use Claude CLI directly (`claude` command) which supports OAuth.

### 2. Claude in Chrome Requires Visible Browser

**Problem**: Claude in Chrome has no headless mode - browser window must be visible.

**Impact**: Cannot run Ralph Loop in background or overnight without user observation.

**Solution**:
- Use Claude in Chrome for interactive/observed sessions (recommended)
- Add Playwright MCP as alternative for headless/CI scenarios (future enhancement)

### 3. Stop Hook Cannot Reliably Spawn Sessions

**Problem**: Using Stop hook to spawn the next session creates complexity:
- Hook runs synchronously
- Spawning in background may have timing issues
- The new session's hook would also fire, creating race conditions

**Solution**: Use outer bash loop for session orchestration, Stop hook only for cleanup/logging.

---

## Comparison with Original Phase 1 Recommendations

| Issue | Original Recommendation | Revised Recommendation |
|-------|------------------------|----------------------|
| **Permissions** | `--dangerously-skip-permissions` + hooks | Same - still valid ✅ |
| **Session Spawn** | SDK-based priming + clipboard | Bash loop + CLI (OAuth works) |
| **Model Routing** | Per-feature model in feature_list.json | Same - orchestrator reads model ✅ |

---

## Implementation Priority

1. **Create ralph-orchestrator.sh** (2-4 hours)
   - Fresh session per feature
   - Per-feature model selection
   - Iteration logging

2. **Configure permissions** (2-4 hours)
   - Create settings.local.json with allowlist
   - Test with `--dangerously-skip-permissions`

3. **Add Stop hook cleanup** (1-2 hours)
   - Session ID logging
   - Progress.txt updates

4. **Create mprocs configuration** (1-2 hours)
   - Single terminal UX
   - Per-iteration log files

5. **Test end-to-end** (4-8 hours)
   - Run with city-breakdown-dashboard
   - Verify fresh context per feature
   - Verify browser testing works

**Total Estimated Effort**: 10-20 hours

---

## Open Questions for Discussion

1. **Context window monitoring**: Should we add explicit context usage tracking to detect when a session is getting too long for a single feature?

2. **Parallel worktrees**: The current design is sequential. For parallel worktrees, each would need its own orchestrator instance. Is this acceptable?

3. **Retry logic**: If a session fails mid-feature, should the orchestrator retry the same feature or move to the next?

4. **Playwright MCP fallback**: Should we add headless browser support now, or defer to a future phase?

---

## Summary

**Core Insight**: Ralph Loop's value is fresh context per feature. The orchestration layer must spawn NEW sessions, not extend existing ones.

**Recommended Approach**:
- Outer bash loop spawns fresh Claude CLI sessions
- Each session does ONE feature, exits cleanly
- Stop hook handles cleanup/logging (not continuation)
- mprocs provides single-terminal UX
- Claude in Chrome provides real-time browser visibility

**Key Constraints**:
- Agents SDK blocked by OAuth limitation → use CLI
- Claude in Chrome requires visible browser → user must observe
- Stop hook spawning is complex → use bash loop instead

This approach achieves:
- ✅ Fresh sessions per feature (no context rot)
- ✅ ~99% reliability (bash is deterministic)
- ✅ OAuth support (CLI works with Max Plan)
- ✅ Single terminal UX (mprocs)
- ✅ Real-time browser visibility (Claude in Chrome)
- ✅ Per-feature model selection (orchestrator reads from JSON)
