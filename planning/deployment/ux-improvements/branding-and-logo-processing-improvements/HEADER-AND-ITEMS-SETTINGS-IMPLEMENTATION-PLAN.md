# Header and Items Settings Implementation Plan

**Date:** December 13, 2025
**Status:** ✅ IMPLEMENTED
**Prerequisites:** Favicon processing changes (completed December 12, 2025)
**Completed:** December 13, 2025

---

## Session Summary

### What Was Implemented

This session added Header and Items settings configuration to the `edit-website-settings-*.js` scripts, following the established pattern from the favicon processing implementation.

### Files Modified

| File | Changes |
|------|---------|
| `UberEats-Image-Extractor/server.js` | Added Step 2c for OG image base64 conversion; updated preview responses and database save logic |
| `UberEats-Image-Extractor/src/routes/registration-routes.js` | Added `resizeBase64ImageToFile()` function; updated query to fetch cover images; added header/items config processing |
| `scripts/edit-website-settings-light.js` | Added new arguments; added Step 12 (Header) and Step 13 (Items); renumbered Steps 14-21 |
| `scripts/edit-website-settings-dark.js` | Added new arguments; added Step 12 (Header) and Step 13 (Items); renumbered Steps 14-21 |
| `UberEats-Image-Extractor/src/pages/RestaurantDetail.jsx` | Added state variables, useMemo for available backgrounds, UI components, and updated API call |

### New Features

1. **Header Configuration (Optional)**
   - Toggle to enable/disable header
   - Selectable background image from: Website OG, UberEats, DoorDash, Facebook cover
   - Auto-resized header logo (max 200x200) from no-bg logo
   - Header title automatically set to space (hidden)

2. **Items Configuration**
   - Selectable layout: List (default) or Card
   - Item tag position always set to Inner Bottom

3. **OG Image Base64 Conversion**
   - Website OG images are now downloaded and converted to base64 during branding extraction
   - Consistent with favicon and logo processing

### Script Step Numbering After Implementation

- Step 11: Upload Logo
- Step 12: Configure Header (NEW - optional)
- Step 13: Configure Items (NEW)
- Step 14: Upload Favicon (was Step 12)
- Step 15: Configure SEO (was Step 13)
- Step 16: Configure Social Media (was Step 14)
- Step 17: Open Custom Code (was Step 15)
- Step 18: Add Head Code (was Step 16)
- Step 19: Add Body Code (was Step 17)
- Step 20: Save Code Injection (was Step 18)
- Step 21: View Store (was Step 19)

---

## Overview

This document outlines the implementation plan for adding Header and Items settings configuration to the `edit-website-settings-*.js` scripts. This builds upon the recent favicon processing work and follows similar patterns.

**New Steps Added:**
- **Step 12**: Configure Header (optional, user-selectable)
- **Step 13**: Configure Items (item layout style and tag position)
- **Step 14**: Upload Favicon (previously Step 12)
- **Step 15**: Configure SEO Settings (previously Step 13)

---

## Recent Context: Favicon Implementation Pattern

### What Was Changed for Favicon

The favicon implementation serves as the template for header image processing:

1. **Server-side (server.js lines ~7298-7324):**
   - Download favicon from Firecrawl URL
   - Convert to base64 PNG using sharp
   - Store base64 in `logoVersions.favicon`
   - Save to `logo_favicon_url` column in database

2. **Registration Routes (registration-routes.js lines ~1433-1457):**
   - Fetch `logo_favicon_url` from database
   - Convert base64 to temp PNG file using `convertBase64ToPng()`
   - Pass to script with `--favicon="path/to/file.png"`
   - Track temp file for cleanup

3. **Scripts (edit-website-settings-*.js):**
   - Added `faviconPath = getArg('favicon')` argument
   - Falls back to `logoPath` if no favicon provided
   - Uses dedicated favicon file in upload step

### Key Helper Functions Available

