# Async Batch Extraction Implementation Specification
> Implementation guide for solving timeout issues in the menu-extractor-batch agent by converting the synchronous batch extraction process to an asynchronous job-based system with status polling.

## High-Level Objective

Enable the menu-extractor-batch agent to successfully extract menu data from large UberEats menus (30+ items) without timing out, by implementing an asynchronous extraction system that allows the agent to start a job, poll for status, and retrieve results when complete.

## Mid-Level Objectives

- Convert the synchronous `/api/batch-extract-categories` endpoint to support asynchronous mode with job tracking
- Add new endpoints for checking job status and retrieving completed results
- Update the menu-extractor-batch agent to use the new async workflow
- Maintain backward compatibility with existing synchronous mode
- Ensure the orchestration workflow can track progress and handle failures gracefully

## Implementation Notes

### Technical Context
- The internal app runs on port 3007 and uses Express.js
- Current timeout issues occur because batch extraction can take 5-10 minutes for large menus
- The server continues processing after agent timeout, causing duplicate requests
- Firecrawl API is used for web scraping with 2 concurrent browser limit on current tier
- Job state needs to be stored in memory (no database currently used)

### Dependencies and Requirements
- Node.js/Express server at `/automation/UberEats-Image-Extractor/server.js`
- Firecrawl service at `/automation/UberEats-Image-Extractor/src/services/firecrawl-service.js`
- Menu-extractor-batch agent at `/.claude/agents/menu-extractor-batch.md`
- Orchestration documentation at `/automation/planning/restaurant-registration-ideal-flow.md`

### Coding Standards
- Use async/await for asynchronous operations
- Maintain consistent error handling patterns
- Preserve existing API response structures
- Use descriptive variable names and comments
- Follow existing file naming conventions

## Context

### Beginning Context
Files that exist at start:
- `/automation/UberEats-Image-Extractor/server.js` - Express server with synchronous endpoints
- `/automation/UberEats-Image-Extractor/src/services/firecrawl-service.js` - Firecrawl integration service
- `/.claude/agents/menu-extractor-batch.md` - Agent using synchronous workflow
- `/automation/planning/restaurant-registration-ideal-flow.md` - Orchestration documentation

### Ending Context
Files that will exist at end:
- `/automation/UberEats-Image-Extractor/server.js` - Updated with async endpoints and job management
- `/automation/UberEats-Image-Extractor/src/services/firecrawl-service.js` - No changes needed
- `/.claude/agents/menu-extractor-batch.md` - Updated to use async workflow
- `/automation/planning/restaurant-registration-ideal-flow.md` - Updated documentation
- `/automation/planning/async-batch-extraction-implementation-spec.md` - This specification document

## Problem Analysis

### Current Issue
The menu-extractor-batch agent encounters a critical timeout issue when extracting large menus:

1. **Request Timeline**:
   - Agent sends POST to `/api/batch-extract-categories` with 360s timeout (-m 360)
   - Server processes categories sequentially, taking 30-60s per category
   - For 12 categories, this can take 6-12 minutes
   - Agent's curl request times out after 2 minutes (despite -m 360 setting)
   - Server continues processing in background

2. **Cascading Failures**:
   - Agent receives timeout error and thinks extraction failed
   - Agent retries with a second request while first is still running
   - Server becomes overloaded with duplicate requests
   - Agent eventually gives up and processes partial data
   - Firecrawl API credits are wasted on duplicate requests

3. **Root Cause**:
   - HTTP request timeouts at network/proxy level override curl timeout
   - Synchronous endpoint design doesn't fit long-running operations
   - No mechanism for progress tracking or job status checking

### Solution Overview
Implement async job-based extraction with three phases:
1. **Start Job**: Return immediately with job ID
2. **Poll Status**: Check progress periodically
3. **Get Results**: Retrieve completed data

## Low-Level Tasks

### 1. Add Job Management System to server.js
```
What prompt would you run to complete this task?
"Add an in-memory job management system to track async extraction jobs"

What file do you want to UPDATE?
/automation/UberEats-Image-Extractor/server.js

What function do you want to CREATE?
- generateJobId() - Creates unique job IDs using timestamp + random string
- jobStore object - In-memory storage for job state
- startBackgroundExtraction() - Initiates async extraction process
- getJobStatus() - Returns current job status
- getJobResults() - Returns completed job results

What are details you want to add to drive the code changes?
Add after line 32 (before middleware setup):

```javascript
// Job management for async operations
const crypto = require('crypto');

