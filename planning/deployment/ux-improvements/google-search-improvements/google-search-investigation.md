# Google Search Feature Investigation

**Date:** December 12, 2025
**Status:** Investigation Complete

---

## Executive Summary

The Google Search feature currently has several issues:
1. **No user selection** - All returned data automatically overwrites existing values
2. **Unreliable data** - Social media URLs lack proper validation/cleaning
3. **No preview** - Users cannot see what data will be updated before it's applied
4. **Missing validation** - URL cleaning that exists in lead scraping is not used here

This document details the current implementation and identifies improvements needed.

---

## Current Implementation Analysis

### Frontend Flow

**File:** `UberEats-Image-Extractor/src/pages/RestaurantDetail.jsx`

#### State Variables (Line 104)
```javascript
const [searchingGoogle, setSearchingGoogle] = useState(false);
```

#### Handler Function (Lines 1659-1718)
```javascript
const handleGoogleSearch = async () => {
  // Validates restaurant.name exists
  // Extracts city from restaurant.city or parses from address
  // Calls POST /api/google-business-search
  // AUTOMATICALLY applies all returned data without confirmation
  // Refreshes data after 1.5 seconds
};
```

#### Fields Updated Automatically (Lines 1689-1697)
| Field | Response Key | Description |
|-------|--------------|-------------|
| `address` | `data.address` | Physical address |
| `phone` | `data.phone` | Phone number |
| `website_url` | `data.websiteUrl` | Website URL |
| `instagram_url` | `data.instagramUrl` | Instagram profile URL |
| `facebook_url` | `data.facebookUrl` | Facebook profile URL |
| `opening_hours` | `data.openingHours` | Array of opening hours |

**Problem:** No confirmation dialog - all found data is immediately merged:
```javascript
setRestaurant(prev => ({
  ...prev,
  ...updates  // ALL updates applied without user choice
}));
```

#### UI Button (Lines 3262-3281)
- Feature-flagged with `googleSearchExtraction`
- Only shows for existing restaurants
- Shows "Searching..." spinner while in progress

---

### Backend API Endpoint

**File:** `UberEats-Image-Extractor/server.js`

**Endpoint:** `POST /api/google-business-search` (Line 5157)

**Middleware:** `authMiddleware`, `requireGoogleSearch` (feature flag)

#### Multi-Phase Search Architecture

**Phase 1: Combined Platform Search (Lines 5180-5346)**
- Single combined Firecrawl search query with OR operators
- Searches for: website, UberEats, DoorDash, Facebook, Instagram, Meandu, Mobi2go, Delivereasy, NextOrder, FoodHub, OrderMeal
- URL categorization with exclusion list (Google, Yelp, TripAdvisor, etc.)
- Rate limit handling with retry logic

**Phase 2: Platform-Specific Searches (Lines 5350-5384)**
- Conditional searches for missing platform URLs
- DoorDash-specific search with `site:doordash.com`

**Phase 3: Content Extraction (Lines 5386-5697)**
- Priority order: UberEats first (most reliable), then website
- Extracts: address, phone, opening hours
- Platform-specific extraction prompts and schemas

#### Current Validation (Incomplete)

**Social Media URL Cleaning (Lines 5388-5399):**
```javascript
const cleanSocialMediaUrl = (url) => {
  if (url.includes('instagram.com') && url.includes('?')) {
    return url.split('?')[0]; // Only removes query params
  }
  if (url.includes('facebook.com') && url.includes('?')) {
    return url.split('?')[0]; // Only removes query params
  }
  return url;
};
```

**Problem:** This is basic - only strips query parameters. Does NOT:
- Validate URL is a profile page (not a post/reel/story)
- Normalize URL format
- Filter invalid patterns

**Phone Validation (Lines 5636-5663):**
```javascript
const cleanAndValidateNZPhone = (phoneStr) => {
  // NZ-specific patterns
  // Converts to +64 format
  // This part is good!
};
```

#### Database Update (Lines 5807-5847)
- Updates ALL found fields without selection
- No preview mode available

---

## Lead Scraping Validation (Better Implementation)

**File:** `UberEats-Image-Extractor/src/services/lead-url-validation-service.js`

### Instagram URL Validation (Lines 14-47)
```javascript
const cleanInstagramUrl = (url) => {
  // Validates contains 'instagram.com'
  // REJECTS: /reel/, /p/, /stories/, /reels/, /tv/, /explore/
  // Extracts and validates username format
  // Returns normalized: https://www.instagram.com/{username}/
  // Returns null if invalid
};
```

