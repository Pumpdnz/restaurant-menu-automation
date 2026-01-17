# TASK 5: Error Handling & Retry Investigation

**Investigation Date**: December 9, 2025  
**Status**: COMPLETED  
**Investigator**: Claude Code Analysis

## Executive Summary

The codebase demonstrates a basic error handling and logging infrastructure for async job execution through Playwright-based automation scripts. However, there are significant gaps in retry logic implementation, orphan job recovery, and comprehensive error classification. Current implementation relies on:

- **Database-driven state tracking** (pumpd_accounts, pumpd_restaurants, registration_logs)
- **Timeout-based error detection** (hardcoded timeouts ranging from 120-300 seconds)
- **Simple error incrementing** (retry_count and error_count fields)
- **Incomplete error classification** (no distinction between retryable vs fatal errors)
- **No automatic job recovery** for orphaned jobs after process crashes

## Question Answers

### 1. What types of errors can occur during script execution?

Based on investigation of registration routes and automation scripts, the following error types occur:

#### Network/Timeout Errors
- **Process Timeouts**: `ETIMEDOUT` error code (see registration-routes.js line 938, 1203, 1504)
- **Page Navigation Timeouts**: `waitForURL()`, `waitForSelector()` timeout exceptions
- **API Call Failures**: CloudWaitress API integration errors (lines 210-286)
- **Network Connectivity Issues**: Browser connection failures during automation

#### Validation Errors
- **Input Validation**: Missing required parameters (email, password, restaurant name)
- **File Validation**: Missing CSV files, HTML injection files not found (lines 1175-1183)
- **Database Constraint Violations**: Unique constraint failures on email/subdomain
- **Invalid Credentials**: Password format checks, email format validation

#### Application/Logic Errors
- **Script Execution Failures**: Playwright script crashes or unexpected DOM states
- **Database Errors**: Supabase query failures, permission/RLS policy violations
- **File System Errors**: Missing directories, permission denied on file operations
- **State Conflicts**: Restaurant already registered, account already exists

#### Execution-Specific Errors
- **Process Killed**: `error.killed === true` (line 1503) indicating SIGTERM/SIGKILL
- **Partial Execution**: Process terminated mid-execution leaving inconsistent state
- **Resource Exhaustion**: Browser process failures, memory issues
- **Downstream Service Failures**: CloudWaitress API unavailable, external API timeouts

### 2. Which errors are recoverable (should retry)?

**RETRYABLE ERRORS** (should be automatically retried):

1. **Timeout Errors** (currently checked at lines 938, 1203, 1504)
   - Process timeouts
   - Playwright action timeouts
   - Network timeouts
   - Strategy: Exponential backoff with max 3 attempts

2. **Transient Network Errors**
   - Temporary API unavailability
   - Browser connection timeouts
   - CloudWaitress API 5xx errors
   - Strategy: Exponential backoff, max 3 attempts

3. **Throttling/Rate Limit Errors**
   - Dashboard rate limiting
   - Playwright browser pool exhaustion
   - External API rate limits
   - Strategy: Exponential backoff with jitter, max 5 attempts

4. **Process Killed Errors** (partially recoverable)
   - If partial success detected in stdout (line 1510)
   - Resume from last known successful step
   - Strategy: Check `partialSuccess` flag before retry

**NON-RETRYABLE ERRORS** (fatal, should not retry):

1. **Validation Errors**
   - Missing required parameters
   - Invalid email format
   - File not found (except on temporary filesystem issues)
   - Bad CSV format
   - Resolution: Require user correction

2. **Authentication/Authorization Errors**
   - Invalid login credentials
   - Wrong admin password
   - Insufficient permissions
   - Resolution: Require credential update

3. **Data Integrity Errors**
   - Unique constraint violations (duplicate email/subdomain)
   - Foreign key constraint failures
   - Database RLS policy violations
   - Resolution: Manual intervention or data cleanup

4. **Configuration Errors**
   - Invalid CloudWaitress API configuration
   - Missing environment variables
   - Invalid HTML injection file format
   - Resolution: Configuration fix required

