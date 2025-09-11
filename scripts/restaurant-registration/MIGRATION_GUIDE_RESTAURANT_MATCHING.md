# Migration Guide: Converting Scripts to Smart Restaurant Matching

## Overview
This guide explains how to convert existing automation scripts from the old approach (using admin password and clicking the first restaurant) to the new approach (using user credentials and smart restaurant name matching).

## Key Changes

### Old Approach Issues
- Used admin password from `.env` file for all logins
- Always clicked the first restaurant (`#restaurant-list-item-0`)
- No support for multiple restaurants per account
- Required manual script editing for different restaurants

### New Approach Benefits
- Uses actual user passwords (each restaurant has its own credentials)
- Smart fuzzy matching to find the correct restaurant by name
- Handles multiple restaurants per account
- Supports restaurants with apostrophes, case differences, and typos
- Works with location-specific restaurant names

## Reference Implementation
See `test-get-restaurant-id.js` for a complete working example of the new approach.

## Migration Steps

### 1. Update Command Line Arguments

Your existing scripts already accept `--email` but use the admin password. You need to add password and restaurant name arguments.

**Old (from existing scripts):**
```javascript
// Parse arguments
const email = getArg('email');

// Use admin password from environment or default
const password = process.env.ADMIN_PASSWORD || '7uo@%K2^Hz%yiXDeP39Ckp6BvF!2';

// Validate required arguments
if (!email) {
  console.error('❌ Error: Email is required');
  console.error('Usage: node script.js --email="email@example.com"');
  process.exit(1);
}
```

**New:**
```javascript
// Parse arguments
const email = getArg('email');
const password = getArg('password');  // NEW: Accept password as argument
const restaurantName = getArg('name'); // NEW: Accept restaurant name for matching

// Validate required arguments
if (!email || !password || !restaurantName) {
  console.error('❌ Error: Missing required parameters');
  console.error('Required: --email=<email> --password=<password> --name=<restaurant_name>');
  console.error('\nExample:');
  console.error('node script.js --email=test@example.com --password=Password123! --name="Test Restaurant"');
  process.exit(1);
}
```

**Update your script documentation:**
```javascript
/**
 * Options:
 *   --email=<email>           Login email (required)
 *   --password=<password>     User password (required) // CHANGED from using ADMIN_PASSWORD
 *   --name=<name>             Restaurant name for matching (required) // NEW
 *   [... other script-specific options ...]
 */
```

### 2. Keep Existing Login Process (No Change Needed)

Your existing scripts already handle the login correctly. Just use the user's password instead of admin password:

```javascript
// Existing login code - just use the password from arguments
await page.fill('input[type="email"]', email);
await page.fill('input[type="password"]', password); // Now uses user password, not admin

await page.click('button[type="submit"], button:has-text("Login"), button:has-text("Sign In")');
await page.waitForURL('**/admin.pumpd.co.nz/**', { timeout: 15000 });
```

### 3. Add Proper Waiting for Dashboard Content

**Old:**
```javascript
await page.waitForLoadState('networkidle');
// Immediately try to click button
```

**New (Improved Version):**
```javascript
// Wait for dashboard
console.log('\n⏳ Waiting for dashboard...');
await page.waitForURL('**/admin.pumpd.co.nz/**', { timeout: 15000 });
console.log('  ✓ Reached dashboard:', page.url());

// Wait for loading overlay to disappear (if present)
await page.waitForFunction(() => {
  const loader = document.querySelector('.cover-loader');
  return !loader || !loader.classList.contains('active');
}, { timeout: 10000 });

// Wait longer for dashboard content to fully load
console.log('  ⏳ Waiting for dashboard content to load...');
await page.waitForTimeout(5000);

// Try to wait for restaurant elements to appear
try {
  await page.waitForSelector('h4', { timeout: 10000 });
  console.log('  ✓ Dashboard content loaded');
} catch (error) {
  console.log('  ⚠️ No h4 elements found, continuing anyway...');
}

await page.waitForLoadState('networkidle');
```

**Important Notes:**
- The loading overlay check is crucial for Pumpd admin dashboard
- The 5-second wait ensures all dynamic content loads
- Waiting for h4 elements confirms restaurant names are loaded
- The networkidle at the end ensures all API calls complete

### 4. Replace Restaurant Selection with Smart Matching

**Old (from existing scripts like setup-services-settings.js):**
```javascript
// STEP 2: Navigate to restaurant management
console.log('\n🏪 STEP 2: Navigate to restaurant management');

const manageButton = page.locator('#restaurant-list-item-0 button:has-text("Manage")').first();
await manageButton.click();
console.log('  ✓ Clicked Manage button');
```

