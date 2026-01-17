# TASK 4 - Script Execution Investigation

## Executive Summary

The Pumpd automation system currently executes Playwright scripts **synchronously and blocking** using Node.js `child_process.exec()` within HTTP request handlers. This creates significant operational challenges:

1. **HTTP Timeout Risk**: Long-running scripts (2-4 minutes) execute synchronously within the request/response cycle
2. **No Background Processing**: Scripts block the entire HTTP request, preventing other operations
3. **Poor Error Handling**: Script failures are caught at the HTTP level with no recovery mechanism
4. **No Progress Tracking**: Clients have no visibility into long-running operations
5. **Environment Variable Passing**: Variables spread across multiple sources with inconsistent patterns

**Current Pattern**: Request → Execute Script (Blocking) → Parse Output → Return Response

**Proposed Pattern**: Request → Queue Job → Return Job ID → Job Executes in Background → Update DB → Client Polls for Status

---

## Answers to Key Questions

### 1. How are scripts currently invoked?

**Method**: `child_process.exec()` (Promisified)

```javascript
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

// Within HTTP route handler (BLOCKING)
const { stdout, stderr } = await execAsync(command, {
  env: { ...process.env, DEBUG_MODE: 'false' },
  timeout: 180000 // 3 minute timeout
});
```

**Invocation Locations**:
- `/UberEats-Image-Extractor/src/routes/registration-routes.js` (multiple endpoints)
- Direct Node.js script execution: `node /path/to/script.js --args`

**Timeouts Observed**:
- Restaurant Registration: 3 minutes (180,000ms)
- CSV Upload: 2 minutes (120,000ms)
- Website Configuration: 4 minutes (240,000ms)
- Option Sets: 3 minutes (180,000ms)
- Item Tags: 3 minutes (180,000ms)

### 2. What environment variables are passed to scripts?

**Passed via exec() env parameter**:
```javascript
env: { ...process.env, DEBUG_MODE: 'false', HEADLESS: 'false' }
```

**Environment Variables Used**:

| Variable | Source | Usage | Default |
|----------|--------|-------|---------|
| `NODE_ENV` | System/Process | Browser headless mode | 'development' |
| `DEBUG_MODE` | Explicitly set | Screenshot capture, logging | 'false' |
| `HEADLESS` | Explicitly set | Browser visibility | 'true' (production) |
| `ADMIN_PASSWORD` | .env file | Authentication | Hardcoded fallback |
| `FIRECRAWL_API_KEY` | .env file | Web scraping | N/A |
| `REMOVE_BG_API_KEY` | .env file | Image processing | N/A |

**Configuration Files**:
- `/scripts/restaurant-registration/.env` (local overrides)
- `/UberEats-Image-Extractor/.env` (centralized)
- Script loads: `require('dotenv').config({ path: path.join(__dirname, '../../UberEats-Image-Extractor/.env') })`

**Browser Configuration Module** (`scripts/lib/browser-config.cjs`):
```javascript
function isProduction() { return process.env.NODE_ENV === 'production'; }
function isHeadless() { return process.env.HEADLESS === 'true'; }
function isDebugMode() { return process.env.DEBUG_MODE === 'true'; }

// Runtime evaluation (not at module load time)
const headless = IS_PRODUCTION || FORCE_HEADLESS;
const args = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',    // Critical for containers
  '--disable-gpu',               // No GPU in cloud
  '--disable-blink-features=AutomationControlled',
  '--no-zygote',
];
```

### 3. How is stdout/stderr captured?

**Capture Pattern**:
```javascript
const { stdout, stderr } = await execAsync(command, {
  env: { ...process.env, DEBUG_MODE: 'false' },
  timeout: 180000
});

// Both logged immediately
console.log('[CSV Upload] Script output:', stdout);
if (stderr) {
  console.error('[CSV Upload] Script stderr:', stderr);
}

// Stored in response object
res.json({
  success,
  output: stdout,
  details: stdout.substring(stdout.lastIndexOf('\n', stdout.length - 2) + 1)
});
```

**stderr Handling**:
- Captured but rarely used for decision-making
- Included in error responses only
- Scripts write critical output to stdout (script conventions)

