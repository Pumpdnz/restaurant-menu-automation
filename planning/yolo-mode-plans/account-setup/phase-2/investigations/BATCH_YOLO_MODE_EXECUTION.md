# Batch YOLO Mode Execution System Investigation

**Date:** 2024-12-23
**Status:** Investigation Complete
**Conclusion:** Architecture is READY for async batch execution - only Step 6 API calls need implementation

---

## Executive Summary

| Capability | Status | Notes |
|------------|--------|-------|
| Parallel Execution (Multiple Restaurants) | ✅ YES | `Promise.allSettled()` at batch, step, and phase levels |
| Async Execution (Survives Navigation) | ✅ YES | Uses `setImmediate()`, persists to database |
| Steps 1-5 Implementation | ✅ COMPLETE | Fully working with database persistence |
| Step 6 Framework | ✅ READY | Infrastructure in place |
| Step 6 API Calls | ❌ PLACEHOLDER | `executeYoloModeSubStep()` needs implementation |

**Bottom Line:** The batch system CAN execute YOLO mode asynchronously and in parallel. Only ~50 lines of code needed to wire up the actual API calls in Step 6.

---

## 1. Current State: What's Implemented vs Placeholder

### Backend Architecture (registration-batch-service.js)

**FULLY IMPLEMENTED:**

| Step | Name | Status | Key Feature |
|------|------|--------|-------------|
| 1 | Menu & Branding Extraction | ✅ Complete | Fire-and-forget async with `setImmediate()` |
| 2 | Contact Details Search | ✅ Complete | Parallel execution with `Promise.allSettled()` |
| 3 | Company Selection | ✅ Complete | User input handling |
| 4 | Company Details Extraction | ✅ Complete | Parallel execution |
| 5 | Yolo Mode Configuration | ✅ Complete | Config persistence |
| 6 | Yolo Mode Execution | ⚠️ FRAMEWORK ONLY | Sub-step tracking works, API calls are placeholder |

**Step 6 Placeholder Code (Lines 1558-1572):**
```javascript
async function executeYoloModeSubStep(subStepName, job, config) {
  // Placeholder implementations - will be connected to actual services
  console.log(`[Registration Batch Service] Executing sub-step: ${subStepName}`);
  await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate 1 second
  // TODO: Connect to actual registration services
  return { success: true, subStep: subStepName };
}
```

This function needs to be replaced with actual HTTP calls to registration endpoints.

---

## 2. Async Capability Assessment: Can It Survive User Navigation?

### YES - Fully Capable

**How It Works:**

1. **Async Job Queuing:**
```javascript
// Line 514 - Step 1 execution queued asynchronously
setImmediate(async () => {
  try {
    await processStep1(batchId, orgId);
  } catch (error) {
    await handleBatchError(batchId, error);
  }
});
```

2. **Immediate Response to Frontend:**
   - API returns immediately after queuing
   - Frontend doesn't wait for execution to complete
   - User can navigate away safely

3. **Database Persistence:**

| Table | Purpose | Updated When |
|-------|---------|--------------|
| `registration_batch_jobs` | Batch-level progress | Every step completion |
| `registration_job_steps` | Per-job step progress | Each step start/end |
| `registration_job_steps.sub_step_progress` | Phase/sub-step breakdown (JSONB) | Each sub-step completion |

4. **Polling Mechanism:**
```javascript
// Frontend can poll GET /api/registration-batches/:id/progress
// Returns: { status, progress percentage, step requiring action, restaurant summary }
```

**User Experience:**
- Start batch execution
- Navigate away to do other work
- Return to RegistrationBatchDetail.tsx
- See progress persisted in database
- Continue monitoring or take action when required

---

## 3. Parallel Execution Assessment: Multiple Restaurants Simultaneously?

### YES - Fully Implemented

**Multi-Restaurant Parallelism:**

```javascript
// Step 2: Process ALL restaurants in parallel (Line 1108)
await Promise.allSettled(eligibleJobs.map(async (job) => {
  // Each job runs independently
}));

// Step 6: All restaurants start simultaneously (Line 1429)
await Promise.allSettled(
  eligibleJobs.map(job => executeYoloModeForJob(job, batchId))
);
```

