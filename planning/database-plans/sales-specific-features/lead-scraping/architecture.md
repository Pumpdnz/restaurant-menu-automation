# Lead Scraping Architecture

## High-Level Overview

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│                              USER INTERFACE LAYER                                      │
│  ┌─────────────────┐  ┌─────────────────────┐  ┌────────────────────┐                │
│  │  LeadScrapes.tsx │  │ ScrapeJobProgress   │  │  CreateLeadScrape  │                │
│  │  (Main Page)     │  │ Card.tsx (Jobs)     │  │  Job.tsx (Dialog)  │                │
│  └────────┬─────────┘  └─────────┬───────────┘  └─────────┬──────────┘                │
│           │                      │                        │                            │
│           └──────────────────────┼────────────────────────┘                            │
│                                  │                                                      │
│                    ┌─────────────┴─────────────┐                                       │
│                    │     React Query Hooks     │                                       │
│                    │  useLeadScrapeJobs.ts     │                                       │
│                    │  useLeads.ts              │                                       │
│                    └─────────────┬─────────────┘                                       │
└──────────────────────────────────┼──────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────────────────────────┐
│                                 API LAYER                                             │
│                                                                                        │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐  │
│  │                        Express Router: /api/lead-scrape-*                        │  │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐               │  │
│  │  │ GET /jobs        │  │ POST /jobs/:id/  │  │ POST /leads/     │               │  │
│  │  │ POST /jobs       │  │ start            │  │ convert          │               │  │
│  │  │ PATCH /jobs/:id  │  │                  │  │                  │               │  │
│  │  └──────────────────┘  └──────────────────┘  └──────────────────┘               │  │
│  └─────────────────────────────────────────────────────────────────────────────────┘  │
│                                        │                                               │
└────────────────────────────────────────┼───────────────────────────────────────────────┘
                                         │
                                         ▼
┌──────────────────────────────────────────────────────────────────────────────────────┐
│                              SERVICE LAYER                                             │
│                                                                                        │
│  ┌────────────────────────────────────────────────────────────────────────────────┐   │
│  │                    lead-scrape-service.js                                       │   │
│  │  ┌───────────────────┐  ┌───────────────────┐  ┌───────────────────┐           │   │
│  │  │  Job Management   │  │  Step Processing  │  │  Lead Operations  │           │   │
│  │  │  - createJob()    │  │  - processStep()  │  │  - convertLead()  │           │   │
│  │  │  - startJob()     │  │  - passLeads()    │  │  - validateLead() │           │   │
│  │  │  - cancelJob()    │  │  - retryStep()    │  │  - checkDupes()   │           │   │
│  │  └───────────────────┘  └───────────────────┘  └───────────────────┘           │   │
│  └─────────────────────────┬──────────────────────────────┬───────────────────────┘   │
│                            │                              │                            │
│                            ▼                              ▼                            │
│  ┌────────────────────────────────────┐  ┌────────────────────────────────────────┐   │
│  │      firecrawl-service.js          │  │       database-service.js              │   │
│  │  - extract()                       │  │  - CRUD operations                      │   │
│  │  - batchExtract()                  │  │  - Organization filtering               │   │
│  │  - rateLimit()                     │  │  - Transaction support                  │   │
│  └───────────────┬────────────────────┘  └────────────────┬───────────────────────┘   │
└──────────────────┼────────────────────────────────────────┼────────────────────────────┘
                   │                                        │
                   ▼                                        ▼
┌──────────────────────────────────┐    ┌──────────────────────────────────────────────┐
│         FIRECRAWL API            │    │              SUPABASE DATABASE               │
│  (External Service)              │    │  ┌─────────────────────────────────────────┐ │
│                                  │    │  │  lead_scrape_jobs                       │ │
│  - Extract JSON data             │    │  │  lead_scrape_job_steps                  │ │
│  - Structured extraction         │    │  │  leads                                  │ │
│  - Rate limited access           │    │  │  nz_city_codes                          │ │
│                                  │    │  │  restaurants (target)                   │ │
└──────────────────────────────────┘    │  └─────────────────────────────────────────┘ │
                                        └──────────────────────────────────────────────┘
