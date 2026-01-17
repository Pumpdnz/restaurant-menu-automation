# Finalise Onboarding Script - Missing Restaurant Selection Logic

## Date: 2025-12-12

## Overview

The `finalise-onboarding-user.js` script, which handles Uber Delivery Management integration setup, is missing critical restaurant selection functionality that exists in all other similar scripts. This causes silent failures when users have multiple restaurants.

---

## Problem Summary

The script is **hardcoded to always select the first restaurant** (index 0) in the dashboard, regardless of which restaurant should actually be configured for Uber integration.

### Affected File
`/scripts/finalise-onboarding-user.js`

### Problem Code (Lines 169-170)
```javascript
const manageButton = page.locator('#restaurant-list-item-0 button:has-text("Manage")').first();
await manageButton.click();
```

### Impact
- When a user has multiple restaurants, the **wrong restaurant gets configured silently**
- No error is thrown; the script completes "successfully" but configures the wrong restaurant
- Uber integration is set up for the first restaurant in the list instead of the intended one

---

## Root Cause Analysis

### Missing Components

1. **No `--name` Argument**
   - The script does not accept a `--name` argument for the restaurant name
   - Required arguments only include: `email`, `password`, `nzbn`, `company-name`, `trading-name`, `director-name`, `director-mobile`

2. **No Smart Matching Logic**
   - Other scripts implement ~70 lines of fuzzy matching code
   - This script has zero restaurant selection logic

3. **Route Handler Gap**
   - The route handler in `registration-routes.js` HAS access to `restaurant.name` (line 3436)
   - But it does NOT pass this to the script command (lines 3423-3434)

### Evidence from Route Handler

**File:** `UberEats-Image-Extractor/src/routes/registration-routes.js`

