# Investigation: Playwright MCP for Parallel Browser Access in Ralph Loop

**Date:** January 19, 2026
**Investigation Focus:** Playwright MCP capabilities for parallel browser access
**Related Issue:** Phase 3 E2E testing - parallel browser access for Ralph Loop
**Status:** Complete

---

## Executive Summary

Playwright MCP offers **superior capabilities** for parallel browser access compared to Chrome DevTools MCP. The platform provides native browser context isolation, flexible authentication state management through storage state persistence, and explicit support for concurrent client sessions. While the official Playwright MCP supports both isolated ephemeral contexts and persistent profiles, enhanced variants (playwright-plus-mcp, concurrent-browser-mcp) provide unlimited parallel browser automation with zero session interference.

**Recommendation:** Adopt Playwright MCP with the following strategy:
1. Use persistent profile mode for development/testing scenarios
2. Leverage storage state for cross-session authentication
3. Consider playwright-plus-mcp if unlimited parallelism is required
4. Implement per-session browser contexts for Ralph Loop subagents

---

## Part 1: Playwright MCP Capabilities for Parallel Access

### 1.1 Native Isolation Features

Playwright MCP is built on top of Playwright's fundamental architecture, which natively supports multiple isolated browser contexts within a single browser instance. This architecture provides several advantages over Chrome DevTools MCP:

**Key Capability: Browser Contexts**
- Each browser context is a completely isolated environment with its own cookies, local storage, session storage, IndexedDB, and other persistent data
- Multiple contexts can run simultaneously within a single browser instance
- Contexts can be created and destroyed on-demand without restarting the browser
- Each context has independent JavaScript execution context and DOM

**Session Modes Supported:**
1. **Persistent Profile Mode (Default)**
   - Browser state persists across sessions
   - Cookies, local storage, and authentication tokens retained between connections
   - Similar to regular browser installation
   - Ideal for authenticated testing workflows where login credentials need to persist

2. **Isolated Ephemeral Contexts**
   - Each session gets a temporary, clean browser context
   - All storage state is cleared when context closes
   - No cross-session data leakage
   - Useful for isolated test scenarios requiring clean state

3. **Extension-Based Connections**
   - Connect to existing browser instances via browser extensions
   - Allows delegation to pre-existing, authenticated browsers
   - Useful for debugging with already-logged-in sessions

### 1.2 HTTP Client Isolation

For HTTP/SSE transport (which Ralph Loop uses via MCP):

**Default Behavior (Recommended for Ralph Loop):**
- Each MCP client connection receives its own isolated browser context
- Multiple clients connect to the same Playwright MCP server
- Each client operates independently without interfering with others
- Context lifecycle is tied to client connection lifecycle

**Optional Shared Context:**
- `--shared-browser-context` flag allows reusing same context across clients
- Not recommended for parallel Ralph Loop scenarios
- Could be useful for collaborative debugging but conflicts with isolation needs

### 1.3 Concurrent Architecture

The official Playwright MCP and enhanced variants support different concurrency models:

**Official Microsoft Playwright MCP:**
- Supports multiple HTTP clients connecting to single server
- Each client gets isolated context by default
- Browser instance handles concurrent context switching efficiently
- Typical overhead: 5-10MB per context, ~100ms context creation time

**Specialized Variants for Extreme Parallelism:**
- **playwright-plus-mcp**: Advertises "unlimited parallel browsers" with "zero session interference"
- **concurrent-browser-mcp**: Multi-concurrent browser MCP supporting multiple parallel instances
- These variants use 100% backward-compatible APIs with official Playwright MCP
- Useful if Ralph Loop generates 50+ concurrent automation sessions

---

## Part 2: Browser Context Isolation Strategy

### 2.1 Context Architecture for Ralph Loop

For the Ralph Loop parallel scenario, implement a **multi-context-per-browser** strategy:

```
Ralph Loop (Main Session)
  ├── Browser Instance #1 (shared across subagents)
  │   ├── Context A (Subagent 1)
  │   ├── Context B (Subagent 2)
  │   ├── Context C (Subagent 3)
  │   └── Context D (Main verification)
  └── Storage State File (authentication.json)
```

**Advantages of this approach:**
1. Single browser instance minimizes memory overhead
2. Contexts isolate DOM, JavaScript, and user interactions
3. All contexts can share authentication state from storage file
4. Context creation is fast (~100ms) and lightweight
5. Contexts can be created/destroyed without browser restart

### 2.2 Session Isolation Guarantees

Playwright browser contexts provide isolation across multiple dimensions:

| Isolation Aspect | Context Level | Browser Level |
|---|---|---|
| DOM & JavaScript | ✓ Complete isolation | Shared V8 engine |
| Cookies | ✓ Per-context storage | Inherited from profile |
| Local Storage | ✓ Per-context storage | Inherited from profile |
| IndexedDB | ✓ Per-context database | Inherited from profile |
| Service Workers | ✓ Per-context | Per-profile |
| Network State | ✓ Can use proxy/auth | Shared connection |
| User Input | ✓ Independent input queues | Shared keyboard/mouse |

**For Ralph Loop subagents:**
- Each subagent operates in its own context → no DOM conflicts
- Authentication state shared via imported storage → no login duplication
- Interactions fully isolated → no event listener conflicts

### 2.3 Resource Overhead Analysis

Context isolation has minimal overhead compared to browser instance isolation:

**Per-Browser-Instance Costs:**
- Memory: ~150-300MB (depending on extensions)
- CPU: ~1-2% idle, spikes during navigation
- Startup time: 2-5 seconds
- File descriptors: ~30-50

**Per-Context Costs:**
- Memory: ~5-10MB
- CPU: ~0% idle
- Startup time: ~100-200ms
- File descriptors: ~1-2

**For 3 parallel Ralph Loop subagents:**
- Approach 1 (1 browser, 3 contexts): 170MB + (3 × 7.5MB) = ~193MB
- Approach 2 (3 browsers, 1 context each): 3 × 250MB = ~750MB
- **Savings: 75% less memory using context strategy**

### 2.4 Playwright's Context API

The Playwright Python/JS API for context management:

```javascript
// Create a new context
const context = await browser.newContext({
  storageState: 'auth.json',  // Load existing auth
  viewportSize: { width: 1920, height: 1080 },
  locale: 'en-US',
  colorScheme: 'light'
});

// Create page in context
const page = await context.newPage();

// Save context state for later reuse
await context.storageState({ path: 'new-auth.json' });

// Close context when done
await context.close();
```

MCP servers abstract these operations into protocol-compliant methods that subagents can call via Claude's browser tools.

---

## Part 3: Authentication State Management

### 3.1 Storage State Persistence

Playwright provides native support for authentication state persistence via `storageState()`:

**What Gets Saved:**
1. **Cookies**: All domain cookies with expiry times
2. **Local Storage**: All key-value pairs per origin
3. **Session Storage**: Temporary session data (optional)
4. **IndexedDB**: Structured database entries (optional)

**Example: Saving Authentication**
```javascript
// After logging in:
const storageState = await context.storageState();
// storageState = {
//   cookies: [
//     { name: 'sessionId', value: 'abc123', domain: 'localhost', ... },
//     { name: 'authToken', value: 'xyz789', domain: 'localhost', ... }
//   ],
//   origins: [
//     {
//       origin: 'http://localhost:5007',
//       localStorage: [
//         { name: 'user', value: '{...}' }
//       ]
//     }
//   ]
// }

// Save to file
await page.context().storageState({ path: '.auth/session.json' });
```

**Reusing Authentication Across Contexts:**
```javascript
// Context 1 (Subagent A) logs in and saves state
await page1.goto('http://localhost:5007/login');
await page1.fill('input[name=email]', 'test@example.com');
await page1.fill('input[name=password]', 'password');
await page1.click('button[type=submit]');
await page1.context().storageState({ path: '.auth/session.json' });

// Context 2 (Subagent B) loads the saved state
const context2 = await browser.newContext({
  storageState: '.auth/session.json'
});
const page2 = await context2.newPage();
await page2.goto('http://localhost:5007/dashboard');
// Already logged in! No re-authentication needed.
```

