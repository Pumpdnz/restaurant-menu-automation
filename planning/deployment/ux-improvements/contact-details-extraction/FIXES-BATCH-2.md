# Contact Details Extraction - Fixes Batch 2

## Overview

This document outlines fixes for issues discovered after Batch 1 implementation, focusing on the Email/Phone extraction dialog and Personal Contact Details extraction.

**Last Updated:** 2025-12-16

**Status:** COMPLETED

---

## Issue Summary

| Issue | Problem | Solution |
|-------|---------|----------|
| 1 | Save endpoint uses wrong column name `restaurant_email` | Update to use correct column name `email` |
| 2 | Facebook extraction fails (blocked on Firecrawl) | Remove Extract button, keep manual link only |
| 3 | Personal contact details extraction needs redesign | Replace with search query links + input fields for social profiles |

---

## Issue 1: Restaurant Email Column Name Mismatch

### Problem
When saving restaurant email in the Email/Phone extraction dialog, the save endpoint fails with:
```
Failed to update restaurant: Could not find the 'restaurant_email' column of 'restaurants' in the schema cache
```

The actual column name in the database is `email`, not `restaurant_email`.

### Root Cause
The save endpoint in `email-phone-routes.js` is using incorrect column names for restaurant fields.

### Solution
Update the field mapping in the save endpoint to use correct column names:
- `restaurant_email` → `email`
- `restaurant_phone` → `phone` (verify this is correct)

### Files to Modify
- `UberEats-Image-Extractor/src/routes/email-phone-routes.js`

### Implementation

**Find the save endpoint and update field mappings:**
```javascript
// Current (incorrect):
if (selections.restaurant_email?.save) {
  updateData.restaurant_email = selections.restaurant_email.value;
}

// Fixed:
if (selections.restaurant_email?.save) {
  updateData.email = selections.restaurant_email.value;  // Use 'email' column
}
if (selections.restaurant_phone?.save) {
  updateData.phone = selections.restaurant_phone.value;  // Use 'phone' column
}
```

---

## Issue 2: Facebook Extraction Blocked on Firecrawl

### Problem
Facebook URLs are blocked by Firecrawl, so the "Extract" button for Facebook sources fails. This causes confusion for users.

### Solution
1. Remove the "Extract" button from Facebook sources
2. Keep only the "Open Link" button for manual searching
3. Remove any Facebook-specific Firecrawl extraction logic

### Files to Modify
- `UberEats-Image-Extractor/src/components/dialogs/EmailPhoneExtractionDialog.jsx`

### Implementation

**Update the source rendering to hide Extract button for Facebook:**
```jsx
{/* For each source, only show Extract if not Facebook */}
<div className="flex gap-2">
  <Button
    variant="outline"
    size="sm"
    onClick={() => window.open(source.url, '_blank')}
  >
    <ExternalLink className="h-3 w-3 mr-1" />
    Open Link
  </Button>

  {/* Only show Extract button for non-Facebook sources */}
  {source.type !== 'facebook' && (
    <Button
      size="sm"
      onClick={() => handleExtract(source)}
      disabled={extracting}
    >
      {extracting ? <Loader2 className="animate-spin" /> : 'Extract'}
    </Button>
  )}
</div>
```

**Add note for Facebook sources:**
```jsx
{source.type === 'facebook' && (
  <p className="text-xs text-muted-foreground">
    Facebook extraction not available. Please search manually.
  </p>
)}
```

---

## Issue 3: Personal Contact Details Extraction Redesign

### Problem
The current personal contact details extraction dialog attempts to use Firecrawl for extraction, which doesn't work well for finding individual contact information on social platforms.

### Solution
Redesign the dialog to:
1. Provide search query links that open in new tabs
2. Add input fields for contact social profile URLs
3. Display saved social profiles as clickable links

### New Fields Required
The following fields should already exist from Phase 1 migration:
- `contact_instagram` (text)
- `contact_facebook` (text)
- `contact_linkedin` (text)

### Files to Modify
- `UberEats-Image-Extractor/src/components/dialogs/EmailPhoneExtractionDialog.jsx` (or create new `PersonalContactDialog.jsx`)
- `UberEats-Image-Extractor/src/pages/RestaurantDetail.jsx` (to display social links)

### Implementation

