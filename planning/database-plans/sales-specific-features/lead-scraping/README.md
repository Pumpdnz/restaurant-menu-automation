# Lead Scraping Feature Documentation

## Overview

The Lead Scraping feature enables automated extraction of restaurant leads from delivery platforms (initially UberEats) for cold outreach purposes. This system allows sales teams to generate their own leads by scraping publicly available restaurant information from the internet using Firecrawl.

The feature provides a complete workflow from initial lead discovery through enrichment and conversion to restaurant records for the sales pipeline.

## Documentation Structure

| Document | Description |
|----------|-------------|
| [README.md](./README.md) | This file - overview and quick start |
| [architecture.md](./architecture.md) | High-level system architecture and data flows |
| [database-schema.md](./database-schema.md) | Database tables, relationships, and constraints |
| [ui-components.md](./ui-components.md) | React component specifications and patterns |
| [api-specification.md](./api-specification.md) | Backend API endpoints and contracts |
| [firecrawl-integration.md](./firecrawl-integration.md) | Firecrawl extraction configuration and schemas |
| [implementation-roadmap.md](./implementation-roadmap.md) | Phased implementation plan with checklists |

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Lead Scraping System                               │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐          │
│  │  LeadScrapes.tsx │───▶│ ScrapeJob Cards │───▶│ Lead Detail     │          │
│  │  (Main Page)     │    │ Progress Cards   │    │ Modals          │          │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘          │
│           │                     │                      │                      │
│           ▼                     ▼                      ▼                      │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                     React Query / API Service                        │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│           │                                                                   │
│           ▼                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                     Backend API Routes                                │    │
│  │  /api/lead-scrape-jobs  │  /api/leads  │  /api/firecrawl            │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│           │                                                                   │
│           ▼                                                                   │
│  ┌───────────────────┐    ┌───────────────────┐                              │
│  │  Supabase DB      │    │  Firecrawl API    │                              │
│  │  - lead_scrape_*  │    │  - Extract        │                              │
│  │  - leads          │    │  - Batch Scrape   │                              │
│  └───────────────────┘    └───────────────────┘                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Core Principles

1. **Platform Extensibility**: Designed for UberEats initially but architected for easy addition of DoorDash, Google Maps, and other platforms
2. **Step-Based Processing**: Multi-step enrichment pipeline with automatic and manual progression
3. **Rate Limit Compliance**: Respect Firecrawl rate limits and concurrency controls
4. **Data Quality**: Validation at each step before progression
5. **User Control**: Manual review and approval for lead progression from Step 3 onwards

## Existing UI Patterns

This feature follows established patterns from the existing codebase:

| Pattern | Reference Component | Usage |
|---------|---------------------|-------|
| Tabbed Page Layout | `Sequences.tsx` | Main page structure |
| Progress Cards | `SequenceProgressCard.tsx` | `ScrapeJobProgressCard.tsx` |
| Nested Tables | `SequenceTaskList.tsx` | `ScrapeJobStepList.tsx` |
| Quick View Popover | `TaskTypeQuickView.tsx` | `LeadPreview.tsx` |
| Detail Modal | `TaskDetailModal.tsx` | `LeadDetailModal.tsx` |
| Filter Components | `Sequences.tsx` filters | Scrape job filters |
| Create Dialog | `CreateSequenceTemplateModal.tsx` | `CreateLeadScrapeJob.tsx` |

## Implementation Location

### New Files to Create

**Pages:**
- `src/pages/LeadScrapes.tsx` - Main lead scraping page
- `src/pages/LeadScrapeDetail.tsx` - Individual scrape job detail page

**Components:**
```
src/components/leads/
├── ScrapeJobProgressCard.tsx       # Card displaying scrape job progress
├── ScrapeJobStepList.tsx           # Nested table of steps
├── ScrapeJobStepDetailModal.tsx    # Modal for step details
├── LeadPreview.tsx                 # Popover for lead quick view
├── LeadDetailModal.tsx             # Modal for individual lead
├── CreateLeadScrapeJob.tsx         # Dialog for creating new scrape job
└── PendingLeadsTable.tsx           # Table for pending leads tab
```

**Hooks:**
```
src/hooks/
├── useLeadScrapeJobs.ts            # Query hook for scrape jobs
└── useLeads.ts                     # Query hook for leads
```

**API Routes:**
```
src/routes/
└── lead-scrape-routes.js           # Express routes for lead scraping
```

**Services:**
```
src/services/
└── lead-scrape-service.js          # Business logic for lead scraping
```

## Quick Start Guide

### Phase 1: Database Setup
1. Apply the database migration to create `lead_scrape_jobs`, `lead_scrape_job_steps`, and `leads` tables
2. Seed platform-specific step configurations for UberEats

### Phase 2: Backend Implementation
1. Create API routes for lead scrape operations
2. Implement Firecrawl integration for lead extraction
3. Add rate limiting and concurrency controls

### Phase 3: Frontend Implementation
1. Create main LeadScrapes.tsx page with tabbed interface
2. Implement ScrapeJobProgressCard and nested components
3. Build CreateLeadScrapeJob dialog
4. Implement LeadDetailModal and LeadPreview components

### Phase 4: Testing & Integration
1. End-to-end testing of UberEats extraction flow
2. Validate lead-to-restaurant conversion
3. Performance testing with large lead sets

## Related Documentation

- [Restaurants Schema](../database-schemas/restaurants.sql) - Target schema for converted leads
- [Firecrawl Service](../../../../UberEats-Image-Extractor/src/services/firecrawl-service.js) - Existing Firecrawl integration
- [Sequences Page](../../../../UberEats-Image-Extractor/src/pages/Sequences.tsx) - Reference page implementation

## Status

**Current Status:** Not Started
**Last Updated:** 2025-12-05

## Next Steps

1. Review and approve architecture and database schema
2. Begin Phase 1: Database Migration
3. Implement backend API routes
4. Build frontend components following existing patterns
