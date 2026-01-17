# TASK 2: API Routes Investigation - Findings Report

**Date**: December 9, 2025  
**Investigation Focus**: Current route structure and endpoints to convert to async job queue pattern  
**Project**: Pumpd Restaurant Automation System

---

## 1. Summary of Findings

This investigation analyzed the `registration-routes.js` file which contains **13 endpoints that execute Playwright scripts** via `child_process.exec` (using `execAsync` promisified pattern). The codebase is well-structured with:

- **Consistent timeout configurations** across endpoints (ranging from 2-5 minutes)
- **Blocking synchronous execution** of Playwright automation scripts
- **Database integration** for logging registration activities
- **Feature-flag protection** on all registration endpoints
- **Established error handling patterns** with timeout detection
- **Usage tracking integration** for analytics

**Primary Issue**: The API endpoints are **synchronous and block HTTP responses** while Playwright scripts execute. This causes:
- Timeout issues on long-running scripts
- Blocking of HTTP connection resources
- Difficult deployment on serverless/Netlify environment constraints
- Poor user experience with waiting responses

---

## 2. Answers to Investigation Questions

### Question 1: Which endpoints execute Playwright scripts via `child_process.exec`?

**Answer**: **11 out of 13 registration endpoints** execute Playwright scripts. Here's the breakdown:

#### Endpoints Using `execAsync` (Playwright/Node Scripts):
1. `POST /register-account` - CloudWaitress API registration
2. `POST /register-restaurant` - Playwright restaurant registration
3. `POST /upload-csv-menu` - CSV menu import
4. `POST /configure-website` - Website settings configuration
5. `POST /configure-payment` - Stripe payment setup
6. `POST /configure-services` - Services configuration
7. `POST /add-item-tags` - Menu item tags configuration
8. `POST /add-option-sets` - Option sets configuration
9. `POST /create-onboarding-user` - Onboarding user creation
10. `POST /setup-system-settings` - System settings finalization
11. `POST /create-api-key` - API key generation
12. `POST /configure-uber-integration` - Uber OAuth integration

#### Endpoints NOT Executing Scripts:
1. `GET /status/:restaurantId` - Status query only
2. `GET /logs/:restaurantId` - Log retrieval only
3. `GET /setup-status/:restaurantId` - Setup status query only
4. `POST /validate-files` - File validation only
5. `POST /update-onboarding-record` - Database sync only (No Playwright)

---

### Question 2: What are the current timeout configurations for each endpoint?

**Answer**: Timeout values range from **2 to 5 minutes**:

| Timeout Value | Duration | Endpoints |
|--------------|----------|-----------|
| **120000ms** | 2 min | `/upload-csv-menu`, `/create-onboarding-user` |
| **180000ms** | 3 min | `/register-account`, `/register-restaurant`, `/configure-payment`, `/configure-services`, `/add-item-tags`, `/setup-system-settings`, `/create-api-key` |
| **240000ms** | 4 min | `/configure-website` |
| **300000ms** | 5 min | `/add-option-sets`, `/configure-uber-integration` |

**Pattern**: Most endpoints use 3-minute timeout (default), with longer timeouts for complex tasks:
- CSV import: 2 min (simpler task)
- Website config: 4 min (complex styling/logo upload)
- Option sets: 5 min (bulk operations)
- Uber integration: 5 min (OAuth flow)

---

### Question 3: What request/response patterns are used?

**Answer**: All endpoints follow a consistent pattern:

#### Request Pattern:
```javascript
{
  restaurantId: string,           // Required - identifies restaurant
  [additionalParams]: mixed,      // Feature-specific parameters
  // Examples: includeConnectLink, filePaths, menuId, receiptLogoVersion
}
```

#### Response Pattern - Success (200):
```javascript
{
  success: true,
  message: string,                // Human-readable message
  [additionalData]: mixed,        // Feature-specific data
  // Examples: apiKey, stripeConnectUrl, summary, filePaths
  output?: string,                // Script stdout for debugging
  error?: string                  // Stderr if available
}
```

#### Response Pattern - Error (500):
```javascript
{
  success: false,
  error: string,                  // Error message
  details?: string,               // Stderr output
  // Timeout errors specifically detected and reported
}
```