**Script Output Conventions**:
```
✅ RESTAURANT REGISTRATION COMPLETED!
Subdomain: restaurant-slug.pumpd.co.nz
RestaurantID: REShTCa6OoFcRJM2zWdM9g4S
```

### 4. How are script results parsed from output?

**Parsing Patterns Used**:

**A) Simple String Matching** (CSV Upload):
```javascript
const success = stdout.includes('CSV import completed successfully') || 
               stdout.includes('✅') ||
               stdout.includes('Successfully imported') ||
               stdout.includes('Import completed');
```

**B) Regex Pattern Extraction** (Restaurant Registration):
```javascript
// Extract subdomain
const subdomainMatch = stdout.match(/Subdomain:\s*([^\s]+)\.pumpd\.co\.nz/);
const subdomain = subdomainMatch ? subdomainMatch[1] : restaurant.slug;

// Extract restaurant ID
const restaurantIdMatch = stdout.match(/RestaurantID:\s*(RES[A-Za-z0-9_-]+)/);
const pumpdRestaurantId = restaurantIdMatch ? restaurantIdMatch[1] : null;
```

**C) Step Tracking** (Website Configuration):
```javascript
// Extract last successful step
const stepMatches = error.stdout.match(/STEP (\d+):[^\n]+/g);
if (stepMatches && stepMatches.length > 0) {
  lastStep = stepMatches[stepMatches.length - 1];
}
```

**D) Boolean Success Check** (Option Sets):
```javascript
// Check if process was killed
const isKilled = error.killed === true;
const isTimeout = error.code === 'ETIMEDOUT' || 
                 error.message.includes('timeout') || 
                 isKilled;

// Partial success detection
let partialSuccess = false;
if (error.stdout) {
  partialSuccess = error.stdout.includes('Head code injection added');
}
```

### 5. What happens when a script fails?

**Failure Detection**:
```javascript
try {
  const { stdout, stderr } = await execAsync(command, {
    env: { ...process.env, DEBUG_MODE: 'false' },
    timeout: 180000
  });
  // Process success
} catch (error) {
  // error.code === 'ETIMEDOUT' if timeout
  // error.killed === true if forcefully terminated
  // error.stderr available
}
```

**Error Response Pattern**:
```javascript
const isTimeout = error.code === 'ETIMEDOUT' || 
                 error.message.includes('timeout');

res.status(500).json({
  success: false,
  error: isTimeout ? 
    'Upload timed out. The menu may be too large or the server may be busy. Please try again.' :
    error.message,
  details: error.stderr || null,
  partialSuccess: false,
  lastStep: ''
});
```

**Cleanup on Error**:
```javascript
// Clean up temporary files
if (csvFile?.path) {
  try {
    await fs.unlink(csvFile.path);
  } catch (unlinkError) {
    console.error('[CSV Upload] Failed to clean up file after error:', unlinkError);
  }
}
```

**Database Updates on Failure**: None observed - only on success

---

## Current Execution Pattern - Code Snippets

### Pattern 1: Restaurant Registration (blocking, 3 min timeout)

**File**: `UberEats-Image-Extractor/src/routes/registration-routes.js` (lines 590-670)