5. **Permanent State Errors**
   - Already registered account (line 153-158)
   - Restaurant already exists
   - Incompatible registration type
   - Resolution: Handle gracefully, return success

### 3. How should failed jobs be reported to users?

Current implementation uses:
- **Registration logs table** (`registration_logs`) with action/status/error_message fields
- **HTTP error responses** with status codes and error messages
- **Database status fields** (registration_status: 'failed', last_error, error_count)
- **Logging to console** with prefixed tags like `[Registration]`, `[CSV Upload]`

**Recommended reporting strategy**:

#### For Immediate User Feedback
1. **HTTP Response with Classification**:
   ```javascript
   {
     success: false,
     error: "Human-readable error message",
     errorCode: "TIMEOUT|INVALID_INPUT|AUTH_FAILED|API_ERROR",
     errorType: "RETRYABLE|FATAL",
     details: "Additional technical details",
     suggestedAction: "Please try again|Update credentials|Contact support"
   }
   ```

2. **Timeout-Specific Messaging** (line 942-943):
   ```
   "Upload timed out. The menu may be too large or the server may be busy. Please try again."
   ```

3. **Partial Success Reporting** (line 1521):
   ```
   "Configuration timed out. Partial configuration was applied (head code added). 
    Last successful step: STEP 5. Please try running again to complete."
   ```

#### For Job Status Tracking
1. **Job History API** - Similar to `/logs/:restaurantId` endpoint (line 741-776)
   - Retrieve full registration_logs for restaurant
   - Filter by action and date range
   - Show status progression and error messages

2. **Job Status Polling**
   - Endpoint to get current registration_status (line 50-101)
   - Return last_error field for failed jobs
   - Return retry_count for visibility

3. **Webhook Notifications** (not implemented)
   - Notify on job completion/failure
   - Include error classification and retry status
   - Allow external error handling

#### For Operational Monitoring
1. **Error Metrics**
   - Aggregate errors by type and status
   - Track retry success rates
   - Monitor timeout incidents

2. **User Dashboard Display**
   - Show registration status with last error
   - Display retry count and next retry time
   - Provide manual retry button for retryable errors

### 4. Should there be automatic cleanup of old jobs?

**CRITICAL NEED**: Yes, automatic cleanup is essential.

Current state: **NO automatic cleanup implemented**

**Why cleanup is needed**:
1. **Database bloat**: registration_logs table grows unbounded (100+ entries per restaurant)
2. **Performance degradation**: Large tables slow down queries, especially with order by created_at
3. **Storage costs**: Supabase billing includes storage usage
4. **Debugging difficulty**: Old logs clutter error investigation

**Recommended cleanup strategy**:

#### Retention Policies
```
- SUCCESS logs: Keep for 90 days
- FAILED logs: Keep for 180 days (longer for debugging)
- STARTED logs (orphaned): Delete after 7 days
```

#### Cleanup Methods

**Option 1: Database Trigger (Recommended)**
```sql
-- Cleanup old successful registration logs
DELETE FROM registration_logs 
WHERE status = 'success' 
AND created_at < NOW() - INTERVAL '90 days'
AND id NOT IN (
  -- Keep one success per action per restaurant
  SELECT DISTINCT ON (restaurant_id, action) id
  FROM registration_logs
  WHERE status = 'success'
  ORDER BY restaurant_id, action, created_at DESC
);

-- Cleanup old failed logs (keep longer for investigation)
DELETE FROM registration_logs 
WHERE status = 'failed' 
AND created_at < NOW() - INTERVAL '180 days';

-- Cleanup orphaned started logs
DELETE FROM registration_logs 
WHERE status = 'started' 
AND created_at < NOW() - INTERVAL '7 days';
```

**Option 2: Scheduled Job (pg_cron)**
```sql
-- Run daily at 2 AM UTC
SELECT cron.schedule('cleanup-registration-logs', '0 2 * * *', $$
  DELETE FROM registration_logs 
  WHERE (status = 'success' AND created_at < NOW() - INTERVAL '90 days')
     OR (status = 'failed' AND created_at < NOW() - INTERVAL '180 days')
     OR (status = 'started' AND created_at < NOW() - INTERVAL '7 days');
$$);
```