```javascript
// In registration-routes.js
convertBase64ToPng(base64DataUrl)  // Converts base64 to temp PNG file
downloadLogoIfNeeded(httpUrl)       // Downloads HTTP URL to temp file
```

---

## New Features Required

### 1. Header Settings Configuration

**Position in script:** New Step 12 (after Logo Upload, before Items)

#### Required Script Arguments

| Argument | Type | Description |
|----------|------|-------------|
| `--header-enabled` | boolean | Whether to configure header section |
| `--header-bg` | string | Path to header background image file |
| `--header-logo` | string | Path to header logo image file (resized no-bg) |

#### Database Fields Involved (All Already Exist)

| Field | Type | Purpose |
|-------|------|---------|
| `website_og_image` | text | Currently stores URL - **needs base64 conversion** |
| `ubereats_og_image` | text | UberEats cover image (if extracted) |
| `doordash_og_image` | text | DoorDash cover image (if extracted) |
| `facebook_cover_image` | text | Facebook cover image (if extracted) |
| `logo_nobg_url` | text | No-background logo (needs resizing for header) |

#### Header Background Image Options

The user should be able to select from available images:

1. **Website OG Image** (`website_og_image`)
   - Currently extracted from Firecrawl branding format
   - Stored as HTTP URL - **needs conversion to base64**

2. **UberEats Image** (`ubereats_og_image`)
   - Extracted during menu extraction (if available)
   - May need similar base64 conversion

3. **DoorDash Image** (`doordash_og_image`)
   - Extracted during menu extraction (if available)
   - May need similar base64 conversion

4. **Facebook Cover** (`facebook_cover_image`)
   - Would need new extraction system
   - Currently not implemented

#### Header Logo Requirements

- Source: `logo_nobg_url` (no-background version)
- **Must be resized** to max 200x200 pixels while maintaining aspect ratio
- Resize should happen at script execution time (not stored as separate field)

---

### 2. Items Settings Configuration

**Position in script:** New Step 13 (after Header, before Favicon Upload)

#### Required Script Arguments

| Argument | Type | Description |
|----------|------|-------------|
| `--item-layout` | string | Item layout style: 'list' (default) or 'card' |

#### Behavior

- If `--item-layout=list` (default): Only configure item tag position (Inner Bottom)
- If `--item-layout=card`: Configure item style to Card AND item tag position to Inner Bottom

---

## Exact Selectors for Script Steps

### Step 12: Configure Header (if selected)

| Sub-step | Action | Selector |
|----------|--------|----------|
| A | Open Header section | `#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div:nth-child(7)` |
| B | Toggle to show header | `#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > form > div > div:nth-child(1) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > div > label` |
| C | Upload Header Background | `#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > form > div > div:nth-child(3) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > div.flex-line.centered > button:nth-child(1)` |
| D | Header Title input (set to single space) | `#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > form > div > div:nth-child(5) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > input` |
| E | Upload Header Logo | `#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > form > div > div:nth-child(7) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > div > button` |
| F | Save button | `#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > form > div > button` |

### Step 13: Configure Items

| Sub-step | Action | Selector |
|----------|--------|----------|
| A | Open Items section | `#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div:nth-child(9)` |
| B | Item Style dropdown - Card option (only if card layout) | `#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > form > div > div:nth-child(1) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > select > option:nth-child(3)` |
| C | Item Tag Position - Inner Bottom (always) | `#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > form > div > div:nth-child(2) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > select > option:nth-child(2)` |
| D | Save button | `#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > form > div > button` |

---

## Implementation Steps

### Phase 1: OG Image Base64 Conversion (server.js)

**File:** `UberEats-Image-Extractor/server.js`
**Location:** After Step 2b (favicon processing), around line ~7324

#### 1.1 Add Step 2c - OG Image Conversion

