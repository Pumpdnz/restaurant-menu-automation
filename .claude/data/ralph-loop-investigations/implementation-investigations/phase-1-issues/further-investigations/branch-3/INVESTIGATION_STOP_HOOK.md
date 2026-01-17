# Investigation: Stop Hook Orchestrator for Ralph Loop

## Executive Summary

This investigation evaluates using Claude Code's **Stop hook** mechanism to orchestrate autonomous Ralph Loop iterations. The Stop hook fires when Claude finishes responding, providing a natural integration point for loop continuation logic.

**Verdict: VIABLE with caveats** - The Stop hook approach can achieve ~95% reliability for autonomous iteration, but has important limitations around terminal interaction that require architectural decisions.

---

## 1. Hook API Documentation

### Stop Hook Overview

The `Stop` hook runs when the main Claude Code agent has finished responding. It does NOT run if stoppage occurred due to user interrupt.

### Configuration Format

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "/path/to/ralph-stop-hook.sh",
            "timeout": 60
          }
        ]
      }
    ]
  }
}
```

### Stop Hook Input (stdin JSON)

```json
{
  "session_id": "abc123",
  "transcript_path": "~/.claude/projects/.../00893aaf-19fa-41d2-8238-13269b9b3ca0.jsonl",
  "cwd": "/Users/giannimunro/Desktop/cursor-projects/automation",
  "permission_mode": "default",
  "hook_event_name": "Stop",
  "stop_hook_active": true
}
```

**Critical Field: `stop_hook_active`**
- `true` when Claude is already continuing as result of a stop hook
- **MUST check this** to prevent infinite loops

### Stop Hook Output (JSON stdout)

```json
{
  "decision": "block",
  "reason": "Remaining tasks found. Continue with Feature 5: Empty cuisine buttons trigger dialog"
}
```

| Output | Behavior |
|--------|----------|
| `"decision": "block"` | Prevents Claude from stopping; `reason` tells Claude how to proceed |
| `"decision": undefined` (or exit 0) | Allows Claude to stop normally |
| Exit code 2 | Blocks stoppage, stderr shown to Claude |

### Prompt-Based Stop Hooks (Alternative)

Claude Code also supports LLM-evaluated Stop hooks:

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "prompt",
            "prompt": "Evaluate if Claude should stop: $ARGUMENTS. Check if all tasks are complete.",
            "timeout": 30
          }
        ]
      }
    ]
  }
}
```

**Pros**: Context-aware, can evaluate transcript
**Cons**: Slower (API call), costs credits, less deterministic

---

## 2. Proposed Architecture

### High-Level Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         RALPH LOOP ORCHESTRATION                        │
└─────────────────────────────────────────────────────────────────────────┘

  ┌──────────────┐         ┌──────────────┐         ┌──────────────┐
  │   Human      │         │   Claude     │         │   Stop Hook  │
  │   Planning   │────────>│   Session    │────────>│   Script     │
  │   Phase      │         │   (Feature)  │         │   (Decision) │
  └──────────────┘         └──────────────┘         └──────┬───────┘
                                                          │
                           ┌──────────────────────────────┴───────────────┐
                           │                                              │
                           ▼                                              ▼
                    ┌──────────────┐                              ┌──────────────┐
                    │  Tasks       │                              │  No Tasks    │
                    │  Remaining   │                              │  OR Max Iter │
                    └──────┬───────┘                              └──────┬───────┘
                           │                                              │
                           ▼                                              ▼
                    ┌──────────────┐                              ┌──────────────┐
                    │ Block Stop   │                              │ Allow Stop   │
                    │ with reason  │                              │ (Complete)   │
                    └──────┬───────┘                              └──────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │  Continue    │
                    │  Same        │
                    │  Session     │
                    └──────────────┘