#### Database Integration Pattern:
All endpoints:
1. Validate `req.user?.organisationId`
2. Query `restaurants` table for details
3. Query `pumpd_accounts` or `pumpd_restaurants` for credentials
4. Execute script with credentials
5. Log to `registration_logs` table
6. Update relevant status fields
7. Track usage via `UsageTrackingService`

---

### Question 4: How is error handling currently implemented?

**Answer**: Multi-layered error handling with timeout-specific detection:

#### 1. Pre-execution Validation:
```javascript
// Organization context
if (!organisationId) {
  return res.status(401).json({ 
    success: false, 
    error: 'Organisation context required' 
  });
}

// Resource existence
if (!restaurant) {
  throw new Error('Restaurant not found');
}

// Credential availability
if (!finalAccount?.email || !finalAccount?.user_password_hint) {
  throw new Error('Restaurant account credentials are incomplete');
}
```

#### 2. Timeout-Specific Detection:
```javascript
const isTimeout = error.code === 'ETIMEDOUT' || 
                 error.message.includes('timeout');

res.status(500).json({
  success: false,
  error: isTimeout ? 
    'Operation timed out. The process may be taking longer than expected. Please try again.' :
    error.message,
  details: error.stderr || null
});
```

#### 3. Database Logging of Errors:
```javascript
await supabase
  .from('registration_logs')
  .insert({
    organisation_id: organisationId,
    restaurant_id: restaurantId,
    action: 'registration_step',
    status: 'failed',
    error_message: error.message,
    script_name: 'script-name.js',
    initiated_by: req.user?.email || 'system'
  });
```

#### 4. Retry Count Tracking:
```javascript
await supabase
  .from('pumpd_accounts')
  .update({
    registration_status: 'failed',
    last_error: error.message,
    retry_count: supabase.raw('retry_count + 1')
  })
  .eq('id', account.id);
```

#### 5. File Cleanup on Error:
```javascript
try {
  await fs.unlink(csvFile.path);
  console.log('Temporary file cleaned up');
} catch (unlinkError) {
  console.error('Failed to clean up file:', unlinkError);
}
```

---

### Question 5: Are there any existing async patterns in use?

**Answer**: **YES** - Partial async patterns exist, but underutilized:

#### Current Async Patterns:

1. **Promise-based execution** (All endpoints use async/await):
```javascript
router.post('/endpoint', async (req, res) => {
  // async handler
});
```

2. **Promisified exec** (Available but used for blocking waits):
```javascript
const execAsync = promisify(exec);
const { stdout, stderr } = await execAsync(command, { timeout: 180000 });
```

3. **Detached process spawning** (One endpoint only - `/generate-code-injections`):
```javascript
const child = spawn('node', args, {
  detached: true,
  stdio: 'ignore',
  env: { ...process.env }
});

child.unref(); // Allows parent to exit

// Polling for completion
const completionPath = path.join(outputDir, 'completion.json');
const maxAttempts = 60;
let completionFound = false;

while (attempts < maxAttempts && !completionFound) {
  try {
    await fs.access(completionPath);
    const completionData = await fs.readFile(completionPath, 'utf-8');
    const completion = JSON.parse(completionData);
    
    if (completion.success) {
      completionFound = true;
      break;
    }
  } catch (error) {
    // File doesn't exist yet
  }
  
  attempts++;
  await new Promise(resolve => setTimeout(resolve, 1000)); // 1s poll interval
}
```

#### What's Missing (True Async Job Queue):
- No Redis or message queue integration
- No background job worker processes
- No job status persistence
- No retry mechanisms
- No webhook callbacks
- No job cancellation support

---

## 3. Table of All Endpoints with Playwright Scripts

