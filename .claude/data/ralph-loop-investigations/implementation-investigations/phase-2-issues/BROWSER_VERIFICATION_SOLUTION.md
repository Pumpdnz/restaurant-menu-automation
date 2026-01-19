# Phase 2 Issue: Browser Verification Not Working in Spawned Sessions

**Date:** 2026-01-19
**Status:** RESOLVED
**Related E2E Test:** dashboard-update-v2, dashboard-update-v3

---

## Problem Statement

During the first E2E tests of the Ralph Loop v2.0 system, browser verification was not being performed by spawned sessions despite:
1. Instructions in RALPH_PROMPT.md to verify UI features in the browser
2. Sessions having theoretical access to browser automation tools
3. The testing method being set to "Combined" (browser + build verification)

### Evidence

**Session 3 (dashboard-update-v2):**
> "Since I can't actually open a browser, I'll read the updated Dashboard file to make sure everything looks correct"

**When sessions were resumed and questioned:**
> "I had browser automation tools available (mcp__claude-in-chrome__*) and should have used tabs_context_mcp, navigated to http://localhost:5007, taken screenshots... Instead, I read the code and assumed it worked correctly"

### Impact

- All 12 features in dashboard-update-v2 were marked as "passed" without actual browser verification
- UI bugs could have been missed
- The verification guarantee of the Ralph Loop system was compromised

---

## Root Cause Analysis

### Initial Hypothesis (Incorrect)

The initial hypothesis was that the RALPH_PROMPT.md template lacked explicit browser verification instructions. We updated the template to include explicit tool names and instructions.

**Result:** Sessions still did not use browser tools after the template update.

### Actual Root Cause (Confirmed)

**Claude in Chrome MCP tools do NOT work in spawned/print-mode sessions.**

The Ralph Loop orchestrator spawns sessions using:
```bash
claude --model "$model" --dangerously-skip-permissions --print "$(cat "$PROMPT_FILE")"
```

These are non-interactive "print mode" sessions. The Claude in Chrome MCP extension requires an interactive browser extension connection that is not available in print mode sessions.

### Verification Test

Created test script: `.claude/scripts/ralph-loop/test-chrome-devtools-mcp-spawned.sh`

```bash
# Direct instruction test
PROMPT="Call the mcp__chrome-devtools__list_pages tool to list Chrome pages. If successful output TEST_PASSED, if it fails output TEST_FAILED with the error."

claude --model sonnet --dangerously-skip-permissions --print "$PROMPT"
```

**Test Results:**
- Claude in Chrome tools: NOT ACCESSIBLE in spawned sessions
- Chrome DevTools MCP tools: ACCESSIBLE in spawned sessions ✅

---

## Solution Implemented

Replace all references to "Claude in Chrome" with "Chrome DevTools MCP" throughout the Ralph Loop system.

### Chrome DevTools MCP Tools

| Tool | Purpose |
|------|---------|
| `mcp__chrome-devtools__list_pages` | List all Chrome pages/tabs |
| `mcp__chrome-devtools__navigate_page` | Navigate to a URL |
| `mcp__chrome-devtools__take_screenshot` | Capture visual state |
| `mcp__chrome-devtools__take_snapshot` | Capture DOM snapshot |
| `mcp__chrome-devtools__evaluate_script` | Run JavaScript on the page |
| `mcp__chrome-devtools__list_console_messages` | Check for JS errors |
| `mcp__chrome-devtools__resize_page` | Change viewport size |

### Tool Mapping (Old → New)

| Claude in Chrome (broken) | Chrome DevTools (working) |
|---------------------------|---------------------------|
| `tabs_context_mcp` | `list_pages` |
| `navigate` | `navigate_page` |
| `computer` (screenshot) | `take_screenshot` |
| `find` / `read_page` | `evaluate_script` |
| `read_console_messages` | `list_console_messages` |

---

## Files Changed

### 1. SKILL.md
**Path:** `.claude/skills/plan-ralph-loop/SKILL.md`

**Changes:**
- Updated testing method table: "Claude in Chrome" → "Chrome DevTools"
- Added warning: "Do NOT use Claude in Chrome - those MCP tools are not accessible in spawned/print-mode sessions"
- Updated MCP tool references in testing method content generation section
- Changed documentation reference to `chrome-devtools.md`

