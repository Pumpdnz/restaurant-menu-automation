# Lead Scraping API Specification

## Overview

This document defines the REST API endpoints for the lead scraping feature. All endpoints follow existing patterns from `sequence-instances-routes.js` and `tasks-routes.js`.

## Base URL

```
/api/lead-scrape-jobs
/api/leads
```

## Authentication

All endpoints require authentication via JWT token in the Authorization header:

```
Authorization: Bearer <jwt_token>
```

Organization context is derived from the authenticated user's JWT claims.

---

## Lead Scrape Jobs Endpoints

### GET /api/lead-scrape-jobs

List all lead scrape jobs for the current organization.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| search | string | Search by job name |
| status | string | Filter by status (comma-separated for multiple) |
| platform | string | Filter by platform |
| city | string | Filter by city |
| cuisine | string | Filter by cuisine |
| started_after | ISO date | Jobs started after date |
| started_before | ISO date | Jobs started before date |
| limit | number | Page size (default: 50) |
| offset | number | Page offset |

**Response:**
```json
{
  "success": true,
  "jobs": [
    {
      "id": "uuid",
      "name": "ubereats - indian - auckland - 2025-12-05",
      "platform": "ubereats",
      "country": "nz",
      "city": "Auckland",
      "city_code": "auckland",
      "region_code": "auk",
      "cuisine": "indian",
      "leads_limit": 21,
      "page_offset": 1,
      "initial_url": "https://ubereats.com/nz/category/auckland-auk/indian?page=1",
      "status": "in_progress",
      "current_step": 2,
      "total_steps": 5,
      "leads_extracted": 21,
      "leads_passed": 18,
      "leads_failed": 3,
      "started_at": "2025-12-05T10:30:00Z",
      "completed_at": null,
      "created_at": "2025-12-05T10:30:00Z",
      "steps": [
        {
          "id": "uuid",
          "step_number": 1,
          "step_name": "Category Page Scan",
          "step_type": "automatic",
          "status": "completed",
          "leads_received": 0,
          "leads_processed": 21,
          "leads_passed": 21,
          "leads_failed": 0,
          "completed_at": "2025-12-05T10:31:00Z"
        }
      ]
    }
  ],
  "pagination": {
    "total": 15,
    "limit": 50,
    "offset": 0,
    "hasMore": false
  }
}
```

### GET /api/lead-scrape-jobs/:id

Get a single lead scrape job by ID with full details.

**Response:**
```json
{
  "success": true,
  "job": {
    "id": "uuid",
    "name": "ubereats - indian - auckland - 2025-12-05",
    "platform": "ubereats",
    "country": "nz",
    "city": "Auckland",
    "city_code": "auckland",
    "region_code": "auk",
    "cuisine": "indian",
    "leads_limit": 21,
    "page_offset": 0,
    "initial_url": "https://ubereats.com/nz/category/auckland-auk/indian?page=0",
    "status": "in_progress",
    "current_step": 2,
    "total_steps": 5,
    "leads_extracted": 21,
    "leads_passed": 18,
    "leads_failed": 3,
    "started_at": "2025-12-05T10:30:00Z",
    "completed_at": null,
    "created_at": "2025-12-05T10:30:00Z",
    "metadata": {},
    "steps": [
      {
        "id": "uuid",
        "step_number": 1,
        "step_name": "Category Page Scan",
        "step_description": "Extract restaurant names and URLs from category listing",
        "step_type": "automatic",
        "status": "completed",
        "leads_received": 0,
        "leads_processed": 21,
        "leads_passed": 21,
        "leads_failed": 0,
        "started_at": "2025-12-05T10:30:00Z",
        "completed_at": "2025-12-05T10:31:00Z"
      },
      {
        "id": "uuid",
        "step_number": 2,
        "step_name": "Store Page Enrichment",
        "step_description": "Batch scrape individual store pages for details",
        "step_type": "automatic",
        "status": "in_progress",
        "leads_received": 21,
        "leads_processed": 15,
        "leads_passed": 15,
        "leads_failed": 0,
        "started_at": "2025-12-05T10:31:00Z",
        "completed_at": null
      }
    ]
  }
}
```