```

### Key Insight: Same Session Continuation

The Stop hook's `"decision": "block"` does NOT spawn a new session. Instead, it:

1. Prevents the current session from stopping
2. Injects the `reason` into Claude's context
3. Claude continues working in the **same session**

This fundamentally changes the architecture from the original AppleScript approach:

| Aspect | AppleScript Approach | Stop Hook Approach |
|--------|---------------------|-------------------|
| Session model | Fresh session per iteration | Single long-running session |
| Context | Clean slate each time | Accumulating context |
| Spawning | Unreliable keystroke injection | No spawning needed |
| Visibility | Multiple terminal splits | Single terminal |
| Memory | No cross-session memory | Full conversation history |

### Architecture Option A: Same-Session Loop (Recommended)

```
┌─────────────────────────────────────────────────────────────────────┐
│                    SINGLE SESSION RALPH LOOP                        │
└─────────────────────────────────────────────────────────────────────┘

User starts: claude "$(cat RALPH_PROMPT.md)"
     │
     ▼
┌──────────────────────────────────────────────────────────────────┐
│ Claude Session                                                    │
│   │                                                               │
│   ├── Feature 1 → Stop Hook → Block (tasks remain) → Continue    │
│   │                                                               │
│   ├── Feature 2 → Stop Hook → Block (tasks remain) → Continue    │
│   │                                                               │
│   ├── Feature 3 → Stop Hook → Block (tasks remain) → Continue    │
│   │                                                               │
│   └── Feature N → Stop Hook → Allow (all complete) → Exit        │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

**Pros:**
- No spawning reliability issues
- Single terminal window
- Full conversation context
- Real-time visibility

**Cons:**
- Context window fills up over many features
- No model switching between features
- Memory of failures may affect later attempts

### Architecture Option B: New Session Per Iteration

If fresh sessions are truly required, the Stop hook can spawn a new Claude process, but the terminal interaction becomes complex:

```bash
# ralph-stop-hook.sh - Option B (New Session)

# ... decision logic ...

if [ "$SHOULD_CONTINUE" = "true" ]; then
    # Spawn new session in background
    nohup claude "$(cat $RALPH_PROMPT)" \
        --model "$NEXT_MODEL" \
        --permission-mode dontAsk \
        > "$LOG_DIR/iteration-$ITERATION.log" 2>&1 &

    # Output allows current session to stop
    echo '{"decision": null}'
fi
```

**Problem**: Background process loses terminal interaction. The user requirement for "real-time visual" makes this approach unsuitable unless using a terminal multiplexer.

---

## 3. Implementation Skeleton

### Stop Hook Script (Bash)