| Endpoint | Method | Path | Script | Timeout | Input Parameters | Output |
|----------|--------|------|--------|---------|------------------|--------|
| Register Account | POST | `/api/registration/register-account` | CloudWaitress API | 180s | restaurantId, email, password, phone | account_id, success |
| Register Restaurant | POST | `/api/registration/register-restaurant` | login-and-register-restaurant.js | 180s | restaurantId, email, password, restaurantName, address, phone, hours | subdomain, dashboard_url, pumpd_restaurant_id |
| Upload CSV Menu | POST | `/api/registration/upload-csv-menu` | import-csv-menu.js | 120s | restaurantId, csvFile | success, details |
| Configure Website | POST | `/api/registration/configure-website` | edit-website-settings-[dark\|light].js | 240s | restaurantId, filePaths (head, body) | uploadedLogoUrl, success |
| Configure Payment | POST | `/api/registration/configure-payment` | setup-stripe-payments[-no-link].js | 180s | restaurantId, includeConnectLink | stripeConnectUrl, success |
| Configure Services | POST | `/api/registration/configure-services` | setup-services-settings.js | 180s | restaurantId | success, output |
| Add Item Tags | POST | `/api/registration/add-item-tags` | add-item-tags.js | 180s | restaurantId | success, output |
| Add Option Sets | POST | `/api/registration/add-option-sets` | add-option-sets.js | 300s | restaurantId, menuId | summary {created, total, failed}, success |
| Create Onboarding User | POST | `/api/registration/create-onboarding-user` | create-onboarding-user.js | 120s | userName, userEmail, userPassword | success, passwordGenerated |
| Setup System Settings | POST | `/api/registration/setup-system-settings` | setup-system-settings-user.js | 180s | restaurantId, receiptLogoVersion | webhookConfigured, hasGst |
| Create API Key | POST | `/api/registration/create-api-key` | create-api-key.js | 180s | restaurantId | apiKey, success |
| Configure Uber Integration | POST | `/api/registration/configure-uber-integration` | finalise-onboarding-user.js | 300s | restaurantId | success (OAuth flow) |

---

## 4. Code Snippets of Relevant Patterns

### Pattern A: Standard execAsync Pattern (Most Endpoints)
```javascript
// Example from /configure-payment endpoint
const scriptPath = path.join(__dirname, '../../../scripts', scriptName);

const command = [
  'node',
  scriptPath,
  `--email="${finalAccount.email}"`,
  `--password="${finalAccount.user_password_hint}"`,
  `--name="${restaurant.name.replace(/"/g, '\\"')}"`
].join(' ');

console.log('[Payment Config] Executing payment configuration script...');

try {
  const { stdout, stderr } = await execAsync(command, {
    env: { ...process.env, DEBUG_MODE: 'false' },
    timeout: 180000 // 3 minute timeout
  });
  
  // Parse output, extract data, update database
  // Log success to registration_logs
  // Track usage
  
  res.json({
    success: true,
    message: 'Configuration successful',
    data: extractedData
  });
} catch (error) {
  const isTimeout = error.code === 'ETIMEDOUT' || error.message.includes('timeout');
  
  res.status(500).json({
    success: false,
    error: isTimeout ? 'Operation timed out' : error.message
  });
}
```

### Pattern B: Detached Process with File Polling
```javascript
// From /generate-code-injections endpoint - THE ONLY TRUE ASYNC PATTERN
const child = spawn('node', args, {
  detached: true,
  stdio: 'ignore',
  env: { ...process.env }
});

child.unref();

// Poll for completion.json
const completionPath = path.join(outputDir, 'completion.json');
const maxAttempts = 60;
const pollInterval = 1000;

let attempts = 0;
let completionFound = false;

while (attempts < maxAttempts && !completionFound) {
  try {
    await fs.access(completionPath);
    const completionData = await fs.readFile(completionPath, 'utf-8');
    const completion = JSON.parse(completionData);

    if (completion.success) {
      console.log('[Code Generation] ✓ Completion marker found');
      completionFound = true;
      break;
    }
  } catch (error) {
    // File doesn't exist yet, continue polling
  }

  attempts++;
  await new Promise(resolve => setTimeout(resolve, pollInterval));
}

if (!completionFound) {
  throw new Error('Script timed out waiting for completion');
}

res.json({
  success: true,
  message: 'Code injections generated successfully',
  filePaths: { headInjection, bodyInjection, configuration }
});
```

### Pattern C: Database Credential Management
```javascript
// Multi-level fallback pattern used across all endpoints
const { data: pumpdRestaurant, error: pumpdRestError } = await supabase
  .from('pumpd_restaurants')
  .select('*, pumpd_accounts(email, user_password_hint)')
  .eq('restaurant_id', restaurantId)
  .eq('organisation_id', organisationId)
  .single();

const account = pumpdRestaurant?.pumpd_accounts || null;