```javascript
// Build command with all parameters
const scriptPath = '/Users/giannimunro/Desktop/cursor-projects/automation/scripts/restaurant-registration/login-and-register-restaurant.js';
let command = `node ${scriptPath} --email="${email}" --password="${password}" --name="${restaurantName || restaurant.name}" --address="${restaurant.address || ''}" --phone="${restaurant.phone || ''}" --dayHours='${hoursJson}'`;

console.log('[Registration] Executing restaurant registration:', command);

try {
  // BLOCKING EXECUTION
  const { stdout, stderr } = await execAsync(command, {
    env: { ...process.env, DEBUG_MODE: 'false' },
    timeout: 180000 // 3 minute timeout
  });
  
  // Parse subdomain
  const subdomainMatch = stdout.match(/Subdomain:\s*([^\s]+)\.pumpd\.co\.nz/);
  const subdomain = subdomainMatch ? subdomainMatch[1] : restaurant.slug;
  
  // Parse restaurant ID
  const restaurantIdMatch = stdout.match(/RestaurantID:\s*(RES[A-Za-z0-9_-]+)/);
  const pumpdRestaurantId = restaurantIdMatch ? restaurantIdMatch[1] : null;
  
  // Update database on success
  const updateData = {
    registration_status: 'completed',
    registration_date: new Date().toISOString(),
    pumpd_restaurant_id: pumpdRestaurantId,
    pumpd_subdomain: subdomain,
    pumpd_full_url: `https://${subdomain}.pumpd.co.nz`
  };

  await supabase
    .from('pumpd_restaurants')
    .update(updateData)
    .eq('id', pumpdRestaurant.id);
    
  // Return success response
  res.json({ success: true, /* ... */ });
  
} catch (error) {
  console.error('[Registration] Error:', error);
  
  const isTimeout = error.code === 'ETIMEDOUT' || error.message.includes('timeout');
  
  res.status(500).json({
    success: false,
    error: isTimeout ? 'Registration timed out. Please try again.' : error.message,
    details: error.stderr || null
  });
}
```

### Pattern 2: CSV Menu Upload (blocking, 2 min timeout)

**File**: `UberEats-Image-Extractor/src/routes/registration-routes.js` (lines 865-948)

```javascript
const command = [
  `node ${scriptPath}`,
  `--email="${finalAccount.user_email}"`,
  `--password="${finalAccount.user_password_hint}"`,
  `--name="${restaurant.name}"`,
  `--csvFile="${csvFile.path}"`
].join(' ');

console.log('[CSV Upload] Executing command:', command);

try {
  // BLOCKING EXECUTION
  const { stdout, stderr } = await execAsync(command, {
    env: { ...process.env, DEBUG_MODE: 'false', HEADLESS: 'false' },
    timeout: 120000 // 2 minute timeout
  });
  
  console.log('[CSV Upload] Script output:', stdout);
  if (stderr) {
    console.error('[CSV Upload] Script stderr:', stderr);
  }
  
  // Parse results from stdout
  const success = stdout.includes('CSV import completed successfully') || 
                 stdout.includes('✅') ||
                 stdout.includes('Successfully imported') ||
                 stdout.includes('Import completed');
  
  // Clean up uploaded file
  try {
    await fs.unlink(csvFile.path);
    console.log('[CSV Upload] Temporary file cleaned up');
  } catch (unlinkError) {
    console.error('[CSV Upload] Failed to clean up file:', unlinkError);
  }

  // Update restaurant status only if successful
  if (success) {
    await supabase
      .from('restaurants')
      .update({ onboarding_status: 'menu_imported' })
      .eq('id', restaurantId)
      .eq('organisation_id', organisationId);

    UsageTrackingService.trackRegistrationStep(organisationId, 'menu_upload', {
      restaurant_id: restaurantId
    }).catch(err => console.error('[UsageTracking] Failed to track menu upload:', err));
  }

  res.json({
    success,
    message: success ? 'Menu uploaded successfully' : 'Upload completed with warnings',
    details: stdout.substring(stdout.lastIndexOf('\n', stdout.length - 2) + 1),
    output: stdout
  });
  
} catch (error) {
  console.error('[CSV Upload] Error:', error);
  
  // Clean up file on error
  if (csvFile?.path) {
    try {
      await fs.unlink(csvFile.path);
    } catch (unlinkError) {
      console.error('[CSV Upload] Failed to clean up file after error:', unlinkError);
    }
  }
  
  const isTimeout = error.code === 'ETIMEDOUT' || error.message.includes('timeout');
  
  res.status(500).json({
    success: false,
    error: isTimeout ? 
      'Upload timed out. The menu may be too large or the server may be busy. Please try again.' :
      error.message,
    details: error.stderr || null
  });
}
```

### Pattern 3: Website Configuration (blocking, 4 min timeout, partial success tracking)

**File**: `UberEats-Image-Extractor/src/routes/registration-routes.js` (lines 1475-1528)

```javascript
try {
  // BLOCKING EXECUTION - 4 minute timeout
  const { stdout, stderr } = await execAsync(command, {
    env: { ...process.env, DEBUG_MODE: 'false' },
    timeout: 240000 // 4 minute timeout - increased for complex configurations
  });

  // Update database on success
  await supabase
    .from('pumpd_restaurants')
    .update({ 
      registration_status: 'completed',
      registration_date: new Date().toISOString()
    })
    .eq('id', pumpdRestaurant.id);

  res.json({
    success: true,
    message: 'Website configuration completed successfully',
    output: stdout
  });

} catch (error) {
  console.error('[Website Config] Error:', error);
  
  // Check if process was killed (often due to timeout)
  const isKilled = error.killed === true;
  const isTimeout = error.code === 'ETIMEDOUT' || 
                   error.message.includes('timeout') || 
                   isKilled;
  
  // Check if we got partial success from stdout
  let partialSuccess = false;
  let lastStep = '';
  if (error.stdout) {
    partialSuccess = error.stdout.includes('Head code injection added');
    // Extract last successful step from output
    const stepMatches = error.stdout.match(/STEP (\d+):[^\n]+/g);
    if (stepMatches && stepMatches.length > 0) {
      lastStep = stepMatches[stepMatches.length - 1];
    }
  }
  
  res.status(500).json({
    success: false,
    error: isTimeout ? 
      `Website configuration timed out after 4 minutes. ${partialSuccess ? 'Partial configuration was applied (head code added).' : ''} ${lastStep ? `Last successful step: ${lastStep}` : ''} Please try running the configuration again to complete the process.` :
      error.message,
    details: error.stderr || null,
    partialSuccess,
    lastStep
  });
}
```

### Pattern 4: Script Structure - Output Format

**File**: `scripts/restaurant-registration/login-and-register-restaurant.js` (exit pattern)

```javascript
// Run the script
loginAndRegisterRestaurant().catch(error => {
  console.error('Script failed:', error);
  process.exit(1); // Explicit failure exit code
});

