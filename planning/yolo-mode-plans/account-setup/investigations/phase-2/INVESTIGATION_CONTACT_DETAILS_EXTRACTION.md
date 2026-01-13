# Investigation: Contact Details Extraction Process

## Overview

The contact details extraction is a three-phase, user-interactive process for extracting business registration and owner information from the NZ Companies Office register.

---

## Current Implementation

### Phase 1: Search Phase
**Endpoint:** `POST /api/companies-office/search`

**Inputs:**
- restaurantId
- restaurantName
- street
- city

**Process:**
- Executes parallel searches: by restaurant name AND by address
- Uses Firecrawl API to scrape Companies Office search results
- Deduplicates by company number

**Output:** Array of company candidates with:
- Company name, number, NZBN
- Status (Registered, In liquidation, etc.)
- Incorporation date
- Registered address

---

### Phase 2: Selection & Detail Extraction
**Endpoint:** `POST /api/companies-office/details`

**Inputs:**
- restaurantId
- companyNumbers[] (selected companies)

**Process:**
- Extracts full company details in batches of 3 (conservative concurrency)
- For each company: fetches detail page, extracts structured data

**Output:** Full company details including:
- Directors (name, position, status, dates)
- Shareholders (name, type, percentage)
- Multiple addresses (registered office, service address)
- NZBN details (GST numbers, phones, emails, websites)

---

### Phase 3: Data Selection & Persistence
**Endpoint:** `POST /api/companies-office/save`

**Inputs:**
- restaurantId
- selections (field mapping with save flags)

**Process:**
- Selectively saves chosen fields to restaurant record
- Stores full extraction metadata in JSONB `additional_contacts_metadata` column

---

## UI Flow (CompaniesOfficeDialog)

### Step 1 - Search Configuration (User Interactive)
- Pre-populated from restaurant record
- User can edit restaurant name, street, city
- User clicks "Search" to proceed

### Step 2 - Company Selection (User Interactive)
- Displays combined results (name + address search)
- User selects which companies to extract details from
- Links to Companies Office for manual verification

### Step 3 - (Currently skipped)
- Was intended for comparison view
- Auto-selects if only one company

### Step 4 - Data Selection & Saving (User Interactive)
- Shows extracted company details
- User selects from available options:
  - Company info (name, number, NZBN, GST)
  - Contact people (directors, shareholders)
  - Emails from NZBN details
- User clicks "Save Selected"

---

## Data Persistence & State Management

### Current Architecture (All In-Memory)
- Dialog state stored in React component state
- Search results held in `searchResults` state
- Company details held in `companyDetails` state
- Selections held in `selections` state

**RISK:** User closes dialog/browser = all progress lost

### Database Persistence
Final selections saved to `restaurants` table:
- `company_name`
- `company_number`
- `nzbn`
- `gst_number`
- `contact_name`
- `full_legal_name`
- `contact_email`
- `additional_contacts_metadata` (JSONB - complete extraction)

---

## Why This is User-Interaction Intensive

1. **Search Query Validation**
   - Restaurant names rarely match legal entity names
   - Users must confirm searches find right companies
   - May need multiple name variations

2. **Candidate Selection**
   - Multiple businesses may have similar names
   - Legal entity ≠ Trading name
   - User must verify address matches

3. **Data Extraction Timing**
   - User needs to compare multiple companies
   - Can't automatically select "the one" company

4. **Contact Selection**
   - Multiple contact options from different sources
   - Users choose which to save

---

## Integration Requirements for Batch Orchestration

### Current Blockers

1. **State Persistence Gap**
   - Phase 1 search results stored only in React state
   - Phase 2 selections stored only in React state
   - Need database table to persist between sessions

2. **User Decision Points**
   - Phase 1: User confirms search queries
   - Phase 2: User selects correct company
   - Can't automate without breaking accuracy

3. **Async Execution Challenges**
   - Current dialog operates synchronously
   - Batch mode needs pause/resume capability

---

## Proposed Async/Batch Integration

### New Database Tables

```sql
-- Persist search candidates
companies_office_search_candidates:
  - id UUID
  - restaurant_id UUID
  - registration_job_id UUID
  - search_queries JSONB (name, street, city used)
  - name_results JSONB
  - address_results JSONB
  - candidate_count INTEGER
  - selected_company_number TEXT NULL
  - status TEXT (pending, awaiting_selection, selected)
  - created_at, updated_at

-- Persist extraction results
companies_office_extractions:
  - id UUID
  - restaurant_id UUID
  - company_number TEXT
  - extraction_data JSONB
  - status TEXT (pending, completed, failed)
  - created_at
```

### Step Breakdown for Orchestration

**Step 2a - Candidate Search (Automatic):**
- Run `POST /api/companies-office/search` for all restaurants
- Store results in `companies_office_search_candidates`
- Mark `status = 'awaiting_selection'`

**Step 2b - Candidate Selection (Action Required):**
- NEW UI: Batch view of restaurants with search results
- User selects company for each restaurant
- Updates `selected_company_number`
- Marks `status = 'selected'`

**Step 3 - Detail Extraction (Automatic):**
- Run `POST /api/companies-office/details` for selected companies
- Store in `companies_office_extractions`
- Mark `status = 'completed'`

**Step 4 - Auto-Save (Automatic):**
- Auto-select defaults (first active director, all company info)
- Run `POST /api/companies-office/save` automatically

---

## Recommended Next Actions

1. **Create New Tables**
   - `companies_office_search_candidates`
   - `companies_office_extractions`

2. **Create Batch UI Component**
   - Similar to LeadScrapesPage pattern
   - Show restaurants needing company selection
   - Allow bulk selection

3. **Create Async Service**
   - Wrap existing endpoints in job-based execution
   - Follow registration-job-service pattern

4. **Modify Dialog Behavior**
   - When called from batch: skip to selection screen
   - When called from RestaurantDetail: keep current flow
