# API Specification: Script Jobs Endpoints

**Last Updated**: 2025-12-09
**Status**: Planned
**Base Path**: `/api/jobs`

## Overview

This document specifies the REST API endpoints for the async job queue system. These endpoints allow clients to:
1. Create new script execution jobs
2. Poll for job status/progress
3. Retrieve job results
4. Cancel pending jobs
5. List jobs with filtering

---

## Endpoints Summary

| Method | Path | Description | Auth Required |
|--------|------|-------------|---------------|
| POST | `/api/jobs` | Create a new job | Yes |
| GET | `/api/jobs/:jobId` | Get job status and details | Yes |
| GET | `/api/jobs/:jobId/status` | Get minimal status (for polling) | Yes |
| DELETE | `/api/jobs/:jobId` | Cancel a pending/queued job | Yes |
| GET | `/api/jobs` | List jobs with filtering | Yes |
| GET | `/api/jobs/types` | Get available job types | Yes |

---

## Endpoint Details

### POST /api/jobs

Create a new script execution job.

**Request Headers**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
X-Organisation-ID: <organisation_uuid>  (optional, from auth context)
```

**Request Body**
```json
{
  "jobType": "add-item-tags",
  "payload": {
    "email": "owner@restaurant.com",
    "password": "SecurePass123!",
    "restaurantName": "The Best Restaurant",
    "itemTags": [
      { "name": "Spicy", "display_name": "Spicy", "color": "#FF0000" }
    ]
  },
  "priority": 0,
  "metadata": {
    "source": "menu-builder-ui",
    "requestId": "req_abc123"
  }
}
```

**Request Body Schema**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `jobType` | string (enum) | Yes | Type of script to execute |
| `payload` | object | Yes | Script-specific input data |
| `priority` | integer | No | Queue priority (default: 0) |
| `metadata` | object | No | Additional metadata |
| `restaurantId` | UUID | No | Associated restaurant |

**Response: 202 Accepted**
```json
{
  "success": true,
  "job": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "jobId": "JOB_20251209_143052_a1b2c3d4",
    "jobType": "add-item-tags",
    "status": "pending",
    "createdAt": "2025-12-09T14:30:52.123Z",
    "estimatedDuration": 45000
  },
  "links": {
    "status": "/api/jobs/JOB_20251209_143052_a1b2c3d4/status",
    "details": "/api/jobs/JOB_20251209_143052_a1b2c3d4",
    "cancel": "/api/jobs/JOB_20251209_143052_a1b2c3d4"
  }
}
```

**Response: 400 Bad Request**
```json
{
  "success": false,
  "error": {
    "code": "INVALID_JOB_TYPE",
    "message": "Invalid job type: unknown-type",
    "validTypes": ["add-item-tags", "add-option-sets", "import-csv-menu", ...]
  }
}
```

**Response: 401 Unauthorized**
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required"
  }
}
```

---

### GET /api/jobs/:jobId

Get complete job details including results.

**Path Parameters**
| Parameter | Type | Description |
|-----------|------|-------------|
| `jobId` | string | Job ID (human-readable format) |

**Response: 200 OK (Pending/In Progress)**
```json
{
  "success": true,
  "job": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "jobId": "JOB_20251209_143052_a1b2c3d4",
    "jobType": "add-item-tags",
    "status": "in_progress",
    "progress": {
      "percent": 40,
      "message": "Creating item tags...",
      "currentStep": 2,
      "totalSteps": 5
    },
    "createdAt": "2025-12-09T14:30:52.123Z",
    "startedAt": "2025-12-09T14:30:53.456Z",
    "updatedAt": "2025-12-09T14:31:15.789Z"
  }
}
```

**Response: 200 OK (Completed)**
```json
{
  "success": true,
  "job": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "jobId": "JOB_20251209_143052_a1b2c3d4",
    "jobType": "add-item-tags",
    "status": "completed",
    "progress": {
      "percent": 100,
      "message": "All item tags created successfully",
      "currentStep": 5,
      "totalSteps": 5
    },
    "result": {
      "success": true,
      "message": "Successfully created 5 item tags",
      "data": {
        "itemsCreated": 5,
        "itemsFailed": 0,
        "details": [
          { "name": "Spicy", "status": "created" },
          { "name": "Vegan", "status": "created" }
        ]
      },
      "duration_ms": 45230
    },
    "createdAt": "2025-12-09T14:30:52.123Z",
    "startedAt": "2025-12-09T14:30:53.456Z",
    "completedAt": "2025-12-09T14:31:38.686Z"
  }
}
```

**Response: 200 OK (Failed)**
```json
{
  "success": true,
  "job": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "jobId": "JOB_20251209_143052_a1b2c3d4",
    "jobType": "add-item-tags",
    "status": "failed",
    "error": {
      "code": "AUTH_FAILED",
      "message": "Login failed: Invalid credentials",
      "retryable": true
    },
    "retryCount": 2,
    "maxRetries": 3,
    "nextRetryAt": "2025-12-09T14:32:00.000Z",
    "createdAt": "2025-12-09T14:30:52.123Z",
    "startedAt": "2025-12-09T14:30:53.456Z",
    "completedAt": "2025-12-09T14:31:38.686Z"
  }
}
```