// Success path prints structured output:
console.log('\n✅ RESTAURANT REGISTRATION COMPLETED!');
console.log('Successfully created restaurant with:');
console.log('  ✓ Login to existing account');
// ... more output ...
console.log('\n📊 Restaurant Details:');
console.log(`  Name: ${TEST_DATA.restaurant.name}`);
console.log(`  Subdomain: ${subdomain}.pumpd.co.nz`);
console.log(`  Restaurant ID: ${restaurantId}`);
console.log(`  Account Email: ${TEST_DATA.login.email}`);

// OUTPUT FOR PARSING
console.log('\nSubdomain:', `${subdomain}.pumpd.co.nz`);
console.log('RestaurantID:', restaurantId);

// Success - close browser and exit
if (!DEBUG_MODE) {
  await browser.close();
  console.log('\n✨ Browser closed');
}

return { success: true, restaurantId, subdomain };
```

---

## Proposed Background Execution Design

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     HTTP Request Handler                        │
├─────────────────────────────────────────────────────────────────┤
│ 1. Validate request                                             │
│ 2. Create Job record in database (status: pending)              │
│ 3. Queue job (add to in-memory queue or database queue)         │
│ 4. Return JobID immediately (HTTP 202 Accepted)                │
│ 5. Exit request handler (NO BLOCKING)                          │
└────────────────���────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────────────┐
│             Background Job Queue Processor                      │
├─────────────────────────────────────────────────────────────────┤
│ 1. Dequeue job                                                  │
│ 2. Update status to "running"                                   │
│ 3. Execute script (with timeout)                                │
│ 4. Capture stdout/stderr                                        │
│ 5. Parse results                                                │
│ 6. Update database (status, results, timestamp)                 │
│ 7. Handle cleanup (temp files, etc.)                            │
└─────────────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────────────┐
│              Client Polling (Optional WebSocket)                │
├─────────────────────────────────────────────────────────────────┤
│ GET /api/jobs/{jobId}/status                                   │
│ Response: { status, progress, results, errors }                │
└─────────────────────────────────────────────────────────────────┘
```