### POST /api/lead-scrape-jobs

Create a new lead scrape job.

**Request Body:**
```json
{
  "platform": "ubereats",
  "country": "nz",
  "city": "Auckland",
  "cuisine": "indian",
  "leads_limit": 21,
  "page_offset": 1,
  "save_as_draft": false
}
```

**Notes:**
- `page_offset` defaults to **1** if not provided (first page of results)
- The value is used directly in the URL without adjustment
- Valid range: 1-999

**Response:**
```json
{
  "success": true,
  "job": {
    "id": "uuid",
    "name": "ubereats - indian - auckland - 2025-12-05",
    "platform": "ubereats",
    "country": "nz",
    "city": "Auckland",
    "city_code": "auckland",
    "region_code": "auk",
    "cuisine": "indian",
    "leads_limit": 21,
    "page_offset": 1,
    "initial_url": "https://ubereats.com/nz/category/auckland-auk/indian?page=1",
    "status": "draft",
    "created_at": "2025-12-05T10:30:00Z"
  }
}
```

### PATCH /api/lead-scrape-jobs/:id

Update a lead scrape job (only draft jobs can be updated).

**Request Body:**
```json
{
  "city": "Wellington",
  "cuisine": "chinese",
  "leads_limit": 30
}
```

**Response:**
```json
{
  "success": true,
  "job": { ... }
}
```

### POST /api/lead-scrape-jobs/:id/start

Start a lead scrape job (draft → in_progress).

**Response:**
```json
{
  "success": true,
  "job": {
    "id": "uuid",
    "status": "in_progress",
    "started_at": "2025-12-05T10:30:00Z",
    "steps": [ ... ]
  }
}
```

### POST /api/lead-scrape-jobs/:id/cancel

Cancel a running lead scrape job.

**Response:**
```json
{
  "success": true,
  "job": {
    "id": "uuid",
    "status": "cancelled",
    "cancelled_at": "2025-12-05T12:00:00Z"
  }
}
```

### DELETE /api/lead-scrape-jobs/:id

Delete a lead scrape job and all associated steps/leads.

**Response:**
```json
{
  "success": true,
  "message": "Job deleted successfully"
}
```

---

## Lead Scrape Job Steps Endpoints

### GET /api/lead-scrape-jobs/:jobId/steps/:stepNumber

Get a specific step with its leads.

**Response:**
```json
{
  "success": true,
  "step": {
    "id": "uuid",
    "job_id": "uuid",
    "step_number": 2,
    "step_name": "Store Page Enrichment",
    "step_description": "Batch scrape individual store pages for details",
    "step_type": "automatic",
    "status": "in_progress",
    "leads_received": 21,
    "leads_processed": 15,
    "leads_passed": 15,
    "leads_failed": 0,
    "started_at": "2025-12-05T10:31:00Z"
  },
  "leads": [
    {
      "id": "uuid",
      "restaurant_name": "Maharaja Indian Restaurant",
      "store_link": "https://ubereats.com/nz/store/maharaja-indian...",
      "current_step": 2,
      "step_progression_status": "processed",
      "number_of_reviews": "500+",
      "average_review_rating": 4.7,
      "address": "123 Queen Street, Auckland CBD",
      "cuisine": ["Indian", "Curry"]
    }
  ]
}
```

### POST /api/lead-scrape-job-steps/:stepId/pass-leads

Pass selected leads to the next step.

**Request Body:**
```json
{
  "lead_ids": ["uuid1", "uuid2", "uuid3"]
}
```

**Response:**
```json
{
  "success": true,
  "passed_count": 3,
  "step": {
    "id": "uuid",
    "leads_passed": 18
  }
}
```

### POST /api/lead-scrape-job-steps/:stepId/process

Trigger processing for the step (only for action_required steps).

**Request Body:**
```json
{
  "lead_ids": ["uuid1", "uuid2"]  // Optional: specific leads to process
}
```