**Option 3: Application-Level Cleanup**
- Implement cleanup endpoint in registration-routes.js
- Call after job completion
- Batch cleanup in background worker

#### Archive Strategy
- Export old logs to cold storage (S3) before deletion
- Maintain 12-month archive for audit/compliance
- Keep pointers to archived logs in database

### 5. What about orphaned jobs (server restart during execution)?

**CRITICAL ISSUE**: Orphaned job recovery NOT implemented

Current vulnerabilities (from code analysis):

1. **Line 1123-1131**: Code generation spawns detached process without tracking
   ```javascript
   const child = spawn('node', args, {
     detached: true,
     stdio: 'ignore'
   });
   child.unref(); // No tracking mechanism
   ```

2. **Line 601-604**: Restaurant registration executes with timeout
   ```javascript
   const { stdout, stderr } = await execAsync(command, {
     timeout: 180000 // 3 minute timeout - what if server crashes?
   });
   ```

3. **Database state** shows `registration_status: 'in_progress'` (line 513) with no recovery mechanism

**Types of orphaned jobs**:

1. **STARTED Status Orphans**
   - registration_logs with status='started' and created_at > 6 hours
   - No corresponding job in memory
   - No process ID tracked
   - Result: Job looks "in progress" forever

2. **IN_PROGRESS Status Orphans**
   - pumpd_restaurants with registration_status='in_progress' > 24 hours
   - registration_logs show no recent updates
   - Process crashed or server restarted
   - Result: Restaurant appears stuck in registration

3. **DETACHED PROCESS Orphans**
   - Code generation spawns (line 1123-1131)
   - Process runs in background detached from parent
   - Parent crashes before completion
   - Result: Unknown process state, no cleanup

**Recovery approach**:

#### 1. Database-Driven Recovery (Recommended)

Create recovery view for orphaned jobs:
```sql
-- Find orphaned jobs (status='in_progress' with no recent logs)
CREATE VIEW orphaned_jobs AS
SELECT 
  r.id,
  r.organisation_id,
  r.restaurant_id,
  r.registration_status,
  r.updated_at,
  EXTRACT(EPOCH FROM (NOW() - r.updated_at))/3600 as hours_stale,
  rl.id as last_log_id,
  rl.created_at as last_log_time
FROM pumpd_restaurants r
LEFT JOIN registration_logs rl ON r.id = rl.pumpd_restaurant_id
WHERE r.registration_status IN ('in_progress', 'started')
  AND r.updated_at < NOW() - INTERVAL '1 hour'
GROUP BY r.id, rl.id
HAVING COUNT(rl.id) <= 1; -- No new logs in last hour
```

Recovery endpoint:
```javascript
router.post('/recover-orphaned-jobs', async (req, res) => {
  // Find orphaned jobs from view
  const { data: orphaned } = await supabase
    .from('orphaned_jobs')
    .select('*')
    .gt('hours_stale', 1); // > 1 hour stale

  // For each orphaned job:
  // 1. Log recovery attempt
  // 2. Set status back to 'pending' 
  // 3. Increment error_count
  // 4. Clear last_error (fresh start)
  // 5. Trigger retry with exponential backoff
});
```

#### 2. Process Tracking (For future implementations)

Track spawned processes:
```javascript
// Track process ID for recovery
const jobRegistry = new Map(); // In-memory or Redis

const processId = uuid();
jobRegistry.set(processId, {
  type: 'registration',
  restaurantId: restaurantId,
  startTime: Date.now(),
  process: child
});

// On graceful shutdown:
process.on('SIGTERM', async () => {
  for (const [id, job] of jobRegistry) {
    if (Date.now() - job.startTime < 30 * 60 * 1000) { // < 30 minutes
      // Kill process and mark job for recovery
      job.process.kill();
      await markJobForRecovery(id);
    }
  }
});

// On startup: recover jobs from registry
loadOrphanedJobsFromRegistry();
```

