# Code Injection Script Execution Issues

## Date: 2025-12-12

## Overview

This document describes the issues discovered when running the `ordering-page-customization.js` script on Railway (production) and the solutions implemented to fix them while maintaining development functionality.

---

## Problem Summary

The "Generate Code Injections" feature was failing on Railway with a timeout error, despite working locally. Multiple issues were discovered during investigation.

---

## Issue 1: CSV Upload - Wrong Content-Type Header

### Symptom
```json
{
    "csvFile": {},
    "restaurantId": "078540c8-8a8c-489e-82ab-8a401b0d0f97"
}
{
    "success": false,
    "error": "CSV file is required"
}
```

The CSV file was being sent as an empty object `{}` instead of actual file data.

### Root Cause
In `UberEats-Image-Extractor/src/services/api.js`, the `railwayApi` axios instance had a hardcoded default header:

```javascript
const railwayApi = axios.create({
  baseURL: import.meta.env.VITE_RAILWAY_API_URL || 'http://localhost:3007',
  timeout: 300000,
  headers: {
    'Content-Type': 'application/json',  // <-- PROBLEM
  },
});
```

When sending FormData (file uploads), axios needs to automatically set `Content-Type: multipart/form-data` with the proper boundary. The hardcoded `application/json` header overrode this, causing:
1. The File object to be serialized as JSON (becoming `{}`)
2. The server's multer middleware to not receive a proper multipart request
3. `req.file` being undefined on the server

### Solution
Commented out the default Content-Type header to let axios auto-detect based on body type:

```javascript
const railwayApi = axios.create({
  baseURL: import.meta.env.VITE_RAILWAY_API_URL || 'http://localhost:3007',
  timeout: 300000,
  // headers: {
  //   'Content-Type': 'application/json',
  // }, // Commented out to avoid errors passing csv files to the railway api
});
```

---

## Issue 2: Script Timeout Due to Detached Mode

### Symptom
```
[Code Generation] Error: Script timed out waiting for completion. The script may still be running in the background.
```

### Root Cause
The code injection generation route in `registration-routes.js` was using `spawn` with `detached: true`:

```javascript
const child = spawn('node', args, {
  detached: true,
  stdio: 'ignore',
  env: { ...process.env }
});
child.unref();
```

This approach:
1. Spawned the script in detached mode (background process)
2. Set `stdio: 'ignore'` - completely hiding any script errors
3. Polled for a `completion.json` file with a 60-second timeout

The problem was compounded by the `--keep-browser-open` flag being always passed, which causes the script to run indefinitely (line 441-445 of `ordering-page-customization.js` creates an infinite promise).

### Why Other Scripts Work
Other registration scripts (like restaurant registration) use `execAsync`:
```javascript
const { stdout, stderr } = await execAsync(command, {
  env: { ...process.env, DEBUG_MODE: 'false' },
  timeout: 180000 // 3 minute timeout
});
```

This pattern:
- Waits for script completion
- Captures stdout/stderr for debugging
- Has proper timeout handling
- Returns errors if the script fails

### Initial Solution (Production Only)
Changed to use `execAsync` like other scripts:

```javascript
const { stdout, stderr } = await execAsync(command, {
  env: { ...process.env, DEBUG_MODE: 'false' },
  timeout: 120000 // 2 minute timeout
});
```

Removed the `--keep-browser-open` flag entirely and removed unused `spawn` import.

---

## Issue 3: Missing Dependencies on Railway

### Symptom
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'dotenv' imported from /app/scripts/ordering-page-customization.js
```

### Root Cause
The Dockerfile only installed dependencies for:
1. `/app/UberEats-Image-Extractor/`
2. `/app/scripts/restaurant-registration/`

But NOT for `/app/scripts/` where `ordering-page-customization.js` lives and imports `dotenv`.

### Solution
Updated `Dockerfile` to include `/scripts/package.json` dependencies:

```dockerfile
# Copy package files first (for Docker layer caching)
COPY UberEats-Image-Extractor/package*.json ./UberEats-Image-Extractor/
COPY scripts/package*.json ./scripts/
COPY scripts/restaurant-registration/package*.json ./scripts/restaurant-registration/

