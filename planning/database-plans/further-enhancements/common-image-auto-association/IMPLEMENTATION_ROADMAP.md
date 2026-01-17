# Implementation Roadmap: Automatic Common Image Association

## Overview

This roadmap details the implementation of automatic common image association for menu items during extraction processing. The feature will:

1. **Fill missing images** - Match menu item names against a library of common product images (beverages like Coke, Sprite, Fanta, L&P, Red Bull, water, etc.) and automatically associate matching images for items without images.

2. **Replace with priority images** - For certain high-quality common images (e.g., Coca-Cola cans), automatically replace the extracted image with our superior quality image, regardless of whether the item already has an image.

3. **Size-aware matching** - Parse size indicators from item names (e.g., "600ml", "1.5L") and match to appropriate container types (can, bottle, large-bottle) to ensure correct image selection.

**Based on**: Investigation findings from Tasks 1-4 and Synthesis document

---

## Objectives

1. **Detect items without images** during extraction processing
2. **Match item names** against common images library using confidence scoring
3. **Auto-associate images** for items that meet the confidence threshold (0.70)
4. **Replace extracted images** with priority common images when flagged
5. **Size-aware matching** - Parse sizes and match container types correctly
6. **Track associations** via metadata for auditability
7. **Follow existing patterns** (tag-detection-service.js approach)

---

## Architecture

### Component Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    Extraction Layer                              │
│  ┌──────────────────────┐    ┌──────────────────────────────┐   │
│  │ Standard Extraction  │    │   Premium Extraction         │   │
│  │ (server.js)          │    │   (premium-extraction-svc)   │   │
│  └──────────┬───────────┘    └──────────────┬───────────────┘   │
│             │                               │                    │
│             └───────────────┬───────────────┘                    │
│                             ▼                                    │
└─────────────────────────────┼────────────────────────────────────┘
                              │
┌─────────────────────────────┼────────────────────────────────────┐
│                    Service Layer                                  │
│                             ▼                                    │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │              saveExtractionResults()                       │   │
│  │              (database-service.js:1027)                    │   │
│  │                         │                                  │   │
│  │    ┌────────────────────┼────────────────────┐            │   │
│  │    │                    ▼                    │            │   │
│  │    │  ┌─────────────────────────────────┐   │            │   │
│  │    │  │   processMenuItemTags()         │   │  EXISTING  │   │
│  │    │  │   (tag-detection-service.js)    │   │            │   │
│  │    │  └─────────────────────────────────┘   │            │   │
│  │    │                    │                    │            │   │
│  │    │                    ▼                    │            │   │
│  │    │        createMenuItems()               │            │   │
│  │    │                    │                    │            │   │
│  │    │                    ▼                    │            │   │
│  │    │        Build itemImageMap              │            │   │
│  │    │                    │                    │            │   │
│  │    │  ┌─────────────────────────────────┐   │            │   │
│  │    │  │ processCommonImageAssociations()│   │  NEW       │   │
│  │    │  │ (common-images-service.js)      │   │            │   │
│  │    │  └─────────────────────────────────┘   │            │   │
│  │    │                    │                    │            │   │
│  │    └────────────────────┼────────────────────┘            │   │
│  │                         ▼                                  │   │
│  │              createItemImages()                            │   │
│  └───────────────────────────────────────────────────────────┘   │
│                             │                                    │
└─────────────────────────────┼────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Database Layer (Supabase)                     │
│           item_images table (with cdn_metadata tracking)         │
└─────────────────────────────────────────────────────────────────┘
```

### File Structure

```
UberEats-Image-Extractor/
├── src/
│   ├── services/
│   │   ├── database-service.js          # MODIFY: Import and call common images
│   │   ├── tag-detection-service.js     # EXISTING: Pattern to follow
│   │   ├── common-images-service.js     # NEW: Common image matching logic
│   │   └── ...
│   └── lib/
│       └── common-images-constants.ts   # REFERENCE: Source data (70+ images)
└── planning/
    └── database-plans/
        └── common-image-auto-association/
            └── IMPLEMENTATION_ROADMAP.md  # This file