#### 3. Heartbeat Mechanism

Add periodic updates during long-running jobs:
```javascript
// Every 10 seconds during job execution
const heartbeatInterval = setInterval(async () => {
  await supabase
    .from('pumpd_restaurants')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', pumpdRestaurant.id);
}, 10000);

// Clear on completion
clearInterval(heartbeatInterval);
```

#### 4. Job Recovery Strategy on Startup

```javascript
// Run on server startup
async function recoverOrphanedJobs() {
  // Find jobs stuck in 'in_progress' for > 1 hour
  const { data: orphaned } = await supabase
    .from('pumpd_restaurants')
    .select('*')
    .eq('registration_status', 'in_progress')
    .lt('updated_at', new Date(Date.now() - 60 * 60 * 1000).toISOString());

  for (const job of orphaned) {
    // Option 1: Retry from scratch
    await supabase
      .from('pumpd_restaurants')
      .update({
        registration_status: 'pending',
        error_count: (job.error_count || 0) + 1,
        last_error: 'Job recovery after crash'
      })
      .eq('id', job.id);

    // Option 2: Mark for manual review
    // await escalateToOperations(job);
  }
}

recoverOrphanedJobs();
```

---

## Error Classification Table

| Error Category | Error Type | Code | Retryable | Max Attempts | Backoff Strategy | User Message |
|---|---|---|---|---|---|---|
| **Timeout** | Process Timeout | ETIMEDOUT | YES | 3 | Exponential (1s, 2s, 4s) | "Request timed out. Retrying..." |
| **Timeout** | Page Navigation Timeout | TIMEOUT | YES | 3 | Exponential | "Dashboard loading slow. Retrying..." |
| **Network** | Connection Refused | ECONNREFUSED | YES | 5 | Exponential with jitter | "Connection failed. Retrying..." |
| **Network** | API Error 5xx | API_5XX | YES | 5 | Exponential | "Service temporarily unavailable" |
| **Network** | Rate Limit 429 | RATE_LIMIT | YES | 5 | Exponential with jitter | "Too many requests. Waiting..." |
| **Validation** | Missing Parameter | MISSING_PARAM | NO | 0 | N/A | "Required field missing" |
| **Validation** | Invalid Email | INVALID_EMAIL | NO | 0 | N/A | "Invalid email format" |
| **Validation** | File Not Found | ENOENT | NO* | 1 | N/A | "File not found" |
| **Auth** | Invalid Credentials | AUTH_FAILED | NO | 0 | N/A | "Login failed. Check credentials" |
| **Auth** | Permission Denied | PERM_DENIED | NO | 0 | N/A | "You don't have permission" |
| **Database** | Unique Constraint | UNIQUE_VIOLATION | NO | 0 | N/A | "This entry already exists" |
| **Database** | Foreign Key Violation | FK_VIOLATION | NO | 0 | N/A | "Invalid reference" |
| **Database** | RLS Policy Violation | RLS_VIOLATION | NO | 0 | N/A | "Access denied" |
| **State** | Already Registered | STATE_CONFLICT | NO | 0 | N/A | "Already registered" |
| **State** | Partial Execution | PARTIAL_SUCCESS | YES* | 1 | Resume | "Resuming from last step..." |
| **Process** | Process Killed | SIGTERM | YES | 3 | Exponential | "Process interrupted. Retrying..." |
| **Resource** | Memory Exhausted | ENOMEM | YES | 2 | Long backoff (exponential) | "Server busy. Please wait..." |

*File Not Found: Retryable if timeout-related (flaky filesystem), not retryable if permanently missing
*Partial Execution: Retryable only if last successful step is verifiable

---

## Proposed Retry Strategy

### Implementation Structure

