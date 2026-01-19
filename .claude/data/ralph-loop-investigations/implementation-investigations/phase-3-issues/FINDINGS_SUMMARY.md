# Playwright MCP Investigation - Key Findings Summary

**Investigation Date:** January 19, 2026
**Status:** Complete
**Recommendation:** Adopt Playwright MCP with context-based parallel support

---

## Core Finding: Playwright MCP is Superior for Parallel Access

### Why Playwright Wins

| Metric | Playwright MCP | Chrome DevTools MCP | Winner |
|--------|---|---|---|
| Parallel subagents | 3-10 contexts in 1 browser | 3-10 separate browsers | Playwright (75% less memory) |
| Auth sharing | Automatic via storage state API | Manual profile duplication | Playwright |
| Memory per session | 5-10MB per context | 150-300MB per browser | Playwright (30x less) |
| Context creation | 100-200ms | 2-5 seconds | Playwright (20x faster) |
| Isolation guarantee | Complete per-context | Profile-level only | Playwright |

### The Key Innovation: Browser Contexts

Playwright natively supports creating multiple isolated browser contexts within a single browser instance:

```
One Browser Instance
  ├─ Context A (Subagent 1) - Fully isolated
  ├─ Context B (Subagent 2) - Fully isolated
  ├─ Context C (Subagent 3) - Fully isolated
  └─ Shared: Cookie storage file for authentication
```

Each context has its own:
- DOM tree
- JavaScript execution context
- Input queues
- Local/session storage

But they can all share authentication via a single storage state file.

---

## Critical Technical Detail: Storage State API

Playwright provides built-in API to export/import authentication state:

**After login in Context A:**
```javascript
await page.context().storageState({ path: '.auth/session.json' });
```

**Load in Context B, C, D:**
```javascript
const context = await browser.newContext({
  storageState: '.auth/session.json'  // Auto-loads cookies and storage
});
```

**Result:** No re-authentication needed for subagents. Contexts inherit authentication from first context without repeating login.

---

## Recommended Architecture for Ralph Loop

### Setup Phase (First Iteration)
Main Ralph Loop Session runs:
1. Start Playwright browser (1 instance)
2. Create main context
3. Navigate to localhost:5007
4. Login if needed
5. Export auth to file: context.storageState('.auth/ralph.json')
6. Auth file ready for subagents

### Parallel Subagent Phase
Subagents 1, 2, 3 each:
1. Connect to same Playwright browser
2. Create isolated context
3. Load auth from '.auth/ralph.json'
4. Operate independently with full authentication
5. No login duplication, no profile conflicts

### Resource Comparison

**Current Approach (3 separate browsers via Chrome DevTools MCP):**
- Memory: 750MB+ (3 × 250MB per browser)
- Setup time: 15+ seconds (3 × 5s startup)
- Processes: 3 browser instances running

**Recommended Approach (1 browser with 3 contexts):**
- Memory: 200MB (150MB browser + 3 × 20MB contexts)
- Setup time: 2-3 seconds (context creation is fast)
- Processes: 1 browser instance running

**Efficiency Gain: 75% less memory, 80% faster setup**

---

## Implementation Checklist

### Must-Have
- Add @playwright/mcp to project dependencies
- Configure Playwright MCP server in MCP settings
- Create auth-manager utility for storage state handling
- Update Ralph Loop init scripts to set up auth files
- Modify RALPH_PROMPT.md templates to export auth after login
- Create subagent initialization wrapper to load auth

### Should-Have
- Add .auth/ directory to .gitignore
- Document Playwright context patterns in .claude/guides/
- Implement token refresh logic for long-running sessions
- Add tests for concurrent context creation

### Nice-to-Have
- Monitor memory usage and optimize context limits
- Consider playwright-plus-mcp for extreme concurrency (50+ sessions)
- Add dashboard monitoring for browser health

---

## Quick Technical Reference

### Playwright MCP Configuration
```json
{
  "mcp": {
    "playwright": {
      "command": "npx",
      "args": [
        "@playwright/mcp@latest",
        "--browser", "chromium",
        "--user-data-dir", ".playwright-profile",
        "--console-level", "error"
      ]
    }
  }
}
```

### Context Creation with Auth
```javascript
// Context inherits cookies and storage from file
const context = await browser.newContext({
  storageState: '.auth/ralph-session.json'
});

const page = await context.newPage();
await page.goto('http://localhost:5007/dashboard');
// Already logged in!
```

### Auth Export Pattern
```javascript
// After successful login
const storageState = await page.context().storageState();
fs.writeFileSync('.auth/session.json', JSON.stringify(storageState));
```

---

## Comparison: Playwright MCP vs Chrome DevTools MCP

### Playwright MCP Advantages
✓ Multiple contexts in one browser
✓ Storage state API for auth sharing
✓ 30x less memory per context
✓ 20x faster context creation
✓ Built for parallel scenarios
✓ Supports Firefox and WebKit (not just Chrome)
✓ Native browser context isolation

### Chrome DevTools MCP Advantages
✓ More mature, widely documented
✓ Better for Chrome-specific debugging
✓ Simpler for single-browser workflows

### Verdict
For Ralph Loop parallel subagent verification, Playwright MCP is the clear winner with:
- Proven context isolation
- Built-in storage state sharing
- Optimized for concurrent access
- Significant resource savings

---

## Risk Mitigation

### Risk: Authentication expires during Ralph Loop
Mitigation: Store refresh tokens in storage state; implement auto-refresh logic

### Risk: Subagent can't find auth file
Mitigation: Use absolute paths; pass via environment variables with validation

### Risk: Browser instance becomes saturated
Mitigation: Monitor browser process; limit concurrent contexts to 5-10 per browser; consider playwright-plus-mcp if exceeding limits

### Risk: One subagent's actions affect another
Mitigation: Each context fully isolated - DOM, JavaScript, input queues are separate; no cross-context interaction possible

---

## Next Steps

**Week 1:** Infrastructure setup
- Add @playwright/mcp to dependencies
- Create auth-manager utility
- Configure MCP server

**Week 2:** Ralph Loop integration
- Update RALPH_PROMPT.md templates
- Modify init scripts for auth setup
- Test 2-3 subagents with shared auth

**Week 3:** Production hardening
- Test with dashboard-update-v4 Ralph Loop
- Implement token refresh logic
- Performance profiling

**Week 4:** Documentation and rollout
- Update Claude Code guides
- Document authentication workflow
- Train team on new approach

---

## Detailed Investigation Document

See: INVESTIGATION_PLAYWRIGHT_PARALLEL.md in this directory for:
- Complete technical architecture
- Storage state API details
- Code examples and best practices
- Implementation roadmap
- Comparison with Chrome DevTools MCP
- Handling of edge cases and authentication scenarios
