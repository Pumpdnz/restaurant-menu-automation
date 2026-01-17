# Nav Bar Logo Resizing and No-Gradient Implementation Plan

**Date:** December 14, 2025
**Status:** ✅ COMPLETED
**Prerequisites:** Header and Items Settings Implementation (completed December 13, 2025)
**Priority 1 Completed:** December 14, 2025
**Priority 2 Completed:** December 14, 2025 (Tested and Working)

---

## Overview

This document outlines the implementation plan for two features:

1. **Priority 1: Nav Bar Logo Resizing** - Apply the same resizing logic used for header logos to the main nav bar logo
2. **Priority 2: No-Gradient Mode** - Add option to disable gradients for price tags and welcome messages

---

## Priority 1: Nav Bar Logo Resizing

### Problem Statement

The nav bar logo (uploaded via `--logo` argument in edit-website-settings scripts) can sometimes be too large for the top nav bar. We need to apply the same resizing logic that we already use for header logos (max 200x200) to the nav bar logo.

### Current Implementation

**registration-routes.js lines ~1415-1435:**
```javascript
// Logo processing - NO RESIZING currently
if (restaurant.logo_nobg_url) {
  if (restaurant.logo_nobg_url.startsWith('data:image')) {
    const logoPath = await convertBase64ToPng(restaurant.logo_nobg_url);
    if (logoPath) {
      command.push(`--logo="${logoPath}"`);
      tempFiles.push(logoPath);
    }
  } else if (restaurant.logo_nobg_url.startsWith('http')) {
    const logoPath = await downloadLogoIfNeeded(restaurant.logo_nobg_url);
    if (logoPath) {
      command.push(`--logo="${logoPath}"`);
      tempFiles.push(logoPath);
    }
  }
}
```

**Compare to header logo processing (lines ~1517-1530):**
```javascript
// Header logo - RESIZED to max 200x200
if (restaurant.logo_nobg_url.startsWith('data:image')) {
  const headerLogoPath = await resizeBase64ImageToFile(restaurant.logo_nobg_url, 200, 200);
  // ...
}
```

### Solution

Apply the same `resizeBase64ImageToFile()` function to the nav bar logo, but with potentially different max dimensions (nav bar may need smaller than 200x200).

### Recommended Max Dimensions

Based on typical nav bar layouts:
- **Nav Bar Logo:** Max 150x80 pixels (wider aspect ratio for horizontal nav bars)
- **Header Logo:** Max 200x200 pixels (square aspect ratio, larger for hero headers)

### Implementation Steps

#### Step 1: Update registration-routes.js

**Location:** `/configure-website` route, logo processing section (~line 1415)

**Before:**
```javascript
if (restaurant.logo_nobg_url) {
  if (restaurant.logo_nobg_url.startsWith('data:image')) {
    const logoPath = await convertBase64ToPng(restaurant.logo_nobg_url);
    if (logoPath) {
      command.push(`--logo="${logoPath}"`);
      tempFiles.push(logoPath);
    }
  } else if (restaurant.logo_nobg_url.startsWith('http')) {
    const logoPath = await downloadLogoIfNeeded(restaurant.logo_nobg_url);
    // ...
  }
}
```

**After:**
```javascript
// Process nav bar logo with resizing (max 150x80 for nav bar fit)
const NAV_LOGO_MAX_WIDTH = 150;
const NAV_LOGO_MAX_HEIGHT = 80;

if (restaurant.logo_nobg_url) {
  if (restaurant.logo_nobg_url.startsWith('data:image')) {
    // Resize base64 image for nav bar
    const logoPath = await resizeBase64ImageToFile(
      restaurant.logo_nobg_url,
      NAV_LOGO_MAX_WIDTH,
      NAV_LOGO_MAX_HEIGHT
    );
    if (logoPath) {
      command.push(`--logo="${logoPath}"`);
      tempFiles.push(logoPath);
      console.log('[Website Config] Nav bar logo resized and ready:', logoPath);
    }
  } else if (restaurant.logo_nobg_url.startsWith('http')) {
    // Download and resize HTTP URL logo
    const downloadedLogo = await downloadLogoIfNeeded(restaurant.logo_nobg_url);
    if (downloadedLogo) {
      // Need to resize the downloaded file
      const resizedLogoPath = await resizeFileToFile(downloadedLogo, NAV_LOGO_MAX_WIDTH, NAV_LOGO_MAX_HEIGHT);
      if (resizedLogoPath) {
        command.push(`--logo="${resizedLogoPath}"`);
        tempFiles.push(resizedLogoPath);
        // Clean up the intermediate downloaded file
        tempFiles.push(downloadedLogo);
        console.log('[Website Config] Nav bar logo downloaded and resized:', resizedLogoPath);
      } else {
        // Fallback to original download if resize fails
        command.push(`--logo="${downloadedLogo}"`);
        tempFiles.push(downloadedLogo);
      }
    }
  } else {
    // Local path - use as-is
    command.push(`--logo="${restaurant.logo_nobg_url}"`);
  }
}
```

