# API Specification: Registration Batch Orchestration

## Overview

This document defines the REST API endpoints for the Phase 2 Registration Batch Orchestration system.

## Related Investigation Documents
- [INVESTIGATION_TASK_2_BACKEND_JOB_MANAGEMENT.md](../investigations/phase-2/INVESTIGATION_TASK_2_BACKEND_JOB_MANAGEMENT.md)
- [INVESTIGATION_STEP_ORCHESTRATION.md](../investigations/phase-2/INVESTIGATION_STEP_ORCHESTRATION.md)

---

## Base URL

```
/api/registration-batches
```

---

## Endpoints

### Batch Job Management

#### Create Batch Job

```
POST /api/registration-batches
```

Creates a new registration batch job from selected restaurants.

**Request Body:**
```json
{
  "name": "Auckland Outbound Q4",
  "restaurant_ids": ["uuid1", "uuid2", "uuid3"],
  "source_lead_scrape_job_id": "uuid-optional",
  "auto_start": true,
  "execution_config": {
    "default_password_pattern": "Restaurantname789!",
    "auto_configure_services": true
  }
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "batch_job": {
    "id": "batch-uuid",
    "name": "Auckland Outbound Q4",
    "status": "pending",
    "total_restaurants": 3,
    "current_step": 1,
    "total_steps": 6,
    "created_at": "2024-12-20T10:00:00Z"
  },
  "registration_jobs": [
    { "id": "job1", "restaurant_id": "uuid1", "status": "pending" },
    { "id": "job2", "restaurant_id": "uuid2", "status": "pending" },
    { "id": "job3", "restaurant_id": "uuid3", "status": "pending" }
  ]
}
```

---

#### List Batch Jobs