// In-memory job store (in production, use Redis or database)
const jobStore = new Map();

// Generate unique job ID
function generateJobId() {
  const timestamp = Date.now();
  const random = crypto.randomBytes(8).toString('hex');
  return `batch_${timestamp}_${random}`;
}

// Get job status
function getJobStatus(jobId) {
  const job = jobStore.get(jobId);
  if (!job) {
    return null;
  }
  
  return {
    jobId: job.jobId,
    state: job.state, // 'running', 'completed', 'failed'
    totalCategories: job.totalCategories,
    completedCategories: job.completedCategories,
    failedCategories: job.failedCategories,
    currentCategory: job.currentCategory,
    startTime: job.startTime,
    endTime: job.endTime,
    error: job.error
  };
}

// Get job results
function getJobResults(jobId) {
  const job = jobStore.get(jobId);
  if (!job || job.state !== 'completed') {
    return null;
  }
  
  return {
    jobId: job.jobId,
    state: job.state,
    data: job.data,
    categories: job.categories,
    stats: job.stats
  };
}

// Clean up old jobs (run periodically)
function cleanupOldJobs() {
  const oneHourAgo = Date.now() - (60 * 60 * 1000);
  
  for (const [jobId, job] of jobStore.entries()) {
    if (job.endTime && job.endTime < oneHourAgo) {
      jobStore.delete(jobId);
    }
  }
}

// Run cleanup every 30 minutes
setInterval(cleanupOldJobs, 30 * 60 * 1000);
```

### 2. Create Background Extraction Function
```
What prompt would you run to complete this task?
"Create the startBackgroundExtraction function that processes categories asynchronously"

What file do you want to UPDATE?
/automation/UberEats-Image-Extractor/server.js

What function do you want to CREATE?
startBackgroundExtraction(jobId, url, categories)

What are details you want to add to drive the code changes?
Add after the cleanupOldJobs interval (around line 90):

```javascript
// Start background extraction process
async function startBackgroundExtraction(jobId, url, categories) {
  // Initialize job state
  const job = {
    jobId: jobId,
    state: 'running',
    url: url,
    totalCategories: categories.length,
    completedCategories: 0,
    failedCategories: 0,
    currentCategory: null,
    startTime: Date.now(),
    endTime: null,
    data: null,
    categories: {
      successful: [],
      failed: []
    },
    error: null
  };
  
  jobStore.set(jobId, job);
  
  try {
    // Detect platform type
    const isUberEats = url.includes('ubereats.com');
    const isDoorDash = url.includes('doordash.com');
    
    // Process each category
    const categoryResults = [];
    const failedCategories = [];
    
    for (const category of categories) {
      try {
        // Update current category
        job.currentCategory = category.name;
        jobStore.set(jobId, job);
        
        console.log(`[Job ${jobId}] Extracting category: ${category.name}`);
        
        // Create category-specific schema (same as existing code)
        const categorySchema = {
          "type": "object",
          "properties": {
            "categoryName": {
              "type": "string", 
              "description": `The name of this specific menu category: "${category.name}"`
            },
            "menuItems": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "dishName": { "type": "string", "description": "The name of the dish as displayed on the menu" },
                  "dishPrice": { "type": "number", "description": "The price of the dish as a numerical value" },
                  "dishDescription": { "type": "string", "description": "Full description of the dish including ingredients and preparation style" },
                  "imageURL": { "type": "string", "description": "URL to the highest resolution image of the dish available" },
                  "tags": { "type": "array", "items": { "type": "string" }, "description": "Any tags or attributes for this dish" }
                },
                "required": ["dishName", "dishPrice"]
              }
            }
          },
          "required": ["categoryName", "menuItems"]
        };
        
        // Create category-specific prompt
        const categoryPrompt = `Focus ONLY on extracting menu items from the category "${category.name}" on this ${isUberEats ? 'UberEats' : isDoorDash ? 'DoorDash' : ''} page.
        