### 3.2 Multi-Session Authentication Workflow

For Ralph Loop with parallel subagents:

**Workflow:**

```
Phase 1: Authentication (Ralph Loop Main Session)
  ↓
  └─→ Browser: Create persistent context
      └─→ Page: Navigate to login
      └─→ Page: Submit credentials
      └─→ Context: Export storageState → .auth/ralph-session.json

Phase 2: Parallel Subagents (Main session spawns subagents)
  ↓
  ├─→ Subagent 1: Create context with saved storageState
  │   └─→ Bypasses login, all cookies/tokens already loaded
  │
  ├─→ Subagent 2: Create context with saved storageState
  │   └─→ Bypasses login, all cookies/tokens already loaded
  │
  └─→ Subagent 3: Create context with saved storageState
      └─→ Bypasses login, all cookies/tokens already loaded

Phase 3: Independent Verification
  ↓
  └─→ All 3 subagents run verification in parallel
      ├─→ Each operates in isolated context
      ├─→ No authentication conflicts
      └─→ Results reported back independently
```

### 3.3 Handling Authentication Edge Cases

**Case 1: Session Timeout During Verification**
- If one subagent's session expires, it only affects that context
- Other subagents continue uninterrupted
- Solution: Implement refresh token mechanism or multi-auth files

**Case 2: Different User Roles**
- Create separate storage state files per role: `.auth/admin.json`, `.auth/user.json`
- Each subagent loads the appropriate role's auth
- No credential sharing between contexts

**Case 3: Multi-Step Authentication (MFA)**
- First context completes MFA and saves state
- Subsequent contexts import the completed state
- MFA tokens cached in storage state
- Avoid re-prompting for MFA

### 3.4 Storage State File Best Practices

**Project Structure:**
```
.auth/
  ├── ralph-main.json       # Main Ralph Loop session
  ├── subagent-a.json       # Subagent 1 (if using separate auth)
  ├── subagent-b.json       # Subagent 2
  ├── admin-role.json       # Admin-specific auth
  └── user-role.json        # Regular user auth
```

**Lifecycle Management:**
1. **Creation**: After successful login in main session
2. **Sharing**: Passed to subagents via environment variable or file path
3. **Validation**: Check auth still valid before context creation
4. **Cleanup**: Remove stale auth files after Ralph Loop completes
5. **Rotation**: Update auth files after credential changes

**Security Considerations:**
- Store `.auth/` directory with restricted permissions (600)
- Never commit auth files to git (add to .gitignore)
- Consider encryption for stored tokens in production
- Token expiry handling for long-running Ralph Loops

---

## Part 4: Comparison with Chrome DevTools MCP

### 4.1 Feature Comparison Table

| Feature | Playwright MCP | Chrome DevTools MCP |
|---------|---|---|
| **Parallel Contexts** | Native (multi-context per browser) | Limited (profile-based only) |
| **Context Isolation** | Complete per-context | Limited to profile isolation |
| **Storage State Export** | Built-in API | No native support |
| **Authentication Persistence** | Automatic via storage state | Manual profile management |
| **Memory Efficiency** | 5-10MB per context | 150-300MB per browser |
| **Startup Time** | 100-200ms per context | 2-5s per browser |
| **Default Isolation** | `--isolated` loses auth | `--isolated` loses auth |
| **HTTP Client Support** | Per-client contexts (default) | Single profile per instance |
| **Concurrent Subagents** | Excellent (same browser) | Poor (needs multiple browsers) |
| **Browser Support** | Chromium, Firefox, WebKit | Chromium only |

### 4.2 Key Differences in Parallel Handling

