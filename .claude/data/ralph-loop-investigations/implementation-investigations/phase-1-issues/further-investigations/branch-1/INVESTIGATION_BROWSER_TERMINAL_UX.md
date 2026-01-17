# Investigation: Browser & Terminal UX for Ralph Loop

## Executive Summary

This investigation examines the compatibility of Claude in Chrome with autonomous session spawning approaches, terminal UX for log streaming, and compares alternative browser automation tools for the Ralph Loop system.

**Key Findings:**

| Requirement | Claude in Chrome | Puppeteer MCP | Playwright MCP |
|-------------|-----------------|---------------|----------------|
| Real-time browser visibility | Yes (mandatory) | Yes (visible window) | Yes (visible window) |
| Headless mode | No | Yes | Yes |
| Works with CLI sessions | Yes (--chrome flag) | Yes | Yes |
| Works with Agents SDK | Partial | Yes | Yes |
| Requires extension | Yes | No | No |
| Session persistence | Tabs persist, but not control | Browser instance persists | Browser instance persists |

**Recommendations:**
1. **Claude in Chrome** is suitable for sequential Ralph Loop iterations with user observation
2. **For autonomous/headless** scenarios, Playwright MCP is preferred (official recommendation)
3. **Terminal UX**: Use mprocs for single-terminal log aggregation with per-process log files
4. **Observability**: Combine mprocs + log files + GIF artifacts for comprehensive session tracking

---

## Part 1: Claude in Chrome Compatibility Assessment

### Architecture Overview

Claude in Chrome is a browser extension that uses Chrome's Native Messaging API to receive commands from Claude Code CLI:

```
┌─────────────────────┐     Native Messaging API     ┌─────────────────────┐
│   Claude Code CLI   │◄───────────────────────────►│   Chrome Extension  │
│   (Terminal)        │                              │   (Claude in Chrome)│
└─────────────────────┘                              └──────────┬──────────┘
                                                                │
                                                                ▼
                                                     ┌─────────────────────┐
                                                     │   Chrome Browser    │
                                                     │   (Visible Window)  │
                                                     │   ┌─────────────┐   │
                                                     │   │ MCP Tab     │   │
                                                     │   │ Group       │   │
                                                     │   └─────────────┘   │
                                                     └─────────────────────┘
```

### Compatibility Matrix

