# Option Sets Deduplication Refactor Plan

## Executive Summary
Currently, option sets are duplicated for each menu item, creating a 1-to-many relationship from menu_items to option_sets. This architecture causes massive data duplication (e.g., "Add Sides" stored 26 times) and prevents bulk editing. We need to refactor to a many-to-many relationship where option sets are stored once and referenced by multiple menu items.

## Current Architecture Problems

### Database Issues
1. **Data Duplication**: Option sets AND their items stored multiple times
   - "Add Sides" option set appears 26 times in database
   - "Waffle Fries" option item appears 26 times
   - "Coke® 330ml" option item appears 26 times
   - Each option set with 7 items = 26 × 7 = 182 duplicate records!
   
2. **Current Foreign Key Structure**:
   ```sql
   option_sets.menu_item_id -> menu_items.id (1-to-many)
   option_set_items.option_set_id -> option_sets.id (1-to-many)
   ```
   This creates cascading duplication at both levels

3. **Editing Nightmare**: 
   - To update "Add Sides", must update 26 option_set records
   - To update "Waffle Fries" price, must update 26 option_set_items records
   - Total updates for one option set with 7 items: 26 + (26 × 7) = 208 records!

4. **Storage Waste**: Massive redundancy
   - 26 option sets × 7 items each = 182 option_set_items records
   - Should be just 1 option set + 7 items = 8 records total

### Frontend Issues
1. **OptionSetEditor in wrong place**: Currently in EditableMenuItem component
2. **No centralized editing**: Can't edit shared option sets in one place
3. **Confusing UX**: Drag handle icons that don't actually drag

## Proposed Architecture

### New Database Schema

#### 1. Modified `option_sets` Table
```sql
-- Remove menu_item_id foreign key
ALTER TABLE option_sets DROP CONSTRAINT option_sets_menu_item_id_fkey;
ALTER TABLE option_sets DROP COLUMN menu_item_id;

-- Add unique constraint for deduplication
ALTER TABLE option_sets ADD COLUMN option_set_hash VARCHAR(64);
ALTER TABLE option_sets ADD CONSTRAINT unique_option_set_per_org 
  UNIQUE(organisation_id, option_set_hash);
```

#### 2. New Junction Table: `menu_item_option_sets`
```sql
CREATE TABLE menu_item_option_sets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  option_set_id UUID NOT NULL REFERENCES option_sets(id) ON DELETE CASCADE,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  organisation_id UUID REFERENCES organisations(id),
  UNIQUE(menu_item_id, option_set_id)
);

-- Indexes for performance
CREATE INDEX idx_menu_item_option_sets_menu_item ON menu_item_option_sets(menu_item_id);
CREATE INDEX idx_menu_item_option_sets_option_set ON menu_item_option_sets(option_set_id);
```

#### 3. Data Migration Strategy
```sql
-- Step 1: Identify duplicate option sets (keep one master copy)
WITH duplicate_sets AS (
  SELECT 
    name,
    organisation_id,
    MIN(id) as master_id,
    ARRAY_AGG(id) as all_ids,
    ARRAY_AGG(menu_item_id) as menu_item_ids
  FROM option_sets
  GROUP BY name, organisation_id, min_selections, max_selections, is_required
  HAVING COUNT(*) > 1
)

-- Step 2: Create junction table entries for all menu items
INSERT INTO menu_item_option_sets (menu_item_id, option_set_id, display_order)
SELECT 
  unnest(menu_item_ids) as menu_item_id,
  master_id as option_set_id,
  ROW_NUMBER() OVER (PARTITION BY unnest(menu_item_ids)) as display_order
FROM duplicate_sets;

-- Step 3: Migrate option_set_items to point to master option set
-- This is CRITICAL - we need to deduplicate items too!
WITH item_mapping AS (
  SELECT 
    osi_duplicate.id as old_item_id,
    osi_master.id as new_item_id
  FROM duplicate_sets ds
  CROSS JOIN LATERAL unnest(ds.all_ids) as dup_id
  JOIN option_set_items osi_duplicate ON osi_duplicate.option_set_id = dup_id
  JOIN option_set_items osi_master ON 
    osi_master.option_set_id = ds.master_id AND
    osi_master.name = osi_duplicate.name AND
    osi_master.price = osi_duplicate.price
)
-- Update any references, then delete duplicates

-- Step 4: Delete duplicate option_set_items
DELETE FROM option_set_items 
WHERE option_set_id IN (
  SELECT unnest(all_ids) 
  FROM duplicate_sets 
  WHERE unnest(all_ids) != master_id
);

-- Step 5: Delete duplicate option_sets
DELETE FROM option_sets 
WHERE id IN (
  SELECT unnest(all_ids) 
  FROM duplicate_sets 
  WHERE unnest(all_ids) != master_id
);
```

