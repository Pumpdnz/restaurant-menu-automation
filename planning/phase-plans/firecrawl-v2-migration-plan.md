# Firecrawl v1 to v2 Migration Plan

## Executive Summary
Firecrawl has released v2 with breaking changes to API structure, requiring migration of our menu extraction system. This plan outlines the systematic approach to migrate from v1 to v2 while maintaining backward compatibility and ensuring zero downtime.

## Migration Scope

### Affected Components
1. **server.js** - Main API server with multiple Firecrawl endpoints
2. **firecrawl-service.js** - Service layer with schemas and extraction logic
3. **menu-extractor-batch agent** - Primary workflow for restaurant menu extraction

### Critical Endpoints Requiring Migration
| Endpoint | Priority | Firecrawl Calls | Used By |
|----------|----------|-----------------|---------|
| `/api/scan-categories` | CRITICAL | 1x `/v1/scrape` | menu-extractor-batch (Phase 1) |
| `/api/batch-extract-categories` | CRITICAL | Multiple `/v1/scrape` | menu-extractor-batch (Phase 2) |
| `/api/scrape` | HIGH | 1x `/v1/scrape` | Direct extraction, fallback |
| `/api/extract` | LOW | `/v1/extract` + polling | Legacy, consider deprecation |
| `/api/extract-images-for-category` | MEDIUM | 1x `/v1/scrape` | Image-only updates |

## Key Changes in v2

### 1. API Endpoint Changes
```
v1: https://api.firecrawl.dev/v1/scrape
v2: https://api.firecrawl.dev/v2/scrape

v1: https://api.firecrawl.dev/v1/extract
v2: https://api.firecrawl.dev/v2/extract (different behavior)
```

### 2. Payload Structure Changes

#### v1 Structure (Current)
```javascript
{
  url: "https://example.com",
  formats: ["json"],
  jsonOptions: {
    schema: { /* schema object */ },
    prompt: "extraction prompt"
  },
  agent: {
    model: "FIRE-1",
    prompt: "navigation prompt"
  },
  onlyMainContent: true,
  waitFor: 2000,
  blockAds: true,
  timeout: 180000
}
```

#### v2 Structure (Required)
```javascript
{
  url: "https://example.com",
  formats: [{
    type: "json",
    schema: { /* schema object */ },
    prompt: "extraction prompt"
  }],
  onlyMainContent: true,
  wait: 2000,  // waitFor → wait
  // blockAds: true - now default
  // skipTlsVerification: true - now default
  // removeBase64Images: true - now default
  timeout: 180000,
  maxAge: 172800  // 2 days cache (new in v2)
}
```

### 3. Response Structure Changes
- v1: `response.data.data.json` for JSON format
- v2: Response structure may vary, needs testing
- Extract endpoint completely restructured

### 4. Removed/Deprecated Features
- `agent` configuration (no direct replacement)
- `jsonOptions` (integrated into formats)
- `/v1/extract` behavior changed significantly

### 5. New Default Behaviors
- Caching enabled by default (maxAge: 2 days)
- blockAds: true (default)
- skipTlsVerification: true (default)
- removeBase64Images: true (default)

## Implementation Phases

### Phase 1: Foundation (Day 1)
1. **Create v2 compatibility layer**
   - Build payload converter function
   - Build response parser function
   - Add feature detection for v1/v2

2. **Environment configuration**
   - Add FIRECRAWL_API_VERSION env variable
   - Update .env.example
   - Allow gradual rollout

### Phase 2: Core Migration (Day 2-3)
1. **Update `/api/scan-categories`**
   - Migrate payload structure
   - Update response parsing
   - Test with sample URLs

2. **Update `/api/batch-extract-categories`**
   - Update synchronous path
   - Update `startBackgroundExtraction` function
   - Maintain job tracking compatibility

3. **Update `/api/scrape`**
   - Primary fallback endpoint
   - Used by multiple workflows

### Phase 3: Secondary Endpoints (Day 4)
1. **Update `/api/extract-images-for-category`**
   - Image-focused extraction
   - Used for image updates

2. **Evaluate `/api/extract`**
   - Consider deprecation
   - Or migrate to v2 extract behavior

### Phase 4: Testing & Validation (Day 5)
1. **Integration testing**
   - Test with UberEats URLs
   - Test with DoorDash URLs
   - Verify CSV generation
   - Verify image downloads

2. **Performance testing**
   - Compare extraction times
   - Verify caching behavior
   - Check rate limits

### Phase 5: Deployment (Day 6)
1. **Staged rollout**
   - Deploy with v1 as default
   - Test v2 with specific restaurants
   - Monitor for issues
   - Switch to v2 as default

## Implementation Details

### 1. Payload Converter Function
```javascript
// utils/firecrawl-v2-converter.js
function convertV1ToV2Payload(v1Payload) {
  const v2Payload = {
    url: v1Payload.url,
    timeout: v1Payload.timeout
  };
  
  // Convert formats
  if (v1Payload.formats?.includes('json') && v1Payload.jsonOptions) {
    v2Payload.formats = [{
      type: 'json',
      schema: v1Payload.jsonOptions.schema,
      prompt: v1Payload.jsonOptions.prompt || v1Payload.agent?.prompt
    }];
  } else if (v1Payload.formats) {
    v2Payload.formats = v1Payload.formats;
  }
  
  // Rename waitFor to wait
  if (v1Payload.waitFor) {
    v2Payload.wait = v1Payload.waitFor;
  }
  
  // Add v2-specific options
  v2Payload.maxAge = 172800; // 2 days cache
  
  // Preserve other options
  if (v1Payload.onlyMainContent !== undefined) {
    v2Payload.onlyMainContent = v1Payload.onlyMainContent;
  }
  
  return v2Payload;
}
```