**Response: 404 Not Found**
```json
{
  "success": false,
  "error": {
    "code": "JOB_NOT_FOUND",
    "message": "Job not found: JOB_INVALID_ID"
  }
}
```

---

### GET /api/jobs/:jobId/status

Lightweight status endpoint optimized for polling. Returns minimal data.

**Path Parameters**
| Parameter | Type | Description |
|-----------|------|-------------|
| `jobId` | string | Job ID (human-readable format) |

**Query Parameters**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `includeProgress` | boolean | true | Include progress details |

**Response: 200 OK**
```json
{
  "jobId": "JOB_20251209_143052_a1b2c3d4",
  "status": "in_progress",
  "progress": {
    "percent": 60,
    "message": "Saving changes..."
  },
  "updatedAt": "2025-12-09T14:31:25.123Z"
}
```

**Completed Status Response**
```json
{
  "jobId": "JOB_20251209_143052_a1b2c3d4",
  "status": "completed",
  "progress": {
    "percent": 100,
    "message": "Done"
  },
  "completedAt": "2025-12-09T14:31:38.686Z",
  "hasResult": true
}
```

**Failed Status Response**
```json
{
  "jobId": "JOB_20251209_143052_a1b2c3d4",
  "status": "failed",
  "error": {
    "code": "TIMEOUT",
    "message": "Script execution timed out"
  },
  "retryable": true,
  "retryCount": 1,
  "completedAt": "2025-12-09T14:31:38.686Z"
}
```

---

### DELETE /api/jobs/:jobId

Cancel a pending or queued job. Cannot cancel jobs that are already in progress.

**Path Parameters**
| Parameter | Type | Description |
|-----------|------|-------------|
| `jobId` | string | Job ID (human-readable format) |

**Response: 200 OK**
```json
{
  "success": true,
  "message": "Job cancelled successfully",
  "job": {
    "jobId": "JOB_20251209_143052_a1b2c3d4",
    "status": "cancelled",
    "cancelledAt": "2025-12-09T14:31:00.000Z"
  }
}
```

**Response: 400 Bad Request (Already Running)**
```json
{
  "success": false,
  "error": {
    "code": "CANNOT_CANCEL",
    "message": "Cannot cancel job in status: in_progress",
    "currentStatus": "in_progress"
  }
}
```

**Response: 400 Bad Request (Already Completed)**
```json
{
  "success": false,
  "error": {
    "code": "ALREADY_COMPLETED",
    "message": "Job has already completed",
    "currentStatus": "completed"
  }
}
```

---

### GET /api/jobs

List jobs with filtering and pagination.

**Query Parameters**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `status` | string | - | Filter by status (comma-separated) |
| `jobType` | string | - | Filter by job type |
| `restaurantId` | UUID | - | Filter by restaurant |
| `limit` | integer | 20 | Max results (1-100) |
| `offset` | integer | 0 | Pagination offset |
| `orderBy` | string | createdAt | Sort field |
| `orderDir` | string | desc | Sort direction (asc/desc) |
| `since` | ISO8601 | - | Jobs created after this time |

**Example Request**
```
GET /api/jobs?status=pending,in_progress&limit=10&orderBy=createdAt&orderDir=desc
```

**Response: 200 OK**
```json
{
  "success": true,
  "jobs": [
    {
      "jobId": "JOB_20251209_143052_a1b2c3d4",
      "jobType": "add-item-tags",
      "status": "in_progress",
      "progress": { "percent": 60 },
      "createdAt": "2025-12-09T14:30:52.123Z",
      "restaurantId": "rest_123"
    },
    {
      "jobId": "JOB_20251209_142000_e5f6g7h8",
      "jobType": "add-option-sets",
      "status": "pending",
      "progress": { "percent": 0 },
      "createdAt": "2025-12-09T14:20:00.000Z",
      "restaurantId": "rest_456"
    }
  ],
  "pagination": {
    "total": 45,
    "limit": 10,
    "offset": 0,
    "hasMore": true
  }
}
```

---

### GET /api/jobs/types

Get list of available job types with metadata.

**Response: 200 OK**
```json
{
  "success": true,
  "types": [
    {
      "type": "add-item-tags",
      "displayName": "Add Item Tags",
      "description": "Configure item tags for menu items",
      "estimatedDuration": 45000,
      "maxRetries": 3,
      "requiredFields": ["email", "password", "restaurantName", "itemTags"]
    },
    {
      "type": "add-option-sets",
      "displayName": "Add Option Sets",
      "description": "Configure option sets for menu customization",
      "estimatedDuration": 60000,
      "maxRetries": 3,
      "requiredFields": ["email", "password", "restaurantName", "optionSets"]
    },
    {
      "type": "import-csv-menu",
      "displayName": "Import CSV Menu",
      "description": "Import menu items from CSV file",
      "estimatedDuration": 120000,
      "maxRetries": 2,
      "requiredFields": ["email", "password", "restaurantName", "csvFilePath"]
    }
  ]
}
```