1. Navigate to the section for category "${category.name}" ${category.position ? `(approximately at position ${category.position} from the top)` : ''}
2. ${category.selector ? `Look for elements matching the selector "${category.selector}"` : 'Locate the category header or section'}
3. Extract ONLY the menu items within this specific category
4. For each item, get the name, price, description, and image URL (if available)
5. If an item has image, click to open its details to get the high-resolution image
6. DO NOT include items from other categories
7. Ensure the categoryName field exactly matches "${category.name}"`;
        
        // Prepare category-specific payload
        const categoryPayload = {
          url: url,
          formats: ["json"],
          jsonOptions: {
            schema: categorySchema,
            prompt: categoryPrompt
          },
          agent: { model: "FIRE-1" },
          onlyMainContent: true,
          waitFor: 2000,
          blockAds: true,
          timeout: 180000
        };
        
        // Make request to Firecrawl API
        const axiosInstance = axios.create({
          timeout: 240000,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${FIRECRAWL_API_KEY}`
          }
        });
        
        const categoryResponse = await axiosInstance.post(`${FIRECRAWL_API_URL}/v1/scrape`, categoryPayload);
        
        if (!categoryResponse.data.success) {
          throw new Error(`API returned error: ${categoryResponse.data.error || 'Unknown error'}`);
        }
        
        // Extract category result
        let categoryResult = null;
        if (categoryResponse.data.data && categoryResponse.data.data.json) {
          categoryResult = categoryResponse.data.data.json;
        }
        
        if (categoryResult && categoryResult.menuItems && Array.isArray(categoryResult.menuItems)) {
          console.log(`[Job ${jobId}] Successfully extracted ${categoryResult.menuItems.length} items for category "${category.name}"`);
          categoryResults.push(categoryResult);
          job.completedCategories++;
          job.categories.successful.push(category.name);
        } else {
          console.warn(`[Job ${jobId}] No menu items found for category "${category.name}"`);
          failedCategories.push({ name: category.name, error: 'No menu items found' });
          job.failedCategories++;
          job.categories.failed.push({ name: category.name, error: 'No menu items found' });
        }
        
      } catch (categoryError) {
        console.error(`[Job ${jobId}] Error extracting category "${category.name}":`, categoryError.message);
        failedCategories.push({ name: category.name, error: categoryError.message });
        job.failedCategories++;
        job.categories.failed.push({ name: category.name, error: categoryError.message });
      }
      
      // Update job state after each category
      jobStore.set(jobId, job);
    }
    
    // Aggregate results
    const menuItems = categoryResults.flatMap(result => 
      result.menuItems.map(item => ({
        ...item,
        categoryName: result.categoryName
      }))
    );
    
    console.log(`[Job ${jobId}] Successfully extracted a total of ${menuItems.length} menu items across ${categoryResults.length} categories`);
    
    // Update job with final results
    job.state = 'completed';
    job.endTime = Date.now();
    job.data = { menuItems: menuItems };
    job.stats = {
      totalItems: menuItems.length,
      successfulCategories: categoryResults.length,
      failedCategories: failedCategories.length,
      processingTime: job.endTime - job.startTime
    };
    
    jobStore.set(jobId, job);
    
  } catch (error) {
    console.error(`[Job ${jobId}] Fatal error during extraction:`, error.message);
    
    // Update job with error
    job.state = 'failed';
    job.endTime = Date.now();
    job.error = error.message;
    
    jobStore.set(jobId, job);
  }
}
```
```