```

## Directory Structure

```
UberEats-Image-Extractor/
├── src/
│   ├── pages/
│   │   ├── LeadScrapes.tsx              # Main lead scraping page
│   │   └── LeadScrapeDetail.tsx         # Individual job detail page
│   │
│   ├── components/
│   │   └── leads/
│   │       ├── ScrapeJobProgressCard.tsx    # Job card with progress
│   │       ├── ScrapeJobStepList.tsx        # Nested steps table
│   │       ├── ScrapeJobStepDetailModal.tsx # Step detail modal
│   │       ├── LeadPreview.tsx              # Leads popover component
│   │       ├── LeadDetailModal.tsx          # Individual lead modal
│   │       ├── CreateLeadScrapeJob.tsx      # Create job dialog
│   │       └── PendingLeadsTable.tsx        # Pending leads table
│   │
│   ├── hooks/
│   │   ├── useLeadScrapeJobs.ts         # React Query hooks for jobs
│   │   └── useLeads.ts                  # React Query hooks for leads
│   │
│   ├── routes/
│   │   └── lead-scrape-routes.js        # Express API routes
│   │
│   ├── services/
│   │   ├── lead-scrape-service.js       # Business logic service
│   │   ├── firecrawl-service.js         # Existing - extend for leads
│   │   └── database-service.js          # Existing - extend for leads
│   │
│   └── lib/
│       └── lead-scrape-constants.ts     # Platform configs, step defs
│
└── planning/
    └── database-plans/
        └── sales-specific-features/
            └── lead-scraping/           # This documentation folder
```

## Data Flow

### 1. Create Lead Scrape Job Flow

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   User UI    │───▶│  API Route   │───▶│   Service    │───▶│   Database   │
│  (Dialog)    │    │  POST /jobs  │    │ createJob()  │    │    INSERT    │
└──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
       │                                                            │
       │◀───────────────────────────────────────────────────────────┘
       │                    Return job ID + status
       ▼
┌──────────────┐
│  Job Card    │
│   Appears    │
└──────────────┘
```

### 2. Start Job & Process Steps Flow

```
┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│  User clicks  │────▶│  API Route    │────▶│   Service     │
│  "Start"      │     │  /jobs/:id/   │     │  startJob()   │
│               │     │  start        │     │               │
└───────────────┘     └───────────────┘     └───────┬───────┘
                                                    │
                           ┌────────────────────────┘
                           ▼
                  ┌───────────────────┐
                  │  Create Steps     │
                  │  in Database      │
                  └─────────┬─────────┘
                            │
                            ▼
                  ┌───────────────────┐     ┌───────────────────┐
                  │  Process Step 1   │────▶│   Firecrawl       │
                  │  (Category Scan)  │     │   Extract         │
                  └─────────┬─────────┘     └─────────┬─────────┘
                            │                         │
                            │◀────────────────────────┘
                            ▼
                  ┌───────────────────┐
                  │  Create Lead      │
                  │  Records          │
                  └─────────┬─────────┘
                            │
                            ▼
                  ┌───────────────────┐     ┌───────────────────┐
                  │  Process Step 2   │────▶│   Firecrawl       │
                  │  (Batch Extract)  │     │   Batch Extract   │
                  └─────────┬─────────┘     └─────────┬─────────┘
                            │                         │
                            │◀────────────────────────┘
                            ▼
                  ┌───────────────────┐
                  │  Update Leads     │
                  │  Move to Step 3   │
                  │  (Action Required)│
                  └───────────────────┘
```

### 3. Lead Progression Flow (Step 3+)

