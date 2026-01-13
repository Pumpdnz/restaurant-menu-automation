# Session 2: Timeout Configuration & Batch Mode Fixes

**Date:** 2026-01-02
**Focus:** Fixing timeout issues for large menus and batch registration compatibility

---

## Issues Fixed

### 1. Option Sets Script Timeout

#### 1.1 Script Execution Timeout Too Short
**Problem:** Option sets script was timing out for restaurants with large menus (70+ option sets). The script was killed after 20 minutes.

**Error:**
```
[Option Sets] Error: Command failed: node "add-option-sets.js" --payload="..."
killed: true
```

**Fix:** Tripled the script execution timeout from 20 minutes to 60 minutes:
```javascript
timeout: 3600000 // 60 minute timeout (tripled for large menus with many option sets)
```

**File:** `UberEats-Image-Extractor/src/routes/registration-routes.js` (line 3207)

---

### 2. Batch Registration Service Timeouts

#### 2.1 Axios Request Timeout for Sub-Steps
**Problem:** The batch registration service's axios timeout for sub-step API calls was only 5 minutes, causing option sets to fail in batch mode.

**Error:**
```
[Registration Batch Service] Sub-step optionSets failed: timeout of 300000ms exceeded
```

**Fix:** Increased axios timeout from 5 minutes to 60 minutes:
```javascript
timeout: 3600000 // 60 minutes timeout for Playwright scripts (option sets can take very long for large menus)
```

**File:** `UberEats-Image-Extractor/src/services/registration-batch-service.js` (line 2004)

---

#### 2.2 Null Batch ID Handling
**Problem:** `incrementBatchProgress()` was being called with `null` batch ID for single-restaurant YOLO mode, causing UUID parse errors.

**Error:**
```
[incrementBatchProgress.read(batch=null, type=completed)] Database operation failed: 22P02: invalid input syntax for type uuid: "null"
```

**Fix:** Added early return for null batch ID:
```javascript
async function incrementBatchProgress(batchId, type) {
  if (!batchId) {
    return; // Skip for single-restaurant mode
  }
  // ...
}
```

**File:** `UberEats-Image-Extractor/src/services/registration-batch-service.js` (lines 772-775)

---

#### 2.3 Invalid Column Name in Error Handling
**Problem:** Code was trying to write to `last_failure` column which doesn't exist in `registration_job_steps` table.

**Error:**
```
Could not find the 'last_failure' column of 'registration_job_steps' in the schema cache
```

**Fix:** Changed `last_failure` to `error_details` (the actual JSONB column):
- Line 1828: `error_details: { ... }`
- Line 2398: `error_details: { ... }`

**File:** `UberEats-Image-Extractor/src/services/registration-batch-service.js`

---

### 3. Frontend API Timeout

#### 3.1 Railway API Instance Timeout
**Problem:** Frontend `railwayApi` axios instance had 20-minute timeout, but backend operations can now take up to 60 minutes.

**Fix:** Increased timeout from 20 minutes to 60 minutes:
```javascript
const railwayApi = axios.create({
  baseURL: import.meta.env.VITE_RAILWAY_API_URL || 'http://localhost:3007',
  timeout: 3600000, // 60 minutes - for Playwright scripts (option sets can take very long for large menus)
});
```

**File:** `UberEats-Image-Extractor/src/services/api.js` (line 41)

---

### 4. Frontend Polling Timeout

#### 4.1 YOLO Mode Polling Duration
**Problem:** Frontend polling would timeout after 30 minutes, but operations can now take up to 60 minutes.

**Fix:** Increased max polling duration from 30 minutes to 90 minutes:
```javascript
const MAX_POLL_DURATION = 90 * 60 * 1000; // 90 minutes (option sets can take 60+ minutes for large menus)
```

**File:** `UberEats-Image-Extractor/src/hooks/useYoloModeExecution.ts` (line 45)

---

## Timeout Configuration Summary

After this session, all timeout configurations are now aligned:

| Component | Location | Timeout | Purpose |
|-----------|----------|---------|---------|
| Script execution | registration-routes.js:3207 | 60 min | execAsync for add-option-sets.js |
| Batch sub-step axios | registration-batch-service.js:2004 | 60 min | API calls to Playwright endpoints |
| Frontend railwayApi | api.js:41 | 60 min | Long-running frontend requests |
| Frontend polling | useYoloModeExecution.ts:45 | 90 min | Progress polling duration |

---

## Files Modified

| File | Changes |
|------|---------|
| `src/routes/registration-routes.js` | Script timeout: 20min → 60min |
| `src/services/registration-batch-service.js` | Axios timeout: 5min → 60min, null batch ID handling, column name fix |
| `src/services/api.js` | railwayApi timeout: 20min → 60min |
| `src/hooks/useYoloModeExecution.ts` | Polling duration: 30min → 90min |

---

## Configurations Not Changed

The following timeouts were reviewed but left unchanged as they're appropriate for their use cases:

| Configuration | Value | Reason |
|---------------|-------|--------|
| Firecrawl extraction timeouts | 90-180 sec | Quick extraction operations |
| Companies Office batch service | 2.5 min | Extraction operations |
| Individual Playwright page timeouts | 10-60 sec | Per-action timeouts within scripts |

---

## Testing Notes

To test large menu option sets:
1. Find a restaurant with 50+ option sets
2. Run YOLO mode or batch registration
3. Monitor logs for "Creating option set X/Y" progress
4. Verify script completes without timeout errors

Example restaurant tested: **Chicken Wicken** (73 option sets)

---

## Related to Session 1

This session builds on Session 1's fixes:
- Session 1 fixed resume functionality and database schema issues
- Session 2 ensures long-running operations complete without timeout errors

Both sessions together enable reliable single-restaurant YOLO mode execution with resume capability for large menus.
