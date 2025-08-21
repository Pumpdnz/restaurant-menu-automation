# Menu Scraper Download Functionality - Findings

## Current Limitations

### 1. Puppeteer Download Handling
- **Challenge**: Browser automation tools have limited file system access
- **Issue**: Cannot programmatically select download folders in system dialogs
- **Current State**: Menu scraper requires manual folder selection

### 2. Local App Architecture
- **Server**: Runs on http://localhost:3005
- **Storage**: Does not save results to disk automatically
- **Interface**: Web-based UI only (no documented API endpoints)

## Potential Solutions

### Option 1: Direct API Integration (Recommended)
```javascript
// Potential API call structure
const extractMenu = async (uberEatsUrl) => {
  const response = await fetch('http://localhost:3005/api/extract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: uberEatsUrl,
      extractionMethod: 'standard',
      platform: 'ubereats'
    })
  });
  
  const data = await response.json();
  // Save CSV and images programmatically
  await fs.writeFile('menu.csv', data.csv);
  await downloadImages(data.images);
};
```

### Option 2: Headless Download Automation
```javascript
// Configure Puppeteer for automatic downloads
const browser = await puppeteer.launch({
  headless: false,
  args: ['--disable-dev-shm-usage'],
  prefs: {
    download: {
      prompt_for_download: false,
      default_directory: '/path/to/downloads'
    }
  }
});
```

### Option 3: Modify Local App
Add server endpoints to:
1. Return extraction results as JSON
2. Save files to predetermined directory
3. Provide webhook for completion notification

## Recommended Approach for MVP

Since we need a working solution quickly:

1. **Continue with current workflow** but acknowledge manual intervention required for downloads
2. **Document the manual step** clearly in the workflow
3. **Plan for API development** in next iteration

## Impact on Automation Workflow

### Phase 1 (Current): Semi-Automated
- Extraction: ✅ Fully automated
- Download: ⚠️ Requires manual folder selection
- CSV Access: ❌ Manual file handling needed

### Phase 2 (Future): Fully Automated
- Add API endpoints to menu scraper
- Direct file system writes
- Webhook notifications for completion

## Next Steps

1. **For MVP**: Accept manual download step, proceed with workflow validation
2. **For Production**: Prioritize adding API endpoints to menu scraper
3. **Alternative**: Investigate if Firecrawl alone can handle menu extraction