### Database Schema (New)

```sql
-- Jobs table
CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_type VARCHAR(50) NOT NULL,  -- 'register_restaurant', 'upload_menu', 'configure_website'
  status VARCHAR(20) DEFAULT 'pending',  -- pending, running, completed, failed, timeout
  
  -- Input parameters
  restaurant_id VARCHAR(255),
  organisation_id VARCHAR(255) NOT NULL,
  parameters JSONB NOT NULL,  -- { email, password, name, ... }
  
  -- Execution details
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  duration_ms INTEGER,
  
  -- Output/Results
  stdout TEXT,
  stderr TEXT,
  error_message TEXT,
  parsed_results JSONB,  -- { subdomain, restaurantId, success, ... }
  
  -- Tracking
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 2,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Job status history (audit trail)
CREATE TABLE job_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  status VARCHAR(20),
  details TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_jobs_organisation ON jobs(organisation_id);
CREATE INDEX idx_jobs_restaurant ON jobs(restaurant_id);
CREATE INDEX idx_jobs_type_status ON jobs(job_type, status);
```

### Job Queue Service (Conceptual Implementation)

```javascript
// lib/job-queue-service.js
class JobQueueService {
  constructor(supabase, maxConcurrent = 2) {
    this.supabase = supabase;
    this.maxConcurrent = maxConcurrent;
    this.activeJobs = 0;
    this.queue = [];
    this.processingLoop = null;
  }

  async enqueueJob(jobType, restaurantId, organisationId, parameters) {
    // 1. Create job record in database
    const { data: job, error } = await this.supabase
      .from('jobs')
      .insert({
        job_type: jobType,
        restaurant_id: restaurantId,
        organisation_id: organisationId,
        parameters: parameters,
        status: 'pending'
      })
      .select()
      .single();

    if (error) throw error;

    // 2. Add to in-memory queue
    this.queue.push(job);

    // 3. Start processing if not already running
    if (!this.processingLoop) {
      this.startProcessing();
    }

    return job;
  }

  async startProcessing() {
    this.processingLoop = setInterval(async () => {
      while (this.queue.length > 0 && this.activeJobs < this.maxConcurrent) {
        const job = this.queue.shift();
        this.activeJobs++;
        
        // Process job in background (don't await)
        this.processJob(job).catch(err => {
          console.error(`[JobQueue] Error processing job ${job.id}:`, err);
        }).finally(() => {
          this.activeJobs--;
        });
      }
      
      // Stop processing loop if queue is empty and no active jobs
      if (this.queue.length === 0 && this.activeJobs === 0) {
        clearInterval(this.processingLoop);
        this.processingLoop = null;
      }
    }, 1000);
  }

  async processJob(job) {
    try {
      // 1. Update status to running
      await this.updateJobStatus(job.id, 'running', { started_at: new Date() });

      // 2. Execute script based on job type
      const result = await this.executeScript(job);

      // 3. Parse results
      const parsedResults = this.parseScriptOutput(job.job_type, result.stdout);

      // 4. Update database with results
      await this.updateJobStatus(job.id, 'completed', {
        completed_at: new Date(),
        stdout: result.stdout,
        stderr: result.stderr,
        parsed_results: parsedResults,
        duration_ms: Date.now() - new Date(job.created_at).getTime()
      });

      // 5. Trigger post-processing (update restaurant status, etc.)
      await this.postProcessJob(job, parsedResults);

    } catch (error) {
      const isTimeout = error.code === 'ETIMEDOUT' || error.killed;
      
      await this.updateJobStatus(job.id, isTimeout ? 'timeout' : 'failed', {
        completed_at: new Date(),
        error_message: error.message,
        stderr: error.stderr || '',
        duration_ms: Date.now() - new Date(job.created_at).getTime()
      });

      // Retry if applicable
      if (job.retry_count < job.max_retries) {
        await this.retryJob(job);
      }
    }
  }

  async executeScript(job) {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);

    let command;
    switch (job.job_type) {
      case 'register_restaurant':
        command = this.buildRegisterRestaurantCommand(job.parameters);
        break;
      case 'upload_menu':
        command = this.buildUploadMenuCommand(job.parameters);
        break;
      case 'configure_website':
        command = this.buildConfigureWebsiteCommand(job.parameters);
        break;
      default:
        throw new Error(`Unknown job type: ${job.job_type}`);
    }

    console.log(`[JobQueue] Executing job ${job.id}:`, command);

    const { stdout, stderr } = await execAsync(command, {
      env: process.env,
      timeout: this.getTimeout(job.job_type)
    });

    return { stdout, stderr };
  }

  getTimeout(jobType) {
    const timeouts = {
      'register_restaurant': 180000,  // 3 minutes
      'upload_menu': 120000,          // 2 minutes
      'configure_website': 240000,    // 4 minutes
      'option_sets': 180000,          // 3 minutes
      'item_tags': 180000            // 3 minutes
    };
    return timeouts[jobType] || 120000;
  }

  parseScriptOutput(jobType, stdout) {
    const parsed = { success: false };

    switch (jobType) {
      case 'register_restaurant':
        parsed.success = stdout.includes('RESTAURANT REGISTRATION COMPLETED');
        const subdomainMatch = stdout.match(/Subdomain:\s*([^\s]+)\.pumpd\.co\.nz/);
        const restaurantIdMatch = stdout.match(/RestaurantID:\s*(RES[A-Za-z0-9_-]+)/);
        if (subdomainMatch) parsed.subdomain = subdomainMatch[1];
        if (restaurantIdMatch) parsed.restaurantId = restaurantIdMatch[1];
        break;

      case 'upload_menu':
        parsed.success = stdout.includes('CSV import completed successfully') ||
                        stdout.includes('✅');
        parsed.itemsImported = (stdout.match(/Imported: (\d+) items/i) || [])[1];
        break;

      case 'configure_website':
        parsed.success = stdout.includes('Website configuration completed');
        parsed.lastStep = (stdout.match(/STEP \d+:[^\n]+/g) || []).pop();
        break;
    }

    return parsed;
  }

  async postProcessJob(job, results) {
    if (!results.success) return;

    // Update related tables based on job type
    switch (job.job_type) {
      case 'register_restaurant':
        // Update pumpd_restaurants table
        await this.supabase
          .from('pumpd_restaurants')
          .update({
            pumpd_restaurant_id: results.restaurantId,
            pumpd_subdomain: results.subdomain,
            registration_status: 'completed'
          })
          .eq('restaurant_id', job.restaurant_id);

        // Update restaurants table
        await this.supabase
          .from('restaurants')
          .update({ onboarding_status: 'registered' })
          .eq('id', job.restaurant_id);
        break;

      case 'upload_menu':
        // Update restaurants table
        await this.supabase
          .from('restaurants')
          .update({ onboarding_status: 'menu_imported' })
          .eq('id', job.restaurant_id);
        break;

      case 'configure_website':
        // Update pumpd_restaurants table
        await this.supabase
          .from('pumpd_restaurants')
          .update({ registration_status: 'completed' })
          .eq('restaurant_id', job.restaurant_id);
        break;
    }
  }

  async updateJobStatus(jobId, status, updates = {}) {
    await this.supabase
      .from('jobs')
      .update({
        status,
        updated_at: new Date(),
        ...updates
      })
      .eq('id', jobId);

    // Log to history
    await this.supabase
      .from('job_history')
      .insert({
        job_id: jobId,
        status,
        details: updates.error_message || ''
      });
  }

  async retryJob(job) {
    const newJob = {
      ...job,
      id: undefined,
      status: 'pending',
      retry_count: job.retry_count + 1,
      created_at: new Date()
    };

    this.queue.push(newJob);
    console.log(`[JobQueue] Retrying job (attempt ${newJob.retry_count}/${job.max_retries})`);
  }
}

module.exports = JobQueueService;
```