### 3. Update /api/batch-extract-categories Endpoint
```
What prompt would you run to complete this task?
"Modify the batch-extract-categories endpoint to support async mode"

What file do you want to UPDATE?
/automation/UberEats-Image-Extractor/server.js

What function do you want to UPDATE?
The POST /api/batch-extract-categories endpoint handler (starting around line 1133)

What are details you want to add to drive the code changes?
Replace the endpoint implementation with:

```javascript
app.post('/api/batch-extract-categories', async (req, res) => {
  const { url, categories, async = false } = req.body;
  
  // Validate URL
  if (!validateRestaurantUrl(url, res)) {
    return;
  }
  
  // Validate categories
  if (!categories || !Array.isArray(categories) || categories.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'At least one category is required'
    });
  }
  
  // Check API key
  if (!FIRECRAWL_API_KEY) {
    return res.status(500).json({
      success: false,
      error: 'Firecrawl API key is not configured'
    });
  }
  
  console.log(`Starting batch category extraction for URL: ${url}`);
  console.log(`Extracting ${categories.length} categories: ${categories.map(c => c.name).join(', ')}`);
  console.log(`Mode: ${async ? 'asynchronous' : 'synchronous'}`);
  
  // Asynchronous mode - return job ID immediately
  if (async) {
    const jobId = generateJobId();
    
    // Start extraction in background
    startBackgroundExtraction(jobId, url, categories);
    
    // Calculate estimated time (30 seconds per category)
    const estimatedSeconds = categories.length * 30;
    
    // Return job information immediately
    return res.json({
      success: true,
      jobId: jobId,
      message: 'Batch extraction started',
      estimatedTime: estimatedSeconds,
      statusUrl: `/api/batch-extract-status/${jobId}`,
      resultsUrl: `/api/batch-extract-results/${jobId}`
    });
  }
  
  // Original synchronous mode - keep existing implementation
  try {
    // ... (keep all existing synchronous code from line 1160 to 1385)
    // This preserves backward compatibility
  } catch (error) {
    // ... (keep existing error handling)
  }
});
```
```

### 4. Add Status Checking Endpoint
```
What prompt would you run to complete this task?
"Create a new endpoint for checking batch extraction job status"

What file do you want to UPDATE?
/automation/UberEats-Image-Extractor/server.js

What function do you want to CREATE?
GET /api/batch-extract-status/:jobId endpoint

What are details you want to add to drive the code changes?
Add after the /api/batch-extract-categories endpoint (around line 1386):

```javascript
/**
 * API endpoint for checking batch extraction job status
 */
app.get('/api/batch-extract-status/:jobId', (req, res) => {
  const { jobId } = req.params;
  
  if (!jobId) {
    return res.status(400).json({
      success: false,
      error: 'Job ID is required'
    });
  }
  
  console.log(`Checking status for job: ${jobId}`);
  
  const status = getJobStatus(jobId);
  
  if (!status) {
    return res.status(404).json({
      success: false,
      error: 'Job not found'
    });
  }
  
  // Calculate progress percentage
  const progressPercentage = status.totalCategories > 0 
    ? Math.round((status.completedCategories + status.failedCategories) / status.totalCategories * 100)
    : 0;
  
  // Calculate elapsed time
  const elapsedTime = status.endTime 
    ? status.endTime - status.startTime
    : Date.now() - status.startTime;
  
  return res.json({
    success: true,
    jobId: status.jobId,
    status: status.state,
    progress: {
      percentage: progressPercentage,
      totalCategories: status.totalCategories,
      completedCategories: status.completedCategories,
      failedCategories: status.failedCategories,
      currentCategory: status.currentCategory
    },
    timing: {
      startTime: new Date(status.startTime).toISOString(),
      elapsedSeconds: Math.floor(elapsedTime / 1000),
      estimatedRemainingSeconds: status.state === 'running' 
        ? Math.floor((status.totalCategories - status.completedCategories - status.failedCategories) * 30)
        : 0
    },
    error: status.error
  });
});
```
```

### 5. Add Results Retrieval Endpoint
```
What prompt would you run to complete this task?
"Create a new endpoint for retrieving completed batch extraction results"

What file do you want to UPDATE?
/automation/UberEats-Image-Extractor/server.js

What function do you want to CREATE?
GET /api/batch-extract-results/:jobId endpoint

What are details you want to add to drive the code changes?
Add after the status endpoint (around line 1435):

```javascript
/**
 * API endpoint for retrieving batch extraction job results
 */
app.get('/api/batch-extract-results/:jobId', (req, res) => {
  const { jobId } = req.params;
  
  if (!jobId) {
    return res.status(400).json({
      success: false,
      error: 'Job ID is required'
    });
  }
  
  console.log(`Retrieving results for job: ${jobId}`);
  
  const results = getJobResults(jobId);
  
  if (!results) {
    // Check if job exists but isn't complete
    const status = getJobStatus(jobId);
    
    if (!status) {
      return res.status(404).json({
        success: false,
        error: 'Job not found'
      });
    }
    
    if (status.state === 'running') {
      return res.status(202).json({
        success: false,
        error: 'Job is still running',
        status: status.state,
        progress: {
          percentage: Math.round((status.completedCategories + status.failedCategories) / status.totalCategories * 100)
        }
      });
    }
    
    if (status.state === 'failed') {
      return res.status(500).json({
        success: false,
        error: 'Job failed',
        details: status.error
      });
    }
  }
  
  // Return the complete results
  return res.json({
    success: true,
    data: results.data,
    categories: results.categories,
    stats: results.stats
  });
});
```
```

