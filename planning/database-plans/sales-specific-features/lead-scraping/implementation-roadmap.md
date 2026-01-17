# Lead Scraping Implementation Roadmap

## Overview

This document provides a phased implementation plan for the lead scraping feature. Each phase builds on the previous, with clear deliverables and checkpoints.

## Current Status

**Status:** Not Started
**Date:** 2025-12-05

## Prerequisites

Before starting implementation, ensure:

- [ ] Access to Firecrawl API with valid API key
- [ ] Supabase database access with migration permissions
- [ ] Understanding of existing codebase patterns (Sequences.tsx, TaskTypeQuickView.tsx)
- [ ] Review of this documentation set

---

## Phase 1: Database Foundation

**Estimated Scope:** Database tables, migrations, RLS policies

### 1.1 Create Database Migration

- [ ] Create migration file: `YYYYMMDDHHMMSS_add_lead_scraping_tables.sql`
- [ ] Create `lead_scrape_jobs` table with all columns and constraints
- [ ] Create `lead_scrape_job_steps` table with FK to jobs
- [ ] Create `leads` table with all enrichment fields
- [ ] Create `nz_city_codes` reference table

### 1.2 Add Indexes

- [ ] Add all indexes defined in database-schema.md
- [ ] Add full-text search index on `leads.restaurant_name`

### 1.3 Configure Row Level Security

- [ ] Enable RLS on all new tables
- [ ] Create organization-based policies for `lead_scrape_jobs`
- [ ] Create cascading policies for `lead_scrape_job_steps`
- [ ] Create cascading policies for `leads`
- [ ] Create read-only policy for `nz_city_codes`

### 1.4 Seed Reference Data

- [ ] Insert NZ city codes with UberEats slugs
- [ ] Verify data in database

### 1.5 Test Database Setup

- [ ] Verify tables created correctly
- [ ] Test RLS policies with sample data
- [ ] Verify FK constraints work
- [ ] Test cascade delete behavior

**Phase 1 Checkpoint:** All database tables exist with proper constraints and RLS

---

## Phase 2: Backend API Routes

**Estimated Scope:** Express routes and basic service layer

### 2.1 Create Route File

- [ ] Create `src/routes/lead-scrape-routes.js`
- [ ] Set up Express router with auth middleware
- [ ] Register routes in main app

### 2.2 Implement Job CRUD Endpoints

- [ ] `GET /api/lead-scrape-jobs` - List jobs with filters
- [ ] `GET /api/lead-scrape-jobs/:id` - Get single job with steps
- [ ] `POST /api/lead-scrape-jobs` - Create new job
- [ ] `PATCH /api/lead-scrape-jobs/:id` - Update draft job
- [ ] `DELETE /api/lead-scrape-jobs/:id` - Delete job

### 2.3 Implement Job Action Endpoints

- [ ] `POST /api/lead-scrape-jobs/:id/start` - Start job
- [ ] `POST /api/lead-scrape-jobs/:id/cancel` - Cancel job

### 2.4 Implement Step Endpoints

- [ ] `GET /api/lead-scrape-jobs/:jobId/steps/:stepNumber` - Get step with leads
- [ ] `POST /api/lead-scrape-job-steps/:stepId/pass-leads` - Pass leads
- [ ] `POST /api/lead-scrape-job-steps/:stepId/process` - Trigger processing
- [ ] `POST /api/lead-scrape-job-steps/:stepId/retry` - Retry failed leads

### 2.5 Implement Lead Endpoints

- [ ] `GET /api/leads/pending` - List pending leads
- [ ] `GET /api/leads/:id` - Get single lead
- [ ] `PATCH /api/leads/:id` - Update lead
- [ ] `POST /api/leads/convert` - Convert leads to restaurants
- [ ] `DELETE /api/leads` - Bulk delete leads
- [ ] `DELETE /api/leads/:id` - Delete single lead

### 2.6 Implement Utility Endpoints

- [ ] `GET /api/nz-city-codes` - List city codes for dropdown

### 2.7 Test API Routes