| Question | Answer | Source |
|----------|--------|--------|
| Requires visible browser window? | **Yes** - no headless mode | [Official Docs](https://code.claude.com/docs/en/chrome) |
| Works with Claude CLI? | **Yes** - via `--chrome` flag | Official Docs |
| Works with Claude Desktop? | **Yes** - via connector toggle | Official Docs |
| Works with Agents SDK spawned sessions? | **Partial** - see details below | Investigation |
| Supports WSL? | **No** | Official Docs |
| Supports browsers other than Chrome? | **No** (Brave, Arc not supported) | Official Docs |

### Agents SDK Compatibility Analysis

**Key Question:** Can Claude sessions spawned programmatically via Agents SDK use Claude in Chrome?

**Answer: Partially Compatible**

The Agents SDK can spawn Claude Code sessions programmatically:

```python
from anthropic_claude_agent_sdk import ClaudeSDKClient

client = ClaudeSDKClient()
response = client.query("Navigate to localhost:5007 and verify the dashboard loads")
```

**However, Claude in Chrome has specific requirements:**

1. **Extension must be installed** in user's Chrome browser
2. **Chrome must be running** and visible
3. **Tab groups are session-scoped** - each spawned session gets its own context
4. **No automatic reconnection** - if MCP connection drops, session cannot recover

**Implication for Ralph Loop:**
- Sequential sessions (via /continue-ralph) work well
- Parallel sessions may compete for Chrome resources
- Each session must call `tabs_context_mcp` at startup to acquire tabs

### Session Spawn Patterns

**Pattern A: Sequential Ralph Loop (Recommended)**
```
Session 1 → Browser tests → Exits → Session 2 → Browser tests → Exits → ...
```
- Works well with Claude in Chrome
- Each session re-acquires tab context
- User sees all browser actions in real-time

**Pattern B: Parallel Worktrees with Shared Chrome**
```
Session 1 (worktree-1) → Tab Group A
Session 2 (worktree-2) → Tab Group B  (simultaneous)
Session 3 (worktree-3) → Tab Group C
```
- Possible but resource-intensive
- Multiple tab groups in same Chrome window
- Risk of confusion for user

**Pattern C: Headless/Background Sessions**
```
NOT SUPPORTED with Claude in Chrome
Must use Puppeteer MCP or Playwright MCP instead
```

---

## Part 2: Terminal Log Streaming Patterns

### Requirements

1. **Single terminal showing live logs** from current Ralph Loop session
2. **Previous session logs saved to files** for debugging
3. **Clear session identification** (which iteration is running)
4. **Resume capability** (can restart from any point)

### Solution: mprocs

**mprocs** is a terminal process manager that aggregates logs from multiple processes into a single view:

```yaml
# mprocs.yaml for Ralph Loop
procs:
  ralph-loop:
    shell: "cd /path/to/project && claude --chrome \"$(cat RALPH_PROMPT.md)\""
    log_dir: ".claude/data/ralph-loops/task-name/logs"

  dev-server:
    shell: "npm run dev -- --port 5007"
    log_dir: ".claude/data/ralph-loops/task-name/logs"
```

**Key Features:**
- Separate output pane for each process
- Automatic log file per process (`<log_dir>/<name>.log`)
- Switch between processes with keyboard shortcuts
- Start/stop/restart individual processes
- Scrollback with pause/resume

### Alternative: MultiTail

For simpler log tailing without process management:

```bash
# Tail multiple log files in split panes
multitail -s 2 \
  logs/iteration-1.log \
  logs/iteration-2.log \
  logs/dev-server.log
```

### Alternative: Custom Log Aggregator

For Ralph Loop specific needs:

```bash
#!/bin/bash
# ralph-log-streamer.sh

LOG_DIR=".claude/data/ralph-loops/$TASK_NAME/logs"
CURRENT_LOG="$LOG_DIR/current-session.log"

# Stream current session, archive on completion
tail -f "$CURRENT_LOG" | while read line; do
  ITERATION=$(grep -o 'Iteration: [0-9]*' "$LOG_DIR/../progress.txt" | cut -d' ' -f2)
  echo "[iter-$ITERATION] $line"
  echo "$line" >> "$LOG_DIR/iteration-$ITERATION.log"
done
```

### Recommended Approach for Ralph Loop

**Use mprocs with per-iteration log files:**

```yaml
# .claude/data/ralph-loops/{task}/mprocs.yaml
procs:
  ralph:
    shell: "./run-ralph-iteration.sh"
    log_dir: "./logs"

settings:
  log_dir: "./logs"
  scrollback: 5000

# ./run-ralph-iteration.sh
#!/bin/bash
ITER=$(grep 'Iteration:' progress.txt | cut -d' ' -f2)
LOGFILE="logs/iteration-$ITER.log"

echo "=== Starting Ralph Loop Iteration $ITER ===" | tee -a "$LOGFILE"
claude --chrome "$(cat RALPH_PROMPT.md)" 2>&1 | tee -a "$LOGFILE"
```

---

## Part 3: Puppeteer MCP vs Playwright MCP Comparison

### Puppeteer MCP

**Status:** Official `@modelcontextprotocol/server-puppeteer` is **deprecated**

From npm registry:
> "Package no longer supported. Recommend using Playwright MCP server instead."

**Features (when it worked):**
- Launch Chromium/Chrome instances
- Navigate, click, type, screenshot
- Execute JavaScript in page context
- Multi-page support

**Limitations:**
- Chromium-only (no Firefox, Safari)
- Active development ceased
- Community forks exist but vary in quality

### Playwright MCP (Recommended)

**Status:** Actively maintained by Microsoft

**Installation:**
```bash
claude mcp add --transport stdio playwright -- npx @playwright/mcp@latest
```

**Key Advantages:**

| Feature | Playwright MCP | Claude in Chrome |
|---------|---------------|-----------------|
| Headless mode | Yes | No |
| Cross-browser | Chromium, Firefox, WebKit | Chrome only |
| Session persistence | Browser instance controlled | Tabs persist, control doesn't |
| Authentication | User logs in manually | Shares browser login state |
| Resource usage | Separate browser process | Uses existing Chrome |
| Real-time visibility | Optional (can be visible) | Mandatory (always visible) |

**Integration with Claude Code:**
```javascript
// Playwright MCP tools available
playwright_navigate({ url: "http://localhost:5007" })
playwright_click({ selector: "button.submit" })
playwright_screenshot({ fullPage: true })
playwright_evaluate({ script: "document.title" })
```

### Comparison for Ralph Loop Use Cases

| Use Case | Best Tool | Reason |
|----------|-----------|--------|
| User watching browser tests | Claude in Chrome | Real-time visibility built-in |
| Headless CI/CD verification | Playwright MCP | Supports headless mode |
| Overnight autonomous loop | Playwright MCP | No display required |
| Manual iteration with observation | Claude in Chrome | Uses existing browser session |
| Parallel worktree testing | Playwright MCP | Each gets own browser instance |

---

## Part 4: Puppeteer in Anthropic's Autonomous-Coding Quickstart

### Investigation Finding

**The autonomous-coding quickstart does NOT use browser automation.**

Based on analysis of [anthropics/claude-quickstarts](https://github.com/anthropics/claude-quickstarts/tree/main/autonomous-coding):

**What it actually uses:**
- Claude Agent SDK for code generation
- Sandboxed bash execution (allowlist of commands)
- File system operations (read, write, edit)
- Git for version control

**Security model:**
- OS-level sandbox for bash commands
- Filesystem restricted to project directory
- Bash allowlist: `ls`, `cat`, `npm`, `node`, `git`, etc.

**Separate demos for browser:**
- `browser-use-demo/` - separate quickstart
- `computer-use-demo/` - separate quickstart

**Implication:**
The official autonomous coding pattern is CLI/code-focused, not browser-focused. Browser verification is handled by separate tools (Puppeteer MCP mentioned in documentation for screenshot capability).

---

## Part 5: Recommended Observability Architecture

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         RALPH LOOP OBSERVABILITY                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                        USER'S SCREEN                                 │   │
│   ├───────────────────────────┬─────────────────────────────────────────┤   │
│   │                           │                                          │   │
│   │   TERMINAL (mprocs)       │        CHROME BROWSER                    │   │
│   │   ┌─────────────────┐     │        ┌─────────────────────┐          │   │
│   │   │ ralph-loop      │     │        │ [MCP Tab Group]     │          │   │
│   │   │ ────────────────│     │        │                     │          │   │
│   │   │ [iteration 5]   │     │        │  localhost:5007     │          │   │
│   │   │ Checking feat 3 │     │        │  ┌───────────────┐  │          │   │
│   │   │ > navigate...   │────────────────►│  Dashboard    │  │          │   │
│   │   │ > click...      │     │        │  │  (live)       │  │          │   │
│   │   │ > verify...     │     │        │  └───────────────┘  │          │   │
│   │   └─────────────────┘     │        └─────────────────────┘          │   │
│   │   ┌─────────────────┐     │                                          │   │
│   │   │ dev-server      │     │                                          │   │
│   │   │ ────────────────│     │                                          │   │
│   │   │ [vite] ready    │     │                                          │   │
│   │   │ port 5007       │     │                                          │   │
│   │   └─────────────────┘     │                                          │   │
│   │                           │                                          │   │
│   └───────────────────────────┴─────────────────────────────────────────┘   │
│                                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                           FILE-BASED TRACKING                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   .claude/data/ralph-loops/{task}/                                          │
│   ├── logs/                                                                  │
│   │   ├── iteration-1.log    # Full output from iteration 1                 │
│   │   ├── iteration-2.log    # Full output from iteration 2                 │
│   │   ├── ...                                                               │
│   │   └── dev-server.log     # Dev server output                            │
│   ├── artifacts/                                                             │
│   │   ├── feature-1-verify.gif   # GIF recording of verification           │
│   │   ├── feature-2-verify.png   # Screenshot proof                        │
│   │   └── ...                                                               │
│   ├── progress.txt           # Human-readable state (current iteration)     │
│   └── feature_list.json      # Machine-readable feature status              │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Components

#### 1. Live Log Streaming (mprocs)

```yaml
# ralph-loops/{task}/mprocs.yaml
procs:
  ralph-loop:
    shell: "./scripts/run-iteration.sh"
    log_dir: "./logs"
    env:
      TASK_NAME: "{task}"

  dev-server:
    shell: "npm run dev -- --port 5007"
    log_dir: "./logs"
    autostart: true

settings:
  proc_list_width: 30
  scrollback: 10000
```

#### 2. Per-Iteration Log Files

```bash
# scripts/run-iteration.sh
#!/bin/bash
set -e

TASK_NAME="${TASK_NAME:-unknown}"
ITER=$(grep 'Iteration:' progress.txt 2>/dev/null | cut -d' ' -f2 || echo "1")
LOGFILE="logs/iteration-$ITER.log"

echo "======================================" | tee -a "$LOGFILE"
echo "=== RALPH LOOP: $TASK_NAME ===" | tee -a "$LOGFILE"
echo "=== ITERATION: $ITER ===" | tee -a "$LOGFILE"
echo "=== STARTED: $(date) ===" | tee -a "$LOGFILE"
echo "======================================" | tee -a "$LOGFILE"

# Run Claude with Chrome integration
claude --chrome "$(cat RALPH_PROMPT.md)" 2>&1 | tee -a "$LOGFILE"

echo "======================================" | tee -a "$LOGFILE"
echo "=== COMPLETED: $(date) ===" | tee -a "$LOGFILE"
echo "======================================" | tee -a "$LOGFILE"
```

#### 3. Browser Visibility (Claude in Chrome)

**User Setup Instructions:**
```markdown
## Window Layout for Ralph Loop

1. Open Terminal (Cursor/iTerm)
   - Position: Left half of screen
   - Run: `cd .claude/data/ralph-loops/{task} && mprocs`

2. Open Chrome Browser
   - Position: Right half of screen
   - Claude in Chrome extension installed
   - Tab group visible (not collapsed)

3. Start the Loop
   - In mprocs, select `ralph-loop` process
   - Press `s` to start

4. During Execution
   - Watch terminal for Claude's reasoning
   - Watch browser for live actions
   - DO NOT interact with Claude's tab group
```

#### 4. Artifact Generation (GIFs/Screenshots)

**Integrated into RALPH_PROMPT.md verification steps:**
```markdown
## Verification with Artifacts

For each feature verification:
1. Start GIF recording: `gif_creator({ action: "start_recording", tabId })`
2. Perform test actions (navigate, click, verify)
3. Stop recording: `gif_creator({ action: "stop_recording", tabId })`
4. Export: `gif_creator({ action: "export", download: true, filename: "feature-{N}.gif" })`
5. Move to artifacts/: Update feature_list.json with artifact_path
```

#### 5. Session ID Tracking

**progress.txt includes session tracking:**
```markdown
## Session History
| Iteration | Session ID | Started | Completed | Result |
|-----------|------------|---------|-----------|--------|
| 1 | sess-a1b2c3 | 2026-01-16 10:00 | 2026-01-16 10:15 | feature-1 passed |
| 2 | sess-d4e5f6 | 2026-01-16 10:15 | 2026-01-16 10:28 | feature-2 passed |
| 3 | sess-g7h8i9 | 2026-01-16 10:28 | - | in progress |
```

---

## Part 6: Implementation Approach

### Phase 1: Basic Observability (Immediate)

1. **Add mprocs configuration** to ralph-loop directory
2. **Update run scripts** to log to per-iteration files
3. **Document user setup** for split-screen window layout
4. **Test with city-breakdown-dashboard** task

**Files to create:**
- `ralph-loops/{task}/mprocs.yaml`
- `ralph-loops/{task}/scripts/run-iteration.sh`
- Update `RALPH_PROMPT.md` with artifact generation steps

### Phase 2: Enhanced Tracking (Next)

1. **Add session ID tracking** to progress.txt
2. **Add artifact generation** to verification workflow
3. **Create `/ralph-status` command** to aggregate across worktrees
4. **Test parallel execution** with mprocs managing multiple worktrees

### Phase 3: Alternative Browser Tools (If Needed)

If Claude in Chrome proves unreliable for autonomous loops:

1. **Add Playwright MCP** as alternative browser tool
2. **Create headless verification mode** for CI/CD or overnight runs
3. **Keep Claude in Chrome** for interactive/observed sessions

---

## Part 7: Comparison Summary

### Claude in Chrome vs Playwright MCP

| Criteria | Claude in Chrome | Playwright MCP |
|----------|-----------------|----------------|
| **User Visibility** | Excellent (mandatory) | Good (optional) |
| **Headless Support** | No | Yes |
| **Authentication** | Shares browser login | Manual per-session |
| **Resource Usage** | Low (reuses Chrome) | Higher (new browser) |
| **Stability** | Connection drops possible | More stable |
| **Setup Complexity** | Extension install | npx command |
| **Cross-browser** | Chrome only | Chromium, Firefox, WebKit |
| **Best For** | Interactive Ralph Loop | Automated/CI Ralph Loop |

### Recommendation Matrix

| Scenario | Recommended Tool |
|----------|-----------------|
| User actively watching Ralph Loop | Claude in Chrome |
| Overnight autonomous execution | Playwright MCP (headless) |
| Parallel worktree testing | Playwright MCP (isolated instances) |
| Quick manual verification | Claude in Chrome |
| CI/CD integration | Playwright MCP |

---

## Part 8: Conclusion

### Claude in Chrome is Compatible with Ralph Loop When:

1. **User is present** and can observe browser window
2. **Sequential sessions** (not heavily parallel)
3. **Chrome remains visible** throughout execution
4. **Extension connection** is stable (short iterations help)

### Claude in Chrome is NOT Suitable When:

1. **Headless execution** is required
2. **Long unattended runs** (connection drop risk)
3. **Parallel worktrees** need isolated browsers
4. **CI/CD environment** without display

### Terminal UX Solution:

**mprocs** provides the ideal single-terminal experience:
- Live log streaming from current session
- Automatic per-iteration log files
- Process management (start/stop/restart)
- Keyboard navigation between panes

### Next Steps:

1. Create `mprocs.yaml` template in `/plan-ralph-loop` skill
2. Update `init.sh.template` to integrate with mprocs
3. Add artifact generation steps to `RALPH_PROMPT.md.template`
4. Test complete observability stack with city-breakdown-dashboard

---

## References

### Claude in Chrome
- [Official Documentation](https://code.claude.com/docs/en/chrome)
- [Medium: Claude Code Browser Feature Test](https://medium.com/@joe.njenga/i-tested-new-claude-code-browser-feature-claude-code-can-now-control-your-browser-d526024c033b)

### Playwright MCP
- [Simon Willison's TIL](https://til.simonwillison.net/claude-code/playwright-mcp-claude-code)
- [Microsoft Playwright MCP](https://github.com/microsoft/playwright-mcp)
- [ExecuteAutomation Playwright MCP](https://github.com/executeautomation/mcp-playwright)

### Terminal Tools
- [mprocs GitHub](https://github.com/pvolok/mprocs)
- [Teemux - Log Aggregation](https://github.com/gajus/teemux)
- [MultiTail Guide](https://www.thegeekstuff.com/2009/09/multitail-to-view-tail-f-output-of-multiple-log-files-in-one-terminal/)

### Anthropic References
- [Effective Harnesses for Long-Running Agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)
- [Claude Quickstarts - Autonomous Coding](https://github.com/anthropics/claude-quickstarts/tree/main/autonomous-coding)
- [Claude Agent SDK](https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk)