```javascript
// Step 2c: If Firecrawl provided an OG image URL, download and convert to base64
if (brandingResult.images?.ogImageUrl) {
  try {
    console.log('[API] Downloading OG image from Firecrawl URL:', brandingResult.images.ogImageUrl);
    const ogImageBuffer = await logoService.downloadImageToBuffer(
      brandingResult.images.ogImageUrl,
      sourceUrl
    );

    // Convert to base64 (keep original size for header background)
    const ogImageBase64 = `data:image/jpeg;base64,${ogImageBuffer.toString('base64')}`;

    // Store in brandingResult for later use
    brandingResult.images.ogImageBase64 = ogImageBase64;
    console.log('[API] OG Image converted to base64');
  } catch (ogError) {
    console.error('[API] Failed to convert OG image:', ogError.message);
    // Keep the URL version as fallback
  }
}
```

#### 1.2 Update Database Save Logic (line ~7415)

Change the OG image save to prefer base64:

```javascript
// Header fields (OG data) - only update if selected
if (shouldUpdateHeader('website_og_image')) {
  // Prefer base64 over URL for consistency with other image fields
  const ogImageValue = brandingResult.images?.ogImageBase64 || brandingResult.images?.ogImageUrl;
  if (ogImageValue) {
    updateData.website_og_image = ogImageValue;
  }
}
```

---

### Phase 2: Add resizeBase64ImageToFile Function (registration-routes.js)

**File:** `UberEats-Image-Extractor/src/routes/registration-routes.js`
**Location:** After `downloadLogoIfNeeded()` function, around line ~1720

```javascript
/**
 * Resizes a base64 image to fit within max dimensions while maintaining aspect ratio
 * @param {string} base64Image - Base64 data URL
 * @param {number} maxWidth - Maximum width in pixels
 * @param {number} maxHeight - Maximum height in pixels
 * @returns {Promise<string|null>} - Path to resized temp file, or null on failure
 */
async function resizeBase64ImageToFile(base64Image, maxWidth, maxHeight) {
  try {
    const sharp = require('sharp');
    const fs = require('fs').promises;
    const os = require('os');

    // Extract base64 data
    const matches = base64Image.match(/^data:image\/([a-zA-Z]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      console.error('[Website Config] Invalid base64 image format for resizing');
      return null;
    }

    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, 'base64');

    // Resize with sharp - maintains aspect ratio, fits within bounds
    const resized = await sharp(buffer)
      .resize(maxWidth, maxHeight, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .png()
      .toBuffer();

    // Write to temp file
    const tempDir = os.tmpdir();
    const tempFile = path.join(tempDir, `header-logo-${Date.now()}.png`);
    await fs.writeFile(tempFile, resized);

    console.log(`[Website Config] Resized image to max ${maxWidth}x${maxHeight}: ${tempFile}`);
    return tempFile;
  } catch (error) {
    console.error('[Website Config] Failed to resize image:', error.message);
    return null;
  }
}
```

---

### Phase 3: Update configure-website Route (registration-routes.js)

**File:** `UberEats-Image-Extractor/src/routes/registration-routes.js`
**Location:** `/configure-website` route, starting around line ~1292

#### 3.1 Update Database Query (line ~1319)

Add the cover image fields to the select query:

```javascript
const { data: restaurant, error: restaurantError } = await supabase
  .from('restaurants')
  .select(`
    name,
    primary_color,
    secondary_color,
    theme,
    logo_nobg_url,
    logo_favicon_url,
    website_og_image,
    ubereats_og_image,
    doordash_og_image,
    facebook_cover_image,
    instagram_url,
    facebook_url,
    address,
    phone,
    cuisine
  `)
  .eq('id', restaurantId)
  .eq('organisation_id', organisationId)
  .single();
```

#### 3.2 Add Header and Items Config Processing (after favicon processing, ~line 1458)

