# Task Sequence System - API Specification

**Version:** 1.0
**Last Updated:** 2025-01-17

---

## Table of Contents

1. [Overview](#overview)
2. [Base URL & Authentication](#base-url--authentication)
3. [Sequence Templates Endpoints](#sequence-templates-endpoints)
4. [Sequence Steps Endpoints](#sequence-steps-endpoints)
5. [Sequence Instances Endpoints](#sequence-instances-endpoints)
6. [Restaurant Sequences Endpoints](#restaurant-sequences-endpoints)
7. [Error Responses](#error-responses)
8. [Rate Limiting](#rate-limiting)

---

## Overview

The Sequence API provides RESTful endpoints for managing task sequences. All endpoints require authentication and operate within the context of the authenticated user's organization.

### API Principles

- **RESTful Design**: Resource-based URLs with standard HTTP methods
- **JSON Format**: All requests and responses use JSON
- **Authentication Required**: All endpoints require valid JWT token
- **Organization Scoped**: All data is scoped to user's organization via RLS

---

## Base URL & Authentication

### Base URL

```
http://localhost:3007/api
```

Production:
```
https://api.pumpd.co.nz/api
```

### Authentication

All requests must include authentication header:

```http
Authorization: Bearer <jwt_token>
```

### Standard Headers

```http
Content-Type: application/json
Accept: application/json
Authorization: Bearer <jwt_token>
```

---

## Sequence Templates Endpoints

### List Sequence Templates

**Endpoint:** `GET /sequence-templates`

**Description:** Retrieve all sequence templates for the organization

**Query Parameters:**

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `is_active` | boolean | Filter by active status | `?is_active=true` |
| `tags` | string | Comma-separated tags | `?tags=onboarding,demo` |
| `search` | string | Search in name/description | `?search=follow-up` |

**Request Example:**

```http
GET /api/sequence-templates?is_active=true&tags=onboarding
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response:** `200 OK`

```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "organisation_id": "660e8400-e29b-41d4-a716-446655440001",
      "created_by": "770e8400-e29b-41d4-a716-446655440002",
      "name": "Demo Follow-up Sequence",
      "description": "7-step sequence for following up after demo bookings",
      "tags": ["demo", "onboarding", "follow-up"],
      "is_active": true,
      "usage_count": 15,
      "created_at": "2025-01-10T10:00:00Z",
      "updated_at": "2025-01-15T14:30:00Z",
      "sequence_steps": [
        {
          "id": "880e8400-e29b-41d4-a716-446655440003",
          "step_order": 1,
          "name": "Send demo confirmation email",
          "type": "email",
          "delay_value": 0,
          "delay_unit": "days"
        },
        {
          "id": "990e8400-e29b-41d4-a716-446655440004",
          "step_order": 2,
          "name": "Prepare demo materials",
          "type": "internal_activity",
          "delay_value": 1,
          "delay_unit": "days"
        }
      ]
    }
  ],
  "count": 1
}
```

---

### Get Sequence Template

**Endpoint:** `GET /sequence-templates/:id`

**Description:** Retrieve a single template with full step details

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Template ID |

**Request Example:**

```http
GET /api/sequence-templates/550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response:** `200 OK`

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "organisation_id": "660e8400-e29b-41d4-a716-446655440001",
  "created_by": "770e8400-e29b-41d4-a716-446655440002",
  "name": "Demo Follow-up Sequence",
  "description": "7-step sequence for following up after demo bookings",
  "tags": ["demo", "onboarding", "follow-up"],
  "is_active": true,
  "usage_count": 15,
  "metadata": {},
  "created_at": "2025-01-10T10:00:00Z",
  "updated_at": "2025-01-15T14:30:00Z",
  "sequence_steps": [
    {
      "id": "880e8400-e29b-41d4-a716-446655440003",
      "sequence_template_id": "550e8400-e29b-41d4-a716-446655440000",
      "step_order": 1,
      "name": "Send demo confirmation email",
      "description": "Send initial confirmation email",
      "task_template_id": null,
      "type": "email",
      "priority": "high",
      "message_template_id": "aa0e8400-e29b-41d4-a716-446655440005",
      "custom_message": null,
      "delay_value": 0,
      "delay_unit": "days",
      "metadata": {},
      "created_at": "2025-01-10T10:00:00Z",
      "updated_at": "2025-01-10T10:00:00Z",
      "task_templates": null,
      "message_templates": {
        "id": "aa0e8400-e29b-41d4-a716-446655440005",
        "name": "Demo Confirmation Email",
        "type": "email"
      }
    }
  ]
}
```

**Error Responses:**

- `404 Not Found` - Template not found or doesn't belong to organization

---

### Create Sequence Template

**Endpoint:** `POST /sequence-templates`

**Description:** Create a new sequence template with steps

**Request Body:**

```json
{
  "name": "Demo Follow-up Sequence",
  "description": "7-step sequence for following up after demo bookings",
  "tags": ["demo", "follow-up"],
  "steps": [
    {
      "step_order": 1,
      "name": "Send demo confirmation email",
      "description": "Send initial confirmation",
      "type": "email",
      "priority": "high",
      "message_template_id": "aa0e8400-e29b-41d4-a716-446655440005",
      "delay_value": 0,
      "delay_unit": "days"
    },
    {
      "step_order": 2,
      "name": "Prepare demo materials",
      "description": "Gather materials for demo",
      "type": "internal_activity",
      "priority": "medium",
      "delay_value": 1,
      "delay_unit": "days"
    },
    {
      "step_order": 3,
      "name": "Reminder call day before",
      "type": "call",
      "priority": "high",
      "delay_value": 1,
      "delay_unit": "days"
    }
  ]
}
```

**Validation Rules:**

- `name`: Required, 3-100 characters
- `description`: Optional, max 1000 characters
- `tags`: Optional array of strings
- `steps`: Required, 1-50 steps
- `steps[].step_order`: Must be sequential (1, 2, 3...)
- `steps[].name`: Required, 3-100 characters
- `steps[].type`: Required, one of: `internal_activity`, `social_message`, `text`, `email`, `call`
- `steps[].priority`: Optional, one of: `low`, `medium`, `high` (default: `medium`)
- `steps[].delay_value`: Required, >= 0
- `steps[].delay_unit`: Required, one of: `minutes`, `hours`, `days`

**Response:** `201 Created`

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "organisation_id": "660e8400-e29b-41d4-a716-446655440001",
  "created_by": "770e8400-e29b-41d4-a716-446655440002",
  "name": "Demo Follow-up Sequence",
  "description": "7-step sequence for following up after demo bookings",
  "tags": ["demo", "follow-up"],
  "is_active": true,
  "usage_count": 0,
  "created_at": "2025-01-17T10:00:00Z",
  "updated_at": "2025-01-17T10:00:00Z",
  "sequence_steps": [
    {
      "id": "880e8400-e29b-41d4-a716-446655440003",
      "step_order": 1,
      "name": "Send demo confirmation email",
      "type": "email",
      "priority": "high",
      "delay_value": 0,
      "delay_unit": "days"
    },
    {
      "id": "990e8400-e29b-41d4-a716-446655440004",
      "step_order": 2,
      "name": "Prepare demo materials",
      "type": "internal_activity",
      "priority": "medium",
      "delay_value": 1,
      "delay_unit": "days"
    }
  ]
}
```

**Error Responses:**

- `400 Bad Request` - Validation errors
- `409 Conflict` - Template with same name already exists

---

### Update Sequence Template

**Endpoint:** `PATCH /sequence-templates/:id`

**Description:** Update template metadata (not steps - use step endpoints for that)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Template ID |

**Request Body:**

```json
{
  "name": "Updated Demo Follow-up Sequence",
  "description": "Updated description",
  "tags": ["demo", "follow-up", "updated"],
  "is_active": false
}
```

**Response:** `200 OK`

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Updated Demo Follow-up Sequence",
  "description": "Updated description",
  "tags": ["demo", "follow-up", "updated"],
  "is_active": false,
  "updated_at": "2025-01-17T10:30:00Z"
}
```

---

### Delete Sequence Template

**Endpoint:** `DELETE /sequence-templates/:id`

**Description:** Delete a template (blocked if active instances exist)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Template ID |

**Request Example:**

```http
DELETE /api/sequence-templates/550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response:** `204 No Content`

**Error Responses:**

- `403 Forbidden` - Cannot delete template with active instances
- `404 Not Found` - Template not found

---

### Duplicate Sequence Template

**Endpoint:** `POST /sequence-templates/:id/duplicate`

**Description:** Create a copy of an existing template

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Template ID to duplicate |

**Request Body:**

```json
{
  "name": "Copy of Demo Follow-up Sequence"
}
```

**Response:** `201 Created`

Returns the newly created template with all steps.

---

## Sequence Steps Endpoints

### Update Step

**Endpoint:** `PATCH /sequence-steps/:id`

**Description:** Update a single step

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Step ID |

**Request Body:**

```json
{
  "name": "Updated step name",
  "description": "Updated description",
  "delay_value": 2,
  "delay_unit": "hours"
}
```

**Response:** `200 OK`

```json
{
  "id": "880e8400-e29b-41d4-a716-446655440003",
  "sequence_template_id": "550e8400-e29b-41d4-a716-446655440000",
  "step_order": 1,
  "name": "Updated step name",
  "description": "Updated description",
  "delay_value": 2,
  "delay_unit": "hours",
  "updated_at": "2025-01-17T11:00:00Z"
}
```

---

### Delete Step

**Endpoint:** `DELETE /sequence-steps/:id`

**Description:** Delete a step and reorder remaining steps

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Step ID |

**Response:** `204 No Content`

**Note:** Remaining steps are automatically reordered.

---

### Reorder Steps

**Endpoint:** `POST /sequence-templates/:templateId/reorder`

**Description:** Reorder steps within a template

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `templateId` | UUID | Template ID |

**Request Body:**

```json
{
  "order": [
    { "id": "880e8400-e29b-41d4-a716-446655440003", "step_order": 2 },
    { "id": "990e8400-e29b-41d4-a716-446655440004", "step_order": 1 }
  ]
}
```

**Response:** `200 OK`

Returns array of updated steps in new order.

---

## Sequence Instances Endpoints

### List Sequence Instances

**Endpoint:** `GET /sequence-instances`

**Description:** Retrieve sequence instances with filtering

**Query Parameters:**

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `restaurant_id` | UUID | Filter by restaurant | `?restaurant_id=uuid` |
| `status` | string | Filter by status | `?status=active` |
| `assigned_to` | UUID | Filter by assigned user | `?assigned_to=uuid` |

**Request Example:**

```http
GET /api/sequence-instances?restaurant_id=abc123&status=active
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response:** `200 OK`

```json
{
  "data": [
    {
      "id": "bb0e8400-e29b-41d4-a716-446655440006",
      "sequence_template_id": "550e8400-e29b-41d4-a716-446655440000",
      "restaurant_id": "cc0e8400-e29b-41d4-a716-446655440007",
      "organisation_id": "660e8400-e29b-41d4-a716-446655440001",
      "name": "Demo Follow-up Sequence - Bella Pizza - 2025-01-17",
      "status": "active",
      "current_step_order": 3,
      "total_steps": 7,
      "assigned_to": "770e8400-e29b-41d4-a716-446655440002",
      "started_at": "2025-01-17T09:00:00Z",
      "created_at": "2025-01-17T09:00:00Z",
      "sequence_templates": {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "name": "Demo Follow-up Sequence"
      },
      "restaurants": {
        "id": "cc0e8400-e29b-41d4-a716-446655440007",
        "name": "Bella Pizza"
      },
      "progress": {
        "completed": 2,
        "total": 7,
        "percentage": 29
      }
    }
  ],
  "count": 1
}
```

---

### Get Sequence Instance

**Endpoint:** `GET /sequence-instances/:id`

**Description:** Get detailed sequence instance with all tasks

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Instance ID |

**Response:** `200 OK`

```json
{
  "id": "bb0e8400-e29b-41d4-a716-446655440006",
  "sequence_template_id": "550e8400-e29b-41d4-a716-446655440000",
  "restaurant_id": "cc0e8400-e29b-41d4-a716-446655440007",
  "name": "Demo Follow-up Sequence - Bella Pizza - 2025-01-17",
  "status": "active",
  "current_step_order": 3,
  "total_steps": 7,
  "assigned_to": "770e8400-e29b-41d4-a716-446655440002",
  "started_at": "2025-01-17T09:00:00Z",
  "sequence_templates": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Demo Follow-up Sequence"
  },
  "restaurants": {
    "id": "cc0e8400-e29b-41d4-a716-446655440007",
    "name": "Bella Pizza"
  },
  "tasks": [
    {
      "id": "dd0e8400-e29b-41d4-a716-446655440008",
      "name": "Send demo confirmation email",
      "status": "completed",
      "sequence_step_order": 1,
      "due_date": "2025-01-17T09:00:00Z",
      "completed_at": "2025-01-17T09:15:00Z",
      "created_at": "2025-01-17T09:00:00Z"
    },
    {
      "id": "ee0e8400-e29b-41d4-a716-446655440009",
      "name": "Prepare demo materials",
      "status": "completed",
      "sequence_step_order": 2,
      "due_date": "2025-01-18T09:15:00Z",
      "completed_at": "2025-01-18T10:00:00Z",
      "created_at": "2025-01-17T09:00:00Z"
    },
    {
      "id": "ff0e8400-e29b-41d4-a716-446655440010",
      "name": "Reminder call day before",
      "status": "active",
      "sequence_step_order": 3,
      "due_date": "2025-01-19T10:00:00Z",
      "completed_at": null,
      "created_at": "2025-01-17T09:00:00Z"
    },
    {
      "id": "000e8400-e29b-41d4-a716-446655440011",
      "name": "Conduct demo",
      "status": "pending",
      "sequence_step_order": 4,
      "due_date": null,
      "completed_at": null,
      "created_at": "2025-01-17T09:00:00Z"
    }
  ],
  "progress": {
    "completed": 2,
    "total": 7,
    "percentage": 29
  }
}
```

---

### Start Sequence

**Endpoint:** `POST /sequence-instances`

**Description:** Start a new sequence for a restaurant

**Request Body:**

```json
{
  "sequence_template_id": "550e8400-e29b-41d4-a716-446655440000",
  "restaurant_id": "cc0e8400-e29b-41d4-a716-446655440007",
  "assigned_to": "770e8400-e29b-41d4-a716-446655440002"
}
```

**Validation Rules:**

- `sequence_template_id`: Required, must exist and be active
- `restaurant_id`: Required, must exist
- `assigned_to`: Optional, defaults to current user
- Cannot start duplicate active sequence (same template + restaurant)

**Response:** `201 Created`

```json
{
  "id": "bb0e8400-e29b-41d4-a716-446655440006",
  "sequence_template_id": "550e8400-e29b-41d4-a716-446655440000",
  "restaurant_id": "cc0e8400-e29b-41d4-a716-446655440007",
  "name": "Demo Follow-up Sequence - Bella Pizza - 2025-01-17",
  "status": "active",
  "current_step_order": 1,
  "total_steps": 7,
  "tasks_created": 7,
  "started_at": "2025-01-17T09:00:00Z"
}
```

**Error Responses:**

- `400 Bad Request` - Validation errors
- `404 Not Found` - Template or restaurant not found
- `409 Conflict` - Active sequence already exists

---

### Pause Sequence

**Endpoint:** `PATCH /sequence-instances/:id/pause`

**Description:** Pause an active sequence

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Instance ID |

**Response:** `200 OK`

```json
{
  "id": "bb0e8400-e29b-41d4-a716-446655440006",
  "status": "paused",
  "paused_at": "2025-01-17T12:00:00Z"
}
```

**Error Responses:**

- `400 Bad Request` - Sequence not active
- `404 Not Found` - Instance not found

---

### Resume Sequence

**Endpoint:** `PATCH /sequence-instances/:id/resume`

**Description:** Resume a paused sequence

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Instance ID |

**Response:** `200 OK`

```json
{
  "id": "bb0e8400-e29b-41d4-a716-446655440006",
  "status": "active",
  "paused_at": null
}
```

---

### Cancel Sequence

**Endpoint:** `PATCH /sequence-instances/:id/cancel`

**Description:** Cancel a sequence (deletes pending tasks)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Instance ID |

**Response:** `200 OK`

```json
{
  "id": "bb0e8400-e29b-41d4-a716-446655440006",
  "status": "cancelled",
  "cancelled_at": "2025-01-17T13:00:00Z"
}
```

**Note:** Deletes all pending tasks. Active, completed, and cancelled tasks remain.

---

### Get Sequence Progress

**Endpoint:** `GET /sequence-instances/:id/progress`

**Description:** Get detailed progress information

**Response:** `200 OK`

```json
{
  "instance_id": "bb0e8400-e29b-41d4-a716-446655440006",
  "status": "active",
  "current_step": 3,
  "total_steps": 7,
  "progress": {
    "completed": 2,
    "active": 1,
    "pending": 4,
    "percentage": 29
  },
  "timeline": [
    {
      "step_order": 1,
      "name": "Send demo confirmation email",
      "status": "completed",
      "completed_at": "2025-01-17T09:15:00Z"
    },
    {
      "step_order": 2,
      "name": "Prepare demo materials",
      "status": "completed",
      "completed_at": "2025-01-18T10:00:00Z"
    },
    {
      "step_order": 3,
      "name": "Reminder call day before",
      "status": "active",
      "due_date": "2025-01-19T10:00:00Z"
    },
    {
      "step_order": 4,
      "name": "Conduct demo",
      "status": "pending",
      "due_date": null
    }
  ]
}
```

---

## Restaurant Sequences Endpoints

### Get Restaurant Sequences

**Endpoint:** `GET /restaurants/:restaurantId/sequences`

**Description:** Get all sequences for a specific restaurant

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `restaurantId` | UUID | Restaurant ID |

**Query Parameters:**

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `status` | string | Filter by status | `?status=active` |

**Response:** `200 OK`

```json
{
  "restaurant_id": "cc0e8400-e29b-41d4-a716-446655440007",
  "restaurant_name": "Bella Pizza",
  "sequences": [
    {
      "id": "bb0e8400-e29b-41d4-a716-446655440006",
      "name": "Demo Follow-up Sequence - Bella Pizza - 2025-01-17",
      "status": "active",
      "current_step_order": 3,
      "total_steps": 7,
      "progress": {
        "completed": 2,
        "total": 7,
        "percentage": 29
      },
      "started_at": "2025-01-17T09:00:00Z"
    }
  ],
  "count": 1
}
```

---

### Start Sequence for Restaurant

**Endpoint:** `POST /restaurants/:restaurantId/sequences/start`

**Description:** Start a sequence for a restaurant (convenience endpoint)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `restaurantId` | UUID | Restaurant ID |

**Request Body:**

```json
{
  "sequence_template_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response:** `201 Created`

Same as `POST /sequence-instances`

---

## Error Responses

### Standard Error Format

All errors follow this format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {
      "field": "field_name",
      "value": "invalid_value"
    }
  }
}
```

### Error Codes

| HTTP Status | Error Code | Description |
|-------------|------------|-------------|
| 400 | `VALIDATION_ERROR` | Invalid request data |
| 401 | `UNAUTHORIZED` | Missing or invalid authentication |
| 403 | `PERMISSION_DENIED` | User lacks permission |
| 404 | `NOT_FOUND` | Resource not found |
| 409 | `CONFLICT` | Resource conflict (duplicate) |
| 500 | `INTERNAL_ERROR` | Server error |

### Example Error Responses

**400 Bad Request - Validation Error:**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Step orders must be sequential",
    "details": {
      "field": "steps[1].step_order",
      "value": 3,
      "expected": 2
    }
  }
}
```

**404 Not Found:**

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Sequence template not found",
    "details": {
      "resource": "sequence_template",
      "id": "550e8400-e29b-41d4-a716-446655440000"
    }
  }
}
```

**409 Conflict:**

```json
{
  "error": {
    "code": "CONFLICT",
    "message": "An active sequence already exists for this restaurant using this template",
    "details": {
      "restaurant_id": "cc0e8400-e29b-41d4-a716-446655440007",
      "template_id": "550e8400-e29b-41d4-a716-446655440000",
      "existing_sequence_id": "bb0e8400-e29b-41d4-a716-446655440006"
    }
  }
}
```

---

## Rate Limiting

### Limits

| Endpoint Type | Limit | Window |
|---------------|-------|--------|
| Read (GET) | 1000 requests | 15 minutes |
| Write (POST/PATCH/DELETE) | 200 requests | 15 minutes |
| Start Sequence | 50 requests | 15 minutes |

### Rate Limit Headers

All responses include rate limit headers:

```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1642425600
```

### Rate Limit Exceeded Response

**429 Too Many Requests:**

```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please try again later.",
    "details": {
      "limit": 1000,
      "window": "15 minutes",
      "reset_at": "2025-01-17T10:15:00Z"
    }
  }
}
```

---

## Testing with cURL

### Example: Create Template

```bash
curl -X POST http://localhost:3007/api/sequence-templates \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Demo Follow-up",
    "description": "Follow-up sequence for demos",
    "tags": ["demo"],
    "steps": [
      {
        "step_order": 1,
        "name": "Send confirmation",
        "type": "email",
        "priority": "high",
        "delay_value": 0,
        "delay_unit": "days"
      },
      {
        "step_order": 2,
        "name": "Follow-up call",
        "type": "call",
        "priority": "medium",
        "delay_value": 3,
        "delay_unit": "days"
      }
    ]
  }'
```

### Example: Start Sequence

```bash
curl -X POST http://localhost:3007/api/sequence-instances \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sequence_template_id": "550e8400-e29b-41d4-a716-446655440000",
    "restaurant_id": "cc0e8400-e29b-41d4-a716-446655440007"
  }'
```

---

**End of API Specification Document**

For frontend component specifications, see [ui-components.md](ui-components.md).