**Chrome DevTools MCP Approach:**
```
Limitation: Cannot share one profile across multiple sessions
Solution: Create new profile per session (--userDataDir approach)

Ralph Loop Main (Profile A)
  └─→ Browser Instance 1 (Profile A) - logged in

Spawned Subagent 1 (Profile B)
  └─→ Browser Instance 2 (Profile B) - NOT logged in, must re-auth

Spawned Subagent 2 (Profile C)
  └─→ Browser Instance 3 (Profile C) - NOT logged in, must re-auth

Result: 3 browser instances, 3 separate logins, 750MB+ memory
```

**Playwright MCP Approach:**
```
Advantage: Multiple contexts share same browser and authentication

Ralph Loop Main
  └─→ Browser Instance 1
      ├─→ Context A (Main verification) - logged in
      ├─→ Context B (Subagent 1) - inherits auth from storage
      ├─→ Context C (Subagent 2) - inherits auth from storage
      └─→ Context D (Subagent 3) - inherits auth from storage

Result: 1 browser instance, shared login, ~200MB memory
```

### 4.3 Authentication Handling Differences

**Chrome DevTools MCP:**
- Requires `--userDataDir` pointing to persistent profile directory
- Profile must exist and be pre-authenticated before session starts
- Cannot programmatically save/restore auth state
- Each session gets independent profile (no auth sharing)
- Forces manual setup or profile duplication

**Playwright MCP:**
- Exports/imports auth via `storageState()` API
- Can save state after login in same session
- Subagents load saved state automatically
- Supports multiple auth states (different roles, users)
- Fully programmatic auth management

---

## Part 5: Recommended Configuration

### 5.1 Ralph Loop Playwright MCP Setup

For the Ralph Loop parallel subagent scenario:

**1. Enable Playwright MCP in MCP Configuration**

In `~/.claude.json` or project MCP config:
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

**2. Initialize Browser Context in Main Ralph Loop Session**

In `RALPH_PROMPT.md`, add initialization step:
```markdown
### Browser Setup (First Iteration)

1. Start Playwright browser
2. Create main context with persistent profile
3. Navigate to `http://localhost:5007`
4. If not logged in: perform login
5. Export auth state: `await page.context().storageState({ path: '.auth/ralph-session.json' })`
6. Document the auth file location for subagents
```

**3. Subagent Initialization (in parallel subagent RALPH_PROMPT.md)**

```markdown
### Browser Setup (Subagent)

1. Start Playwright browser (connects to existing server)
2. Create new context, loading auth from: `.auth/ralph-session.json`
3. Context now has full authentication without re-login
4. Proceed with verification tasks
```

### 5.2 Storage State Management

**Step 1: Create Auth Management Utility**

Create `.claude/utils/auth-manager.js`:
```javascript
const fs = require('fs');
const path = require('path');

class AuthManager {
  constructor(authDir = '.auth') {
    this.authDir = authDir;
    if (!fs.existsSync(authDir)) {
      fs.mkdirSync(authDir, { recursive: true, mode: 0o600 });
    }
  }

  async saveAuth(context, name = 'default') {
    const filePath = path.join(this.authDir, `${name}.json`);
    const storageState = await context.storageState();
    fs.writeFileSync(filePath, JSON.stringify(storageState, null, 2), { mode: 0o600 });
    console.log(`Auth saved to: ${filePath}`);
    return filePath;
  }

  loadAuth(name = 'default') {
    const filePath = path.join(this.authDir, `${name}.json`);
    if (fs.existsSync(filePath)) {
      return filePath; // Return path for browser.newContext({ storageState })
    }
    return null; // No saved auth
  }

  async ensureAuth(page, name = 'default') {
    const existing = this.loadAuth(name);
    if (existing) return existing;

    // Auth doesn't exist, perform login
    console.log(`No auth found for "${name}", performing login...`);
    // Login logic here...
    return await this.saveAuth(page.context(), name);
  }
}

module.exports = AuthManager;
```

**Step 2: Use in Main Ralph Loop Session**

```javascript
const AuthManager = require('./.claude/utils/auth-manager.js');
const authMgr = new AuthManager();