- [ ] Test all endpoints with Postman/curl
- [ ] Verify authentication works
- [ ] Test error handling
- [ ] Verify response formats match spec

**Phase 2 Checkpoint:** All API endpoints functional and tested

---

## Phase 3: Firecrawl Integration

**Estimated Scope:** Extraction configurations and processing logic

### 3.1 Create Lead Scrape Service

- [ ] Create `src/services/lead-scrape-service.js`
- [ ] Implement `LeadScrapeService` class structure
- [ ] Add job management methods

### 3.2 Implement Step 1 Processing

- [ ] Create UberEats category page URL builder
- [ ] Define Step 1 extraction schema
- [ ] Define Step 1 extraction prompt
- [ ] Implement `processStep1()` method
- [ ] Test with sample UberEats category URL

### 3.3 Implement Step 2 Processing

- [ ] Define Step 2 extraction schema
- [ ] Define Step 2 extraction prompt
- [ ] Implement batch processing with rate limiting
- [ ] Implement `processStep2()` method
- [ ] Test with sample store URLs

### 3.4 Implement Step 3 Processing

- [ ] Define Google search URL builder
- [ ] Define Step 3 extraction schema
- [ ] Implement `processStep3()` method

### 3.5 Implement Step 4 Processing

- [ ] Define social media search URL builder
- [ ] Define Step 4 extraction schema
- [ ] Implement `processStep4()` method

### 3.6 Implement Step 5 Processing

- [ ] Define Step 5 extraction schema
- [ ] Implement `processStep5()` method

### 3.7 Implement Validation & Deduplication

- [ ] Implement `validateLead()` for each step
- [ ] Implement `checkForDuplicates()`
- [ ] Test validation rules

### 3.8 Implement Lead Conversion

- [ ] Create lead-to-restaurant field mapping
- [ ] Implement `convertLeadsToRestaurants()`
- [ ] Test conversion flow

**Phase 3 Checkpoint:** Full extraction pipeline functional with UberEats

---

## Phase 4: Frontend - Main Page

**Estimated Scope:** LeadScrapes.tsx page with tabs and filters

### 4.1 Create React Query Hooks

- [ ] Create `src/hooks/useLeadScrapeJobs.ts`
- [ ] Implement `useLeadScrapeJobs()` query hook
- [ ] Implement `useLeadScrapeJob()` for single job
- [ ] Implement mutation hooks for job actions
- [ ] Create `src/hooks/useLeads.ts`
- [ ] Implement `usePendingLeads()` query hook
- [ ] Implement `useLeadsByStep()` query hook
- [ ] Implement mutation hooks for lead actions

### 4.2 Create Main Page Structure

- [ ] Create `src/pages/LeadScrapes.tsx`
- [ ] Implement tabbed interface (Scrape Jobs / Pending Leads)
- [ ] Add page header with "New Lead Scrape" button
- [ ] Set up URL param handling for active tab

### 4.3 Implement Scrape Jobs Tab Filters

- [ ] Add search input
- [ ] Add status multi-select filter
- [ ] Add platform multi-select filter
- [ ] Add cuisine text filter
- [ ] Add city multi-select filter
- [ ] Add date range filter
- [ ] Implement clear/reset filter buttons

### 4.4 Implement Empty States

- [ ] Add empty state for no jobs
- [ ] Add empty state for no results with filters

### 4.5 Add Route to App.tsx

- [ ] Import LeadScrapes page
- [ ] Add route `/leads` to router
- [ ] Add navigation link to sidebar

**Phase 4 Checkpoint:** Main page renders with working filters

---

## Phase 5: Frontend - Job Cards & Steps

**Estimated Scope:** ScrapeJobProgressCard.tsx and ScrapeJobStepList.tsx

### 5.1 Create ScrapeJobProgressCard Component

- [ ] Create `src/components/leads/ScrapeJobProgressCard.tsx`
- [ ] Implement card header with name, status badge, platform link
- [ ] Implement progress bar
- [ ] Add action buttons (View Details, Cancel, etc.)
- [ ] Wire up to API actions

