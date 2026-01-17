# Investigation Task 3: Common Menu Item Images Library

## Executive Summary

This investigation covers creating a reusable library of common product images (e.g., Coca Cola, fries, condiments) with extensibility for automatic image association. The design follows existing patterns from `item-tags-constants.ts` and `PresetTagsPopover.jsx`.

---

## 1. Existing Pattern Analysis

### item-tags-constants.ts Structure

**Key Patterns:**
- TypeScript interfaces for type safety
- Categorical organization (dietary, popular, deals)
- Configuration objects with metadata (label, icon, items)
- Utility functions for lookups and searches
- Map-based O(1) lookups

### PresetTagsPopover.jsx UI Pattern

**Key Features:**
- Trigger button with icon + label + badge
- Popover container (340px width, 500px max height)
- Category sections with headers
- Flex wrap grid layout
- Toggle-based selection
- Visual feedback (opacity, ring on selection)

---

## 2. Proposed Constants File Structure

**File:** `UberEats-Image-Extractor/src/lib/common-images-constants.ts`

```typescript
// ============================================
// INTERFACES
// ============================================

export interface CommonImage {
  id: string;                      // e.g., "coca-cola"
  name: string;                    // e.g., "Coca Cola"
  category: 'beverage' | 'side' | 'condiment' | 'bread' | 'hot-drink';
  description?: string;
  imageUrl: string;                // URL to hosted image
  aliases: string[];               // Alternative names for matching
  matchKeywords: string[];         // Keywords for auto-detection
  confidence?: number;             // Auto-match threshold (0-1)
}

export interface CommonImageCategory {
  id: string;
  label: string;
  description?: string;
  icon: string;                    // lucide-react icon name
  images: CommonImage[];
}

// ============================================
// BEVERAGE IMAGES
// ============================================

export const BEVERAGE_IMAGES: CommonImage[] = [
  {
    id: 'coca-cola',
    name: 'Coca Cola',
    category: 'beverage',
    imageUrl: 'https://cdn.example.com/beverages/coca-cola.png',
    aliases: ['Coke', 'Coca-Cola', 'Coca Cola Classic'],
    matchKeywords: ['coca cola', 'coke', 'coca-cola'],
    confidence: 0.95
  },
  {
    id: 'diet-coke',
    name: 'Diet Coke',
    category: 'beverage',
    imageUrl: 'https://cdn.example.com/beverages/diet-coke.png',
    aliases: ['Diet Cola', 'Coke Diet', 'Coke Zero'],
    matchKeywords: ['diet coke', 'diet cola', 'coke zero'],
    confidence: 0.95
  },
  // ... more beverages
];

// ============================================
// CATEGORY ORGANIZATION
// ============================================

export const COMMON_IMAGE_CATEGORIES: Record<string, CommonImageCategory> = {
  beverage: {
    id: 'beverage',
    label: 'Beverages',
    icon: 'Glasses',
    images: BEVERAGE_IMAGES
  },
  side: {
    id: 'side',
    label: 'Sides',
    icon: 'UtensilsCrossed',
    images: SIDE_IMAGES
  },
  condiment: {
    id: 'condiment',
    label: 'Condiments',
    icon: 'Droplet',
    images: CONDIMENT_IMAGES
  }
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

export function getCommonImage(imageId: string): CommonImage | null;
export function searchCommonImages(query: string, limit?: number): Array<{ image: CommonImage; score: number }>;
export function getSuggestedImages(itemName: string): Array<{ image: CommonImage; confidence: number }>;
```

---

## 3. Initial Library Contents (40+ Items)

### Beverages - Soft Drinks (12 items)
1. Coca Cola / Coke
2. Diet Coke / Coke Zero
3. Sprite
4. Fanta Orange
5. Fanta Grape
6. Pepsi
7. Diet Pepsi
8. 7UP / Lemonade
9. Ginger Ale
10. Orange Juice
11. Apple Juice
12. Lemonade

### Hot Beverages (8 items)
13. Black Coffee / Espresso
14. Cappuccino
15. Flat White / Latte
16. Iced Coffee
17. Hot Tea
18. Green Tea
19. Iced Tea
20. Hot Chocolate

### Sides (10 items)
21. French Fries / Chips / Hot Chips
22. Onion Rings
23. Coleslaw
24. Garlic Bread
25. Garden Salad
26. Caesar Salad
27. Mashed Potatoes
28. Corn on the Cob
29. Grilled Vegetables
30. Fried Rice

### Condiments (8 items)
31. Ketchup / Tomato Sauce
32. Mayonnaise
33. Mustard
34. Soy Sauce
35. Chili Sauce
36. BBQ Sauce
37. Gravy
38. Tartar Sauce

### Breads (2 items)
39. White Bread
40. Naan Bread

---

## 4. UI Component Design: CommonImagesPopover.jsx

**Location:** `UberEats-Image-Extractor/src/components/menu/CommonImagesPopover.jsx`