The route handler logs the restaurant name but doesn't pass it:
```javascript
// Line 3436 - Has the restaurant name
console.log('[Uber Integration] Configuring Uber integration for restaurant:', restaurant.name);

// Lines 3423-3434 - Command does NOT include --name
const command = [
  'node',
  scriptPath,
  `--email="${finalAccount.email}"`,
  `--password="${finalAccount.user_password_hint}"`,
  `--nzbn="${onboardingData.nzbn}"`,
  `--company-name="${onboardingData.companyName.replace(/"/g, '\\"')}"`,
  `--trading-name="${onboardingData.tradingName.replace(/"/g, '\\"')}"`,
  `--director-name="${onboardingData.directorName.replace(/"/g, '\\"')}"`,
  `--director-mobile="${onboardingData.directorMobile}"`,
  `--admin-url="${scriptConfig.adminUrl}"`
].join(' ');
```

---

## Comparison with Working Scripts

### Scripts WITH Smart Restaurant Matching
| Script | Has `--name` | Has Smart Matching |
|--------|-------------|-------------------|
| `setup-services-settings.js` | ✅ YES | ✅ YES |
| `import-csv-menu.js` | ✅ YES | ✅ YES |
| `add-item-tags.js` | ✅ YES | ✅ YES |
| `add-option-sets.js` | ✅ YES | ✅ YES |
| `edit-website-settings-dark.js` | ✅ YES | ✅ YES |
| `edit-website-settings-light.js` | ✅ YES | ✅ YES |
| `setup-system-settings-user.js` | ✅ YES | ✅ YES |

### Scripts WITHOUT Smart Restaurant Matching
| Script | Has `--name` | Has Smart Matching |
|--------|-------------|-------------------|
| `finalise-onboarding-user.js` | ❌ NO | ❌ NO |

---

## Smart Matching Implementation Reference

The following code from `setup-services-settings.js` (lines 178-246) should be added to `finalise-onboarding-user.js`:

### Helper Functions

```javascript
// Helper function for fuzzy restaurant name matching
const normalizeForMatching = (str) => {
  return str
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

// Function to calculate match score between search term and restaurant name
const calculateMatchScore = (searchTerm, restaurantName) => {
  const searchNorm = normalizeForMatching(searchTerm);
  const nameNorm = normalizeForMatching(restaurantName);

  // Exact match (after normalization) - highest priority
  if (searchNorm === nameNorm) {
    return { score: 1000, reason: 'exact match' };
  }

  // Split into words for word-based matching
  const searchWords = searchNorm.split(' ').filter(w => w.length > 1);
  const nameWords = nameNorm.split(' ');

  let score = 0;
  let matchedWords = 0;
  let reason = '';

  // Count how many search words are found in the restaurant name
  for (const searchWord of searchWords) {
    if (nameWords.includes(searchWord)) {
      score += 10;
      matchedWords++;
    } else if (nameWords.some(nameWord => {
      const lengthDiff = Math.abs(nameWord.length - searchWord.length);
      if (lengthDiff <= 2) {
        const commonChars = searchWord.split('').filter(char => nameWord.includes(char)).length;
        return commonChars >= Math.min(searchWord.length, nameWord.length) - 1;
      }
      return false;
    })) {
      score += 8;
      matchedWords++;
    } else if (nameWords.some(nameWord => nameWord.includes(searchWord) || searchWord.includes(nameWord))) {
      score += 5;
      matchedWords++;
    }
  }

  // Bonus for matching all words
  if (matchedWords === searchWords.length && searchWords.length > 0) {
    score += 50;
    reason = `all ${searchWords.length} words matched`;
  } else if (matchedWords > 0) {
    reason = `${matchedWords}/${searchWords.length} words matched`;
  }

  // Penalty for extra words
  const extraWords = nameWords.length - searchWords.length;
  if (extraWords > 0 && score > 0) {
    score -= extraWords * 2;
  }

  // Substring match fallback
  if (score === 0 && nameNorm.includes(searchNorm)) {
    score = 25;
    reason = 'substring match';
  }

  return { score, reason };
};
```

### Restaurant Selection Logic

```javascript
// Find the best matching restaurant
let restaurantIndex = -1;
let bestScore = 0;
let bestMatch = null;

const allRestaurantNames = await page.locator('h4').allTextContents();

console.log(`  ℹ️ Found ${allRestaurantNames.length} restaurants in the list`);

if (allRestaurantNames.length > 0) {
  console.log(`  📊 Evaluating restaurants for best match:`);

  for (let i = 0; i < allRestaurantNames.length; i++) {
    const { score, reason } = calculateMatchScore(restaurantName, allRestaurantNames[i]);

    if (score > 0) {
      console.log(`    ${i}: "${allRestaurantNames[i]}" - Score: ${score} (${reason})`);

      if (score > bestScore) {
        bestScore = score;
        restaurantIndex = i;
        bestMatch = { name: allRestaurantNames[i], reason };
      }
    }
  }
}

if (restaurantIndex >= 0) {
  console.log(`  ✅ Best match: "${bestMatch.name}" at index ${restaurantIndex} (${bestMatch.reason})`);

  const manageButton = page.locator(`#restaurant-list-item-${restaurantIndex} button:has-text("Manage")`).first();
  await manageButton.click();
} else {
  console.error(`  ❌ No matching restaurant found for "${restaurantName}"`);
  console.log('  Available restaurants:');
  allRestaurantNames.forEach((name, index) => {
    console.log(`    ${index}: "${name}"`);
  });
  throw new Error(`Restaurant "${restaurantName}" not found in dashboard`);
}
```

---

## Implementation Plan

### Step 1: Update `finalise-onboarding-user.js`

1. **Add `--name` argument parsing** (after line 66)
   ```javascript
   const restaurantName = getArg('name');
   ```

2. **Add to required arguments validation** (update lines 84-92)
   ```javascript
   const requiredArgs = {
     email,
     password,
     name: restaurantName,  // ADD THIS
     nzbn,
     'company-name': companyName,
     'trading-name': tradingName,
     'director-name': directorName,
     'director-mobile': directorMobile
   };
   ```

3. **Add smart matching functions** (after line ~110)
   - Copy `normalizeForMatching` function
   - Copy `calculateMatchScore` function

4. **Replace hardcoded restaurant selection** (lines 169-170)
   - Replace with smart matching logic shown above

5. **Update script documentation header** (lines 9-10)
   ```javascript
   *   node finalise-onboarding-user.js --email=<email> --password=<password> --name=<restaurant_name> --nzbn=<nzbn> ...
   ```

### Step 2: Update Route Handler

**File:** `UberEats-Image-Extractor/src/routes/registration-routes.js`

Add `--name` argument to command (around line 3428):
```javascript
const command = [
  'node',
  scriptPath,
  `--email="${finalAccount.email}"`,
  `--password="${finalAccount.user_password_hint}"`,
  `--name="${restaurant.name.replace(/"/g, '\\"')}"`,  // ADD THIS LINE
  `--nzbn="${onboardingData.nzbn}"`,
  `--company-name="${onboardingData.companyName.replace(/"/g, '\\"')}"`,
  `--trading-name="${onboardingData.tradingName.replace(/"/g, '\\"')}"`,
  `--director-name="${onboardingData.directorName.replace(/"/g, '\\"')}"`,
  `--director-mobile="${onboardingData.directorMobile}"`,
  `--admin-url="${scriptConfig.adminUrl}"`
].join(' ');
```

---

## Testing Checklist

After implementation:

- [ ] Script accepts `--name` argument
- [ ] Script fails with clear error if `--name` is not provided
- [ ] Script correctly matches restaurant by name (exact match)
- [ ] Script correctly matches restaurant with fuzzy matching (partial name, apostrophes, etc.)
- [ ] Script fails with clear error if no matching restaurant found
- [ ] Script lists available restaurants when match fails
- [ ] Route handler passes restaurant name to script
- [ ] Works correctly when user has multiple restaurants
- [ ] Works correctly when user has only one restaurant

---

## Files to Modify

1. `/scripts/finalise-onboarding-user.js` - Add restaurant selection logic
2. `/UberEats-Image-Extractor/src/routes/registration-routes.js` - Add `--name` to command

---

## Priority

**HIGH** - This is a silent failure that can configure the wrong restaurant for Uber integration, which is a critical business operation.
