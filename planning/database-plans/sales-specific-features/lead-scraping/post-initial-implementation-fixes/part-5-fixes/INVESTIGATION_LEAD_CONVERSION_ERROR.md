# Investigation: Lead Conversion Error

**Date**: 2025-12-15
**Error**: `Could not find the 'country' column of 'restaurants' in the schema cache`
**Status**: ✅ FIXED

---

## Error Context

When attempting to convert a lead to a restaurant via `POST /api/leads/convert`, the following error occurs:

```
[LeadScrapeService] Error converting lead d2541518-0a24-467f-b553-f7f565bf651f: {
  code: 'PGRST204',
  details: null,
  hint: null,
  message: "Could not find the 'country' column of 'restaurants' in the schema cache"
}
```

---

## Root Cause Analysis

### The Problem

The `convertLeadsToRestaurants` function in `lead-scrape-service.js` (lines 1237-1266) attempts to insert columns that **do not exist** in the `restaurants` table.

### Code Location
**File:** `UberEats-Image-Extractor/src/services/lead-scrape-service.js`
**Function:** `convertLeadsToRestaurants()` (lines 1213-1306)

### Fields Being Inserted vs Actual Schema

| Field in Code | Exists in `restaurants`? | Notes |
|---------------|--------------------------|-------|
| `name` | ✅ YES | `character varying`, NOT NULL |
| `slug` | ✅ YES | `character varying` |
| `organisation_id` | ✅ YES | `uuid` |
| `phone` | ✅ YES | `character varying` |
| `email` | ✅ YES | `character varying` |
| `address` | ✅ YES | `text` |
| `city` | ✅ YES | `text` |
| `region` | ❌ **NO** | Column does not exist |
| `country` | ❌ **NO** | Column does not exist |
| `website_url` | ✅ YES | `text` |
| `instagram_url` | ✅ YES | `text` |
| `facebook_url` | ✅ YES | `text` |
| `google_maps_url` | ❌ **NO** | Column does not exist |
| `contact_name` | ✅ YES | `text` |
| `contact_email` | ✅ YES | `text` |
| `contact_phone` | ✅ YES | `text` |
| `lead_status` | ✅ YES | `text` |
| `source` | ❌ **NO** | Column does not exist |
| `metadata` | ✅ YES | `jsonb` |

### Missing Columns (4 total)
1. **`country`** - Used to store country code (e.g., 'nz', 'au')
2. **`region`** - Used to store region/state
3. **`google_maps_url`** - Used to store Google Maps URL
4. **`source`** - Used to track where lead came from (e.g., 'lead_scrape_ubereats')

---

## Current Code (Problematic Insert)

```javascript
const { data: restaurant, error: restaurantError } = await client
  .from('restaurants')
  .insert({
    name: lead.restaurant_name,
    slug,
    organisation_id: orgId,
    phone: lead.phone,
    email: lead.email,
    address: lead.ubereats_address || lead.google_address,
    city: lead.city,
    region: lead.region,           // ❌ COLUMN DOESN'T EXIST
    country: lead.country || 'nz', // ❌ COLUMN DOESN'T EXIST
    website_url: lead.website_url,
    instagram_url: lead.instagram_url,
    facebook_url: lead.facebook_url,
    google_maps_url: lead.google_maps_url, // ❌ COLUMN DOESN'T EXIST
    contact_name: lead.contact_name,
    contact_email: lead.contact_email,
    contact_phone: lead.contact_phone,
    lead_status: 'new',
    source: `lead_scrape_${lead.platform}`, // ❌ COLUMN DOESN'T EXIST
    metadata: { ... }
  })
```

---

## Solution Options

### Option A: Add Missing Columns to `restaurants` Table (Recommended)

Add the 4 missing columns to align the table with the conversion logic:

```sql
ALTER TABLE restaurants
ADD COLUMN region text,
ADD COLUMN country text DEFAULT 'nz',
ADD COLUMN google_maps_url text,
ADD COLUMN source text;
```

**Pros:**
- Preserves all lead data during conversion
- `country` and `region` are useful for filtering/reporting
- `google_maps_url` is valuable for location services
- `source` helps track lead origin for analytics

**Cons:**
- Schema change required
- Need to update any existing code that queries these columns

---

### Option B: Remove Non-Existent Fields from Insert (Quick Fix)

Update `convertLeadsToRestaurants()` to only insert existing columns:

```javascript
const { data: restaurant, error: restaurantError } = await client
  .from('restaurants')
  .insert({
    name: lead.restaurant_name,
    slug,
    organisation_id: orgId,
    phone: lead.phone,
    email: lead.email,
    address: lead.ubereats_address || lead.google_address,
    city: lead.city,
    // REMOVED: region, country, google_maps_url, source
    website_url: lead.website_url,
    instagram_url: lead.instagram_url,
    facebook_url: lead.facebook_url,
    contact_name: lead.contact_name,
    contact_email: lead.contact_email,
    contact_phone: lead.contact_phone,
    lead_status: 'new',
    metadata: {
      converted_from_lead: leadId,
      ubereats_reviews: lead.ubereats_number_of_reviews,
      ubereats_rating: lead.ubereats_average_review_rating,
      google_reviews: lead.google_number_of_reviews,
      google_rating: lead.google_average_review_rating,
      // Store removed fields in metadata instead
      region: lead.region,
      country: lead.country,
      google_maps_url: lead.google_maps_url,
      source: `lead_scrape_${lead.platform}`
    }
  })
```

**Pros:**
- Quick fix, no schema change needed
- Data preserved in metadata

**Cons:**
- Data buried in JSONB, harder to query/filter
- Loses structured column benefits

---

### Option C: Hybrid Approach

Add only the most valuable columns (`country`, `source`) and store others in metadata:

```sql
ALTER TABLE restaurants
ADD COLUMN country text DEFAULT 'nz',
ADD COLUMN source text;
```

Then update code to move `region` and `google_maps_url` to metadata.

---

## Recommendation

**Use Option A** - Add all 4 missing columns.

Rationale:
1. These are standard restaurant fields that have legitimate use cases
2. `country` is essential for multi-country operations
3. `google_maps_url` is useful for location embedding
4. `source` is critical for lead attribution/analytics
5. `region` helps with geographic filtering

---

## Implementation Steps (if Option A chosen)

1. **Create migration** to add columns:
   ```sql
   ALTER TABLE restaurants
   ADD COLUMN region text,
   ADD COLUMN country text DEFAULT 'nz',
   ADD COLUMN google_maps_url text,
   ADD COLUMN source text;
   ```

2. **Apply migration** via Supabase MCP

3. **Test conversion** again

4. **Update IMPLEMENTATION_PLAN.md** with fix status

---

## Related Files

- `UberEats-Image-Extractor/src/services/lead-scrape-service.js` - convertLeadsToRestaurants() function
- `UberEats-Image-Extractor/src/routes/leads-routes.js` - POST /api/leads/convert endpoint
- Database table: `restaurants`

---

## Fix Applied (2025-12-15)

### Changes Made

1. **Database Migration**: Added `additional_ordering_platform_url` column to restaurants table

2. **Updated `convertLeadsToRestaurants()` function**:
   - Removed non-existent columns (`region`, `country`, `source`, `google_maps_url`) from insert
   - Added new field mappings:
     - `ubereats_cuisine` → `cuisine`
     - `store_link` → `ubereats_url`
     - `opening_hours` → `opening_hours`
     - `opening_hours_text` → `opening_hours_text`
     - `website_type` → `website_type`
     - `ordering_platform_name` → `online_ordering_platform`
     - `ordering_platform_url` → appropriate platform column based on name
   - Added sales pipeline defaults:
     - `lead_type` = 'outbound'
     - `lead_category` = 'cold_outreach'
     - `lead_warmth` = 'frozen'
     - `lead_stage` = 'uncontacted'
     - `lead_status` = 'inactive'
     - `icp_rating` = calculated from reviews
   - Moved removed fields to `metadata` JSONB column
   - Added `address_source` parameter for user to choose address

3. **Updated API endpoint** (`POST /api/leads/convert`):
   - Added optional `address_source` parameter: 'ubereats', 'google', or 'auto' (default)

### Ordering Platform URL Mapping

| Platform Name | Target Column |
|--------------|---------------|
| Me&U / MrYum | `meandyou_url` |
| Mobi2Go | `mobi2go_url` |
| DeliverEasy | `delivereasy_url` |
| NextOrder | `nextorder_url` |
| Foodhub | `foodhub_url` |
| Ordermeal | `ordermeal_url` |
| Other (Bite, Bopple, etc.) | `additional_ordering_platform_url` |

### ICP Rating Calculation

```
icp_rating = MIN(10, ROUND(
  ((ubereats_reviews * ubereats_rating) + (google_reviews * google_rating)) / 1000
))
```

---

## Notes

- This issue was **unrelated to the Step 5 removal** - it was a pre-existing schema mismatch
- The conversion function was written before the restaurants table schema was finalized
- Fix preserves all lead data while properly mapping to existing restaurant columns
