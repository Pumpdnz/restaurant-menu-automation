# Option Sets Deduplication Refactor Plan

## Executive Summary
Currently, option sets are duplicated for each menu item, creating a 1-to-many relationship from menu_items to option_sets. This architecture causes massive data duplication (e.g., "Add Sides" stored 26 times) and prevents bulk editing. We need to refactor to a many-to-many relationship where option sets are stored once and referenced by multiple menu items.

## Current Architecture Problems

### Database Issues
1. **Data Duplication**: Option sets with same name/content stored multiple times
   - "Add Sides" appears 26 times in database
   - "Add Drinks" appears 26 times
   - "Extra Proteins" appears 24 times
   
2. **Current Foreign Key Structure**:
   ```sql
   option_sets.menu_item_id -> menu_items.id (1-to-many)
   ```
   This means each option set can only belong to ONE menu item

3. **Editing Nightmare**: To update "Add Sides", must update 26 separate records

4. **Storage Waste**: Storing identical data multiple times

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
-- Step 1: Create temporary mapping of duplicates
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
-- Step 2: Insert into junction table
-- Step 3: Update option_set_items to point to master
-- Step 4: Delete duplicate option_sets
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

*Document created: 2025-09-03*
*Status: Planning Phase*
*Next Step: Review with team and begin database schema changes*