**New - Complete Smart Matching Code:**
```javascript
// Helper function for fuzzy restaurant name matching
const normalizeForMatching = (str) => {
  return str
    .toLowerCase()                    // Case insensitive
    .replace(/['']/g, '')             // Remove apostrophes
    .replace(/\s+/g, ' ')             // Normalize spaces
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
  const searchWords = searchNorm.split(' ').filter(w => w.length > 1); // Filter out single chars
  const nameWords = nameNorm.split(' ');
  
  let score = 0;
  let matchedWords = 0;
  let reason = '';
  
  // Count how many search words are found in the restaurant name
  for (const searchWord of searchWords) {
    // Check for exact word match
    if (nameWords.includes(searchWord)) {
      score += 10;
      matchedWords++;
    }
    // Check for partial word match (e.g., "zaikaa" matches "ziakaa")
    else if (nameWords.some(nameWord => {
      // Use Levenshtein-like simple check: if words are similar length and share most characters
      const lengthDiff = Math.abs(nameWord.length - searchWord.length);
      if (lengthDiff <= 2) {
        const commonChars = searchWord.split('').filter(char => nameWord.includes(char)).length;
        return commonChars >= Math.min(searchWord.length, nameWord.length) - 1;
      }
      return false;
    })) {
      score += 8;
      matchedWords++;
    }
    // Check for substring match
    else if (nameWords.some(nameWord => nameWord.includes(searchWord) || searchWord.includes(nameWord))) {
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
  
  // Penalty for extra words in restaurant name (less specific match)
  const extraWords = nameWords.length - searchWords.length;
  if (extraWords > 0 && score > 0) {
    score -= extraWords * 2;
  }
  
  // If the full search term is contained in the restaurant name (substring match)
  if (score === 0 && nameNorm.includes(searchNorm)) {
    score = 25;
    reason = 'substring match';
  }
  
  return { score, reason };
};

// Navigate to restaurant management (adjust step number as needed)
console.log('\n🏪 STEP 2: Navigate to restaurant management');
console.log(`  🔍 Looking for restaurant: ${restaurantName}`);

// Wait a bit for the list to fully render
await page.waitForTimeout(2000);

// Try to find which index our restaurant is at by checking the h4 elements
let restaurantIndex = -1;
let bestScore = 0;
let bestMatch = null;

const allRestaurantNames = await page.locator('h4').allTextContents();

console.log(`  ℹ️ Found ${allRestaurantNames.length} restaurants in the list`);
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

if (restaurantIndex >= 0) {
  console.log(`  ✅ Best match: "${bestMatch.name}" at index ${restaurantIndex} (${bestMatch.reason})`);
  
  // Use the simple, reliable selector pattern with the found index
  const manageButton = page.locator(`#restaurant-list-item-${restaurantIndex} button:has-text("Manage")`).first();
  
  // If the first selector doesn't work, try with view-store pattern
  if (await manageButton.count() === 0) {
    console.log('  ⚠️ Standard selector not found, trying view-store pattern...');
    const alternativeButton = page.locator(`button[id="restaurant-list-item-view-store-${restaurantIndex}"]`).first();
    if (await alternativeButton.count() > 0) {
      await alternativeButton.click();
      console.log(`  ✓ Clicked Manage button using view-store pattern`);
    } else {
      console.log('  ⚠️ View-store pattern not found, trying index-based fallback...');
      const allManageButtons = page.locator('button:has-text("Manage")');
      if (await allManageButtons.count() > restaurantIndex) {
        await allManageButtons.nth(restaurantIndex).click();
        console.log(`  ✓ Clicked Manage button at index ${restaurantIndex}`);
      } else {
        throw new Error('Could not find Manage button for restaurant');
      }
    }
  } else {
    await manageButton.click();
    console.log(`  ✓ Clicked Manage button for ${restaurantName}`);
  }
} else {
  console.log(`  ❌ No matching restaurant found for "${restaurantName}"`);
  console.log('  Available restaurants:');
  allRestaurantNames.forEach((name, index) => {
    console.log(`    ${index}: "${name}"`);
  });
  throw new Error('Restaurant not found in list');
}
```

### 5. Update Waiting After Clicking Manage

**Old:**
```javascript
await page.waitForURL('**/restaurant/**', { timeout: 10000 });
```

**New:**
```javascript
// Wait for navigation to complete and page to load
console.log('  ⏳ Waiting for restaurant management page to load...');
try {
  // Wait for URL change to restaurant management
  await page.waitForURL('**/restaurant/**', { timeout: 15000 });
  console.log('  ✓ Navigated to restaurant page');
} catch (error) {
  console.log('  ⚠️ Navigation timeout, checking current URL...');
}

