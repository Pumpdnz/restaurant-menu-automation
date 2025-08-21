# Logo Extraction Agents - File Conflict Analysis

## Directory Structure
All three agents use the same base directory pattern:
`/automation/planning/downloaded-images/[RestaurantName]-[Location]/`

## Files Created by Each Agent

### Website Agent (`restaurant-logo-website`)
- `logo-from-website.png` - Main logo file
- `website-screenshot.png` - Full page screenshot
- `brand-analysis.json` - Color and brand analysis

### Instagram Agent (`restaurant-logo-instagram`)
- `logo-from-instagram.jpg` - Profile picture as logo
- `instagram-post-image-1.jpg` through `instagram-post-image-9.jpg` - Post images
- `all-images.json` - Metadata for all extracted images
- `instagram-brand-analysis.json` - Color and brand analysis
- `instagram-profile-screenshot.png` - Full page screenshot

### Search Agent (`restaurant-logo-search`)
- `logo.png` - Downloaded logo from search
- `search-results.png` - Screenshot of search results
- `search-metadata.json` - Metadata about search results
- `metadata.json` - General metadata with logo colors
- `logo-url.txt` - URL of selected logo

## Conflict Analysis

### ✅ NO CONFLICTS DETECTED

The agents can run in parallel without file conflicts because:

1. **Different file names**: Each agent uses unique file naming:
   - Website: `logo-from-website.png`, `brand-analysis.json`
   - Instagram: `logo-from-instagram.jpg`, `instagram-brand-analysis.json`
   - Search: `logo.png`, `metadata.json`

2. **Non-overlapping outputs**: No two agents write to the same filename

3. **Same directory is OK**: While they share the same directory structure, they write different files

## Parallel Execution Capability

**✅ SAFE TO RUN IN PARALLEL**

All three agents can be executed simultaneously for the same restaurant without file conflicts. Each agent produces:
- Uniquely named logo files
- Separate analysis/metadata files
- Different screenshot files

## Recommendations for Integration

1. **Unified Output**: After all agents complete, a consolidation step could:
   - Compare the three logos for consistency
   - Merge color analyses from all sources
   - Select the best quality logo
   - Create a unified `consolidated-brand-analysis.json`

2. **Priority Selection**: If running sequentially is preferred:
   - Website agent first (highest quality logo)
   - Instagram agent second (social media presence)
   - Search agent last (fallback option)

3. **Directory Management**: The shared directory actually helps by:
   - Keeping all assets for one restaurant together
   - Making comparison easier
   - Simplifying cleanup operations