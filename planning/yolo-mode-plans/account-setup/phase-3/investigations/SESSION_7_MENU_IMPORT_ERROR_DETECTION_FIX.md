# Session 7: Menu Import Error Detection Fix

**Date:** 2026-01-08
**Status:** Ready for Implementation
**Priority:** P1 - Critical Bug Fix

---

## Problem Statement

During Step 6 batch registration with three restaurants, two of the three failed their menu CSV uploads. However, **the failures were incorrectly marked as "completed"**, causing:

1. `context.menuImportSucceeded` was set to `true` despite actual failures
2. Phase 3 (optionSets) and Phase 4 (itemTags) proceeded when they should have been skipped
3. User had to manually close Playwright browsers to stop the scripts

This is a **critical bug** that breaks the entire error handling and retry logic implemented in Sessions 1-6.

---

## Root Cause Analysis

### Issue 1: Script Doesn't Exit with Error Code

**File:** `scripts/restaurant-registration/import-csv-menu.js`

The script only calls `process.exit(1)` in ONE specific case (file upload error at line 610). For most failures:

```javascript
// Line 620-626 - Outer catch block
} catch (error) {
  console.error('\n❌ Import failed:', error.message);  // Logs error
  await takeScreenshot(page, 'error-state');
  // BUT DOES NOT EXIT(1) - just falls through to finally block!
} finally {
  // Script ends normally with exit code 0
}
```

### Issue 2: Success Message Printed Regardless of Actual Success

Even when CloudWaitress rejects the import, the script prints success indicators:

```javascript
// Line 594-599 - Success check is weak
const successIndicator = page.locator('text=/Success|Imported|Complete/i').first();
if (await successIndicator.count() > 0) {
  console.log('  ✅ CSV import completed successfully!');
} else {
  console.log('  ⚠️ Import status unclear - check screenshot');
  // CONTINUES EXECUTION - doesn't throw!
}

// Line 613 - ALWAYS prints this regardless of above check
console.log('\n✅ CSV IMPORT PROCESS COMPLETED!');
```

### Issue 3: Route Uses Weak String Matching for Success

**File:** `UberEats-Image-Extractor/src/routes/registration-routes.js` (lines 916-919)

```javascript
const success = stdout.includes('CSV import completed successfully') ||
               stdout.includes('✅') ||  // Matches completion message even on failure!
               stdout.includes('Successfully imported') ||
               stdout.includes('Import completed');
```

The `✅` in `CSV IMPORT PROCESS COMPLETED!` triggers false success detection.

---

## CloudWaitress Blocking Issue

The secondary issue (to investigate after error detection is fixed) is that CloudWaitress appears to be blocking or rate-limiting CSV uploads. This manifests as:
- Upload appears to work but no success indicator shown
- Multiple restaurants failing simultaneously
- Possible CAPTCHA or rate limit challenge

This should be investigated **after** proper error detection is in place so we can see the actual error messages.

---

## Implementation Plan

### Task 1: Fix Script Exit Codes (P1)

**File:** `scripts/restaurant-registration/import-csv-menu.js`

Add explicit exit codes and failure detection:

```javascript
// After line 598 - Make "unclear" status a failure
if (await successIndicator.count() > 0) {
  console.log('  ✅ CSV import completed successfully!');
} else {
  // Check for explicit error messages
  const errorIndicator = page.locator('text=/Error|Failed|Invalid|Blocked|limit/i').first();
  if (await errorIndicator.count() > 0) {
    const errorText = await errorIndicator.textContent();
    console.error(`  ❌ Import failed with error: ${errorText}`);
    process.exit(1);
  }
  console.error('  ❌ Import status unclear - no success indicator found');
  process.exit(1);  // Treat unclear as failure
}

// After line 620 - Add exit in outer catch
} catch (error) {
  console.error('\n❌ Import failed:', error.message);
  await takeScreenshot(page, 'error-state');
  process.exit(1);  // ADD THIS
} finally {
```

### Task 2: Improve Success Detection in Route (P1)

**File:** `UberEats-Image-Extractor/src/routes/registration-routes.js`

Update the success detection logic:

```javascript
// Line 915-925 - More precise success detection
// Check for explicit failure first
const failureIndicators = [
  'Import failed',
  '❌',
  'Error:',
  'FAILED',
  'status unclear'
];
const hasFailed = failureIndicators.some(indicator => stdout.includes(indicator));

if (hasFailed) {
  throw new Error(`CSV import failed: ${stdout.substring(stdout.lastIndexOf('❌'))}`);
}

// Then check for explicit success
const success = stdout.includes('CSV import completed successfully') &&
               !stdout.includes('status unclear');
```

### Task 3: Add Exit Code Handling (P1)

**File:** `UberEats-Image-Extractor/src/routes/registration-routes.js`

The `execAsync` call should check the exit code:

```javascript
// execAsync throws on non-zero exit code, but let's be explicit
try {
  const { stdout, stderr } = await execAsync(command, {
    env: { ...process.env, DEBUG_MODE: 'false', HEADLESS: 'false' },
    timeout: 120000
  });
  // ... success handling
} catch (execError) {
  // execAsync throws if exit code !== 0
  console.error('[CSV Upload] Script exited with error:', execError.message);
  throw new Error(`CSV import script failed: ${execError.stderr || execError.message}`);
}
```

### Task 4: Add Retry-Safe Error Messages (P2)

Ensure error messages are captured in the sub-step progress for debugging:

**File:** `UberEats-Image-Extractor/src/services/registration-batch-service.js`

In `executeSubStepInternal()`, ensure the full error details are stored:

```javascript
// Around line 1980 - when handling API response
if (!response.success) {
  throw new Error(response.error || response.message || 'Sub-step failed without details');
}
```

---

## Testing Checklist

- [ ] Run import-csv-menu.js manually with an invalid CSV → should exit(1)
- [ ] Run import-csv-menu.js with valid CSV but blocked by CloudWaitress → should exit(1)
- [ ] Run batch with 3 restaurants, 1 fails menu import → only that job should show menuImport as failed
- [ ] Failed menuImport → optionSets and itemTags should be skipped (not attempted)
- [ ] Resume functionality works correctly after menuImport failure

---

## Files to Modify

| File | Priority | Changes |
|------|----------|---------|
| `scripts/restaurant-registration/import-csv-menu.js` | P1 | Add exit(1) in outer catch, treat unclear status as failure |
| `UberEats-Image-Extractor/src/routes/registration-routes.js` | P1 | Improve success detection, check for failure indicators first |
| `UberEats-Image-Extractor/src/services/registration-batch-service.js` | P2 | Ensure error messages are captured properly |

---

## Secondary Investigation (After Error Detection Fixed)

Once error detection is working, investigate why CloudWaitress is blocking:

1. Check if there's a rate limit being hit
2. Check for CAPTCHA challenges
3. Check if session/cookie handling is failing
4. Review CloudWaitress admin for any blocking indicators

---

*Plan created: 2026-01-08*
