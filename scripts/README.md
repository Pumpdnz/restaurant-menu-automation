# Restaurant Logo Search & Analysis Scripts

These scripts automate the process of finding restaurant logos and extracting brand colors.

## Scripts

### 1. search-restaurant-logo.js
Searches Google Images for a restaurant's logo and allows interactive selection.

**Features:**
- Parameterized for any restaurant and location
- Interactive image selection (no more automatic first-image selection)
- Saves search results screenshot for reference
- Extracts high-resolution image URL
- Saves metadata for tracking

**Usage:**
```bash
node search-restaurant-logo.js <restaurant-name> <city> [output-dir]

# Examples:
node search-restaurant-logo.js "Artisan Cafe" "Rotorua"
node search-restaurant-logo.js "Pizza Palace" "Auckland" "/custom/output/path"

# Run in headless mode:
HEADLESS=true node search-restaurant-logo.js "Artisan Cafe" "Rotorua"
```

### 2. download-and-analyze-logo.js
Downloads the selected logo and analyzes its colors.

**Features:**
- Downloads logo from saved URL
- Analyzes dominant colors using image processing
- Filters out white/black and groups similar colors
- Generates visual color palette HTML file
- Saves color data as hex and RGB values

**Usage:**
```bash
node download-and-analyze-logo.js <restaurant-name> <city> [base-dir]

# Examples:
node download-and-analyze-logo.js "Artisan Cafe" "Rotorua"
node download-and-analyze-logo.js "Pizza Palace" "Auckland" "/custom/base/path"
```

## Workflow

1. **Search for logo:**
   ```bash
   node search-restaurant-logo.js "Restaurant Name" "City"
   ```
   - Look at the screenshot to see search results
   - Enter the number of the correct logo when prompted

2. **Download and analyze:**
   ```bash
   node download-and-analyze-logo.js "Restaurant Name" "City"
   ```
   - Downloads the selected logo
   - Extracts primary brand colors
   - Creates a visual color palette

## Output Structure

```
automation/planning/downloaded-images/
└── RestaurantName-City/
    ├── search-results.png      # Screenshot of Google Image results
    ├── logo-url.txt           # URL of selected logo
    ├── logo.png               # Downloaded logo image
    ├── metadata.json          # All data including colors
    └── color-palette.html     # Visual color palette
```

## Key Improvements Over Original

1. **Parameterized:** Use for any restaurant without code changes
2. **Interactive Selection:** User chooses correct logo (fixes wrong image issue)
3. **Better Search Query:** Targets Instagram/Facebook for better results
4. **Metadata Tracking:** Saves all information for future reference
5. **Visual Output:** HTML color palette for easy viewing
6. **Error Handling:** Better error messages and validation

## Requirements

- Node.js
- Puppeteer (`npm install puppeteer`)
- Chrome browser with automation profile at:
  `/Users/giannimunro/Library/Application Support/Google/Chrome/AutomationProfile`

## Notes

- The search query specifically looks for logos on Instagram and Facebook as these often have the official branding
- Colors are analyzed excluding pure white/black to focus on brand colors
- Similar colors are grouped to avoid duplicates
- The interactive selection ensures you always get the right logo