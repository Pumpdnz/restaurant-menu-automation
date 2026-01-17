---
name: continue-ralph
description: "Continue a Ralph Loop by spawning a new Claude session with the RALPH_PROMPT.md. Use at the end of each Ralph Loop iteration when features remain incomplete. Triggers on 'continue ralph', 'next ralph iteration', or when Ralph Loop workflow specifies /continue-ralph."
---

# Continue Ralph Loop

Start or continue a Ralph Loop using the v2.0 CLI-based orchestrator. This command manages autonomous iterations via tmux, with automatic retry logic and per-feature model selection.

## Arguments

The ralph loop directory path is passed as an argument:

```
/continue-ralph {RALPH_LOOP_DIR}
```

Example:
```
/continue-ralph .claude/data/ralph-loops/dashboard-city-table
```

Optional second argument for max iterations (default: 20):
```
/continue-ralph .claude/data/ralph-loops/dashboard-city-table 30
```

## When to Use

Run this skill when:
- You want to START an autonomous Ralph Loop
- You want to CHECK the status of a running loop
- You want to RESUME a paused loop

**Note:** With v2.0, Claude sessions no longer need to call `/continue-ralph` at the end of each iteration. The bash orchestrator handles continuation automatically.

## Workflow

### Step 1: Validate Ralph Loop Directory

The ralph loop directory is provided as the argument `$ARGUMENTS`. Verify these files exist:
- `RALPH_PROMPT.md` - The prompt template
- `progress.txt` - Progress tracking
- `feature_list.json` - Feature tracking (must have at least one `passes: false`)

If no argument provided, ask the user for the ralph loop directory path.

### Step 2: Check if Ralph Loop is Already Running

Check if a tmux session named "ralph-loop" is already running:

```bash
tmux has-session -t ralph-loop 2>/dev/null && echo "RUNNING" || echo "NOT_RUNNING"
```

### Step 3: Take Appropriate Action

**If NOT running:**
Start the ralph loop using the wrapper:

```bash
bash .claude/scripts/ralph-loop/ralph-loop-wrapper.sh start "{RALPH_LOOP_PATH}" {MAX_ITERATIONS}
```

**If ALREADY running:**
Show the current status:

```bash
bash .claude/scripts/ralph-loop/ralph-loop-wrapper.sh status "{RALPH_LOOP_PATH}"
```

And inform the user they can:
- `./ralph-loop-wrapper.sh attach` - Watch the loop in real-time
- `./ralph-loop-wrapper.sh stop` - Stop the loop
- `./ralph-loop-wrapper.sh logs {dir}` - View recent logs

## Wrapper Commands Reference

| Command | Description |
|---------|-------------|
| `start <dir> [max-iter]` | Start Ralph Loop in background tmux session |
| `attach` | Attach to running session (Ctrl+B, D to detach) |
| `status <dir>` | Check if running and show progress |
| `stop` | Terminate the Ralph Loop session |
| `logs <dir>` | Show recent log files |

## Architecture (v2.0)

The new orchestrator uses a 6-layer architecture:

```
LAYER 0: Pre-Loop Validation     -> validate-environment.sh
LAYER 1: Terminal Management     -> ralph-loop-wrapper.sh (tmux)
LAYER 2: Orchestration           -> ralph-orchestrator.sh (CLI + retry)
LAYER 3: Security                -> ralph-pre-tool.js + settings.local.json
LAYER 4: Observability           -> notify.sh + per-iteration logs
LAYER 5: Exit Conditions         -> Handled in ralph-orchestrator.sh
```

Key improvements over v1.0:
- **No permission prompts** - Uses `--dangerously-skip-permissions` with PreToolUse hooks
- **99% spawn reliability** - CLI-based spawning replaces AppleScript
- **Per-feature model selection** - Features can specify opus/sonnet/haiku

## Output

After starting, inform the user:
1. Ralph Loop started in tmux session
2. Directory being used: `{RALPH_LOOP_PATH}`
3. How to monitor: `./ralph-loop-wrapper.sh attach`
4. macOS notifications will fire on completion/failure