```javascript
// Retry configuration
const RETRY_CONFIG = {
  // Error-specific max attempts
  TIMEOUT: { maxAttempts: 3, backoff: 'exponential' },
  NETWORK: { maxAttempts: 5, backoff: 'exponential-jitter' },
  RATE_LIMIT: { maxAttempts: 5, backoff: 'exponential-jitter' },
  PARTIAL_SUCCESS: { maxAttempts: 1, backoff: 'none', resume: true },
  PROCESS_KILLED: { maxAttempts: 3, backoff: 'exponential' },
  
  // Global defaults
  DEFAULT_BACKOFF: 'exponential',
  BASE_DELAY_MS: 1000,
  MAX_DELAY_MS: 30000,
  JITTER_FACTOR: 0.1
};

// Backoff algorithms
const backoffStrategies = {
  exponential: (attempt, baseDelay) => {
    return Math.min(baseDelay * Math.pow(2, attempt - 1), RETRY_CONFIG.MAX_DELAY_MS);
  },
  
  'exponential-jitter': (attempt, baseDelay) => {
    const exponential = Math.min(
      baseDelay * Math.pow(2, attempt - 1), 
      RETRY_CONFIG.MAX_DELAY_MS
    );
    const jitter = exponential * RETRY_CONFIG.JITTER_FACTOR;
    return exponential + (Math.random() * jitter * 2 - jitter);
  },
  
  linear: (attempt, baseDelay) => {
    return baseDelay * attempt;
  }
};
```

### Retry Logic Implementation

```javascript
async function executeWithRetry(jobId, executeFunc, config = {}) {
  const {
    maxAttempts = 3,
    backoffStrategy = 'exponential',
    baseDelay = RETRY_CONFIG.BASE_DELAY_MS,
    onRetry = null,
    classifyError = classifyErrorType // Function to classify errors
  } = config;

  let lastError;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`[Retry] Attempt ${attempt}/${maxAttempts} for job ${jobId}`);
      
      // Execute the job
      const result = await executeFunc();
      
      // Log success
      if (attempt > 1) {
        console.log(`[Retry] SUCCESS on attempt ${attempt}`);
      }
      
      return result;
      
    } catch (error) {
      lastError = error;
      const errorClass = classifyError(error);
      
      console.error(`[Retry] Attempt ${attempt} failed:`, {
        code: errorClass.code,
        message: error.message,
        retryable: errorClass.retryable,
        attempt,
        maxAttempts
      });

      // Check if error is retryable and we have attempts left
      if (!errorClass.retryable || attempt === maxAttempts) {
        throw error;
      }

      // Calculate backoff delay
      const backoffDelay = backoffStrategies[backoffStrategy]?.(attempt, baseDelay) 
        ?? backoffStrategies.exponential(attempt, baseDelay);
      
      console.log(`[Retry] Waiting ${backoffDelay}ms before retry...`);

      // Callback before retry
      if (onRetry) {
        await onRetry(attempt, backoffDelay, errorClass);
      }

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, backoffDelay));
    }
  }

  throw lastError;
}

// Error classifier
function classifyErrorType(error) {
  const message = error.message?.toLowerCase() ?? '';
  const code = error.code;

  // Timeout errors - RETRYABLE
  if (code === 'ETIMEDOUT' || message.includes('timeout')) {
    return { code: 'TIMEOUT', retryable: true, severity: 'transient' };
  }

  // Network errors - RETRYABLE
  if (code === 'ECONNREFUSED' || code === 'ENOTFOUND') {
    return { code: 'NETWORK', retryable: true, severity: 'transient' };
  }

  // API errors - check status code
  if (error.response?.status >= 500) {
    return { code: 'API_5XX', retryable: true, severity: 'transient' };
  }
  
  if (error.response?.status === 429) {
    return { code: 'RATE_LIMIT', retryable: true, severity: 'transient' };
  }

  // Process killed - RETRYABLE
  if (error.killed === true || code === 'SIGTERM') {
    return { code: 'PROCESS_KILLED', retryable: true, severity: 'transient' };
  }

  // Validation errors - NOT RETRYABLE
  if (message.includes('missing') || message.includes('required')) {
    return { code: 'VALIDATION', retryable: false, severity: 'fatal' };
  }

  // Auth errors - NOT RETRYABLE
  if (code === 401 || message.includes('unauthorized')) {
    return { code: 'AUTH_FAILED', retryable: false, severity: 'fatal' };
  }

  // Database constraint errors - NOT RETRYABLE
  if (message.includes('unique violation') || message.includes('unique constraint')) {
    return { code: 'CONSTRAINT_VIOLATION', retryable: false, severity: 'fatal' };
  }

  // Default: retry on unknown errors (safer approach)
  return { code: 'UNKNOWN', retryable: true, severity: 'transient' };
}
```

