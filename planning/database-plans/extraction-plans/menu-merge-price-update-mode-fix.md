# Menu Merge Price Update Mode Fix - Implementation Plan

## Executive Summary
This document outlines the comprehensive plan to fix the Price Update mode in the Menu Merge feature. The current issue is that when users select "Price Update" mode, the UI continues to show the full merge decision interface instead of a price-mapping specific interface. This fix will implement a new UI component and update the backend to handle in-place menu updates rather than creating new menus.

## Problem Statement

### Current Behavior (BUG)
1. User selects "Price Update" mode in MenuMerge.jsx
2. Backend correctly returns price-specific comparison data
3. Frontend ignores the merge mode and renders duplicate detection UI
4. Users cannot properly update prices from one menu to another

### Expected Behavior
1. User selects "Price Update" mode
2. UI shows price mapping interface between Menu 1 (base) and Menu 2 (price source)
3. Users can adjust mappings, confirm price updates, and handle unmatched items
4. Backend updates Menu 1 in-place with new prices and optionally adds Menu 2 items

## Technical Analysis

### Current Data Flow
```
Frontend (MenuMerge.jsx)
    ↓ [mergeMode: 'price-only']
Server.js (/api/menus/merge/compare)
    ↓
menu-merge-service.js (compareMenus)
    ↓ [checks mergeMode]
    → comparePriceUpdate() [returns different structure]
    ↓
Returns: {
    comparison: {
        mode: 'price-only',
        priceMatches: [...],
        unmatchedBase: [...],
        unmatchedPrice: [...],
        statistics: {...}
    }
}
    ↓
Frontend receives data but renders wrong UI
```

### Root Cause
The frontend component (MenuMerge.jsx) doesn't conditionally render based on the merge mode. Lines 455-718 always expect and render `comparison.comparison.duplicateGroups` which is undefined in price-only mode.

## Solution Architecture

### Frontend Changes

#### 1. New Price Update UI Component
Create a new component section within MenuMerge.jsx that renders when `mergeMode === 'price-only'`:

```jsx
// Structure for price update state
const [priceUpdateDecisions, setPriceUpdateDecisions] = useState({
  matches: {},      // { menu1ItemId: { menu2ItemId, confirmed: bool } }
  keepUnmatched: {  // Which unmatched items to include
    menu1: [],      // Array of menu1 item IDs to keep
    menu2: []       // Array of menu2 item IDs to add
  },
  manualPrices: {}, // { menu1ItemId: customPrice }
  newCategories: {} // { menu2ItemId: categoryName }
});
```

#### 2. UI Layout Structure

##### Section 1: Matched Items
```
┌─────────────────────────────────────────────────────────────────┐
│ Matched Items (38)                                              │
├─────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Menu 1 (UberEats)           →  Menu 2 (FoodHub)             │ │
│ │ ┌──────────────────┐          ┌──────────────────┐         │ │
│ │ │ 4pcs Chicken Satay│          │ Chicken Satay 4pc │         │ │
│ │ │ $12.50           │  ----->   │ $10.00           │         │ │
│ │ │ [image]          │          │ -$2.50 (-20%)     │         │ │
│ │ └──────────────────┘          └──────────────────┘         │ │
│ │                    [✓ Confirm] [Change Match] [Remove]      │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

##### Section 2: Unmatched Menu 1 Items
```
┌─────────────────────────────────────────────────────────────────┐
│ Unmatched Items - Menu 1 (15)                                   │
├─────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ □ Keep   Beef Rendang         $18.00                        │ │
│ │          [Select Match ▼]  or  [Enter Manual Price: ____]   │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