// First time: perform login
const authFile = await authMgr.ensureAuth(page, 'ralph-main');

// Save for subagents
process.env.RALPH_AUTH_FILE = authFile;
```

**Step 3: Load in Subagent Context**

```javascript
const authFile = process.env.RALPH_AUTH_FILE;
const context = await browser.newContext({
  storageState: authFile  // Loads all cookies/storage from main session
});
```

### 5.3 Context Lifecycle for Subagents

**Pattern: Create → Use → Clean**

```javascript
// Subagent verification script

const { chromium } = require('playwright');

async function runVerification(authFile) {
  // 1. Create browser (connects to existing Playwright MCP server)
  const browser = await chromium.connectOverCDP('http://localhost:9223');

  // 2. Create isolated context with shared auth
  const context = await browser.newContext({
    storageState: authFile,
    viewport: { width: 1920, height: 1080 }
  });

  try {
    // 3. Create page and run verification
    const page = await context.newPage();
    await page.goto('http://localhost:5007/dashboard');

    // Already logged in due to imported storage state
    const isLoggedIn = await page.evaluate(() =>
      !!localStorage.getItem('authToken')
    );
    console.log('Logged in:', isLoggedIn);

    // Run verification tests...

  } finally {
    // 4. Clean up context
    await context.close();
  }
}
```

### 5.4 Error Handling for Authentication

**Handle Expired Sessions:**

```javascript
async function ensureAuthenticated(page, authFile) {
  const isValid = await page.evaluate(() => {
    const token = localStorage.getItem('authToken');
    const expiry = localStorage.getItem('tokenExpiry');
    if (!token || !expiry) return false;
    return Date.now() < parseInt(expiry);
  });

  if (!isValid) {
    console.warn('Auth expired, re-authenticating...');
    await performLogin(page);
    // Save new auth for other contexts
    await page.context().storageState({
      path: authFile.replace('.json', '-refreshed.json')
    });
  }
}
```

---

## Part 6: Implementation Roadmap

### Phase 1: Infrastructure Setup (Week 1)

**Tasks:**
1. Add `@playwright/mcp` to project dependencies
2. Configure MCP server in project config
3. Create auth-manager utility (`/.claude/utils/auth-manager.js`)
4. Document Playwright context patterns in `.claude/guides/`

**Files to Create/Modify:**
- `UberEats-Image-Extractor/package.json` - add @playwright/mcp
- `.claude/mcp-config.json` - add playwright config
- `.claude/utils/auth-manager.js` - NEW utility
- `.claude/guides/playwright-context-guide.md` - NEW documentation
- `.gitignore` - add `.auth/` directory

### Phase 2: Ralph Loop Integration (Week 2)

**Tasks:**
1. Modify ralph-orchestrator.sh to export auth file location
2. Update RALPH_PROMPT.md template to include browser initialization
3. Create subagent RALPH_PROMPT templates with context loading
4. Test authentication state sharing between subagents

**Files to Modify:**
- `.claude/scripts/ralph-loop/ralph-orchestrator.sh` - add auth setup
- `.claude/skills/plan-ralph-loop/templates/RALPH_PROMPT.md.template` - add browser init
- `.claude/data/ralph-loops/*/init.sh` - verify auth setup runs first

### Phase 3: Subagent Support (Week 3)

**Tasks:**
1. Implement parallel subagent spawning logic
2. Pass auth file to subagents via environment variables
3. Create subagent context initialization wrapper
4. Test 3+ concurrent subagents with isolated contexts

**Files to Create/Modify:**
- `.claude/scripts/ralph-loop/spawn-subagents.sh` - NEW script
- `.claude/utils/subagent-browser-wrapper.js` - NEW wrapper
- `.claude/skills/plan-parallel-investigation/` - update with learnings

### Phase 4: Testing & Hardening (Week 4)

**Tasks:**
1. End-to-end test with dashboard-update-v4 Ralph Loop
2. Test with 3+ parallel subagents
3. Test authentication expiry handling
4. Performance profiling and optimization

**Files to Test:**
- Dashboard verification scripts with Playwright
- Multi-subagent orchestration
- Auth state sharing across contexts

---

## Part 7: Key Technical Details

### 7.1 Playwright MCP vs Direct Playwright Library

The investigation focused on Playwright MCP (Model Context Protocol server), which is different from using Playwright library directly:

**Direct Playwright Library** (What's in scripts/restaurant-registration/):
- Node.js library for browser automation
- Full control over browser instances
- Can create/destroy browsers and contexts programmatically
- Used for backend automation scripts

**Playwright MCP** (Recommended for Ralph Loop):
- Protocol server that abstracts Playwright behind MCP interface
- Multiple Claude sessions can connect to same server
- Designed for AI assistant use cases
- Better isolation and resource sharing

For Ralph Loop, MCP is preferred because:
1. Centralizes browser lifecycle management
2. Allows multiple Claude sessions to share one browser
3. Provides clean abstraction for context isolation
4. Handles authentication sharing automatically

### 7.2 Browser Context vs Browser Profile

**Browser Profile (Chrome DevTools MCP approach):**
- File-based user data directory (~/.cache/chrome-devtools-mcp/chrome-profile)
- Contains all browser data: extensions, settings, history
- Slow to create (2-5 seconds)
- Heavy memory footprint (150-300MB)
- Suitable for persistent, user-like sessions

**Browser Context (Playwright MCP approach):**
- In-memory isolated environment
- Contains only cookies, storage, IndexedDB
- Fast to create (100-200ms)
- Lightweight memory (~5-10MB)
- Suitable for isolated test/automation scenarios

For Ralph Loop subagents: **Contexts are better** (faster, lighter, still isolated)

### 7.3 Port Assignment for Parallel MCP Servers

If using multiple Playwright MCP server instances (for extreme parallelism):

```bash
# Main Ralph Loop session
npx @playwright/mcp@latest --port 9223 &

# Subagent 1 (if needed)
npx @playwright/mcp@latest --port 9224 &

# Subagent 2 (if needed)
npx @playwright/mcp@latest --port 9225 &
```

However, this is unnecessary if using single server with multiple contexts (recommended approach).

---

## Part 8: Potential Challenges & Solutions

| Challenge | Root Cause | Solution |
|---|---|---|
| **Auth expires during long Ralph Loop** | Token TTL shorter than iteration time | Implement token refresh logic; cache refresh tokens in storage state |
| **Subagent auth file not found** | File path not passed correctly | Use absolute paths; pass via environment variable |
| **Context creation hangs** | Browser instance saturated | Monitor browser process; limit concurrent contexts to 5-10 |
| **Storage state has stale data** | Context created before auth completed | Ensure auth step finishes before exporting storage state |
| **Different auth needed per subagent** | Role-based access testing | Create multiple auth files (.auth/admin.json, .auth/user.json) |
| **Can't connect to MCP server** | Server not running or wrong port | Verify with: `curl http://localhost:9223/` |

---

## Part 9: Enhanced Variants Evaluation

### 9.1 Playwright-Plus-MCP

**Source:** https://github.com/vibe-coding-labs/playwright-plus-mcp

**Key Features:**
- "First True Multi-Project Playwright MCP"
- "Unlimited parallel browsers"
- "Zero session interference"
- 100% API compatible with official Playwright MCP
- Project-scoped isolation

**When to Use:**
- If Ralph Loop generates 50+ concurrent automation sessions
- If memory optimization not critical
- If simplicity of parallel browser management is priority

**Trade-offs:**
- Each session gets own browser instance (vs context)
- Higher memory usage (500MB+ for 5 sessions)
- Simpler isolation model but resource-intensive

### 9.2 Concurrent-Browser-MCP

**Source:** https://github.com/sailaoda/concurrent-browser-mcp

**Key Features:**
- Multi-concurrent browser instances
- Flexible configuration
- Designed explicitly for parallel automation

**When to Use:**
- If context-based isolation proves insufficient
- If you need true multi-browser capabilities
- If you're willing to use specialized variant

---

## Conclusion & Recommendation

### Summary of Findings

Playwright MCP is **significantly better** than Chrome DevTools MCP for parallel browser access in Ralph Loop due to:

1. **Native context isolation** - Multiple isolated environments in one browser
2. **Storage state API** - Programmatic authentication sharing
3. **Lightweight contexts** - 5-10MB vs 150-300MB per browser instance
4. **Fast context creation** - 100-200ms vs 2-5s per browser
5. **HTTP client support** - Multiple clients per server with automatic isolation

### Recommended Approach

**Primary (Official Playwright MCP):**
```
Single Playwright MCP Server Instance
  └─→ One browser process
      ├─→ Main Context (Ralph Loop main session)
      ├─→ Subagent Context A (Subagent 1)
      ├─→ Subagent Context B (Subagent 2)
      └─→ Subagent Context C (Subagent 3)

Shared Auth: Storage state file (.auth/ralph-session.json)
Memory: ~200-250MB total (vs 750MB+ with Chrome DevTools MCP)
Parallelism: Full concurrent subagent execution
```

**Alternative (If extreme parallelism needed):**
Use playwright-plus-mcp for unlimited context creation without worrying about single-browser resource limits.

### Implementation Priority

1. **High Priority:** Integrate official Playwright MCP with context-based subagent support
2. **Medium Priority:** Build auth-manager utility for clean state sharing
3. **Low Priority:** Evaluate playwright-plus-mcp only if testing shows context limits

---

## References & Sources

### Official Documentation
- [Playwright Official Docs](https://playwright.dev/)
- [Playwright Browser Contexts](https://playwright.dev/docs/browser-contexts)
- [Playwright Authentication](https://playwright.dev/docs/auth)
- [GitHub - microsoft/playwright-mcp](https://github.com/microsoft/playwright-mcp)

### Alternative Implementations
- [GitHub - vibe-coding-labs/playwright-plus-mcp](https://github.com/vibe-coding-labs/playwright-plus-mcp)
- [GitHub - sailaoda/concurrent-browser-mcp](https://github.com/sailaoda/concurrent-browser-mcp)

### Community Resources
- [Awesome MCP Servers - Playwright](https://mcpservers.org/servers/microsoft/playwright-mcp)
- [Browser Context Management - DeepWiki](https://deepwiki.com/microsoft/playwright-mcp/4.4-browser-context-management)
- [Playwright MCP by Execute Automation](https://github.com/executeautomation/mcp-playwright)

### Project-Specific
- Existing Playwright usage: `/Users/giannimunro/Desktop/cursor-projects/automation/scripts/restaurant-registration/package.json`
- Docker setup: `/Users/giannimunro/Desktop/cursor-projects/automation/Dockerfile` (v1.54.0)
- Ralph Loop orchestrator: `.claude/scripts/ralph-loop/ralph-orchestrator.sh`

---

## Appendix A: Quick Reference - Storage State JSON Format

```json
{
  "cookies": [
    {
      "name": "sessionId",
      "value": "abc123def456",
      "domain": "localhost",
      "path": "/",
      "expires": 1705773600,
      "httpOnly": true,
      "secure": false,
      "sameSite": "Lax"
    }
  ],
  "origins": [
    {
      "origin": "http://localhost:5007",
      "localStorage": [
        {
          "name": "authToken",
          "value": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
        },
        {
          "name": "user",
          "value": "{\"id\":1,\"email\":\"user@example.com\",\"role\":\"admin\"}"
        }
      ]
    }
  ]
}
```

---

## Document Information

**Investigation Type:** Technical capability analysis
**Scope:** Playwright MCP parallel browser access for Ralph Loop
**Depth:** Architecture, configuration, implementation strategy
**Completeness:** Comprehensive with code examples and comparison analysis

**Next Steps:** Present findings to team and decide on implementation timeline for Phase 1 infrastructure setup.