### Integration with Routes

```javascript
// In registration-routes.js
router.post('/register-account', async (req, res) => {
  try {
    const result = await executeWithRetry(
      req.body.restaurantId,
      async () => {
        // Original account registration logic
        return await registerAccountLogic(req, res);
      },
      {
        maxAttempts: 3,
        backoffStrategy: 'exponential',
        onRetry: async (attempt, delay, errorClass) => {
          // Update database with retry attempt
          await supabase
            .from('pumpd_accounts')
            .update({
              retry_count: attempt,
              last_error: `Retrying: ${errorClass.code}`
            })
            .eq('id', account.id);
          
          // Log retry attempt
          await supabase
            .from('registration_logs')
            .insert({
              action: 'account_creation',
              status: 'retry_attempt',
              error_message: `Attempt ${attempt}, waiting ${delay}ms`,
              restaurant_id: req.body.restaurantId
            });
        }
      }
    );
    
    res.json(result);
  } catch (error) {
    // Handle final failure...
  }
});
```

---

## Job Lifecycle Management Recommendations

### State Machine

```
┌─────────────┐
│   PENDING   │  Initial state after job submission
└──────┬──────┘
       │ Job Start
       ▼
┌──────────────┐
│ IN_PROGRESS  │  Actively executing
└──┬───────┬──┘
   │       │
   │ Timeout/Error (retryable)
   │       ├──→ Wait (backoff) ──→ Retry (loop back to IN_PROGRESS)
   │       │
   │ Error (non-retryable)
   │       ├──→ FAILED
   │       │
   │ Process Killed/Crashed
   │       ├──→ STUCK (recovery needed)
   │       │
   │ Complete with Partial Success
   │       ├──→ PARTIAL (resume on next attempt)
   │       │
   │ Success
   │       ▼
┌──────────────┐
│  COMPLETED   │  Successfully finished
└──────────────┘

└─→ FAILED ──────→ ├─ Manual Intervention Required
                   ├─ Escalate to Operations
                   └─ Notify User
```

### Database Fields Required

Current schema (migration file) already includes:

**pumpd_accounts table**:
- ✓ registration_status (pending, in_progress, completed, failed)
- ✓ last_error TEXT
- ✓ retry_count INTEGER

**pumpd_restaurants table**:
- ✓ registration_status (pending, in_progress, completed, failed)
- ✓ last_error TEXT
- ✓ error_count INTEGER

**Missing fields** (should add):
```sql
-- In pumpd_accounts and pumpd_restaurants:
ALTER TABLE pumpd_accounts ADD COLUMN IF NOT EXISTS:
  - last_attempt_at TIMESTAMP (when last attempt was made)
  - next_retry_at TIMESTAMP (scheduled next retry time)
  - total_attempts INTEGER (total execution attempts)
  - partial_data JSONB (preserve partial results for resume)
  - execution_error_type VARCHAR(50) (classification)

ALTER TABLE registration_logs ADD COLUMN IF NOT EXISTS:
  - execution_time_ms INTEGER (for performance tracking)
  - partial_state JSONB (capture state for recovery)
```

### Cleanup Rules

```javascript
const CLEANUP_RULES = {
  // Remove old successful logs
  'success_older_than_days': 90,
  
  // Remove old failed logs (keep longer for debugging)
  'failed_older_than_days': 180,
  
  // Clean up orphaned "started" logs
  'started_older_than_hours': 24,
  
  // Archive logs older than
  'archive_before_days': 365,
  
  // Keep at least one success log per action per restaurant
  'minimum_success_per_action': 1,
  
  // Maximum logs per restaurant
  'max_logs_per_restaurant': 1000
};
```