### 6. Update menu-extractor-batch Agent
```
What prompt would you run to complete this task?
"Update the menu-extractor-batch agent to use the new async workflow"

What file do you want to UPDATE?
/.claude/agents/menu-extractor-batch.md

What function do you want to UPDATE?
Step 2 - Phase 2: Extract Categories in Batch

What are details you want to add to drive the code changes?
Replace the entire Step 2 section (lines 35-53) with:

```markdown
2. **Phase 2: Extract Categories in Batch (Async Mode)**:
   - Start async extraction job:
   ```bash
   curl -X POST http://localhost:3007/api/batch-extract-categories \
      -H "Content-Type: application/json" \
      -d '{
        "url": "[ubereats_url]",
        "categories": [category_array],
        "async": true
      }' \
      -o [restaurant_name]_job_response.json
   ```
   - Extract job ID from response:
   ```bash
   JOB_ID=$(jq -r '.jobId' [restaurant_name]_job_response.json)
   ESTIMATED_TIME=$(jq -r '.estimatedTime' [restaurant_name]_job_response.json)
   echo "Extraction job started: $JOB_ID"
   echo "Estimated time: $ESTIMATED_TIME seconds"
   ```
   
   - Poll for completion:
   ```bash
   # Poll every 15 seconds until complete
   while true; do
     curl -X GET http://localhost:3007/api/batch-extract-status/$JOB_ID \
       -o [restaurant_name]_status.json
     
     STATUS=$(jq -r '.status' [restaurant_name]_status.json)
     PROGRESS=$(jq -r '.progress.percentage' [restaurant_name]_status.json)
     CURRENT=$(jq -r '.progress.currentCategory' [restaurant_name]_status.json)
     
     echo "Status: $STATUS - Progress: $PROGRESS% - Current: $CURRENT"
     
     if [ "$STATUS" = "completed" ] || [ "$STATUS" = "failed" ]; then
       break
     fi
     
     sleep 15
   done
   ```
   
   - Retrieve results:
   ```bash
   if [ "$STATUS" = "completed" ]; then
     curl -X GET http://localhost:3007/api/batch-extract-results/$JOB_ID \
       -o [restaurant_name]_batch_response.json
     
     echo "Extraction completed successfully"
   else
     echo "Extraction failed - check status response for details"
     exit 1
   fi
   ```
   
   - IMPORTANT: The async mode prevents timeouts for large menus
   - Job tracking ensures no duplicate processing
   - Progress updates provide visibility into extraction status
   - Common issues:
     - 402 error: Firecrawl API key issue
     - Individual category failures are tracked separately
     - Job results are stored for 1 hour after completion
```
```

### 7. Update Agent Best Practices
```
What prompt would you run to complete this task?
"Update the best practices section to reflect the async workflow"

What file do you want to UPDATE?
/.claude/agents/menu-extractor-batch.md

What function do you want to UPDATE?
Best Practices section (lines 99-111)

What are details you want to add to drive the code changes?
Add these lines after "Wait for complete batch extraction response before proceeding" (line 101):

```markdown
- Use async mode for all batch extractions to prevent timeouts
- Poll status endpoint every 15-30 seconds for progress updates
- Report progress to orchestrator: "Extracting category X of Y"
- Save job ID for potential recovery/retry scenarios
- Check both successful and failed categories in results
```
```