## Implementation Plan

### Phase 1: Database Schema Changes
1. Create migration script for new schema
2. Create junction table `menu_item_option_sets`
3. Create data migration to deduplicate existing option sets
4. Update RLS policies for new structure

### Phase 2: Backend Service Modifications

#### A. Premium Extraction Service (`premium-extraction-service.js`)
```javascript
// Current approach (WRONG):
for (const item of itemsWithOptionSets) {
  const optionSets = transformForDatabase(item.optionSetsData, savedItem.id);
  await bulkSaveOptionSets(optionSets, orgId);
}

// New approach (CORRECT):
// 1. Collect ALL option sets from all items
const allOptionSets = collectAllOptionSets(itemsWithOptionSets);

// 2. Deduplicate by creating hash of key properties
const uniqueOptionSets = deduplicateOptionSets(allOptionSets);

// 3. Save unique option sets ONCE
const savedOptionSets = await bulkSaveUniqueOptionSets(uniqueOptionSets, orgId);

// 4. Create junction table entries
await createMenuItemOptionSetLinks(savedItems, savedOptionSets);
```

#### B. Database Service (`database-service.js`)
```javascript
// New functions needed:
async function saveUniqueOptionSet(optionSetData, orgId) {
  // Generate hash from name + options + settings
  const hash = generateOptionSetHash(optionSetData);
  
  // Upsert based on hash
  const { data } = await client
    .from('option_sets')
    .upsert({
      ...optionSetData,
      option_set_hash: hash,
      organisation_id: orgId
    }, {
      onConflict: 'organisation_id,option_set_hash'
    });
  
  return data;
}

async function linkOptionSetToMenuItem(menuItemId, optionSetId, displayOrder) {
  // Create junction table entry
}

async function getMenuItemWithOptionSets(menuItemId) {
  // Join through junction table
}
```

#### C. Option Set Deduplication Service (NEW)
```javascript
// New service: option-sets-deduplication-service.js

function generateOptionSetHash(optionSet) {
  // Create consistent hash from:
  // - name
  // - min_selections
  // - max_selections  
  // - is_required
  // - sorted option items (name, price)
  
  const normalized = {
    name: optionSet.name.toLowerCase().trim(),
    min: optionSet.min_selections,
    max: optionSet.max_selections,
    required: optionSet.is_required,
    options: optionSet.options
      .map(o => ({ name: o.name.toLowerCase().trim(), price: o.price }))
      .sort((a, b) => a.name.localeCompare(b.name))
  };
  
  return crypto.createHash('sha256')
    .update(JSON.stringify(normalized))
    .digest('hex');
}

function deduplicateOptionSets(optionSets) {
  const uniqueMap = new Map();
  
  for (const optionSet of optionSets) {
    const hash = generateOptionSetHash(optionSet);
    if (!uniqueMap.has(hash)) {
      uniqueMap.set(hash, {
        ...optionSet,
        menuItems: []
      });
    }
    uniqueMap.get(hash).menuItems.push(optionSet.menu_item_id);
  }
  
  return Array.from(uniqueMap.values());
}
```

### Phase 3: API Endpoint Updates