##### Section 3: Unmatched Menu 2 Items
```
┌─────────────────────────────────────────────────────────────────┐
│ Available Price Items - Menu 2 (29)                             │
├─────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ □ Add    Special Fried Rice   $12.00                        │ │
│ │          Category: [Main Dishes ▼]                          │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

#### 3. Interactive Features

##### Search/Filter Component
```jsx
<div className="search-filter-bar">
  <Input
    placeholder="Search Menu 2 items..."
    onChange={handleSearch}
  />
  <Select>
    <option value="all">All Items</option>
    <option value="matched">Matched Only</option>
    <option value="unmatched">Unmatched Only</option>
    <option value="confirmed">Confirmed Only</option>
  </Select>
</div>
```

##### Manual Match Dialog
```jsx
<Dialog open={showMatchDialog}>
  <DialogContent>
    <DialogTitle>Select Match for "{selectedMenu1Item.name}"</DialogTitle>
    <Input placeholder="Search Menu 2 items..." />
    <div className="item-list">
      {filteredMenu2Items.map(item => (
        <div onClick={() => createMatch(selectedMenu1Item.id, item.id)}>
          {item.name} - ${item.price}
        </div>
      ))}
    </div>
  </DialogContent>
</Dialog>
```

### Backend Changes

#### 1. Update executeMerge Method (menu-merge-service.js)

```javascript
async executeMerge(menuIds, decisions, includeUnique = {}, mergeMode = 'full', menuName, performedBy = null) {
  if (mergeMode === 'price-only') {
    return this.executePriceUpdate(menuIds, decisions, includeUnique, performedBy);
  }
  // Existing full merge logic...
}

async executePriceUpdate(menuIds, priceUpdateDecisions, includeUnmatched, performedBy = null) {
  const [baseMenuId, priceMenuId] = menuIds;

  // 1. Update prices for matched items in-place
  for (const [menu1ItemId, matchData] of Object.entries(priceUpdateDecisions.matches)) {
    if (matchData.confirmed) {
      // Get price from Menu 2 item
      const { data: menu2Item } = await this.supabase
        .from('menu_items')
        .select('price')
        .eq('id', matchData.menu2ItemId)
        .single();

      // Update Menu 1 item price
      await this.supabase
        .from('menu_items')
        .update({
          price: matchData.manualPrice || menu2Item.price,
          updated_at: new Date().toISOString()
        })
        .eq('id', menu1ItemId);
    }
  }

  // 2. Handle manual prices for unmatched Menu 1 items
  for (const [itemId, manualPrice] of Object.entries(priceUpdateDecisions.manualPrices)) {
    await this.supabase
      .from('menu_items')
      .update({
        price: manualPrice,
        updated_at: new Date().toISOString()
      })
      .eq('id', itemId);
  }

  // 3. Add selected Menu 2 items to Menu 1
  for (const menu2ItemId of includeUnmatched.menu2) {
    // Get full item data
    const { data: item } = await this.supabase
      .from('menu_items')
      .select('*, categories(name)')
      .eq('id', menu2ItemId)
      .single();

    // Get or create category in Menu 1
    const categoryName = priceUpdateDecisions.newCategories[menu2ItemId] || item.categories.name;
    let categoryId = await this.getOrCreateCategory(baseMenuId, categoryName);

    // Create new item in Menu 1
    await this.supabase
      .from('menu_items')
      .insert({
        menu_id: baseMenuId,
        category_id: categoryId,
        name: item.name,
        price: item.price,
        description: item.description,
        tags: item.tags
      });
  }

  // 4. Record the price update operation
  await this.supabase
    .from('price_update_operations')
    .insert({
      base_menu_id: baseMenuId,
      price_source_menu_id: priceMenuId,
      decisions: priceUpdateDecisions,
      performed_by: performedBy,
      performed_at: new Date().toISOString()
    });

  return {
    success: true,
    menuId: baseMenuId,
    statistics: {
      pricesUpdated: Object.keys(priceUpdateDecisions.matches).length,
      itemsAdded: includeUnmatched.menu2.length,
      manualPricesSet: Object.keys(priceUpdateDecisions.manualPrices).length
    }
  };
}

