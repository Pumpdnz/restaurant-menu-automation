# Unified Recommendation: Ralph Loop Engine

## Executive Summary

This document consolidates findings from three parallel investigations and the user's architectural decisions into a unified implementation plan for fixing the Phase 1 blocking issues.

**Chosen Architecture:**
- **SDK Loop** - Python script manages iterations externally
- **Same terminal, detachable** - tmux/screen-style execution
- **Auto-retry with backoff** - 3 retries on MCP connection drops
- **Extract patterns, build custom** - Tailored solution using Anthropic patterns

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         RALPH LOOP ENGINE                                │
│                    (Python + Claude Agents SDK)                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────┐     │
│  │                      ENTRY POINT                                │     │
│  │                                                                 │     │
│  │  $ ralph-loop start .claude/data/ralph-loops/my-feature        │     │
│  │                                                                 │     │
│  │  Options:                                                       │     │
│  │    --detach        Run in background, detachable               │     │
│  │    --max-iter N    Override max iterations                      │     │
│  │    --model MODEL   Override default model                       │     │
│  │    --dry-run       Show what would happen without executing     │     │
│  │                                                                 │     │
│  └────────────────────────────────────────────────────────────────┘     │
│                              │                                           │
│                              ▼                                           │
│  ┌────────────────────────────────────────────────────────────────┐     │
│  │                    SESSION MANAGER                              │     │
│  │                                                                 │     │
│  │  WHILE remaining_features > 0 AND iteration < max:             │     │
│  │                                                                 │     │
│  │    ┌─────────────────────────────────────────────────────────┐ │     │
│  │    │ 1. READ STATE                                           │ │     │
│  │    │    - feature_list.json → next feature (passes: false)   │ │     │
│  │    │    - progress.txt → current iteration, status           │ │     │
│  │    │    - feature.model → opus/sonnet/haiku                  │ │     │
│  │    └─────────────────────────────────────────────────────────┘ │     │
│  │                              │                                  │     │
│  │                              ▼                                  │     │
│  │    ┌─────────────────────────────────────────────────────────┐ │     │
│  │    │ 2. CREATE SESSION                                       │ │     │
│  │    │    ClaudeSDKClient(                                     │ │     │
│  │    │      model = feature.model,                             │ │     │
│  │    │      oauth_token = CLAUDE_CODE_OAUTH_TOKEN,             │ │     │
│  │    │      permissions = pre-configured allowlist,            │ │     │
│  │    │      tools = [Read, Write, Edit, Claude-in-Chrome, ...] │ │     │
│  │    │    )                                                    │ │     │
│  │    └─────────────────────────────────────────────────────────┘ │     │
│  │                              │                                  │     │
│  │                              ▼                                  │     │
│  │    ┌─────────────────────────────────────────────────────────┐ │     │
│  │    │ 3. RUN SESSION                                          │ │     │
│  │    │    - Load RALPH_PROMPT.md                               │ │     │
│  │    │    - Stream output to terminal (real-time)              │ │     │
│  │    │    - Handle MCP connection drops (retry w/ backoff)     │ │     │
│  │    │    - Session updates feature_list.json on completion    │ │     │
│  │    └─────────────────────────────────────────────────────────┘ │     │
│  │                              │                                  │     │
│  │                              ▼                                  │     │
│  │    ┌─────────────────────────────────────────────────────────┐ │     │
│  │    │ 4. POST-SESSION                                         │ │     │
│  │    │    - Log session_id → session_history.json              │ │     │
│  │    │    - Update progress.txt (iteration++)                  │ │     │
│  │    │    - Check termination conditions                       │ │     │
│  │    │    - 3s delay before next iteration                     │ │     │
│  │    └─────────────────────────────────────────────────────────┘ │     │
│  │                                                                 │     │
│  │  END WHILE                                                     │     │
│  │                                                                 │     │
│  │  TERMINATION:                                                  │     │
│  │    - all_features_pass → Status: COMPLETE                     │     │
│  │    - reached_max_iter → Status: REACHED_LIMIT                 │     │
│  │    - user_interrupt → Status: PAUSED (resumable)              │     │
│  │                                                                 │     │
│  └────────────────────────────────────────────────────────────────┘     │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Issue Resolutions