```

---

## Size-Aware Matching

### Size Parsing

The system parses size indicators from menu item names:

```javascript
parseSize("Coke 600ml")     // Returns: 600
parseSize("Sprite 1.5L")    // Returns: 1500
parseSize("Red Bull 250ml") // Returns: 250
parseSize("Burger")         // Returns: null
```

### Container Type Mapping

| Size Range | Container Type |
|------------|----------------|
| ≤ 375ml | `can` |
| 376ml - 750ml | `bottle` |
| > 750ml | `large-bottle` |

### Confidence Adjustments

| Scenario | Adjustment |
|----------|------------|
| Container type matches | +10% boost |
| Exact size match (±50ml) | +5% additional boost |
| Container type mismatch | 50% penalty |

**Example**: "Coke No Sugar (600ml)"
- Parses to 600ml → `bottle` container type
- Coke Zero Can (330ml, `can`) → **penalized** (×0.5)
- Coke Zero Bottle 600ml (600ml, `bottle`) → **boosted** (×1.1 × 1.05)
- Result: Bottle variant wins

---

## Available Common Images (70+ Total)

### Coca-Cola Products

| Product | Can (330ml) | Bottle (600ml) | Large Bottle (1.5L) |
|---------|-------------|----------------|---------------------|
| Coke Classic | ✅ | ✅ | ✅ |
| Coke Zero/No Sugar | ✅ | ✅ | ✅ |
| Vanilla Coke | ✅ | ✅ | - |
| Vanilla Coke Zero | ✅ | ✅ | - |

### Pepsi Products

| Product | Can (330ml) | Bottle (600ml) | Large Bottle (1.5L) |
|---------|-------------|----------------|---------------------|
| Pepsi | ✅ | 🔲 | 🔲 |
| Pepsi Max | ✅ | 🔲 | 🔲 |
| Mountain Dew | ✅ | 🔲 | 🔲 |
| 7up | ✅ | 🔲 | 🔲 |

### Sprite Products

| Product | Can (330ml) | Bottle (600ml) | Large Bottle (1.5L) |
|---------|-------------|----------------|---------------------|
| Sprite | ✅ | ✅ | ✅ |
| Sprite Zero | ✅ | ✅ | ✅ |

### Fanta Products

| Product | Can (330ml) | Bottle (600ml) | Large Bottle (1.5L) |
|---------|-------------|----------------|---------------------|
| Fanta Orange | ✅ | ✅ | ✅ |

### L&P Products

| Product | Can (330ml) | Bottle (600ml) | Large Bottle (1.5L) |
|---------|-------------|----------------|---------------------|
| L&P | ✅ | ✅ | ✅ |

### Karma Cola Products (300ml bottles, extensible to 330ml cans)

| Product | Bottle (300ml) | Can (330ml) |
|---------|----------------|-------------|
| Karma Cola | ✅ | 🔲 |
| Karma Cola Sugar Free | ✅ | 🔲 |
| Gingerella Ginger Beer | ✅ | 🔲 |
| Lemmy Lemonade | ✅ | 🔲 |
| Lemmy Lemonade Sugar Free | ✅ | 🔲 |
| Razza Raspberry Lemonade | ✅ | 🔲 |

### Other Soft Drinks

| Product | Container | Size |
|---------|-----------|------|
| Lift Can | Can | 330ml |
| Lift Bottle | Large Bottle | 1.5L |
| Sparkling Duet Orange | Can | 330ml |
| Sparkling Duet Lemon | Can | 330ml |
| Sparkling Duet Raspberry | Can | 330ml |
| Limca Lemonade | Can | 330ml |
| Thumbs Up Cola | Can | 330ml |
| Bundaberg Ginger Beer | Bottle | 375ml |

### Mixers & Premium

| Product | Container | Size |
|---------|-----------|------|
| Schweppes Ginger Beer | Bottle | 300ml |
| Schweppes Lemonade | Bottle | 300ml |
| Schweppes LLB | Bottle | 300ml |

### Water Products

| Product | Container | Size |
|---------|-----------|------|
| Pump Water | Bottle | 750ml |
| Pump Mini Water | Bottle | 350ml |

### Coffee Products

| Product | Container | Size |
|---------|-----------|------|
| Allpress Long Black | Can | 200ml |
| Allpress Latte | Can | 200ml |
| Allpress Mocha | Can | 200ml |

### Energy Drinks

| Product | Container | Size |
|---------|-----------|------|
| Red Bull Original | Can | 250ml |
| Red Bull Sugar Free | Can | 250ml |
| Red Bull Zero | Can | 250ml |
| Red Bull Watermelon | Can | 250ml |
| Monster Original | Can | 500ml |
| Monster Ultra/Zero | Can | 500ml |
| V Energy | Can | 250ml |
| V Energy | Can | 500ml |
| Live Plus | Can | 250ml |
| Live Plus | Can | 500ml |

### Juices

| Product | Container | Size |
|---------|-----------|------|
| Most Organic Apple Orange Mango | Bottle | 350ml |
| Most Organic Apple Blackcurrant | Bottle | 350ml |
| Most Organic Apple Peach | Bottle | 350ml |
| Most Organic Apple Guava | Bottle | 350ml |
| Most Organic Apple Feijoa | Bottle | 350ml |
| Keri Apple | Bottle | 350ml |
| Keri Orange | Bottle | 350ml |

### Sports Drinks

| Product | Container | Size |
|---------|-----------|------|
| Powerade Blue | Bottle | 750ml |
| Powerade Red | Bottle | 750ml |
| Powerade Purple | Bottle | 750ml |
| Powerade Green | Bottle | 750ml |
| Powerade Blue Zero | Bottle | 600ml |
| Powerade Red Zero | Bottle | 750ml |
| Powerade Purple Zero | Bottle | 750ml |

**Legend**: ✅ = Image available | 🔲 = Placeholder (extensible)

---

## Matching Algorithm Summary

### Confidence Scoring Tiers

| Match Type | Calculation | Example |
|------------|-------------|---------|
| Exact match | baseConfidence (0.95) | "Coke" → Coke Can |
| Keyword match | baseConfidence × 0.85 | "Diet Coke" → Coke Zero Can (0.81) |
| Name contains | baseConfidence × 0.75 | "Coke Zero Sugar" → Coke Zero Can (0.71) |
| Partial keyword | baseConfidence × 0.60 | "Zero Sugar Drink" → (below 0.70) |

### Size-Aware Adjustments

| Scenario | Adjustment |
|----------|------------|
| Container type matches | ×1.1 (10% boost) |
| Exact size match (±50ml) | ×1.05 (additional 5% boost) |
| Container type mismatch | ×0.5 (50% penalty) |

### Threshold: 0.70 (Recommended)

This balanced threshold:
- Catches most relevant beverage matches
- Avoids false positives on generic terms
- Can be adjusted based on testing results

---

## Priority Replacement Images

The following images have `priorityReplace: true` and will **always replace** extracted images, even if the item already has an image.

### Priority Replacement Enabled

All Coca-Cola, Pepsi, Sprite, Fanta, L&P, Karma Cola, and major brand products have priority replacement enabled by default for consistent high-quality imagery.

### Decision Criteria for Priority Replace

Enable `priorityReplace: true` when:
- Image is high-resolution and professionally shot
- Product has standardized appearance (e.g., branded cans/bottles)
- Restaurant-uploaded images are typically low quality for this product
- Product is commonly ordered (high visibility)

---

## Testing Strategy

### Manual Testing Checklist

| Test Case | Item Name | Expected Result |
|-----------|-----------|-----------------|
| Size-aware can | "Coke 330ml" | Matched to coke-can |
| Size-aware bottle | "Coke 600ml" | Matched to coke-bottle-600ml |
| Size-aware large | "Coke 1.5L" | Matched to coke-bottle-1.5l |
| Size mismatch penalty | "Coke No Sugar (600ml)" | Bottle variant wins over can |
| Fill missing | "Coke" (no image) | **Filled** with coke-can |
| Priority replace | "Coke" (has image) | **Replaced** with coke-can |
| Karma brand | "Karma Cola" | Matched to karma-cola-bottle |
| Karma flavour | "Gingerella" | Matched to gingerella-bottle |
| Pepsi match | "Pepsi Max" | Matched to pepsi-max-can |
| No match | "Burger" | No action |

### Database Verification

```sql
-- Check auto-associated images by cdn_metadata
SELECT
  mi.name as item_name,
  ii.url,
  ii.cdn_metadata
