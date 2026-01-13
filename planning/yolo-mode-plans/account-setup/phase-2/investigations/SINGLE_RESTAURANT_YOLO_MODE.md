# Single-Restaurant YOLO Mode Execution Investigation

**Date:** 2024-12-23
**Status:** Investigation Complete
**Conclusion:** Frontend-driven, ephemeral execution - CANNOT survive user navigation

---

## Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────┐
│                    RestaurantDetail.jsx                             │
│  (Component Lifecycle - stays alive until user navigates away)      │
└────────────────┬──────────────────────────────────────────────────┘
                 │
                 │ onClick: setYoloModeOpen(true)
                 ▼
┌──────────────────────────────────────────────────────────────────┐
│               YoloModeDialog.tsx (Frontend)                       │
│  - State: viewMode ('form' | 'progress')                         │
│  - State: formData (configuration)                               │
│  - Calls executeYoloMode() from hook on "Execute Full Setup"     │
└──────────────┬──────────────────────────────────────────────────┘
               │
               │ await executeYoloMode(formData, restaurant, restaurantId)
               ▼
┌──────────────────────────────────────────────────────────────────┐
│         useYoloModeExecution Hook (Frontend State Manager)        │
│                                                                   │
│  - abortControllerRef: manages Promise cancellation              │
│  - stepResults: tracks status of 12 steps in React state         │
│  - executionStatus: 'idle' | 'running' | 'completed' | 'failed'  │
│  - currentPhase: 'phase1' | 'phase2' | 'phase3' | 'phase4'       │
│                                                                   │
│  - setStepResults() → updates React state → triggers re-render   │
│  - cancelExecution() → abortControllerRef.current.abort()        │
└──────────────┬──────────────────────────────────────────────────┘
               │
               │ api.post() / railwayApi.post() [axios]
               ▼
┌──────────────────────────────────────────────────────────────────┐
│              Backend API Routes (server.js:3007)                 │
│                                                                   │
│  PHASE 1 (runs in parallel):                                     │
│  - POST /registration/register-account                           │
│  - POST /api/registration/generate-code-injections               │
│  - POST /api/registration/create-onboarding-user (optional)      │
│  - POST /menus/:menuId/upload-images (async with polling)        │
│                                                                   │
│  PHASE 2a (depends on account registration):                     │
│  - POST /api/registration/register-restaurant (uses Playwright)  │
│                                                                   │
│  PHASE 2b (parallel with menu chain):                            │
│  - POST /api/registration/configure-website (Playwright)         │
│  - POST /api/registration/configure-services                     │
│  - POST /api/registration/configure-payment                      │
│  - POST /registration/update-onboarding-record (optional)        │
│                                                                   │
│  Menu Chain (sequential):                                        │
│  - POST /api/registration/import-menu-direct                     │
│  - POST /api/registration/add-option-sets (if enabled)           │
│  - POST /api/registration/add-item-tags (if enabled)             │
└──────────────────────────────────────────────────────────────────┘
```

---

## Key Findings

### 1. Where is the execution logic?

**Finding:** The execution is **primarily frontend-controlled** but backend-heavy.

| Location | File | Purpose |
|----------|------|---------|
| Frontend execution | `src/hooks/useYoloModeExecution.ts` | Orchestrates 12 steps |
| Trigger | `src/components/registration/YoloModeDialog.tsx:336` | Calls executeYoloMode() |
| Backend endpoints | `src/routes/registration-routes.js` | Playwright automation |

The hook manages execution flow orchestration, but each step makes API calls to the backend which executes Playwright browser automation scripts.

---

### 2. Is execution frontend or backend controlled?

**Finding:** **Hybrid model - Frontend orchestrates, Backend executes long-running operations**

**Frontend Control (useYoloModeExecution hook):**
- Initiates each step sequentially or in parallel based on dependencies
- Tracks progress in React state (`stepResults`, `executionStatus`)
- Manages retries with exponential backoff (up to 3 attempts per step)
- Uses `AbortController` to cancel pending promises

**Backend Control:**
- Each API endpoint runs Playwright scripts that take 2-5 minutes
- These scripts are **fire-and-forget** (no long-polling)
- Backend processes run to completion independently of frontend

**Critical Issue:**
```javascript
// useYoloModeExecution.ts line 132
abortControllerRef.current = new AbortController();

// Lines 239-241: Check cancellation
if (abortControllerRef.current?.signal.aborted) {
  throw new Error('Execution cancelled');
}
```

The `AbortController` only affects pending **JavaScript promises** at the frontend level, NOT the backend Playwright processes. Once an API call is made, the backend continues running regardless.

---

### 3. What is the execution lifecycle?

**Finding:** Complex multi-phase orchestration with dependency management

**Step Execution Pattern:**

```
PHASE 1 (0-5 min, parallel):
├─ Step 1: Account Registration (if enabled) → BLOCKS Phase 2a
├─ Step 2: Code Generation → Needed for Step 6 (Website Config)
├─ Step 3: Onboarding User (if enabled) → Optional
└─ Step 4: Image Upload (async polling) → Needed for Step 9 (Menu Import)

PHASE 2a (5-10 min, depends on Step 1):
└─ Step 5: Restaurant Registration → BLOCKS Steps 6,7,8

PHASE 2b (10-15 min, parallel with Menu Chain):
├─ Step 6: Website Configuration (needs Step 2) → NON-BLOCKING
├─ Step 7: Services Configuration → NON-BLOCKING
├─ Step 8: Payment Configuration → NON-BLOCKING
├─ Step 9: Onboarding Sync (if enabled) → NON-BLOCKING
│
└─ Menu Chain (sequential, parallel to 6-9):
   ├─ Step 10: Menu Import (if enabled) → BLOCKS Steps 11,12
   ├─ Step 11: Option Sets (if enabled) → Only if Step 10 succeeds
   └─ Step 12: Item Tags (if enabled) → Only if Step 10 succeeds

