# Contact Details Extraction Feature - Investigation Plan

## Overview

This investigation plan outlines the parallel research tasks required before implementing the Contact Details Extraction feature. The feature adds three new extraction capabilities to the RestaurantDetail page:

1. **NZ Companies Office Extraction** ("Get Contacts" button) - Extract owner name, NZBN, company number from Companies Office
2. **Restaurant Email/Phone Extraction** ("Find Email"/"Find Phone" buttons) - Multi-source extraction dialog
3. **Personal Contact Details Extraction** - Similar dialog for contact email/phone/social links

These features follow patterns established in Google Search v3.0.1 and must support:
- Feature flagging per organization
- Country-specific extraction methods (starting with NZ)
- Usage tracking
- Multi-phase extraction with user selection/validation

---

## Known Information

### New Database Fields Required

**restaurants table additions:**
- `full_legal_name` (text) - Owner's full legal name from Companies Office
- `nzbn` (text) - NZ Business Number
- `company_number` (text) - Companies Office registration number
- `gst_number` (text) - GST registration number
- `additional_contacts_metadata` (jsonb) - Non-primary contact information
- `contact_instagram` (text) - Contact person's Instagram URL
- `contact_facebook` (text) - Contact person's Facebook URL
- `contact_linkedin` (text) - Contact person's LinkedIn URL

### NZ Companies Office URL Patterns

**Step 1 - Search URLs:**
```
Name Search: https://app.companiesoffice.govt.nz/companies/app/ui/pages/companies/search?q={restaurant+name}&entityStatusGroups=REGISTERED&addressTypes=ALL&advancedPanel=true&mode=advanced#results

Address Search: https://app.companiesoffice.govt.nz/companies/app/ui/pages/companies/search?q=&entityStatusGroups=REGISTERED&addressKeyword={address+city}&advancedPanel=true&mode=advanced#results
```

**Step 2 - Detail URL:**
```
https://app.companiesoffice.govt.nz/companies/app/ui/pages/companies/{company_number}/detail
```

### Feature Requirements

1. Must be feature-flagged
2. Must have country context from organization settings
3. Must follow Google Search v3.0.1 extraction/selection patterns
4. Must track usage via UsageTrackingService

---

## Instructions for Next Session

Execute the following investigation plan by spinning up **6 parallel subagents** using the Task tool. Each subagent should investigate a specific area and create a markdown deliverable in the `planning/deployment/ux-improvements/contact-details-extraction/` folder.

**IMPORTANT:**
1. Launch ALL 6 subagents in parallel (single message with 6 Task tool calls)
2. Use `subagent_type="Explore"` for all agents
3. Each agent should ONLY investigate and document - NO code changes
4. Wait for all agents to complete, then read all deliverables
5. Report consolidated findings to the user

---

## subagent_1_instructions

### Task: Feature Flags, Organization Settings & Usage Tracking Investigation

**Context:**
The new contact extraction features need to be feature-flagged and have country context. We need to understand the existing patterns.

**Instructions:**
1. Search for how feature flags are defined and checked in the codebase
2. Find the `OrganizationSettingsService` and understand how country/search country is retrieved
3. Find `UsageTrackingService` and `UsageEventType` to understand usage tracking patterns
4. Look at how `googleSearchExtraction` feature flag is implemented as a reference
5. Find the middleware `requireGoogleSearch` or similar feature flag middleware patterns

**Files to investigate:**
- `src/services/organization-settings-service.js` or similar
- `src/services/usage-tracking-service.js` or similar
- Feature flag middleware patterns in `server.js`
- Any organization settings UI components

**Deliverable:** Create `INVESTIGATION_FEATURE_FLAGS.md` documenting:
- How feature flags are defined and stored
- How feature flags are checked (middleware pattern)
- How organization country/settings are retrieved
- How usage tracking is implemented
- Recommendations for new feature flags needed

---

## subagent_2_instructions

### Task: RestaurantDetail Page UI Structure Investigation

**Context:**
We need to add new UI elements to RestaurantDetail.jsx - buttons and dialogs in specific cards.

**Instructions:**
1. Read `RestaurantDetail.jsx` and understand the overall structure
2. Find the "Contact & Lead Info" card - document its structure and existing fields
3. Find the "Restaurant Info" card - document its structure and existing fields
4. Find existing "Find URL" button patterns in the Platform URLs card
5. Find the "Process Logo" button and dialog pattern in Branding card as reference
6. Document how dialogs are structured and opened/closed

**Files to investigate:**
- `UberEats-Image-Extractor/src/pages/RestaurantDetail.jsx`
- Any reusable dialog components

**Deliverable:** Create `INVESTIGATION_UI_STRUCTURE.md` documenting:
- Contact & Lead Info card structure and line numbers
- Restaurant Info card structure and line numbers
- Existing button patterns (Find URL, Process Logo)
- Dialog component patterns used
- Where new UI elements should be inserted