```
┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│  User reviews │────▶│  Selects      │────▶│  Clicks       │
│  leads in     │     │  leads to     │     │  "Pass to     │
│  step modal   │     │  progress     │     │  Next Step"   │
└───────────────┘     └───────────────┘     └───────┬───────┘
                                                    │
                                                    ▼
                                          ┌───────────────────┐
                                          │  API: POST        │
                                          │  /steps/:id/      │
                                          │  pass-leads       │
                                          └─────────┬─────────┘
                                                    │
                                                    ▼
                                          ┌───────────────────┐
                                          │  Update leads:    │
                                          │  current_step++   │
                                          │  status='passed'  │
                                          └─────────┬─────────┘
                                                    │
                                                    ▼
                                          ┌───────────────────┐
                                          │  If step_type =   │
                                          │  'automatic'      │
                                          │  → Process auto   │
                                          └───────────────────┘
```

### 4. Lead Conversion Flow

```
┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│  User selects │────▶│  Clicks       │────▶│  API: POST    │
│  pending      │     │  "Convert to  │     │  /leads/      │
│  leads        │     │  Restaurants" │     │  convert      │
└───────────────┘     └───────────────┘     └───────┬───────┘
                                                    │
                                                    ▼
                                          ┌───────────────────┐
                                          │  For each lead:   │
                                          │  1. Check dupes   │
                                          │  2. Map fields    │
                                          │  3. Insert rest.  │
                                          └─────────┬─────────┘
                                                    │
                                                    ▼
                                          ┌───────────────────┐
                                          │  Update lead:     │
                                          │  converted_to_    │
                                          │  restaurant_id    │
                                          └───────────────────┘
```

## Service Layer Architecture

### lead-scrape-service.js

```javascript
/**
 * Lead Scrape Service
 * Handles all business logic for lead scraping operations
 */

class LeadScrapeService {
  constructor(firecrawlService, databaseService) {
    this.firecrawl = firecrawlService;
    this.db = databaseService;
    this.stepProcessors = {
      1: this.processStep1.bind(this),
      2: this.processStep2.bind(this),
      3: this.processStep3.bind(this),
      4: this.processStep4.bind(this),
      5: this.processStep5.bind(this),
    };
  }

  // Job Management
  async createJob(data, orgId) { /* ... */ }
  async startJob(jobId) { /* ... */ }
  async cancelJob(jobId) { /* ... */ }

  // Step Processing
  async processStep(jobId, stepNumber) { /* ... */ }
  async passLeadsToNextStep(stepId, leadIds) { /* ... */ }
  async retryFailedLeads(stepId, leadIds) { /* ... */ }

  // Lead Operations
  async convertLeadsToRestaurants(leadIds, userId) { /* ... */ }
  async validateLead(lead, stepNumber) { /* ... */ }
  async checkForDuplicates(lead) { /* ... */ }

  // Platform-specific processors
  async processStep1(job) { /* Category scan */ }
  async processStep2(job, leads) { /* Batch store extract */ }
  async processStep3(job, leads) { /* Google business lookup */ }
  async processStep4(job, leads) { /* Social media discovery */ }
  async processStep5(job, leads) { /* Contact enrichment */ }
}
```

### Step Processing Pipeline

```
                    ┌─────────────────────────────────────┐
                    │         STEP PROCESSOR              │
                    │                                     │
    ┌───────────────┴───────────────────────────────────┐│
    │                                                    ││
    │  1. Get leads at current step                     ││
    │     └─▶ SELECT * FROM leads                       ││
    │         WHERE current_step = ?                    ││
    │         AND step_progression_status = 'available' ││
    │                                                    ││
    │  2. Build extraction requests                      ││
    │     └─▶ Generate URLs from templates              ││
    │     └─▶ Apply step-specific schema                ││
    │                                                    ││
    │  3. Execute Firecrawl batch                        ││
    │     └─▶ Respect rate limits                       ││
    │     └─▶ Handle retries                            ││
    │                                                    ││
    │  4. Process results                                ││
    │     └─▶ Validate extracted data                   ││
    │     └─▶ Update lead records                       ││
    │     └─▶ Check for duplicates                      ││
    │                                                    ││
    │  5. Update step status                             ││
    │     └─▶ leads_processed++                         ││
    │     └─▶ Set step status based on type             ││
    │                                                    ││
    └────────────────────────────────────────────────────┘│
                    └─────────────────────────────────────┘
```

## Error Handling

### Error Categories

