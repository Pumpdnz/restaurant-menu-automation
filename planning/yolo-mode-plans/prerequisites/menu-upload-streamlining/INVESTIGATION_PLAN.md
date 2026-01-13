# Investigation Plan: Menu CSV Upload Streamlining

## Overview
The goal is to streamline the menu CSV upload feature on the RestaurantDetail.tsx Registration tab. Currently, users must:
1. Upload images to CDN
2. Download CSV with images
3. Drag and drop the downloaded CSV to process

The improved flow will:
1. Add a menu selector dropdown to the card component
2. When menu is selected, automatically check if CDN images exist
3. If no CDN images, auto-upload to CDN first
4. Generate a temporary CSV (no user download required)
5. Execute the import script automatically

## Known Information

### Current Implementation Structure
- **File**: `UberEats-Image-Extractor/src/pages/RestaurantDetail.jsx` (400+ KB, very large file)
- **Registration Tab**: Contains CSV file upload section starting around line 5489
- **Current CSV Flow**:
  - File input: `csv-file-input` (line 5497-5501)
  - Upload handler: `handleCsvUpload()` (lines 813-884)
  - Sends to backend: `POST /api/registration/upload-csv-menu`

### Existing Functions Available
1. **CDN Image Upload**: `handleUploadImagesToCDN(menuId)` (lines 2936-3020)
   - Calls `POST /api/menus/${menuId}/upload-images`
   - Supports sync and async modes with polling

2. **CSV with CDN Download**: `handleDownloadCSVWithCDN(menuId)` (lines 3022-3052)
   - Calls `GET /api/menus/${menuId}/csv-with-cdn`
   - Currently downloads directly to user's computer

3. **Menu Data Access**: `restaurant.menus` array available
   - Already used in Option Sets section (lines 5630-5631)

### Backend Infrastructure
1. **CSV Upload Endpoint**: `/api/registration/upload-csv-menu`
   - Located in: `src/routes/registration-routes.js:798`
   - Accepts FormData with `csvFile` and `restaurantId`
   - Runs `scripts/restaurant-registration/import-csv-menu.js`

2. **CDN Stats Function**: `getMenuCDNStats(menuId)` in database-service.js:3232
   - Returns: `{ totalImages, uploadedImages, failedUploads, pendingUploads, uploadPercentage }`
   - Can be used to check if images need CDN upload

3. **CSV Generation Endpoint**: `GET /api/menus/:id/csv-with-cdn`
   - Located in: `server.js:3992`
   - Returns CSV text with CDN columns

### UI Components Already Available
- `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue` (imported)
- Menu dropdown pattern already used for Option Sets (lines 5621-5631)

## Instructions

Execute this investigation by spawning 3 parallel subagents using the Task tool. Each subagent should investigate specific aspects of the implementation and create their investigation document.

**Important**:
- Each subagent should ONLY investigate and gather information, NOT modify code
- Each subagent should create their investigation document in this folder
- After all subagents complete, read all investigation files and report consolidated findings to the user

## subagent_1_instructions

### Context
Investigate the current CSV upload flow and the Registration tab UI structure in RestaurantDetail.jsx to understand exactly where the new menu selector component should be placed and how the existing upload logic works.

### Instructions
1. Read RestaurantDetail.jsx lines 5480-5700 to understand the current Registration tab structure
2. Examine the existing Option Sets menu dropdown implementation (lines 5620-5680) as a reference pattern
3. Analyze the `handleCsvUpload()` function (lines 813-884) to understand the current upload flow
4. Look for any existing state variables related to CSV/menu selection
5. Document the exact insertion point for the new menu selector dropdown
6. Identify what modifications to `handleCsvUpload` will be needed to accept a menu ID instead of a file

### Deliverable
Create `INVESTIGATION_TASK_1_CSV_UPLOAD_FLOW.md` documenting:
- Current UI structure of the CSV upload section
- Existing Option Sets dropdown pattern details
- Recommended placement for new menu selector
- Required state variable additions
- Changes needed to the upload handler

### Report
Summarize findings about the current CSV upload flow and recommended UI changes.

---

## subagent_2_instructions

### Context
Investigate the backend infrastructure needed to support the streamlined flow, specifically: getting CDN stats for a menu, generating a temporary CSV, and modifying the upload endpoint to accept CSV data directly.

### Instructions
1. Examine `getMenuCDNStats(menuId)` in database-service.js (lines 3229-3273)
2. Look for existing API endpoint that exposes CDN stats, or note if one needs to be created
3. Study the `GET /api/menus/:id/csv-with-cdn` endpoint in server.js (lines 3986-4135)
4. Examine the `POST /api/registration/upload-csv-menu` endpoint in registration-routes.js (lines 798-945)
5. Determine if the backend can accept CSV content directly (as base64 or text) instead of requiring file upload
6. Check if there's a way to generate the CSV on the backend without downloading

### Deliverable
Create `INVESTIGATION_TASK_2_BACKEND_INFRASTRUCTURE.md` documenting:
- Current CDN stats API availability
- Whether a new CDN stats endpoint is needed
- Options for generating/passing CSV without user download
- Required backend modifications

### Report
Summarize backend capabilities and gaps for the streamlined flow.

---

## subagent_3_instructions

### Context
Investigate how to implement the safeguard mechanism that checks for CDN images before processing, and how to handle the async CDN upload with proper progress feedback.

### Instructions
1. Analyze `handleUploadImagesToCDN(menuId)` (lines 2936-3020) to understand the polling mechanism
2. Look for existing patterns for sequential async operations with progress feedback
3. Examine how the toast notifications work for the CDN upload progress
4. Find examples of "check then execute" patterns in the codebase
5. Study how the frontend can await the CDN upload completion before proceeding
6. Look at the upload batch polling logic to understand how to wait for completion

### Deliverable
Create `INVESTIGATION_TASK_3_CDN_SAFEGUARD_FLOW.md` documenting:
- How the current CDN upload + polling works
- Pattern for implementing "check CDN -> upload if needed -> wait -> generate CSV -> import"
- Required promise/async flow changes
- Progress feedback UI considerations

### Report
Summarize the safeguard implementation approach and async handling requirements.

---

## Success Criteria
After investigation, we should have enough information to:
1. Know exactly where to add the menu selector UI
2. Understand backend changes needed for temp CSV generation
3. Have a clear pattern for the CDN check + upload safeguard flow
4. Be ready to write an implementation plan