---

## subagent_3_instructions

### Task: Google Search v3.0.1 Extraction Flow Investigation

**Context:**
The new features should follow the same multi-phase extraction pattern as Google Search v3.0.1.

**Instructions:**
1. Read the Google Search implementation in `server.js` (lines 5160-6252 approximately)
2. Understand the phase structure: URL discovery → Content extraction → User selection → Save
3. Document how `extractedBySource` multi-source data is structured
4. Document how the confirmation dialog handles user selection
5. Find the `/api/google-business-search/save` endpoint pattern

**Files to investigate:**
- `UberEats-Image-Extractor/server.js` - Google Business Search endpoints
- `RestaurantDetail.jsx` - Google Search handlers and dialogs
- `planning/deployment/ux-improvements/google-search-improvements/` - existing docs

**Deliverable:** Create `INVESTIGATION_EXTRACTION_PATTERNS.md` documenting:
- Multi-phase extraction flow
- API request/response structures
- Frontend state management for selection dialogs
- Save endpoint pattern
- How to adapt these patterns for contact extraction

---

## subagent_4_instructions

### Task: Database Schema & Migration Patterns Investigation

**Context:**
We need to add new columns to the restaurants table following existing patterns.

**Instructions:**
1. Find the current restaurants table schema in migrations or Supabase
2. Document all existing columns and their types
3. Find examples of recent migrations that added columns
4. Understand the JSONB field patterns used (if any)
5. Find how database updates are done (direct Supabase or through a service)

**Files to investigate:**
- Supabase migrations folder
- Any database service files
- `server.js` database update patterns

**Deliverable:** Create `INVESTIGATION_DATABASE.md` documenting:
- Current restaurants table schema
- Migration file patterns
- Example migration for adding columns
- JSONB field usage patterns
- Database update service patterns

---

## subagent_5_instructions

### Task: Firecrawl Integration Patterns Investigation

**Context:**
The Companies Office extraction will use Firecrawl's scrape API with JSON extraction schemas.

**Instructions:**
1. Find all places where Firecrawl API is called in the codebase
2. Document the request format for JSON extraction (schema + prompt)
3. Find how parallel/batched Firecrawl requests are handled
4. Document error handling and retry patterns
5. Find rate limiting implementation if any

**Files to investigate:**
- `server.js` - Firecrawl calls
- `lead-scrape-firecrawl-service.js` - if exists
- Any rate limiter services

**Deliverable:** Create `INVESTIGATION_FIRECRAWL.md` documenting:
- Firecrawl API usage patterns
- JSON extraction schema format
- Parallel request handling
- Error handling patterns
- Rate limiting approach
- Example schema/prompt for Companies Office extraction

---

## subagent_6_instructions

### Task: Companies Office Website Structure Investigation

**Context:**
We need to understand the actual HTML structure of the Companies Office pages to design extraction schemas.

**Instructions:**
1. Use WebFetch or Firecrawl to inspect the Companies Office search results page structure
2. Use WebFetch or Firecrawl to inspect a company detail page structure
3. Document the panel IDs mentioned: shareholdersPanel, directorsPanel, addressPanel, nzbnDetailsPanel
4. Design extraction schemas for Step 1 (search) and Step 2 (detail) pages
5. Test if Firecrawl can access these pages (they may require JavaScript rendering)

**URLs to investigate:**
- Search: `https://app.companiesoffice.govt.nz/companies/app/ui/pages/companies/search?q=birria+boss&entityStatusGroups=REGISTERED&addressTypes=ALL&advancedPanel=true&mode=advanced`
- Detail: `https://app.companiesoffice.govt.nz/companies/app/ui/pages/companies/9235660/detail`

**Deliverable:** Create `INVESTIGATION_COMPANIES_OFFICE.md` documenting:
- Search results page structure
- Detail page panel structures (shareholders, directors, addresses, NZBN)
- Extraction schemas for Step 1 and Step 2
- Extraction prompts for Step 1 and Step 2
- Any JavaScript rendering requirements
- Potential challenges/limitations

---

## Post-Investigation Steps

After all 6 subagents complete:

1. Read all 6 investigation deliverables
2. Consolidate findings into a summary
3. Identify any blockers or concerns
4. Create implementation plan outline based on findings
5. Report to user with:
   - Key findings from each investigation
   - Database migration requirements
   - New feature flags needed
   - Recommended implementation order
   - Any risks or concerns identified

---

## Success Criteria

Investigation is complete when:
- [ ] All 6 investigation documents created
- [ ] Database schema changes documented
- [ ] Feature flag pattern understood
- [ ] UI insertion points identified
- [ ] Extraction schemas designed for Companies Office
- [ ] Firecrawl integration pattern understood
- [ ] Ready to create detailed implementation plan
