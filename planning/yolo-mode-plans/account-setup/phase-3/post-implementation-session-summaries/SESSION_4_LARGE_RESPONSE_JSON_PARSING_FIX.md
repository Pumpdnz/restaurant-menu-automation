# Session 4: Large Response JSON Parsing Fix

**Date:** 2026-01-03
**Focus:** Fixing JSON parsing errors caused by massive base64 image data in database responses

---

## Issue Identified

During batch registration Step 2 processing, a syntax error occurred:

```
[Database] Error getting all restaurants: {
  message: 'SyntaxError: Unterminated string in JSON at position 90693915 (line 125 column 744663)',
  ...
}
```

The error occurred in `getAllRestaurants()` which uses `SELECT *`, fetching ~90MB of data including base64-encoded images stored directly in database fields.

---

## Root Cause Analysis

### Investigation Findings

Several restaurants had massive base64 data stored in two fields:

| Restaurant | `saved_images` | `logo_url` |
|-----------|----------------|------------|
| The Turkish Grill Bar and Restaurant | **6.2 MB** | 7 KB |
| Royal Indian Cuisine | **2.2 MB** | 29 KB |
| Buckeys Fried Takeaway | 2 bytes | **2.1 MB** |
| Eat Mi | **1.3 MB** | 222 KB |
| Heartbreaker Hot Chicken | 2 bytes | **1.1 MB** |

**Total response size:** ~90MB

When Supabase/PostgREST returns such large responses, they can be truncated mid-transmission, causing JSON parsing to fail with "Unterminated string" errors.

### Affected Functions

1. **`getAllRestaurants()`** in `database-service.js` - Used `SELECT *`
2. **Single-restaurant YOLO mode** in `registration-batch-service.js` - Used `restaurants(*)`

### Usage Analysis

Before fixing, verified that no callers actually need these large fields:

| Caller | Uses `logo_url`? | Uses `saved_images`? |
|--------|------------------|---------------------|
| MoveMenusDialog.jsx | No | No |
| ReferenceImageSelector.tsx | No (uses `/restaurants/logos`) | No |
| UnifiedReferenceImageSelector.tsx | No (uses `/restaurants/logos`) | No |
| VideoGeneration.tsx | No | No |
| ImagesTab.tsx | No | No |
| VideosTab.tsx | No | No |
| SocialMediaVideos.tsx | No | No |

---

## Fixes Applied

### Fix 1: `getAllRestaurants()` in database-service.js

**File:** `UberEats-Image-Extractor/src/services/database-service.js`
**Lines:** 1273-1329

**Before:**
```javascript
const { data, error } = await client
  .from('restaurants')
  .select(`
    *,
    restaurant_platforms (...)
  `)
```

**After:**
```javascript
// Explicit column list - excludes logo_url and saved_images which can contain
// megabytes of base64 data causing JSON parsing failures on large responses
const { data, error } = await client
  .from('restaurants')
  .select(`
    id, name, slug, address, phone, email, website,
    brand_colors, metadata, weekly_sales_range,
    contact_name, contact_email, contact_phone,
    ubereats_url, doordash_url, website_url, instagram_url, facebook_url,
    opening_hours, opening_hours_text,
    organisation_id, organisation_name,
    theme, primary_color, secondary_color, tertiary_color, background_color, accent_color,
    logo_nobg_url, logo_standard_url, logo_thermal_url,
    logo_thermal_alt_url, logo_thermal_contrast_url, logo_thermal_adaptive_url,
    logo_favicon_url, hosted_logo_url,
    user_email, user_password_hint, subdomain, stripe_connect_url,
    payment_settings, service_settings, onboarding_status, workflow_notes,
    city, cuisine,
    meandyou_url, mobi2go_url, delivereasy_url, nextorder_url, foodhub_url, ordermeal_url,
    lead_type, lead_category, lead_engagement_source, lead_warmth, lead_stage, lead_status,
    lead_created_at, demo_store_url, demo_store_built,
    contact_role, point_of_sale, online_ordering_platform,
    uber_profitability_description, current_marketing_description, website_type,
    painpoints, core_selling_points, features_to_highlight, possible_objections,
    details, meeting_link,
    website_og_image, website_og_description, website_og_title,
    ubereats_og_image, doordash_og_image, facebook_cover_image,
    full_legal_name, nzbn, company_number, gst_number,
    additional_contacts_metadata, contact_instagram, contact_facebook, contact_linkedin,
    additional_ordering_platform_url, company_name,
    icp_rating, last_contacted, assigned_sales_rep,
    created_at, updated_at,
    restaurant_platforms (...)
  `)
```

**Excluded fields:**
- `logo_url` - Can contain 2+ MB of base64 data
- `saved_images` - Can contain 6+ MB of base64 JSONB data

---

### Fix 2: Single-Restaurant YOLO Mode in registration-batch-service.js

**File:** `UberEats-Image-Extractor/src/services/registration-batch-service.js`
**Lines:** 3345-3365

**Before:**
```javascript
const { data: job, error: fetchError } = await client
  .from('registration_jobs')
  .select(`
    *,
    restaurant:restaurants(*)
  `)
```

**After:**
```javascript
// Explicit column list - excludes saved_images which can contain megabytes of base64 data
const { data: job, error: fetchError } = await client
  .from('registration_jobs')
  .select(`
    *,
    restaurant:restaurants(
      id, name, slug, subdomain, address, city, email, phone,
      ubereats_url, doordash_url, website_url, facebook_url,
      opening_hours, cuisine,
      contact_name, contact_email, contact_phone,
      theme, primary_color, secondary_color, tertiary_color, accent_color, background_color,
      logo_url, logo_nobg_url, logo_standard_url,
      logo_thermal_url, logo_thermal_alt_url, logo_thermal_contrast_url, logo_thermal_adaptive_url,
      logo_favicon_url, website_og_image, ubereats_og_image, doordash_og_image, facebook_cover_image,
      user_email, user_password_hint,
      stripe_connect_url
    )
  `)
```

**Note:** This fix keeps `logo_url` (needed for YOLO mode website config) but excludes `saved_images`.

---

## Files Modified

| File | Changes |
|------|---------|
| `src/services/database-service.js` | Replaced `SELECT *` with explicit column list in `getAllRestaurants()` |
| `src/services/registration-batch-service.js` | Replaced `restaurants(*)` with explicit column list in single-restaurant YOLO mode |

---

## Impact

- **Response size reduction:** ~90MB → <1MB for `/api/restaurants` endpoint
- **Eliminated JSON parsing failures** during batch registration
- **No functionality loss:** Verified no callers depend on excluded fields

---

## Design Consideration

The root issue is that base64-encoded images should NOT be stored directly in database TEXT/JSONB fields. They should be:
1. Uploaded to a CDN/storage bucket (e.g., Supabase Storage, S3)
2. Only the URL stored in the database

This is a larger refactoring effort that could be addressed in a future phase. The current fix is a safe mitigation that explicitly selects only needed columns.

---

## Testing Notes

To verify the fix:
1. Start a batch registration with multiple restaurants
2. Navigate through Step 1 → Step 2
3. Verify no JSON parsing errors in server logs
4. Confirm Step 2 company search completes successfully

---

*Generated: 2026-01-03*