**Response:**
```json
{
  "success": true,
  "step": {
    "id": "uuid",
    "status": "in_progress"
  }
}
```

### POST /api/lead-scrape-job-steps/:stepId/retry

Retry failed leads in a step.

**Request Body:**
```json
{
  "lead_ids": ["uuid1", "uuid2"]
}
```

**Response:**
```json
{
  "success": true,
  "retried_count": 2
}
```

---

## Leads Endpoints

### GET /api/leads/pending

Get all pending leads (completed all steps, ready for conversion).

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| search | string | Search by restaurant name |
| platform | string | Filter by platform |
| city | string | Filter by city |
| cuisine | string | Filter by cuisine |
| completed_after | ISO date | Completed after date |
| completed_before | ISO date | Completed before date |
| limit | number | Page size (default: 50) |
| offset | number | Page offset |

**Response:**
```json
{
  "success": true,
  "leads": [
    {
      "id": "uuid",
      "lead_scrape_job_id": "uuid",
      "restaurant_name": "Maharaja Indian Restaurant",
      "store_link": "https://ubereats.com/nz/store/maharaja-indian...",
      "platform": "ubereats",
      "current_step": 5,
      "number_of_reviews": "500+",
      "average_review_rating": 4.7,
      "address": "123 Queen Street, Auckland CBD",
      "city": "Auckland",
      "cuisine": ["Indian", "Curry"],
      "phone": "+64 9 123 4567",
      "email": "info@maharaja.co.nz",
      "website_url": "https://maharaja.co.nz",
      "instagram_url": "https://instagram.com/maharajaakl",
      "facebook_url": "https://facebook.com/maharajaakl",
      "contact_name": "Raj Patel",
      "contact_email": "raj@maharaja.co.nz",
      "is_valid": true,
      "created_at": "2025-12-05T10:31:00Z"
    }
  ],
  "pagination": {
    "total": 45,
    "limit": 50,
    "offset": 0,
    "hasMore": false
  }
}
```

### GET /api/leads/:id

Get a single lead by ID.

**Response:**
```json
{
  "success": true,
  "lead": {
    "id": "uuid",
    "lead_scrape_job_id": "uuid",
    "restaurant_name": "Maharaja Indian Restaurant",
    "store_link": "https://ubereats.com/nz/store/maharaja-indian...",
    "platform": "ubereats",
    "current_step": 3,
    "step_progression_status": "processed",
    "number_of_reviews": "500+",
    "average_review_rating": 4.7,
    "address": "123 Queen Street, Auckland CBD",
    "city": "Auckland",
    "region": "Auckland",
    "country": "nz",
    "cuisine": ["Indian", "Curry"],
    "phone": "+64 9 123 4567",
    "email": null,
    "website_url": null,
    "instagram_url": null,
    "facebook_url": null,
    "contact_name": null,
    "contact_email": null,
    "contact_phone": null,
    "opening_hours": null,
    "is_duplicate": false,
    "is_valid": true,
    "validation_errors": [],
    "converted_to_restaurant_id": null,
    "created_at": "2025-12-05T10:31:00Z",
    "updated_at": "2025-12-05T11:00:00Z",
    "job": {
      "id": "uuid",
      "name": "ubereats - indian - auckland - 2025-12-05",
      "platform": "ubereats"
    }
  }
}
```

### PATCH /api/leads/:id

Update a lead (manual data entry).

**Request Body:**
```json
{
  "phone": "+64 9 123 4567",
  "email": "info@maharaja.co.nz",
  "website_url": "https://maharaja.co.nz",
  "contact_name": "Raj Patel"
}
```

**Response:**
```json
{
  "success": true,
  "lead": { ... }
}
```

### POST /api/leads/convert

Convert leads to restaurants.

**Request Body:**
```json
{
  "lead_ids": ["uuid1", "uuid2", "uuid3"]
}
```

