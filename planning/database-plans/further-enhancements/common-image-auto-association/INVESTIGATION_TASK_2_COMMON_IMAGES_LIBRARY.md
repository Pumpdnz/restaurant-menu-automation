# Investigation Task 2: Common Images Library Analysis

## Executive Summary

The **common-images-constants.ts** library is a TypeScript-based configuration and utility system for managing reusable menu item images with intelligent matching/search capabilities. It contains 23 beverage images with two key matching functions: `searchCommonImages()` for UI search and `getSuggestedImages()` for auto-association.

---

## 1. Interface Definitions

### CommonImage Interface (Lines 11-19)

```typescript
export interface CommonImage {
  id: string;                 // Unique identifier (e.g., 'coke-can')
  name: string;               // Display name (e.g., 'Coke Can')
  category: 'beverage' | 'side' | 'condiment';  // Category type
  imageUrl: string;           // Hosted image URL (ucarecdn.com CDN)
  aliases: string[];          // Alternative names for matching
  matchKeywords: string[];    // Keywords for auto-detection
  confidence?: number;        // Auto-match confidence threshold (0-1)
}
```

**Key Characteristics:**
- `confidence` is optional with default of 0.9 (line 374 in `getSuggestedImages()`)
- All 23 beverage images currently have confidence of 0.90-0.95
- Images hosted on ucarecdn.com (Uploadcare CDN)

### CommonImageCategory Interface (Lines 21-26)

```typescript
export interface CommonImageCategory {
  id: string;              // Category ID (beverage, side, condiment)
  label: string;           // Display label (Beverages, Sides, Condiments)
  icon: string;            // Lucide React icon name
  images: CommonImage[];   // Array of images in category
}
```

---

## 2. Matching & Scoring Functions

### Function 1: `searchCommonImages()` (Lines 308-355)

**Purpose:** Interactive UI search for browsing/filtering images
**Returns:** `Array<{ image: CommonImage; score: number }>`

**Matching Algorithm (8 scoring levels):**

| Matching Type | Condition | Score | Example |
|---|---|---|---|
| Exact name | `name.toLowerCase() === query` | 1.0 | Query: "Coke Can" → Coke Can |
| Name contains | `name.includes(query)` | 0.9 | Query: "Coke" → "Coke Can" |
| Exact alias | `aliases.some(a => a === query)` | 0.95 | Query: "Coke" → alias match |
| Alias contains | `aliases.some(a => a.includes(query))` | 0.8 | Query: "Cola" → "Coca Cola" |
| Keyword match | `matchKeywords.some(kw => kw.includes(query))` | 0.7 | Query: "coke zero" → keyword |
| Query contains keyword | `matchKeywords.some(kw => query.includes(kw))` | 0.6 | Query: "zero sugar" → "coke zero" |
| No match | score = 0 | 0 | - |

### Function 2: `getSuggestedImages()` (Lines 361-401) ⭐ RECOMMENDED

**Purpose:** Auto-suggestion for database/backend auto-association
**Returns:** `Array<{ image: CommonImage; confidence: number }>`
**Parameter:** `minConfidence: number = 0.5` (default threshold)

**Matching Algorithm (4 confidence tiers):**

| Matching Type | Condition | Confidence | Example |
|---|---|---|---|
| Exact match | Name or alias exact | baseConfidence (0.90-0.95) | "Coke" → Coke Can |
| Keyword match | Item name includes keyword | baseConfidence × 0.85 | "Coke Zero" item → 0.8075 |
| Name contains | Item name contains image name | baseConfidence × 0.75 | "Diet Coke Can" → 0.7125 |
| Partial keyword | Word > 3 chars in keyword | baseConfidence × 0.60 | "Zero Sugar Coke" → 0.57 |
| Below threshold | confidence < minConfidence | Filtered out | - |

---

## 3. Complete List of Available Common Images

### All 23 Images (Sorted by Category)

#### Coca-Cola Products (4 images):
1. **coke-can** - Coke Can (confidence: 0.95)
2. **coke-zero-can** - Coke Zero Can (confidence: 0.95)
3. **vanilla-coke-can** - Vanilla Coke Can (confidence: 0.95)
4. **vanilla-coke-zero-can** - Vanilla Coke Zero Can (confidence: 0.95)

#### Other Soft Drinks (6 images):
5. **sprite-can** - Sprite Can (confidence: 0.95)
6. **sprite-zero-can** - Sprite Zero Can (confidence: 0.95)
7. **fanta-can** - Fanta Can (confidence: 0.95)
8. **lp-can** - L&P Can (confidence: 0.95)
9. **lift-can** - Lift Can (confidence: 0.95)
10. **sparkling-duet-can** - Sparkling Duet Can (confidence: 0.95)

#### International Brands (4 images):
11. **limca-can** - Limca Lemonade Can (confidence: 0.95)
12. **thumbs-up-can** - Thumbs Up Cola Can (confidence: 0.95)
13. **bundaberg-ginger-beer** - Bundaberg Ginger Beer (confidence: 0.95)
14. **karma-bottles** - Karma Bottles Lineup (confidence: 0.90)