```jsx
export default function CommonImagesPopover({
  onSelectImage,           // (imageUrl, imageName) => void
  selectedImageUrl = null,
  className
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('beverage');

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <ImageIcon className="h-3.5 w-3.5" />
          Select Common Image
          <ChevronDown className="h-3.5 w-3.5 ml-1" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[400px] p-3 max-h-[600px]">
        {/* Search Input */}
        <Input placeholder="Search (e.g., 'Coke', 'Fries')" />

        {/* Category Tabs */}
        <div className="flex gap-1 overflow-x-auto">
          {categories.map(([key, category]) => (
            <button className="px-3 py-1.5 rounded-full text-xs">
              {category.label}
            </button>
          ))}
        </div>

        {/* Image Grid (3 columns) */}
        <div className="grid grid-cols-3 gap-2">
          {filteredImages.map((image) => (
            <button
              onClick={() => onSelectImage(image.imageUrl, image.name)}
              className="p-2 rounded-lg border-2 hover:border-primary"
            >
              <img src={image.imageUrl} className="w-full h-24 object-cover" />
              <p className="text-xs mt-1">{image.name}</p>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
```

**Key Features:**
- Search input at top
- Category tabs for browsing
- 3-column grid of thumbnails
- Visual feedback on hover/selection
- Check mark for selected image

---

## 5. Auto-Association Algorithm Design

### Matching Logic

```typescript
function getSuggestedImages(itemName: string): Array<{ image: CommonImage; confidence: number }> {
  const normalized = itemName.toLowerCase();
  const suggestions = [];

  for (const image of ALL_COMMON_IMAGES) {
    let confidence = 0;

    // EXACT MATCH (0.95+)
    if (image.name.toLowerCase() === normalized ||
        image.aliases.some(a => a.toLowerCase() === normalized)) {
      confidence = image.confidence ?? 0.95;
    }
    // KEYWORD MATCH (0.70-0.90)
    else if (image.matchKeywords.some(kw => normalized.includes(kw))) {
      confidence = (image.confidence ?? 0.9) * 0.8;
    }
    // PARTIAL MATCH (0.40-0.70)
    else if (image.matchKeywords.some(kw => kw.includes(normalized))) {
      confidence = (image.confidence ?? 0.9) * 0.5;
    }

    if (confidence > 0.5) {
      suggestions.push({ image, confidence });
    }
  }

  return suggestions.sort((a, b) => b.confidence - a.confidence);
}
```

### Example Matching Scenarios

| Item Name | Matched Image | Confidence |
|-----------|---------------|------------|
| "Coca Cola" | Coca Cola | 0.95 (exact) |
| "Coke" | Coca Cola | 0.95 (alias) |
| "French Fries" | French Fries | 0.95 (exact) |
| "Hot Chips" | French Fries | 0.95 (alias) |
| "Sprite Lemonade" | Sprite | 0.76 (keyword) |
| "Tomato Sauce" | Ketchup | 0.95 (alias) |

---

## 6. Integration with EditableMenuItem.jsx

### Import Section
```javascript
import CommonImagesPopover from './CommonImagesPopover';
import { getSuggestedImages } from '../../lib/common-images-constants';
```

### Button Placement (after image section, before tags)
```jsx
<div className="mt-3 pt-3 border-t">
  <CommonImagesPopover
    onSelectImage={(imageUrl, imageName) => {
      handleFieldChange('imageURL', imageUrl);
    }}
    selectedImageUrl={editedItem.imageURL}
  />
</div>
```

### Auto-Suggestion on Name Change (Optional Enhancement)
```javascript
// In handleFieldChange('name', value)
const suggestions = getSuggestedImages(value);
if (suggestions.length > 0 && !editedItem.imageURL) {
  // Show indicator that auto-suggestions available
}
```

---

## 7. Extensibility Considerations

### Phase 1: Initial Implementation
- Manual library creation (40 items)
- Basic search function
- Manual selection UI

### Phase 2: Quick Expansion
- Add more brands (Pepsi, energy drinks)
- International cuisine staples
- Desserts and specialty items

### Phase 3: Smart Features
- Restaurant-specific overrides
- Usage analytics tracking
- Auto-apply during menu import

### Phase 4: Advanced Features
- Custom image upload per restaurant
- ML-based image recognition
- Visual similarity matching

### Database Considerations (Future)
```sql
CREATE TABLE common_menu_images (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  image_url TEXT NOT NULL,
  aliases JSONB DEFAULT '[]',
  match_keywords JSONB DEFAULT '[]',
  confidence NUMERIC DEFAULT 0.9,
  is_custom BOOLEAN DEFAULT false,
  created_by_org UUID REFERENCES organisations(id),
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 8. Image Hosting Recommendations

### Option 1: Supabase Storage (Recommended)
- Aligned with existing infrastructure
- Easy to manage
- Public bucket for images

### Option 2: External CDN
- Cloudflare, imgix for performance
- Better caching
- Higher cost

### Option 3: Local Assets
- Bundle with application
- Works offline
- Increases bundle size

---

## 9. Implementation Estimate

| Phase | Scope | Effort |
|-------|-------|--------|
| Phase 1 | Constants file + UI component | 4-6 hours |
| Phase 2 | Search + auto-suggestion | 2-3 hours |
| Phase 3 | Analytics + admin UI | 8-12 hours |

**Total MVP:** 6-9 hours
**Risk:** Low-Medium (new component, but follows existing patterns)

---

## 10. Testing Considerations

### Unit Tests
- `searchCommonImages()` with various queries
- `getSuggestedImages()` with menu item names
- `getCommonImage()` lookup accuracy

### Integration Tests
- Component renders correctly
- Selection callback fires
- Image preview loads
- Search updates results

### User Testing
- Can users find images easily?
- Is search intuitive?
- Do suggestions help or distract?