### Issue 1: Permission Prompts (BLOCKING)

**Problem:** Every tool call requires manual approval, breaking automation.

**Solution:** Pre-configured permissions in ClaudeSDKClient

```python
security_settings = {
    "sandbox": {"enabled": True, "autoAllowBashIfSandboxed": True},
    "permissions": {
        "defaultMode": "acceptEdits",
        "allow": [
            # File operations
            "Read(./**)",
            "Write(./**)",
            "Edit(./**)",
            "Glob(./**)",
            "Grep(./**)",

            # Bash - scoped patterns
            "Bash(npm:*)",
            "Bash(node:*)",
            "Bash(git:*)",
            "Bash(curl:*)",
            "Bash(ls:*)",
            "Bash(cat:*)",
            "Bash(mkdir:*)",

            # Claude in Chrome tools
            "mcp__claude-in-chrome__*",

            # Task and subagents
            "Task(*)",
            "TodoWrite(*)",
        ],
        "deny": [
            # Security boundaries
            "Bash(rm -rf /*)",
            "Bash(sudo:*)",
            "Bash(chmod 777:*)",
            "Read(.env)",
            "Read(.env.*)",
            "Read(**/credentials*)",
            "Read(**/*secret*)",
        ],
    },
}
```

**Reliability:** ~99% (no manual prompts for allowed operations)

---

### Issue 2: Session Spawn Reliability

**Problem:** AppleScript-based spawning has ~90% success rate.

**Solution:** SDK-managed sessions with Python orchestration

```python
async def run_ralph_loop(ralph_dir: Path, max_iterations: int = 15):
    """Run the Ralph Loop with SDK-managed sessions."""

    iteration = 0
    while True:
        iteration += 1

        # Check termination conditions
        remaining = count_remaining_features(ralph_dir)
        if remaining == 0:
            update_status(ralph_dir, "COMPLETE")
            break
        if iteration > max_iterations:
            update_status(ralph_dir, "REACHED_LIMIT")
            break

        # Get next feature and its model
        next_feature = get_next_feature(ralph_dir)
        model = next_feature.get("model", "opus")

        # Create fresh client for this iteration
        client = create_client(
            project_dir=ralph_dir.parent.parent.parent,  # Project root
            model=model,
            ralph_dir=ralph_dir,
        )

        # Load prompt
        prompt = (ralph_dir / "RALPH_PROMPT.md").read_text()

        # Run session with streaming output
        async with client:
            status, session_id = await run_session_with_retry(
                client, prompt, max_retries=3
            )

        # Log session for observability
        log_session(ralph_dir, iteration, session_id, next_feature["id"])

        # Update progress
        update_progress(ralph_dir, iteration)

        # Brief pause between iterations
        await asyncio.sleep(3)
```

**Reliability:** ~99% (deterministic, no keystroke timing issues)

---

### Issue 3: Model Speed

**Problem:** All sessions use Opus when faster models would suffice.

**Solution:** Per-feature model selection from feature_list.json

**Updated Schema:**
```json
{
  "task_name": "city-breakdown-dashboard",
  "default_model": "opus",
  "features": [
    {
      "id": 1,
      "category": "setup",
      "model": "opus",
      "description": "Add dialog state management",
      "passes": false
    },
    {
      "id": 5,
      "category": "ui",
      "model": "sonnet",
      "description": "Verify button styling",
      "passes": false
    },
    {
      "id": 9,
      "category": "verification",
      "model": "sonnet",
      "description": "Table matches existing patterns",
      "passes": false
    }
  ]
}
```

**Model Selection Logic:**
```python
def get_model_for_feature(feature: dict, default: str = "opus") -> str:
    """Get model for feature, with category-based fallbacks."""

    # Explicit model takes priority
    if feature.get("model"):
        return feature["model"]

    # Category-based defaults
    category_models = {
        "setup": "opus",
        "functional": "opus",
        "ui": "sonnet",
        "verification": "sonnet",
        "testing": "sonnet",
        "documentation": "haiku",
    }

    category = feature.get("category", "functional")
    return category_models.get(category, default)
```

**Speed Impact:** ~45% faster for typical 9-feature loop

---

## Detachable Execution (tmux/screen style)

### Implementation Options

