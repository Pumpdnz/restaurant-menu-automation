# Session 7: Menu Import Error Detection Fix

**Date:** 2026-01-11
**Focus:** Fixing silent failures in CSV menu import where failed uploads were incorrectly marked as successful

---

## Problem Statement

During batch registration with multiple restaurants:
- 2 of 3 restaurants **failed their menu CSV uploads** to CloudWaitress
- BUT the `menuImport` sub-step was incorrectly marked as **"completed"**
- This caused `optionSets` and `itemTags` to execute when they should have been skipped
- User had to manually close Playwright browsers to stop the scripts

### Root Causes Identified

| Issue | Location | Problem |
|-------|----------|---------|
| Script didn't exit with error code | `import-csv-menu.js` outer catch | Logged error but fell through to finally (exit 0) |
| "Unclear" status treated as success | `import-csv-menu.js` line ~598 | Just logged warning, didn't fail |
| Success message printed regardless | `import-csv-menu.js` line ~613 | `✅ CSV IMPORT PROCESS COMPLETED!` always printed |
| Route used weak string matching | `registration-routes.js` line ~917 | Matched any `✅` in output |
| Route didn't extract error from failed scripts | `registration-routes.js` catch blocks | Didn't access `error.stdout` |

---

## Changes Implemented

### Task 1: Fixed Script Exit Codes in `import-csv-menu.js`

**Pattern Change:** Replaced `process.exit(1)` inside async functions with `throw` + top-level `.catch()` handler.

#### Success Detection Logic (lines 593-612)

**Before:**
```javascript
const successIndicator = page.locator('text=/Success|Imported|Complete/i').first();
if (await successIndicator.count() > 0) {
  console.log('  ✅ CSV import completed successfully!');
} else {
  console.log('  ⚠️ Import status unclear - check screenshot');
}
```

**After:**
```javascript
// Check for explicit error messages first
const errorIndicator = page.locator('text=/Error|Failed|Invalid|Blocked|limit|rejected/i').first();
if (await errorIndicator.count() > 0) {
  const errorText = await errorIndicator.textContent().catch(() => 'Unknown error');
  console.error(`  ❌ Import rejected: ${errorText}`);
  await takeScreenshot(page, 'error-import-failed');
  throw new Error('CloudWaitress rejected import');
}

// No error message = success (CloudWaitress closes modal on success without explicit message)
console.log('  ✅ CSV import completed successfully!');
```

**Key insight:** CloudWaitress doesn't show explicit "Success" text - it just closes the modal. Success = no error message after upload.

#### Inner Catch Block (lines 607-614)

**After:**
```javascript
} catch (error) {
  if (!error.message.includes('rejected')) {
    console.error('  ❌ File upload failed:', error.message);
    await takeScreenshot(page, 'error-file-upload');
  }
  throw error;  // Re-throw to propagate to outer handler
}
```

#### Outer Catch Block (lines 623-631)

**After:**
```javascript
} catch (error) {
  console.error('\n❌ CSV IMPORT FAILED:', error.message);
  try {
    await takeScreenshot(page, 'error-state');
    console.error('  URL:', page.url());
  } catch (screenshotError) {
    // Ignore screenshot errors
  }
  throw error;  // Re-throw to top-level handler
}
```

#### Script Runner (lines 648-652)

**After:**
```javascript
// Run the import
importCSVMenu().catch((error) => {
  console.error('Script failed:', error.message);
  process.exit(1);
});
```

---

### Task 2: Fixed Success Detection in `registration-routes.js`

#### CSV Upload Endpoint - Failure Detection Added (lines 915-941)

**New code added BEFORE success check:**
```javascript
// Check for failure indicators FIRST (before success patterns)
const failed = stdout.includes('CSV IMPORT FAILED') ||
               stdout.includes('Import failed') ||
               stdout.includes('rejected') ||
               stderr.includes('FAILED');

if (failed) {
  console.error('[CSV Upload] Script reported failure');
  // Extract error details from output
  const errorMatch = stdout.match(/❌ CSV IMPORT FAILED[:\s]*(.+?)(?:\n|$)/);
  const errorDetail = errorMatch ? errorMatch[1] : 'Unknown error';

  // Clean up file before returning error
  if (csvFile?.path) {
    try {
      await fs.unlink(csvFile.path);
    } catch (unlinkError) {
      console.error('[CSV Upload] Failed to clean up file:', unlinkError);
    }
  }

  return res.status(500).json({
    success: false,
    error: `Menu import failed: ${errorDetail}`,
    details: stdout.substring(stdout.lastIndexOf('❌'))
  });
}
```

#### Success Patterns Simplified (lines 943-945)

**Before:**
```javascript
const success = stdout.includes('CSV import completed successfully') ||
               stdout.includes('✅') ||
               stdout.includes('Successfully imported') ||
               stdout.includes('Import completed');
```

