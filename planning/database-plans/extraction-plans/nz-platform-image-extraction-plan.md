# NZ Platform Image Extraction Enhancement Plan

## Executive Summary
This document outlines a systematic approach to enable image extraction for NZ platforms (OrderMeal, NextOrder, DeliverEasy, etc.) without disrupting the currently working extraction systems.

## Current State (January 2025)

### Working Platforms
| Platform | Category Extraction | Item Extraction | Image Extraction |
|----------|-------------------|-----------------|------------------|
| UberEats | ✅ Custom Prompt | ✅ Generic | ✅ Enabled |
| DoorDash | ✅ Custom Prompt | ✅ Generic | ✅ Enabled |
| FoodHub | ✅ Custom Prompt | ✅ Generic | ❌ Disabled |
| Mobi2Go | ✅ Custom Prompt | ✅ Generic | ❌ Disabled |

### Platforms Ready for Testing
| Platform | Category Extraction | Item Extraction | Image Extraction | Priority |
|----------|-------------------|-----------------|------------------|----------|
| OrderMeal | ✅ Custom Prompt | ✅ Generic | ❌ Disabled | High |
| NextOrder | ✅ Custom Prompt | ⏳ Generic | ❌ Disabled | Medium |
| DeliverEasy | ✅ Custom Prompt | ⏳ Generic | ❌ Disabled | Medium |

## The Image Extraction Challenge

### Platform-Specific Image Storage Methods

#### OrderMeal
- **Location**: CSS background-image in `style` attribute
- **Element**: `<div class="image-wrapper">`
- **Pattern**: `background:url(https://ordermeal.blob.core.windows.net/omc/media/food/[id]/[name].jpeg)`
- **Challenge**: Not in `<img>` tags, requires CSS parsing

#### FoodHub
- **Location**: `<img>` tags within item wrappers
- **Pattern**: `https://assets.foodhub.com/images/thumbnails/[name]_[timestamp]_500.jpg`
- **Challenge**: Firecrawl was constructing URLs instead of extracting

#### Other NZ Platforms
- **Status**: Unknown - needs investigation
- **Assumption**: Likely varied implementations

## Proposed Solution Architecture

### Phase 1: Platform-Specific Item Extraction Prompts

#### 1. Create New Prompt Structure in `firecrawl-service.js`
```javascript
// Platform-specific item extraction prompts
export const ORDERMEAL_ITEM_PROMPT = `Extract menu items from this OrderMeal category page.

For each menu item, extract:
1. dishName: From the <h4> tag within .title-wrapper
2. dishPrice: From .price-wrapper (numerical value only)
3. dishDescription: From the <p> tag within .title-wrapper
4. imageURL: From the style attribute of div.image-wrapper
   - Look for: style="background:url([URL])"
   - Extract the exact URL from within the parentheses
   - DO NOT modify or construct URLs

Items may appear in two structures:
- Most Popular: Within <div class="owl-item"> containers
- Regular items: Within <li class="item-container"> elements`;

export const GENERIC_ITEM_PROMPT = `Extract ALL menu items from this category page...`; // existing
```

#### 2. Create Prompt Selection Function
```javascript
export function generateItemExtractionPrompt(categoryName, platformName) {
  const basePrompt = `Extract ALL menu items from the "${categoryName}" category.\n\n`;

  switch(platformName.toLowerCase()) {
    case 'ordermeal':
      return basePrompt + ORDERMEAL_ITEM_PROMPT;
    case 'foodhub':
      return basePrompt + FOODHUB_ITEM_PROMPT;
    case 'nextorder':
      return basePrompt + NEXTORDER_ITEM_PROMPT;
    default:
      return basePrompt + GENERIC_ITEM_PROMPT;
  }
}
```

### Phase 2: Server Integration

#### Modify `processCategory` in `server.js`
```javascript
const processCategory = async (category) => {
  // ... existing code ...

  // Generate category-specific schema
  const includeImages = platformName.toLowerCase() === 'ubereats' ||
                       platformName.toLowerCase() === 'doordash' ||
                       platformName.toLowerCase() === 'ordermeal'; // when ready

  const categorySchema = generateCategorySchema(category.name, includeImages);

  // NEW: Select platform-specific item extraction prompt
  const itemPrompt = generateItemExtractionPrompt(category.name, platformName);

  // Use the custom prompt in extraction
  const extractionPayload = {
    url: extractionUrl,
    formats: [{
      type: 'json',
      schema: categorySchema,
      prompt: itemPrompt // Use platform-specific prompt
    }],
    // ... rest of payload
  };
```

## Implementation Phases

### Phase 0: Complete Basic Extraction Testing (Current Priority)
**Timeline**: Immediate
**Goal**: Ensure all NZ platforms can extract menu items with prices

