# Investigation Task 2: Premium Extraction Service & Batch Async Processing

**Date**: 2025-12-20
**Status**: COMPLETED

---

## Async Job Architecture

### Job Creation & Tracking
- `PremiumExtractionService` maintains an in-memory `Map()` called `activeJobs` to track running jobs
- Each job gets a unique ID via `generateJobId()`: `premium_${timestamp}_${uuid}`
- Job info includes status, progress phases, results, and error details
- Database persistence through `databaseService.createExtractionJob()` for long-term storage

### Job Lifecycle
```
initializing → running → completed/failed
       ↓
   phases:
   - extracting_categories
   - extracting_items
   - cleaning_urls
   - extracting_option_sets
   - deduplicating_option_sets
   - validating_images
   - saving_to_database
```

---

## How Async Extractions Work

### Triggering Async Extractions
```javascript
POST /api/extract-menu-premium
{
  "storeUrl": "https://www.ubereats.com/store/...",
  "restaurantId": "optional-existing-restaurant-id",
  "restaurantName": "Restaurant Name",
  "async": true,
  "extractOptionSets": true,
  "validateImages": true
}
```

### Response (Immediate)
```javascript
{
  "success": true,
  "jobId": "premium_1766032877443_abc12345",
  "estimatedTime": 180,
  "statusUrl": "/api/premium-extract-status/{jobId}",
  "resultsUrl": "/api/premium-extract-results/{jobId}",
  "message": "Premium extraction started in background"
}
```

### Background Execution
- `extractPremiumMenu()` returns immediately with `async: true`
- `runExtraction(jobId)` runs in background via `.catch()` handler
- No awaiting - true fire-and-forget pattern
- Job status updates persist to database for resilience

---

## Rate Limiting & Concurrency Considerations

### Rate Limiter Service
- Token bucket algorithm with sliding window
- Configurable via environment variables:
  - `FIRECRAWL_RATE_LIMIT`: Default 10 requests per window
  - `FIRECRAWL_RATE_WINDOW`: Default 60,000ms (1 minute)
- Automatically waits if rate limit is exceeded
- Tracks request timestamps and percentage capacity

### Concurrency Management
- `FIRECRAWL_CONCURRENCY_LIMIT`: Default 2 concurrent category extractions
- Uses `Promise.race()` pattern for optimal slot utilization
- Active promises tracked in `Map()` to coordinate category processing
- Each category waits for rate limiter slot before making API call

---

## Job Status Polling

### Frontend Polling Hooks (React Query)
```javascript
// Refetch every 30 seconds for jobs list
refetchInterval: 30000

// Refetch every 10 seconds for individual job detail
refetchInterval: 10000
```

### Status Endpoints
```
GET /api/premium-extract-status/:jobId
→ Returns current phase, progress counters, elapsed time, error

GET /api/premium-extract-results/:jobId
→ Returns full extraction results if job is completed
```

### Status Object Structure
```javascript
{
  "jobId": "premium_...",
  "status": "running|completed|failed",
  "menuId": "uuid",
  "progress": {
    "phase": "extracting_items",
    "categoriesExtracted": 5,
    "itemsExtracted": 234,
    "optionSetsExtracted": 89,
    "currentCategory": "Burgers"
  },
  "startTime": 1766032877443,
  "elapsedTime": 45000,
  "url": "https://...",
  "restaurantName": "Restaurant Name"
}
```

---

## How to Trigger Multiple Extractions in Parallel

### Standard Batch Extraction Endpoint
```javascript
POST /api/batch-extract-categories
{
  "url": "https://www.ubereats.com/store/...",
  "categories": [
    { "name": "Appetizers" },
    { "name": "Mains" }
  ],
  "async": true,
  "restaurantName": "Optional Name"
}
```

### Multiple Concurrent Extractions Pattern
- Create multiple async jobs in quick succession
- Each job has independent `jobId`, progress tracking, database records
- Frontend polls each job separately or list endpoint
- No hard limit on concurrent jobs (limited by Firecrawl API limits)

---

## Recommended Approach for Fire-and-Forget Batch Extractions

### Endpoint Pattern
```javascript
POST /api/batch-trigger-extractions
{
  "extractions": [
    {
      "storeUrl": "url1",
      "restaurantId": "id1",
      "restaurantName": "name1"
    },
    {
      "storeUrl": "url2",
      "restaurantId": "id2",
      "restaurantName": "name2"
    }
  ],
  "async": true
}
```

### Implementation Pattern
1. Create multiple job IDs upfront
2. Store all job IDs in array
3. Fire all extractions concurrently (don't await)
4. Return array of job IDs for polling
5. Frontend polls `/api/premium-extract-status/{jobId}` for each

### Rate Limiting Handling
- Stagger requests by ~100ms between trigger calls
- Rate limiter prevents Firecrawl API overload
- Backend automatically queues if rate limit hit

### Error Resilience
- Database persistence survives server restarts
- Jobs continue running even if connection lost
- Frontend can resume polling from any job

---

## Existing UI Components for Extraction Progress

### ScrapeJobProgressCard Component
- Displays job status with animated progress bar
- Shows phase information and step breakdown
- Manual refresh button
- Start/Cancel/Delete actions
- Compact and expanded views

### Progress Visualization
- Status badges with color coding
- Percentage-based progress bar with shimmer animation
- Lead/item extraction counters
- Time elapsed display

---

## Database Persistence

### Job Storage
- `extraction_jobs` table tracks all async jobs
- Fields: `job_id`, `status`, `progress` (JSON), `result_data`, `extracted_data`, `error_message`, `completed_at`
- Survives server restarts (jobs lookup checks database if not in memory)

### Results Storage
- Menu items, categories, option sets saved to database
- Menus linked to restaurants
- Option sets deduped and linked via junction tables

---

## Key Configuration Variables

```
FIRECRAWL_RATE_LIMIT=10              # Max API calls per minute
FIRECRAWL_RATE_WINDOW=60000          # Window in milliseconds
FIRECRAWL_CONCURRENCY_LIMIT=2        # Max categories processed in parallel
FIRECRAWL_CACHE_MAX_AGE=172800       # Cache retention (2 days)
```

---

## Performance Considerations

- **Category Extraction Phase**: 30-60 seconds per category
- **Option Sets Extraction**: Additional 20-40% time overhead
- **Concurrency Bottleneck**: Rate limiter at 10 req/min = ~2-3 concurrent restaurants max
- **Memory Impact**: Active jobs stored in-memory Map (small footprint, ~5KB per job)
- **Cleanup**: `cleanupJobs()` removes jobs older than 1 hour