```javascript
// Handle header configuration
const { headerConfig, itemsConfig } = req.body;

if (headerConfig?.enabled) {
  command.push('--header-enabled=true');

  // Get selected background source
  const bgSource = headerConfig.backgroundSource;
  const bgImage = restaurant[bgSource];

  if (bgImage) {
    if (bgImage.startsWith('data:image')) {
      const bgPath = await convertBase64ToPng(bgImage);
      if (bgPath) {
        command.push(`--header-bg="${bgPath}"`);
        tempFiles.push(bgPath);
        console.log('[Website Config] Header background ready:', bgPath);
      }
    } else if (bgImage.startsWith('http')) {
      const bgPath = await downloadLogoIfNeeded(bgImage);
      if (bgPath) {
        command.push(`--header-bg="${bgPath}"`);
        tempFiles.push(bgPath);
        console.log('[Website Config] Header background downloaded:', bgPath);
      }
    }
  }

  // Process header logo (resized no-bg logo to max 200x200)
  if (restaurant.logo_nobg_url) {
    if (restaurant.logo_nobg_url.startsWith('data:image')) {
      const headerLogoPath = await resizeBase64ImageToFile(restaurant.logo_nobg_url, 200, 200);
      if (headerLogoPath) {
        command.push(`--header-logo="${headerLogoPath}"`);
        tempFiles.push(headerLogoPath);
        console.log('[Website Config] Header logo resized and ready:', headerLogoPath);
      }
    } else if (restaurant.logo_nobg_url.startsWith('http')) {
      // Download first, then would need to resize - for now just download
      const downloadedLogo = await downloadLogoIfNeeded(restaurant.logo_nobg_url);
      if (downloadedLogo) {
        command.push(`--header-logo="${downloadedLogo}"`);
        tempFiles.push(downloadedLogo);
        console.log('[Website Config] Header logo downloaded:', downloadedLogo);
      }
    }
  }
}

// Handle items configuration
const itemLayout = itemsConfig?.layout || 'list';
command.push(`--item-layout="${itemLayout}"`);
console.log('[Website Config] Item layout:', itemLayout);
```

---

### Phase 4: Update Scripts (edit-website-settings-*.js)

**Files:**
- `scripts/edit-website-settings-light.js`
- `scripts/edit-website-settings-dark.js`

#### 4.1 Add New Arguments (after faviconPath, ~line 92)

```javascript
const faviconPath = getArg('favicon'); // Separate favicon path (falls back to logo if not provided)
const headerEnabled = getArg('header-enabled') === 'true';
const headerBgPath = getArg('header-bg');
const headerLogoPath = getArg('header-logo');
const itemLayout = getArg('item-layout') || 'list'; // 'list' or 'card'
```

#### 4.2 Add Step 12: Configure Header (after Step 11 Logo Upload)

