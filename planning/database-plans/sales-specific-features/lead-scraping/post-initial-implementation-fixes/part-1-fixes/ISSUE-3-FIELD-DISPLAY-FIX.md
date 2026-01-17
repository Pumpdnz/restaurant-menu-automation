# Issue 3: Step 2 Enriched Fields Not Displaying - Fix Summary

## Issue Description
After successful Step 2 enrichment (confirmed in database), the enriched fields were not displaying in the UI components:
- `ScrapeJobStepDetailModal.tsx`
- `LeadPreview.tsx`
- `LeadDetailModal.tsx`

## Root Cause
**Field name mismatch between TypeScript interface and database schema.**

The `Lead` interface in `useLeadScrape.ts` used generic field names that didn't exist in the database:

| TypeScript Interface (Wrong) | Database Column (Correct) |
|------------------------------|---------------------------|
| `cuisine` | `ubereats_cuisine` |
| `number_of_reviews` | `ubereats_number_of_reviews` |
| `average_review_rating` | `ubereats_average_review_rating` |
| `price_range` | `ubereats_price_rating` |
| `address` | `ubereats_address` / `google_address` |

The API was returning the correct database field names, but the UI components were looking for the wrong field names, resulting in `undefined` values.

## Files Modified

### 1. `useLeadScrape.ts` - Lead Interface
**Path:** `UberEats-Image-Extractor/src/hooks/useLeadScrape.ts`

Restructured the `Lead` interface to match the actual database schema:

```typescript
export interface Lead {
  id: string;
  lead_scrape_job_id: string;
  restaurant_name: string;
  store_link: string | null;
  platform: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  current_step: number;
  step_progression_status: 'available' | 'processing' | 'processed' | 'passed' | 'failed';

  // UberEats enrichment fields (Step 2)
  ubereats_number_of_reviews: string | null;
  ubereats_average_review_rating: number | null;
  ubereats_address: string | null;
  ubereats_cuisine: string[] | null;
  ubereats_price_rating: number | null;

  // Google enrichment fields (Step 3)
  google_number_of_reviews: string | null;
  google_average_review_rating: number | null;
  google_address: string | null;

  // Contact information
  phone: string | null;
  email: string | null;
  website_url: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  google_maps_url: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  contact_role: string | null;
  organisation_name: string | null;
  number_of_venues: number | null;

  // Business details
  opening_hours: any | null;
  opening_hours_text: string | null;
  website_type: string | null;
  online_ordering_platform: string | null;
  online_ordering_handles_delivery: boolean | null;

  // Validation & status
  validation_errors: string[];
  is_valid: boolean;
  is_duplicate: boolean;
  duplicate_of_lead_id: string | null;
  duplicate_of_restaurant_id: string | null;

  // Conversion tracking
  converted_to_restaurant_id: string | null;
  converted_at: string | null;
  converted_by: string | null;

  // Timestamps
  created_at: string;
  updated_at: string;
  metadata: any;
}
```

### 2. `ScrapeJobStepDetailModal.tsx`
**Path:** `UberEats-Image-Extractor/src/components/leads/ScrapeJobStepDetailModal.tsx`

Changes:
- Search filter: `lead.address` → `lead.ubereats_address`
- Cuisine display: `lead.cuisine` → `lead.ubereats_cuisine`
- Rating display: `lead.average_review_rating` → `lead.ubereats_average_review_rating`
- Reviews display: `lead.number_of_reviews` → `lead.ubereats_number_of_reviews`

### 3. `LeadPreview.tsx`
**Path:** `UberEats-Image-Extractor/src/components/leads/LeadPreview.tsx`

Changes:
- Rating display: `lead.average_review_rating` → `lead.ubereats_average_review_rating`
- Reviews display: `lead.number_of_reviews` → `lead.ubereats_number_of_reviews`

### 4. `LeadDetailModal.tsx`
**Path:** `UberEats-Image-Extractor/src/components/leads/LeadDetailModal.tsx`

Changes:
- Form data initialization: `address` → `ubereats_address`
- Reviews section: Uses `ubereats_average_review_rating`, `ubereats_number_of_reviews`
- Price display: Uses `ubereats_price_rating` (displays as "$" symbols, 1-4)
- Cuisine section: `lead.cuisine` → `lead.ubereats_cuisine`
- Address display: `lead.address` → `lead.ubereats_address || lead.google_address`
- Edit form field: `address` → `ubereats_address`

### 5. `lead-scrape-service.js`
**Path:** `UberEats-Image-Extractor/src/services/lead-scrape-service.js`

Added `ubereats_address` and `google_address` to the `allowedFields` array in `updateLead()` function to allow editing these fields.

## Display Requirements Verification

| Component | Field | Status |
|-----------|-------|--------|
| **ScrapeJobStepDetailModal.tsx** | | |
| | ubereats_average_review_rating | ✅ Fixed |
| | ubereats_number_of_reviews | ✅ Fixed |
| | ubereats_cuisine | ✅ Fixed |
| | ubereats_price_rating | N/A (not in table view) |
| **LeadPreview.tsx** | | |
| | ubereats_average_review_rating | ✅ Fixed |
| | ubereats_number_of_reviews | ✅ Fixed |
| | ubereats_cuisine | N/A (not in preview) |
| | ubereats_price_rating | N/A (not in preview) |
| **LeadDetailModal.tsx** | | |
| | ubereats_average_review_rating | ✅ Fixed |
| | ubereats_number_of_reviews | ✅ Fixed |
| | ubereats_cuisine | ✅ Fixed |
| | ubereats_price_rating | ✅ Fixed (displays as $$$) |
| | ubereats_address | ✅ Fixed |

## Testing Checklist

- [ ] Run Step 2 extraction on a job with leads
- [ ] Open ScrapeJobStepDetailModal - verify rating and reviews display in table
- [ ] Hover over leads column to open LeadPreview - verify rating displays
- [ ] Click a lead to open LeadDetailModal:
  - [ ] Verify rating displays with star icon
  - [ ] Verify review count displays
  - [ ] Verify price rating displays as $ symbols
  - [ ] Verify cuisine tags display
  - [ ] Verify address displays in Location & Contact section
- [ ] Edit a lead and verify address can be saved

## Notes

- The price rating is stored as an integer (1-4) in the database and is now displayed as "$" repeated that many times (e.g., `$$$` for price_rating=3)
- The address field in LeadDetailModal now falls back to `google_address` if `ubereats_address` is null, supporting future Step 3 enrichment
- The `number_of_reviews` field is stored as text (e.g., "500+") not a number, so `.toLocaleString()` was removed