**Option A: Native Python with nohup + log tailing**
```bash
# Start in background
nohup python ralph_loop.py .claude/data/ralph-loops/my-feature \
    > ralph.log 2>&1 &
echo $! > ralph.pid

# Tail logs
tail -f ralph.log

# Reattach (check status)
cat ralph.pid | xargs ps -p

# Stop
kill $(cat ralph.pid)
```

**Option B: tmux integration (Recommended)**
```bash
# Start ralph loop in tmux session
tmux new-session -d -s ralph "python ralph_loop.py $RALPH_DIR"

# Attach to observe
tmux attach -t ralph

# Detach (Ctrl+B, D)

# Reattach later
tmux attach -t ralph

# Kill session
tmux kill-session -t ralph
```

**Option C: Screen integration**
```bash
# Start in screen
screen -dmS ralph python ralph_loop.py $RALPH_DIR

# Attach
screen -r ralph

# Detach (Ctrl+A, D)

# Reattach
screen -r ralph
```

### Recommended Wrapper Script

```bash
#!/bin/bash
# ralph-loop.sh - Wrapper for detachable Ralph Loop execution

COMMAND="$1"
RALPH_DIR="$2"

case "$COMMAND" in
    start)
        if tmux has-session -t ralph 2>/dev/null; then
            echo "Ralph Loop already running. Use 'ralph-loop attach' to observe."
            exit 1
        fi
        tmux new-session -d -s ralph "python ralph_loop.py $RALPH_DIR"
        echo "Ralph Loop started. Use 'ralph-loop attach' to observe."
        ;;
    attach)
        tmux attach -t ralph
        ;;
    status)
        if tmux has-session -t ralph 2>/dev/null; then
            echo "Ralph Loop is RUNNING"
            cat "$RALPH_DIR/progress.txt" | head -5
        else
            echo "Ralph Loop is NOT RUNNING"
        fi
        ;;
    stop)
        tmux kill-session -t ralph 2>/dev/null
        echo "Ralph Loop stopped."
        ;;
    *)
        echo "Usage: ralph-loop {start|attach|status|stop} RALPH_DIR"
        ;;
esac
```

---

## MCP Connection Drop Recovery

### Auto-Retry with Exponential Backoff

```python
async def run_session_with_retry(
    client: ClaudeSDKClient,
    prompt: str,
    max_retries: int = 3,
    base_delay: float = 2.0,
) -> tuple[str, str]:
    """Run session with auto-retry on MCP connection drops."""

    last_error = None

    for attempt in range(max_retries + 1):
        try:
            await client.query(prompt)

            response_text = ""
            session_id = None

            async for msg in client.receive_response():
                msg_type = type(msg).__name__

                if msg_type == "AssistantMessage":
                    for block in msg.content:
                        if hasattr(block, "text"):
                            print(block.text, end="", flush=True)
                            response_text += block.text

                # Extract session_id from metadata if available
                if hasattr(msg, "session_id"):
                    session_id = msg.session_id

            return "success", session_id

        except MCPConnectionError as e:
            last_error = e

            if attempt < max_retries:
                delay = base_delay * (2 ** attempt)  # Exponential backoff
                print(f"\n[MCP Connection Lost] Retry {attempt + 1}/{max_retries} in {delay}s...")
                await asyncio.sleep(delay)

                # Attempt to re-establish connection
                await client.reconnect_mcp_servers()
            else:
                print(f"\n[MCP Connection Failed] Max retries exceeded.")
                raise

        except Exception as e:
            # Non-recoverable error
            raise

    raise last_error
```

### Browser Health Check

```python
async def verify_browser_connection(client: ClaudeSDKClient, tab_id: int) -> bool:
    """Verify browser connection before browser-dependent work."""

    try:
        # Attempt a simple screenshot as health check
        result = await client.call_tool(
            "mcp__claude-in-chrome__computer",
            {"action": "screenshot", "tabId": tab_id}
        )
        return result is not None
    except MCPConnectionError:
        return False
```

---

## File Structure