```javascript
    // STEP 12: Configure Header (if enabled)
    if (headerEnabled) {
      console.log('\n🖼️ STEP 12: Configuring Header Settings');

      const headerSectionSelector = '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div:nth-child(7)';

      try {
        // A. Open Header settings section
        await page.locator(headerSectionSelector).scrollIntoViewIfNeeded();
        await page.waitForTimeout(500);
        console.log('  ✓ Scrolled to Header section');

        await page.click(headerSectionSelector);
        await page.waitForTimeout(1000);
        console.log('  ✓ Expanded Header dropdown');

        // B. Click toggle to show the header
        const headerToggleSelector = '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > form > div > div:nth-child(1) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > div > label';
        await page.click(headerToggleSelector);
        await page.waitForTimeout(500);
        console.log('  ✓ Enabled header display');

        // C. Upload Header Background image (if provided)
        if (headerBgPath) {
          const uploadBgSelector = '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > form > div > div:nth-child(3) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > div.flex-line.centered > button:nth-child(1)';
          await page.click(uploadBgSelector);
          console.log('  ✓ Clicked Upload Header Background button');
          await page.waitForTimeout(2000);

          // Handle Uploadcare widget
          const headerBgFilePath = path.resolve(headerBgPath);

          page.once('filechooser', async (fileChooser) => {
            await fileChooser.setFiles(headerBgFilePath);
            console.log('  ✓ Header background selected via fileChooser');
          });

          const chooseFileButton = page.locator('button:has-text("Choose a local file")').first();
          if (await chooseFileButton.count() > 0) {
            await chooseFileButton.click();
            console.log('  ✓ Triggered file chooser for header background');
            await page.waitForTimeout(8000);

            const previewImage = await page.locator('.uploadcare--preview__image, img[src*="ucarecdn.com"]').first();
            if (await previewImage.count() > 0) {
              console.log('  ✓ Header background upload successful, preview loaded');

              const addButton = page.locator('.uploadcare--dialog button:has-text("Add")').first();
              if (await addButton.count() > 0) {
                await addButton.click();
                console.log('  ✓ Confirmed header background upload');
                await page.waitForTimeout(2000);
              }
            }
          }
        }

        // D. Set Header Title to single space (to hide it)
        const headerTitleSelector = '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > form > div > div:nth-child(5) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > input';
        const headerTitleInput = page.locator(headerTitleSelector).first();
        await headerTitleInput.click();
        await headerTitleInput.clear();
        await headerTitleInput.fill(' ');
        console.log('  ✓ Set header title to space (hidden)');

        // E. Upload Header Logo (if provided)
        if (headerLogoPath) {
          const uploadLogoSelector = '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > form > div > div:nth-child(7) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > div > button';
          await page.click(uploadLogoSelector);
          console.log('  ✓ Clicked Upload Header Logo button');
          await page.waitForTimeout(2000);

          // Handle Uploadcare widget
          const headerLogoFilePath = path.resolve(headerLogoPath);

          page.once('filechooser', async (fileChooser) => {
            await fileChooser.setFiles(headerLogoFilePath);
            console.log('  ✓ Header logo selected via fileChooser');
          });

          const chooseFileButton2 = page.locator('button:has-text("Choose a local file")').first();
          if (await chooseFileButton2.count() > 0) {
            await chooseFileButton2.click();
            console.log('  ✓ Triggered file chooser for header logo');
            await page.waitForTimeout(8000);

            const previewImage2 = await page.locator('.uploadcare--preview__image, img[src*="ucarecdn.com"]').first();
            if (await previewImage2.count() > 0) {
              console.log('  ✓ Header logo upload successful, preview loaded');

              const addButton2 = page.locator('.uploadcare--dialog button:has-text("Add")').first();
              if (await addButton2.count() > 0) {
                await addButton2.click();
                console.log('  ✓ Confirmed header logo upload');
                await page.waitForTimeout(2000);
              }
            }
          }
        }

        // F. Save header configuration
        const saveHeaderSelector = '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > form > div > button';
        const saveHeaderButton = page.locator(saveHeaderSelector).first();
        await saveHeaderButton.click();
        console.log('  ✓ Saved header configuration');
        await page.waitForTimeout(2000);

        console.log('  ✓ Header configuration complete');
      } catch (error) {
        console.error('  ❌ Failed to configure header:', error.message);
      }
    } else {
      console.log('\n📋 STEP 12: Skipping header configuration (not enabled)');
    }
```

#### 4.3 Add Step 13: Configure Items

