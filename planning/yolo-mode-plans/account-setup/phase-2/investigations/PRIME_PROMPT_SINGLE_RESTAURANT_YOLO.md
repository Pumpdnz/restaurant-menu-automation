# Prime Prompt: Single Restaurant YoloModeDialog Enhancements

## Context

Phase 2 Registration Batch Orchestration is **COMPLETE**. Issues 16-18 have been addressed for the batch registration flow. This session focuses on bringing the same enhancements to the single restaurant YoloModeDialog.

The previous session (2024-12-28) completed:
- Issue 16 (partial): Header image manual entry for batch registration
- Issue 17: Current step column updates during processing
- Issue 18: Sub-step progress visible during Step 6 execution

## Remaining Work: Single Restaurant YoloModeDialog

### Problem
The single restaurant YoloModeDialog (accessed from RestaurantDetail page) is missing two features that were added to the batch registration flow:
1. Header image URL paste → save functionality in WebsiteTab
2. Research links bar for finding missing restaurant information

### Task 1: Wire Up Header Image Save to WebsiteTab

**Current State:**
- `WebsiteTab.tsx` already supports `onHeaderImageSave` and `isHeaderImageSaving` props
- `YoloConfigBatchView.tsx` passes these props, but `YoloModeDialog.tsx` does not

**What's Needed:**
1. Create a save handler in `YoloModeDialog.tsx` that updates the restaurant record
2. Wire up `onHeaderImageSave` and `isHeaderImageSaving` props to WebsiteTab
3. The handler should:
   - Accept field name and URL
   - Call API to update restaurant (URL → base64 conversion happens on backend)
   - Refresh restaurant data after save

**Implementation Approach:**
- Option A: Call existing API endpoint `PATCH /api/restaurants/:id` directly
- Option B: Create new hook similar to `useSaveRestaurantFromConfig` but for single restaurant
- Option C: Reuse pattern from `RestaurantDetail.jsx` for saving restaurant fields

**Reference Files:**
- `src/components/registration/YoloModeDialog.tsx` - Target file to modify (lines 469-475 WebsiteTab usage)
- `src/components/registration-batch/YoloConfigBatchView.tsx` lines 280-293 - Example `handleHeaderImageSave` implementation
- `src/pages/RestaurantDetail.jsx` - Existing single restaurant save patterns

### Task 2: Add Research Links Bar

**Current State:**
- `YoloConfigBatchView.tsx` has a research links bar above the TabsList (lines 624-724)
- `YoloModeDialog.tsx` has no research links

**What's Needed:**
Add a research links bar above the TabsList in YoloModeDialog matching the batch view:

1. **Direct links (when data available):**
   - Website URL button (if `restaurant.website_url` present)
   - Facebook URL button (if `restaurant.facebook_url` present)
   - UberEats Page button (if `restaurant.ubereats_url` present)

2. **Google search links:**
   - "Email Search" - `{restaurant_name} {city} email address`
   - "Contact LinkedIn" - `{contact_name} {restaurant_name} LinkedIn` (conditional on contact_name)
   - "Contact Email" - `{contact_name} {restaurant_name} {city} email address` (conditional on contact_name)

3. **AI Search:**
   - "AI Search" - Google AI mode search with comprehensive query

**UI Requirements:**
- Bar spans full width above TabsList
- Use small outline buttons with icons
- Links open in new tabs
- Conditional rendering based on available data

**Reference Implementation:**
Copy and adapt from `YoloConfigBatchView.tsx` lines 624-724:
```typescript
{/* Research Links Bar */}
<div className="flex flex-wrap items-center gap-2 px-3 py-2 bg-blue-50 border-b text-xs">
  <span className="text-muted-foreground font-medium mr-1">Research:</span>
  {/* Website, Facebook, UberEats buttons */}
  {/* Google search buttons */}
  {/* AI Search button */}
</div>
```

### Key Files to Investigate

**Primary file to modify:**
- `src/components/registration/YoloModeDialog.tsx`

**Reference implementations:**
- `src/components/registration-batch/YoloConfigBatchView.tsx` - Research links + header image save
- `src/components/registration/tabs/WebsiteTab.tsx` - Props interface for header image save

**Utility functions to reuse:**
```typescript
function googleSearchUrl(query: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

function googleAISearchUrl(query: string): string {
  return `https://www.google.com/search?udm=50&q=${encodeURIComponent(query)}`;
}
```

### Implementation Steps

1. Read `YoloModeDialog.tsx` to understand current structure
2. Add state for `isHeaderImageSaving`
3. Create `handleHeaderImageSave` function
4. Wire up props to WebsiteTab component
5. Add research links bar above TabsList
6. Test with a restaurant that has various URL fields populated
7. Test header image save with a URL

### Restaurant Type Reference

The `Restaurant` interface in YoloModeDialog already includes:
- `website_og_image`, `ubereats_og_image`, `doordash_og_image`, `facebook_cover_image`
- But NOT `website_url`, `facebook_url`, `ubereats_url`

You may need to extend the Restaurant interface or access these from a different source.

### Notes

- The `restaurant` prop passed to YoloModeDialog comes from `RestaurantDetail.jsx`
- Check what fields are available in that context
- The batch view gets restaurant data from `RegistrationJob.restaurant` which has different fields