```
┌─────────────────────────────────────────────────────────────────────┐
│                        ERROR HANDLING                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐ │
│  │  Firecrawl      │    │  Database       │    │  Validation     │ │
│  │  Errors         │    │  Errors         │    │  Errors         │ │
│  ├─────────────────┤    ├─────────────────┤    ├─────────────────┤ │
│  │ • Rate limited  │    │ • Connection    │    │ • Missing data  │ │
│  │ • Timeout       │    │ • Constraint    │    │ • Invalid URL   │ │
│  │ • Parse failed  │    │ • Transaction   │    │ • Duplicate     │ │
│  │ • Service down  │    │   rollback      │    │ • Bad format    │ │
│  └────────┬────────┘    └────────┬────────┘    └────────┬────────┘ │
│           │                      │                      │           │
│           ▼                      ▼                      ▼           │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    Error Response Handler                     │  │
│  │  • Log error details                                         │  │
│  │  • Update lead/step status                                   │  │
│  │  • Return user-friendly message                              │  │
│  │  • Trigger retry if retryable                                │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Retry Strategy

```javascript
const RETRY_STRATEGY = {
  firecrawl: {
    maxRetries: 3,
    delays: [5000, 15000, 30000], // Exponential backoff
    retryableErrors: ['TIMEOUT', 'RATE_LIMITED', 'SERVICE_UNAVAILABLE']
  },
  database: {
    maxRetries: 2,
    delays: [1000, 3000],
    retryableErrors: ['CONNECTION_ERROR', 'LOCK_TIMEOUT']
  }
};
```

## Security Considerations

### Row Level Security (RLS)

- All tables have RLS enabled
- Jobs/steps/leads filtered by `organisation_id`
- Users can only access their organization's data

### API Security

- JWT authentication required on all endpoints
- Organization context from JWT claims
- Rate limiting on heavy operations

### Data Validation

- Server-side validation of all inputs
- URL sanitization before Firecrawl requests
- SQL injection protection via parameterized queries

## Performance Considerations

### Batch Processing

```javascript
const BATCH_CONFIG = {
  firecrawlBatchSize: 5,      // Concurrent Firecrawl requests
  databaseBatchSize: 100,      // Records per DB operation
  progressUpdateInterval: 10,  // Update progress every N leads
};
```

### Caching

- NZ city codes cached in memory
- Platform configurations cached
- Step definitions cached per platform

### Database Indexes

Critical indexes for performance:
- `idx_leads_job_step` - Composite for step queries
- `idx_leads_progression_status` - Filter by status
- `idx_leads_restaurant_name_search` - Full-text search

## Integration Points

### Authentication (Existing)

```javascript
// Uses existing auth middleware
import { requireAuth } from '../middleware/auth';

router.use(requireAuth);
```

### Database Service (Existing)

```javascript
// Extends existing database service
import { getSupabaseClient } from '../services/database-service';

const supabase = getSupabaseClient();
```

### Firecrawl Service (Existing)

```javascript
// Uses existing Firecrawl integration
import { extractMenuData } from '../services/firecrawl-service';

// Add new lead-specific extraction methods
```

### UI Framework (Existing)

- Uses shadcn/ui components
- Follows existing Tailwind patterns
- Consistent with current design system

## Testing Strategy

### Unit Tests

```
tests/
├── services/
│   └── lead-scrape-service.test.js
│       ├── createJob()
│       ├── processStep1()
│       ├── processStep2()
│       ├── validateLead()
│       └── convertToRestaurant()
│
├── routes/
│   └── lead-scrape-routes.test.js
│       ├── GET /jobs
│       ├── POST /jobs
│       ├── POST /jobs/:id/start
│       └── POST /leads/convert
│
└── components/
    └── leads/
        ├── ScrapeJobProgressCard.test.tsx
        └── CreateLeadScrapeJob.test.tsx
```

### Integration Tests

- Full job lifecycle (create → start → complete)
- Lead progression through all steps
- Lead conversion to restaurant

### E2E Tests

- User creates job and monitors progress
- User reviews and passes leads manually
- User converts leads to restaurants