```javascript
    // STEP 13: Configure Item Settings
    console.log('\n📦 STEP 13: Configuring Item Settings');

    const itemsSectionSelector = '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div:nth-child(9)';

    try {
      // A. Open Items settings section
      await page.locator(itemsSectionSelector).scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
      console.log('  ✓ Scrolled to Items section');

      await page.click(itemsSectionSelector);
      await page.waitForTimeout(1000);
      console.log('  ✓ Expanded Items dropdown');

      // B. Configure Item Layout Style (if card layout selected)
      if (itemLayout === 'card') {
        const itemStyleCardSelector = '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > form > div > div:nth-child(1) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > select > option:nth-child(3)';
        await page.click(itemStyleCardSelector);
        await page.waitForTimeout(500);
        console.log('  ✓ Set item style to Card');
      } else {
        console.log('  ℹ️ Keeping default list layout');
      }

      // C. Configure Item Tag Position to Inner Bottom (always)
      const itemTagPositionSelector = '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > form > div > div:nth-child(2) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > select > option:nth-child(2)';
      await page.click(itemTagPositionSelector);
      await page.waitForTimeout(500);
      console.log('  ✓ Set item tag position to Inner Bottom');

      // D. Save items configuration
      const saveItemsSelector = '#scroll-root > div > div > div > div > div > div.section__SettingsSectionWrapper-VLcLJ.gVhfCf > div > div.block__Block-ljvlRq.epsQby > div.block__Content-bopatn.lbcjnQ > form > div > button';
      const saveItemsButton = page.locator(saveItemsSelector).first();
      await saveItemsButton.click();
      console.log('  ✓ Saved items configuration');
      await page.waitForTimeout(2000);

    } catch (error) {
      console.error('  ❌ Failed to configure items:', error.message);
    }
```

#### 4.4 Renumber Remaining Steps

- Current STEP 12 (Favicon) → STEP 14
- Current STEP 13 (SEO) → STEP 15
- Continue incrementing subsequent steps

---

### Phase 5: Update Frontend UI (RestaurantDetail.jsx)

**File:** `UberEats-Image-Extractor/src/pages/RestaurantDetail.jsx`

#### 5.1 Add New State Variables (around line ~305)

```javascript
// Header configuration state
const [headerEnabled, setHeaderEnabled] = useState(false);
const [headerBgSource, setHeaderBgSource] = useState('website_og_image');

// Items configuration state
const [itemLayout, setItemLayout] = useState('list'); // 'list' or 'card'
```

#### 5.2 Add Computed Available Backgrounds

```javascript
// Available header backgrounds (computed from restaurant data)
const availableHeaderBgs = useMemo(() => {
  return {
    website_og_image: { label: 'Website OG Image', value: restaurant?.website_og_image || null },
    ubereats_og_image: { label: 'UberEats Image', value: restaurant?.ubereats_og_image || null },
    doordash_og_image: { label: 'DoorDash Image', value: restaurant?.doordash_og_image || null },
    facebook_cover_image: { label: 'Facebook Cover', value: restaurant?.facebook_cover_image || null },
  };
}, [restaurant]);
```

#### 5.3 Update handleConfigureWebsite Function (line ~1091)

```javascript
const response = await railwayApi.post('/api/registration/configure-website', {
  restaurantId: id,
  filePaths: generatedFilePaths,
  headerConfig: headerEnabled ? {
    enabled: true,
    backgroundSource: headerBgSource
  } : { enabled: false },
  itemsConfig: {
    layout: itemLayout
  }
});
```

#### 5.4 Add UI Components (in the Configure Website Settings section)

Add before the Configure Website button:

```jsx
{/* Header Configuration */}
<div className="space-y-3 border-t pt-4">
  <div className="flex items-center space-x-2">
    <Checkbox
      id="header-enabled"
      checked={headerEnabled}
      onCheckedChange={setHeaderEnabled}
    />
    <Label htmlFor="header-enabled" className="text-sm font-medium">
      Enable Header Configuration
    </Label>
  </div>

  {headerEnabled && (
    <div className="ml-6 space-y-3">
      <Label className="text-sm">Header Background Image:</Label>
      <Select value={headerBgSource} onValueChange={setHeaderBgSource}>
        <SelectTrigger>
          <SelectValue placeholder="Select header background" />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(availableHeaderBgs).map(([key, { label, value }]) => (
            <SelectItem key={key} value={key} disabled={!value}>
              <div className="flex items-center gap-2">
                <span>{label}</span>
                {value ? (
                  <Badge variant="outline" className="text-xs">Available</Badge>
                ) : (
                  <Badge variant="secondary" className="text-xs">Not Found</Badge>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Preview selected background */}
      {headerBgSource && availableHeaderBgs[headerBgSource]?.value && (
        <div className="mt-2">
          <img
            src={availableHeaderBgs[headerBgSource].value}
            alt="Header background preview"
            className="max-h-24 rounded border"
          />
        </div>
      )}

      {/* Header logo preview */}
      {restaurant?.logo_nobg_url && (
        <div className="mt-2">
          <Label className="text-xs text-muted-foreground">
            Header Logo (auto-resized to max 200x200):
          </Label>
          <img
            src={restaurant.logo_nobg_url}
            alt="Header logo preview"
            className="h-12 w-12 object-contain border rounded p-1 mt-1"
          />
        </div>
      )}
    </div>
  )}
</div>

{/* Items Configuration */}
<div className="space-y-3 border-t pt-4">
  <Label className="text-sm font-medium">Item Layout Style:</Label>
  <Select value={itemLayout} onValueChange={setItemLayout}>
    <SelectTrigger>
      <SelectValue placeholder="Select item layout" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="list">List (Default)</SelectItem>
      <SelectItem value="card">Card</SelectItem>
    </SelectContent>
  </Select>
  <p className="text-xs text-muted-foreground">
    {itemLayout === 'card'
      ? 'Card layout with Inner Bottom tag position'
      : 'List layout with Inner Bottom tag position'}
  </p>
</div>
```

---

## Database Schema Considerations

### Current Fields (All Already Exist)

| Field | Current Type | Current Content | Change Needed |
|-------|--------------|-----------------|---------------|
| `website_og_image` | text | HTTP URL | Convert to base64 during extraction |
| `ubereats_og_image` | text | HTTP URL or base64 | No schema change |
| `doordash_og_image` | text | HTTP URL or base64 | No schema change |
| `facebook_cover_image` | text | HTTP URL or base64 | No schema change |
| `logo_nobg_url` | text | base64 | No change (resize at runtime) |
| `logo_favicon_url` | text | base64 | No change (recently fixed) |

### Decision: No New Logo Fields

Per requirements, we will **NOT** add a separate `logo_header_url` field. Instead:
- Store the no-bg logo as `logo_nobg_url` (base64)
- Resize at script execution time using `resizeBase64ImageToFile()`
- This keeps the database schema simple

---

## Testing Checklist

> **Note:** Code implementation complete. Manual testing required before production deployment.

### Phase 1: OG Image Base64 Conversion (Code Complete ✅)
- [ ] Branding extraction converts OG image URL to base64
- [ ] Base64 OG image saves correctly to database
- [ ] Existing HTTP URLs still work as fallback
- [ ] Response includes both `ogImageUrl` and `ogImageBase64`

### Phase 2: Header Logo Resizing Function (Code Complete ✅)
- [ ] `resizeBase64ImageToFile()` correctly resizes images
- [ ] Aspect ratio is maintained
- [ ] Max dimensions (200x200) are respected
- [ ] Returns null gracefully on invalid input
- [ ] Temp files are created in system temp directory

### Phase 3: Registration Routes Updates (Code Complete ✅)
- [ ] Query fetches all cover image fields
- [ ] `headerConfig` parsed from request body
- [ ] `itemsConfig` parsed from request body
- [ ] Header background converted/downloaded correctly
- [ ] Header logo resized correctly
- [ ] Item layout argument passed to script
- [ ] All temp files tracked for cleanup