### 2. RALPH_PROMPT.md.template
**Path:** `.claude/skills/plan-ralph-loop/templates/RALPH_PROMPT.md.template`

**Changes:**
- Updated "Do NOT Skip Verification" section with Chrome DevTools MCP tool names
- Added explicit warning about Claude in Chrome not working in spawned sessions

### 3. plan-parallel-investigation-ralph.md
**Path:** `.claude/commands/plan-parallel-investigation-ralph.md`

**Changes:**
- Updated testing options: "Browser verification (Claude in Chrome)" → "Browser verification (Chrome DevTools MCP)"
- Added note explaining why Chrome DevTools must be used

### 4. validate-environment.sh
**Path:** `.claude/scripts/ralph-loop/validate-environment.sh`

**Changes:**
- Updated Chrome warning message to reference "Chrome DevTools MCP" instead of "Claude in Chrome extension"

### 5. settings.local.json
**Path:** `.claude/settings.local.json`

**Changes:**
- Replaced 7 individual Chrome DevTools tool permissions with wildcard: `"mcp__chrome-devtools__*"`

---

## Files Created

### 1. chrome-devtools.md
**Path:** `.claude/skills/plan-ralph-loop/testing-methods/frontend/chrome-devtools.md`

New documentation file explaining how to use Chrome DevTools MCP for browser verification, including:
- Available tools and their purposes
- Setup requirements
- Core verification workflow
- Verification patterns (E2E test, feature verification)
- Code examples

### 2. test-chrome-devtools-mcp-spawned.sh
**Path:** `.claude/scripts/ralph-loop/test-chrome-devtools-mcp-spawned.sh`

Test script that validates Chrome DevTools MCP access from spawned sessions by:
1. Spawning Claude the same way as ralph-orchestrator.sh
2. Passing a direct instruction to call `mcp__chrome-devtools__list_pages`
3. Checking output for TEST_PASSED/TEST_FAILED

---

## Prerequisites for Chrome DevTools MCP

1. **Chrome must be running** with remote debugging enabled
2. **Chrome DevTools MCP server** must be configured in Claude settings (`~/.claude.json`):
   ```json
   "chrome-devtools": {
     "command": "npx",
     "args": ["chrome-devtools-mcp@latest"]
   }
   ```
3. **Permissions** must allow Chrome DevTools tools (now using wildcard `mcp__chrome-devtools__*`)

---

## Verification

After implementing the solution, run the test script from terminal:

```bash
bash .claude/scripts/ralph-loop/test-chrome-devtools-mcp-spawned.sh
```

Expected output:
```
✅ SUCCESS: Chrome DevTools MCP IS accessible in spawned sessions
```

---

## Lessons Learned

1. **Test assumptions about tool availability** - Just because a tool exists doesn't mean it works in all contexts (interactive vs. print mode)

2. **Print mode has limitations** - Spawned sessions via `claude --print` have different capabilities than interactive sessions

3. **Use wildcard permissions for MCP servers** - `mcp__chrome-devtools__*` is cleaner and more future-proof than listing individual tools

4. **Create validation tests** - The test script allows quick verification that the solution works in the actual execution context

---

## Related Issues

- **Issue 1 (Git Path Confusion):** Resolved in same session - see git commit instructions in RALPH_PROMPT.md.template
- **Issue 2 (Browser Verification):** This document

---

## Future Considerations

1. **Browser Health Check:** The `browser-health-check.sh` script may need updates to verify Chrome DevTools MCP connectivity rather than just checking if Chrome is running

2. **Fallback Options:** Consider adding Playwright MCP or Puppeteer MCP as alternative browser automation options if Chrome DevTools MCP is unavailable

3. **Documentation:** Keep `claude-in-chrome.md` as historical reference but mark it as deprecated

4. **Parallel Worktrees & Shared MCP Server:** When running parallel Ralph Loops in git worktrees, all sessions will share the same Chrome DevTools MCP server instance. This needs verification:
   - Can multiple spawned sessions safely share one MCP server?
   - Will page IDs conflict if multiple sessions try to navigate/interact simultaneously?
   - Should each worktree use a separate Chrome instance on different debugging ports?
   - May need to implement page isolation (each session creates/owns its own tab) or sequential browser access
   - Consider whether Playwright MCP (which can spawn isolated browser contexts) would be better suited for parallel execution