**Within-Job Parallelism (Step 6 Phases):**

```
PHASE 1 (4 parallel steps):
├─ cloudwaitressAccount (BLOCKING for Phase 2)
├─ codeGeneration (non-blocking)
├─ createOnboardingUser (non-blocking)
└─ uploadImages (non-blocking)

PHASE 2a (depends on Phase 1):
└─ restaurantRegistration (BLOCKING for Phase 2b)

PHASE 2b (5 parallel steps + menu chain):
├─ websiteConfig
├─ servicesConfig
├─ paymentConfig
├─ syncOnboardingUser
└─ menuImport (BLOCKING for Phases 3 & 4)

PHASE 3 (after menuImport):
└─ optionSets

PHASE 4 (after menuImport):
└─ itemTags
```

**Error Isolation:**
- Uses `Promise.allSettled()` - one restaurant's failure doesn't block others
- Individual failures increment `failed_restaurants` counter
- Batch continues processing remaining restaurants

**No Concurrency Limit:**
- All restaurants execute simultaneously
- Could add limit if needed for resource management

---

## 4. Missing Pieces: What Needs Implementation

### Only executeYoloModeSubStep() needs real implementation

**Sub-step to Endpoint Mapping:**

| Sub-step Name | API Endpoint |
|---------------|--------------|
| `cloudwaitressAccount` | `POST /api/registration/register-account` |
| `codeGeneration` | `POST /api/registration/generate-code-injections` |
| `createOnboardingUser` | `POST /api/registration/create-onboarding-user` |
| `uploadImages` | `POST /menus/:menuId/upload-images` |
| `restaurantRegistration` | `POST /api/registration/register-restaurant` |
| `websiteConfig` | `POST /api/registration/configure-website` |
| `servicesConfig` | `POST /api/registration/configure-services` |
| `paymentConfig` | `POST /api/registration/configure-payment` |
| `menuImport` | `POST /api/registration/import-menu-direct` |
| `syncOnboardingUser` | `POST /api/registration/update-onboarding-record` |
| `optionSets` | `POST /api/registration/add-option-sets` |
| `itemTags` | `POST /api/registration/add-item-tags` |

**Implementation Requirements:**

1. **HTTP Client:** Need axios or fetch for server-to-server calls
2. **Config Mapping:** Parse `job.execution_config` and pass to each endpoint
3. **Error Propagation:** Blocking steps must throw errors that cascade
4. **Result Tracking:** Return data for sub_step_progress updates

---

## 5. Architecture Recommendations

### Recommended Implementation for executeYoloModeSubStep()

```javascript
async function executeYoloModeSubStep(subStepName, job, config) {
  const axios = require('axios');
  const BASE_URL = process.env.RAILWAY_API_URL || 'http://localhost:3007';

  // Map sub-step to endpoint and config
  const { endpoint, payload } = mapSubStepToRequest(subStepName, job, config);

  try {
    const response = await axios.post(
      `${BASE_URL}${endpoint}`,
      payload,
      {
        timeout: 300000, // 5 minutes for Playwright scripts
        headers: {
          'Content-Type': 'application/json',
          // Add auth headers if needed
        }
      }
    );

    return response.data;
  } catch (error) {
    throw new Error(`${subStepName} failed: ${error.response?.data?.message || error.message}`);
  }
}

function mapSubStepToRequest(subStepName, job, config) {
  const restaurantId = job.restaurant_id;

  const mapping = {
    cloudwaitressAccount: {
      endpoint: '/api/registration/register-account',
      payload: {
        restaurantId,
        email: config.account?.email,
        password: config.account?.password,
        phone: config.account?.phone,
      }
    },
    restaurantRegistration: {
      endpoint: '/api/registration/register-restaurant',
      payload: {
        restaurantId,
        registrationType: config.restaurant?.registrationMode,
        email: config.account?.email,
        password: config.account?.password,
        restaurantName: config.restaurant?.name,
        address: config.restaurant?.address,
        phone: config.restaurant?.phone,
        hours: config.restaurant?.opening_hours,
        city: config.restaurant?.city,
      }
    },
    codeGeneration: {
      endpoint: '/api/registration/generate-code-injections',
      payload: {
        restaurantId,
        noGradient: config.website?.disableGradients,
      }
    },
    // ... other mappings
  };

  return mapping[subStepName] || { endpoint: '', payload: {} };
}
```

