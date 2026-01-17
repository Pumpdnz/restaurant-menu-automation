# Netlify + Railway Deployment Guide

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              PRODUCTION                                  │
│                                                                          │
│  ┌─────────────────────┐         ┌─────────────────────────────────┐   │
│  │      NETLIFY        │         │           RAILWAY               │   │
│  │    (Frontend)       │         │          (Backend)              │   │
│  │                     │         │                                 │   │
│  │  React App (Vite)   │  API    │  Express Server (port 3007)    │   │
│  │  Static Assets      │ ──────▶ │  WebSocket Server (port 5007)  │   │
│  │  CDN Distribution   │ calls   │  Playwright Scripts            │   │
│  │                     │         │  /scripts directory            │   │
│  │  FREE TIER          │         │  $5-20/month                   │   │
│  └─────────────────────┘         └─────────────────────────────────┘   │
│                                              │                          │
│                                              ▼                          │
│                                    ┌─────────────────┐                 │
│                                    │    Supabase     │                 │
│                                    │   (Database)    │                 │
│                                    └─────────────────┘                 │
└─────────────────────────────────────────────────────────────────────────┘
```

## Current Project Structure

```
/automation
├── UberEats-Image-Extractor/       # Main application
│   ├── src/                        # React frontend
│   │   ├── components/
│   │   ├── pages/
│   │   ├── routes/                 # API route handlers
│   │   └── services/
│   ├── server.js                   # Express backend
│   ├── package.json
│   ├── vite.config.ts
│   └── dist/                       # Built frontend (after npm run build)
│
├── scripts/                        # Playwright automation scripts
│   ├── restaurant-registration/
│   │   ├── login-and-register-restaurant.js
│   │   ├── import-csv-menu.js
│   │   ├── add-item-tags.js
│   │   ├── add-option-sets.js
│   │   └── package.json
│   ├── ordering-page-customization.js
│   ├── edit-website-settings-dark.js
│   ├── edit-website-settings-light.js
│   ├── setup-services-settings.js
│   ├── setup-stripe-payments.js
│   └── ...
│
└── extracted-menus/                # CSV files (need cloud storage)
```

---

## Phase 1: Prepare Codebase for Deployment

### 1.1 Modify Playwright Scripts for Headless Mode

All Playwright scripts need to run in headless mode in production. Create a helper or modify each script:

**Option A: Environment-based toggle (Recommended)**

Add to each Playwright script:

```javascript
// At the top of each script
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const HEADLESS = IS_PRODUCTION || process.env.HEADLESS === 'true';

// In the launch configuration
const browser = await chromium.launch({
  headless: HEADLESS,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',  // Important for Docker/containers
    '--disable-gpu',             // No GPU in cloud
    '--single-process',          // Reduces memory usage
  ],
  // Remove slowMo in production for speed
  ...(IS_PRODUCTION ? {} : { slowMo: 100 })
});
```

**Scripts to modify:**
- [ ] `scripts/restaurant-registration/login-and-register-restaurant.js`
- [ ] `scripts/restaurant-registration/register-restaurant-production.js`
- [ ] `scripts/restaurant-registration/import-csv-menu.js`
- [ ] `scripts/restaurant-registration/add-item-tags.js`
- [ ] `scripts/restaurant-registration/add-option-sets.js`
- [ ] `scripts/ordering-page-customization.js`
- [ ] `scripts/edit-website-settings-dark.js`
- [ ] `scripts/edit-website-settings-light.js`
- [ ] `scripts/setup-services-settings.js`
- [ ] `scripts/setup-stripe-payments.js`
- [ ] `scripts/setup-stripe-payments-no-link.js`
- [ ] `scripts/create-onboarding-user.js`
- [ ] `scripts/setup-system-settings-user.js`
- [ ] `scripts/create-api-key-user.js`
- [ ] `scripts/finalise-onboarding-user.js`

### 1.2 Remove Screenshot Functionality

Remove or conditionally disable screenshots:

```javascript
// Before
const takeScreenshot = async (page, name) => {
  const screenshotPath = path.join(__dirname, 'screenshots', `${name}-${Date.now()}.png`);
  await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`📸 Screenshot: ${screenshotPath}`);
};