### 5.2 Create ScrapeJobStepList Component

- [ ] Create `src/components/leads/ScrapeJobStepList.tsx`
- [ ] Implement expandable step table
- [ ] Add status indicators for each step
- [ ] Add step type badges
- [ ] Add leads column with dynamic display
- [ ] Add completed date column
- [ ] Add action buttons per step

### 5.3 Integrate Components

- [ ] Render ScrapeJobProgressCard list in Scrape Jobs tab
- [ ] Test card interactions
- [ ] Test step list expand/collapse

**Phase 5 Checkpoint:** Job cards display with nested step tables

---

## Phase 6: Frontend - Lead Preview & Modals

**Estimated Scope:** LeadPreview.tsx, LeadDetailModal.tsx, ScrapeJobStepDetailModal.tsx

### 6.1 Create LeadPreview Popover

- [ ] Create `src/components/leads/LeadPreview.tsx`
- [ ] Implement header with lead counts
- [ ] Implement lead table with color-coded rows
- [ ] Implement bulk selection logic
- [ ] Implement bulk action buttons
- [ ] Wire up API actions

### 6.2 Create LeadDetailModal

- [ ] Create `src/components/leads/LeadDetailModal.tsx`
- [ ] Implement view mode with all lead fields
- [ ] Implement edit mode for manual data entry
- [ ] Add action buttons (Save, Delete, Pass)
- [ ] Wire up API actions

### 6.3 Create ScrapeJobStepDetailModal

- [ ] Create `src/components/leads/ScrapeJobStepDetailModal.tsx`
- [ ] Implement step overview header
- [ ] Implement full leads table with edit capability
- [ ] Add bulk selection and actions
- [ ] Wire up API actions

### 6.4 Connect Modals

- [ ] Connect LeadPreview to step leads count
- [ ] Connect LeadDetailModal from preview and tables
- [ ] Connect ScrapeJobStepDetailModal from step name click
- [ ] Test all modal flows

**Phase 6 Checkpoint:** All modals functional with data

---

## Phase 7: Frontend - Create Job Dialog

**Estimated Scope:** CreateLeadScrapeJob.tsx dialog

### 7.1 Create Dialog Component

- [ ] Create `src/components/leads/CreateLeadScrapeJob.tsx`
- [ ] Implement dialog structure with form

### 7.2 Implement Form Fields

- [ ] Add platform dropdown
- [ ] Add country dropdown
- [ ] Add city dropdown (loaded from API)
- [ ] Add cuisine text input
- [ ] Add leads limit number input
- [ ] Add page offset input (conditional for UberEats)

### 7.3 Implement Form Validation

- [ ] Validate required fields based on platform
- [ ] Show validation errors inline
- [ ] Enable/disable submit button based on validity

### 7.4 Implement Submit Actions

- [ ] Implement "Save as Draft" action
- [ ] Implement "Start Lead Scrape" action
- [ ] Show loading state during submission
- [ ] Handle success (close dialog, refresh list)
- [ ] Handle errors (show toast)

### 7.5 Support Draft Editing

- [ ] Accept `draftJobId` prop
- [ ] Load draft data when editing
- [ ] Update existing draft on save

**Phase 7 Checkpoint:** Job creation dialog fully functional

---

## Phase 8: Frontend - Pending Leads Tab

**Estimated Scope:** PendingLeadsTable.tsx and conversion flow

### 8.1 Create PendingLeadsTable Component

- [ ] Create `src/components/leads/PendingLeadsTable.tsx`
- [ ] Implement table with all columns
- [ ] Add select all / individual checkboxes
- [ ] Add clickable restaurant name → LeadDetailModal
- [ ] Add action buttons column

### 8.2 Implement Bulk Actions

- [ ] Add bulk action bar when leads selected
- [ ] Implement "Convert to Restaurants" button
- [ ] Implement "Delete Selected" button
- [ ] Add confirmation dialogs

### 8.3 Implement Conversion Flow