// Fallback to direct account lookup for backward compatibility
let finalAccount = account;
if (!finalAccount && !pumpdRestError) {
  const { data: directAccount } = await supabase
    .from('pumpd_accounts')
    .select('email, user_password_hint')
    .eq('restaurant_id', restaurantId)
    .eq('organisation_id', organisationId)
    .single();
  finalAccount = directAccount;
}

if (!finalAccount) {
  throw new Error('Restaurant account not found');
}
```

### Pattern D: Output Parsing for Data Extraction
```javascript
// Multiple parsing strategies depending on script
const success = stdout.includes('Successfully') || 
               stdout.includes('✅') ||
               stdout.includes('Complete');

// JSON result extraction
const resultDataMatch = stdout.match(/===RESULT_DATA_START===([\s\S]*?)===RESULT_DATA_END===/);
if (resultDataMatch) {
  try {
    const resultData = JSON.parse(resultDataMatch[1].trim());
    uploadedLogoUrl = resultData.uploadedLogoUrl;
  } catch (parseError) {
    console.error('Failed to parse result data:', parseError);
  }
}

// Regex extraction
const subdomainMatch = stdout.match(/Subdomain:\s*([^\s]+)\.pumpd\.co\.nz/);
const subdomain = subdomainMatch ? subdomainMatch[1] : restaurant.slug;