#### Modified Menu Fetch Query
```javascript
// database-service.js - getMenuWithItems()
const { data } = await client
  .from('menus')
  .select(`
    *,
    categories (
      id,
      name,
      menu_items (
        *,
        item_images (*),
        menu_item_option_sets (
          display_order,
          option_set:option_sets (
            *,
            option_set_items (*)
          )
        )
      )
    )
  `)
  .eq('id', menuId)
  .single();

// Transform nested structure
data.categories.forEach(category => {
  category.menu_items.forEach(item => {
    item.option_sets = item.menu_item_option_sets
      .sort((a, b) => a.display_order - b.display_order)
      .map(link => link.option_set);
    delete item.menu_item_option_sets;
  });
});
```

### Phase 4: Frontend Changes

#### A. Remove OptionSetEditor from EditableMenuItem
```jsx
// EditableMenuItem.jsx
// REMOVE: <OptionSetEditor /> component
// ADD: Read-only display of linked option sets
{item.optionSets && (
  <div className="mt-4 p-3 bg-gray-50 rounded">
    <p className="text-sm font-medium mb-2">Linked Option Sets:</p>
    {item.optionSets.map(set => (
      <Badge key={set.id} variant="outline" className="mr-2">
        {set.name}
      </Badge>
    ))}
    <p className="text-xs text-gray-500 mt-2">
      Edit option sets in the Option Sets Management tab
    </p>
  </div>
)}
```

#### B. Enhance Option Sets Management Tab
```jsx
// MenuDetail.jsx - Option Sets tab
const OptionSetsManagement = () => {
  const [optionSets, setOptionSets] = useState([]);
  const [editingSet, setEditingSet] = useState(null);
  
  // Fetch unique option sets for organization
  useEffect(() => {
    fetchUniqueOptionSets(orgId).then(setOptionSets);
  }, [orgId]);
  
  const handleEditOptionSet = (optionSet) => {
    setEditingSet(optionSet);
  };
  
  const handleSaveOptionSet = async (updatedSet) => {
    // Save changes - automatically updates ALL menu items using this set
    await api.updateOptionSet(updatedSet);
    
    // Show success message
    toast({
      title: "Option Set Updated",
      description: `Changes applied to ${updatedSet.usageCount} menu items`,
    });
  };
  
  return (
    <div>
      {optionSets.map(set => (
        <OptionSetCard
          key={set.id}
          optionSet={set}
          onEdit={handleEditOptionSet}
          isEditing={editingSet?.id === set.id}
          onSave={handleSaveOptionSet}
        />
      ))}
    </div>
  );
};
```

#### C. New OptionSetCard Component
```jsx
// components/menu/OptionSetCard.jsx
const OptionSetCard = ({ optionSet, onEdit, isEditing, onSave }) => {
  if (!isEditing) {
    return (
      <Card>
        <CardHeader>
          <div className="flex justify-between">
            <div>
              <h3>{optionSet.name}</h3>
              <p className="text-sm text-gray-500">
                Used by {optionSet.menuItems.length} items
              </p>
            </div>
            <Button onClick={() => onEdit(optionSet)}>
              Edit
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <OptionSetsDisplay optionSets={[optionSet]} />
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card>
      <CardContent>
        <OptionSetEditor
          optionSet={optionSet}
          onSave={onSave}
          onCancel={() => onEdit(null)}
        />
      </CardContent>
    </Card>
  );
};
```

### Phase 5: Menu Item to Option Set Linking UI

#### New Component: MenuItemOptionSetLinker
```jsx
const MenuItemOptionSetLinker = ({ menuItem, availableOptionSets }) => {
  const [linkedSets, setLinkedSets] = useState(menuItem.optionSets || []);
  
  const handleLinkOptionSet = async (optionSetId) => {
    await api.linkOptionSetToMenuItem(menuItem.id, optionSetId);
    // Refresh linked sets
  };
  
  const handleUnlinkOptionSet = async (optionSetId) => {
    await api.unlinkOptionSetFromMenuItem(menuItem.id, optionSetId);
    // Refresh linked sets
  };
  
  return (
    <div>
      <h4>Link Option Sets</h4>
      <Select onValueChange={handleLinkOptionSet}>
        <SelectTrigger>
          <SelectValue placeholder="Add option set..." />
        </SelectTrigger>
        <SelectContent>
          {availableOptionSets
            .filter(set => !linkedSets.find(ls => ls.id === set.id))
            .map(set => (
              <SelectItem key={set.id} value={set.id}>
                {set.name} ({set.menuItems.length} other items)
              </SelectItem>
            ))}
        </SelectContent>
      </Select>
      
      <div className="mt-2">
        {linkedSets.map(set => (
          <Badge key={set.id} className="mr-2">
            {set.name}
            <button onClick={() => handleUnlinkOptionSet(set.id)}>
              <X className="h-3 w-3 ml-1" />
            </button>
          </Badge>
        ))}
      </div>
    </div>
  );
};
```