PHASE 3 (15-20 min, depends on Step 10):
└─ Option Sets Configuration (included as Step 11)

PHASE 4 (20-25 min, depends on Step 10):
└─ Item Tags Configuration (included as Step 12)
```

**Total execution time:** 20-30 minutes for full setup

**Retry Logic:**
```javascript
// Lines 88-110: Exponential backoff with 3 attempts
for (let attempt = 1; attempt <= 3; attempt++) {
  try {
    updateStatus(stepName, { status: 'running' | 'retrying', retryCount });
    const result = await apiCall();
    updateStatus(stepName, { status: 'completed', result });
    return { success: true, result };
  } catch (error) {
    // Wait 1s, 2s, 4s before retry
    await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)));
  }
}
```

---

### 4. Can execution survive navigation?

**Finding:** **NO - Execution dies if dialog closes or user navigates away**

**Evidence:**

1. **AbortController is cleared on dialog close:**
```javascript
// YoloModeDialog.tsx lines 372-378
const handleClose = () => {
  if (isExecuting) {
    cancelExecution();  // Calls abortControllerRef.current.abort()
  }
  onOpenChange(false);  // Closes dialog
};
```

2. **State is local to component:**
```javascript
// useYoloModeExecution.ts lines 69-70
const [stepResults, setStepResults] = useState<Record<string, StepResult>>({});
const abortControllerRef = useRef<AbortController | null>(null);
```
When component unmounts (dialog closes), the state is lost.

3. **No database persistence of execution state** - Progress is only tracked in React state, not persisted to Supabase.

4. **No polling mechanism to check for ongoing execution** - Dialog doesn't query backend to see what's still running.

**What happens if user closes dialog while executing:**
```
Time: 0:00 - User clicks "Execute Full Setup"
Time: 0:05 - Phase 1 completes, Phase 2a (restaurant registration) starts
Time: 0:15 - User clicks X to close dialog while restaurant registration is running
         → abortController.abort() is called
         → Frontend promise is cancelled
         → Dialog closes
         → Component unmounts
         → React state is lost
Time: 3:00 - Backend Playwright script STILL running, finishes successfully
         → Restaurant IS registered in Pumpd
         → Frontend has no idea
         → User can manually refresh to see changes
```

---

### 5. State management and persistence

**Finding:** **Zero persistence - completely frontend-driven**

**Current Architecture:**
```javascript
// Hook state - LOST on unmount
const [isExecuting, setIsExecuting] = useState(false);
const [executionStatus, setExecutionStatus] = useState<ExecutionStatus>('idle');
const [stepResults, setStepResults] = useState<Record<string, StepResult>>({});
const abortControllerRef = useRef<AbortController | null>(null);
```

**What's NOT tracked:**
- No `execution_logs` table entry created at the start
- No step-by-step progress written to database
- No `registration_status` updated until specific endpoints complete
- No way for another user session to see execution progress
- No way to resume interrupted execution

---

## Critical Limitations

1. **No async job persistence**
   - No `execution_job` table to track long-running processes
   - No way to resume interrupted execution
   - No ability to check status from another browser tab/window

2. **Frontend promise cancellation doesn't stop backend**
   - Calling `abortController.abort()` only cancels the JavaScript promise
   - Playwright scripts continue running on server
   - Backend API endpoints have no knowledge of cancellation

3. **No webhook or socket updates**
   - Frontend receives step updates via `setStepResults()`
   - No server-push notifications if dialog closes
   - User must manually refresh to see completion

4. **Playwright scripts are blocking**
   - Each script (e.g., `login-and-register-restaurant.js`) runs to completion
   - Takes 2-5 minutes per step
   - Cannot be interrupted mid-execution

5. **API timeout configuration**
   - `railwayApi.timeout: 1200000` (20 minutes)
   - Allows for long-running Playwright scripts
   - But if browser closes, request is abandoned

---

## Failure Modes

**If dialog closes during Step 5 (Restaurant Registration):**
- Frontend aborts promise
- React state is cleared
- Playwright script continues on backend (2-5 minutes)
- Restaurant IS registered when script completes
- Frontend has zero visibility
- User sees no error but no success either

**If user navigates away during execution:**
- Component unmounts immediately
- Hook cleanup doesn't trigger (no cleanup function)
- Backend operations continue independently
- Browser may cancel in-flight HTTP requests depending on timing
- Database end state depends on what completed vs. what was in-flight

---

## Conclusion

**Current YOLO Mode Execution is FRONTEND-DRIVEN and EPHEMERAL:**

- Closing the dialog **cancels the frontend coordination** but **backend operations continue**
- This can result in **inconsistent state** (partial registration without feedback)
- Navigating away has similar effect - backend continues, frontend forgets
- The `AbortController` is **not effective** for actually stopping backend processes
- There is **no persistence** of execution state to allow resumption or status checking

---

## File Locations Summary

| File | Purpose | Lines |
|------|---------|-------|
| `src/hooks/useYoloModeExecution.ts` | Execution orchestration hook | 1-635 |
| `src/components/registration/YoloModeDialog.tsx` | Dialog UI and execution trigger | 251-548 |
| `src/pages/RestaurantDetail.jsx` | Dialog instantiation | 9929-9997 |
| `src/routes/registration-routes.js` | Backend API endpoints | Multiple |
| `src/services/api.js` | Axios instances (api + railwayApi) | 30-49 |