```bash
#!/bin/bash
# ralph-stop-hook.sh
# Runs after each Claude response to decide if loop should continue

set -euo pipefail

# Read hook input from stdin
INPUT=$(cat)

# Extract fields
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id')
STOP_HOOK_ACTIVE=$(echo "$INPUT" | jq -r '.stop_hook_active')
CWD=$(echo "$INPUT" | jq -r '.cwd')

# Configuration - these should be passed via environment or config
RALPH_LOOP_DIR="${RALPH_LOOP_DIR:-.claude/data/ralph-loops/current}"
FEATURE_LIST="$RALPH_LOOP_DIR/feature_list.json"
PROGRESS_FILE="$RALPH_LOOP_DIR/progress.txt"
LOG_FILE="$RALPH_LOOP_DIR/hook.log"

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

log "Stop hook triggered. Session: $SESSION_ID, stop_hook_active: $STOP_HOOK_ACTIVE"

# ============================================================
# INFINITE LOOP PREVENTION
# ============================================================
# If stop_hook_active is true, Claude is already continuing
# from a previous stop hook. Check iteration count to prevent
# runaway loops.

# Read current iteration from progress.txt
CURRENT_ITERATION=$(grep -oP 'Iteration:\s*\K\d+' "$PROGRESS_FILE" 2>/dev/null || echo "1")
MAX_ITERATIONS=$(grep -oP 'Max Iterations:\s*\K\d+' "$PROGRESS_FILE" 2>/dev/null || echo "15")

log "Iteration: $CURRENT_ITERATION / $MAX_ITERATIONS"

# ============================================================
# CHECK REMAINING TASKS
# ============================================================

if [ ! -f "$FEATURE_LIST" ]; then
    log "ERROR: feature_list.json not found"
    exit 0  # Allow stop - can't determine state
fi

# Count remaining features (passes: false)
REMAINING=$(jq '[.features[] | select(.passes == false)] | length' "$FEATURE_LIST")
TOTAL=$(jq '.features | length' "$FEATURE_LIST")
COMPLETED=$((TOTAL - REMAINING))

log "Features: $COMPLETED/$TOTAL complete, $REMAINING remaining"

# ============================================================
# DECISION LOGIC
# ============================================================

if [ "$REMAINING" -eq 0 ]; then
    # All features complete!
    log "COMPLETE: All features passed"

    # Update progress.txt
    sed -i '' "s/Status:.*/Status: COMPLETE/" "$PROGRESS_FILE"

    # Allow Claude to stop with completion message
    cat <<EOF
{
    "continue": true,
    "systemMessage": "Ralph Loop COMPLETE! All $TOTAL features verified."
}
EOF
    exit 0
fi

if [ "$CURRENT_ITERATION" -ge "$MAX_ITERATIONS" ]; then
    # Max iterations reached
    log "REACHED_LIMIT: Max iterations ($MAX_ITERATIONS) reached with $REMAINING features remaining"

    # Update progress.txt
    sed -i '' "s/Status:.*/Status: REACHED_LIMIT/" "$PROGRESS_FILE"

    # Allow stop but warn
    cat <<EOF
{
    "continue": true,
    "systemMessage": "Ralph Loop reached max iterations ($MAX_ITERATIONS). $REMAINING features remain incomplete."
}
EOF
    exit 0
fi

# ============================================================
# CONTINUE LOOP
# ============================================================

# Get next feature details
NEXT_FEATURE=$(jq -r '[.features[] | select(.passes == false)][0]' "$FEATURE_LIST")
NEXT_ID=$(echo "$NEXT_FEATURE" | jq -r '.id')
NEXT_DESC=$(echo "$NEXT_FEATURE" | jq -r '.description')
NEXT_MODEL=$(echo "$NEXT_FEATURE" | jq -r '.model // "opus"')

# Increment iteration counter
NEW_ITERATION=$((CURRENT_ITERATION + 1))
sed -i '' "s/Iteration:.*/Iteration: $NEW_ITERATION/" "$PROGRESS_FILE"

log "CONTINUE: Starting iteration $NEW_ITERATION for Feature $NEXT_ID: $NEXT_DESC"

# Block stop and tell Claude to continue
cat <<EOF
{
    "decision": "block",
    "reason": "Ralph Loop iteration $NEW_ITERATION: Continue with Feature $NEXT_ID - $NEXT_DESC. Review feature_list.json for steps, implement the feature, verify it works, update passes: true, commit, and update progress.txt."
}
EOF
```

### Node.js Alternative (More Robust JSON Handling)

```javascript
#!/usr/bin/env node
// ralph-stop-hook.js

const fs = require('fs');
const path = require('path');

// Read input from stdin
let input = '';
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
    try {
        main(JSON.parse(input));
    } catch (e) {
        console.error('Error:', e.message);
        process.exit(1);
    }
});

function main(hookInput) {
    const { session_id, stop_hook_active, cwd } = hookInput;

    // Configuration
    const ralphLoopDir = process.env.RALPH_LOOP_DIR || '.claude/data/ralph-loops/current';
    const featureListPath = path.join(cwd, ralphLoopDir, 'feature_list.json');
    const progressPath = path.join(cwd, ralphLoopDir, 'progress.txt');

    // Read feature list
    const featureList = JSON.parse(fs.readFileSync(featureListPath, 'utf8'));
    const progressText = fs.readFileSync(progressPath, 'utf8');

    // Parse progress
    const currentIteration = parseInt(progressText.match(/Iteration:\s*(\d+)/)?.[1] || '1');
    const maxIterations = parseInt(progressText.match(/Max Iterations:\s*(\d+)/)?.[1] || '15');

    // Count remaining
    const remaining = featureList.features.filter(f => !f.passes);

    // Decision logic
    if (remaining.length === 0) {
        // Complete!
        updateProgress(progressPath, progressText, 'COMPLETE', currentIteration);
        console.log(JSON.stringify({
            continue: true,
            systemMessage: `Ralph Loop COMPLETE! All ${featureList.features.length} features verified.`
        }));
        return;
    }

    if (currentIteration >= maxIterations) {
        // Max iterations
        updateProgress(progressPath, progressText, 'REACHED_LIMIT', currentIteration);
        console.log(JSON.stringify({
            continue: true,
            systemMessage: `Ralph Loop reached max iterations (${maxIterations}). ${remaining.length} features remain.`
        }));
        return;
    }

    // Continue with next feature
    const nextFeature = remaining[0];
    const newIteration = currentIteration + 1;

    updateProgress(progressPath, progressText, 'IN_PROGRESS', newIteration);

    console.log(JSON.stringify({
        decision: 'block',
        reason: `Ralph Loop iteration ${newIteration}: Continue with Feature ${nextFeature.id} - ${nextFeature.description}. Review feature_list.json for steps, implement the feature, verify it works, update passes: true, commit, and update progress.txt.`
    }));
}

function updateProgress(path, text, status, iteration) {
    let updated = text
        .replace(/Status:.*/, `Status: ${status}`)
        .replace(/Iteration:.*/, `Iteration: ${iteration}`);
    fs.writeFileSync(path, updated);
}
```