## Benefits of New Architecture

1. **Data Efficiency**: Option sets stored once, not 26 times
2. **Bulk Editing**: Change "Add Sides" once, affects all 26 items instantly
3. **Clear Separation**: Option sets are independent entities, not owned by menu items
4. **Better UX**: Centralized option set management
5. **Scalability**: Adding option set to 100 items doesn't create 100 records
6. **Consistency**: Ensures all items using same option set stay synchronized

## Migration Risks & Mitigation

### Risk 1: Data Loss During Migration
**Mitigation**: 
- Create full backup before migration
- Run migration in transaction
- Test on development database first

### Risk 2: Breaking Existing Menus
**Mitigation**:
- Implement backwards compatibility layer
- Phase rollout with feature flag
- Monitor error rates during migration

### Risk 3: Performance Impact
**Mitigation**:
- Add proper indexes on junction table
- Optimize queries with proper joins
- Consider caching frequently accessed option sets

## Testing Strategy

1. **Unit Tests**:
   - Hash generation consistency
   - Deduplication logic
   - Junction table operations

2. **Integration Tests**:
   - Menu fetch with option sets through junction
   - Option set updates affecting multiple items
   - Extraction and deduplication flow

3. **E2E Tests**:
   - Edit option set, verify all items updated
   - Link/unlink option sets from menu items
   - Extract menu with duplicate option sets

## Rollout Plan

1. **Week 1**: Database schema changes and migration scripts
2. **Week 2**: Backend service modifications
3. **Week 3**: Frontend changes and testing
4. **Week 4**: Production migration and monitoring

## Success Metrics

1. **Data Reduction**: Option sets table rows reduced by ~90%
2. **Performance**: Menu load time stays under 500ms
3. **User Satisfaction**: Bulk editing saves 95% of time
4. **Zero Data Loss**: All option sets preserved during migration

---

## Implementation Checklist

### Database
- [ ] Create junction table migration
- [ ] Write deduplication query
- [ ] Update RLS policies
- [ ] Test migration on dev database

### Backend
- [ ] Implement option set hashing
- [ ] Create deduplication service
- [ ] Update save logic in premium service
- [ ] Modify database service functions
- [ ] Update API endpoints

### Frontend
- [ ] Remove OptionSetEditor from menu items
- [ ] Enhance Option Sets Management tab
- [ ] Create linking UI for menu items
- [ ] Update data fetching logic
- [ ] Add success notifications

### Testing
- [ ] Write unit tests
- [ ] Write integration tests
- [ ] Perform manual testing
- [ ] Load testing with large menus

### Deployment
- [ ] Create rollback plan
- [ ] Schedule maintenance window
- [ ] Backup production database
- [ ] Execute migration
- [ ] Monitor for issues

---

## Detailed Explanation: How the Junction Table Approach Works

### Understanding the Current Problem

Currently, when multiple menu items need the same option set (e.g., "Add Sides"), we create duplicate records:

```sql
-- Current database structure creates DUPLICATE records:
option_sets table:
id                                    | menu_item_id                          | name       | options...
--------------------------------------|---------------------------------------|------------|------------
uuid-1                                | beef-brisket-burger-id                | Add Sides  | [data...]
uuid-2                                | pork-belly-burger-id                  | Add Sides  | [data...]
uuid-3                                | jerk-chicken-burger-id                | Add Sides  | [data...]
-- Same "Add Sides" stored 26 times! 🔴
```

### Junction Table Solution Explained

