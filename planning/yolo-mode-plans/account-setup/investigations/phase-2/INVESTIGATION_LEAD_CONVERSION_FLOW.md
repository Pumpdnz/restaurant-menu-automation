# Investigation: Lead-to-Restaurant Conversion Flow

## Overview

This investigation analyzes the current lead conversion flow to understand where to hook in for creating registration batch jobs.

---

## Current Conversion Flow

### Endpoint
`POST /api/leads/convert` (leads-routes.js, line 130)
- Protected by `requireLeadScrapingConversion` feature flag
- Accepts up to 100 leads at once for batch conversion
- Query parameter: `address_source` ('ubereats', 'google', or 'auto')

### Service Function
`convertLeadsToRestaurants()` in lead-scrape-service.js (lines 1403-1546)

---

## Database Operations During Conversion

### Records Created

1. **restaurants table** - New restaurant record with:
   - Basic info: name, slug, phone, email, address, city
   - URLs: website_url, instagram_url, facebook_url, ubereats_url
   - Contact info: contact_name, contact_email, contact_phone, contact_role
   - Business details: cuisine, opening_hours
   - Sales pipeline: lead_type='outbound', lead_category='cold_outreach', lead_warmth='frozen'
   - ICP rating (calculated from review counts)

2. **leads table** - Updated with conversion tracking:
   - `converted_to_restaurant_id` (UUID of new restaurant)
   - `converted_at` (timestamp)
   - `converted_by` (user ID)

### Field Mapping (lines 1456-1505)
```
Lead → Restaurant
- restaurant_name → name
- platform + restaurant_name → slug (format: {name-slug}-{org_suffix})
- phone, email, city → phone, email, city
- ubereats_address OR google_address → address (configurable)
- website_url, instagram_url, facebook_url → same fields
- store_link → ubereats_url
- ordering_platform_name → maps to specific URL column
- contact_name, contact_email, contact_phone, contact_role → same fields
- ubereats_cuisine → cuisine array
- opening_hours → converted format
```

---

## Extraction Triggering (Post-Conversion)

Extractions are triggered AFTER conversion in the **PendingLeadsTable** component:

### Flow
1. **Post-Conversion Sequence Enrollment:**
   - Component: PendingLeadsTable.tsx (lines 413-428, 474-485)
   - Captures converted restaurants with their URLs
   - Stores in `convertedRestaurants` state

2. **Sequence Modal (BulkStartSequenceModal):**
   - User selects a sequence template
   - Calls `useBulkStartSequence()` hook
   - Creates sequence_instances for each restaurant

3. **Extraction Options Dialog (lines 540-632):**
   - Shows options: menu, images, optionSets, branding
   - User toggles which extractions to run

4. **Menu Extraction:**
   - Endpoint: `POST /extract-menu-premium`
   - Async job creation
   - Options: extractOptionSets, validateImages

5. **Branding Extraction:**
   - Endpoint: `POST /website-extraction/branding`
   - Fire-and-forget pattern (no await)

---

## Extension Points for Registration Jobs

### Primary Integration Point
`convertLeadsToRestaurants()` in lead-scrape-service.js
- After line 1510: Restaurant successfully created
- Before line 1513: Lead is marked as converted

### Alternative Point
lead-routes.js line 156-161
- After conversion service completes
- Before response sent to client

### Proposed Integration

```javascript
// After restaurant creation (around line 1510)
const registrationJob = await createRegistrationJob({
  restaurant_id: restaurant.id,
  organisation_id: lead.organisation_id,
  batch_job_id: batchJobId, // Pass in from caller
  status: 'pending',
  execution_config: {
    source_lead_id: lead.id,
    source_lead_job_id: lead.lead_scrape_job_id,
    email: lead.contact_email,
    phone: lead.phone,
    // ... other config
  }
});
```

---

## Current Limitations

1. **No batch registration job** - Each conversion creates individual restaurant only
2. **No tracking of lead batch origin** - Converted restaurants don't maintain reference to source
3. **No webhook/event system** - Conversion doesn't trigger other systems automatically

---

## Key Data Available for Registration Job

At conversion time, these fields are available:
- `restaurant.id` - new restaurant ID
- `restaurant.organisation_id` - for batching
- Lead data: phone, email, contact_name, opening_hours, cuisine
- URLs: website_url, ubereats_url, instagram_url, facebook_url
- Address and city information

---

## Proposed Integration Approach

### Option 1: Extend Conversion Service (Recommended)
Add registration job creation directly in `convertLeadsToRestaurants()`:
- When converting leads, optionally create registration batch
- Pass `create_registration_batch: true` flag
- Creates `registration_batch_jobs` + `registration_jobs` records

### Option 2: Post-Conversion Hook
After successful conversion response, UI triggers:
- `POST /api/registration-batches` with converted restaurant IDs
- Separate concern, but requires extra API call

### Option 3: Event-Driven
- Conversion emits event
- Registration service listens and creates jobs
- Most decoupled, but adds complexity

**Recommendation:** Option 1 for simplicity - extend conversion to optionally create registration batch.