### HTTP Route Handler Refactored (Non-Blocking)

```javascript
// Before: BLOCKING (3+ minutes)
router.post('/register-restaurant', async (req, res) => {
  const { email, password, restaurantName, restaurantId } = req.body;
  
  try {
    // BLOCKING - HTTP response waits for script completion
    const { stdout, stderr } = await execAsync(command, {
      timeout: 180000
    });
    
    // Parse and update database
    // Return response
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// After: NON-BLOCKING (< 100ms)
router.post('/register-restaurant', async (req, res) => {
  const { email, password, restaurantName, restaurantId } = req.body;
  const organisationId = req.user?.organisationId;
  
  try {
    // 1. Create job record and queue it
    const job = await jobQueue.enqueueJob(
      'register_restaurant',
      restaurantId,
      organisationId,
      {
        email,
        password,
        restaurantName,
        address: restaurant.address || '',
        phone: restaurant.phone || ''
      }
    );

    // 2. Return immediately with job ID (HTTP 202 Accepted)
    res.status(202).json({
      success: true,
      message: 'Job queued for processing',
      jobId: job.id,
      statusUrl: `/api/jobs/${job.id}/status`
    });
    
  } catch (error) {
    console.error('[Registration] Error queuing job:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// New endpoint: Check job status
router.get('/jobs/:jobId/status', async (req, res) => {
  const { jobId } = req.params;
  const organisationId = req.user?.organisationId;
  
  try {
    const { data: job, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .eq('organisation_id', organisationId)
      .single();

    if (error) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json({
      success: true,
      jobId: job.id,
      status: job.status,  // pending, running, completed, failed, timeout
      startedAt: job.started_at,
      completedAt: job.completed_at,
      durationMs: job.duration_ms,
      error: job.error_message,
      results: job.parsed_results,
      progress: {
        status: job.status,
        message: this.getProgressMessage(job.status)
      }
    });

  } catch (error) {
    console.error('[Job Status] Error:', error);
    res.status(500).json({ error: error.message });
  }
});
```

