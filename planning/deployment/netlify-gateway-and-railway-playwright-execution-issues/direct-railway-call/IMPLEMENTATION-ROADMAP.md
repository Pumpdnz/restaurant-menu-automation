# Direct Railway Call - Implementation Roadmap

**Created**: 2025-12-09
**Status**: Ready for Implementation
**Estimated Effort**: 1-2 hours

## Overview

This document outlines the implementation of direct Railway API calls from the frontend to bypass Netlify's ~30-second gateway timeout for long-running Playwright script executions.

```
BEFORE (Broken):
Frontend → Netlify Proxy → Railway → Script (2-3 min) → TIMEOUT at 30s → 504

AFTER (Working):
Frontend → Railway (direct) → Script (2-3 min) → Response → Success
```

---

## Why This Approach

| Factor | Direct Railway Call | Full Async Queue |
|--------|---------------------|------------------|
| Implementation time | 1-2 hours | 14-20 hours |
| Solves timeout issue | Yes | Yes |
| Progress feedback | No (spinner only) | Yes (real-time) |
| Survives tab close | No | Yes |
| Complexity | Minimal | Significant |

**Decision**: Implement this quick fix now, upgrade to async queue later if needed.

---

## Prerequisites

Before starting:
- [ ] Railway deployment URL confirmed
- [ ] Current CORS configuration reviewed
- [ ] Frontend API service location identified

---

## Phase 1: Backend CORS Configuration (Railway)

### 1.1 Identify Current CORS Setup

**File**: `UberEats-Image-Extractor/server.js`

Check existing CORS configuration and update to allow requests from your Netlify frontend domain.

### 1.2 Update CORS Configuration

```javascript
const cors = require('cors');

const corsOptions = {
  origin: [
    'http://localhost:3000',           // Local development
    'http://localhost:5173',           // Vite dev server
    'https://your-app.netlify.app',    // Production Netlify
    'https://admin.pumpd.co.nz',       // Production domain (if applicable)
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Organisation-ID'],
};

app.use(cors(corsOptions));
```

### 1.3 Verify Preflight Handling

Ensure OPTIONS requests are handled for CORS preflight:

```javascript
// Should be automatic with cors() middleware, but verify
app.options('*', cors(corsOptions));
```

---

## Phase 2: Frontend API Service Update

### 2.1 Create Railway-Specific API Instance

**File**: `UberEats-Image-Extractor/src/services/api.js` (or equivalent)

```javascript
import axios from 'axios';

// Existing API instance (goes through Netlify proxy)
export const api = axios.create({
  baseURL: '/api',
  timeout: 30000, // 30s - fine for quick operations
});

// New: Direct Railway API for long-running operations
export const railwayApi = axios.create({
  baseURL: import.meta.env.VITE_RAILWAY_API_URL || 'https://your-app.railway.app',
  timeout: 300000, // 5 minutes - for Playwright scripts
});

// Apply same auth interceptor to both
const authInterceptor = (config) => {
  const token = localStorage.getItem('token'); // or however you store it
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
};

api.interceptors.request.use(authInterceptor);
railwayApi.interceptors.request.use(authInterceptor);
```

### 2.2 Add Environment Variable

**File**: `.env` (frontend)

```bash
# Development
VITE_RAILWAY_API_URL=http://localhost:3007

# Production (set in Netlify environment variables)
# VITE_RAILWAY_API_URL=https://your-app.railway.app
```

### 2.3 Update Long-Running API Calls

Identify and update all Playwright-related API calls to use `railwayApi`:

```javascript
// BEFORE (times out)
const response = await api.post('/api/registration/add-item-tags', payload);

// AFTER (works)
const response = await railwayApi.post('/api/registration/add-item-tags', payload);
```

---

## Phase 3: Identify Endpoints to Convert

### Endpoints That Need Direct Railway Calls

These are the long-running Playwright endpoints (timeout > 30s):

| Endpoint | Current Timeout | Script |
|----------|-----------------|--------|
| `POST /api/registration/add-item-tags` | 180s | add-item-tags.js |
| `POST /api/registration/add-option-sets` | 180s | add-option-sets.js |
| `POST /api/registration/import-csv-menu` | 240s | import-csv-menu.js |
| `POST /api/registration/restaurant` | 180s | login-and-register-restaurant.js |
| `POST /api/registration/configure-website` | 180s | edit-website-settings-*.js |
| `POST /api/registration/configure-payments` | 180s | setup-stripe-payments*.js |
| `POST /api/registration/configure-services` | 180s | setup-services-settings.js |
| `POST /api/registration/configure-system-settings` | 120s | setup-system-settings-user.js |
| `POST /api/registration/configure-api-keys` | 120s | create-api-key-user.js |
| `POST /api/registration/finalise-onboarding` | 300s | finalise-onboarding-user.js |

### Endpoints That Can Stay on Proxy

Quick operations (< 30s) can continue using the Netlify proxy:
- Authentication endpoints
- Data fetching endpoints
- Quick CRUD operations