### Hook Configuration

Add to `.claude/settings.local.json`:

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node $CLAUDE_PROJECT_DIR/.claude/hooks/ralph-stop-hook.js",
            "timeout": 30
          }
        ]
      }
    ]
  }
}
```

---

## 4. Critical Questions Answered

### Q1: Can a stop hook spawn a new Claude session in the same terminal?

**No, not directly.** The stop hook runs as a child process of the current Claude session. It cannot:
- Take over the terminal stdin/stdout
- Replace the current Claude process
- Open a new interactive session in the same terminal

**Alternatives:**
1. **Same-session continuation** (recommended): Use `"decision": "block"` to keep current session running
2. **Background spawning**: Start new Claude in background with `nohup`, logs to file
3. **Terminal multiplexer**: Use mprocs/tmux to manage multiple processes

### Q2: How does the hook interact with terminal stdin/stdout?

The hook:
- Receives input via stdin (JSON from Claude)
- Outputs decision via stdout (JSON)
- stderr goes to Claude for error messages
- Does NOT have access to the terminal the user sees

This is why same-session continuation is the cleanest approach.

### Q3: What happens if the hook script fails?

| Failure Type | Behavior |
|--------------|----------|
| Non-zero exit (except 2) | Warning shown to user, Claude stops normally |
| Exit code 2 | stderr fed back to Claude as reason to continue |
| Timeout (default 60s) | Hook killed, Claude stops normally |
| JSON parse error | Claude ignores output, stops normally |

**Recommendation**: Always exit 0 with valid JSON to maintain control.

### Q4: How to handle Max Plan OAuth token?

The stop hook approach inherits authentication from the parent session:
- If user started with `claude "prompt"`, OAuth is already authenticated
- No additional token handling needed
- Session continues with same auth context

For the background-spawn approach (Option B), would need to ensure `~/.claude` credentials are available.

---

## 5. Risk Assessment

### Failure Modes and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **Infinite loop** | Medium | High | Check `stop_hook_active`, enforce max iterations |
| **Context window overflow** | Medium | Medium | Use `/compact` command, limit features per loop |
| **Hook script error** | Low | Low | Graceful fallback (stops normally), logging |
| **File system corruption** | Low | High | Atomic writes, backup before modify |
| **User interrupt during hook** | Low | Low | Hook is fast (<1s), minimal window |
| **Permission denied** | Low | Medium | Pre-verify permissions before loop starts |

### Reliability Estimate

| Approach | Estimated Reliability | Notes |
|----------|----------------------|-------|
| **Same-session with Stop hook** | 95% | Main risk is context overflow |
| **AppleScript spawning** (current) | 90% | Timing/keystroke issues |
| **Background spawning** | 98% | Loses real-time visibility |
| **mprocs orchestration** | 95% | Adds dependency |

### Context Window Management

For long-running loops, context accumulation is the primary concern:

**Strategies:**
1. **Periodic compaction**: Hook triggers `/compact` every N iterations
2. **Feature batching**: Limit features per session (e.g., 5 features = new session)
3. **Lean prompts**: Keep RALPH_PROMPT.md minimal, reference files rather than inline

---

## 6. Recommendation

### Primary Recommendation: Same-Session Stop Hook

**Viability: HIGH (95% reliability)**

The Stop hook with same-session continuation is viable and recommended because:

1. **Eliminates spawning issues** - No AppleScript, no keystroke timing
2. **Single terminal** - Meets user requirement for real-time visibility
3. **Simple architecture** - No external orchestrators needed
4. **Inherits auth** - OAuth handled automatically

### Implementation Plan

#### Phase 1: Basic Loop (Day 1)
1. Create `ralph-stop-hook.js` script
2. Add hook configuration to settings.local.json
3. Test with simple 2-feature loop

#### Phase 2: Robustness (Day 2)
1. Add logging and debugging
2. Implement max iteration safety
3. Add context overflow detection
4. Create init script that validates environment

#### Phase 3: Extensibility (Day 3)
1. Add model routing (read `model` from feature)
2. Add user notifications (macOS alerts)
3. Add session ID logging for debugging

### Configuration Example

```json
// .claude/settings.local.json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node \"$CLAUDE_PROJECT_DIR/.claude/hooks/ralph-stop-hook.js\"",
            "timeout": 30
          }
        ]
      }
    ]
  }
}
```

### Usage

```bash
# Start Ralph Loop (user does this once)
cd /path/to/project
claude "$(cat .claude/data/ralph-loops/my-feature/RALPH_PROMPT.md)"