---

## Current Execution Patterns - Issues Summary

| Issue | Impact | Current Behavior |
|-------|--------|------------------|
| **Synchronous Blocking** | HTTP timeouts on production | Request waits entire 2-4 minutes |
| **No Concurrency Control** | Multiple requests block each other | Sequential execution only |
| **No Progress Tracking** | Client unaware of progress | Blank screen for 3+ minutes |
| **Poor Timeout Handling** | No graceful degradation | Binary fail/retry |
| **Partial Failure Risk** | Inconsistent database state | Some updates on timeout, some not |
| **No Job Persistence** | Job history lost on process restart | No audit trail |
| **Output Fragile** | Parsing breaks with minor changes | Regex patterns brittle |
| **No Retry Logic** | Single failure = user retry required | Manual process restart |
| **Resource Blocking** | Long processes block other requests | Thread pool exhaustion |

---

## Proposed Background Pattern - Benefits

| Benefit | Implementation | Impact |
|---------|----------------|--------|
| **Non-Blocking HTTP** | Queue job, return 202 | Response in < 100ms |
| **Progress Visibility** | WebSocket or polling | Real-time status updates |
| **Concurrency Control** | Max concurrent workers | Better resource utilization |
| **Retry Logic** | Automatic retries with backoff | Higher success rate |
| **Job Persistence** | Database job records | Full audit trail |
| **Graceful Degradation** | Partial success tracking | Better error messages |
| **Resource Isolation** | Background worker process | No request blocking |
| **Monitoring** | Job metrics and dashboards | Observability |

---

## Recommendations

### Immediate (Phase 1)

1. **Implement Job Queue Service**
   - Create database jobs table with schema above
   - Implement JobQueueService class
   - Refactor registration endpoints to use queue

2. **Add Status Check Endpoint**
   - `/api/jobs/{jobId}/status` for polling
   - Include progress and error details

3. **Client Updates**
   - Show job ID to user
   - Implement polling with exponential backoff
   - Display progress messages

### Short-term (Phase 2)

1. **Add Job Persistence**
   - Implement job history table
   - Create audit trail of status changes
   - Add metrics/monitoring

2. **Implement Retry Logic**
   - Automatic retry with exponential backoff
   - Max retry configuration per job type
   - Dead letter queue for failed jobs

3. **WebSocket Real-time Updates** (Optional)
   - Replace polling with WebSocket for better UX
   - Reduce server load compared to polling

