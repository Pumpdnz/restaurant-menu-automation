# Server Restart Solution for Ralph Loop

**Created:** 2026-01-19
**Status:** Implemented and tested
**Related:** Phase 2 E2E testing improvements

## Issue Identified

During Ralph Loop E2E testing, spawned sessions that modify backend code cannot verify their changes because the server doesn't restart automatically.

### Problem Statement

When a Ralph Loop iteration modifies files in:
- `server.js`
- `middleware/`
- `src/services/`
- `src/routes/`
- `src/utils/`

The running server continues using the old code. Sessions cannot manually restart the server, so backend features appear broken during verification.

### Evidence

Sessions would:
1. Implement a backend feature (e.g., new API endpoint)
2. Attempt to verify via API call or browser
3. Get old behavior or 404 errors
4. Incorrectly mark feature as failing or assume code is wrong

## Solution

Use **nodemon** for automatic server restarts during development.

### Changes Made

#### 1. `UberEats-Image-Extractor/package.json`

```diff
- "start-server": "node server.js",
+ "start-server": "nodemon server.js",
```

#### 2. `UberEats-Image-Extractor/nodemon.json` (new file)

```json
{
  "watch": [
    "server.js",
    "middleware/",
    "src/services/",
    "src/routes/",
    "src/utils/"
  ],
  "ext": "js,json,ts",
  "ignore": [
    "node_modules/",
    "src/components/",
    "src/pages/",
    "src/hooks/",
    "src/context/",
    "src/stores/",
    "*.test.js"
  ],
  "delay": "1000",
  "verbose": true
}
```

### Why These Directories?

| Directory | Reason to Watch | Reason to Ignore |
|-----------|-----------------|------------------|
| `server.js` | Main server entry | - |
| `middleware/` | Auth, request processing | - |
| `src/services/` | Database, API services | - |
| `src/routes/` | Express route handlers | - |
| `src/utils/` | Server-side utilities | - |
| `src/components/` | - | React components (frontend) |
| `src/pages/` | - | React pages (frontend) |
| `src/hooks/` | - | React hooks (frontend) |
| `src/stores/` | - | Zustand stores (frontend) |

### Production Safety

Railway deployment is unaffected. `railway.json` specifies:

```json
{
  "deploy": {
    "startCommand": "node server.js"
  }
}
```

Railway runs `node server.js` directly, bypassing npm scripts. Nodemon is a devDependency and isn't installed in production.

## Verification

Tested by:
1. Running `npm start`
2. Modifying `server.js` with a test comment
3. Observing nodemon restart in terminal output

## Integration with Ralph Loop

Ralph Loop iterations can now:
1. Implement backend changes
2. Wait ~1-2 seconds for nodemon restart
3. Verify changes via Chrome DevTools MCP or API calls
4. Correctly assess feature status

### Consideration for RALPH_PROMPT.md

For features that modify backend code, sessions should be aware that:
- Server auto-restarts after file changes
- A brief delay (~1-2 seconds) may be needed before verification
- No manual restart action is required

## Related Files

- Full documentation: `planning/deployment/server-reloads-for-automated-development/SERVER_AUTO_RESTART.md`
- Browser verification solution: `BROWSER_VERIFICATION_SOLUTION.md` (same directory)