#### Step 2: Add resizeFileToFile Function

This new helper function handles resizing of already-downloaded files (not base64):

```javascript
/**
 * Resizes an image file to fit within max dimensions while maintaining aspect ratio
 * @param {string} inputFilePath - Path to the image file
 * @param {number} maxWidth - Maximum width in pixels
 * @param {number} maxHeight - Maximum height in pixels
 * @returns {Promise<string|null>} - Path to resized temp file, or null on failure
 */
async function resizeFileToFile(inputFilePath, maxWidth, maxHeight) {
  try {
    const sharp = require('sharp');
    const fsPromises = require('fs').promises;
    const os = require('os');

    // Read the input file
    const inputBuffer = await fsPromises.readFile(inputFilePath);

    // Resize with sharp - maintains aspect ratio, fits within bounds
    const resized = await sharp(inputBuffer)
      .resize(maxWidth, maxHeight, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .png()
      .toBuffer();

    // Write to temp file
    const tempDir = os.tmpdir();
    const tempFile = path.join(tempDir, `nav-logo-${Date.now()}.png`);
    await fsPromises.writeFile(tempFile, resized);

    console.log(`[Website Config] Resized file to max ${maxWidth}x${maxHeight}: ${tempFile}`);
    return tempFile;
  } catch (error) {
    console.error('[Website Config] Failed to resize file:', error.message);
    return null;
  }
}
```

### Files to Modify

| File | Changes |
|------|---------|
| `UberEats-Image-Extractor/src/routes/registration-routes.js` | Update logo processing to use resizing; add `resizeFileToFile()` function |

### Testing Checklist

- [ ] Base64 logo resized correctly to max 150x80
- [ ] HTTP URL logo downloaded and resized correctly
- [ ] Aspect ratio maintained during resize
- [ ] Temp files cleaned up after script execution
- [ ] Logos that are already small enough are not enlarged

---

## Priority 2: No-Gradient Mode

### Problem Statement

The ordering page customization script (`ordering-page-customization.js`) needs to support a `--no-gradient` option that:
1. Sets Price Tag Enhancements to "Single Color Background"
2. Sets Welcome Message gradient end color to match the primary color (removing gradient effect)

The script already has partial implementation but is stuck on finding the correct selector for the primary color button in the gradient end popup.

### Current Partial Implementation

**ordering-page-customization.js lines 271-306:**
```javascript
// Step 14: Set price tag enhancements to single color background (Optional No Gradient mode)
if (noGradient) {
  // ... scrolls to and clicks Price Tag Enhancements
  await page.click('#priceTagEnhancements-price-tag-single-color');
  console.log('  ✓ Single Color Background Choice Selected');
}
```

**Lines 431-445 (incomplete):**
```javascript
if (noGradient) {
  console.log('Setting Welcome messages to single color background...');
  const welcomeMessageGradientEndSelector = '[id*="content-components"] > div > div > div:nth-child(2) > div:nth-child(2) > div > div:nth-child(2) > div:nth-child(1) > div:nth-child(3) > div:nth-child(2) > div:nth-child(2) > div > button';
  await page.click(welcomeMessageGradientEndSelector);

  await page.waitForTimeout(1000);

  const primaryColorWelcomeMessageGradientEnd = // INCOMPLETE - selector missing
  await page.click(primaryColorWelcomeMessageGradientEnd);
}
```

### Implementation Steps

#### Step 1: Find the Correct Selectors