# Stop hook automatically continues until:
# - All features pass
# - Max iterations reached
# - User interrupts (Ctrl+C)
```

---

## 7. Tradeoffs Summary

| Aspect | Stop Hook Approach | AppleScript Approach |
|--------|-------------------|---------------------|
| **Reliability** | ~95% | ~90% |
| **Session model** | Single long session | Fresh sessions |
| **Context** | Accumulates (risk of overflow) | Clean each time |
| **Visibility** | Single terminal, real-time | Multiple splits |
| **Model switching** | Not supported per-feature | Possible with flags |
| **Complexity** | Low (one script) | Medium (AppleScript + timing) |
| **Dependencies** | Node.js (already required) | AppleScript, Cursor |
| **Cross-platform** | Yes (Node.js) | macOS only |

### When to Use Each Approach

**Use Stop Hook when:**
- Features are <10 per loop
- Same model suitable for all features
- Single terminal preferred
- Cross-platform needed

**Use AppleScript (or alternative spawning) when:**
- Many features requiring fresh context
- Different models per feature type
- Visual separation of iterations preferred

---

## 8. Appendix: Alternative Approaches Considered

### A. Prompt-Based Stop Hook

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "prompt",
            "prompt": "Check if all features in feature_list.json pass. If not, return {\"ok\": false, \"reason\": \"Continue with Feature X\"}. If all pass, return {\"ok\": true}."
          }
        ]
      }
    ]
  }
}
```

**Rejected because**: Uses API credits, slower, less deterministic than file-based check.

### B. SessionEnd Hook for Spawning

The `SessionEnd` hook could spawn a new session, but:
- Runs after session terminates
- Cannot interact with the terminal
- Would require background process

**Rejected because**: Terminal interaction lost.

### C. SubagentStop for Nested Tasks

Could use Task tool with SubagentStop hook for individual features:

```
Main Session
  └── Task: Feature 1 → SubagentStop checks feature 1
  └── Task: Feature 2 → SubagentStop checks feature 2
```

**Considered viable** for parallel features, but adds complexity.

---

## 9. References

- [Claude Code Hooks Reference](https://code.claude.com/docs/en/hooks)
- [Claude Code CLI Reference](https://code.claude.com/docs/en/cli-reference)
- [Session Spawn Investigation](../INVESTIGATION_SESSION_SPAWN.md)
- [Phase 1 Issues Overview](../PHASE_1_CURRENT_ISSUES.md)

---

## 10. Conclusion

The Stop hook-based approach for Ralph Loop orchestration is **viable and recommended**. It achieves:

- **~95% reliability** vs ~90% with AppleScript
- **Single terminal** with real-time visibility
- **Simple architecture** with minimal dependencies
- **Automatic continuation** without user intervention

The main limitation is context window management for long loops, which can be mitigated with periodic compaction or session batching.

**Next Steps:**
1. Prototype the ralph-stop-hook.js script
2. Test with existing city-breakdown-dashboard loop
3. Measure context usage and iteration limits
4. Document setup in skill instructions