// After - conditional screenshots
const takeScreenshot = async (page, name) => {
  if (process.env.ENABLE_SCREENSHOTS !== 'true') {
    console.log(`📸 Screenshot skipped: ${name}`);
    return;
  }
  // Original code...
};
```

### 1.3 Update File Paths

Ensure all paths are relative, not absolute:

```javascript
// Before (absolute - won't work in cloud)
const scriptPath = '/Users/giannimunro/Desktop/cursor-projects/automation/scripts/...';

// After (relative - works everywhere)
const scriptPath = path.join(__dirname, '../../../scripts/...');
// OR
const scriptPath = path.resolve(__dirname, '../../../scripts/...');
```

### 1.4 Create Production package.json Scripts

Update `UberEats-Image-Extractor/package.json`:

```json
{
  "scripts": {
    "build": "vite build",
    "start": "node server.js",
    "start:dev": "concurrently \"npm run start-server\" \"npm run start-client\"",
    "start-server": "node server.js",
    "start-client": "vite",
    "dev": "npm run start:dev"
  }
}
```

---

## Phase 2: Railway Backend Setup

### 2.1 Create Railway Project Structure

Create a new directory structure for Railway deployment:

```
/automation
├── railway.json                    # Railway configuration
├── Dockerfile                      # Docker configuration
├── .dockerignore
├── UberEats-Image-Extractor/
└── scripts/
```

### 2.2 Create Dockerfile

Create `/automation/Dockerfile`:

```dockerfile
# Use Node.js with Playwright pre-installed
FROM mcr.microsoft.com/playwright:v1.40.0-jammy

# Set working directory
WORKDIR /app

# Set environment variables
ENV NODE_ENV=production
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# Copy package files first (for caching)
COPY UberEats-Image-Extractor/package*.json ./UberEats-Image-Extractor/
COPY scripts/restaurant-registration/package*.json ./scripts/restaurant-registration/

# Install dependencies
WORKDIR /app/UberEats-Image-Extractor
RUN npm ci --only=production

WORKDIR /app/scripts/restaurant-registration
RUN npm ci --only=production

# Copy application code
WORKDIR /app
COPY UberEats-Image-Extractor/ ./UberEats-Image-Extractor/
COPY scripts/ ./scripts/
COPY extracted-menus/ ./extracted-menus/
COPY generated-code/ ./generated-code/

# Set working directory for the app
WORKDIR /app/UberEats-Image-Extractor

# Expose ports
EXPOSE 3007
EXPOSE 5007

# Start the server
CMD ["node", "server.js"]
```

### 2.3 Create .dockerignore

Create `/automation/.dockerignore`:

```
# Node modules (will be installed in container)
**/node_modules

# Git
.git
.gitignore

# Development files
**/*.log
**/*.md
!README.md

# IDE
.vscode
.idea
*.swp
*.swo

# OS files
.DS_Store
Thumbs.db

# Environment files (will be set in Railway)
**/.env
**/.env.*

# Screenshots (not needed in production)
**/screenshots

# Test files
**/test-*
**/*.test.js
**/*.spec.js

# Build artifacts
**/dist

# Planning docs
planning/

# Claude sessions
.claude/
```

### 2.4 Create railway.json

Create `/automation/railway.json`:

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "Dockerfile"
  },
  "deploy": {
    "startCommand": "node server.js",
    "healthcheckPath": "/api/health",
    "healthcheckTimeout": 300,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  }
}
```

### 2.5 Add Health Check Endpoint

Add to `server.js`:

```javascript
// Health check endpoint for Railway
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});
```

### 2.6 Railway Environment Variables

Set these in Railway dashboard:

```bash
# Required
NODE_ENV=production
PORT=3007

# Supabase
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Firecrawl (if used)
FIRECRAWL_API_KEY=your_firecrawl_key
FIRECRAWL_API_URL=https://api.firecrawl.dev

# Playwright
HEADLESS=true
ENABLE_SCREENSHOTS=false

# Optional: Admin credentials for scripts
ADMIN_PASSWORD=your_admin_password
```

