# Firecrawl Node.js Version Warning

**Status**: Monitoring (not blocking)
**Date**: 2025-12-09

## Warning Message

```
npm warn EBADENGINE Unsupported engine {
npm warn EBADENGINE   package: '@mendable/firecrawl-js@1.29.3',
npm warn EBADENGINE   required: { node: '>=22.0.0' },
npm warn EBADENGINE   current: { node: 'v20.19.6', npm: '10.8.2' }
npm warn EBADENGINE }
```

## Current State

- **Package**: `@mendable/firecrawl-js@1.29.3`
- **Required Node**: >=22.0.0
- **Current Node**: v20.19.6 (LTS)
- **Impact**: Warning only, package works correctly

## Why Not Upgrade Now

1. Node 20 is the current LTS version
2. Playwright Docker image (`v1.54.0-jammy`) uses Node 20.x
3. Everything works - this is just a warning
4. Upgrading would require custom Dockerfile or finding a Node 22 Playwright image

## If Issues Arise

**Option 1: Pin Firecrawl version**
```json
"@mendable/firecrawl-js": "1.29.3"  // Remove ^ to pin
```

**Option 2: Upgrade Node to 22**
- Requires finding/building Playwright image with Node 22
- Test thoroughly before deploying

## Monitoring

Check if Firecrawl updates cause issues:
- Build failures mentioning Firecrawl
- Runtime errors in menu extraction
- API compatibility issues

## Related Files

- `UberEats-Image-Extractor/package.json` - Firecrawl dependency
- `Dockerfile` - Node version via Playwright image
- `UberEats-Image-Extractor/netlify.toml` - Node version for Netlify