- [ ] Show conversion progress
- [ ] Handle partial failures
- [ ] Show success/failure summary
- [ ] Refresh list after conversion

### 8.4 Integrate with Pending Tab

- [ ] Add filters for pending leads tab
- [ ] Render PendingLeadsTable
- [ ] Test full flow

**Phase 8 Checkpoint:** Pending leads tab fully functional

---

## Phase 9: Detail Page & Polish

**Estimated Scope:** LeadScrapeDetail.tsx and UX improvements

### 9.1 Create Detail Page

- [ ] Create `src/pages/LeadScrapeDetail.tsx`
- [ ] Implement full job view with all details
- [ ] Show all steps with detailed stats
- [ ] Add job management actions

### 9.2 Add Route

- [ ] Add route `/leads/:id` to router
- [ ] Link from job card name

### 9.3 UX Improvements

- [ ] Add loading skeletons
- [ ] Add optimistic updates where appropriate
- [ ] Add keyboard shortcuts
- [ ] Improve error messages

### 9.4 Real-time Updates (Optional)

- [ ] Implement WebSocket connection for job progress
- [ ] Update UI in real-time during processing

**Phase 9 Checkpoint:** Complete feature implementation

---

## Phase 10: Testing & Documentation

**Estimated Scope:** Testing and final documentation

### 10.1 Write Unit Tests

- [ ] Test lead-scrape-service.js methods
- [ ] Test API route handlers
- [ ] Test React components

### 10.2 Write Integration Tests

- [ ] Test full job lifecycle
- [ ] Test lead progression
- [ ] Test lead conversion

### 10.3 Manual Testing

- [ ] Test with real UberEats URLs
- [ ] Test error scenarios
- [ ] Test with different cuisines/cities
- [ ] Performance testing with large lead sets

### 10.4 Update Documentation

- [ ] Update CLAUDE.md if needed
- [ ] Add feature to changelog
- [ ] Update any related docs

**Phase 10 Checkpoint:** Feature complete and tested

---

## Next Steps After Implementation

1. **Platform Expansion**
   - Add DoorDash support
   - Add Google Maps support

2. **Step Enhancement**
   - Add more enrichment steps
   - Improve extraction accuracy

3. **Analytics**
   - Add conversion rate tracking
   - Add extraction success metrics

4. **Automation**
   - Schedule automatic scrapes
   - Auto-progression for high-confidence leads

---

## Handoff Summary

### What's Done

- [ ] Phase 1: Database Foundation
- [ ] Phase 2: Backend API Routes
- [ ] Phase 3: Firecrawl Integration
- [ ] Phase 4: Frontend - Main Page
- [ ] Phase 5: Frontend - Job Cards & Steps
- [ ] Phase 6: Frontend - Lead Preview & Modals
- [ ] Phase 7: Frontend - Create Job Dialog
- [ ] Phase 8: Frontend - Pending Leads Tab
- [ ] Phase 9: Detail Page & Polish
- [ ] Phase 10: Testing & Documentation

### What's Next

1. Review and approve architecture/schema
2. Begin Phase 1: Database Migration
3. Proceed through phases sequentially

### Notes for Next Developer

#### Read Reference Files First
- `Sequences.tsx` - Page structure pattern
- `SequenceProgressCard.tsx` - Card with nested list pattern
- `TaskTypeQuickView.tsx` - Popover pattern
- `TaskDetailModal.tsx` - Modal pattern
- `firecrawl-service.js` - Existing Firecrawl integration

#### Review Current Implementation
Check if any similar patterns have been added since this planning doc was created.

#### Implementation Order for Additional Features
Each phase can be tested independently:
- Phase 1-3 gives you working backend
- Phase 4-8 gives you working frontend
- Phase 9-10 polish and complete

#### Key Architecture Decisions

1. **Step-based progression**: Leads move through numbered steps
2. **Automatic vs Manual steps**: Steps 1-2 auto-process, 3+ require user review
3. **Platform extensibility**: Configuration-driven for easy platform addition
4. **Organization isolation**: All data scoped to organization via RLS
