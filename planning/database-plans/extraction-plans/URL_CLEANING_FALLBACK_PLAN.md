# URL Cleaning Method with Modal Fallback Plan

## Overview
This document outlines the production-ready implementation strategy for the URL cleaning method with modal access fallback for extracting menu items with option sets from UberEats.

## URL Structure Analysis

### Modal URL Components
```
https://www.ubereats.com/nz/store/{restaurant-slug}/{storeId}
?mod=quickView
&modctx={double-encoded-json}
&ps=1
```

### Clean URL Pattern
```
https://www.ubereats.com/nz/store/{restaurant-slug}/{storeId}/{sectionUuid}/{subsectionUuid}/{itemUuid}
```

### ModCtx JSON Structure
```json
{
  "storeUuid": "04edc62c-5aaf-4cbf-85f3-6e7b8a5f0ff6",
  "sectionUuid": "a99bcc3b-6024-4358-a844-a5e8bf910890",
  "subsectionUuid": "556a657a-a6d1-5286-9029-a1061fcf5e1c",
  "itemUuid": "94cc2817-97e2-4b63-956d-7e13f9ed65dd",
  "showSeeDetailsCTA": true
}
```

## Hybrid Implementation with Validation and Fallback

### 1. Main Extraction Function
```javascript
async function extractMenuItemWithOptionSets(modalUrl, orgId) {
  // Validate organization context
  if (!orgId) {
    throw new Error('Organization ID required for multi-tenant extraction');
  }
  
  // Try clean URL method first
  try {
    const cleanResult = await tryCleanUrlExtraction(modalUrl, orgId);
    
    // Validate result
    if (cleanResult.success && 
        cleanResult.pageType === 'item detail' &&
        !isPlaceholderImage(cleanResult.imageUrl)) {
      return {
        method: 'clean-url',
        ...cleanResult,
        orgId
      };
    }
  } catch (error) {
    console.log(`Clean URL failed for ${modalUrl}: ${error.message}`);
  }
  
  // Fallback to modal access method
  try {
    const modalResult = await tryModalExtraction(modalUrl, orgId);
    return {
      method: 'modal-fallback',
      ...modalResult,
      orgId
    };
  } catch (error) {
    console.error(`Both methods failed for ${modalUrl}:`, error);
    return {
      success: false,
      error: error.message,
      modalUrl,
      orgId
    };
  }
}
```

### 2. URL Cleaning with Validation
```javascript
function cleanModalUrl(modalUrl) {
  try {
    const urlObj = new URL(modalUrl);
    const baseUrl = `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`;
    
    // Get and decode modctx parameter
    const modctx = urlObj.searchParams.get('modctx');
    if (!modctx) {
      throw new Error('No modctx parameter found');
    }
    
    // Double decode (URL encoded twice)
    let decoded = decodeURIComponent(modctx);
    decoded = decodeURIComponent(decoded);
    
    // Parse JSON
    const modctxData = JSON.parse(decoded);
    
    // Validate UUIDs
    if (!validateUUIDs(modctxData)) {
      throw new Error('Invalid UUID format in modctx');
    }
    
    // Build clean URL
    return {
      cleanUrl: `${baseUrl}/${modctxData.sectionUuid}/${modctxData.subsectionUuid}/${modctxData.itemUuid}`,
      ...modctxData
    };
  } catch (error) {
    console.error('URL cleaning failed:', error);
    return null;
  }
}

function validateUUIDs(data) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  
  return (
    data.sectionUuid && uuidRegex.test(data.sectionUuid) &&
    data.subsectionUuid && uuidRegex.test(data.subsectionUuid) &&
    data.itemUuid && uuidRegex.test(data.itemUuid)
  );
}
```

### 3. Clean URL Extraction
```javascript
async function tryCleanUrlExtraction(modalUrl, orgId) {
  const cleanUrlData = cleanModalUrl(modalUrl);
  
  if (!cleanUrlData) {
    throw new Error('Failed to clean URL');
  }
  
  // Test URL validity with HEAD request
  try {
    const testResponse = await axios.head(cleanUrlData.cleanUrl);
    if (testResponse.status !== 200) {
      throw new Error(`URL returned status ${testResponse.status}`);
    }
  } catch (error) {
    throw new Error(`URL validation failed: ${error.message}`);
  }
  
  // Extract content using Firecrawl
  const payload = {
    url: cleanUrlData.cleanUrl,
    formats: [
      {
        type: 'json',
        schema: getOptionSetsSchema(),
        prompt: getOptionSetsPrompt()
      }
    ],
    onlyMainContent: true,
    waitFor: 3000,
    blockAds: true,
    timeout: 60000,
    skipTlsVerification: true,
    actions: [
      { type: 'wait', milliseconds: 2000 },
      { type: 'screenshot' },
      { type: 'click', selector: 'button[aria-label="Close"]' },
      { type: 'wait', milliseconds: 2000 },
      { type: 'screenshot' }
    ]
  };
  
  const response = await firecrawlScrape(payload);
  
  if (!response.success) {
    throw new Error('Firecrawl extraction failed');
  }
  
  return {
    success: true,
    ...response.data.json,
    cleanUrl: cleanUrlData.cleanUrl,
    orgId
  };
}
```

