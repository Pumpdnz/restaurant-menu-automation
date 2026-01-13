# Investigation Task 3: Backend Endpoints Analysis

## Overview
Complete documentation of all registration-related API endpoints for Yolo Mode orchestration.

---

## Endpoint Summary

| Endpoint | Method | Feature Flag | Timeout |
|----------|--------|--------------|---------|
| `/api/registration/register-account` | POST | registration.userAccountRegistration | - |
| `/api/registration/register-restaurant` | POST | registration.restaurantRegistration | 3min |
| `/api/registration/status/:restaurantId` | GET | registration | - |
| `/api/registration/upload-csv-menu` | POST | registration.menuUploading | 2min |
| `/api/registration/import-menu-direct` | POST | registration.menuUploading | 2min |
| `/api/registration/generate-code-injections` | POST | registration.codeInjection | 2min |
| `/api/registration/configure-website` | POST | registration.websiteSettings | 3min |
| `/api/registration/configure-payment` | POST | registration.stripePayments | 3min |
| `/api/registration/configure-services` | POST | registration.servicesConfiguration | 3min |
| `/api/registration/add-item-tags` | POST | registration.itemTagUploading | 3min |
| `/api/registration/add-option-sets` | POST | registration.optionSetUploading | 5min |
| `/api/registration/create-onboarding-user` | POST | registration.onboardingUserManagement | 2min |
| `/api/registration/update-onboarding-record` | POST | registration.onboardingSync | - |
| `/api/registration/setup-system-settings` | POST | registration.finalisingSetup | 3min |
| `/api/registration/create-api-key` | POST | None | 3min |
| `/api/registration/configure-uber-integration` | POST | None | 5min |

---

## Detailed Endpoint Documentation

### 1. POST `/api/registration/register-account`

**Purpose:** Register new Pumpd user account via CloudWaitress API

**Request:**
```json
{
  "restaurantId": "uuid (required)",
  "email": "string (optional)",
  "password": "string (optional)",
  "phone": "string (optional)"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Account registered successfully",
  "account_id": "string",
  "email": "string",
  "alreadyExists": false
}
```

---

### 2. POST `/api/registration/register-restaurant`

**Purpose:** Register restaurant on Pumpd via Playwright automation

**Request:**
```json
{
  "restaurantId": "uuid (required)",
  "registrationType": "new_account_with_restaurant | existing_account_first_restaurant | existing_account_additional_restaurant",
  "email": "string",
  "password": "string",
  "restaurantName": "string",
  "address": "string",
  "phone": "string",
  "hours": "object",
  "city": "string",
  "cuisine": "string"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Restaurant registered successfully",
  "restaurant": {
    "registration_status": "completed",
    "pumpd_subdomain": "string",
    "dashboard_url": "https://admin.pumpd.co.nz/restaurants/{subdomain}"
  }
}
```

---

### 3. POST `/api/registration/upload-csv-menu`

**Purpose:** Upload CSV menu to Pumpd

**Request:** `multipart/form-data`
- `csvFile`: File (required, .csv, max 10MB)
- `restaurantId`: string (required)

**Response:**
```json
{
  "success": true,
  "message": "Menu imported successfully",
  "details": "string",
  "output": "string"
}
```

---

### 4. POST `/api/registration/import-menu-direct`

**Purpose:** Import menu without file upload (generates CSV internally)

**Request:**
```json
{
  "restaurantId": "uuid (required)",
  "menuId": "uuid (required)"
}
```

**Response:** Same as upload-csv-menu

---

### 5. POST `/api/registration/generate-code-injections`

**Purpose:** Generate HTML head/body injection files

**Request:**
```json
{
  "restaurantId": "uuid (required)",
  "noGradient": "boolean (optional)"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Code injections generated successfully",
  "filePaths": {
    "headInjection": "/path/to/head-injection.html",
    "bodyInjection": "/path/to/body-injection.html",
    "configuration": "/path/to/configuration.json"
  }
}
```

---

### 6. POST `/api/registration/configure-website`

**Purpose:** Apply code injections and configure website theme

**Request:**
```json
{
  "restaurantId": "uuid (required)",
  "filePaths": {
    "headInjection": "string (required)",
    "bodyInjection": "string (required)"
  },
  "headerConfig": {
    "enabled": "boolean",
    "backgroundSource": "string"
  },
  "itemsConfig": {
    "layout": "list | card"
  },
  "textColorConfig": {
    "navText": "string",
    "boxText": "string"
  },
  "navLogoTintConfig": {
    "darkColor": "string | null",
    "lightColor": "string | null"
  },
  "headerLogoTintConfig": {
    "darkColor": "string | null",
    "lightColor": "string | null"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Website configured successfully",
  "output": "string"
}
```

