# ESM to CommonJS Conversion Plan

**Date:** 2025-12-08
**Status:** Pending
**Blocker:** Railway deployment fails due to ESM/CommonJS mismatch

---

## Problem

The server fails to start in Railway with this error:

```
/app/UberEats-Image-Extractor/src/services/firecrawl-service.js:12
import {
^^^^^^
SyntaxError: Cannot use import statement outside a module
```

**Root Cause:** `firecrawl-service.js` uses ESM syntax (`import`/`export`) but the project runs as CommonJS (no `"type": "module"` in package.json).

**Why it works locally:** Unknown - possibly a different Node.js version, Vite dev server handling, or other tooling that transpiles ESM to CommonJS.

---

## Investigation Needed

Before converting, investigate these questions:

1. **Why does it work locally?**
   - Check if there's any transpilation happening (babel, ts-node, etc.)
   - Check Node.js version differences (local vs Railway Docker image)
   - Check if Vite is handling the imports somehow

2. **Which files are frontend-only vs backend?**
   - Files in `src/services/` and `src/utils/` may be used by both frontend (React) and backend (Express)
   - Frontend files can stay ESM (Vite handles them)
   - Backend files must be CommonJS (or project must use `"type": "module"`)

3. **Are there any circular dependencies?**
   - `firecrawl-service.js` imports from `image-extraction-helpers.js`
   - Need to map the full dependency graph

---

## Files Confirmed to Use ESM

Found via: `grep -l "^import \|^export " src/services/*.js src/utils/*.js`

### Backend Files (Required by server.js)

| File | Required By | Line in server.js |
|------|-------------|-------------------|
| `src/services/firecrawl-service.js` | server.js | Line 35 |
| `src/utils/platform-detector.js` | server.js | Line 78 |
| `src/utils/image-extraction-helpers.js` | server.js, firecrawl-service.js | Line 1203 |

### Possibly Frontend-Only Files (Need Investigation)

| File | Notes |
|------|-------|
| `src/services/api.js` | Likely frontend API client |
| `src/services/firecrawl-integration.js` | Likely frontend integration |
| `src/services/ubereats-service.js` | Likely frontend service |
| `src/utils/csv-generator.js` | May be used by both |
| `src/utils/ubereats-extractor.js` | May be used by both |

---

## Conversion Strategy

### Option A: Convert Backend Files to CommonJS (Recommended)

Convert only the 3 critical backend files to CommonJS. Frontend files stay ESM (Vite handles them).

**Pros:**
- Minimal changes
- No risk to frontend
- Clear separation

**Cons:**
- Some files may be shared (need to verify)

### Option B: Add `"type": "module"` to package.json

Make the entire project ESM.

**Pros:**
- Modern approach
- No file-by-file conversion

**Cons:**
- ALL CommonJS files must be converted to ESM
- server.js has ~50 `require()` statements
- All middleware, routes, services using `require()` must change
- Higher risk of breaking things

### Option C: Rename Backend Files to `.cjs`

Keep ESM files as-is, rename backend files to `.cjs` extension.

**Pros:**
- Explicit about module type
- No content changes needed for ESM files

**Cons:**
- All imports/requires must update paths
- Confusing mixed extensions

---

## Recommended Approach: Option A

Convert these 3 files from ESM to CommonJS:

### 1. `src/utils/image-extraction-helpers.js`

**Current (ESM):**
```javascript
export function generateImageFocusedPrompt() { ... }
export function generateImageOnlySchema() { ... }
export function mergeImageUpdates() { ... }
```

**After (CommonJS):**
```javascript
function generateImageFocusedPrompt() { ... }
function generateImageOnlySchema() { ... }
function mergeImageUpdates() { ... }

module.exports = {
  generateImageFocusedPrompt,
  generateImageOnlySchema,
  mergeImageUpdates
};
```

### 2. `src/services/firecrawl-service.js`

**Current (ESM):**
```javascript
import {
  generateImageFocusedPrompt,
  generateImageOnlySchema,
  mergeImageUpdates
} from '../utils/image-extraction-helpers.js';

export const DEFAULT_PROMPT = `...`;
export const DEFAULT_SCHEMA = { ... };
export function generateCategorySchema() { ... }
// ... many more exports
```