### Phase 4: Script Updates (Code Complete ✅)
- [ ] New arguments parsed correctly (`--header-enabled`, `--header-bg`, `--header-logo`, `--item-layout`)
- [ ] Step 12 (Header) executes when enabled
- [ ] Step 12 skips when not enabled
- [ ] Header toggle clicked correctly
- [ ] Header background uploads correctly
- [ ] Header title set to space
- [ ] Header logo uploads correctly
- [ ] Header save button clicked
- [ ] Step 13 (Items) always executes
- [ ] Item style set to Card when selected
- [ ] Item tag position set to Inner Bottom
- [ ] Items save button clicked
- [ ] Steps 14+ renumbered correctly

### Phase 5: Frontend UI (Code Complete ✅)
- [ ] `headerEnabled` state toggle works
- [ ] `headerBgSource` select works
- [ ] `itemLayout` select works
- [ ] Available images show correct availability status
- [ ] Disabled options cannot be selected
- [ ] Preview images display correctly
- [ ] API request includes `headerConfig` and `itemsConfig`

### Phase 6: End-to-End Integration
- [ ] Flow with header disabled, list layout
- [ ] Flow with header enabled, list layout
- [ ] Flow with header enabled, card layout
- [ ] Different header background sources work
- [ ] All temp files cleaned up after execution

---

## Files Modified (Implementation Complete)

| File | Changes | Status |
|------|---------|--------|
| `UberEats-Image-Extractor/server.js` | Added OG image base64 conversion (Step 2c) | ✅ Complete |
| `UberEats-Image-Extractor/src/routes/registration-routes.js` | Added resize function, updated query, added header/items processing | ✅ Complete |
| `scripts/edit-website-settings-light.js` | Added new arguments, Step 12 (Header), Step 13 (Items), renumbered | ✅ Complete |
| `scripts/edit-website-settings-dark.js` | Added new arguments, Step 12 (Header), Step 13 (Items), renumbered | ✅ Complete |
| `UberEats-Image-Extractor/src/pages/RestaurantDetail.jsx` | Added state, computed values, UI components, updated API call | ✅ Complete |

---

## Implementation Order (All Complete)

1. ✅ **Phase 1**: server.js - OG image base64 conversion
2. ✅ **Phase 2**: registration-routes.js - Add `resizeBase64ImageToFile()` function
3. ✅ **Phase 3**: registration-routes.js - Update query and add header/items processing
4. ✅ **Phase 4**: edit-website-settings-*.js - Add new steps and arguments
5. ✅ **Phase 5**: RestaurantDetail.jsx - Add UI components

---

## Resolved Questions

1. ✅ **Exact selectors for header section** - Provided and documented
2. ✅ **Exact selectors for items settings section** - Provided and documented
3. ✅ **Items settings configuration options** - Item layout (list/card) and tag position (Inner Bottom)
4. ✅ **Database fields for cover images** - All already exist (`ubereats_og_image`, `doordash_og_image`, `facebook_cover_image`)

---

## Related Documentation

- [Branding Selection Fix Documentation](./branding-selection-fix-documentation.md) - Selection pattern for updates
- Favicon implementation (December 12, 2025) - Pattern for base64 conversion and script args

---

## Summary

This implementation follows the established pattern from favicon processing:

1. **Extract** → Download OG image and convert to base64
2. **Store** → Save base64 to database (`website_og_image`)
3. **Process** → Convert base64 to temp file at script execution
4. **Resize** → Header logo resized to max 200x200 at runtime
5. **Execute** → Pass temp file paths to Playwright script
6. **Cleanup** → Delete temp files after execution

**Key Features:**
- Header configuration is **optional** (user toggle)
- Header background image is **selectable** from available sources
- Header logo is **auto-generated** from no-bg logo with 200x200 max resize
- Item layout is **selectable** (list or card)
- Item tag position is **always set** to Inner Bottom

**Step Numbering After Implementation:**
- Step 11: Upload Logo
- Step 12: Configure Header (NEW - optional)
- Step 13: Configure Items (NEW)
- Step 14: Upload Favicon (was Step 12)
- Step 15: Configure SEO (was Step 13)
- ... (continue incrementing)
