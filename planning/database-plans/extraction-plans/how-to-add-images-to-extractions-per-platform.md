# How to Add Images to Extractions Per Platform

## Quick Reference

To enable image extraction for a new platform, modify the `includeImages` check in:

**File:** `UberEats-Image-Extractor/server.js` (around line 221)

```javascript
const includeImages = platformName.toLowerCase() === 'ubereats' ||
                    platformName.toLowerCase() === 'sipo' ||
                    platformName.toLowerCase() === 'doordash';
```

Simply add another condition: `platformName.toLowerCase() === 'yourplatform'`

## How It Works

1. **Platform Detection**: The batch extraction endpoint detects the platform from the URL
2. **Schema Generation**: `generateCategorySchema(categoryName, includeImages)` is called
3. **Conditional Field**: When `includeImages=true`, the `imageURL` field is added to the JSON extraction schema
4. **AI Extraction**: Firecrawl's AI extractor only looks for images when the schema requests them

## Currently Enabled Platforms

| Platform | Images Enabled |
|----------|---------------|
| UberEats | Yes |
| DoorDash | Yes |
| Sipo | Yes |
| OrderMeal | No |
| Mobi2Go | No |
| NextOrder | No |
| DeliverEasy | No |
| FoodHub | No |

## Related Files

- `server.js` - Platform check logic
- `src/services/firecrawl-service.js` - `generateCategorySchema()` function that conditionally adds `imageURL`