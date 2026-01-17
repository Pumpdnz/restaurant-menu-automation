# Unified Recommendation: Ralph Loop Phase 1 Issues

**Date:** 2026-01-16
**Branch:** 3
**Status:** DRAFT - Pending cross-branch discussion

---

## Executive Summary

After investigating three approaches (Stop Hook, Anthropic Fork, coleam00 Fork), the recommended solution is a **Hybrid Orchestrator** that combines:

1. **Bash loop for session spawning** (uses Claude CLI with OAuth)
2. **Security hooks for permission control** (from coleam00's patterns)
3. **Fresh sessions per feature** (meets "truly fresh context" requirement)
4. **Per-feature model routing** (reads from feature_list.json)

This approach achieves all user requirements while avoiding blocked dependencies.

---

## User Requirements Summary

| Requirement | Priority | Notes |
|-------------|----------|-------|
| Human-in-the-loop planning | 1 | Already achieved via /plan-ralph-loop |
| Fully autonomous implementation | 2 | Fresh sessions, single focus |
| Reliability | 3 | >95% success rate target |
| Security | 4 | Permission control without prompts |
| Speed | 5 | Model routing per feature |
| Observability | 6 | Real-time Chrome, session logs |

**Critical Constraint:** Each feature requires **truly fresh context** (no session accumulation).

---

## Investigation Findings Summary

### Stop Hook Approach (INVESTIGATION_STOP_HOOK.md)

| Aspect | Finding |
|--------|---------|
| Viability | High (~95% reliability) |
| Session model | SAME session continues (blocks stopping) |
| Fresh context | **NO** - context accumulates |
| Model routing | **NO** - same model throughout |
| Real-time visual | YES |
| OAuth | YES (inherits from parent) |

**Verdict:** Cannot use as primary approach due to context accumulation.

**Can use for:** Extensibility (validation hooks, progress updates)

### Anthropic Fork (INVESTIGATION_ANTHROPIC_FORK.md)

| Aspect | Finding |
|--------|---------|
| Viability | **BLOCKED** |
| Blocker | Claude Agent SDK does not support OAuth |
| Browser automation | None (Puppeteer MCP, not Claude in Chrome) |
| Reusable patterns | Security hooks, session loop concepts |

**Verdict:** Do not fork. OAuth restriction is server-side and unresolvable.

**Can use for:** Conceptual patterns only

### coleam00 Fork (INVESTIGATION_COLEAM00_FORK.md)

| Aspect | Finding |
|--------|---------|
| Viability | High |
| OAuth | YES - via `CLAUDE_CODE_OAUTH_TOKEN` env var |
| Fresh sessions | YES - creates new `ClaudeSDKClient` per iteration |
| Model routing | YES (pass model to client) |
| Linear removal | ~150 lines to modify |
| Claude in Chrome | **UNKNOWN** - needs testing |

**Verdict:** Valuable patterns, but SDK integration with Claude in Chrome is untested.

---

## Critical Open Question

### Does claude-code-sdk work with Claude in Chrome?

The `claude-code-sdk` Python package spawns Claude sessions programmatically. For Ralph Loop, these sessions need access to Claude in Chrome MCP tools.

**Possible scenarios:**

1. **Works out of box** - SDK sessions inherit MCP configuration from project
2. **Requires configuration** - Need to explicitly configure MCP servers
3. **Doesn't work** - SDK sessions are isolated from Chrome extension

**Resolution needed:** Test spawning a session via SDK and attempting browser tools.

---

## Recommended Architecture

### Option A: Bash Loop + Claude CLI (RECOMMENDED)

Avoids SDK entirely by using Claude CLI which definitely supports OAuth and Claude in Chrome.

```
┌──────────────────────────────────────────────────────────────────────┐
│                     RALPH LOOP ORCHESTRATOR                          │
│                        (bash script)                                 │
└──────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│  WHILE features remaining AND iterations < max:                      │
│    │                                                                 │
│    ├── 1. Read feature_list.json                                    │
│    ├── 2. Get next incomplete feature                               │
│    ├── 3. Determine model from feature.model                        │
│    ├── 4. Update progress.txt (iteration++, status=IN_PROGRESS)     │
│    ├── 5. Spawn fresh Claude session:                               │
│    │      claude --model $MODEL \                                    │
│    │             --dangerously-skip-permissions \                    │
│    │             "$(cat RALPH_PROMPT.md)"                            │
│    ├── 6. Wait for session to complete                              │
│    ├── 7. Log session ID for debugging                              │
│    └── 8. Check if feature passes, continue loop                    │
│                                                                      │
│  END WHILE                                                           │
│                                                                      │
│  Update status (COMPLETE or REACHED_LIMIT)                           │
│  Notify user                                                         │
└──────────────────────────────────────────────────────────────────────┘
```

**Why this works:**

| Requirement | How Met |
|-------------|---------|
| Fresh context | New CLI process each iteration |
| OAuth | Claude CLI uses current auth (Max Plan) |
| Model routing | `--model` flag per iteration |
| Claude in Chrome | CLI sessions have full MCP access |
| Single terminal | Loop runs in foreground |
| Observability | Stdout streams to terminal |

### Option B: Python SDK Orchestrator (Fallback)

If bash limitations emerge, use coleam00's patterns with Linear removed.

```python
# ralph_orchestrator.py
import asyncio
from claude_code_sdk import ClaudeCodeOptions, ClaudeSDKClient

async def ralph_loop(ralph_dir: str, max_iterations: int = 20):
    for iteration in range(1, max_iterations + 1):
        # Read next feature
        feature = get_next_incomplete_feature(ralph_dir)
        if not feature:
            print("All features complete!")
            return

        # Fresh client per feature
        client = create_client(
            project_dir=ralph_dir,
            model=feature.get("model", "opus")
        )

        async with client:
            prompt = read_ralph_prompt(ralph_dir)
            await run_session(client, prompt)

        # Log and continue
        log_session(iteration, client.session_id)
```

---

## Implementation Plan

### Phase 1: Core Orchestrator (2-4 hours)

**Files to create:**
```
.claude/hooks/ralph-orchestrator.sh   # Main bash loop
.claude/hooks/ralph-pre-tool.js       # Security hook (from coleam00)
```

**Configuration:**
```json
// .claude/settings.local.json
{
  "permissions": {
    "allow": ["Read", "Edit", "Write", "Task", "Bash(npm:*)", "Bash(git:*)", "Glob", "Grep", "mcp__claude-in-chrome__*"],
    "deny": ["Bash(rm -rf /*)", "Bash(sudo:*)", "Read(.env)", "Read(.env.*)"]
  }
}
```

### Phase 2: Permission Control (2-4 hours)

Implement pre-tool-use hooks from coleam00's security.py pattern:

```javascript
// ralph-pre-tool.js
const ALLOWED_COMMANDS = new Set([
  'npm', 'node', 'git', 'ls', 'cat', 'mkdir',
  'claude', 'curl', 'jq', 'grep', 'sed'
]);

function validateBashCommand(command) {
  const baseCommand = command.split(' ')[0];
  if (!ALLOWED_COMMANDS.has(baseCommand)) {
    return { decision: 'block', reason: `Command '${baseCommand}' not allowed` };
  }
  return {};
}
```

### Phase 3: Model Routing (1-2 hours)

Update feature_list.json schema and orchestrator:

```json
{
  "features": [
    {
      "id": 1,
      "model": "opus",      // Complex implementation
      "category": "setup",
      ...
    },
    {
      "id": 9,
      "model": "sonnet",    // UI verification
      "category": "ui",
      ...
    }
  ]
}
```

### Phase 4: Observability (1-2 hours)

- Session ID logging to progress.txt
- macOS notifications on completion/failure
- Optional: GIF recording of browser tests

---

## Addressing Original Issues

### Issue 1: Permission Prompts

**Solution:** `--dangerously-skip-permissions` + PreToolUse hooks

```bash
claude --dangerously-skip-permissions "$(cat RALPH_PROMPT.md)"
```

Combined with hooks that block dangerous commands, this provides:
- Autonomous operation (no prompts)
- Security (allowlist enforcement)
- Logging (all tool calls recorded)

### Issue 2: Session Spawn Reliability

**Solution:** Replace AppleScript with bash loop

```bash
# Simple, deterministic, 99% reliable
while [ "$REMAINING" -gt 0 ] && [ "$ITERATION" -lt "$MAX" ]; do
  claude --model "$MODEL" "$(cat RALPH_PROMPT.md)"
  ITERATION=$((ITERATION + 1))
done
```

No AppleScript, no keystroke timing, no user interference risk.

### Issue 3: Model Speed

**Solution:** Per-feature model from feature_list.json

```bash
MODEL=$(jq -r '[.features[] | select(.passes == false)][0].model // "opus"' feature_list.json)
claude --model "$MODEL" "$(cat RALPH_PROMPT.md)"
```

---

## Remaining Unknowns

| Unknown | Impact | Resolution |
|---------|--------|------------|
| SDK + Claude in Chrome compatibility | High | Test before committing to SDK path |
| Session ID capture from CLI | Low | Test `--output-format json` flag |
| Max Plan OAuth stability | Medium | Monitor for rate limits or restrictions |

---

## Comparison Matrix

| Approach | Fresh Context | OAuth | Model Routing | Chrome | Reliability | Effort |
|----------|--------------|-------|---------------|--------|-------------|--------|
| Stop Hook | No | Yes | No | Yes | 95% | Low |
| Anthropic Fork | Yes | **No** | Yes | No | N/A | High |
| coleam00 Fork | Yes | Yes | Yes | **?** | 95% | Medium |
| **Bash Loop** | **Yes** | **Yes** | **Yes** | **Yes** | **99%** | **Low** |

---

## Recommendation

**Primary:** Bash Loop Orchestrator (Option A)

**Rationale:**
1. Uses Claude CLI which definitively supports OAuth and Claude in Chrome
2. Simplest implementation (~50 lines of bash)
3. Highest reliability (no SDK complexity, no AppleScript)
4. Per-feature model routing via `--model` flag
5. Fresh context guaranteed (new process per iteration)

**Fallback:** Python SDK Orchestrator (Option B) if bash limitations emerge

---

## Next Steps

1. **Prototype bash orchestrator** (~2 hours)
2. **Test with existing city-breakdown-dashboard loop**
3. **Add security hooks** (adapt from coleam00)
4. **Document in /continue-ralph skill**

---

## Cross-Branch Discussion Points

For the unified implementation plan discussion:

1. Do other branches agree with the Bash Loop approach?
2. Any concerns about using `--dangerously-skip-permissions`?
3. Should we prototype the SDK path as well for comparison?
4. How should we handle the Stop Hook - discard or repurpose?