1. ✅ OrderMeal - Category detection working
2. ⏳ OrderMeal - Test item extraction (without images)
3. ⏳ NextOrder - Test category and item extraction
4. ⏳ DeliverEasy - Test category and item extraction
5. ⏳ Create prompts for remaining platforms

**Decision**: Keep images disabled for all NZ platforms during this phase

### Phase 1: OrderMeal Image Extraction
**Timeline**: After Phase 0 completion
**Goal**: Successfully extract images from OrderMeal

1. Create `ORDERMEAL_ITEM_PROMPT` with CSS extraction instructions
2. Add OrderMeal to platforms with `includeImages = true`
3. Test with multiple OrderMeal restaurants
4. Document success patterns and edge cases

### Phase 2: Investigate Other NZ Platforms
**Timeline**: After OrderMeal success
**Goal**: Understand image storage patterns for each platform

1. Analyze HTML structure for each platform:
   - NextOrder
   - DeliverEasy
   - Mobi2Go
   - FoodHub (revisit)
2. Document image storage methods
3. Determine which platforms can reliably provide images

### Phase 3: Platform-by-Platform Enablement
**Timeline**: Q1 2025
**Goal**: Enable images for platforms where reliable

For each platform:
1. Create platform-specific item prompt
2. Test extraction with real URLs
3. Enable in production only if >90% success rate
4. Document in architecture file

## Risk Assessment

### Risks
1. **Complexity Creep**: Adding too many platform-specific exceptions
2. **Maintenance Burden**: Each platform needs individual maintenance
3. **Firecrawl Behavior**: May interpret prompts differently over time
4. **Performance Impact**: More complex prompts may slow extraction

### Mitigations
1. **Phased Approach**: Complete basic extraction before adding images
2. **Platform Whitelist**: Only enable images for proven platforms
3. **Fallback Strategy**: Can disable images per platform if issues arise
4. **Clear Documentation**: Maintain detailed docs for each platform's quirks

## Success Criteria

### Phase 0 (Immediate)
- [ ] All Tier 3 platforms extract categories successfully
- [ ] All Tier 3 platforms extract items with names and prices
- [ ] No regression in Tier 1 & 2 platforms

### Phase 1 (OrderMeal Images)
- [ ] OrderMeal extracts images for >90% of items
- [ ] No false/constructed URLs
- [ ] No impact on other data fields

### Phase 2+ (Other Platforms)
- [ ] Document image methods for each platform
- [ ] Enable images only where reliable (>90% success)
- [ ] Maintain platform compatibility matrix

## Decision Log

### January 2025
- **Decision**: Disable images for all NZ platforms initially
- **Reason**: Focus on core functionality (prices) first
- **Plan**: Revisit after basic extraction working for all platforms

## Code Locations

### Files to Modify
```
src/services/firecrawl-service.js
├── Add platform-specific item prompts
├── Add generateItemExtractionPrompt()
└── Export new functions

server.js
└── processCategory()
    └── Use generateItemExtractionPrompt()
```

### Files to Create
```
src/prompts/
├── item-extraction/
│   ├── ordermeal.js
│   ├── foodhub.js
│   ├── nextorder.js
│   └── generic.js
```

## Testing Checklist

### For Each Platform
- [ ] Test with platform's demo restaurant
- [ ] Test with 3+ different restaurants
- [ ] Verify category detection
- [ ] Verify item name extraction
- [ ] Verify price extraction
- [ ] Verify description extraction
- [ ] (Phase 1+) Verify image extraction
- [ ] Check for no constructed/false data
- [ ] Verify CSV generation
- [ ] Confirm database storage

## Appendix: OrderMeal HTML Structure

### Most Popular Items
```html
<div class="owl-item active">
  <div id="item182222" class="item-container">
    <div class="item-wrapper">
      <div class="image-wrapper" style="background:url(https://ordermeal.blob.core.windows.net/...)"></div>
      <div class="item-body">
        <div class="title-wrapper">
          <h4>Lamb Doner Wrap</h4>
          <p>Description here</p>
        </div>
        <div class="price-wrapper">$19.30</div>
      </div>
    </div>
  </div>
</div>
```

### Regular Items
```html
<li id="item182172" class="item-container">
  <div class="item-wrapper">
    <div class="image-wrapper" style="background:url(https://ordermeal.blob.core.windows.net/...)"></div>
    <div class="item-body">
      <div class="title-wrapper">
        <h4>Chicken Kebaburrito</h4>
        <p>Description here</p>
      </div>
      <div class="price-wrapper">$15.00</div>
    </div>
  </div>
</li>
```

---

*Document Version: 1.0*
*Last Updated: January 2025*
*Author: System Architecture Team*