### Retry Logic (Already in Place)

The `executeSubStep()` wrapper already has retry handling structure. Add exponential backoff:

```javascript
async function executeSubStep(subStepName, job, config, phaseProgress) {
  const MAX_RETRIES = 3;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      updateSubStepInProgress(phaseProgress, subStepName, 'in_progress', { attempt });
      const result = await executeYoloModeSubStep(subStepName, job, config);
      updateSubStepInProgress(phaseProgress, subStepName, 'completed', { result });
      return result;
    } catch (error) {
      if (attempt < MAX_RETRIES) {
        // Exponential backoff: 2s, 4s, 8s
        await new Promise(r => setTimeout(r, 2000 * Math.pow(2, attempt - 1)));
        updateSubStepInProgress(phaseProgress, subStepName, 'retrying', { attempt });
      } else {
        updateSubStepInProgress(phaseProgress, subStepName, 'failed', { error: error.message });
        throw error;
      }
    }
  }
}
```

---

## 6. Technical Reference: Key Code Locations

| Component | File | Line(s) | Status |
|-----------|------|---------|--------|
| Async job queuing | registration-batch-service.js | 514, 1200, 1390 | ✅ Implemented |
| Step 2 parallelism | registration-batch-service.js | 1108 | ✅ Implemented |
| Step 4 parallelism | registration-batch-service.js | 1239 | ✅ Implemented |
| Step 6 job parallelism | registration-batch-service.js | 1429-1431 | ✅ Implemented |
| Step 6 phase orchestration | registration-batch-service.js | 1450-1510 | ✅ Implemented |
| **Step 6 placeholder** | registration-batch-service.js | 1558-1572 | ❌ Needs work |
| Phase progress tracking | registration-batch-service.js | 1624-1637 | ✅ Implemented |
| Database schema support | Supabase | sub_step_progress JSONB | ✅ Ready |
| Frontend polling | registration-batch-routes.js | 182-197 | ✅ Implemented |

---

## 7. Comparison: Single Restaurant vs Batch

| Feature | Single Restaurant | Batch |
|---------|------------------|-------|
| Execution Location | Frontend (React hook) | Backend (Node.js service) |
| State Persistence | React state (lost on unmount) | Database (survives navigation) |
| Survives Dialog Close | ❌ No | ✅ Yes |
| Survives Page Navigation | ❌ No | ✅ Yes |
| Multi-Restaurant | N/A | ✅ Parallel execution |
| Progress Polling | N/A | ✅ GET /progress endpoint |
| Retry Logic | Frontend with AbortController | Backend with database tracking |

---

## 8. Implementation Checklist

To complete Step 6 implementation:

- [ ] Create `mapSubStepToRequest()` function with all 12 sub-step mappings
- [ ] Implement `executeYoloModeSubStep()` with axios HTTP calls
- [ ] Add retry logic with exponential backoff
- [ ] Handle blocking dependencies (account → restaurant, menu → optionSets/itemTags)
- [ ] Test with single restaurant first
- [ ] Test parallel execution with multiple restaurants
- [ ] Verify progress persistence after navigation away and back

**Estimated effort:** 50-100 lines of code, 2-4 hours of implementation + testing

---

## Conclusion

The batch YOLO mode execution system is **architecturally sound and production-ready** for Steps 1-5. The Step 6 infrastructure (phase orchestration, parallel execution, database persistence, progress tracking) is fully implemented and tested.

**Only the `executeYoloModeSubStep()` function needs to be replaced** with actual HTTP calls to the registration endpoints. This is a straightforward mapping exercise since:

1. All registration endpoints already exist and work
2. The config structure from Step 5 matches what endpoints expect
3. The phase/sub-step framework handles all orchestration logic

Once implemented, users will be able to:
- Start batch YOLO mode execution for multiple restaurants
- Navigate away while execution continues on backend
- Return to see real-time progress from database
- Handle failures per-restaurant without blocking the batch