---

### 7. POST `/api/registration/configure-payment`

**Purpose:** Configure Stripe payments

**Request:**
```json
{
  "restaurantId": "uuid (required)",
  "includeConnectLink": "boolean (default: false)"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Payments configured successfully",
  "stripeConnectUrl": "string (if includeConnectLink=true)"
}
```

---

### 8. POST `/api/registration/configure-services`

**Purpose:** Configure delivery services

**Request:**
```json
{
  "restaurantId": "uuid (required)"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Services configured successfully"
}
```

---

### 9. POST `/api/registration/add-item-tags`

**Purpose:** Add tags to menu items

**Request:**
```json
{
  "restaurantId": "uuid (required)"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Item tags configured successfully"
}
```

---

### 10. POST `/api/registration/add-option-sets`

**Purpose:** Add option sets to menu items

**Request:**
```json
{
  "restaurantId": "uuid (required)",
  "menuId": "uuid (required)"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Option sets configured successfully",
  "summary": {
    "total": 10,
    "created": 8,
    "failed": 2
  }
}
```

---

### 11. POST `/api/registration/create-onboarding-user`

**Purpose:** Create user in onboarding system

**Request:**
```json
{
  "userName": "string (required)",
  "userEmail": "string (required)",
  "userPassword": "string (optional - auto-generated)",
  "restaurantId": "uuid (optional)"
}
```

**Response:**
```json
{
  "success": true,
  "userName": "string",
  "userEmail": "string",
  "passwordGenerated": true
}
```

---

### 12. POST `/api/registration/update-onboarding-record`

**Purpose:** Sync restaurant data to onboarding database

**Request:**
```json
{
  "userEmail": "string (required)",
  "restaurantId": "uuid (required)",
  "contactPerson": "string (optional)",
  "updates": {
    "stripeConnectUrl": "string (optional)"
  }
}
```

**Response:**
```json
{
  "success": true,
  "onboardingId": "string",
  "updatedFields": 5
}
```

---

### 13. POST `/api/registration/setup-system-settings`

**Purpose:** Configure GST, pickup times, receipt logo

**Request:**
```json
{
  "restaurantId": "uuid (required)",
  "receiptLogoVersion": "string (optional - field name like 'logo_favicon_url')"
}
```

**Response:**
```json
{
  "success": true,
  "message": "System settings configured successfully",
  "hasGst": true,
  "webhookConfigured": true
}
```

---

## Authentication & Middleware

All endpoints require:
1. `authMiddleware` - User authentication
2. `requireRegistration` - Base registration feature enabled
3. Individual feature flag middleware (see table above)

---

## Recommendation: Frontend vs Backend Orchestration

### Use Frontend Orchestration (Recommended)

**Reasons:**
1. Endpoints already implement individual steps correctly
2. Parallel execution manageable with Promise.all()
3. Feature flags need UI-level checking anyway
4. Progressive error handling easier for user experience
5. Users can see step-by-step progress
6. Minimal changes needed - reuse existing handlers
7. Can cancel/pause mid-flow

### If Backend Orchestration Needed Later

Create new endpoint:
```
POST /api/registration/execute-workflow
{
  "restaurantId": "uuid",
  "steps": ["register_account", "register_restaurant", ...],
  "skipSteps": [],
  "parallelizeSteps": true
}
```

---

## Rate Limiting Considerations

- **No explicit rate limiting** on registration endpoints
- **File upload limit**: 10MB max for CSV
- **Concurrent script execution**: Not limited but may cause resource contention
- **Recommendation**: Execute parallel operations in batches of 3-4 max

---

## Execution Order for Yolo Mode

```
Phase 1 (Parallel):
├── POST /register-account
├── POST /generate-code-injections
├── POST /create-onboarding-user (if enabled)
└── POST /menus/:id/upload-images (if menu exists)

Phase 2 (After Phase 1):
├── POST /register-restaurant
├── POST /configure-website
├── POST /configure-payment
├── POST /configure-services
└── POST /update-onboarding-record (if enabled)

Phase 3 (After Restaurant Registered):
├── POST /upload-csv-menu OR /import-menu-direct
└── POST /setup-system-settings

Phase 4 (After Menu Imported):
└── POST /add-option-sets

Phase 5 (After Option Sets):
└── POST /add-item-tags

Phase 6 (Final):
├── POST /create-api-key
└── POST /configure-uber-integration
```
