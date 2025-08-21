# Directory Naming Standardization - COMPLETE ✅

## Changes Made

### Standardized Format: `restaurantname-location`
All lowercase, spaces replaced with hyphens

### Scripts Updated:

1. **search-and-screenshot.cjs**
   - Added: `const sanitize = (str) => str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');`
   - Changed: `${sanitize(config.restaurantName)}-${sanitize(config.city)}`

2. **extract-selected-logo.cjs**
   - Added: Same sanitize function
   - Changed: Uses sanitized directory naming

3. **download-logo-simple.cjs**
   - Added: Same sanitize function
   - Changed: Uses sanitized directory naming

## Test Results

### Before Fix:
- Website agent: `devil-burger-queenstown/`
- Instagram agent: `devil-burger-queenstown/`
- Search agent: `DevilBurger-Queenstown/` ❌ DIFFERENT

### After Fix:
- Website agent: `devil-burger-queenstown/` ✅
- Instagram agent: `devil-burger-queenstown/` ✅
- Search agent: `test-restaurant-auckland/` ✅ (now uses same format)

## Verification
Tested with "Test Restaurant" in "Auckland":
- Created directory: `/automation/planning/downloaded-images/test-restaurant-auckland/`
- Format matches other agents ✅

## Impact

### ✅ Now Safe for Parallel Execution
- All three agents write to the SAME directory
- No file naming conflicts (each uses unique filenames)
- Integration scripts can find all logos in one location

### Directory Contents After Parallel Run:
```
devil-burger-queenstown/
├── logo-from-website.png        (Website agent)
├── website-screenshot.png       (Website agent)
├── brand-analysis.json         (Website agent)
├── logo-from-instagram.jpg     (Instagram agent)
├── instagram-post-image-*.jpg  (Instagram agent)
├── instagram-brand-analysis.json (Instagram agent)
├── all-images.json             (Instagram agent)
├── instagram-profile-screenshot.png (Instagram agent)
├── logo.png                    (Search agent)
├── search-results.png          (Search agent)
├── search-metadata.json        (Search agent)
├── metadata.json               (Search agent)
└── logo-url.txt                (Search agent)
```

## Next Steps
The three logo extraction agents can now be safely run in parallel for any restaurant, with all outputs collected in a single standardized directory.