A junction table is a **bridge** that connects two tables in a many-to-many relationship. Instead of duplicating option sets, we store each option set once and use a junction table to track which menu items use which option sets.

**Important**: The `option_set_items` table relationship remains unchanged (1-to-many with option_sets), but because we're deduplicating option_sets, the items are automatically deduplicated too!

```sql
-- New structure with junction table:

option_sets table (stores each option set ONCE):
id        | name       | min_selections | max_selections 
----------|------------|----------------|----------------
uuid-ABC  | Add Sides  | 0              | 7              
uuid-DEF  | Add Drinks | 0              | 5              
uuid-GHI  | Extra Proteins | 0          | 3              

option_set_items table (stores each item ONCE per option set):
id        | option_set_id | name          | price  
----------|---------------|---------------|--------
item-1    | uuid-ABC      | Waffle Fries  | 6.99   -- Only stored ONCE!
item-2    | uuid-ABC      | Slaw          | 6.49   -- Not 26 times!
item-3    | uuid-ABC      | Loaded Fries  | 14.99  
item-4    | uuid-DEF      | Coke® 330ml   | 5.00   -- Only stored ONCE!
item-5    | uuid-DEF      | Sprite® 330ml | 5.00   -- Not 26 times!

menu_item_option_sets table (junction/bridge table):
id        | menu_item_id           | option_set_id | display_order
----------|------------------------|---------------|---------------
link-1    | beef-brisket-burger-id | uuid-ABC      | 1  -- Add Sides
link-2    | beef-brisket-burger-id | uuid-DEF      | 2  -- Add Drinks
link-3    | pork-belly-burger-id   | uuid-ABC      | 1  -- Add Sides (SAME uuid-ABC!)
link-4    | pork-belly-burger-id   | uuid-DEF      | 2  -- Add Drinks (SAME uuid-DEF!)
```

### Visual Representation

```
BEFORE (Current):
┌─────────────────┐
│  Menu Item 1    │───────► [Add Sides Copy #1]
└─────────────────┘
┌─────────────────┐
│  Menu Item 2    │───────► [Add Sides Copy #2]  ❌ Duplicate!
└─────────────────┘
┌─────────────────┐
│  Menu Item 3    │───────► [Add Sides Copy #3]  ❌ Duplicate!
└─────────────────┘

AFTER (Junction Table):
┌─────────────────┐     ┌──────────────┐     ┌─────────────────┐
│  Menu Item 1    │────►│   Junction   │────►│   Add Sides     │
└─────────────────┘     │    Table     │     │   (One Copy)    │
┌─────────────────┐     │              │     └─────────────────┘
│  Menu Item 2    │────►│   Links      │────►✓ Shared!
└─────────────────┘     │              │
┌─────────────────┐     │              │
│  Menu Item 3    │────►│              │────►✓ Shared!
└─────────────────┘     └──────────────┘
```

### Practical Implementation Example

#### During Extraction and Saving:

```javascript
// Step 1: Extract menu with duplicate option sets
const extractedMenu = {
  items: [
    {
      name: "Beef Brisket Burger",
      optionSets: [
        { name: "Add Sides", options: [...] },
        { name: "Add Drinks", options: [...] }
      ]
    },
    {
      name: "Pork Belly Burger", 
      optionSets: [
        { name: "Add Sides", options: [...] },  // Same as above!
        { name: "Add Drinks", options: [...] }  // Same as above!
      ]
    }
  ]
};

// Step 2: Deduplicate and save unique option sets
const uniqueOptionSets = new Map();

// Loop through all items and collect unique sets
extractedMenu.items.forEach(item => {
  item.optionSets.forEach(optionSet => {
    const hash = createHash(optionSet); // Hash of name + options
    if (!uniqueOptionSets.has(hash)) {
      uniqueOptionSets.set(hash, {
        ...optionSet,
        usedByItems: []
      });
    }
    uniqueOptionSets.get(hash).usedByItems.push(item.id);
  });
});

// Step 3: Save unique option sets to database
const savedOptionSets = [];
for (const [hash, optionSet] of uniqueOptionSets) {
  const saved = await db.insert('option_sets', {
    name: optionSet.name,
    options: optionSet.options,
    organisation_id: orgId
    // NO menu_item_id here!
  });
  savedOptionSets.push({ ...saved, usedByItems: optionSet.usedByItems });
}

// Step 4: Create junction table entries
for (const optionSet of savedOptionSets) {
  for (const itemId of optionSet.usedByItems) {
    await db.insert('menu_item_option_sets', {
      menu_item_id: itemId,
      option_set_id: optionSet.id,
      display_order: getDisplayOrder(itemId, optionSet.name)
    });
  }
}
```