### Medium-term (Phase 3)

1. **External Queue Service**
   - Migrate from in-memory queue to Redis/Bull
   - Enables horizontal scaling
   - Separates job processing to dedicated workers

2. **Monitoring & Alerting**
   - Job queue metrics
   - Failed job alerts
   - Performance dashboards

3. **Job Prioritization**
   - Priority levels for different job types
   - Queue ordering strategy
   - SLA-based processing

---

## Potential Concerns & Blockers

### 1. Browser Instance Management
**Concern**: Each Playwright script launches a browser instance. Concurrent scripts could consume excessive memory.

**Mitigation**:
- Limit concurrent jobs (e.g., max 2-3 concurrent)
- Monitor memory usage per job
- Implement browser pooling/reuse (future enhancement)
- Container resource limits on Railway

### 2. Script Output Parsing Fragility
**Concern**: Current parsing uses regex/string matching. Minor script changes break parsing.

**Recommendation**:
- Add structured output format (JSON logging)
- Update scripts to log JSON to stdout
- Parser becomes JSON.parse() instead of regex

**Example**:
```javascript
// In script - structured output
console.log(JSON.stringify({
  type: 'completion',
  status: 'success',
  subdomain: subdomain,
  restaurantId: restaurantId
}));
```

### 3. Timeout Edge Cases
**Concern**: Script timeout != HTTP timeout. Need to ensure process cleanup.

**Recommendation**:
- Set exec timeout slightly less than HTTP timeout
- Force kill process if not dead after timeout
- Log killed process metrics

### 4. Database Performance
**Concern**: Jobs table + history table could grow large.

**Recommendation**:
- Implement data retention policy (e.g., delete after 90 days)
- Add indexes on frequently queried columns
- Archive old jobs to separate table

### 5. Job Queue Recovery
**Concern**: Server restart loses in-memory queue.

**Recommendation**:
- Use database as queue source of truth
- On startup, requeue failed/pending jobs
- Implement graceful shutdown (finish active jobs)

### 6. Concurrency vs Headless Browser Conflicts
**Concern**: Multiple browsers running concurrently may conflict with Pumpd platform.

**Recommendation**:
- Test concurrent execution on staging
- Consider sequential-by-restaurant-ID constraint
- Monitor for rate limiting from Pumpd API

---

## Implementation Priority

**High Priority** (Week 1):
1. Database jobs table
2. JobQueueService implementation
3. Refactor 1-2 endpoints to use queue
4. Status check endpoint
5. Basic polling client

**Medium Priority** (Week 2-3):
1. Refactor remaining endpoints
2. Retry logic
3. Job history/audit
4. Structured logging in scripts

**Low Priority** (Week 4+):
1. WebSocket real-time updates
2. External queue service (Redis/Bull)
3. Metrics and monitoring
4. Browser instance pooling

---

## Testing Strategy

### Unit Tests
- JobQueueService methods
- Script output parsing
- Job status transitions

### Integration Tests
- Queue → Execution → Database updates
- Error handling and retries
- Timeout scenarios

### Load Tests
- Multiple concurrent jobs
- Queue saturation
- Memory/CPU under load
- Browser instance cleanup

### E2E Tests
- Full registration flow (queue to completion)
- Status polling updates
- Job failure and retry

---

## Conclusion

The current synchronous execution pattern creates significant operational challenges, particularly around HTTP timeouts on production deployments. A background job queue pattern provides:

1. **Immediate responsiveness** to HTTP requests
2. **Better resource utilization** through concurrency control
3. **Full audit trail** of all operations
4. **Graceful degradation** with retry logic
5. **Operational visibility** through job status tracking

The implementation is straightforward and can be done incrementally, starting with a simple in-memory queue and progressing to a more sophisticated external queue service as needed.

---

## References

- Child Process Documentation: https://nodejs.org/api/child_process.html
- Playwright Configuration: scripts/lib/browser-config.cjs
- Registration Routes: UberEats-Image-Extractor/src/routes/registration-routes.js
- Script Examples: scripts/restaurant-registration/*.js
