# Complete Naming Standardization Summary

## Directory Naming: `restaurant-name-location`
All lowercase, spaces replaced with hyphens

## File Naming Convention

### Website Agent
- **Logo**: `logo-from-website.png` (or .svg, .webp)
- **Screenshot**: `website-screenshot.png`
- **Analysis**: `brand-analysis.json`

### Instagram Agent
- **Logo**: `logo-from-instagram.jpg`
- **Post Images**: `instagram-post-image-1.jpg` through `instagram-post-image-9.jpg`
- **Screenshot**: `instagram-profile-screenshot.png`
- **Metadata**: `all-images.json`
- **Analysis**: `instagram-brand-analysis.json`

### Search Agent
- **Logo**: `logo-from-search.png` ✅ (updated from `logo.png`)
- **Screenshot**: `search-results.png`
- **Search Metadata**: `search-metadata.json`
- **General Metadata**: `metadata.json`
- **URL File**: `logo-url.txt`

## Complete Directory Structure After Parallel Execution

```
automation/planning/downloaded-images/
└── restaurant-name-location/           # e.g., devil-burger-queenstown/
    ├── logo-from-website.png          # Website agent
    ├── website-screenshot.png         # Website agent
    ├── brand-analysis.json           # Website agent
    ├── logo-from-instagram.jpg       # Instagram agent
    ├── instagram-post-image-*.jpg    # Instagram agent (1-9)
    ├── instagram-profile-screenshot.png # Instagram agent
    ├── all-images.json               # Instagram agent
    ├── instagram-brand-analysis.json # Instagram agent
    ├── logo-from-search.png          # Search agent ✅ (updated)
    ├── search-results.png            # Search agent
    ├── search-metadata.json          # Search agent
    ├── metadata.json                 # Search agent
    └── logo-url.txt                  # Search agent
```

## Naming Pattern Benefits

1. **Consistent Logo Naming**: All logos follow pattern `logo-from-[source].[ext]`
   - Easy to identify source of each logo
   - No conflicts when running in parallel
   - Clear for integration scripts

2. **Unified Directory**: All agents write to same lowercase hyphenated directory
   - Single location for all assets
   - Easy cleanup and management
   - Predictable paths for automation

3. **Source Identification**: Every file clearly indicates its origin
   - `website-` prefix for website agent files
   - `instagram-` prefix for Instagram agent files
   - `search-` prefix for search agent files

## Integration Ready
All three agents can now run in parallel with:
- No directory conflicts ✅
- No file naming conflicts ✅
- Clear source identification ✅
- Standardized lowercase hyphenated format ✅