### 4. Modal Fallback Extraction
```javascript
async function tryModalExtraction(modalUrl, orgId) {
  const payload = {
    url: modalUrl,
    formats: [
      {
        type: 'json',
        schema: getOptionSetsSchema(),
        prompt: getOptionSetsPrompt()
      }
    ],
    onlyMainContent: false,
    waitFor: 3000,
    blockAds: true,
    timeout: 60000,
    skipTlsVerification: true,
    actions: [
      { type: 'wait', milliseconds: 2000 },
      { type: 'screenshot' },
      { type: 'click', selector: 'button[aria-label="Close"]' },
      { type: 'wait', milliseconds: 2000 },
      { type: 'screenshot' }
    ]
  };
  
  const response = await firecrawlScrape(payload);
  
  if (!response.success) {
    throw new Error('Modal extraction failed');
  }
  
  return {
    success: true,
    ...response.data.json,
    modalUrl,
    orgId
  };
}
```

### 5. Image Validation
```javascript
function isPlaceholderImage(imageUrl) {
  const placeholderPatterns = [
    '/_static/8ab3af80072120d4.png',
    '/_static/29ed4bc0793fd578.svg',
    '/placeholder',
    '/no-image',
    '/default'
  ];
  
  if (!imageUrl) return true;
  
  return placeholderPatterns.some(pattern => 
    imageUrl.includes(pattern)
  );
}
```

## Monitoring and Error Handling

### 1. Success Rate Tracking
```javascript
class ExtractionMonitor {
  constructor() {
    this.stats = {
      cleanUrl: { success: 0, failure: 0 },
      modal: { success: 0, failure: 0 },
      total: { success: 0, failure: 0 }
    };
  }
  
  recordResult(method, success) {
    this.stats[method][success ? 'success' : 'failure']++;
    this.stats.total[success ? 'success' : 'failure']++;
    
    // Alert if clean URL success rate drops below threshold
    const cleanUrlRate = this.getSuccessRate('cleanUrl');
    if (cleanUrlRate < 0.7 && this.stats.cleanUrl.success + this.stats.cleanUrl.failure > 100) {
      this.alertUrlStructureChange();
    }
  }
  
  getSuccessRate(method) {
    const stats = this.stats[method];
    const total = stats.success + stats.failure;
    return total > 0 ? stats.success / total : 0;
  }
  
  alertUrlStructureChange() {
    // Send alert to monitoring system
    console.error('ALERT: Clean URL success rate below 70% - possible URL structure change');
    // Trigger notification to development team
  }
}
```

### 2. Configuration Management
```javascript
const URL_CONFIG = {
  version: '2024-01',
  patterns: {
    current: {
      base: 'https://www.ubereats.com',
      itemPath: '/{sectionUuid}/{subsectionUuid}/{itemUuid}',
      modalParams: ['mod=quickView', 'modctx', 'ps']
    },
    fallback: {
      // Previous URL patterns for backward compatibility
    }
  },
  validation: {
    uuidRegex: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    requiredFields: ['sectionUuid', 'subsectionUuid', 'itemUuid']
  },
  monitoring: {
    alertThreshold: 0.7,
    sampleSize: 100
  },
  lastVerified: new Date('2024-01-31'),
  regions: {
    supported: ['nz', 'au', 'us', 'ca', 'uk'],
    tested: ['nz']
  }
};
```

## Error Recovery Strategies

### 1. Batch Processing with Retry
```javascript
async function processBatchWithRetry(modalUrls, orgId, maxRetries = 3) {
  const results = [];
  const failed = [];
  
  for (const modalUrl of modalUrls) {
    let retries = 0;
    let success = false;
    
    while (retries < maxRetries && !success) {
      try {
        const result = await extractMenuItemWithOptionSets(modalUrl, orgId);
        if (result.success) {
          results.push(result);
          success = true;
        } else {
          retries++;
          if (retries < maxRetries) {
            await wait(1000 * retries); // Exponential backoff
          }
        }
      } catch (error) {
        retries++;
        console.error(`Attempt ${retries} failed for ${modalUrl}:`, error);
      }
    }
    
    if (!success) {
      failed.push({
        modalUrl,
        attempts: retries,
        lastError: 'Max retries exceeded'
      });
    }
  }
  
  return { results, failed };
}
```