FROM item_images ii
JOIN menu_items mi ON mi.id = ii.menu_item_id
WHERE ii.cdn_metadata->>'source' = 'common-images'
ORDER BY ii.created_at DESC
LIMIT 20;
```

---

## Implementation Status

### Phase 1: Core Development ✅
- [x] Create `common-images-service.js`
- [x] Implement size parsing (`parseSize`, `getContainerType`)
- [x] Implement confidence-based matching
- [x] Implement size-aware confidence adjustments
- [x] Add placeholder URL filtering

### Phase 2: Image Library ✅
- [x] Coca-Cola products (cans + bottles)
- [x] Pepsi products (cans, bottles extensible)
- [x] Sprite products (cans + bottles)
- [x] Fanta products (cans + bottles)
- [x] L&P products (cans + bottles)
- [x] Karma Cola individual flavours
- [x] Energy drinks (Red Bull, Monster, V, Live Plus)
- [x] Juices (Most Organic, Keri)
- [x] Sports drinks (Powerade)
- [x] Mixers (Schweppes)
- [x] Water (Pump)
- [x] Coffee (Allpress)

### Phase 3: Frontend Sync ✅
- [x] Update `common-images-constants.ts` with all products
- [x] Add TypeScript interfaces for containerType, sizeML
- [x] Add size parsing utilities to frontend
- [x] Sync with backend service

### Phase 4: Integration
- [ ] Add import to `database-service.js`
- [ ] Insert common image processing after itemImageMap build
- [ ] Add logging for association stats

### Phase 5: Production
- [ ] Deploy to production
- [ ] Monitor first 10 extractions
- [ ] Adjust confidence threshold if needed

---

## Future Enhancements

### Expand Common Images Library

Currently empty categories:
- **Sides**: Fries, wedges, onion rings, salads
- **Condiments**: Sauces, dressings, dips
- **Desserts**: Ice cream, brownies, cookies
- **Hot drinks**: Tea varieties, hot chocolate

### Additional Bottle Sizes

Many products have placeholder URLs for bottle variants:
- Pepsi 600ml and 1.5L bottles
- Karma Cola 330ml cans
- Additional energy drink sizes

---

## Expected Impact

| Metric | Before | After |
|--------|--------|-------|
| Items without images | ~15-20% | ~5-10% |
| Manual beverage image assignment | Required | Automatic |
| Size-specific matching | Not available | Automatic |
| Extraction processing time | Baseline | +~50ms (negligible) |

---

## Success Criteria

1. **Beverages auto-matched** - Common drinks (Coke, Sprite, L&P, etc.) get images
2. **Size-aware matching** - 600ml items get bottle images, not cans
3. **No false positives** - Generic items like "Burger" don't get beverage images
4. **Logging works** - Stats show matched vs skipped counts
5. **Performance maintained** - No noticeable extraction slowdown
6. **Audit trail** - Can identify auto-associated images via metadata
