# Menu Merge Feature - Detailed Implementation Plan

## Executive Summary
Implement a sophisticated menu merging system that allows users to combine multiple menu versions into a single, optimized menu. This feature will help consolidate menus from different extraction attempts, different platforms, or different time periods while maintaining data integrity and allowing granular control over the merge process.

## Table of Contents
1. [Feature Overview](#feature-overview)
2. [User Journey](#user-journey)
3. [Technical Architecture](#technical-architecture)
4. [Duplicate Detection Algorithm](#duplicate-detection-algorithm)
5. [UI/UX Design Specifications](#uiux-design-specifications)
6. [Backend Implementation](#backend-implementation)
7. [Database Schema Updates](#database-schema-updates)
8. [API Endpoints](#api-endpoints)
9. [Frontend Components](#frontend-components)
10. [Data Flow](#data-flow)
11. [Edge Cases & Error Handling](#edge-cases--error-handling)
12. [Testing Strategy](#testing-strategy)
13. [Performance Considerations](#performance-considerations)
14. [Implementation Phases](#implementation-phases)

## Feature Overview

### Primary Goals
- Combine multiple menu versions into a single, authoritative menu
- Intelligently detect and handle duplicate items
- Allow granular control over which data to keep from each source
- Maintain audit trail of merge operations
- Support undo/redo during merge process

### Key Capabilities
1. **Multi-menu selection**: Select 2+ menus from the same or different platforms
2. **Intelligent duplicate detection**: Identify similar items across menus
3. **Side-by-side comparison**: Visual comparison of menu contents
4. **Granular merge control**: Choose specific fields from each source
5. **Preview before save**: Review merged menu before committing
6. **Merge history**: Track what was merged and when

## User Journey

### Step 1: Menu Selection
```
User Flow:
1. Navigate to Menus page
2. Select 2 or more menus using checkboxes
3. Click "Merge Menus" button
4. System validates selection (same restaurant, compatible formats)
```

### Step 2: Merge Interface
```
User Flow:
1. Redirected to /menus/merge with selected menu IDs
2. See side-by-side menu comparison
3. Review automatic duplicate detection
4. Make merge decisions
```

### Step 3: Item Selection & Conflict Resolution
```
User Flow:
1. For unique items: Toggle include/exclude
2. For duplicate items: Choose preferred version or merge fields
3. Adjust categories and ordering
4. Preview final menu structure
```

### Step 4: Save & Confirm
```
User Flow:
1. Review merge summary
2. Name the new menu version
3. Confirm merge
4. Return to menus list with new merged menu
```

## Technical Architecture

### System Components
```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Menus Page    │────▶│  Merge Interface │────▶│  Preview/Save   │
│  (Selection)    │     │  (Comparison)    │     │   (Confirm)     │
└─────────────────┘     └──────────────────┘     └─────────────────┘
         │                       │                         │
         ▼                       ▼                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                         API Layer                                │
│  - /api/menus/merge/validate                                    │
│  - /api/menus/merge/compare                                     │
│  - /api/menus/merge/execute                                     │
└─────────────────────────────────────────────────────────────────┘
         │                       │                         │
         ▼                       ▼                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Database Layer                              │
│  - Duplicate detection queries                                   │
│  - Menu creation with relationships                              │
│  - Merge history tracking                                        │
└─────────────────────────────────────────────────────────────────┘
```

## Duplicate Detection Algorithm

### Similarity Scoring System
```javascript
// Duplicate detection algorithm
function calculateSimilarity(item1, item2) {
  const scores = {
    name: 0,
    description: 0,
    price: 0,
    category: 0
  };
  
  // Name similarity (40% weight)
  scores.name = fuzzyMatch(item1.name, item2.name) * 0.4;
  
  // Description similarity (30% weight)
  scores.description = fuzzyMatch(item1.description, item2.description) * 0.3;
  
  // Price similarity (20% weight)
  const priceDiff = Math.abs(item1.price - item2.price);
  scores.price = (1 - (priceDiff / Math.max(item1.price, item2.price))) * 0.2;
  
  // Category match (10% weight)
  scores.category = (item1.category === item2.category ? 1 : 0) * 0.1;
  
  return Object.values(scores).reduce((a, b) => a + b, 0);
}

// Thresholds
const DUPLICATE_THRESHOLD = 0.85;  // 85% similarity = definite duplicate
const POSSIBLE_THRESHOLD = 0.65;   // 65% similarity = possible duplicate
```

### Matching Strategies
1. **Exact Match**: Name + Price identical
2. **Fuzzy Match**: Levenshtein distance < 3 for names
3. **Semantic Match**: Similar descriptions with different wording
4. **Price Range Match**: Within 10% price difference
5. **Category Context**: Same category increases match confidence

## UI/UX Design Specifications

### Merge Interface Layout
```
┌──────────────────────────────────────────────────────────────┐
│  Merge Menus: Base Pizza (2 menus selected)         [Cancel] │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────────┬─────────────────┬──────────────────┐   │
│  │   Menu 1 (v1)   │   Menu 2 (v2)   │   Merged Menu    │   │
│  │   UberEats      │   DoorDash      │   (Preview)      │   │
│  │   37 items      │   41 items      │   45 items       │   │
│  └─────────────────┴─────────────────┴──────────────────┘   │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ Category: Large Pizzas                               │    │
│  ├──────────────────────────────────────────────────────┤    │
│  │                                                       │    │
│  │  ┌─ Duplicate Detected ─────────────────────────┐    │    │
│  │  │                                               │    │    │
│  │  │  [✓] Margherita Pizza                        │    │    │
│  │  │      Menu 1: $25.00 | Menu 2: $26.00         │    │    │
│  │  │                                               │    │    │
│  │  │  Choose version:                             │    │    │
│  │  │  ○ Use Menu 1 version (Complete)             │    │    │
│  │  │  ○ Use Menu 2 version (Complete)             │    │    │
│  │  │  ● Custom merge:                             │    │    │
│  │  │     Name: [Menu 2 ▼] "Margherita Pizza"      │    │    │
│  │  │     Price: [Menu 1 ▼] $25.00                 │    │    │
│  │  │     Desc: [Menu 2 ▼] "Fresh mozzarella..."   │    │    │
│  │  │     Image: [Menu 1 ▼] [Image preview]        │    │    │
│  │  │     Tags: [✓] Vegetarian [✓] Popular         │    │    │
│  │  └───────────────────────────────────────────────┘    │    │
│  │                                                       │    │
│  │  ┌─ Unique to Menu 1 ───────────────────────────┐    │    │
│  │  │  [✓] Special Pizza - $28.00                   │    │    │
│  │  └───────────────────────────────────────────────┘    │    │
│  │                                                       │    │
│  │  ┌─ Unique to Menu 2 ───────────────────────────┐    │    │
│  │  │  [✓] New Creation - $30.00                    │    │    │
│  │  └───────────────────────────────────────────────┘    │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                               │
│  Actions: [Select All] [Deselect All] [Auto-Resolve]         │
│                                                               │
│  ────────────────────────────────────────────────────────    │
│                                                               │
│  Merge Summary:                                              │
│  • 15 duplicate items resolved                               │
│  • 22 unique items from Menu 1                               │
│  • 8 unique items from Menu 2                                │
│  • Total items in merged menu: 45                            │
│                                                               │
│  [Preview Full Menu]              [Save as New Menu Version] │
└──────────────────────────────────────────────────────────────┘
```

### Component Interactions
1. **Checkbox Selection**: Include/exclude items
2. **Dropdown Selectors**: Choose source for each field
3. **Preview Panel**: Live update of merged menu
4. **Conflict Indicators**: Visual cues for duplicates
5. **Progress Tracker**: Show merge completion status

## Backend Implementation

### Core Services

#### 1. MenuMergeService
```typescript
class MenuMergeService {
  // Main merge orchestration
  async mergeMenus(menuIds: string[], options: MergeOptions): Promise<MergedMenu> {
    // 1. Load all menus with items
    const menus = await this.loadMenusWithItems(menuIds);
    
    // 2. Detect duplicates across menus
    const duplicateGroups = await this.detectDuplicates(menus);
    
    // 3. Apply merge rules
    const mergedItems = await this.applyMergeRules(duplicateGroups, options);
    
    // 4. Create new menu
    return await this.createMergedMenu(mergedItems, options);
  }
  
  // Duplicate detection
  async detectDuplicates(menus: Menu[]): Promise<DuplicateGroup[]> {
    const allItems = menus.flatMap(m => m.items);
    const groups = [];
    
    for (let i = 0; i < allItems.length; i++) {
      for (let j = i + 1; j < allItems.length; j++) {
        const similarity = this.calculateSimilarity(allItems[i], allItems[j]);
        if (similarity > DUPLICATE_THRESHOLD) {
          groups.push({
            items: [allItems[i], allItems[j]],
            similarity,
            suggestedResolution: this.suggestResolution(allItems[i], allItems[j])
          });
        }
      }
    }
    
    return this.consolidateGroups(groups);
  }
  
  // Resolution suggestion
  suggestResolution(item1: MenuItem, item2: MenuItem): Resolution {
    // Prefer item with:
    // 1. More complete data (description, image)
    // 2. More recent update
    // 3. Lower price (customer-friendly)
    // 4. More tags/metadata
    
    const score1 = this.scoreCompleteness(item1);
    const score2 = this.scoreCompleteness(item2);
    
    return {
      recommended: score1 > score2 ? 'item1' : 'item2',
      reason: this.getReasonText(score1, score2),
      confidence: Math.abs(score1 - score2)
    };
  }
}
```

#### 2. MergeValidationService
```typescript
class MergeValidationService {
  validateMergeRequest(menuIds: string[]): ValidationResult {
    // Check:
    // - Minimum 2 menus
    // - Maximum 5 menus (performance)
    // - Same restaurant
    // - User has permission
    // - Menus exist and have items
  }
  
  validateMergeOptions(options: MergeOptions): ValidationResult {
    // Check:
    // - Valid resolution strategies
    // - Category mappings
    // - Name conflicts
  }
}
```

#### 3. MergeHistoryService
```typescript
class MergeHistoryService {
  async recordMerge(merge: MergeOperation): Promise<void> {
    // Store:
    // - Source menu IDs
    // - Merge decisions/rules
    // - User who performed merge
    // - Timestamp
    // - Result menu ID
  }
  
  async getMergeHistory(menuId: string): Promise<MergeHistory[]> {
    // Retrieve merge history for audit trail
  }
}
```

## Database Schema Updates

### New Tables

#### merge_operations
```sql
CREATE TABLE merge_operations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID REFERENCES restaurants(id),
  source_menu_ids UUID[],
  result_menu_id UUID REFERENCES menus(id),
  merge_config JSONB, -- Stores merge decisions
  performed_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### merge_decisions
```sql
CREATE TABLE merge_decisions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  merge_operation_id UUID REFERENCES merge_operations(id),
  item_group_id VARCHAR(255), -- Groups duplicate items
  decision_type VARCHAR(50), -- 'keep_menu1', 'keep_menu2', 'custom'
  custom_selection JSONB, -- Field-level selections
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Updates to Existing Tables

#### menus table
```sql
ALTER TABLE menus ADD COLUMN IF NOT EXISTS 
  merge_source_ids UUID[], -- Track source menus if merged
  is_merged BOOLEAN DEFAULT FALSE;
```

## API Endpoints

### 1. POST /api/menus/merge/validate
```typescript
// Request
{
  menuIds: string[],
  restaurantId: string
}

// Response
{
  valid: boolean,
  errors: string[],
  warnings: string[],
  menuDetails: {
    id: string,
    name: string,
    itemCount: number,
    platform: string,
    version: number
  }[]
}
```

### 2. POST /api/menus/merge/compare
```typescript
// Request
{
  menuIds: string[]
}

// Response
{
  comparison: {
    duplicateGroups: [
      {
        groupId: string,
        items: MenuItem[],
        similarity: number,
        suggestedResolution: {
          recommended: 'item1' | 'item2' | 'custom',
          reason: string
        }
      }
    ],
    uniqueItems: {
      [menuId: string]: MenuItem[]
    },
    categories: {
      all: string[],
      byMenu: { [menuId: string]: string[] }
    }
  },
  statistics: {
    totalItems: number,
    duplicates: number,
    unique: number,
    byMenu: { [menuId: string]: {...} }
  }
}
```

### 3. POST /api/menus/merge/preview
```typescript
// Request
{
  menuIds: string[],
  decisions: {
    [groupId: string]: {
      action: 'keep_menu1' | 'keep_menu2' | 'custom' | 'exclude',
      customFields?: {
        name?: { source: string, value: string },
        price?: { source: string, value: number },
        description?: { source: string, value: string },
        image?: { source: string, value: string },
        tags?: string[]
      }
    }
  },
  includeUnique: {
    [menuId: string]: string[] // item IDs to include
  }
}

// Response
{
  preview: {
    menu: {
      name: string,
      itemCount: number,
      categories: Category[],
      items: MenuItem[]
    },
    changes: {
      added: number,
      modified: number,
      excluded: number
    }
  }
}
```

### 4. POST /api/menus/merge/execute
```typescript
// Request
{
  menuIds: string[],
  decisions: MergeDecisions,
  menuName?: string,
  version?: number
}

// Response
{
  success: boolean,
  menuId: string,
  statistics: {
    itemsCreated: number,
    duplicatesResolved: number,
    executionTime: number
  }
}
```

## Frontend Components

### 1. MergeMenusButton Component
```jsx
// Location: src/components/MergeMenusButton.jsx
<MergeMenusButton 
  selectedMenus={selectedMenus}
  onMerge={handleMerge}
  disabled={selectedMenus.size < 2}
/>
```

### 2. MenuMergeInterface Component
```jsx
// Location: src/pages/MenuMerge.jsx
<MenuMergeInterface
  menuIds={menuIds}
  comparison={comparisonData}
  onDecisionChange={handleDecisionChange}
  onSave={handleSaveMerge}
/>
```

### 3. DuplicateItemResolver Component
```jsx
// Location: src/components/merge/DuplicateItemResolver.jsx
<DuplicateItemResolver
  duplicateGroup={group}
  decision={currentDecision}
  onChange={handleResolutionChange}
/>
```

### 4. MergePreview Component
```jsx
// Location: src/components/merge/MergePreview.jsx
<MergePreview
  mergedMenu={previewData}
  statistics={mergeStats}
  onConfirm={handleConfirm}
/>
```

### 5. FieldSelector Component
```jsx
// Location: src/components/merge/FieldSelector.jsx
<FieldSelector
  field="price"
  options={[
    { source: 'menu1', value: '$25.00', label: 'Menu 1' },
    { source: 'menu2', value: '$26.00', label: 'Menu 2' }
  ]}
  selected={selectedSource}
  onChange={handleFieldChange}
/>
```

## Data Flow

### Merge Process Flow
```
1. User Selection
   └─> Menu IDs collected
   
2. Validation Request
   └─> Check compatibility
       └─> Same restaurant?
       └─> Valid menus?
       └─> User permission?
   
3. Comparison Generation
   └─> Load all menu items
       └─> Run duplicate detection
           └─> Group similar items
           └─> Calculate similarities
           └─> Generate suggestions
   
4. User Decisions
   └─> For each duplicate group:
       └─> Select resolution strategy
           └─> Keep Menu 1
           └─> Keep Menu 2
           └─> Custom merge
           └─> Exclude both
   
5. Preview Generation
   └─> Apply decisions
       └─> Build merged menu structure
       └─> Calculate statistics
   
6. Execution
   └─> Create new menu record
       └─> Insert merged items
       └─> Record merge history
       └─> Update relationships
```

## Edge Cases & Error Handling

### Edge Cases
1. **Empty menus**: One or more menus have no items
2. **Circular merges**: Merging already-merged menus
3. **Large menus**: Performance with 500+ items per menu
4. **Multiple platforms**: Merging UberEats + DoorDash menus
5. **Price conflicts**: Same item, vastly different prices
6. **Category mismatches**: Different category structures
7. **Image conflicts**: Multiple images for same item
8. **Language differences**: Menus in different languages

### Error Handling
```typescript
class MergeErrorHandler {
  handleError(error: MergeError): ErrorResponse {
    switch (error.type) {
      case 'VALIDATION_ERROR':
        return { status: 400, message: 'Invalid merge request', details: error.details };
      
      case 'PERMISSION_ERROR':
        return { status: 403, message: 'Not authorized to merge these menus' };
      
      case 'CONFLICT_ERROR':
        return { status: 409, message: 'Merge conflicts require resolution', conflicts: error.conflicts };
      
      case 'SIZE_LIMIT_ERROR':
        return { status: 413, message: 'Menu too large to merge (>1000 items)' };
      
      case 'PROCESSING_ERROR':
        return { status: 500, message: 'Failed to process merge', error: error.message };
      
      default:
        return { status: 500, message: 'Unknown error occurred' };
    }
  }
}
```

## Testing Strategy

### Unit Tests
```typescript
describe('MenuMergeService', () => {
  describe('detectDuplicates', () => {
    it('should detect exact name matches');
    it('should detect fuzzy name matches');
    it('should detect price-similar items');
    it('should group multiple duplicates correctly');
    it('should handle empty menus');
  });
  
  describe('applyMergeRules', () => {
    it('should keep menu1 version when specified');
    it('should apply custom field selections');
    it('should exclude items when requested');
    it('should maintain category structure');
  });
});
```

### Integration Tests
```typescript
describe('Menu Merge API', () => {
  it('should validate merge request');
  it('should generate accurate comparison');
  it('should create preview correctly');
  it('should execute merge and create new menu');
  it('should record merge history');
  it('should handle concurrent merges');
});
```

### E2E Tests
```typescript
describe('Menu Merge Flow', () => {
  it('should complete full merge workflow');
  it('should handle duplicate resolution');
  it('should preview before saving');
  it('should show merge in menu list');
  it('should maintain data integrity');
});
```

## Performance Considerations

### Optimization Strategies
1. **Batch Processing**: Process items in chunks of 100
2. **Caching**: Cache similarity calculations
3. **Indexing**: Add database indexes for similarity queries
4. **Pagination**: Paginate large menu comparisons
5. **Background Jobs**: Process large merges asynchronously
6. **Memoization**: Cache duplicate detection results

### Performance Targets
- Duplicate detection: <2s for 200 items
- Comparison generation: <3s for 500 items
- Preview generation: <1s
- Merge execution: <5s for 500 items
- UI responsiveness: <100ms for user actions

### Database Optimizations
```sql
-- Indexes for performance
CREATE INDEX idx_menu_items_menu_id ON menu_items(menu_id);
CREATE INDEX idx_menu_items_name_gin ON menu_items USING gin(name gin_trgm_ops);
CREATE INDEX idx_merge_operations_restaurant ON merge_operations(restaurant_id);

-- Materialized view for quick lookups
CREATE MATERIALIZED VIEW menu_item_similarities AS
SELECT 
  mi1.id as item1_id,
  mi2.id as item2_id,
  similarity(mi1.name, mi2.name) as name_similarity
FROM menu_items mi1
CROSS JOIN menu_items mi2
WHERE mi1.id < mi2.id
  AND similarity(mi1.name, mi2.name) > 0.5;
```

## Implementation Phases

### Phase 1: Basic Merge (Week 1-2)
- [ ] Database schema updates
- [ ] Basic duplicate detection (exact match only)
- [ ] Simple merge API (keep all items)
- [ ] Basic UI for menu selection
- [ ] Create merged menu in database

### Phase 2: Smart Duplicate Detection (Week 3-4)
- [ ] Fuzzy matching algorithm
- [ ] Similarity scoring system
- [ ] Duplicate grouping logic
- [ ] Resolution suggestions
- [ ] Comparison API endpoint

### Phase 3: Advanced UI (Week 5-6)
- [ ] Side-by-side comparison view
- [ ] Duplicate resolver component
- [ ] Field-level selection UI
- [ ] Preview functionality
- [ ] Progress indicators

### Phase 4: Custom Merge Logic (Week 7-8)
- [ ] Custom field selection
- [ ] Category management
- [ ] Tag merging
- [ ] Image selection
- [ ] Price resolution strategies

### Phase 5: Polish & Optimization (Week 9-10)
- [ ] Performance optimization
- [ ] Error handling
- [ ] Merge history tracking
- [ ] Undo/redo functionality
- [ ] Bulk operations

### Phase 6: Testing & Documentation (Week 11-12)
- [ ] Comprehensive testing
- [ ] User documentation
- [ ] API documentation
- [ ] Performance testing
- [ ] Bug fixes and refinements

## Success Metrics
1. **Accuracy**: >95% correct duplicate detection
2. **Performance**: <5s for typical merge operation
3. **User Satisfaction**: >90% successful merges without support
4. **Data Integrity**: 0% data loss during merge
5. **Adoption**: >50% of users with multiple menus use merge feature

## Future Enhancements
1. **AI-Powered Suggestions**: Use ML for better duplicate detection
2. **Merge Templates**: Save merge rules for reuse
3. **Scheduled Merges**: Auto-merge on new extractions
4. **Conflict Learning**: Learn from user decisions
5. **Multi-Restaurant Merge**: Merge menus across restaurant chains
6. **API Integration**: Allow external systems to trigger merges
7. **Merge Analytics**: Track merge patterns and optimize
8. **Version Control**: Full git-like branching and merging

## Conclusion
The menu merge feature represents a significant enhancement to the menu management system, providing users with powerful tools to consolidate and optimize their menu data. With careful implementation following this plan, we can deliver a robust, user-friendly solution that handles complex merge scenarios while maintaining data integrity and system performance.