### Facebook URL Validation (Lines 58-108)
```javascript
const cleanFacebookUrl = (url) => {
  // Validates contains 'facebook.com'
  // REJECTS: /videos/, /groups/, /posts/, /events/, /photos/, /watch/
  // Skips system pages: login, help, marketplace, etc.
  // Handles /p/ profile URLs and profile.php?id= format
  // Returns normalized URL or null
};
```

### Website URL Validation (Lines 137-170)
```javascript
const cleanWebsiteUrl = (url) => {
  // Validates HTTP protocol
  // FILTERS OUT delivery platforms by hostname
  // Returns null if invalid
};
```

### Where It's Used (lead-scrape-firecrawl-service.js Lines 1002-1028)
```javascript
const cleanedInstagram = cleanInstagramUrl(result.instagram_url);
const cleanedFacebook = cleanFacebookUrl(result.facebook_url);
const cleanedWebsite = cleanWebsiteUrl(result.website_url);
```

---

## Issues Identified

### Issue 1: No User Selection/Confirmation
- All returned data automatically overwrites existing values
- No preview of what will be changed
- No way to cherry-pick which fields to update

### Issue 2: Inadequate Social Media URL Validation
- Google Search only strips query params
- Lead scraping has comprehensive validation that rejects invalid URLs
- Instagram reels/posts/stories URLs being saved as profile URLs
- Facebook videos/events/posts URLs being saved as page URLs

### Issue 3: No Preview Mode
- API immediately saves to database
- No way to see extracted data before committing

### Issue 4: Missing Data Source Attribution
- Users can't see which source provided which data
- No way to prefer one source over another

### Issue 5: Inconsistent Validation
- Phone validation is good (NZ-specific patterns)
- Address validation is basic
- URL validation is inadequate compared to lead scraping

---

## Key Files Reference

### Frontend
| File | Lines | Purpose |
|------|-------|---------|
| `RestaurantDetail.jsx` | 104 | `searchingGoogle` state |
| `RestaurantDetail.jsx` | 1659-1718 | `handleGoogleSearch` function |
| `RestaurantDetail.jsx` | 1689-1697 | Fields updated from results |
| `RestaurantDetail.jsx` | 3262-3281 | Google Search button UI |

### Backend
| File | Lines | Purpose |
|------|-------|---------|
| `server.js` | 5152-5157 | Endpoint definition |
| `server.js` | 5180-5346 | Phase 1: Combined search |
| `server.js` | 5350-5384 | Phase 2: Platform-specific |
| `server.js` | 5386-5697 | Phase 3: Content extraction |
| `server.js` | 5388-5399 | Basic URL cleaning (needs improvement) |
| `server.js` | 5636-5663 | Phone validation (good) |
| `server.js` | 5807-5847 | Database update |

### Lead Scraping (Better Validation)
| File | Lines | Purpose |
|------|-------|---------|
| `lead-url-validation-service.js` | 14-47 | `cleanInstagramUrl` |
| `lead-url-validation-service.js` | 58-108 | `cleanFacebookUrl` |
| `lead-url-validation-service.js` | 137-170 | `cleanWebsiteUrl` |
| `lead-scrape-firecrawl-service.js` | 1002-1028 | Where validation is used |

### Branding Fix Reference (Pattern to Follow)
| File | Lines | Purpose |
|------|-------|---------|
| `server.js` | ~7077-7221 | `/branding/save` endpoint pattern |
| `RestaurantDetail.jsx` | ~7541-7831 | Confirmation dialog pattern |
| `RestaurantDetail.jsx` | ~1770-1948 | Two-step flow pattern |

---

## Data Flow Comparison

### Current Google Search Flow (Problematic)
```
User clicks "Google Search"
         │
         ▼
┌─────────────────────────────┐
│ API: POST /google-business  │
│ - Searches multiple sources │
│ - Extracts data             │
│ - SAVES TO DATABASE         │◄── Problem: No user confirmation
│ - Returns data              │
└─────────────────────────────┘
         │
         ▼
Frontend auto-applies ALL data
No preview, no selection
```

### Desired Google Search Flow (To Implement)
```
User clicks "Google Search"
         │
         ▼
┌─────────────────────────────┐
│ API: POST /google-business  │
│ { previewOnly: true }       │
│ - Searches multiple sources │
│ - Validates URLs properly   │
│ - Returns data WITHOUT save │
└─────────────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│ hasExistingValues()?        │
└─────────────────────────────┘
         │
    ┌────┴────┐
   NO        YES
    │         │
    ▼         ▼
Apply all   Show Confirmation Dialog
            - Current vs New values
            - Source attribution
            - Checkboxes per field
            - Select All / Deselect All
                    │
                    ▼
            User selects fields
                    │
                    ▼
┌─────────────────────────────┐
│ API: POST /google-business  │
│ /save                       │
│ { fieldsToUpdate: [...] }   │
└─────────────────────────────┘
```
