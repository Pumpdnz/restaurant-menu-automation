# Step 3.2 - Menu Item Image Download Documentation

## Overview
This documentation covers the downloading of menu item images from UberEats URLs for local storage and subsequent upload to the Pumpd admin dashboard.

## Background

### The Problem
- Menu items have images hosted on UberEats CDN
- These URLs may expire or change
- Images need to be uploaded to Pumpd's system in Step 7
- Manual downloading through browser is time-consuming

### The Solution
Automated batch download of all menu item images with:
- Organized folder structure by category
- Safe filename generation
- Download tracking and mapping
- Error handling for missing images

## Implementation

### Test Script
`/automation/planning/test-image-download.js`

### Script Functionality
1. Reads menu data from `himalaya_scrape_response.json`
2. Creates organized directory structure
3. Downloads images with progress tracking
4. Generates mapping file for reference
5. Handles errors gracefully

## Test Results

### Himalaya Restaurant Download
```
Total items: 17
✅ Downloaded: 15
❌ Failed: 0
⚠️  No image: 2 (placeholder images)
```

### Directory Structure
```
downloaded-images/himalaya-queenstown/
├── featured_items/
│   ├── chicken_fried_noodles.jpg
│   ├── chicken_jhol_momo.jpg
│   ├── egg_fried_noodles.jpg
│   ├── mixed_fried_noodles.jpg
│   ├── steamed_chicken_momo.jpg
│   ├── steamed_vegan_momo_vg_.jpg
│   └── vegan_fried_noodles_vg_.jpg
├── mains/
│   ├── chicken_fried_noodles.jpg
│   ├── chicken_jhol_momo.jpg
│   ├── egg_fried_noodles.jpg
│   ├── mixed_fried_noodles.jpg
│   ├── steamed_chicken_momo.jpg
│   ├── steamed_vegan_momo_vg_.jpg
│   ├── vegan_fried_noodles_vg_.jpg
│   └── vegan_jhol_momo_vg_.jpg
└── image-mapping.json
```

## Key Features

### 1. Safe Filename Generation
```javascript
function createSafeFilename(dishName, index) {
  if (!dishName) return `item_${index}`;
  
  return dishName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .substring(0, 50);
}
```

### 2. Category Organization
- Images grouped by menu category
- Separate folders for each category
- Consistent naming convention

### 3. Image Mapping File
```json
{
  "restaurant": "Himalaya Queenstown",
  "downloadDate": "2025-08-01T00:21:24.065Z",
  "stats": {
    "total": 17,
    "downloaded": 15,
    "failed": 0,
    "noImage": 2
  },
  "items": [
    {
      "dishName": "Steamed Chicken Momo",
      "categoryName": "Featured Items",
      "originalUrl": "https://tb-static.uber.com/...",
      "localPath": "featured_items/steamed_chicken_momo.jpg"
    }
  ]
}
```

### 4. Error Handling
- Skips placeholder images
- Handles download failures
- Provides detailed error messages
- Cleans up partial downloads

## Usage Instructions

### Running the Download Script
```bash
cd /Users/giannimunro/Desktop/cursor-projects/automation/planning
node test-image-download.js
```

### Output Location
`/automation/planning/downloaded-images/[restaurant-name]/`

## Proposed API Integration

### Endpoint Design
```javascript
POST /api/download-images

Request:
{
  "data": { /* scraped menu data */ },
  "options": {
    "outputPath": "./downloads/restaurant-name",
    "groupByCategory": true,
    "skipPlaceholders": true
  }
}

Response:
{
  "success": true,
  "stats": {
    "total": 17,
    "downloaded": 15,
    "failed": 0,
    "noImage": 2
  },
  "downloadPath": "./downloads/restaurant-name",
  "mappingFile": "./downloads/restaurant-name/image-mapping.json"
}
```

### Implementation Status
- ✅ Standalone script tested and working
- ⏳ API endpoint designed (not yet implemented)
- ✅ Client-side functionality exists in React app

## Integration with Workflow

### Step 3 Output
1. CSV without imageURL (for import)
2. CSV with imageURL (for reference)
3. Downloaded images folder
4. Image mapping JSON

### Step 7 Usage
In Restaurant Setup (Step 7), use:
- Downloaded images for upload
- Image mapping to match dishes
- Original URLs as fallback

## Best Practices

### 1. Storage Management
- Clean up old downloads periodically
- Use date-based folders for multiple runs
- Compress images if needed

### 2. Error Recovery
- Retry failed downloads
- Log all errors for review
- Keep original URLs as backup

### 3. Performance
- Limit concurrent downloads
- Add request throttling
- Monitor bandwidth usage

## Common Issues

### Issue: HTTPS Certificate Error
**Solution**: Use proper HTTPS module, not HTTP

### Issue: Timeout on Large Images
**Solution**: Increase timeout to 30 seconds

### Issue: Duplicate Filenames
**Solution**: Add index suffix for duplicates

## Future Enhancements

1. **Parallel Downloads**: Download multiple images concurrently
2. **Image Optimization**: Resize/compress images automatically
3. **Cloud Storage**: Upload directly to S3/CloudFlare
4. **Progress Reporting**: Real-time download progress via WebSocket
5. **Resume Capability**: Continue interrupted batch downloads

## Summary

The image download functionality successfully:
- ✅ Downloads 88% of menu images (15/17)
- ✅ Organizes by category
- ✅ Creates mapping for reference
- ✅ Handles errors gracefully
- ✅ Provides clear statistics

This completes the validation of Step 3.2 and provides a solid foundation for automating image management in the restaurant onboarding workflow.