// Add extra wait to ensure URL is fully loaded and stable
await page.waitForTimeout(3000);
await page.waitForLoadState('networkidle');
```

### 6. Extract Restaurant ID (Optional)

If your script needs the restaurant ID:

```javascript
// Get the current URL for debugging
const restaurantUrl = page.url();
console.log('  📍 Current URL:', restaurantUrl);

// Extract restaurant ID from URL
console.log('  🔍 Attempting to extract restaurant ID from URL...');

// Try multiple regex patterns to match different possible formats
let restaurantIdMatch = restaurantUrl.match(/restaurant\/(RES[A-Za-z0-9_-]+)/i);

// If first pattern doesn't match, try a more generic pattern
if (!restaurantIdMatch) {
  console.log('  ⚠️ Standard RES pattern did not match, trying generic pattern...');
  restaurantIdMatch = restaurantUrl.match(/restaurant\/([A-Za-z0-9_-]+)/);
}

if (restaurantIdMatch) {
  const restaurantId = restaurantIdMatch[1];
  console.log(`  ✓ Restaurant ID extracted: ${restaurantId}`);
} else {
  console.log('  ❌ Could not extract restaurant ID from URL');
}
```

## Example Usage Comparison

### Old Script Usage (e.g., setup-services-settings.js):
```bash
# Only needed email, used admin password from env
node setup-services-settings.js --email=test@example.com
```

### New Script Usage:
```bash
# Now requires password and restaurant name
node setup-services-settings.js --email=test@example.com --password=Password123! --name="Test Restaurant"

# Examples with real restaurants:
node setup-services-settings.js --email=romanskitchen2023@gmail.com --password=Romanskitchen789! --name="Roman's Kitchen"
node import-csv-menu.js --email=smokeyts@outlook.com --password=Smokeyts123! --name="Smokey T's cashel street" --csvFile="/path/to/menu.csv"
```

## Real-World Examples

### Migrating setup-services-settings.js:
```bash
# Old: Always used first restaurant
node setup-services-settings.js --email=smokeyts@outlook.com

# New: Specifies which restaurant
node setup-services-settings.js --email=smokeyts@outlook.com --password=Smokeyts123! --name="Smokey T's Riverside"
```

### Migrating import-csv-menu.js:
```bash
# Old: Always imported to first restaurant
node import-csv-menu.js --email=romanskitchen2023@gmail.com --csvFile="menu.csv"

# New: Imports to specific restaurant
node import-csv-menu.js --email=romanskitchen2023@gmail.com --password=Romanskitchen789! --name="Romans Kitchen" --csvFile="menu.csv"
```

## How the Matching Works

The smart matching algorithm handles:

1. **Case differences**: "indian zaikaa" matches "Indian Zaikaa"
2. **Apostrophes**: "Pedro's" matches "Pedros", "Smokey T's" matches "Smokey Ts"
3. **Location suffixes**: "Base Pizza" matches "Base Pizza Riverside" (but scores lower than exact match)
4. **Typos**: "zaikaa" matches "ziakaa" through character similarity
5. **Best match selection**: Always picks the highest scoring match, not the first match

### Scoring System:
- Exact match: 1000 points
- All words matched: +50 bonus
- Exact word match: 10 points per word
- Similar word (typo): 8 points per word
- Substring match: 5 points per word
- Extra words penalty: -2 per extra word

## Testing Your Migration

1. First test with the provided test script:
```bash
node test-get-restaurant-id.js --email=your@email.com --password=YourPassword --name="Your Restaurant"
```

2. Verify it finds the correct restaurant and extracts the ID

3. Apply the same changes to your automation script

4. Test your migrated script with the same credentials

## Common Issues and Solutions

### Issue: Script clicks wrong restaurant
**Solution**: The restaurant name in the argument might be too generic. Use more specific name including location if needed.

### Issue: No restaurants found
**Solution**: 
- Check that the wait time is sufficient (5+ seconds after login)
- Verify the h4 selector is correct for restaurant names
- Check that the user account has restaurants associated

### Issue: Manage button not found
**Solution**: The script tries three different selector patterns. If all fail, the button structure might have changed.

### Issue: Restaurant ID extraction fails
**Solution**: Check the URL format - the regex patterns handle `RES` prefix with alphanumeric, underscore, and hyphen characters.

## Benefits of Migration

1. **Multi-restaurant support**: Works with accounts that have multiple restaurants
2. **No admin password needed**: Uses actual user credentials
3. **Flexible matching**: Handles real-world name variations
4. **Better debugging**: Shows match scores and reasons
5. **Reusable**: Same code works for all scripts that need restaurant selection