---

## Phase 4: Frontend Component Updates

### 4.1 Update API Call Locations

Search for usage of the endpoints listed above and update to use `railwayApi`.

**Example locations to check**:
- `src/pages/` - Page components making API calls
- `src/hooks/` - Custom hooks with API calls
- `src/services/` - Service functions

### 4.2 Update Loading States

Since operations now wait for the full response, ensure good UX:

```jsx
const [isLoading, setIsLoading] = useState(false);
const [loadingMessage, setLoadingMessage] = useState('');

const handleAddItemTags = async () => {
  setIsLoading(true);
  setLoadingMessage('Adding item tags... This may take 2-3 minutes.');

  try {
    const response = await railwayApi.post('/api/registration/add-item-tags', payload);
    // Handle success
  } catch (error) {
    // Handle error
  } finally {
    setIsLoading(false);
    setLoadingMessage('');
  }
};
```

### 4.3 Add User Feedback

Consider adding a message to inform users about the expected wait time:

```jsx
{isLoading && (
  <div className="loading-overlay">
    <Spinner />
    <p>{loadingMessage}</p>
    <p className="text-sm text-gray-500">Please don't close this window.</p>
  </div>
)}
```

---

## Phase 5: Testing & Deployment

### 5.1 Local Testing

1. Start Railway API locally: `npm start` (port 3007)
2. Start frontend with `VITE_RAILWAY_API_URL=http://localhost:3007`
3. Test each long-running endpoint
4. Verify CORS headers in browser Network tab

### 5.2 Staging/Production Testing

1. Deploy backend CORS changes to Railway
2. Set `VITE_RAILWAY_API_URL` in Netlify environment variables
3. Deploy frontend
4. Test each endpoint end-to-end
5. Verify no 504 timeouts

### 5.3 Test Checklist

- [ ] CORS preflight (OPTIONS) succeeds
- [ ] Authorization header passes through
- [ ] add-item-tags completes successfully
- [ ] add-option-sets completes successfully
- [ ] import-csv-menu completes successfully
- [ ] register-restaurant completes successfully
- [ ] configure-website completes successfully
- [ ] configure-payments completes successfully
- [ ] All error responses handled correctly

---

## Implementation Checklist

### Backend (Railway)
- [ ] Review current CORS config in server.js
- [ ] Add Netlify domain to CORS allowed origins
- [ ] Deploy to Railway
- [ ] Test CORS with curl/Postman

### Frontend (Netlify)
- [ ] Create `railwayApi` axios instance
- [ ] Add `VITE_RAILWAY_API_URL` environment variable
- [ ] Update add-item-tags call to use railwayApi
- [ ] Update add-option-sets call to use railwayApi
- [ ] Update import-csv-menu call to use railwayApi
- [ ] Update register-restaurant call to use railwayApi
- [ ] Update configure-website call to use railwayApi
- [ ] Update configure-payments call to use railwayApi
- [ ] Update configure-services call to use railwayApi
- [ ] Update configure-system-settings call to use railwayApi
- [ ] Update configure-api-keys call to use railwayApi
- [ ] Update finalise-onboarding call to use railwayApi
- [ ] Add loading messages for long operations
- [ ] Deploy to Netlify with environment variable

### Validation
- [ ] No 504 Gateway Timeout errors
- [ ] All Playwright scripts execute successfully
- [ ] Loading states display correctly
- [ ] Errors handled gracefully

---

## Rollback Plan

If issues arise:

1. **Frontend**: Revert API calls back to `api` instance
2. **Backend**: No changes needed (CORS additions are additive)
3. **Environment**: Remove/update `VITE_RAILWAY_API_URL`

---

## Future Upgrade Path

When/if you need:
- Real-time progress feedback
- Job persistence (survives browser close)
- Job history/audit trail
- Controlled concurrency

Upgrade to the full Async Job Queue solution documented in:
`../async-job-queue/IMPLEMENTATION-ROADMAP.md`

---

## Files to Modify

| File | Change |
|------|--------|
| `UberEats-Image-Extractor/server.js` | Update CORS configuration |
| `UberEats-Image-Extractor/src/services/api.js` | Add railwayApi instance |
| `.env` (frontend) | Add VITE_RAILWAY_API_URL |
| Various page/component files | Update API calls |
| Netlify environment variables | Set VITE_RAILWAY_API_URL |

---

## Security Considerations

1. **Railway URL Exposure**: The Railway URL will be visible in client-side code. This is acceptable because:
   - All endpoints require authentication (JWT)
   - No secrets are exposed
   - Rate limiting should be configured on Railway

2. **CORS Configuration**: Only allow specific origins, never use `*` in production

3. **Authentication**: Ensure auth interceptor applies to railwayApi instance

---

## Estimated Timeline

| Task | Time |
|------|------|
| Backend CORS setup | 15 min |
| Frontend API service update | 30 min |
| Update all API calls | 30 min |
| Testing | 30 min |
| **Total** | **~2 hours** |
