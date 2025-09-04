# Proposed Database Schema Documentation
## Option Sets Architecture - AFTER Refactor

Generated: 2025-09-04

---

## Architecture Overview

The new architecture uses a **many-to-many relationship** where:
- Option sets are stored independently (no `menu_item_id`)
- A junction table `menu_item_option_sets` links menu items to option sets
- Each option set is stored ONCE and referenced by multiple menu items
- Option set items remain 1-to-many with option sets (unchanged)

This eliminates duplication and enables bulk editing of shared option sets.

---

## Schema Changes

## 1. Modified `option_sets` Table

### Changes from Current Schema
- **REMOVE**: `menu_item_id` column and foreign key constraint
- **ADD**: `option_set_hash` column for deduplication
- **ADD**: Unique constraint on `(organisation_id, option_set_hash)`

### New Schema

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| **id** | uuid | NO | uuid_generate_v4() | PRIMARY KEY |
| ~~menu_item_id~~ | ~~uuid~~ | ~~NO~~ | - | **REMOVED** |
| name | varchar(255) | NO | - | - |
| type | varchar(50) | YES | - | - |
| min_selections | integer | YES | 0 | - |
| max_selections | integer | YES | - | - |
| is_required | boolean | YES | false | - |
| created_at | timestamptz | YES | now() | - |
| updated_at | timestamptz | YES | now() | - |
| organisation_id | uuid | YES | - | FK → organisations(id) |
| description | text | YES | - | - |
| display_order | integer | YES | 0 | **DEPRECATED** (moved to junction) |
| multiple_selections_allowed | boolean | YES | false | - |
| extraction_source | varchar(50) | YES | - | - |
| extracted_at | timestamptz | YES | now() | - |
| source_data | jsonb | YES | - | - |
| **option_set_hash** | varchar(64) | NO | - | **NEW** - SHA-256 hash |

### New Constraints
- **UNIQUE**: `unique_option_set_per_org (organisation_id, option_set_hash)`

### New Indexes
- Remove: `idx_option_sets_menu_item`
- Remove: `idx_option_sets_display_order`
- Add: `idx_option_sets_hash` on `option_set_hash`
- Keep: `idx_option_sets_org` on `organisation_id`

---

## 2. NEW `menu_item_option_sets` Table (Junction)

### Purpose
Links menu items to option sets in a many-to-many relationship.

### Schema

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| **id** | uuid | NO | uuid_generate_v4() | PRIMARY KEY |
| **menu_item_id** | uuid | NO | - | FK → menu_items(id) CASCADE DELETE |
| **option_set_id** | uuid | NO | - | FK → option_sets(id) CASCADE DELETE |
| display_order | integer | YES | 0 | Order of option sets for a menu item |
| created_at | timestamptz | YES | now() | - |
| organisation_id | uuid | YES | - | FK → organisations(id) |

### Constraints
- **PRIMARY KEY**: `id`
- **UNIQUE**: `(menu_item_id, option_set_id)` - Prevent duplicate links
- **FOREIGN KEY**: `menu_item_id` → `menu_items(id)` CASCADE DELETE
- **FOREIGN KEY**: `option_set_id` → `option_sets(id)` CASCADE DELETE
- **FOREIGN KEY**: `organisation_id` → `organisations(id)`

### Indexes
- `menu_item_option_sets_pkey` - Primary key on `id`
- `idx_menu_item_option_sets_unique` - Unique on `(menu_item_id, option_set_id)`
- `idx_menu_item_option_sets_menu_item` - Index on `menu_item_id`
- `idx_menu_item_option_sets_option_set` - Index on `option_set_id`
- `idx_menu_item_option_sets_org` - Index on `organisation_id`

---

## 3. `option_set_items` Table (Unchanged)

The `option_set_items` table remains unchanged, but benefits from deduplication:
- Still has 1-to-many relationship with `option_sets`
- Items are automatically deduplicated when parent option sets are deduplicated
- No schema changes required

---

## Data Flow Diagram - NEW Architecture

```
┌─────────────────┐
│     menus       │
└────────┬────────┘
         │ 1-to-many
         ▼
┌─────────────────┐
│   categories    │
└────────┬────────┘
         │ 1-to-many
         ▼
┌─────────────────┐           ┌──────────────────────┐
│   menu_items    │◄──────────│ menu_item_option_sets│
└─────────────────┘ many-to-1 └──────┬───────────────┘
                                      │ many-to-1
                               ┌──────▼───────┐
                               │ option_sets  │ ◄── Stored ONCE!
                               └──────┬───────┘
                                      │ 1-to-many
                               ┌──────▼────────────┐
                               │ option_set_items  │ ◄── Stored ONCE per set!
                               └───────────────────┘
```

---

## Deduplication Example

### After Migration Data Structure

When "Add Sides" option set is used by 26 different burger items:

```sql
-- option_sets table (1 row instead of 26):
id        | name      | option_set_hash                | organisation_id
----------|-----------|--------------------------------|----------------
uuid-ABC  | Add Sides | 3f4a8b9c1d2e5f6a7b8c9d0e1f2a3b4 | org-123

-- menu_item_option_sets junction table (26 rows linking to same option set):
id        | menu_item_id           | option_set_id | display_order
----------|------------------------|---------------|---------------
link-001  | beef-brisket-burger    | uuid-ABC      | 1
link-002  | pork-belly-burger      | uuid-ABC      | 1
link-003  | chicken-burger         | uuid-ABC      | 1
... (23 more links to uuid-ABC)

-- option_set_items table (7 rows instead of 182):
id        | option_set_id | name          | price
----------|---------------|---------------|-------
item-001  | uuid-ABC      | Waffle Fries  | 6.99
item-002  | uuid-ABC      | Slaw          | 6.49
item-003  | uuid-ABC      | Loaded Fries  | 14.99
... (4 more items, stored ONCE)
```

### Storage Comparison
| Metric | Before (Current) | After (Proposed) | Reduction |
|--------|------------------|------------------|-----------|
| option_sets rows | 26 | 1 | 96% |
| option_set_items rows | 182 | 7 | 96% |
| junction table rows | 0 | 26 | N/A |
| **Total rows** | **208** | **34** | **84%** |

---

## SQL Migration Scripts

### Step 1: Create Junction Table
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

-- Create indexes
CREATE INDEX idx_menu_item_option_sets_menu_item ON menu_item_option_sets(menu_item_id);
CREATE INDEX idx_menu_item_option_sets_option_set ON menu_item_option_sets(option_set_id);
CREATE INDEX idx_menu_item_option_sets_org ON menu_item_option_sets(organisation_id);
```

### Step 2: Add Hash Column to option_sets
```sql
ALTER TABLE option_sets 
ADD COLUMN option_set_hash VARCHAR(64);

-- Add unique constraint for deduplication
ALTER TABLE option_sets 
ADD CONSTRAINT unique_option_set_per_org 
UNIQUE(organisation_id, option_set_hash);

-- Create index on hash
CREATE INDEX idx_option_sets_hash ON option_sets(option_set_hash);
```

### Step 3: Migrate Existing Data (Development Only)
```sql
-- Since we cleaned the database, we'll migrate the remaining data
INSERT INTO menu_item_option_sets (menu_item_id, option_set_id, display_order, organisation_id)
SELECT 
    menu_item_id,
    id as option_set_id,
    display_order,
    organisation_id
FROM option_sets
WHERE menu_item_id IS NOT NULL;
```

### Step 4: Remove menu_item_id from option_sets
```sql
-- Drop the foreign key constraint
ALTER TABLE option_sets 
DROP CONSTRAINT option_sets_menu_item_id_fkey;

-- Drop the column
ALTER TABLE option_sets 
DROP COLUMN menu_item_id;

-- Drop related indexes
DROP INDEX idx_option_sets_menu_item;
DROP INDEX idx_option_sets_display_order;
```

---

## Query Examples

### Fetch Menu with Option Sets (NEW)
```sql
-- Using Supabase client syntax
const { data } = await supabase
  .from('menus')
  .select(`
    *,
    categories (
      id,
      name,
      menu_items (
        *,
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
```

### Update Option Set (Affects ALL Menu Items)
```sql
UPDATE option_sets 
SET 
    name = 'Add Extra Sides',
    updated_at = NOW()
WHERE id = 'uuid-ABC';
-- This single update affects all 26 menu items using this option set!
```

### Link Option Set to Menu Item
```sql
INSERT INTO menu_item_option_sets (menu_item_id, option_set_id, display_order)
VALUES ('new-burger-id', 'uuid-ABC', 1);
```

### Find All Menu Items Using an Option Set
```sql
SELECT mi.name, mi.id 
FROM menu_items mi
JOIN menu_item_option_sets mios ON mios.menu_item_id = mi.id
WHERE mios.option_set_id = 'uuid-ABC';
```

---

## Benefits Summary

### 1. Storage Efficiency
- 84% reduction in database rows
- Eliminates redundant data storage
- Reduces backup and replication costs

### 2. Update Efficiency
- Single update affects all linked menu items
- No risk of inconsistent data
- Faster bulk operations

### 3. Query Performance
- Fewer rows to scan
- Smaller indexes
- Less data transfer

### 4. Business Features
- Enable bulk editing of shared option sets
- Easy to identify which items share option sets
- Maintain consistency across entire menu

### 5. Maintainability
- Follows database normalization principles
- Clear separation of concerns
- Easier to reason about relationships

---

## Row Level Security (RLS) Considerations

### New RLS Policy for Junction Table
```sql
-- Enable RLS on junction table
ALTER TABLE menu_item_option_sets ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see/modify their organization's links
CREATE POLICY menu_item_option_sets_org_isolation ON menu_item_option_sets
    FOR ALL
    USING (organisation_id = current_setting('app.current_org_id')::uuid)
    WITH CHECK (organisation_id = current_setting('app.current_org_id')::uuid);
```

---

## Implementation Timeline

1. **Phase 1**: Database schema changes (Today)
2. **Phase 2**: Backend service updates (Tomorrow)
3. **Phase 3**: Frontend UI changes (Day 3)
4. **Phase 4**: Testing and validation (Day 4)
5. **Phase 5**: Production deployment (Day 5)

---

## Notes

- The `display_order` field moves from `option_sets` to the junction table
- Each menu item can control the order of its option sets independently
- Option sets without any junction table links can be safely deleted
- Hash generation must be consistent and deterministic for deduplication to work