### Recovery Procedures

**On Server Startup**:
```javascript
async function initializeJobRecovery() {
  console.log('[Server] Starting job recovery...');
  
  // 1. Find orphaned in_progress jobs
  const orphanedAccounts = await findOrphanedAccounts();
  const orphanedRestaurants = await findOrphanedRestaurants();
  
  for (const account of orphanedAccounts) {
    await recoverOrphanedJob('account', account);
  }
  
  for (const restaurant of orphanedRestaurants) {
    await recoverOrphanedJob('restaurant', restaurant);
  }
  
  console.log('[Server] Job recovery complete');
}

async function recoverOrphanedJob(type, job) {
  const staleDuration = Date.now() - new Date(job.updated_at);
  
  if (staleDuration > 60 * 60 * 1000) { // > 1 hour stale
    console.log(`[Recovery] Found stale ${type} job:`, job.id);
    
    // Mark for recovery
    await supabase
      .from(type === 'account' ? 'pumpd_accounts' : 'pumpd_restaurants')
      .update({
        registration_status: 'pending',
        error_count: (job.error_count || 0) + 1,
        last_error: `Recovered from crash after ${Math.round(staleDuration / 1000)}s`
      })
      .eq('id', job.id);
    
    // Log recovery attempt
    await supabase
      .from('registration_logs')
      .insert({
        [`${type === 'account' ? 'pumpd_account' : 'pumpd_restaurant'}_id`]: job.id,
        action: `${type}_recovery`,
        status: 'started',
        error_message: 'Job recovered from crash'
      });
  }
}
```

**On Graceful Shutdown**:
```javascript
const gracefulShutdown = async () => {
  console.log('[Server] Graceful shutdown initiated');
  
  // Find all in-progress jobs
  const inProgress = await supabase
    .from('pumpd_restaurants')
    .select('*')
    .eq('registration_status', 'in_progress');
  
  // Mark as stuck for recovery
  for (const job of inProgress.data) {
    await supabase
      .from('pumpd_restaurants')
      .update({
        registration_status: 'stuck', // Custom status for recovery
        last_error: 'Server shutdown during execution'
      })
      .eq('id', job.id);
  }
  
  // Kill child processes
  // ...
  
  process.exit(0);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
```

---

## Potential Concerns & Blockers

### 1. **No Process Tracking Mechanism**
   - **Issue**: Detached processes spawned at line 1123-1131 are not tracked
   - **Impact**: Cannot kill or monitor background code generation jobs
   - **Risk**: Process orphans accumulate on Railway, consuming resources
   - **Blocker**: Cannot implement proper job timeouts or cancellation
   - **Solution**: Implement process registry with Redis/in-memory store

### 2. **Database Schema Gaps**
   - **Issue**: Missing `last_attempt_at`, `next_retry_at`, `execution_error_type` fields
   - **Impact**: Cannot schedule smart retries based on error type
   - **Risk**: Retrying fatal errors wastes resources
   - **Blocker**: Retry logic must be in application code (hard to coordinate across instances)
   - **Solution**: Add migration to add missing fields

### 3. **No Error Classification**
   - **Issue**: Code checks `error.code === 'ETIMEDOUT'` in multiple places (no unified classification)
   - **Impact**: Inconsistent retry decisions across different endpoints
   - **Risk**: Some errors retry when they shouldn't (auth failures retried)
   - **Blocker**: Hard to maintain consistent retry policy
   - **Solution**: Create centralized `classifyError()` function

### 4. **Timeout Hardcoding**
   - **Issue**: Timeouts hardcoded per endpoint (180s for register, 240s for config, etc.)
   - **Impact**: Cannot adjust timeouts without code changes
   - **Risk**: Timeouts may not match network/infrastructure conditions
   - **Blocker**: Railway performance issues cause cascading timeouts
   - **Solution**: Move timeouts to configurable env variables