---

## Converted Registration Endpoints

The following existing endpoints will be converted to use the async job pattern:

### POST /api/registration/add-item-tags → POST /api/jobs

**Before (Blocking)**
```javascript
// Returns after 2-3 minutes when script completes
POST /api/registration/add-item-tags
{
  "email": "...",
  "password": "...",
  "restaurantName": "...",
  "itemTags": [...]
}
// Response: { success: true, result: {...} } after 180s
```

**After (Async)**
```javascript
// Returns immediately with job ID
POST /api/jobs
{
  "jobType": "add-item-tags",
  "payload": {
    "email": "...",
    "password": "...",
    "restaurantName": "...",
    "itemTags": [...]
  }
}
// Response: { success: true, job: { jobId: "...", status: "pending" } } in <100ms

// Client polls for completion
GET /api/jobs/JOB_xxx/status
// Response: { status: "in_progress", progress: { percent: 50 } }

// Finally get results
GET /api/jobs/JOB_xxx
// Response: { status: "completed", result: {...} }
```

---

## Job Type → Endpoint Mapping

| Job Type | Original Endpoint | Script Path |
|----------|-------------------|-------------|
| `add-item-tags` | POST /api/registration/add-item-tags | scripts/restaurant-registration/add-item-tags.js |
| `add-option-sets` | POST /api/registration/add-option-sets | scripts/restaurant-registration/add-option-sets.js |
| `import-csv-menu` | POST /api/registration/import-csv-menu | scripts/restaurant-registration/import-csv-menu.js |
| `register-restaurant` | POST /api/registration/restaurant | scripts/restaurant-registration/login-and-register-restaurant.js |
| `configure-website-dark` | POST /api/registration/configure-website | scripts/edit-website-settings-dark.js |
| `configure-website-light` | POST /api/registration/configure-website | scripts/edit-website-settings-light.js |
| `setup-stripe-payments` | POST /api/registration/configure-payments | scripts/setup-stripe-payments.js |
| `setup-stripe-payments-no-link` | POST /api/registration/configure-payments | scripts/setup-stripe-payments-no-link.js |
| `setup-services` | POST /api/registration/configure-services | scripts/setup-services-settings.js |
| `setup-system-settings` | POST /api/registration/configure-system-settings | scripts/setup-system-settings-user.js |
| `create-api-key` | POST /api/registration/configure-api-keys | scripts/create-api-key-user.js |
| `finalise-onboarding` | POST /api/registration/finalise-onboarding | scripts/finalise-onboarding-user.js |

---

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `INVALID_JOB_TYPE` | 400 | Unknown job type provided |
| `INVALID_PAYLOAD` | 400 | Missing or invalid payload fields |
| `JOB_NOT_FOUND` | 404 | Job ID does not exist |
| `UNAUTHORIZED` | 401 | Authentication required |
| `FORBIDDEN` | 403 | Not authorized for this job |
| `CANNOT_CANCEL` | 400 | Job cannot be cancelled (in progress) |
| `ALREADY_COMPLETED` | 400 | Job has already finished |
| `QUEUE_FULL` | 503 | Too many pending jobs |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

---

## Rate Limiting

| Endpoint | Limit | Window |
|----------|-------|--------|
| POST /api/jobs | 10 requests | 1 minute |
| GET /api/jobs/:id | 60 requests | 1 minute |
| GET /api/jobs/:id/status | 120 requests | 1 minute |
| GET /api/jobs | 30 requests | 1 minute |

---

## Polling Recommendations

**Recommended polling intervals:**
- First 30 seconds: Poll every 2 seconds
- 30s - 2 minutes: Poll every 5 seconds
- After 2 minutes: Poll every 10 seconds

**Example client-side implementation:**
```javascript
async function pollJobStatus(jobId, onProgress, onComplete, onError) {
  const startTime = Date.now();

  const poll = async () => {
    const response = await fetch(`/api/jobs/${jobId}/status`);
    const data = await response.json();

    if (data.status === 'completed') {
      const fullJob = await fetch(`/api/jobs/${jobId}`);
      onComplete(await fullJob.json());
      return;
    }

    if (data.status === 'failed' && !data.retryable) {
      onError(data.error);
      return;
    }

    onProgress(data.progress);

    // Calculate next poll interval
    const elapsed = Date.now() - startTime;
    const interval = elapsed < 30000 ? 2000 : elapsed < 120000 ? 5000 : 10000;

    setTimeout(poll, interval);
  };

  poll();
}
```

---

## Route File Location

Create at: `UberEats-Image-Extractor/src/routes/job-routes.js`