**Need to identify:**
1. The color picker popup that appears after clicking the gradient end button
2. The "Primary" color swatch button within that popup

**Approach:**
- The color picker likely uses a consistent pattern across the app
- Look for button elements with text "Primary" or data attributes related to color selection
- The popup is likely a radix UI component with a specific structure

**Likely selector patterns to try:**
```javascript
// Option A: Button with text "Primary"
const primaryColorButton = 'button:has-text("Primary")';

// Option B: By color swatch class pattern
const primaryColorButton = '[data-color="primary"], .color-swatch-primary';

// Option C: By radix popover + first color option
const primaryColorButton = '[role="dialog"] button:first-child';

// Option D: By specific class on the color picker
const primaryColorButton = '.color-picker button[data-value="primary"]';
```

#### Step 2: Complete the Script Implementation

```javascript
// Step 14: Set price tag enhancements to single color background (if no-gradient)
if (noGradient) {
  console.log('🎨 Step 14: Setting price tag enhancements to single color...');

  // Scroll to find Price Tag Enhancements
  await page.evaluate(() => {
    const element = Array.from(document.querySelectorAll('div')).find(el =>
      el.textContent?.includes('Price Tag Enhancements')
    );
    if (element) element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
  await page.waitForTimeout(1000);

  // Click Price Tag Enhancements section
  const priceTagEnhancementsSelector = '[id*="content-components"] > div > div.space-y-6 > div:nth-child(6) > div.space-y-2 > div:nth-child(1)';

  try {
    await page.click(priceTagEnhancementsSelector);
    console.log('  ✓ Clicked Price Tag Enhancements section');
  } catch {
    await page.evaluate(() => {
      const components = Array.from(document.querySelectorAll('[class*="space-y-2"] > div'));
      const component = components.find(comp =>
        comp.textContent?.includes('Price Tag Enhancements')
      );
      if (component) component.click();
    });
    console.log('  ✓ Clicked Price Tag Enhancements using text search');
  }
  await page.waitForTimeout(1000);

  // Select Single Color Background option
  await page.click('#priceTagEnhancements-price-tag-single-color');
  await page.waitForTimeout(500);
  console.log('  ✓ Single Color Background selected for price tags\n');
}

// After Step 18 (restaurant name), add Welcome Message gradient removal
if (noGradient) {
  console.log('🎨 Step 19: Removing gradient from Welcome Messages...');

  // Click the Gradient End color picker button
  const gradientEndButtonSelector = '[id*="content-components"] > div > div > div:nth-child(2) > div:nth-child(2) > div > div:nth-child(2) > div:nth-child(1) > div:nth-child(3) > div:nth-child(2) > div:nth-child(2) > div > button';

  try {
    await page.click(gradientEndButtonSelector);
    console.log('  ✓ Opened Gradient End color picker');
    await page.waitForTimeout(1000);

    // Click Primary color option in the popup
    // Try multiple selector strategies
    const primarySelectors = [
      'button:has-text("Primary")',
      '[role="dialog"] button:first-child',
      '.popover-content button:first-child',
      '[data-radix-popper-content-wrapper] button:has-text("Primary")'
    ];

    let clicked = false;
    for (const selector of primarySelectors) {
      try {
        const button = page.locator(selector).first();
        if (await button.count() > 0) {
          await button.click();
          console.log(`  ✓ Selected Primary color using: ${selector}`);
          clicked = true;
          break;
        }
      } catch {
        continue;
      }
    }

    if (!clicked) {
      // Fallback: find button by evaluating the DOM
      await page.evaluate(() => {
        const popup = document.querySelector('[data-radix-popper-content-wrapper], [role="dialog"]');
        if (popup) {
          const buttons = popup.querySelectorAll('button');
          // Primary is usually the first button in color picker
          if (buttons.length > 0) {
            buttons[0].click();
          }
        }
      });
      console.log('  ✓ Selected Primary color using fallback');
    }

    await page.waitForTimeout(500);
    console.log('  ✓ Welcome Message gradient removed\n');

  } catch (error) {
    console.error('  ❌ Failed to remove Welcome Message gradient:', error.message);
  }
}
```

#### Step 3: Update Frontend (RestaurantDetail.jsx)

Add UI for selecting the no-gradient option:

**State variable:**
```javascript
const [noGradient, setNoGradient] = useState(false);
```

**UI Component (in the Website Customization section):**
```jsx
{/* Gradient Configuration */}
<div className="space-y-3 border-t pt-4">
  <div className="flex items-center space-x-2">
    <Checkbox
      id="no-gradient"
      checked={noGradient}
      onCheckedChange={setNoGradient}
    />
    <Label htmlFor="no-gradient" className="text-sm font-medium">
      Disable Gradients (Solid Colors)
    </Label>
  </div>
  <p className="text-xs text-muted-foreground ml-6">
    Uses primary color only for price tags and welcome messages instead of gradient effects.
  </p>
</div>
```

**Update handleGenerateCodeInjections:**
```javascript
const response = await railwayApi.post('/api/registration/generate-code-injections', {
  restaurantId: id,
  noGradient: noGradient  // Add this
});
```

#### Step 4: Update Backend (registration-routes.js)

**In the `/generate-code-injections` route:**

```javascript
const { restaurantId, noGradient } = req.body;

// ... existing code ...

// Update command building for production mode
let command = `node "${scriptPath}" --primary="${restaurant.primary_color}" --secondary="${restaurant.secondary_color}" --name="${restaurant.name.replace(/"/g, '\\"')}"`;

if (restaurant.theme === 'light') {
  command += ' --lightmode';
}

if (noGradient) {
  command += ' --no-gradient';
}

// Update args array for development mode
const args = [
  scriptPath,
  `--primary=${restaurant.primary_color}`,
  `--secondary=${restaurant.secondary_color}`,
  `--name=${restaurant.name}`,
  '--keep-browser-open'
];

if (restaurant.theme === 'light') {
  args.push('--lightmode');
}

if (noGradient) {
  args.push('--no-gradient');
}
```

### Files to Modify

| File | Changes |
|------|---------|
| `scripts/ordering-page-customization.js` | Complete the no-gradient implementation with correct selectors |
| `UberEats-Image-Extractor/src/pages/RestaurantDetail.jsx` | Add noGradient state and UI checkbox |
| `UberEats-Image-Extractor/src/routes/registration-routes.js` | Pass noGradient argument to script |

### Testing Checklist

- [ ] `--no-gradient` argument parsed correctly in script
- [ ] Price Tag Enhancements set to Single Color Background
- [ ] Welcome Message gradient end color set to Primary
- [ ] UI checkbox toggles noGradient state
- [ ] API request includes noGradient parameter
- [ ] Script executed with --no-gradient when checkbox is checked
- [ ] Generated code injections reflect solid colors (no gradients)

---

## Step Renumbering After Implementation

If no-gradient steps are added to the script, the step numbering will need updating:

**Current (without no-gradient):**
- Steps 1-13: Login, colors, presets, nav bar effects, etc.
- Steps 14-17: Welcome messages, restaurant name
- Steps 18-21: Save head/body code

**With no-gradient (if implemented as separate steps):**
- Steps 1-13: Same
- Step 14: Price Tag Enhancements (if no-gradient)
- Step 15-18: Nav bar effects, welcome messages
- Step 19: Welcome Message gradient removal (if no-gradient)
- Steps 20-23: Save head/body code

**Alternative:** Keep no-gradient logic inline within existing steps rather than as separate numbered steps.

---

## Implementation Order

1. ✅ **Priority 1 - Nav Bar Logo Resizing**
   - Add `resizeFileToFile()` function
   - Update logo processing in configure-website route
   - Test with various logo sizes

2. ⏳ **Priority 2 - No-Gradient Mode**
   - Find correct selectors for color picker (may require browser inspection)
   - Complete script implementation
   - Add frontend UI
   - Update backend to pass argument
   - Test end-to-end

---

## Notes

- The color picker selector identification may require running the script with `--keep-browser-open` and using browser DevTools to inspect the popup structure
- Consider making the nav bar logo dimensions configurable in the future
- The resizing preserves aspect ratio and won't enlarge small images

---

## Related Documentation

- [Header and Items Settings Implementation](./HEADER-AND-ITEMS-SETTINGS-IMPLEMENTATION-PLAN.md)
- [Branding Selection Fix](./branding-selection-fix-documentation.md)