**After (CommonJS):**
```javascript
const {
  generateImageFocusedPrompt,
  generateImageOnlySchema,
  mergeImageUpdates
} = require('../utils/image-extraction-helpers');

const DEFAULT_PROMPT = `...`;
const DEFAULT_SCHEMA = { ... };
function generateCategorySchema() { ... }
// ... many more exports

module.exports = {
  DEFAULT_PROMPT,
  DEFAULT_SCHEMA,
  generateCategorySchema,
  // ... all other exports
};
```

### 3. `src/utils/platform-detector.js`

Need to read file to determine exact changes, but same pattern:
- Change `import` to `require()`
- Change `export` to `module.exports`

---

## Testing Plan

### After Each File Conversion

```bash
cd /Users/giannimunro/Desktop/cursor-projects/automation/UberEats-Image-Extractor

# Test individual file loads
node -e "const m = require('./src/utils/image-extraction-helpers'); console.log(Object.keys(m));"
node -e "const m = require('./src/services/firecrawl-service'); console.log(Object.keys(m));"
node -e "const m = require('./src/utils/platform-detector'); console.log(Object.keys(m));"
```

### Final Server Test

```bash
# Test server starts (timeout after 10 seconds is fine - we just need it to start)
timeout 10 node server.js 2>&1 | head -20

# Should see:
# [Server] Starting...
# [Database] Supabase client initialized successfully
# Server listening on port 3007
```

### Verify Frontend Still Works

```bash
npm run dev
# Open http://localhost:5173 and verify React app loads
```

---

## Files to Read Before Starting

1. `src/utils/image-extraction-helpers.js` - See all exports
2. `src/services/firecrawl-service.js` - Already read, ~1200 lines
3. `src/utils/platform-detector.js` - Need to read

---

## Checklist

- [ ] Read and understand `image-extraction-helpers.js`
- [ ] Read and understand `platform-detector.js`
- [ ] Convert `image-extraction-helpers.js` to CommonJS
- [ ] Test `image-extraction-helpers.js` loads
- [ ] Convert `firecrawl-service.js` to CommonJS
- [ ] Test `firecrawl-service.js` loads
- [ ] Convert `platform-detector.js` to CommonJS
- [ ] Test `platform-detector.js` loads
- [ ] Test server.js starts locally
- [ ] Test frontend still works with `npm run dev`
- [ ] Commit changes
- [ ] Deploy to Railway
- [ ] Verify Railway deployment succeeds

---

## Context for Next Session

### What Was Done This Session

1. Fixed `.gitignore` to not ignore `package-lock.json` (needed for `npm ci`)
2. Added `--legacy-peer-deps` to Dockerfile for React 19 compatibility
3. Added `package-lock.json` files to git tracking
4. Removed Docker HEALTHCHECK (Railway handles it via `railway.json`)
5. Build succeeded on Railway but server failed to start due to ESM error

### Railway Build That Succeeded

```
[ 6/13] RUN npm ci --omit=dev --legacy-peer-deps - 10s ✓
[ 7/13] WORKDIR /app/scripts/restaurant-registration - ✓
[ 8/13] RUN npm ci --omit=dev --legacy-peer-deps - 14s ✓
Build time: 115.56 seconds
```

### Current State

- Dockerfile: Working ✓
- railway.json: Working ✓
- netlify.toml: Ready (needs Railway URL after successful deploy)
- Server startup: Failing due to ESM/CommonJS mismatch

### Files Modified This Session

- `.gitignore` - Removed `package-lock.json` from ignore
- `Dockerfile` - Added `--legacy-peer-deps`, removed Docker HEALTHCHECK
- `UberEats-Image-Extractor/package.json` - Reverted (tried adding `"type": "module"` but reverted)
- `UberEats-Image-Extractor/server.js` - Reverted (tried ESM imports but reverted)

### Git Status

There may be uncommitted changes from the reverts. Check with:
```bash
git status
git diff
```