#### Mixers & Premium Beverages (3 images):
15. **schweppes-ginger-beer** - Schweppes Ginger Beer Bottle (confidence: 0.95)
16. **schweppes-lemonade** - Schweppes Lemonade Bottle (confidence: 0.95)
17. **schweppes-llb** - Schweppes Lemon Lime & Bitters (confidence: 0.95)

#### Water Products (2 images):
18. **pump-water** - Pump Water Bottle (confidence: 0.90)
19. **pump-mini-water** - Pump Mini Water Bottle (confidence: 0.90)

#### Coffee/Espresso Products (3 images):
20. **allpress-espresso-long-black** - Allpress Espresso Long Black (confidence: 0.95)
21. **allpress-espresso-latte** - Allpress Espresso Latte (confidence: 0.95)
22. **allpress-espresso-mocha** - Allpress Espresso Mocha (confidence: 0.95)

#### Energy Drinks (1 image):
23. **red-bull-can** - Red Bull Can (confidence: 0.95)

**Empty Categories (Future Expansion):**
- **Sides:** 0 images
- **Condiments:** 0 images

---

## 4. Recommended Confidence Thresholds

### For Database Auto-Association

**Conservative (High Precision):** 0.80+
- Only exact/near-exact matches
- Coke → Coke Can (0.95) ✓
- Diet Coke → Not matched (0.8075, below 0.80) ✗

**Balanced (Recommended):** 0.70+ ⭐
- Catches most relevant matches
- Coke → Coke Can (0.95) ✓
- Diet Coke → Coke Zero Can (0.8075) ✓
- Sprite Zero → Sprite Zero Can (0.8075) ✓

**Aggressive (High Recall):** 0.50+
- Matches even partial keywords
- May produce false positives

**Recommendation:** Use **0.70** for initial auto-association with option to adjust based on testing.

---

## 5. Which Function to Use for Auto-Association

### Recommended: `getSuggestedImages()` ⭐

**Rationale:**
- Designed specifically for auto-suggestion/auto-matching (line 359)
- Uses confidence scoring (not search score)
- Adjusts confidence based on match type (0.60-0.95)
- Has configurable threshold parameter
- Filters automatically by minConfidence

### Comparison Table

| Aspect | getSuggestedImages | searchCommonImages |
|---|---|---|
| Purpose | Auto-association | UI search |
| Return Type | confidence (0-1) | score (0-1) |
| Threshold | Configurable (default 0.5) | None |
| Sorting | By confidence desc | By score desc |
| Use Case | Database auto-fill | User browsing |

---

## 6. TypeScript Integration Requirements

### Language: TypeScript
- **File:** `UberEats-Image-Extractor/src/lib/common-images-constants.ts`
- **Build Tool:** Vite (package.json line 120)
- **TypeScript Version:** 5.9.2 (package.json line 119)

### Current Frontend Usage (Works):
```javascript
// From CommonImagesPopover.jsx
import {
  COMMON_IMAGE_CATEGORIES,
  searchCommonImages,
  getActiveCategories
} from '../../lib/common-images-constants';
```

### Backend Usage (Requires Wrapper):
Since database-service.js is pure JavaScript (CommonJS), you need:

**Option A: Create JS wrapper service (RECOMMENDED)**
```javascript
// common-images-service.js
const { getSuggestedImages } = require('../lib/common-images-constants');
module.exports = { getSuggestedImages };
```

**Option B: Dynamic import in async context**
```javascript
async function loadCommonImages() {
  const lib = await import('../lib/common-images-constants.ts');
  return lib.getSuggestedImages;
}
```

---

## 7. Test Examples

### Example 1: "Coke"
**getSuggestedImages("Coke", 0.7):**
- Coke Can: 0.95 (exact alias match) ✓
- Coke Zero Can: 0.95 (alias match) ✓
- Vanilla Coke Can: 0.95 (alias match) ✓
- Vanilla Coke Zero Can: 0.95 (alias match) ✓

### Example 2: "Diet Coke"
**getSuggestedImages("Diet Coke", 0.7):**
- Coke Zero Can: 0.8075 (keyword "diet coke" match) ✓
- Vanilla Coke Zero Can: 0.8075 (keyword match) ✓

### Example 3: "Sprite Zero"
**getSuggestedImages("Sprite Zero", 0.7):**
- Sprite Zero Can: 0.8075 (keyword match) ✓
- Sprite Can: 0.57 (below threshold) ✗

---

## 8. File Location Reference

**Main Library File:**
- `/Users/giannimunro/Desktop/cursor-projects/automation/UberEats-Image-Extractor/src/lib/common-images-constants.ts`

**Current Component Usage:**
- `/Users/giannimunro/Desktop/cursor-projects/automation/UberEats-Image-Extractor/src/components/menu/CommonImagesPopover.jsx`

**Target Backend File:**
- `/Users/giannimunro/Desktop/cursor-projects/automation/UberEats-Image-Extractor/src/services/database-service.js`
