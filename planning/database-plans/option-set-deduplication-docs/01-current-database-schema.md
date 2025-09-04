# Current Database Schema Documentation
## Option Sets Architecture - BEFORE Refactor

Generated: 2025-09-04

---

## Table Overview

The current architecture uses a **1-to-many relationship** where:
- Each `menu_item` can have multiple `option_sets` (1-to-many)
- Each `option_set` belongs to exactly one `menu_item` via foreign key
- Each `option_set` can have multiple `option_set_items` (1-to-many)

This creates cascading duplication when the same option set (e.g., "Add Sides") is needed by multiple menu items.

---

## 1. `menu_items` Table

### Purpose
Stores individual menu items that belong to categories and menus.

### Schema

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| **id** | uuid | NO | uuid_generate_v4() | PRIMARY KEY |
| category_id | uuid | NO | - | FK → categories(id) CASCADE DELETE |
| menu_id | uuid | NO | - | FK → menus(id) CASCADE DELETE |
| name | varchar(255) | NO | - | - |
| description | text | YES | - | - |
| price | numeric | YES | - | - |
| currency | varchar(3) | YES | 'NZD' | - |
| tags | text[] | YES | - | Array of text |
| dietary_info | jsonb | YES | - | - |
| platform_item_id | varchar(255) | YES | - | - |
| is_available | boolean | YES | true | - |
| metadata | jsonb | YES | '{}' | - |
| created_at | timestamptz | YES | now() | - |
| updated_at | timestamptz | YES | now() | - |
| organisation_id | uuid | YES | - | FK → organisations(id) |
| has_option_sets | boolean | YES | false | - |
| option_sets_extracted_at | timestamptz | YES | - | - |
| extraction_method | varchar(50) | YES | - | - |
| modal_url | text | YES | - | - |
| clean_url | text | YES | - | - |
| image_validated | boolean | YES | false | - |
| image_validation_data | jsonb | YES | - | - |

### Indexes
- `menu_items_pkey` - Primary key on `id`
- `idx_menu_items_category` - Index on `category_id`
- `idx_menu_items_menu` - Index on `menu_id`
- `idx_menu_items_org` - Index on `organisation_id`
- `idx_menu_items_extraction_method` - Index on `extraction_method`
- `idx_menu_items_has_option_sets` - Partial index where `has_option_sets = true`
- `idx_menu_items_image_validated` - Partial index where `image_validated = false`

---

## 2. `option_sets` Table

### Purpose
Stores option sets (modifiers/customizations) for menu items. Currently has a **1-to-many relationship** with menu_items.

### ⚠️ CRITICAL ISSUE
The `menu_item_id` foreign key creates duplication - the same option set is stored multiple times for different menu items.

### Schema

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| **id** | uuid | NO | uuid_generate_v4() | PRIMARY KEY |
| **menu_item_id** | uuid | NO | - | FK → menu_items(id) CASCADE DELETE ⚠️ |
| name | varchar(255) | NO | - | - |
| type | varchar(50) | YES | - | - |
| min_selections | integer | YES | 0 | - |
| max_selections | integer | YES | - | - |
| is_required | boolean | YES | false | - |
| created_at | timestamptz | YES | now() | - |
| updated_at | timestamptz | YES | now() | - |
| organisation_id | uuid | YES | - | FK → organisations(id) |
| description | text | YES | - | - |
| display_order | integer | YES | 0 | - |
| multiple_selections_allowed | boolean | YES | false | - |
| extraction_source | varchar(50) | YES | - | - |
| extracted_at | timestamptz | YES | now() | - |
| source_data | jsonb | YES | - | - |

### Foreign Keys
- `option_sets_menu_item_id_fkey` - References `menu_items(id)` with CASCADE DELETE
- `option_sets_organisation_id_fkey` - References `organisations(id)`

### Indexes
- `option_sets_pkey` - Primary key on `id`
- `idx_option_sets_menu_item` - Index on `menu_item_id`
- `idx_option_sets_display_order` - Composite index on `(menu_item_id, display_order)`
- `idx_option_sets_org` - Index on `organisation_id`
- `idx_option_sets_organisation` - Duplicate index on `organisation_id`

---

## 3. `option_set_items` Table

### Purpose
Stores individual options within an option set (e.g., "Waffle Fries" within "Add Sides").