async getOrCreateCategory(menuId, categoryName) {
  // Check if category exists
  const { data: existing } = await this.supabase
    .from('categories')
    .select('id')
    .eq('menu_id', menuId)
    .eq('name', categoryName)
    .single();

  if (existing) return existing.id;

  // Create new category
  const { data: newCategory } = await this.supabase
    .from('categories')
    .insert({
      menu_id: menuId,
      name: categoryName
    })
    .select('id')
    .single();

  return newCategory.id;
}
```

#### 2. Update compareMenus Response (menu-merge-service.js)

Enhance the `comparePriceUpdate` method to include more metadata:

```javascript
async comparePriceUpdate(menuIds) {
  // ... existing matching logic ...

  // Add category information to unmatched items
  const enhancedUnmatchedBase = unmatchedBase.map(item => ({
    ...item,
    categoryName: item.categories?.name,
    imageURL: item.item_images?.[0]?.url,
    keepByDefault: true // Menu 1 items keep by default
  }));

  const enhancedUnmatchedPrice = unmatchedPrice.map(item => ({
    ...item,
    categoryName: item.categories?.name,
    suggestedCategory: this.suggestCategoryMapping(item.categories?.name, baseCategories),
    keepByDefault: false // Menu 2 items don't keep by default
  }));

  return {
    comparison: {
      mode: 'price-only',
      priceMatches: enhancedMatches,
      unmatchedBase: enhancedUnmatchedBase,
      unmatchedPrice: enhancedUnmatchedPrice,
      categories: {
        menu1: baseCategories,
        menu2: priceCategories,
        mappings: categoryMappings
      },
      statistics: {
        // ... existing stats ...
        categoriesInMenu1: baseCategories.length,
        categoriesInMenu2: priceCategories.length
      }
    }
  };
}
```

### Frontend Implementation Details

#### 1. Main Render Logic (MenuMerge.jsx)

```jsx
// Line ~442 - Replace existing comparison render
{comparison && (
  comparison.comparison.mode === 'price-only' ? (
    <PriceUpdateView
      comparison={comparison.comparison}
      decisions={priceUpdateDecisions}
      onDecisionChange={handlePriceDecisionChange}
      onPreview={() => previewPriceUpdate()}
      onExecute={() => executePriceUpdate()}
    />
  ) : (
    // Existing full merge UI
    <Tabs defaultValue="duplicates">
      {/* ... existing tabs content ... */}
    </Tabs>
  )
)}
```

#### 2. PriceUpdateView Component

```jsx
const PriceUpdateView = ({ comparison, decisions, onDecisionChange, onPreview, onExecute }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState('all');
  const [selectedItem, setSelectedItem] = useState(null);

  return (
    <div className="space-y-6">
      {/* Statistics Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold">{comparison.statistics.matched}</div>
              <div className="text-sm text-muted-foreground">Matched Items</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">
                {comparison.statistics.averagePriceDifference}
              </div>
              <div className="text-sm text-muted-foreground">Avg Price Change</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{comparison.statistics.unmatchedInBase}</div>
              <div className="text-sm text-muted-foreground">Unmatched Menu 1</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{comparison.statistics.unmatchedInPriceSource}</div>
              <div className="text-sm text-muted-foreground">Unmatched Menu 2</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search and Filter Bar */}
      <div className="flex gap-4">
        <Input
          placeholder="Search items..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
        <Select value={filterMode} onValueChange={setFilterMode}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Items</SelectItem>
            <SelectItem value="matched">Matched Only</SelectItem>
            <SelectItem value="unmatched">Unmatched Only</SelectItem>
            <SelectItem value="confirmed">Confirmed Only</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Matched Items Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Matched Items ({comparison.priceMatches.length})</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => confirmAllMatches()}
            >
              Confirm All
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {comparison.priceMatches
              .filter(match => filterMatch(match, searchTerm, filterMode))
              .map(match => (
                <PriceMatchItem
                  key={match.groupId}
                  match={match}
                  decision={decisions.matches[match.baseItem.id]}
                  onConfirm={() => confirmMatch(match.baseItem.id)}
                  onChange={(newMatch) => changeMatch(match.baseItem.id, newMatch)}
                  onRemove={() => removeMatch(match.baseItem.id)}
                />
              ))
            }
          </div>
        </CardContent>
      </Card>

      {/* Unmatched Menu 1 Items */}
      <Card>
        <CardHeader>
          <CardTitle>Unmatched Items - Menu 1 ({comparison.unmatchedBase.length})</CardTitle>
          <CardDescription>
            These items will keep their current prices unless manually updated
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {comparison.unmatchedBase.map(item => (
              <UnmatchedMenu1Item
                key={item.id}
                item={item}
                menu2Items={comparison.unmatchedPrice}
                isKept={decisions.keepUnmatched.menu1.includes(item.id)}
                manualPrice={decisions.manualPrices[item.id]}
                onToggleKeep={() => toggleKeepMenu1Item(item.id)}
                onManualPrice={(price) => setManualPrice(item.id, price)}
                onSelectMatch={(menu2Id) => createManualMatch(item.id, menu2Id)}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Unmatched Menu 2 Items */}
      <Card>
        <CardHeader>
          <CardTitle>Available Items - Menu 2 ({comparison.unmatchedPrice.length})</CardTitle>
          <CardDescription>
            Select items to add to Menu 1 with their prices
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {comparison.unmatchedPrice.map(item => (
              <UnmatchedMenu2Item
                key={item.id}
                item={item}
                categories={comparison.categories.menu1}
                isSelected={decisions.keepUnmatched.menu2.includes(item.id)}
                selectedCategory={decisions.newCategories[item.id]}
                onToggleSelect={() => toggleKeepMenu2Item(item.id)}
                onCategoryChange={(category) => setItemCategory(item.id, category)}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
```

#### 3. Individual Item Components

```jsx
const PriceMatchItem = ({ match, decision, onConfirm, onChange, onRemove }) => {
  const priceDiff = match.priceDifference;
  const priceDiffPercent = match.priceDifferencePercent;
  const isConfirmed = decision?.confirmed;

  return (
    <div className={cn(
      "p-4 border rounded-lg",
      isConfirmed && "border-green-500 bg-green-50"
    )}>
      <div className="grid grid-cols-3 gap-4 items-center">
        {/* Menu 1 Item */}
        <div className="flex items-center gap-3">
          {match.baseItem.imageURL && (
            <img
              src={match.baseItem.imageURL}
              className="w-12 h-12 rounded object-cover"
            />
          )}
          <div>
            <div className="font-medium">{match.baseItem.name}</div>
            <div className="text-sm text-muted-foreground">
              Current: ${match.baseItem.price}
            </div>
          </div>
        </div>

        {/* Arrow and Price Change */}
        <div className="flex flex-col items-center">
          <ArrowRight className="h-4 w-4 mb-1" />
          <div className={cn(
            "text-sm font-medium",
            priceDiff < 0 ? "text-green-600" : priceDiff > 0 ? "text-red-600" : "text-gray-600"
          )}>
            {priceDiff < 0 ? '↓' : priceDiff > 0 ? '↑' : '='}
            ${Math.abs(priceDiff).toFixed(2)} ({priceDiffPercent}%)
          </div>
        </div>

        {/* Menu 2 Item */}
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium">{match.priceItem.name}</div>
            <div className="text-sm text-muted-foreground">
              New: ${match.priceItem.price}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            {!isConfirmed ? (
              <>
                <Button size="sm" variant="outline" onClick={onConfirm}>
                  <CheckCircle className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" onClick={onChange}>
                  <Edit3 className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" onClick={onRemove}>
                  <XCircle className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <Button size="sm" variant="ghost" onClick={onConfirm}>
                <XCircle className="h-4 w-4" /> Unconfirm
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
```

### Database Schema Updates

#### 1. New Table: price_update_operations

```sql
CREATE TABLE price_update_operations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  base_menu_id UUID REFERENCES menus(id),
  price_source_menu_id UUID REFERENCES menus(id),
  decisions JSONB NOT NULL,
  performed_by VARCHAR(255),
  performed_at TIMESTAMPTZ DEFAULT NOW(),
  statistics JSONB
);

CREATE INDEX idx_price_updates_base_menu ON price_update_operations(base_menu_id);
CREATE INDEX idx_price_updates_source_menu ON price_update_operations(price_source_menu_id);
```

#### 2. Update menu_items table

```sql
-- Add column to track price update history
ALTER TABLE menu_items
ADD COLUMN last_price_update TIMESTAMPTZ,
ADD COLUMN price_update_source UUID REFERENCES menus(id);
```

## Testing Plan

### Unit Tests

1. **Backend Tests**
   - Test `comparePriceUpdate` with various menu combinations
   - Test `executePriceUpdate` with different decision structures
   - Test category creation and mapping logic
   - Test price update calculations

2. **Frontend Tests**
   - Test mode detection and conditional rendering
   - Test price match confirmation/removal
   - Test manual match creation
   - Test search and filter functionality

### Integration Tests

1. **End-to-End Price Update Flow**
   - Select two menus
   - Choose Price Update mode
   - Verify correct UI renders
   - Confirm some matches, remove others
   - Add manual matches
   - Select Menu 2 items to add
   - Execute update
   - Verify Menu 1 is updated in-place

2. **Edge Cases**
   - No matches found between menus
   - All items matched perfectly
   - Manual price entry validation
   - Category creation for Menu 2 items
   - Large menus (100+ items)

### User Acceptance Criteria

1. ✓ Price Update mode shows mapping interface
2. ✓ Users can confirm/reject automatic matches
3. ✓ Users can create manual matches via search
4. ✓ Users can set manual prices for Menu 1 items
5. ✓ Users can add Menu 2 items to Menu 1
6. ✓ Users can assign categories to new items
7. ✓ Menu 1 is updated in-place (no new menu created)
8. ✓ All non-price fields preserved (images, descriptions, etc.)

## Implementation Timeline

### Phase 1: Frontend UI (Day 1-2)
1. Create PriceUpdateView component
2. Implement conditional rendering in MenuMerge.jsx
3. Build item matching components
4. Add search/filter functionality

### Phase 2: Backend Logic (Day 2-3)
1. Implement `executePriceUpdate` method
2. Update `comparePriceUpdate` with enhanced data
3. Add category management logic
4. Create database schema updates

### Phase 3: Integration (Day 3-4)
1. Connect frontend to backend
2. Test end-to-end flow
3. Handle edge cases
4. Performance optimization

### Phase 4: Testing & Polish (Day 4-5)
1. Write unit tests
2. Perform integration testing
3. UI polish and UX improvements
4. Documentation

## Risk Mitigation

### Risk 1: Performance with Large Menus
**Mitigation**: Implement pagination or virtual scrolling for item lists

### Risk 2: Incorrect Price Mapping
**Mitigation**: Require explicit confirmation for each price update

### Risk 3: Category Conflicts
**Mitigation**: Show clear category mapping UI with ability to create new categories

### Risk 4: Data Loss
**Mitigation**: Store all price update operations for rollback capability

## Success Metrics

1. **Accuracy**: 95%+ correct automatic matches
2. **Speed**: Complete price update in <30 seconds for 100 items
3. **User Satisfaction**: Reduced clicks compared to full merge
4. **Data Integrity**: Zero data loss during updates

## Conclusion

This comprehensive plan addresses all aspects of the Price Update mode fix:
- Clear UI for price mapping and manual adjustments
- In-place menu updates preserving all non-price data
- Flexible handling of unmatched items from both menus
- Robust category management for new items
- Complete audit trail of price updates

The implementation focuses on user control while streamlining the common use case of updating delivery platform menus with restaurant direct pricing.