**After:**
```javascript
const success = stdout.includes('CSV import completed successfully') ||
               stdout.includes('CSV IMPORT PROCESS COMPLETED');
```

---

### Task 3: Enhanced Catch Blocks to Extract Script Output

#### CSV Upload Endpoint Catch Block (lines 977-1012)

**Before:**
```javascript
} catch (error) {
  console.error('[CSV Upload] Error:', error);
  // ... cleanup ...
  res.status(500).json({
    success: false,
    error: error.message,
    details: error.stderr || null
  });
}
```

**After:**
```javascript
} catch (error) {
  console.error('[CSV Upload] Error:', error.message);
  // Log stdout/stderr from failed script execution
  if (error.stdout) console.error('[CSV Upload] Script stdout:', error.stdout);
  if (error.stderr) console.error('[CSV Upload] Script stderr:', error.stderr);

  // ... cleanup ...

  // Extract meaningful error from script output if available
  let errorMessage = error.message;
  if (error.stdout) {
    const failMatch = error.stdout.match(/❌ CSV IMPORT FAILED[:\s]*(.+?)(?:\n|$)/);
    if (failMatch) {
      errorMessage = `Menu import failed: ${failMatch[1]}`;
    }
  }

  res.status(500).json({
    success: false,
    error: isTimeout ? 'Upload timed out...' : errorMessage,
    details: error.stdout?.substring(error.stdout.lastIndexOf('❌')) || error.stderr || null
  });
}
```

#### Direct Import Endpoint Catch Block (lines 1158-1182)

Same pattern applied - extracts `error.stdout` and `error.stderr` from failed script execution and parses meaningful error message.

---

## Files Modified

| File | Changes |
|------|---------|
| `scripts/restaurant-registration/import-csv-menu.js` | Changed error handling pattern to throw + `.catch()`, check for errors before success, exit with code 1 on any failure |
| `UberEats-Image-Extractor/src/routes/registration-routes.js` | Added failure detection FIRST, simplified success patterns, enhanced catch blocks to extract `error.stdout` |

---

## Key Technical Findings

### 1. `process.exit(1)` Unreliable in Async Functions

`process.exit(1)` doesn't work reliably inside async functions with try-finally blocks. The finally block executes before the exit, potentially masking the exit code.

**Solution:** Use `throw` to propagate errors up to a top-level `.catch()` handler that calls `process.exit(1)`.

### 2. CloudWaitress Success Detection

CloudWaitress doesn't show explicit "Success" text after CSV upload - it just closes the modal. Therefore:
- **Success** = No error message visible after upload
- **Failure** = Error message visible (Error, Failed, Invalid, Blocked, limit, rejected)

### 3. `execAsync` Error Object Structure

When `child_process.exec` fails (non-zero exit code), the error object includes:
- `error.stdout` - stdout from the process
- `error.stderr` - stderr from the process
- `error.message` - "Command failed: ..."
- `error.code` - exit code
- `error.killed` - true if process was killed (timeout)

---

## Exit Code Matrix

| Scenario | Exit Code | Error Pattern |
|----------|-----------|---------------|
| Explicit error indicator found | 1 | `❌ CSV IMPORT FAILED: CloudWaitress rejected import` |
| File upload exception | 1 | `❌ CSV IMPORT FAILED: <error.message>` |
| Outer catch (unhandled error) | 1 | `❌ CSV IMPORT FAILED: <error.message>` |
| Success (no errors visible) | 0 | `✅ CSV IMPORT PROCESS COMPLETED!` |

---

## Testing Results

| Scenario | Exit Code | Detection |
|----------|-----------|-----------|
| Valid CSV upload | 0 | Correctly marked as success |
| Invalid CSV format (CloudWaitress rejects) | 1 | Correctly marked as failed |
| Wrong password | 1 | Correctly marked as failed |
| No restaurant | 1 | Correctly marked as failed |
| Browser closed | 1 | Correctly marked as failed |

---

## Relationship to Previous Sessions

This fix builds on:
- **Session 6** - Manual sub-step status editing with phase cascading
- **Phase D** - Context variable persistence (`menuImportSucceeded` flag)

With this fix, the `menuImport` sub-step now correctly reports failures, which:
1. Sets `context.menuImportSucceeded = false`
2. Causes Phase 3 (optionSets) and Phase 4 (itemTags) to be skipped automatically
3. Allows proper Resume functionality from the correct phase

---

## Next Steps (Post Session 7)

1. **Monitor** batch registrations for correct error detection
2. **Investigate** root cause of CloudWaitress rejections (rate limiting, CAPTCHA, session issues)
3. **Consider** adding retry logic for transient CloudWaitress failures

---

*Session completed: 2026-01-11*