### 8. Update Orchestration Documentation
```
What prompt would you run to complete this task?
"Update the orchestration documentation to reflect the async batch extraction process"

What file do you want to UPDATE?
/automation/planning/restaurant-registration-ideal-flow.md

What function do you want to UPDATE?
Process for menu-extractor-batch section (lines 221-228)

What are details you want to add to drive the code changes?
Replace the process description with:

```markdown
**Process for menu-extractor-batch**:
- Uses the 'Bash' tool to interact with API endpoints of an internal app on port 3007
- Phase 1: Scans menu categories using the /api/scan-categories endpoint
- Phase 2: Starts async batch extraction job using /api/batch-extract-categories with async=true
- Phase 3: Polls /api/batch-extract-status/:jobId every 15 seconds for progress updates
- Phase 4: Retrieves results from /api/batch-extract-results/:jobId when complete
- Processes aggregated response containing all menu items from all categories
- Makes a POST request to the /generate-csv endpoint and saves CSV files to @automation/extracted-menus/
- Follows same naming patterns and image download process as direct method
- Average processing time: ~300 seconds (runs async without timeout issues)
```
```

### 9. Add Server Startup Log
```
What prompt would you run to complete this task?
"Update server startup logs to include new async endpoints"

What file do you want to UPDATE?
/automation/UberEats-Image-Extractor/server.js

What function do you want to UPDATE?
Server startup section (lines 1947-1957)

What are details you want to add to drive the code changes?
Add these lines after line 1954:

```javascript
  console.log(`- Batch Extract Categories (Async): http://localhost:${PORT}/api/batch-extract-categories`);
  console.log(`- Batch Extract Status: http://localhost:${PORT}/api/batch-extract-status/:jobId`);
  console.log(`- Batch Extract Results: http://localhost:${PORT}/api/batch-extract-results/:jobId`);
```
```

## Testing Strategy

### 1. Test Async Job Creation
```bash
# Start an async extraction job
curl -X POST http://localhost:3007/api/batch-extract-categories \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.ubereats.com/nz/store/test-restaurant/123",
    "categories": [{"name": "Appetizers"}, {"name": "Mains"}],
    "async": true
  }'

# Expected: Returns job ID and status URLs
```

### 2. Test Status Checking
```bash
# Check job status
curl http://localhost:3007/api/batch-extract-status/[JOB_ID]

# Expected: Returns progress percentage and current category
```

### 3. Test Results Retrieval
```bash
# Get completed results
curl http://localhost:3007/api/batch-extract-results/[JOB_ID]

# Expected: Returns menu items when job is complete
```

### 4. Test Backward Compatibility
```bash
# Test synchronous mode still works
curl -X POST http://localhost:3007/api/batch-extract-categories \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.ubereats.com/nz/store/test-restaurant/123",
    "categories": [{"name": "Appetizers"}],
    "async": false
  }'

# Expected: Waits for completion and returns results directly
```

## Success Criteria

1. **No Timeouts**: Agent can extract 50+ menu items without timing out
2. **Progress Visibility**: Orchestrator can track extraction progress
3. **No Duplicate Requests**: Job ID prevents duplicate processing
4. **Error Recovery**: Failed categories don't stop entire extraction
5. **Backward Compatible**: Existing synchronous mode continues to work
6. **Memory Efficient**: Old jobs are cleaned up after 1 hour

## Implementation Order

1. First implement server-side changes (Tasks 1-5)
2. Test async endpoints manually
3. Update agent to use new workflow (Tasks 6-7)
4. Test agent with real UberEats URL
5. Update documentation (Tasks 8-9)
6. Perform full orchestration test

## Monitoring and Debugging

### Key Log Messages
- `[Job batch_123_abc] Extracting category: Appetizers`
- `[Job batch_123_abc] Successfully extracted 15 items for category "Appetizers"`
- `[Job batch_123_abc] Error extracting category "Desserts": timeout`
- `[Job batch_123_abc] Successfully extracted a total of 45 menu items across 3 categories`

### Common Issues and Solutions
- **Job Not Found**: Job may have been cleaned up after 1 hour
- **Still Running After Long Time**: Check server logs for Firecrawl API errors
- **0% Progress**: Categories may all be failing - check job status error field
- **Partial Results**: Some categories failed but others succeeded - this is acceptable

## Future Enhancements

1. **Persistent Storage**: Use Redis or database for job storage
2. **Parallel Processing**: Extract multiple categories concurrently
3. **Webhook Support**: Notify completion via webhook
4. **Resume Capability**: Allow resuming failed jobs from last successful category
5. **Rate Limiting**: Implement proper rate limiting for Firecrawl API