```
GET /api/registration-batches
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | Filter by status (pending, in_progress, completed, failed, cancelled) |
| `limit` | number | Max results (default: 20) |
| `offset` | number | Pagination offset |

**Response (200 OK):**
```json
{
  "success": true,
  "batch_jobs": [
    {
      "id": "batch-uuid",
      "name": "Auckland Outbound Q4",
      "status": "in_progress",
      "total_restaurants": 12,
      "completed_restaurants": 5,
      "failed_restaurants": 1,
      "current_step": 3,
      "created_at": "2024-12-20T10:00:00Z",
      "started_at": "2024-12-20T10:05:00Z"
    }
  ],
  "total_count": 15
}
```

---

#### Get Batch Job Detail

```
GET /api/registration-batches/:batchId
```

**Response (200 OK):**
```json
{
  "success": true,
  "batch_job": {
    "id": "batch-uuid",
    "name": "Auckland Outbound Q4",
    "status": "in_progress",
    "total_restaurants": 3,
    "completed_restaurants": 1,
    "failed_restaurants": 0,
    "current_step": 3,
    "total_steps": 6,
    "created_at": "2024-12-20T10:00:00Z",
    "started_at": "2024-12-20T10:05:00Z"
  },
  "registration_jobs": [
    {
      "id": "job1",
      "restaurant_id": "uuid1",
      "restaurant_name": "Pizza Palace",
      "status": "completed",
      "current_step": 6,
      "steps": [
        { "step_number": 1, "status": "completed", "duration_ms": 45000 },
        { "step_number": 2, "status": "completed", "duration_ms": 12000 },
        { "step_number": 3, "status": "completed", "duration_ms": 0 },
        { "step_number": 4, "status": "completed", "duration_ms": 8000 },
        { "step_number": 5, "status": "completed", "duration_ms": 0 },
        { "step_number": 6, "status": "completed", "duration_ms": 180000 }
      ]
    },
    {
      "id": "job2",
      "restaurant_id": "uuid2",
      "restaurant_name": "Burger House",
      "status": "in_progress",
      "current_step": 3,
      "steps": [
        { "step_number": 1, "status": "completed" },
        { "step_number": 2, "status": "completed" },
        { "step_number": 3, "status": "action_required" },
        { "step_number": 4, "status": "pending" },
        { "step_number": 5, "status": "pending" },
        { "step_number": 6, "status": "pending" }
      ]
    }
  ],
  "step_summary": {
    "step_1": { "completed": 3, "in_progress": 0, "pending": 0 },
    "step_2": { "completed": 3, "in_progress": 0, "pending": 0 },
    "step_3": { "completed": 1, "action_required": 2, "pending": 0 },
    "step_4": { "completed": 1, "pending": 2 },
    "step_5": { "completed": 1, "pending": 2 },
    "step_6": { "completed": 1, "pending": 2 }
  }
}
```

---

#### Start Batch Job

```
POST /api/registration-batches/:batchId/start
```

**Response (200 OK):**
```json
{
  "success": true,
  "batch_job": {
    "id": "batch-uuid",
    "status": "in_progress",
    "started_at": "2024-12-20T10:05:00Z"
  }
}
```

---

#### Cancel Batch Job

```
POST /api/registration-batches/:batchId/cancel
```

**Response (200 OK):**
```json
{
  "success": true,
  "batch_job": {
    "id": "batch-uuid",
    "status": "cancelled",
    "cancelled_at": "2024-12-20T11:00:00Z"
  },
  "cancelled_jobs": 5,
  "already_completed": 7
}
```

---

### Step Management

#### Get Step Detail

```
GET /api/registration-batches/:batchId/steps/:stepNumber
```

**Response (200 OK):**
```json
{
  "success": true,
  "step_number": 3,
  "step_name": "Company Selection",
  "step_type": "action_required",
  "restaurants": [
    {
      "job_id": "job1",
      "restaurant_id": "uuid1",
      "restaurant_name": "Pizza Palace",
      "step_status": "action_required",
      "candidates": [
        {
          "company_name": "Pizza Palace Ltd",
          "company_number": "123456",
          "status": "Registered",
          "match_source": "name"
        },
        {
          "company_name": "PP Holdings Ltd",
          "company_number": "789012",
          "status": "Registered",
          "match_source": "address"
        }
      ],
      "selected_company_number": null
    }
  ],
  "summary": {
    "total": 12,
    "action_required": 8,
    "completed": 4
  }
}
```

---

#### Complete Action Required Step

```
POST /api/registration-batches/:batchId/steps/:stepNumber/complete
```

**Request Body (Step 3 - Company Selection):**
```json
{
  "selections": {
    "job1": { "company_number": "123456" },
    "job2": { "company_number": "789012" },
    "job3": { "company_number": null, "no_match": true }
  }
}
```

**Request Body (Step 5 - Yolo Configuration):**
```json
{
  "configurations": {
    "job1": {
      "email": "owner@pizzapalace.co.nz",
      "password": "Pizzapalace789!",
      "steps_enabled": {
        "account": true,
        "codeGeneration": true,
        "websiteConfig": true,
        "menuImport": true
      }
    },
    "job2": {
      "use_defaults": true
    }
  },
  "apply_defaults_to_remaining": true
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "updated_jobs": 3,
  "next_step": 4,
  "auto_processing": true
}
```

---

### Individual Job Management

#### Get Registration Job

```
GET /api/registration-jobs/:jobId
```

**Response (200 OK):**
```json
{
  "success": true,
  "job": {
    "id": "job-uuid",
    "batch_job_id": "batch-uuid",
    "restaurant_id": "restaurant-uuid",
    "restaurant": {
      "name": "Pizza Palace",
      "address": "123 Main St",
      "city": "Auckland"
    },
    "status": "in_progress",
    "current_step": 6,
    "execution_config": {},
    "steps": [
      {
        "step_number": 1,
        "step_name": "Menu & Branding Extraction",
        "status": "completed",
        "duration_ms": 45000
      },
      {
        "step_number": 6,
        "step_name": "Pumpd Account Setup",
        "status": "in_progress",
        "sub_step_progress": {
          "current_sub_step": "menuImport",
          "sub_steps": {
            "account": { "status": "completed" },
            "codeGeneration": { "status": "completed" },
            "restaurantRegistration": { "status": "completed" },
            "websiteConfig": { "status": "completed" },
            "servicesConfig": { "status": "completed" },
            "paymentConfig": { "status": "completed" },
            "menuImport": { "status": "in_progress" },
            "optionSets": { "status": "pending" },
            "itemTags": { "status": "pending" }
          }
        }
      }
    ],
    "pumpd_user_id": "pumpd-user-uuid",
    "pumpd_restaurant_id": null
  }
}
```

---

#### Retry Failed Job

```
POST /api/registration-jobs/:jobId/retry
```

**Request Body:**
```json
{
  "from_step": 4,
  "reset_config": false
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "job": {
    "id": "job-uuid",
    "status": "in_progress",
    "current_step": 4
  }
}
```

---

### Progress Polling

#### Poll Batch Progress

```
GET /api/registration-batches/:batchId/progress
```

Lightweight endpoint for frequent polling.

**Response (200 OK):**
```json
{
  "success": true,
  "status": "in_progress",
  "progress_percent": 45,
  "current_step": 3,
  "step_requiring_action": 3,
  "restaurants_summary": {
    "total": 12,
    "completed": 4,
    "in_progress": 6,
    "failed": 1,
    "pending": 1
  },
  "last_updated": "2024-12-20T10:35:00Z"
}
```

---

### Lead Conversion Integration

#### Convert Leads with Batch Creation

```
POST /api/leads/convert
```

Extended endpoint to optionally create registration batch.

**Request Body:**
```json
{
  "lead_ids": ["lead1", "lead2", "lead3"],
  "address_source": "auto",
  "create_registration_batch": true,
  "batch_name": "Auckland Q4 Batch",
  "auto_start_batch": false
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "converted_count": 3,
  "restaurants": [
    { "id": "rest1", "name": "Pizza Palace" },
    { "id": "rest2", "name": "Burger House" },
    { "id": "rest3", "name": "Taco Town" }
  ],
  "registration_batch": {
    "id": "batch-uuid",
    "name": "Auckland Q4 Batch",
    "status": "pending",
    "total_restaurants": 3
  }
}
```

---

## Error Responses

### Standard Error Format

```json
{
  "success": false,
  "error": {
    "code": "BATCH_NOT_FOUND",
    "message": "Registration batch not found",
    "details": {}
  }
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `BATCH_NOT_FOUND` | 404 | Batch job does not exist |
| `JOB_NOT_FOUND` | 404 | Registration job does not exist |
| `INVALID_STATUS` | 400 | Cannot perform action in current status |
| `STEP_NOT_ACTION_REQUIRED` | 400 | Step is not action_required |
| `MISSING_SELECTIONS` | 400 | Required selections not provided |
| `BATCH_ALREADY_STARTED` | 400 | Batch has already been started |
| `RESTAURANT_ALREADY_IN_BATCH` | 400 | Restaurant already in another active batch |

---

## Webhooks (Future)

### Batch Completion Webhook

```json
{
  "event": "registration_batch.completed",
  "batch_id": "batch-uuid",
  "status": "completed",
  "summary": {
    "total": 12,
    "successful": 10,
    "failed": 2
  },
  "timestamp": "2024-12-20T12:00:00Z"
}
```

---

## Rate Limiting

| Endpoint | Rate Limit |
|----------|------------|
| `GET /progress` | 60/minute |
| `POST /start` | 10/minute |
| `POST /steps/:stepNumber/complete` | 30/minute |
| All others | 30/minute |
