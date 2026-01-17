# Investigation: Claude in Chrome Real-Time Visibility for Ralph Loop

## Executive Summary

This investigation examines how Claude in Chrome MCP tools work in the context of Ralph Loop sequential sessions, with focus on browser visibility requirements, session handoff, and real-time visibility for users.

**Key Findings:**
1. **Headless mode is NOT supported** - Claude in Chrome requires a visible browser window
2. **Tab groups are session-scoped** - Each Claude Code session can create its own tab group
3. **Tabs do NOT persist between sessions** - New sessions must acquire tabs via `tabs_context_mcp`
4. **MCP connection drops are a known issue** - No automatic reconnection mechanism exists
5. **User CAN interact with other apps** - Browser continues working while user works elsewhere

---

## Part 1: Claude in Chrome Visibility Requirements

### Headless Mode: NOT Supported

Based on [official Claude Code documentation](https://code.claude.com/docs/en/chrome):

> "The extension requires a visible browser window - headless mode is not supported."

**Implications for Ralph Loop:**
- Cannot run browser tests in background without visual browser
- User WILL see browser actions in real-time (mandatory, not optional)
- Chrome window must remain visible during browser testing phases
- This aligns with user requirement: "User MUST see browser actions in real-time"

### Why Visible Browser Required

The Claude in Chrome architecture:
1. Chrome extension (Claude in Chrome) runs in user's browser
2. Claude Code CLI communicates via Chrome's Native Messaging API
3. Extension receives commands and executes them in visible tabs
4. Screenshots, GIFs, and visual feedback require rendered DOM

**No workaround exists** - this is fundamental to how the extension works.

---

## Part 2: Tab Management and Session Handling

### Tab Group Architecture

Claude in Chrome uses **tab groups** to organize its controlled tabs:

```
┌─────────────────────────────────────────────────────────┐
│                    Chrome Browser                        │
├─────────────────────────────────────────────────────────┤
│  [MCP Tab Group 1]    [User's Regular Tabs]  [Other]    │
│  ├── Tab A (claude)   ├── Gmail              ├── News   │
│  ├── Tab B (test page)├── Slack                         │
│  └── Tab C (dev server)                                 │
├─────────────────────────────────────────────────────────┤
│  [MCP Tab Group 2] (if created by another session)      │
│  └── Tab D (different test)                             │
└─────────────────────────────────────────────────────────┘
```

### Getting Tab Context

Every Claude Code session using Chrome integration MUST call `tabs_context_mcp` at startup:

```javascript
mcp__claude-in-chrome__tabs_context_mcp({
  createIfEmpty: true  // Creates new tab group if none exists
})
```

**Return value includes:**
- List of tab IDs in the current group
- Whether a new group was created

### Tab Lifecycle

| Event | What Happens |
|-------|--------------|
| Session starts | Must call `tabs_context_mcp` to get available tabs |
| Create new tab | Use `tabs_create_mcp` - adds to current group |
| Navigate | Use `navigate` tool with existing tab ID |
| Session ends | Tabs remain in Chrome, but session loses control |
| New session starts | Must re-acquire tabs via `tabs_context_mcp` |

---

## Part 3: Sequential Session Browser Handoff

### Critical Finding: No Automatic Tab Persistence

When Ralph Loop Session 1 finishes and Session 2 starts:

```
Session 1:
├── Calls tabs_context_mcp (gets/creates tab group)
├── Creates Tab A (tabId: 12345)
├── Does browser testing
├── Updates progress.txt
├── Exits (triggers /continue-ralph)
└── Connection to tabs SEVERED

Session 2:
├── NEW Claude Code process starts
├── Chrome extension still running
├── Tab A still exists in browser
├── BUT Session 2 has no tab IDs!
└── MUST call tabs_context_mcp to re-acquire
```

### Session Handoff Scenarios

**Scenario A: Same Tab Group (Ideal)**
```javascript
// Session 2 calls:
tabs_context_mcp({ createIfEmpty: false })
// Returns: { tabs: [12345], groupExists: true }
// Result: Can reuse Tab A!
```

**Scenario B: Group Doesn't Exist Anymore**
```javascript
// Session 2 calls:
tabs_context_mcp({ createIfEmpty: true })
// Returns: { tabs: [98765], groupExists: false, created: true }
// Result: New tab, previous state lost
```

**Scenario C: Multiple Tab Groups from Parallel Sessions**
```javascript
// If Session 1 and Session 2 run simultaneously:
// Each gets their own tab group
// No conflict, but uses more browser resources
```

### Recommendation for Ralph Loop

**RALPH_PROMPT.md should include:**

```markdown
## Browser Session Start Procedure

1. Call `tabs_context_mcp({ createIfEmpty: true })` at session start
2. Check if existing tabs are available
3. If tab exists and is at correct URL (localhost:{PORT}):
   - Reuse the existing tab
   - Skip full page reload if possible
4. If no suitable tab exists:
   - Create new tab via `tabs_create_mcp`
   - Navigate to dev server URL
5. Store tab ID for use throughout session
```

---

## Part 4: MCP Connection Stability

### Known Issue: Connection Drops

From [GitHub Issue #15232](https://github.com/anthropics/claude-code/issues/15232):

> "When MCP server connections drop (particularly the Claude in Chrome extension), there's no way for Claude to programmatically reconnect."

**Symptoms:**
- Tool calls return "Browser extension is not connected"
- Claude cannot recover without user intervention
- Requires manual refresh (Cmd+R in Claude Code)

### Impact on Ralph Loop

| Scenario | Impact | Mitigation |
|----------|--------|------------|
| Short iteration (<5 min) | Low risk | None needed |
| Long iteration (>10 min) | Medium risk | User monitors |
| Overnight loop | High risk | Add health checks |

### Recommended Health Check Pattern

Add to RALPH_PROMPT.md verification steps:

```markdown
## Browser Connection Health Check

Before each browser action:
1. Attempt a simple operation (e.g., screenshot)
2. If "not connected" error:
   - Document in progress.txt: "Browser connection lost at [timestamp]"
   - Set status to "blocked"
   - Exit iteration with clear instructions for user
3. If successful, proceed with verification
```

---

## Part 5: Real-Time Visibility Architecture

### How User Sees Browser Actions

```
┌─────────────────────────────────────────────────────────┐
│                    User's Screen                         │
├─────────────────┬───────────────────────────────────────┤
│                 │                                        │
│   Terminal      │        Chrome Browser                  │
│   (Cursor)      │        (Visible Window)                │
│                 │                                        │
│  ┌───────────┐  │  ┌─────────────────────────────────┐  │
│  │ Claude    │  │  │                                 │  │
│  │ Output    │  │  │    http://localhost:5007       │  │
│  │           │──┼──│                                 │  │
│  │ > navigate│  │  │    [Page renders in real-time] │  │
│  │ > click   │  │  │    [Clicks visible]            │  │
│  │ > verify  │  │  │    [Screenshots captured]      │  │
│  │           │  │  │                                 │  │
│  └───────────┘  │  └─────────────────────────────────┘  │
│                 │                                        │
└─────────────────┴───────────────────────────────────────┘
```

### User Experience During Ralph Loop

1. **Terminal:** Shows Claude's output (tool calls, reasoning)
2. **Browser:** Shows actual browser actions happening
3. **User can:** Observe, but should NOT interact with Claude's tabs
4. **User can:** Use other applications, other Chrome tabs freely

### Window Management Recommendations

```markdown
## Optimal Window Setup for Ralph Loop

1. **Split screen layout:**
   - Left: Terminal/Cursor with Claude session
   - Right: Chrome browser with visible Claude tab group

2. **Browser window settings:**
   - Do NOT minimize Chrome - actions won't be visible
   - Resize Chrome to reasonable size (e.g., 1200x800)
   - Keep Claude's tab group visible (don't collapse)

3. **Safe user actions:**
   - Can use other Chrome tabs (not in Claude's group)
   - Can use other applications (Slack, email, etc.)
   - Can observe Claude's actions in real-time

4. **Avoid during testing:**
   - Clicking on Claude's controlled tabs
   - Closing Claude's tab group
   - Minimizing Chrome window
```

---

## Part 6: GIF Recording and Artifacts

### Recording Browser Actions

Claude in Chrome includes GIF recording capability:

```javascript
// Start recording
mcp__claude-in-chrome__gif_creator({
  action: "start_recording",
  tabId: TAB_ID
})

// ... browser actions happen ...
// Take screenshot immediately after starting to capture first frame

// Stop recording
mcp__claude-in-chrome__gif_creator({
  action: "stop_recording",
  tabId: TAB_ID
})

// Export GIF
mcp__claude-in-chrome__gif_creator({
  action: "export",
  tabId: TAB_ID,
  download: true,
  filename: "verification-iteration-5.gif",
  options: {
    showClickIndicators: true,
    showActionLabels: true,
    showProgressBar: true
  }
})
```

### Integration with Ralph Loop

**Recommendation for feature_list.json verification steps:**

```json
{
  "id": 5,
  "category": "ui",
  "description": "Button click shows modal",
  "steps": [
    "Start GIF recording",
    "Navigate to dashboard",
    "Click 'New Report' button",
    "Verify modal appears",
    "Stop GIF recording",
    "Export GIF as verification artifact"
  ],
  "passes": false,
  "artifact_path": null
}
```

**Update artifact_path on completion:**
```json
{
  "artifact_path": "./artifacts/feature-5-verification.gif"
}
```

---

## Part 7: Session-to-Browser Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        RALPH LOOP ITERATION N                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌────────────────────┐                                             │
│  │   Claude Code      │                                             │
│  │   Session N        │                                             │
│  │   (CLI Process)    │                                             │
│  └─────────┬──────────┘                                             │
│            │                                                         │
│            │ Native Messaging API                                    │
│            │                                                         │
│  ┌─────────▼──────────┐          ┌─────────────────────────┐        │
│  │  Claude in Chrome  │◄────────►│     Chrome Browser      │        │
│  │     Extension      │          │                         │        │
│  │  (background.js)   │          │  ┌─────────────────┐   │        │
│  └────────────────────┘          │  │  MCP Tab Group  │   │        │
│                                   │  │  ┌───────────┐ │   │        │
│  Connection established at        │  │  │  Tab A    │ │   │ VISIBLE │
│  session start via --chrome       │  │  │ localhost │ │   │   TO    │
│                                   │  │  │   :5007   │ │   │  USER   │
│                                   │  │  └───────────┘ │   │        │
│                                   │  └─────────────────┘   │        │
│                                   └─────────────────────────┘        │
│                                                                      │
├─────────────────────────────────────────────────────────────────────┤
│  SESSION ENDS (via /continue-ralph)                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌────────────────────┐                                             │
│  │   CLI Process N    │ ─────► TERMINATED                           │
│  └────────────────────┘                                             │
│                                                                      │
│  ┌────────────────────┐          ┌─────────────────────────┐        │
│  │  Claude in Chrome  │◄────────►│     Chrome Browser      │        │
│  │     Extension      │          │                         │        │
│  │  (still running)   │          │  Tab A STILL EXISTS     │ VISIBLE │
│  └────────────────────┘          │  (but no controller)    │        │
│                                   └─────────────────────────┘        │
│                                                                      │
├─────────────────────────────────────────────────────────────────────┤
│                        RALPH LOOP ITERATION N+1                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌────────────────────┐                                             │
│  │   Claude Code      │  NEW PROCESS                                │
│  │   Session N+1      │                                             │
│  │   (CLI Process)    │                                             │
│  └─────────┬──────────┘                                             │
│            │                                                         │
│            │ Calls tabs_context_mcp({ createIfEmpty: true })        │
│            │                                                         │
│  ┌─────────▼──────────┐          ┌─────────────────────────┐        │
│  │  Claude in Chrome  │◄────────►│     Chrome Browser      │        │
│  │     Extension      │          │                         │        │
│  │  Re-establishes    │          │  Tab A available!       │        │
│  │  connection        │          │  OR new Tab B created   │        │
│  └────────────────────┘          └─────────────────────────┘        │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Part 8: Browser State Cleanup Between Sessions

### What Persists vs What Doesn't

| State | Persists | Cleanup Needed |
|-------|----------|----------------|
| Chrome tabs | Yes (until manually closed) | Optional |
| Tab group | Yes | Optional |
| Page state (form data) | Yes | Might need refresh |
| Console logs | Yes (until navigation) | Clear manually |
| Network requests log | Cleared on navigation | No |
| GIF recording | No (must restart) | No |
| Tab ID references | No | Must re-acquire |

### Recommended Cleanup Steps

**Option A: Reuse Existing Tab (Faster)**
```markdown
## Session Start (Reuse Path)
1. Call tabs_context_mcp
2. If tab exists at localhost:{PORT}:
   - Refresh page to clear state
   - Clear console: mcp__claude-in-chrome__read_console_messages({ clear: true })
3. Proceed with verification
```

**Option B: Fresh Tab Each Session (Cleaner)**
```markdown
## Session Start (Fresh Path)
1. Call tabs_context_mcp
2. Create new tab via tabs_create_mcp
3. Navigate to localhost:{PORT}
4. Old tab remains but is ignored
5. Periodically: User manually closes unused tabs
```

### Recommendation for Ralph Loop

**Use Option A (reuse) for speed**, but document in RALPH_PROMPT.md:

```markdown
## Browser Tab Management

Each iteration should:
1. Check for existing tab at correct URL
2. If found: Refresh page, clear console logs
3. If not found: Create new tab, navigate to dev server
4. Document tab state in progress.txt if issues occur

User responsibility:
- Periodically close orphaned tabs from failed iterations
- Monitor Chrome memory usage during long loops
```

---

## Part 9: Limitations Affecting Ralph Loop Design

### Critical Limitations

| Limitation | Impact | Mitigation |
|------------|--------|------------|
| No headless mode | Browser MUST be visible | Accept this; align with user expectation |
| No auto-reconnect | Long sessions risk connection loss | Health checks; short iterations |
| No tab persistence API | Must re-acquire tabs each session | Call tabs_context_mcp at start |
| Single Chrome profile | All sessions share same Chrome | Isolated by tab groups |
| No cross-session memory | Claude doesn't remember past sessions | Files are the memory (progress.txt) |

### Design Constraints for RALPH_PROMPT.md

```markdown
## Browser Testing Constraints

1. **Sessions must be self-contained**
   - Cannot rely on browser state from previous session
   - Must verify dev server is running before browser tests
   - Must acquire tab context at session start

2. **Iterations should be short**
   - Target: Complete one feature verification per iteration
   - Reduces risk of MCP connection drops
   - Keeps context focused

3. **Progress tracking is file-based**
   - progress.txt: Human-readable state
   - feature_list.json: Machine-readable feature status
   - artifacts/: Screenshots, GIFs for verification evidence

4. **User must keep browser visible**
   - No minimizing Chrome during testing
   - No headless alternative exists
   - User can observe but should not interact with Claude's tabs
```

---

## Part 10: Recommendations Summary

### For RALPH_PROMPT.md Updates

1. **Add browser startup procedure:**
   ```markdown
   ## Browser Verification Setup
   1. Call tabs_context_mcp({ createIfEmpty: true })
   2. Create or reuse tab for localhost:{FRONTEND_PORT}
   3. Take initial screenshot before any changes
   ```

2. **Add connection health check:**
   ```markdown
   ## Before Browser Testing
   - Verify dev server responding (curl localhost:{FRONTEND_PORT})
   - Verify browser connection (screenshot test)
   - If connection fails, document and exit gracefully
   ```

3. **Add cleanup guidance:**
   ```markdown
   ## Before Exiting Session
   - Save any GIF recordings to artifacts/
   - Update feature_list.json with pass/fail
   - Document tab state issues in progress.txt
   ```

### For /continue-ralph Skill Updates

1. **Pass `--chrome` flag** when spawning new session:
   ```bash
   claude --chrome --model $MODEL "$(cat $RALPH_PROMPT_FILE)"
   ```

2. **Add browser availability check** in init.sh:
   ```bash
   # Check Chrome is running with extension
   if ! pgrep -x "Google Chrome" > /dev/null; then
       echo "WARNING: Chrome not running. Browser tests may fail."
   fi
   ```

### For User Instructions

1. **Window Setup:**
   - Terminal (Cursor) on left half of screen
   - Chrome browser on right half of screen
   - Claude's tab group visible (not collapsed)

2. **During Ralph Loop:**
   - Can use other applications
   - Can use other Chrome tabs
   - Do NOT interact with Claude's controlled tabs
   - Keep Chrome visible (not minimized)

3. **If Connection Drops:**
   - Check progress.txt for last state
   - Manually verify feature in browser
   - Resume with /continue-ralph

---

## References

- [Claude Code Chrome Documentation](https://code.claude.com/docs/en/chrome)
- [GitHub Issue #15232: MCP Auto-reconnect](https://github.com/anthropics/claude-code/issues/15232)
- [GitHub Issue #16195: Chrome MCP Auth Issues](https://github.com/anthropics/claude-code/issues/16195)
- [Claude in Chrome Threat Analysis](https://labs.zenity.io/p/claude-in-chrome-a-threat-analysis)
- [Medium: Claude Code Browser Feature Test](https://medium.com/@joe.njenga/i-tested-new-claude-code-browser-feature-claude-code-can-now-control-your-browser-d526024c033b)

---

## Appendix: Tool Reference Summary

### Essential Tools for Ralph Loop Browser Testing

| Tool | Purpose | When to Use |
|------|---------|-------------|
| `tabs_context_mcp` | Get/create tab group | Session start (MANDATORY) |
| `tabs_create_mcp` | Create new tab | When no suitable tab exists |
| `navigate` | Go to URL | After tab acquired |
| `read_page` | Get page structure | Before/after actions |
| `computer` (screenshot) | Capture visual state | Before/after verification |
| `computer` (click) | Click elements | During UI testing |
| `find` | Locate elements | Before clicking |
| `read_console_messages` | Check for errors | After each action |
| `gif_creator` | Record verification | For artifact generation |

### Tool Call Sequence Template

```javascript
// 1. Session initialization
const context = tabs_context_mcp({ createIfEmpty: true });
const tabId = context.tabs[0] || tabs_create_mcp().tabId;

// 2. Navigate to test page
navigate({ url: "http://localhost:5007", tabId });
computer({ action: "wait", duration: 2, tabId });

// 3. Initial screenshot
computer({ action: "screenshot", tabId });

// 4. Verify element exists
const button = find({ query: "submit button", tabId });
if (!button.found) { /* mark as failed */ }

// 5. Interact
computer({ action: "left_click", ref: button.ref, tabId });
computer({ action: "wait", duration: 1, tabId });

// 6. Verify result
computer({ action: "screenshot", tabId });
const errors = read_console_messages({ tabId, onlyErrors: true });
if (errors.length > 0) { /* mark as failed */ }

// 7. Complete
// Update feature_list.json: passes: true
```
