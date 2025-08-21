# Complete Implementation Plan for Logo Processing & Workflow Integration

## Phase 1: Basic Setup & Implementation

**Step 1.1: Install Dependencies** 

cd /Users/giannimunro/Desktop/cursor-projects/automation/scripts
npm install remove.bg sharp dotenv

**Step 1.2: Setup Environment Variables**

Create .env file:
REMOVE_BG_API_KEY=your_api_key_here
# 50 free credits per month

**Step 1.3: Create process-logo.js Script**

```javascript
const { removeBackgroundFromImageFile } = require('remove.bg');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

async function processLogo(inputPath, outputDir) {
  const baseName = path.basename(inputPath, path.extname(inputPath));
  
  // Step 1: Remove background + auto-crop with remove.bg
  const noBgPath = path.join(outputDir, 'logo-nobg.png');
  
  await removeBackgroundFromImageFile({
    path: inputPath,
    apiKey: process.env.REMOVE_BG_API_KEY,
    size: 'regular',  // or 'preview' to save credits (0.25 credits)
    type: 'auto',     // auto-detect logo/product
    crop: true,       // Auto-crop transparent regions
    outputFile: noBgPath
  });
  
  // Step 2: Create standard version (500x500) with Sharp
  await sharp(noBgPath)
    .resize(500, 500, { 
      fit: 'inside',
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .toFile(path.join(outputDir, 'logo-standard.png'));
  
  // Step 3: Create thermal printer version (200x200 B&W)
  await sharp(noBgPath)
    .resize(200, 200, { fit: 'inside' })
    .grayscale()
    .threshold(128)
    .toFile(path.join(outputDir, 'logo-thermal.png'));
  
  return {
    nobg: noBgPath,
    standard: path.join(outputDir, 'logo-standard.png'),
    thermal: path.join(outputDir, 'logo-thermal.png')
  };
}
```

Key Features:
- remove.bg API handles both background removal AND cropping
- `crop: true` removes all transparent margins automatically
- `size: 'regular'` uses 1 credit, `'preview'` uses 0.25 credits
- Sharp only for resizing and B&W conversion (no removal.ai needed)
- Returns paths to all three versions

## Phase 2: Manual Testing

**Step 2.1: Test Each Logo Source**

node process-logo.js --input="../planning/downloaded-images/devil-burger-queenstown/logo-from-website.png"
node process-logo.js --input="../planning/downloaded-images/devil-burger-queenstown/logo-from-instagram.jpg"
node process-logo.js --input="../planning/downloaded-images/devil-burger-queenstown/logo-from-search.png"

**Step 2.2: Verify Outputs**

- Check all 3 versions generated (nobg, standard, thermal)
- Verify transparent backgrounds from remove.bg API
- Confirm auto-cropping removed empty space
- Verify Sharp resizing maintains quality
- Confirm thermal version is pure B&W
- Monitor API credit usage (50 free/month)

## Phase 3: Agent Integration

**Step 3.1: Update restaurant-logo-website.md**

Add after logo extraction:
node /automation/scripts/process-logo.js --input="logo-from-website.png" --dir="[restaurant-name]-[location]"

**Step 3.2: Update restaurant-logo-instagram.md**

Add after logo download:
node /automation/scripts/process-logo.js --input="logo-from-instagram.jpg" --dir="[restaurant-name]-[location]"

**Step 3.3: Update restaurant-logo-search.md**

Add after logo download:
node /automation/scripts/process-logo.js --input="logo-from-search.png" --dir="[restaurant-name]-[location]"

Note: Each API call consumes 1 credit (0.25 credits for preview size)
Agents should log credit usage and handle API errors gracefully

## Phase 4: Configuration Agent Creation

**Step 4.1: Create restaurant-configuration.md Agent**

name: restaurant-configuration
tools: Bash, Read, Write
description: Configures ordering page and website settings using extracted logos and colors

**Step 4.2: Agent Workflow**

1. Read brand-analysis.json for colors
2. Select best logo (priority: website > instagram > search)
3. Determine light/dark mode from backgroundColor
4. Run ordering-page-customization.js with:
- Primary/secondary colors from analysis
- Restaurant name from directory
- Light/dark mode flag
5. Run appropriate edit-website-settings script with:
- Logo path: logo-standard.png
- Colors from analysis
- Restaurant details (need input)

Assumptions:
- Color extraction already in brand-analysis.json
- Need restaurant email, phone, address as inputs
- Social media URLs from previous agents

## Phase 5: Cuisine Identification Enhancement

**Step 5.1: Identify Integration Point**

Best location: After logo extraction, before configuration
- Add to brand-analysis.json

**Step 5.2: Implementation Options**

1. From website scraping (if website agent ran)
2. From Instagram bio (if Instagram agent ran)
3. From user input (fallback)
4. From AI analysis of menu/posts

Assumption: Cuisine needed for restaurant registration

## Phase 6: Update Planning Document

**Step 6.1: Update restaurant-registration-ideal-flow.md**

## Updated Flow:
1. Lead Information Collection
2. Parallel Logo Extraction (3 agents)
3. Logo Processing (process-logo.js)
4. Cuisine Identification
5. Configuration Agent:
    - Ordering page customization
    - Website settings (dark/light)
6. Restaurant Registration
7. Menu Import
8. Final Verification

**Step 6.2: Document Dependencies**

- Required inputs at each stage
- Output files from each stage
- Error handling procedures

Critical Path & Dependencies

Logo Extraction (parallel) → Logo Processing → Configuration → Registration
                        ↘ Cuisine ID ↗

Key Assumptions Made:

1. API Keys: remove.bg provides 50 free credits/month
2. Credit Usage: 1 credit per 'regular' image, 0.25 per 'preview'
3. File Formats: remove.bg accepts PNG/JPG, Sharp handles all formats
4. Directory Structure: Maintained as [restaurant-name]-[location]
5. Color Format: Hex codes in brand-analysis.json
6. Script Locations: All in /automation/scripts/
7. Error Handling: Agents log credit usage and handle API limits
8. Cuisine Data: Not currently extracted by logo agents
9. Registration Data: Email, phone, address provided separately
10. Background Removal: remove.bg auto-crops with `crop: true`

Success Metrics:

- All 3 logo versions generated consistently
- Background removal quality meets expectations
- Auto-cropping removes all transparent margins
- Thermal logos work with receipt printers
- Configuration scripts accept processed logos
- Full workflow runs without manual intervention
- Cuisine correctly identified 80%+ of time
- API credit usage stays within 50/month limit

API Considerations:

- Monitor credit usage via result.creditsCharged
- Implement fallback for rate limits (result.rateLimitRemaining)
- Consider using 'preview' size (0.25 credits) for testing
- Batch processing to stay within monthly limits
- Cache processed logos to avoid duplicate API calls

Rollback Plan:

- Keep original logos alongside processed versions
- Make background removal optional initially
- Fall back to original if API fails/limits reached
- Manual processing option for credit conservation