### Schema

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| **id** | uuid | NO | uuid_generate_v4() | PRIMARY KEY |
| **option_set_id** | uuid | NO | - | FK → option_sets(id) CASCADE DELETE |
| name | varchar(255) | NO | - | - |
| price | numeric | YES | 0 | - |
| is_default | boolean | YES | false | - |
| is_available | boolean | YES | true | - |
| metadata | jsonb | YES | '{}' | - |
| created_at | timestamptz | YES | now() | - |
| organisation_id | uuid | YES | - | FK → organisations(id) |
| description | text | YES | - | - |
| price_display | text | YES | - | - |
| display_order | integer | YES | 0 | - |
| extraction_source | varchar(50) | YES | - | - |
| extracted_at | timestamptz | YES | now() | - |

### Foreign Keys
- `options_option_set_id_fkey` - References `option_sets(id)` with CASCADE DELETE
- `options_organisation_id_fkey` - References `organisations(id)`

### Indexes
- `options_pkey` - Primary key on `id`
- `idx_option_set_items_option_set` - Index on `option_set_id`
- `idx_option_set_items_display_order` - Composite index on `(option_set_id, display_order)`
- `idx_option_set_items_availability` - Composite index on `(option_set_id, is_available)`
- `idx_option_set_items_organisation` - Index on `organisation_id`
- `idx_options_org` - Duplicate index on `organisation_id`

---

## Data Flow Diagram

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
┌─────────────────┐
│   menu_items    │
└────────┬────────┘
         │ 1-to-many (PROBLEM: Creates duplication!)
         ▼
┌─────────────────┐
│   option_sets   │ ◄── Each option set tied to ONE menu_item
└────────┬────────┘     Same "Add Sides" stored 26 times!
         │ 1-to-many
         ▼
┌─────────────────┐
│ option_set_items│ ◄── Each item duplicated with its parent
└─────────────────┘     "Waffle Fries" stored 26 times!
```

---

## Duplication Example

### Current Data Reality
When "Add Sides" option set is used by 26 different burger items:

```sql
-- option_sets table (26 duplicate rows):
id                                    | menu_item_id                | name      
--------------------------------------|-----------------------------|-----------
uuid-001                              | beef-brisket-burger-id      | Add Sides
uuid-002                              | pork-belly-burger-id        | Add Sides
uuid-003                              | chicken-burger-id           | Add Sides
... (23 more identical "Add Sides")

-- option_set_items table (182 duplicate rows - 26 sets × 7 items):
id        | option_set_id | name          | price
----------|---------------|---------------|-------
item-001  | uuid-001      | Waffle Fries  | 6.99
item-002  | uuid-001      | Slaw          | 6.49
... (5 more items for uuid-001)
item-008  | uuid-002      | Waffle Fries  | 6.99  -- DUPLICATE!
item-009  | uuid-002      | Slaw          | 6.49  -- DUPLICATE!
... (175 more duplicate items)
```

### Storage Impact
- **Expected**: 1 option_set + 7 option_set_items = **8 records**
- **Actual**: 26 option_sets + 182 option_set_items = **208 records**
- **Waste**: 200 unnecessary records (96% redundancy!)

---

## Problems with Current Architecture

### 1. Data Redundancy
- Same option set stored multiple times
- Same option items stored multiple times
- Violates database normalization principles

### 2. Update Complexity
- To change price of "Waffle Fries": Update 26 records
- To add new option to "Add Sides": Insert 26 records
- Risk of inconsistency if updates fail partially

### 3. Storage Inefficiency
- 96% of option set data is redundant
- Database size grows unnecessarily with menu size
- Backup and replication costs increase

### 4. Query Performance
- More rows to scan when fetching menus
- Larger indexes to maintain
- More data to transfer over network

### 5. Business Logic Issues
- Cannot easily identify shared option sets
- Cannot bulk edit option sets
- Difficult to maintain consistency across menu items

---

## Migration Requirements

To fix these issues, we need to:

1. **Remove** the `menu_item_id` foreign key from `option_sets`
2. **Add** a hash column for deduplication
3. **Create** a junction table `menu_item_option_sets`
4. **Migrate** existing data to deduplicated structure
5. **Update** all queries and application logic

See the migration plan documentation for detailed steps.

---

## Notes

- All foreign keys to `organisations` table have NO ACTION on delete/update
- All foreign keys to parent entities (menu_items, option_sets) have CASCADE DELETE
- Multiple duplicate indexes exist (e.g., two indexes on organisation_id in option_sets)
- The `has_option_sets` flag on menu_items helps identify items needing option set extraction