```
.claude/
├── scripts/
│   └── ralph-loop/
│       ├── ralph_loop.py          # Main loop engine
│       ├── client.py              # ClaudeSDKClient factory
│       ├── progress.py            # Progress tracking utilities
│       ├── security.py            # Bash command validation
│       ├── retry.py               # MCP retry logic
│       └── requirements.txt       # Python dependencies
│
├── data/
│   └── ralph-loops/
│       └── {loop-name}/
│           ├── RALPH_PROMPT.md    # Session prompt
│           ├── feature_list.json  # Feature tracking
│           ├── progress.txt       # Human-readable state
│           ├── session_history.json # Session ID log
│           └── artifacts/         # Screenshots, GIFs
│
└── skills/
    └── continue-ralph/
        └── SKILL.md               # Updated to use SDK loop
```

---

## Implementation Phases

### Phase 1: Core Engine (Priority: Highest)

**Files to create:**
- `ralph_loop.py` - Main async loop
- `client.py` - SDK client factory with OAuth
- `progress.py` - Feature list and progress tracking

**Patterns to extract from:**
- coleam00: OAuth token authentication
- Official Anthropic: Async session loop, progress counting

**Estimated effort:** 4-6 hours

### Phase 2: Permission Configuration

**Files to create/update:**
- Security settings JSON template
- Bash command allowlist

**Testing:**
- Verify no permission prompts for standard operations
- Verify dangerous operations are blocked

**Estimated effort:** 2-3 hours

### Phase 3: Model Routing

**Files to update:**
- `feature_list.json` schema (add `model` field)
- `ralph_loop.py` (read model per feature)
- `/plan-ralph-loop` skill (generate model assignments)

**Estimated effort:** 1-2 hours

### Phase 4: Detachable Execution

**Files to create:**
- `ralph-loop.sh` wrapper script
- tmux/screen integration

**Testing:**
- Start, attach, detach, reattach, stop
- Verify output streaming works

**Estimated effort:** 1-2 hours

### Phase 5: MCP Retry Logic

**Files to create:**
- `retry.py` - Retry with backoff
- Browser health check utilities

**Testing:**
- Simulate connection drops
- Verify recovery works

**Estimated effort:** 2-3 hours

### Phase 6: Integration & Testing

**Tasks:**
- Connect to existing Ralph Loop prompts
- Test with city-breakdown-dashboard loop
- Document usage

**Estimated effort:** 2-4 hours

---

## Total Estimated Effort

| Phase | Effort | Priority |
|-------|--------|----------|
| Phase 1: Core Engine | 4-6 hours | Highest |
| Phase 2: Permissions | 2-3 hours | High |
| Phase 3: Model Routing | 1-2 hours | Medium |
| Phase 4: Detachable | 1-2 hours | Medium |
| Phase 5: MCP Retry | 2-3 hours | Medium |
| Phase 6: Integration | 2-4 hours | High |
| **Total** | **12-20 hours** | |

---

## Success Criteria

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Permission prompts | 0 during loop | Run full loop, count prompts |
| Session spawn reliability | >99% | Run 20 iterations, count failures |
| Model selection accuracy | 100% | Verify each session uses correct model |
| MCP recovery success | >90% | Simulate drops, measure recovery |
| Detach/reattach | Works reliably | Manual testing |

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| OAuth token expiration | Sessions fail | Use long-lived tokens, add refresh logic |
| Claude in Chrome not MCP-compatible | Can't use SDK tool registration | Use existing Claude Code tool interface |
| tmux not installed | Detach won't work | Fallback to nohup + log tailing |
| Rate limits | Sessions throttled | Add exponential backoff between iterations |
| Context window overflow | Long sessions truncate | Keep iterations short (1 feature each) |

---

## References

- [INVESTIGATION_STOP_HOOKS_SDK.md](./INVESTIGATION_STOP_HOOKS_SDK.md)
- [INVESTIGATION_CHROME_VISIBILITY.md](./INVESTIGATION_CHROME_VISIBILITY.md)
- [INVESTIGATION_ANTHROPIC_REPOS.md](./INVESTIGATION_ANTHROPIC_REPOS.md)
- [Phase 1 Issues](../PHASE_1_CURRENT_ISSUES.md)
- [Claude Agent SDK Python Reference](https://platform.claude.com/docs/en/agent-sdk/python)
- [coleam00 OAuth Implementation](https://github.com/coleam00/Linear-Coding-Agent-Harness)

---

*Document generated: 2026-01-16*
*Investigation branch: branch-2*