**New Dialog Structure:**
```
┌─────────────────────────────────────────────────────────────┐
│ Find Personal Contact Details                                │
│ Search for contact information on social platforms           │
├─────────────────────────────────────────────────────────────┤
│ Contact: {contact_name}                                      │
│ Restaurant: {restaurant_name}                                │
├─────────────────────────────────────────────────────────────┤
│ Search Links (opens in new tab):                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 🔗 LinkedIn: "{contact_name} {restaurant_name}"         │ │
│ │ [Search LinkedIn]                                        │ │
│ └─────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 📷 Instagram: "{contact_name} {restaurant_name}"        │ │
│ │ [Search Instagram]                                       │ │
│ └─────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 📘 Facebook: "{contact_name} {restaurant_name}"         │ │
│ │ [Search Facebook]                                        │ │
│ └─────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 📧 Email: "{contact_name} {restaurant_name} email"      │ │
│ │ [Search Google]                                          │ │
│ └─────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│ Save Profile URLs:                                           │
│ LinkedIn URL:  [https://linkedin.com/in/...        ]        │
│ Instagram URL: [https://instagram.com/...          ]        │
│ Facebook URL:  [https://facebook.com/...           ]        │
│ Contact Email: [contact@email.com                  ]        │
│ Contact Phone: [+64 21 123 4567                    ]        │
├─────────────────────────────────────────────────────────────┤
│                                    [Cancel] [Save]           │
└─────────────────────────────────────────────────────────────┘
```

**Search URL Builders:**
```javascript
const buildSearchUrls = (contactName, restaurantName) => ({
  linkedin: `https://www.google.com/search?q=${encodeURIComponent(`${contactName} ${restaurantName} LinkedIn`)}`,
  instagram: `https://www.google.com/search?q=${encodeURIComponent(`${contactName} ${restaurantName} Instagram`)}`,
  facebook: `https://www.google.com/search?q=${encodeURIComponent(`${contactName} ${restaurantName} Facebook`)}`,
  email: `https://www.google.com/search?q=${encodeURIComponent(`${contactName} ${restaurantName} email address`)}`
});
```

**State for input fields:**
```javascript
const [contactLinkedin, setContactLinkedin] = useState(restaurant?.contact_linkedin || '');
const [contactInstagram, setContactInstagram] = useState(restaurant?.contact_instagram || '');
const [contactFacebook, setContactFacebook] = useState(restaurant?.contact_facebook || '');
const [contactEmail, setContactEmail] = useState(restaurant?.contact_email || '');
const [contactPhone, setContactPhone] = useState(restaurant?.contact_phone || '');
```

**Display social links in RestaurantDetail (when not editing):**
```jsx
{restaurant?.contact_linkedin && (
  <div className="flex items-center gap-2">
    <Label className="text-xs">LinkedIn</Label>
    <a
      href={restaurant.contact_linkedin}
      target="_blank"
      rel="noopener noreferrer"
      className="text-sm text-primary hover:underline flex items-center gap-1"
    >
      {restaurant.contact_linkedin}
      <ExternalLink className="h-3 w-3" />
    </a>
  </div>
)}
```

---

## Files to Modify Summary

| File | Changes |
|------|---------|
| `email-phone-routes.js` | Fix column name mapping (restaurant_email → email) |
| `EmailPhoneExtractionDialog.jsx` | Remove Facebook Extract button, add note |
| `PersonalContactDialog.jsx` or modify existing | Redesign with search links + input fields |
| `RestaurantDetail.jsx` | Display contact social links as clickable URLs |

---

## Testing Checklist

### Issue 1: Email Column Fix
- [x] Restaurant email saves successfully
- [x] Restaurant phone saves successfully
- [x] No schema cache errors in logs

### Issue 2: Facebook Extraction Removal
- [x] Facebook sources show "Open Link" button only
- [x] No "Extract" button for Facebook sources
- [x] Note displayed explaining manual search required

### Issue 3: Personal Contact Details Redesign
- [x] Search links open correct Google searches in new tab
- [x] LinkedIn search query includes contact name and restaurant name
- [x] Instagram search query includes contact name and restaurant name
- [x] Facebook search query includes contact name and restaurant name
- [x] Email search query includes contact name and restaurant name
- [x] Input fields for social profile URLs work correctly
- [x] Save button updates all contact fields
- [x] Saved social profile URLs display as clickable links in view mode

---

## Implementation Order

1. **Issue 1** - Quick fix, critical for functionality
2. **Issue 2** - Quick fix, improves UX
3. **Issue 3** - Larger redesign, requires more changes
