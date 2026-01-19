# Investigation Plan: Parallel Browser Verification for Ralph Loop

**Created:** 2026-01-19
**Status:** Planning
**Related:** Phase 3 E2E testing - parallel browser access

---

## Investigation Overview

The Ralph Loop system needs to support parallel browser verification across multiple concurrent sessions. Currently, both Chrome DevTools MCP and Playwright MCP fail when multiple sessions attempt to use them simultaneously due to browser profile/instance conflicts.

### Use Cases to Support

1. **Parallel Subagents:** A session within a Ralph Loop kicks off multiple subagents, each needing browser access for testing
2. **Parallel Ralph Loops:** Multiple Ralph Loops running simultaneously on different tasks
3. **Git Worktree Parallelism:** Multiple Ralph Loops running on the same task in different git worktrees

### Current Error

```
Error: The browser is already running for /Users/giannimunro/.cache/chrome-devtools-mcp/chrome-profile.
Use --isolated to run multiple browser instances.
```

### Constraints Identified

Both MCP servers have been tested with `--isolated` flag:
- Chrome DevTools MCP: Works but loses logged-in profiles
- Playwright MCP: Works but also requires fresh sessions each time

Both solutions require handling authentication for websites that need login (including the dev server).

---

## Known Information

### What's Working

1. **Chrome DevTools MCP** works for single-session browser verification in spawned/print-mode sessions
2. **Server auto-restart** via nodemon works for backend code changes
3. **Git commit instructions** are clear for multi-directory scenarios

### What's Not Working

1. **Concurrent browser access** - Multiple sessions cannot share one browser instance
2. **Profile isolation** - Using `--isolated` loses authentication state

### Resources for Investigation

- Chrome DevTools MCP: https://github.com/ChromeDevTools/chrome-devtools-mcp/
- Playwright MCP: https://github.com/microsoft/playwright-mcp/

---

## Instructions

Execute this investigation by spinning up **3 parallel subagents** using the Task tool with `subagent_type="general-purpose"`.

Each subagent will investigate ONE specific approach and create a deliverable document in this directory.

**After all subagents complete:**
1. Read all INVESTIGATION_*.md files created by the subagents
2. Compile findings into a summary
3. Report to user with recommendations on which approach to pursue

---

## subagent_1_instructions

### Context

Chrome DevTools MCP supports isolated browser instances via `--isolated` flag or custom `userDataDir`. This subagent investigates how to configure Chrome DevTools MCP for parallel access.

### Instructions

1. **Research Chrome DevTools MCP configuration options:**
   - Fetch and analyze https://github.com/ChromeDevTools/chrome-devtools-mcp/
   - Look for documentation on `--isolated` flag behavior
   - Look for `userDataDir` configuration options
   - Check if there are environment variables or config file options

2. **Investigate parallel instance strategies:**
   - Can multiple MCP servers be configured with different profile directories?
   - Can sessions dynamically specify which profile to use?
   - How would authentication be handled per-profile?

3. **Investigate session-based port assignment:**
   - Can Chrome be started on different debugging ports per session?
   - How would the MCP server connect to a specific port?

4. **Check for sandbox compatibility:**
   - Are there known issues with Chrome DevTools MCP in sandboxed environments?
   - What flags might be needed for container/sandbox use?

### Deliverable

Create: `INVESTIGATION_CHROME_DEVTOOLS_PARALLEL.md`

Include:
- Configuration options discovered
- Proposed architecture for parallel access
- Authentication handling strategy
- Sandbox compatibility notes
- Pros/cons vs other approaches

### Report

Return a summary of findings to the orchestrator.

---

## subagent_2_instructions

### Context

Playwright MCP may offer better isolation through its browser context system. Playwright natively supports running multiple isolated browser contexts within a single browser instance.

### Instructions

1. **Research Playwright MCP configuration options:**
   - Fetch and analyze https://github.com/microsoft/playwright-mcp/
   - Look for documentation on isolated contexts/sessions
   - Check if there are parallel execution patterns documented

2. **Investigate Playwright's native isolation:**
   - How do browser contexts work in Playwright?
   - Can MCP leverage contexts for session isolation?
   - What's the overhead of context creation vs new browser?

3. **Compare with existing Playwright usage:**
   - Read the project's existing Playwright scripts in `UberEats-Image-Extractor/` (if any)
   - Check Docker/container configurations for Playwright
   - Look at `package.json` for Playwright dependencies

4. **Authentication strategies:**
   - How can authentication state be preserved/shared across contexts?
   - Can storage state be saved and restored per context?
   - What's the pattern for handling login flows?

### Deliverable

Create: `INVESTIGATION_PLAYWRIGHT_PARALLEL.md`

Include:
- Playwright MCP capabilities for parallel access
- Browser context isolation strategy
- Authentication state management approach
- Comparison with Chrome DevTools MCP
- Recommended configuration

### Report

Return a summary of findings to the orchestrator.

---

## subagent_3_instructions

### Context

The Ralph Loop system may need architectural changes to support parallel browser verification. This subagent investigates system-level solutions including MCP server management, session coordination, and workflow modifications.

### Instructions

1. **Investigate MCP server lifecycle management:**
   - Read current Claude MCP configuration: `~/.claude.json` or project `.claude/` configs
   - How are MCP servers started/stopped?
   - Can servers be dynamically spawned per session?

2. **Research session coordination patterns:**
   - Should browser access be sequential (lock/queue system)?
   - Should each session have its own browser instance?
   - What's the trade-off between isolation and resource usage?

3. **Investigate worktree-specific configurations:**
   - Can each git worktree have its own MCP server configuration?
   - How would port assignments be managed across worktrees?
   - Read existing worktree initialization scripts if they exist

4. **Authentication workflow design:**
   - Design a pattern for handling login credentials in automated sessions
   - Consider: env vars, credential files, automated login flows
   - How can this work without exposing secrets in prompts?

5. **Review Ralph Loop orchestration:**
   - Read `.claude/scripts/ralph-loop/ralph-orchestrator.sh`
   - How could it be modified to manage browser instances?
   - Could init.sh include browser setup steps?

### Deliverable

Create: `INVESTIGATION_SYSTEM_ARCHITECTURE.md`

Include:
- Current MCP configuration analysis
- Proposed system architecture for parallel browser access
- Session coordination strategy
- Authentication workflow design
- Changes needed to Ralph Loop orchestration
- Resource considerations (memory, CPU for multiple browsers)

### Report

Return a summary of findings and architectural recommendations.

---

## Success Criteria

The investigation is successful if it produces:

1. **Clear recommendation** on which approach to pursue (Chrome DevTools, Playwright, or hybrid)
2. **Configuration details** for implementing parallel browser access
3. **Authentication strategy** that doesn't require manual login per session
4. **Architecture design** for integrating with Ralph Loop system
5. **Implementation roadmap** with specific files to modify

---

## Post-Investigation Steps

After reading all investigation documents:

1. Synthesize findings across all three areas
2. Identify the recommended approach with justification
3. Create a prioritized implementation plan
4. Report findings to user for approval before implementation