### 5. **No Partial State Recovery**
   - **Issue**: Code detects partial success (line 1510 `partialSuccess`) but doesn't save intermediate state
   - **Impact**: Retries always restart from beginning, duplicating work
   - **Risk**: Multiple HEAD code injections, duplicate database entries
   - **Blocker**: Cannot efficiently resume long-running operations
   - **Solution**: Save step-by-step checkpoints in partial_data JSONB field

### 6. **Orphan Job Detection Gap**
   - **Issue**: No automated detection of stuck jobs except on manual log review
   - **Impact**: Orphaned jobs could remain stuck indefinitely
   - **Risk**: Users assume jobs failed when they're just stuck
   - **Blocker**: No visibility into hung processes
   - **Solution**: Implement automated orphan detection view + recovery job

### 7. **No Job Cancellation**
   - **Issue**: Once job starts, no way to cancel it
   - **Impact**: User stuck waiting for timeout on expensive operations
   - **Risk**: Ties up Playwright browser instances on Railway
   - **Blocker**: Cannot implement timeout override or user cancellation
   - **Solution**: Track process PIDs and implement cancellation endpoint

### 8. **Exponential Backoff Gaps**
   - **Issue**: No backoff algorithm implemented (either retry immediately or timeout)
   - **Impact**: Retries hammer services during outages
   - **Risk**: Contributes to cascading failures
   - **Blocker**: Cannot implement intelligent rate limiting
   - **Solution**: Implement backoff strategies from above

### 9. **No Circuit Breaker**
   - **Issue**: CloudWaitress API failures cause immediate retry storms
   - **Impact**: External API gets bombarded during outage
   - **Risk**: Temporary outage becomes prolonged
   - **Blocker**: Cannot detect or handle systematic failures gracefully
   - **Solution**: Implement circuit breaker pattern for external APIs

### 10. **Cross-Instance Coordination Missing**
   - **Issue**: If running multiple instances, no coordination on retries
   - **Impact**: Two instances might retry same job simultaneously
   - **Risk**: Race conditions in database updates
   - **Blocker**: Cannot scale to multiple Railway instances
   - **Solution**: Use Redis distributed lock for job execution

### 11. **Missing Metrics**
   - **Issue**: No counters for retry success rates, timeout frequency, etc.
   - **Impact**: Cannot monitor system health or identify bottlenecks
   - **Risk**: Invisible degradation until complete failure
   - **Blocker**: Cannot optimize retry strategy data-driven
   - **Solution**: Add observability - track metrics to Datadog/CloudWatch

### 12. **No User Communication**
   - **Issue**: HTTP response on success, but no webhook/notification on retry completion
   - **Impact**: User doesn't know job eventually succeeded after retries
   - **Risk**: User submits duplicate job thinking first one failed
   - **Blocker**: Retry transparency limited
   - **Solution**: Implement webhook notifications or polling endpoint

---

## Summary

The current error handling implementation provides **basic state tracking** but lacks **robust retry logic** and **orphan recovery**. Critical gaps include:

1. ✗ No unified error classification
2. ✗ No intelligent retry strategies
3. ✗ No orphan job detection/recovery
4. ✗ No partial state preservation
5. ✗ No process tracking for long-running jobs
6. ✗ No automatic cleanup of old logs
7. ✗ No circuit breaker for external APIs
8. ✗ No metrics/observability

**Priority Fixes** (in order):
1. Implement `classifyErrorType()` function and use consistently
2. Add orphan detection view + recovery endpoint
3. Implement exponential backoff retry strategy
4. Add missing database fields for retry scheduling
5. Create cleanup cron job for old logs
6. Add process tracking for background jobs
7. Implement circuit breaker for external APIs
8. Add comprehensive metrics

**Estimated Implementation Effort**:
- Phase 1 (Error Classification + Backoff): 8-12 hours
- Phase 2 (Orphan Recovery): 4-6 hours
- Phase 3 (Process Tracking + Cleanup): 6-8 hours
- Phase 4 (Observability + Circuit Breaker): 8-10 hours

**Total Estimated**: 26-36 hours of development + 4 hours testing/validation