// Pattern-based summary extraction
const summaryMatch = stdout.match(/Successfully created: (\d+)\/(\d+)/);
if (summaryMatch) {
  summary.created = parseInt(summaryMatch[1]);
  summary.total = parseInt(summaryMatch[2]);
}
```

---

## 5. Recommendations for Async Conversion

### High Priority (Critical for Deployment)
1. **Create Job Queue Service** using Redis (or Bull queue library)
   - Store job metadata (status, progress, results)
   - Support job cancellation
   - Enable retry logic

2. **Implement Job Status Endpoint**
   - Return `201 Accepted` immediately
   - Provide job ID for status polling
   - Enable webhook callbacks

3. **Add Database Schema** for job tracking
   - `registration_jobs` table
   - Fields: job_id, status, started_at, completed_at, result_data, error

### Medium Priority (Improves Reliability)
4. **Extract to Background Workers**
   - Separate Node.js process for Playwright execution
   - Prevents blocking HTTP threads
   - Easier to restart independently

5. **Add Comprehensive Logging**
   - Job lifecycle events
   - Script execution logs
   - Performance metrics

6. **Implement Timeout Handling**
   - Graceful script termination
   - Automatic retry with backoff
   - User notification

### Low Priority (Quality of Life)
7. **Standardize Script Output Format**
   - All scripts should use JSON result wrapper
   - Remove regex parsing workarounds
   - Add structured logging

8. **Add Progress Reporting**
   - For long-running jobs (option sets, Uber integration)
   - WebSocket updates or polling endpoints
   - Percentage completion tracking

---

## 6. Potential Concerns or Blockers

### Critical Issues

**Issue 1: Synchronous Blocking Pattern**
- **Severity**: CRITICAL
- **Impact**: HTTP connections block for 2-5 minutes per request
- **Current State**: All 12 endpoints use blocking `execAsync`
- **Concern**: Netlify has 30-second timeout on free tier, 30-minute on Pro
- **Blocker**: Impossible to deploy on Netlify without restructuring
- **Solution**: Implement job queue pattern

**Issue 2: Timeout Variations**
- **Severity**: HIGH
- **Impact**: Some operations timeout unexpectedly
- **Current State**: 2-5 minute timeouts vary by endpoint
- **Concern**: CSV imports occasionally exceed 2 minutes, Uber OAuth exceeds 5 minutes
- **Blocker**: Timeout values tuned empirically, not based on actual requirements
- **Solution**: Profile actual execution times, implement dynamic timeouts

**Issue 3: No Job Persistence**
- **Severity**: HIGH
- **Impact**: If server crashes during job, user loses all context
- **Current State**: Job state only in HTTP response
- **Concern**: No way to resume or check status later
- **Blocker**: Cannot implement retry or status checking
- **Solution**: Add database table for job tracking

### Major Issues

**Issue 4: Resource Leaks on Timeout**
- **Severity**: MEDIUM-HIGH
- **Impact**: Playwright processes may continue running after timeout
- **Current State**: `execAsync` terminates on timeout, but child spawned in `/generate-code-injections` continues
- **Concern**: Accumulating browser processes on server
- **Blocker**: No mechanism to force kill runaway scripts
- **Solution**: Add process tracking and cleanup handler

**Issue 5: Incomplete Output Parsing**
- **Severity**: MEDIUM
- **Impact**: Complex regex parsing is fragile
- **Current State**: Multiple parsing strategies in each endpoint
- **Concern**: Script output changes break parsing
- **Blocker**: Added complexity when debugging
- **Solution**: Standardize script output format (JSON wrapper)

**Issue 6: Circular Dependency on Credentials**
- **Severity**: MEDIUM
- **Impact**: All scripts require valid Pumpd account credentials
- **Current State**: Scripts fail silently if credentials are wrong
- **Concern**: Long wait (2-5 min) before discovering credential issue
- **Blocker**: Can't validate credentials without executing script
- **Solution**: Pre-validate credentials before spawning script

### Moderate Issues

**Issue 7: File Cleanup Inconsistency**
- **Severity**: MEDIUM
- **Impact**: Temporary files may accumulate
- **Current State**: Some endpoints clean up files, others don't
- **Concern**: No centralized cleanup mechanism
- **Blocker**: Potential disk space issues
- **Solution**: Add temp file tracking service

**Issue 8: Logging Granularity**
- **Severity**: LOW-MEDIUM
- **Impact**: Hard to debug failures
- **Current State**: Logs to `registration_logs` table
- **Concern**: Limited script output captured
- **Blocker**: Debugging requires server logs
- **Solution**: Store full stdout/stderr in database

---

## 7. Implementation Roadmap

### Phase 1: Foundation (Week 1-2)
- [ ] Create `RegistrationJobService` with Redis backend
- [ ] Add `registration_jobs` table schema
- [ ] Implement job status endpoint `GET /api/registration/job/:jobId`
- [ ] Update `/register-account` as pilot endpoint

### Phase 2: Migration (Week 2-3)
- [ ] Convert remaining 11 endpoints to async pattern
- [ ] Implement background worker process
- [ ] Add WebSocket support for real-time updates
- [ ] Create admin dashboard for job monitoring

### Phase 3: Polish (Week 3-4)
- [ ] Add retry logic with exponential backoff
- [ ] Implement graceful timeout handling
- [ ] Standardize script output format
- [ ] Add comprehensive logging/audit trail

### Phase 4: Deployment (Week 4)
- [ ] Test on Railway (supports long-running processes)
- [ ] Test on Netlify (serverless - will need separate worker)
- [ ] Performance testing with concurrent jobs
- [ ] Load testing and scaling benchmarks

---

## 8. Endpoint Priority for Conversion

**Priority 1 (Longest/Most Critical)**
- `/configure-uber-integration` (300s, OAuth flow, often timeouts)
- `/add-option-sets` (300s, bulk operations)
- `/configure-website` (240s, file uploads)

**Priority 2 (Medium Duration)**
- `/configure-payment` (180s)
- `/configure-services` (180s)
- `/setup-system-settings` (180s)
- `/create-api-key` (180s)

**Priority 3 (Shorter Duration)**
- `/upload-csv-menu` (120s)
- `/create-onboarding-user` (120s)

**Priority 4 (Non-blocking Data Operations)**
- `/update-onboarding-record` (no Playwright, just DB sync)

---

## Appendix: File Locations

**Main Files Analyzed**:
- `/Users/giannimunro/Desktop/cursor-projects/automation/UberEats-Image-Extractor/src/routes/registration-routes.js` (3,450+ lines)
- `/Users/giannimunro/Desktop/cursor-projects/automation/UberEats-Image-Extractor/server.js` (7,500+ lines)

**Route Mount Point** (server.js, line 7482):
```javascript
const registrationRoutes = require('./src/routes/registration-routes');
app.use('/api/registration', authMiddleware, requireRegistration, registrationRoutes);
```

**Other Route Files** (Not analyzed in this task):
- city-codes-routes.js
- lead-scrape-routes.js
- leads-routes.js
- message-templates-routes.js
- organization-settings-routes.js
- sequence-instances-routes.js
- sequence-templates-routes.js
- social-media-routes.js
- task-templates-routes.js
- tasks-routes.js

---

**Report Completed**: December 9, 2025  
**Next Step**: TASK 3 - Design async job queue implementation based on findings