#### Querying: How to Fetch Menu with Option Sets

```sql
-- Fetch menu with all relationships
SELECT 
  m.id as menu_id,
  mi.id as item_id,
  mi.name as item_name,
  os.id as option_set_id,
  os.name as option_set_name,
  os.options,
  mios.display_order
FROM menus m
JOIN menu_items mi ON mi.menu_id = m.id
JOIN menu_item_option_sets mios ON mios.menu_item_id = mi.id
JOIN option_sets os ON os.id = mios.option_set_id
WHERE m.id = $1
ORDER BY mi.id, mios.display_order;
```

#### Updating: Edit Once, Affect All

```javascript
// When user edits "Add Sides" option set:
async function updateOptionSet(optionSetId, newData) {
  // Update the single option set record
  await db.update('option_sets', {
    where: { id: optionSetId },
    data: newData
  });
  
  // That's it! All 26 menu items using this option set are updated!
  // No need to update 26 separate records
}

// To see which items are affected:
async function getAffectedItems(optionSetId) {
  return await db.query(`
    SELECT mi.name, mi.id 
    FROM menu_items mi
    JOIN menu_item_option_sets mios ON mios.menu_item_id = mi.id
    WHERE mios.option_set_id = $1
  `, [optionSetId]);
  // Returns: ["Beef Brisket Burger", "Pork Belly Burger", ...] (26 items)
}
```

#### Adding/Removing Option Sets from Menu Items

```javascript
// Link an existing option set to a menu item
async function linkOptionSetToItem(menuItemId, optionSetId) {
  await db.insert('menu_item_option_sets', {
    menu_item_id: menuItemId,
    option_set_id: optionSetId,
    display_order: await getNextDisplayOrder(menuItemId)
  });
}

// Unlink option set from menu item (doesn't delete the option set!)
async function unlinkOptionSetFromItem(menuItemId, optionSetId) {
  await db.delete('menu_item_option_sets', {
    where: {
      menu_item_id: menuItemId,
      option_set_id: optionSetId
    }
  });
}
```

### Key Benefits Illustrated

1. **Storage Efficiency**:
   - Before: 26 option_sets + 182 option_set_items = 208 total records for "Add Sides"
   - After: 1 option_set + 7 option_set_items + 26 junction records = 34 total records
   - **Reduction: 83.6% fewer records!**

2. **Update Efficiency**:
   - Before: Update 26 records to change "Add Sides"
   - After: Update 1 record, affects all 26 items instantly

3. **Flexibility**:
   - Easy to add option set to new item (just add junction record)
   - Easy to remove option set from item (just delete junction record)
   - Option set continues to exist for other items

4. **Data Integrity**:
   - Foreign keys ensure option sets and menu items exist
   - Cascading deletes clean up junction records automatically

### Analogy: The Sign-Up Sheet

The junction table acts like a **sign-up sheet** where menu items can "sign up" to use option sets:

- **Option Sets**: Like classes or clubs that exist independently
- **Menu Items**: Like students who can join multiple classes
- **Junction Table**: Like the enrollment records showing which students are in which classes
- **Benefits**: 
  - The class exists once, not recreated for each student
  - Updating class details (like room number) automatically affects all enrolled students
  - Students can easily join or leave classes
  - We can easily see all students in a class or all classes for a student

This architecture follows database normalization principles and eliminates redundancy while maintaining flexibility and data integrity.

---

*Document created: 2025-09-03*
*Status: Planning Phase*
*Next Step: Review with team and begin database schema changes*