### 2. Response Parser Function
```javascript
function parseV2Response(v2Response, expectedFormat = 'json') {
  // Handle different response structures
  if (expectedFormat === 'json') {
    // Check various possible locations
    if (v2Response.data?.formats?.json) {
      return v2Response.data.formats.json;
    }
    if (v2Response.data?.json) {
      return v2Response.data.json;
    }
    if (v2Response.formats?.json) {
      return v2Response.formats.json;
    }
    // Fallback to data directly
    return v2Response.data;
  }
  
  return v2Response.data;
}
```

### 3. API Version Detection
```javascript
const FIRECRAWL_API_VERSION = process.env.FIRECRAWL_API_VERSION || 'v1';
const FIRECRAWL_API_URL = process.env.FIRECRAWL_API_URL || 'https://api.firecrawl.dev';

function getFirecrawlEndpoint(endpoint) {
  return `${FIRECRAWL_API_URL}/${FIRECRAWL_API_VERSION}/${endpoint}`;
}
```

## Risk Mitigation

### Identified Risks
1. **Response structure changes** - May break parsing logic
2. **FIRE-1 agent removal** - May affect extraction quality
3. **Caching behavior** - May return stale data
4. **Rate limit changes** - May affect batch processing

### Mitigation Strategies
1. **Dual-version support** - Run v1 and v2 in parallel initially
2. **Comprehensive logging** - Log all v2 responses for analysis
3. **Fallback mechanism** - Fall back to v1 on v2 failures
4. **Cache control** - Add cache-busting parameters when needed

## Testing Strategy

### Unit Tests
- Payload converter function
- Response parser function
- Version detection logic

### Integration Tests
1. **Category scanning**
   - UberEats category detection
   - DoorDash category detection

2. **Batch extraction**
   - Small menu (< 50 items)
   - Large menu (> 200 items)
   - Multi-category extraction

3. **Image extraction**
   - High-quality images
   - Placeholder detection

### End-to-End Tests
1. Complete workflow test:
   - URL input → Category scan → Batch extract → CSV generation → Image download

2. Platform-specific tests:
   - UberEats full extraction
   - DoorDash full extraction

## Rollback Plan

### Rollback Triggers
- Extraction success rate < 80%
- Response time > 2x v1 baseline
- Critical parsing errors

### Rollback Process
1. Set `FIRECRAWL_API_VERSION=v1` in environment
2. Restart server
3. Monitor extraction success
4. Investigate v2 issues offline

## Success Metrics

### Primary Metrics
- Extraction success rate ≥ 95%
- Response time ≤ v1 baseline
- Zero data loss during migration

### Secondary Metrics
- Cache hit rate > 30% (for repeated extractions)
- Reduced API costs (due to caching)
- Improved extraction quality

## Timeline

| Day | Tasks | Deliverable |
|-----|-------|------------|
| 1 | Foundation setup | Converter functions, env config |
| 2 | Core migration pt.1 | scan-categories endpoint |
| 3 | Core migration pt.2 | batch-extract endpoints |
| 4 | Secondary endpoints | Image extraction, cleanup |
| 5 | Testing & validation | Test report, bug fixes |
| 6 | Deployment | Production rollout |

## Post-Migration Tasks

1. **Documentation updates**
   - Update API documentation
   - Update agent workflows
   - Update troubleshooting guides

2. **Performance optimization**
   - Tune cache settings
   - Optimize batch sizes
   - Adjust timeout values

3. **Feature exploration**
   - Test new v2 features (summary format)
   - Evaluate crawl with prompts
   - Test new search sources

## Appendix

### A. Sample Test URLs
```
UberEats:
- https://www.ubereats.com/nz/store/himalaya-queenstown/abc123
- https://www.ubereats.com/nz/store/curry-palace-wellington/xyz789

DoorDash:
- https://www.doordash.com/store/curry-garden-wellington-32271711/
- https://www.doordash.com/store/pizza-place-auckland-45678901/
```

### B. Environment Variables
```bash
# .env updates needed
FIRECRAWL_API_KEY=fc-your-key-here
FIRECRAWL_API_URL=https://api.firecrawl.dev
FIRECRAWL_API_VERSION=v2  # New variable
FIRECRAWL_CACHE_MAX_AGE=172800  # Optional cache control
```

### C. Migration Checklist
- [ ] Backup current working v1 code
- [ ] Create v2 branch for development
- [ ] Implement converter functions
- [ ] Update scan-categories endpoint
- [ ] Update batch-extract-categories endpoint
- [ ] Update background job processor
- [ ] Test with UberEats URL
- [ ] Test with DoorDash URL
- [ ] Verify CSV generation
- [ ] Verify image downloads
- [ ] Update documentation
- [ ] Deploy to production
- [ ] Monitor for 24 hours
- [ ] Remove v1 code (after 1 week stable)

## Contact & Support

- Firecrawl v2 Docs: https://docs.firecrawl.dev/migrate-to-v2
- Firecrawl Discord: https://discord.gg/gSmWdAkdwd
- Internal Support: Contact orchestrator for assistance