# API Integration Documentation

## Overview
This document details the API endpoints integrated into the UberEats-Image-Extractor application for automation support.

## Integrated Endpoints

### 1. `/api/download-images` (NEW)
**Purpose**: Batch download menu item images from scraped data
**Method**: POST
**Integration Date**: 2025-08-01

#### Request Format
```json
{
  "data": {
    "menuItems": [...],
    "restaurantInfo": { "name": "..." }
  },
  "options": {
    "outputPath": "./downloads/restaurant-name",
    "groupByCategory": true,
    "skipPlaceholders": true
  }
}
```

#### Response Format
```json
{
  "success": true,
  "stats": {
    "total": 17,
    "downloaded": 15,
    "failed": 0,
    "noImage": 2
  },
  "downloadPath": "./downloads/restaurant-name",
  "mappingFile": "downloads/restaurant-name/image-mapping.json"
}
```

#### Test Results
- ✅ Successfully integrated at line 1747 in server.js
- ✅ Downloads 15/17 images (88% success rate)
- ✅ Creates organized folder structure by category
- ✅ Generates mapping file for reference
- ✅ Handles placeholders and errors gracefully

### 2. Existing Endpoints (Already Available)
- `/api/scrape` - Direct URL scraping
- `/api/extract` - Start extraction job
- `/api/extract-status/:id` - Check job status
- `/api/extract-results/:id` - Get extraction results
- `/api/generate-csv` - Generate CSV files
- `/api/status` - Server health check

## Testing

### Test Script
`/automation/planning/test-api-endpoint.js`

### Running Tests
```bash
cd /automation/planning
node test-api-endpoint.js
```

### Test Output Example
```
🚀 API Endpoint Test for Image Downloads
══════════════════════════════════════════════════
✅ Server is running on port 3007

🧪 Testing /api/download-images endpoint
══════════════════════════════════════════════════

📤 Sending request to http://localhost:3007/api/download-images
   - Menu items: 17
   - Output path: ./downloads/himalaya-test-1754014320189
   - Group by category: true
   - Skip placeholders: true

📥 Response status: 200 OK

✅ Download completed successfully!
══════════════════════════════════════════════════
Statistics:
  - Total items: 17
  - Downloaded: 15
  - Failed: 0
  - No image: 2

📁 Download path: ./downloads/himalaya-test-1754014320189
📄 Mapping file: downloads/himalaya-test-1754014320189/image-mapping.json
```

## Server Configuration

### Port
- Development: 3007 (server) / 5007 (client)
- Production: Configure via environment variables

### Starting the Server
```bash
cd automation/UberEats-Image-Extractor
npm start
```

### Server Output
```
Server running on port 3007
API endpoints:
- Direct Scrape: http://localhost:3007/api/scrape
- Extract: http://localhost:3007/api/extract
- Extract Status: http://localhost:3007/api/extract-status/:id
- Extract Results: http://localhost:3007/api/extract-results/:id
- Generate CSV: http://localhost:3007/api/generate-csv
- Download Images: http://localhost:3007/api/download-images
- Status: http://localhost:3007/api/status
```

## Integration Notes

### File Organization
- Downloaded images: `./downloads/[restaurant-name]/[category]/[dish-name].jpg`
- Mapping file: `./downloads/[restaurant-name]/image-mapping.json`

### Error Handling
- Placeholder images are automatically skipped
- Failed downloads are logged but don't stop the batch
- Partial downloads are cleaned up on error

### Performance Considerations
- Downloads are sequential to avoid overwhelming the CDN
- 30-second timeout per image
- Average download time: ~5 seconds for 15 images

## Usage in Automation Workflow

### Step 3 Integration
1. Scrape menu data → `/api/scrape` or `/api/extract`
2. Generate CSV files → `/api/generate-csv`
3. Download images → `/api/download-images`

### Output for Step 7
- CSV without imageURL (for import)
- Downloaded images folder (for upload)
- Image mapping JSON (for matching)

## Future Enhancements

1. **Parallel Downloads**: Implement concurrent downloads with rate limiting
2. **Progress Tracking**: WebSocket support for real-time progress
3. **Cloud Storage**: Direct upload to S3/CloudFlare
4. **Image Optimization**: Automatic resizing and compression
5. **Resume Support**: Continue interrupted batch downloads

## Summary

The API integration is complete and tested:
- ✅ `/api/download-images` endpoint integrated
- ✅ Full error handling implemented
- ✅ Test script created and validated
- ✅ Documentation complete

This completes the API integration task and provides a solid foundation for the automation agents to use these endpoints.