# Investigation Plan: Auto-Extraction After Lead Conversion

**Date**: 2025-12-20
**Status**: INVESTIGATION REQUIRED

---

## Overview

After successfully converting leads to restaurants and optionally enrolling them in sequences, add functionality to automatically trigger:
1. **Premium Menu Extractions** (on UberEats URLs) - with images and optionsets
2. **Branding Extractions** (on website URLs) - skip confirmation, auto-apply all fields

These extractions should:
- Execute asynchronously (non-blocking to user navigation)
- Run in parallel after sequence enrollment completes
- Allow user to select which converted restaurants receive extractions

---

## Known Information

### Premium Menu Extraction API
- **Endpoint**: `POST /api/extract-menu-premium`
- **Parameters**:
  - `storeUrl` (required) - UberEats URL
  - `restaurantId` - Restaurant ID to associate results
  - `restaurantName` - Restaurant name
  - `extractOptionSets` - Boolean (default: true)
  - `validateImages` - Boolean (default: true)
  - `async` - Boolean (default: false) - When true, returns jobId for polling
- **Status Polling**: `GET /api/premium-extract-status/:jobId`
- **Results**: `GET /api/premium-extract-results/:jobId`

### Branding Extraction API
- **Endpoint**: `POST /api/website-extraction/branding`
- **Parameters**:
  - `restaurantId` (required)
  - `sourceUrl` (required) - Website URL
  - `previewOnly` - Boolean (default: false) - When false, saves directly
  - `versionsToUpdate`, `colorsToUpdate`, `headerFieldsToUpdate` - Arrays to filter what gets saved
- **Direct Save**: `POST /api/website-extraction/branding/save` (with pre-extracted data)

### Restaurant URLs from Lead Conversion
When a lead is converted to a restaurant:
- `restaurant.ubereats_url` = `lead.store_link`
- `restaurant.website_url` = `lead.website_url`

### Current Conversion Flow (PendingLeadsTable.tsx)
1. User converts leads → Results captured with `restaurantId`
2. User clicks "Start Sequence" → Opens `BulkStartSequenceModal`
3. Sequence completes → Modal closes

---

## Instructions

The next Claude Code instance should:

1. **Use the Task tool to spawn 4 subagents in parallel** to investigate each area below
2. Each subagent should **only investigate** (no code changes) and create a deliverable markdown file
3. After all subagents complete, **read all investigation files** and synthesize findings
4. **Report** consolidated findings to user with recommended implementation approach

---

## subagent_1_instructions

### Context
Investigate how the BulkStartSequenceModal handles completion and how to detect when sequences have been successfully started.

### Instructions
1. Read `src/components/sequences/BulkStartSequenceModal.tsx` thoroughly
2. Identify the success callback/handler when bulk sequences complete
3. Investigate the `useBulkStartSequence` hook in `src/hooks/useSequences.ts`
4. Determine how to pass a callback or additional data for post-sequence actions
5. Look for existing patterns of chaining async operations after modal actions

### Deliverable
Create `INVESTIGATION_TASK_1_SEQUENCE_COMPLETION.md` containing:
- How sequence completion is detected
- Current onClose/onSuccess patterns
- Recommended approach for triggering extractions after sequence completion
- Code snippets showing relevant callback patterns

### Report
Summarize findings about sequence completion handling

---

## subagent_2_instructions

### Context
Investigate the premium extraction service and how to trigger batch async extractions for multiple restaurants.

### Instructions
1. Read `src/services/premium-extraction-service.js` to understand async job handling
2. Read `server.js` lines 1975-2100 for premium extraction endpoints
3. Check for any existing batch extraction capabilities
4. Investigate how job status polling works
5. Look for WebSocket or polling patterns for async job status updates
6. Check if there's a queue system for multiple concurrent extractions

### Deliverable
Create `INVESTIGATION_TASK_2_PREMIUM_EXTRACTION.md` containing:
- How async extractions work (job creation, polling, results)
- Any rate limiting or concurrency considerations
- How to trigger multiple extractions in parallel
- Recommended approach for fire-and-forget batch extractions
- Any existing UI components for showing extraction progress

### Report
Summarize findings about premium extraction batch handling

---

## subagent_3_instructions

### Context
Investigate the branding extraction service and how to auto-apply all branding fields without user confirmation.

### Instructions
1. Read `src/services/logo-extraction-service.js` for `extractBrandingWithFirecrawl`
2. Read `server.js` lines 7529-7900 for branding extraction endpoints
3. Understand the `previewOnly` vs direct-save flow
4. Identify what happens when `previewOnly=false` and no field filters are passed
5. Check for any async/job-based branding extraction capabilities
6. Look at RestaurantDetail.jsx handleExtractBranding for the confirmation dialog pattern

### Deliverable
Create `INVESTIGATION_TASK_3_BRANDING_EXTRACTION.md` containing:
- How to bypass the confirmation dialog (previewOnly=false)
- How to apply all fields without selection filtering
- Whether branding extraction supports async/fire-and-forget
- Any error handling considerations for silent failures
- Recommended approach for batch branding extractions

### Report
Summarize findings about branding extraction auto-apply

---

## subagent_4_instructions

### Context
Investigate the UI/UX patterns for adding extraction options to the conversion flow and handling background tasks.

### Instructions
1. Read `src/components/leads/PendingLeadsTable.tsx` for current conversion dialog
2. Look for existing checkbox/selection patterns in conversion or sequence modals
3. Search for toast notifications or background task indicators in the codebase
4. Check for any existing "fire and forget" patterns with user feedback
5. Look at how other async operations provide user feedback (e.g., ExtractionProgressCard)
6. Investigate if there's a global notification/progress system

### Deliverable
Create `INVESTIGATION_TASK_4_UI_PATTERNS.md` containing:
- Current conversion dialog structure
- Checkbox/selection component patterns used elsewhere
- Background task notification patterns
- Toast message patterns for async operations
- Recommended UI approach for extraction options
- Recommended feedback mechanism for background extractions

### Report
Summarize findings about UI patterns and user feedback mechanisms

---

## Post-Investigation Steps

After all subagent investigations complete:

1. Read all 4 investigation markdown files
2. Synthesize findings into a cohesive implementation plan
3. Identify any blocking issues or dependencies
4. Recommend the optimal implementation approach
5. Create `IMPLEMENTATION_PLAN.md` with step-by-step tasks

---

## Expected Outcome

A complete understanding of:
1. How to detect sequence completion and chain extraction actions
2. How to trigger batch async premium extractions
3. How to auto-apply branding without confirmation
4. UI patterns for adding extraction options to conversion flow
5. User feedback mechanisms for background tasks