### 2.7 Deploy to Railway

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Initialize project (in /automation directory)
cd /Users/giannimunro/Desktop/cursor-projects/automation
railway init

# Link to existing project or create new
railway link

# Deploy
railway up

# Get deployment URL
railway domain
```

---

## Phase 3: Netlify Frontend Setup

### 3.1 Create Netlify Configuration

Create `UberEats-Image-Extractor/netlify.toml`:

```toml
[build]
  # Build command
  command = "npm run build"

  # Output directory (Vite default)
  publish = "dist"

  # Base directory
  base = "UberEats-Image-Extractor"

[build.environment]
  NODE_VERSION = "20"

# Redirect API calls to Railway backend
[[redirects]]
  from = "/api/*"
  to = "https://your-railway-app.railway.app/api/:splat"
  status = 200
  force = true

# Redirect WebSocket connections
[[redirects]]
  from = "/socket.io/*"
  to = "https://your-railway-app.railway.app/socket.io/:splat"
  status = 200
  force = true

# SPA fallback - all routes go to index.html
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

### 3.2 Update Vite Config for Production

Update `UberEats-Image-Extractor/vite.config.ts`:

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false, // Disable sourcemaps in production
  },
  // Development proxy (won't affect production)
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3007',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:5007',
        ws: true,
      },
    },
  },
})
```

### 3.3 Create Environment-Aware API Client

Create/update `UberEats-Image-Extractor/src/lib/api.ts`:

```typescript
// API base URL - uses environment variable or falls back to relative path
const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export const api = {
  baseUrl: API_BASE_URL,

  async fetch(endpoint: string, options: RequestInit = {}) {
    const url = `${API_BASE_URL}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    return response.json();
  },

  // Convenience methods
  get: (endpoint: string) => api.fetch(endpoint),
  post: (endpoint: string, data: any) => api.fetch(endpoint, {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  put: (endpoint: string, data: any) => api.fetch(endpoint, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  delete: (endpoint: string) => api.fetch(endpoint, { method: 'DELETE' }),
};
```

### 3.4 Netlify Environment Variables

Set in Netlify dashboard (Site settings > Build & deploy > Environment):

```bash
# API URL (your Railway backend)
VITE_API_URL=https://your-railway-app.railway.app

# Supabase (for client-side auth if needed)
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```

### 3.5 Deploy to Netlify

**Option A: Via Netlify CLI**

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login
netlify login

# Initialize (in UberEats-Image-Extractor directory)
cd UberEats-Image-Extractor
netlify init

# Deploy
netlify deploy --prod
```

**Option B: Via GitHub Integration (Recommended)**

1. Push code to GitHub
2. Go to app.netlify.com
3. Click "New site from Git"
4. Select your repository
5. Configure:
   - Base directory: `UberEats-Image-Extractor`
   - Build command: `npm run build`
   - Publish directory: `dist`
6. Add environment variables
7. Deploy

---

## Phase 4: CORS and Security Configuration

### 4.1 Update Server CORS Settings

Update `server.js` CORS configuration:

```javascript
const cors = require('cors');

// CORS configuration
const corsOptions = {
  origin: [
    'http://localhost:5173',           // Local Vite dev
    'http://localhost:3007',           // Local server
    'https://your-app.netlify.app',    // Production frontend
    /\.netlify\.app$/,                 // Any Netlify preview deploys
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
```

### 4.2 WebSocket CORS

Update WebSocket server configuration:

```javascript
const io = require('socket.io')(server, {
  cors: {
    origin: [
      'http://localhost:5173',
      'https://your-app.netlify.app',
      /\.netlify\.app$/,
    ],
    methods: ['GET', 'POST'],
    credentials: true,
  },
});
```

---

## Phase 5: File Storage (Cloud Migration)

### 5.1 Current Local Storage Issues

Currently, the app stores files locally:
- CSV exports to `/extracted-menus/`
- Generated code to `/generated-code/`
- Temporary uploads to `/tmp/`

These won't persist between Railway deployments!

### 5.2 Solution: Supabase Storage

Use Supabase Storage for persistent files:

```javascript
// Create a storage service
// UberEats-Image-Extractor/src/services/storage-service.js

const { supabase } = require('./database-service');

const StorageService = {
  // Upload CSV file
  async uploadCSV(fileName, fileContent) {
    const { data, error } = await supabase.storage
      .from('extracted-menus')
      .upload(fileName, fileContent, {
        contentType: 'text/csv',
        upsert: true,
      });

    if (error) throw error;
    return data;
  },

  // Get public URL for file
  getPublicUrl(bucket, fileName) {
    const { data } = supabase.storage
      .from(bucket)
      .getPublicUrl(fileName);

    return data.publicUrl;
  },

  // Download file
  async downloadFile(bucket, fileName) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .download(fileName);

    if (error) throw error;
    return data;
  },
};

module.exports = { StorageService };
```

### 5.3 Create Supabase Storage Buckets

Run this SQL in Supabase:

```sql
-- Create storage buckets
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('extracted-menus', 'extracted-menus', false),
  ('generated-code', 'generated-code', false),
  ('temp-uploads', 'temp-uploads', false);

-- Add RLS policies (adjust based on your auth setup)
CREATE POLICY "Users can upload to their org folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id IN ('extracted-menus', 'generated-code', 'temp-uploads')
);

CREATE POLICY "Users can read from their org folder"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id IN ('extracted-menus', 'generated-code', 'temp-uploads')
);
```

---

## Phase 6: Deployment Checklist

### Pre-Deployment Checklist

- [ ] **Code Changes**
  - [ ] All Playwright scripts support headless mode via env variable
  - [ ] Screenshots conditionally disabled
  - [ ] All file paths are relative
  - [ ] Health check endpoint added to server.js
  - [ ] CORS configured for production domains
  - [ ] WebSocket CORS configured

- [ ] **Railway Setup**
  - [ ] Railway account created
  - [ ] Dockerfile created and tested locally
  - [ ] railway.json configured
  - [ ] Environment variables set in Railway dashboard
  - [ ] Domain/URL obtained from Railway

- [ ] **Netlify Setup**
  - [ ] Netlify account created
  - [ ] netlify.toml created with proper redirects
  - [ ] Railway URL added to redirects
  - [ ] Environment variables set
  - [ ] Build settings configured

- [ ] **Database & Storage**
  - [ ] Supabase connection strings updated
  - [ ] Storage buckets created (if using Supabase storage)
  - [ ] RLS policies configured

### Post-Deployment Testing

- [ ] Frontend loads correctly on Netlify
- [ ] API calls reach Railway backend
- [ ] WebSocket connections work
- [ ] User authentication works
- [ ] Playwright automations complete successfully
- [ ] Database operations work
- [ ] File uploads/downloads work

---

## Phase 7: Monitoring & Debugging

### 7.1 Railway Logs

```bash
# View logs in CLI
railway logs

# Or in Railway dashboard:
# Project > Deployments > Select deployment > Logs
```

### 7.2 Add Structured Logging

```javascript
// Simple logging helper
const log = {
  info: (msg, data) => console.log(JSON.stringify({
    level: 'info',
    message: msg,
    data,
    timestamp: new Date().toISOString()
  })),
  error: (msg, error) => console.error(JSON.stringify({
    level: 'error',
    message: msg,
    error: error?.message,
    stack: error?.stack,
    timestamp: new Date().toISOString()
  })),
};
```

### 7.3 Health Monitoring

Use Railway's built-in health checks or add external monitoring:
- UptimeRobot (free tier available)
- Better Uptime
- Pingdom

---

## Cost Breakdown

| Service | Plan | Monthly Cost |
|---------|------|--------------|
| Netlify | Free | $0 |
| Railway | Starter | ~$5-20 (usage-based) |
| Supabase | Free | $0 |
| **Total** | | **~$5-20/month** |

### Railway Pricing Notes
- Pay for compute hours used
- ~$0.000463/minute for 512MB RAM
- With headless Playwright: estimate ~$10-15/month for moderate usage
- Includes 500 free hours/month for new users

---

## Next Steps

1. **Test locally with Docker** to ensure everything works containerized
2. **Deploy to Railway** with all environment variables
3. **Deploy frontend to Netlify** with Railway URL in redirects
4. **Update DNS/domains** if using custom domains
5. **Monitor and optimize** based on usage patterns

---

## Troubleshooting

### Playwright Fails in Container
- Ensure using `mcr.microsoft.com/playwright` image
- Add `--disable-dev-shm-usage` flag
- Check memory limits (need at least 1GB)

### API Calls Fail from Netlify
- Check CORS configuration on Railway
- Verify redirect rules in netlify.toml
- Check Railway URL is correct

### WebSocket Connection Issues
- Ensure socket.io version matches between frontend/backend
- Check WebSocket proxy in netlify.toml
- Verify CORS allows WebSocket connections

### Long Script Timeouts
- Railway has 30-minute default timeout (adjustable)
- Consider adding progress tracking via WebSocket
- Add job queue for very long operations (future enhancement)

---

## Phase 8: Post-Deployment Configuration

After deploying to Railway and Netlify, complete these final configuration steps.

### 8.1 Update Netlify Redirects with Railway URL

Once you have your Railway deployment URL, update `UberEats-Image-Extractor/netlify.toml`:

```toml
# Replace YOUR_RAILWAY_URL with actual Railway URL
[[redirects]]
  from = "/api/*"
  to = "https://YOUR_ACTUAL_RAILWAY_URL.railway.app/api/:splat"
  status = 200
  force = true

[[redirects]]
  from = "/socket.io/*"
  to = "https://YOUR_ACTUAL_RAILWAY_URL.railway.app/socket.io/:splat"
  status = 200
  force = true
```

### 8.2 Set Railway Environment Variables

In Railway dashboard, add these environment variables:

```bash
# Core
NODE_ENV=production
PORT=3007

# Frontend URL (your Netlify domain)
FRONTEND_URL=https://your-app.netlify.app

# Supabase
SUPABASE_URL=https://qgabsyggzlkcstjzugdh.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Firecrawl
FIRECRAWL_API_KEY=your_firecrawl_key
FIRECRAWL_API_URL=https://api.firecrawl.dev

# Playwright
HEADLESS=true
ENABLE_SCREENSHOTS=false

# Admin credentials (for automation scripts)
ADMIN_PASSWORD=your_admin_password

# UploadCare (if using)
UPLOADCARE_PUBLIC_KEY=your_public_key
UPLOADCARE_SECRET_KEY=your_secret_key
```

### 8.3 Set Netlify Environment Variables

In Netlify dashboard (Site settings > Environment variables):

```bash
# Supabase (for client-side)
VITE_SUPABASE_URL=https://qgabsyggzlkcstjzugdh.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key

# Optional: API URL if not using redirects
VITE_API_URL=https://your-railway-url.railway.app
```

### 8.4 Verify Deployment

After configuration, test these endpoints:

1. **Health Check**: `https://your-railway-url.railway.app/api/health`
   - Should return: `{"status":"healthy","timestamp":"...","environment":"production"}`

2. **Frontend**: `https://your-app.netlify.app`
   - Should load the React application

3. **API via Netlify Proxy**: `https://your-app.netlify.app/api/health`
   - Should proxy to Railway and return health status

### 8.5 Test Critical Flows

- [ ] User login/authentication works
- [ ] Restaurant list loads from database
- [ ] Menu extraction starts successfully
- [ ] Playwright automations run in headless mode
- [ ] WebSocket connections establish

---

## Implementation Progress

### Completed ✅

| Item | Status | Notes |
|------|--------|-------|
| Dockerfile | ✅ | Uses Playwright image, health check configured |
| .dockerignore | ✅ | Excludes dev files, node_modules |
| railway.json | ✅ | Docker build, health check path |
| netlify.toml | ✅ | Redirects, SPA fallback, security headers |
| browser-config.js | ✅ | Shared config (`.cjs` for CommonJS, `.mjs` for ESM) |
| Health endpoint | ✅ | `/api/health` returns status |
| CORS configuration | ✅ | Production-ready with env-based domains |
| Script migration plan | ✅ | Comprehensive guide at `PLAYWRIGHT-SCRIPT-MIGRATION-PLAN.md` |
| **Playwright scripts migration** | ✅ | All 16 scripts updated to use browser-config |
| **ENV consolidation** | ✅ | All scripts load from `UberEats-Image-Extractor/.env` |
| **package-lock.json** | ✅ | Removed from .gitignore for Railway `npm ci` |
| **ESM to CommonJS conversion** | ✅ | Fixed 3 files (see below) |
| **Railway deployment** | ✅ | Server running successfully |

### ESM to CommonJS Fixes (2025-12-08)

Railway was failing with `SyntaxError: Unexpected token 'export'` because Node.js v20 cannot parse ESM syntax in CommonJS context.

**Fixed files:**
1. `src/services/firecrawl-service.js` - Converted all `import`/`export` to `require`/`module.exports`
2. `src/utils/image-extraction-helpers.js` - Removed ESM exports, kept CommonJS only
3. `src/utils/platform-detector.js` - Removed ESM exports, kept CommonJS only

**Commits:**
- `73685a0` - Convert ESM to CommonJS for Railway deployment
- `511b086` - Fix platform-detector.js ESM export for Railway

### Pending ⏳

| Item | Status | Notes |
|------|--------|-------|
| Get Railway URL | ⏳ | Need to get public URL from Railway dashboard |
| Update netlify.toml | ⏳ | Replace `YOUR_RAILWAY_URL` with actual URL |
| Netlify deployment | ⏳ | After netlify.toml updated |
| Railway environment variables | ⏳ | Set remaining env vars in Railway dashboard |
| WebSocket CORS | ⏳ | Update after Netlify URL known |
| Supabase storage buckets | ⏳ | Optional, for persistent file storage |

---

## Script Migration Summary

All 16 Playwright scripts have been migrated. See `ENV-CONSOLIDATION-COMPLETED.md` for details.

### File Structure

```
scripts/
├── lib/
│   ├── browser-config.cjs    # CommonJS version (for restaurant-registration scripts)
│   └── browser-config.mjs    # ESM version (for scripts/*.js)
├── restaurant-registration/
│   ├── register-restaurant-production.js  # Uses browser-config.cjs
│   ├── login-and-register-restaurant.js   # Uses browser-config.cjs
│   ├── import-csv-menu.js                 # Uses browser-config.cjs
│   ├── add-option-sets.js                 # Uses browser-config.cjs
│   ├── add-item-tags.js                   # Uses browser-config.cjs
│   └── upload-menu-images.js              # Uses browser-config.cjs
├── edit-website-settings-dark.js          # Uses browser-config.mjs
├── edit-website-settings-light.js         # Uses browser-config.mjs
└── ... (other ESM scripts)
```

### Environment Variable Loading

All scripts now load from a single `.env` file:
- **CommonJS scripts**: `require('dotenv').config({ path: path.join(__dirname, '../../UberEats-Image-Extractor/.env') })`
- **ESM scripts**: `dotenv.config({ path: path.join(__dirname, '../UberEats-Image-Extractor/.env') })`

For Railway deployment, environment variables are set in the Railway dashboard (no `.env` file needed in production).

---

## Quick Start Commands

### Local Docker Test
```bash
cd /Users/giannimunro/Desktop/cursor-projects/automation

# Build Docker image
docker build -t pumpd-automation .

# Run container
docker run -p 3007:3007 \
  -e NODE_ENV=production \
  -e SUPABASE_URL=your_url \
  -e SUPABASE_ANON_KEY=your_key \
  pumpd-automation

# Test health endpoint
curl http://localhost:3007/api/health
```

### Railway Deployment
```bash
# Install CLI
npm install -g @railway/cli

# Login and deploy
railway login
cd /Users/giannimunro/Desktop/cursor-projects/automation
railway init
railway up

# Get URL
railway domain
```

### Netlify Deployment
```bash
# Install CLI
npm install -g netlify-cli

# Login and deploy
netlify login
cd /Users/giannimunro/Desktop/cursor-projects/automation/UberEats-Image-Extractor
netlify init
netlify deploy --prod
```