**Response:**
```json
{
  "success": true,
  "converted": [
    {
      "lead_id": "uuid1",
      "restaurant_id": "uuid",
      "restaurant_name": "Maharaja Indian Restaurant"
    },
    {
      "lead_id": "uuid2",
      "restaurant_id": "uuid",
      "restaurant_name": "Curry House"
    }
  ],
  "failed": [
    {
      "lead_id": "uuid3",
      "error": "Lead already converted"
    }
  ],
  "summary": {
    "total": 3,
    "converted": 2,
    "failed": 1
  }
}
```

### DELETE /api/leads

Bulk delete leads.

**Request Body:**
```json
{
  "lead_ids": ["uuid1", "uuid2", "uuid3"]
}
```

**Response:**
```json
{
  "success": true,
  "deleted_count": 3
}
```

### DELETE /api/leads/:id

Delete a single lead.

**Response:**
```json
{
  "success": true,
  "message": "Lead deleted successfully"
}
```

---

## NZ City Codes Endpoint

### GET /api/nz-city-codes

Get all NZ city codes for dropdown selection.

**Response:**
```json
{
  "success": true,
  "cities": [
    {
      "id": "uuid",
      "city_name": "Auckland",
      "city_code": "auckland",
      "region_code": "auk",
      "ubereats_slug": "auckland-auk"
    },
    {
      "id": "uuid",
      "city_name": "Wellington",
      "city_code": "wellington",
      "region_code": "wgn",
      "ubereats_slug": "wellington-wgn"
    }
  ]
}
```

---

## Internal Processing Endpoints

These endpoints are called internally during scrape job processing.

### POST /api/lead-scrape-jobs/:id/process-step-1

Process Step 1: Initial category page scan.

Called automatically when job starts.

**Internal Request:**
```json
{
  "url": "https://ubereats.com/nz/category/auckland-auk/indian?page=0"
}
```

**Internal Response:**
```json
{
  "success": true,
  "leads_created": 21,
  "step_status": "completed"
}
```

### POST /api/lead-scrape-jobs/:id/process-step-2

Process Step 2: Batch scrape individual store pages.

Called automatically after Step 1 completes.

**Internal Request:**
```json
{
  "lead_ids": ["uuid1", "uuid2", ...]
}
```

**Internal Response:**
```json
{
  "success": true,
  "processed": 21,
  "passed": 18,
  "failed": 3,
  "step_status": "completed"
}
```

---

## Error Responses

All endpoints return errors in this format:

```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {}  // Optional additional details
}
```

**Common Error Codes:**

| Code | HTTP Status | Description |
|------|-------------|-------------|
| NOT_FOUND | 404 | Resource not found |
| VALIDATION_ERROR | 400 | Invalid request data |
| UNAUTHORIZED | 401 | Not authenticated |
| FORBIDDEN | 403 | Not authorized for this resource |
| CONFLICT | 409 | Resource conflict (e.g., already converted) |
| RATE_LIMITED | 429 | Too many requests |
| INTERNAL_ERROR | 500 | Server error |

---

## Rate Limiting

The API respects Firecrawl rate limits configured via environment variables:

- `FIRECRAWL_CONCURRENCY_LIMIT`: Max simultaneous requests to Firecrawl
- `FIRECRAWL_RATE_LIMIT`: Max requests per minute
- `FIRECRAWL_RATE_WINDOW`: Rate limit window in milliseconds

API endpoints that trigger Firecrawl operations will queue requests if limits are reached.

---

## WebSocket Events (Optional)

For real-time progress updates during scrape job processing:

### Connection
```javascript
const socket = io('/lead-scrape');
socket.emit('subscribe', { jobId: 'uuid' });
```

### Events

**`job:progress`**
```json
{
  "job_id": "uuid",
  "current_step": 2,
  "step_status": "in_progress",
  "leads_processed": 15,
  "leads_total": 21
}
```

**`step:completed`**
```json
{
  "job_id": "uuid",
  "step_number": 1,
  "status": "completed",
  "leads_passed": 21
}
```

**`job:completed`**
```json
{
  "job_id": "uuid",
  "status": "completed",
  "total_leads": 18
}
```

**`job:error`**
```json
{
  "job_id": "uuid",
  "error": "Firecrawl request failed",
  "step_number": 2
}
```