### 2. Regional URL Adaptation
```javascript
function adaptUrlForRegion(cleanUrl, region) {
  const regionMappings = {
    'au': '.com.au',
    'uk': '.co.uk',
    'ca': '.ca',
    'us': '.com',
    'nz': '.com'  // New Zealand uses .com
  };
  
  // Adjust domain based on region
  if (regionMappings[region]) {
    cleanUrl = cleanUrl.replace('.com', regionMappings[region]);
  }
  
  // Adjust path based on region
  cleanUrl = cleanUrl.replace('/nz/', `/${region}/`);
  
  return cleanUrl;
}
```

## Testing Strategy

### 1. Regression Tests
```javascript
const testCases = [
  {
    name: "Standard item with option sets",
    modalUrl: "https://www.ubereats.com/nz/store/romans-kitchen/...",
    expectedOptionSets: 3,
    expectedImage: true
  },
  {
    name: "Item without image",
    modalUrl: "https://www.ubereats.com/nz/store/romans-kitchen/...",
    expectedOptionSets: 2,
    expectedImage: false
  },
  {
    name: "Unavailable item (404)",
    modalUrl: "https://www.ubereats.com/nz/store/romans-kitchen/...",
    expectedError: "404"
  }
];

async function runRegressionTests() {
  const results = [];
  
  for (const testCase of testCases) {
    const result = await extractMenuItemWithOptionSets(testCase.modalUrl, 'test-org');
    results.push({
      name: testCase.name,
      passed: validateTestResult(result, testCase),
      result
    });
  }
  
  return results;
}
```

### 2. Performance Benchmarks
```javascript
async function benchmarkMethods() {
  const testUrls = getTestUrls(10);
  
  // Benchmark clean URL method
  const cleanUrlStart = Date.now();
  for (const url of testUrls) {
    await tryCleanUrlExtraction(url, 'test-org');
  }
  const cleanUrlTime = Date.now() - cleanUrlStart;
  
  // Benchmark modal method
  const modalStart = Date.now();
  for (const url of testUrls) {
    await tryModalExtraction(url, 'test-org');
  }
  const modalTime = Date.now() - modalStart;
  
  return {
    cleanUrl: {
      totalTime: cleanUrlTime,
      avgTime: cleanUrlTime / testUrls.length
    },
    modal: {
      totalTime: modalTime,
      avgTime: modalTime / testUrls.length
    },
    improvement: ((modalTime - cleanUrlTime) / modalTime * 100).toFixed(2) + '%'
  };
}
```

## Deployment Checklist

- [ ] Test URL cleaning with 100+ sample URLs from target region
- [ ] Verify fallback mechanism triggers correctly on 404s
- [ ] Set up monitoring alerts for success rate drops
- [ ] Create regression test suite with known good URLs
- [ ] Document URL patterns for each supported region
- [ ] Implement rate limiting to avoid overloading Firecrawl
- [ ] Set up error logging with detailed context
- [ ] Create manual override mechanism for URL patterns
- [ ] Test with multi-tenant organization IDs
- [ ] Verify FK constraints between menu items and option sets
- [ ] Load test with concurrent extractions
- [ ] Create rollback plan if URL structure changes

## Rollback Plan

If the URL structure changes significantly:

1. **Immediate Response** (< 1 hour):
   - Switch to modal-only mode via feature flag
   - Alert development team
   - Begin collecting failed URL samples

2. **Short-term Fix** (< 24 hours):
   - Analyze new URL structure
   - Update URL cleaning logic
   - Deploy hotfix after testing

3. **Long-term Solution** (< 1 week):
   - Implement pattern detection for automatic adaptation
   - Add multiple URL pattern support
   - Enhanced monitoring for structure changes

## Maintenance Schedule

- **Daily**: Monitor success rates and error logs
- **Weekly**: Run regression tests on sample URLs
- **Monthly**: Review and update URL patterns if needed
- **Quarterly**: Full system audit and performance review

## Contact for Issues

- Primary: Development Team (Slack: #extraction-issues)
- Escalation: Platform Team Lead
- Critical: On-call engineer via PagerDuty

Last Updated: 2024-01-31
Version: 1.0.0