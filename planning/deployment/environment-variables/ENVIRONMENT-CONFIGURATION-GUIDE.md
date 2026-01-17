# Environment Configuration Guide

This document explains how to configure the application for different environments.

## Quick Reference

| Setting | Local Development | Railway (Production) | Netlify (Frontend) |
|---------|-------------------|---------------------|-------------------|
| `NODE_ENV` | `development` | `production` | `production` |
| `HEADLESS` | `false` | `true` | N/A |
| `DEBUG_MODE` | `true` | `false` | N/A |

## Local Development

### Centralized .env File
All environment variables are stored in: `UberEats-Image-Extractor/.env`

### Key Settings for Local Development

```env
# Server Configuration
NODE_ENV=development          # IMPORTANT: Must be 'development' for visible browser

# Browser Settings
HEADLESS=false               # Show browser window (only works when NODE_ENV=development)
DEBUG_MODE=true              # Enable detailed logging
```

### Browser Visibility Logic

The browser visibility is determined by this logic in `scripts/lib/browser-config.cjs`:

```javascript
const headless = IS_PRODUCTION || FORCE_HEADLESS;
```

| NODE_ENV | HEADLESS | Browser Mode |
|----------|----------|--------------|
| `production` | any | Always headless |
| `development` | `true` | Headless |
| `development` | `false` | **Visible** |

**Important**: If `NODE_ENV=production`, the browser is ALWAYS headless regardless of the `HEADLESS` setting.

## Railway (Production Backend)

### Environment Variables to Set

These are set in the Railway dashboard or via `railway.json`:

| Variable | Value | Notes |
|----------|-------|-------|
| `NODE_ENV` | `production` | Always production on Railway |
| `HEADLESS` | `true` | Set in Dockerfile, but can override |
| `DEBUG_MODE` | `false` | Reduce logging noise |
| `ADMIN_PASSWORD` | `<your-password>` | Required for Playwright scripts |
| `PORT` | (auto-assigned) | Railway sets this automatically |

### Dockerfile Defaults

The Dockerfile sets these defaults:
```dockerfile
ENV NODE_ENV=production
ENV HEADLESS=true
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
```

### Required Environment Variables for Railway

Copy all variables from `UberEats-Image-Extractor/.env` to Railway, EXCEPT:
- `NODE_ENV` (keep as `production`)
- `HEADLESS` (keep as `true`)
- `DEBUG_MODE` (set to `false`)

## Netlify (Frontend Only)

Netlify only builds the frontend - no Playwright scripts run there.

### Key Variables for Netlify

| Variable | Value | Notes |
|----------|-------|-------|
| `NODE_VERSION` | `20` | Set in netlify.toml |
| `NPM_FLAGS` | `--legacy-peer-deps` | For React 19 compatibility |
| `VITE_SUPABASE_URL` | `<your-url>` | Frontend Supabase connection |
| `VITE_SUPABASE_ANON_KEY` | `<your-key>` | Frontend Supabase auth |

### Variables NOT Needed on Netlify

These are server-side only:
- `HEADLESS`
- `DEBUG_MODE`
- `ADMIN_PASSWORD`
- `SUPABASE_SERVICE_ROLE_KEY`
- `REMOVE_BG_API_KEY`
- `FIRECRAWL_API_KEY`

## Environment Variable Sources

### Scripts Loading Pattern

All scripts load from the centralized `.env` file:

```javascript
require('dotenv').config({ path: path.join(__dirname, '../../UberEats-Image-Extractor/.env') });
```

### Browser Config Runtime Evaluation

Environment variables are read at **runtime** (when functions are called), not at module load time. This ensures `dotenv.config()` has loaded the `.env` file before values are checked.

```javascript
// Helper functions read env vars at runtime
function isProduction() {
  return process.env.NODE_ENV === 'production';
}

function isHeadless() {
  return process.env.HEADLESS === 'true';
}
```

## Switching Between Development and Production

### For Local Development (Visible Browser)

In `UberEats-Image-Extractor/.env`:
```env
NODE_ENV=development
HEADLESS=false
DEBUG_MODE=true
```

### For Local Testing of Production Mode

In `UberEats-Image-Extractor/.env`:
```env
NODE_ENV=production
HEADLESS=true
DEBUG_MODE=false
```

### Temporary Override (Without Editing .env)

Run a script with inline environment variables:
```bash
NODE_ENV=development HEADLESS=false node scripts/restaurant-registration/import-csv-menu.js ...
```

## Troubleshooting

### Browser Not Visible Locally

1. Check `NODE_ENV` is `development` (not `production`)
2. Check `HEADLESS` is `false`
3. Restart the development server after changing `.env`

### Scripts Failing on Railway

1. Verify all required env vars are set in Railway dashboard
2. Check `ADMIN_PASSWORD` is set
3. Review Railway logs for specific errors

### Netlify Build Failing

1. Check `NPM_FLAGS` environment variable is set to `--legacy-peer-deps`
2. Verify `NODE_VERSION` is `20` in netlify.toml
3. Check for ESM/CommonJS issues (see DUAL-BUILD-ISSUES-2025-12-09.md)