# Install UberEats-Image-Extractor dependencies
WORKDIR /app/UberEats-Image-Extractor
RUN npm ci --omit=dev --legacy-peer-deps

# Install scripts dependencies (for dotenv, sharp, etc.)
WORKDIR /app/scripts
RUN npm ci --omit=dev --legacy-peer-deps

# Install restaurant-registration scripts dependencies
WORKDIR /app/scripts/restaurant-registration
RUN npm ci --omit=dev --legacy-peer-deps
```

---

## Current State

After the above fixes, the code injection generation works on Railway (production). However, **the development experience is degraded** because:

1. The `--keep-browser-open` flag is no longer passed
2. The script uses `execAsync` which blocks until completion
3. In development, we want the browser to stay open for manual adjustments

---

## Plan: Environment-Based Execution Mode

### Goal
Support both modes simultaneously:
- **Production (Railway):** Use `execAsync` - fast, reliable, captures errors
- **Development (Local):** Use `spawn` with detached mode - allows browser to stay open

### Implementation Approach (Option 1)

Branch the execution logic based on `NODE_ENV`:

```javascript
const isProduction = process.env.NODE_ENV === 'production';

if (isProduction) {
  // Production: Use execAsync - waits for completion, captures output
  console.log('[Code Generation] Executing script (production mode)...');

  const { stdout, stderr } = await execAsync(command, {
    env: { ...process.env, DEBUG_MODE: 'false' },
    timeout: 120000
  });

  if (stdout) console.log('[Code Generation] Output:', stdout);
  if (stderr) console.error('[Code Generation] Stderr:', stderr);

  // Verify completion file
  // ... existing verification code ...

} else {
  // Development: Use spawn detached - allows browser to stay open
  console.log('[Code Generation] Spawning script (development mode)...');

  // Add --keep-browser-open flag for dev
  args.push('--keep-browser-open');

  const child = spawn('node', args, {
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env }
  });

  // Log output for debugging
  child.stdout.on('data', (data) => {
    console.log('[Code Generation Script]', data.toString().trim());
  });
  child.stderr.on('data', (data) => {
    console.error('[Code Generation Script Error]', data.toString().trim());
  });

  child.unref();

  // Poll for completion.json
  // ... existing polling code ...
}
```

### Benefits of This Approach

1. **Production reliability:** `execAsync` properly captures errors and has clear timeout behavior
2. **Development flexibility:** Browser stays open for manual tweaks and inspection
3. **Clear separation:** Each mode is optimized for its use case
4. **Debugging:** Both modes now capture script output (previously dev mode used `stdio: 'ignore'`)

### Files to Modify

1. `UberEats-Image-Extractor/src/routes/registration-routes.js`
   - Re-add `spawn` import
   - Implement environment-based branching in `/generate-code-injections` route

---

## File Locations Reference

| File | Purpose |
|------|---------|
| `scripts/ordering-page-customization.js` | The Playwright script that generates code injections |
| `scripts/lib/browser-config.mjs` | Shared browser configuration (headless detection) |
| `UberEats-Image-Extractor/src/routes/registration-routes.js` | API route that executes the script |
| `UberEats-Image-Extractor/src/services/api.js` | Frontend API client (railwayApi) |
| `Dockerfile` | Docker build configuration for Railway |
| `scripts/package.json` | Dependencies for scripts directory (dotenv, sharp) |

---

## Environment Variables

| Variable | Production Value | Purpose |
|----------|-----------------|---------|
| `NODE_ENV` | `production` | Determines execution mode |
| `HEADLESS` | `true` | Forces headless browser in Docker |
| `DEBUG_MODE` | `false` | Disables debug logging |

---

## Testing Checklist

### Production (Railway)
- [ ] Code injection generation completes successfully
- [ ] Script errors are captured and returned in response
- [ ] Timeout errors are handled gracefully
- [ ] Generated files are accessible for configure-website step

### Development (Local)
- [ ] Browser opens visibly (not headless)
- [ ] Browser stays open after script generates files
- [ ] API returns success while browser is still open
- [ ] Generated files are created in `generated-code/<restaurant>/`
