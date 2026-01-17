# Database Schema - Variable Enhancements

## Overview

Phase 4 of the variable enhancements introduces dynamic variables that pull data from the database. This requires a new table to store example customer references per city.

## New Tables

### city_example_customers

**Purpose:** Store example customer references for dynamic variable replacement

**Use Case:** When creating messages for prospects in a specific city, reference existing successful customers from that same city to build credibility.

**Example:**
> "We'd love to help you like we helped **{example_restaurant_1}** and **{example_restaurant_2}** here in Auckland!"

#### Schema

```sql
CREATE TABLE city_example_customers (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Multi-tenancy
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,

  -- Location
  city TEXT NOT NULL,

  -- Example Restaurant Reference
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE SET NULL,
  display_name TEXT NOT NULL,
  store_url TEXT NOT NULL,

  -- Ordering
  display_order INTEGER NOT NULL DEFAULT 1,

  -- Status
  is_active BOOLEAN DEFAULT true,

  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_by UUID REFERENCES auth.users(id),

  -- Ensure unique ordering per city per organization
  CONSTRAINT unique_city_order_per_org
    UNIQUE (organisation_id, city, display_order)
);

-- Indexes for performance
CREATE INDEX idx_city_example_customers_city
  ON city_example_customers(organisation_id, city, is_active);

CREATE INDEX idx_city_example_customers_order
  ON city_example_customers(organisation_id, city, display_order);

CREATE INDEX idx_city_example_customers_restaurant
  ON city_example_customers(restaurant_id);

-- Trigger for updated_at
CREATE TRIGGER update_city_example_customers_updated_at
  BEFORE UPDATE ON city_example_customers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

#### Field Descriptions

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `id` | UUID | NO | Primary key, auto-generated |
| `organisation_id` | UUID | NO | Multi-tenant isolation |
| `city` | TEXT | NO | City name (e.g., "Auckland", "Wellington") |
| `restaurant_id` | UUID | YES | Reference to actual restaurant (optional, can be NULL if restaurant deleted) |
| `display_name` | TEXT | NO | Name to show in messages (e.g., "Burger King") |
| `store_url` | TEXT | NO | Link to their Pumpd store (e.g., "https://burgerking.pumpd.co.nz") |
| `display_order` | INTEGER | NO | Order of appearance (1 = first, 2 = second, etc.) |
| `is_active` | BOOLEAN | NO | Whether to include in variable resolution |
| `created_at` | TIMESTAMP | NO | Record creation timestamp |
| `updated_at` | TIMESTAMP | NO | Last update timestamp |
| `created_by` | UUID | YES | User who created the record |

#### Business Rules

1. **Display Order:**
   - `display_order = 1` → Used for `{example_restaurant_1}`
   - `display_order = 2` → Used for `{example_restaurant_2}`
   - Can have more than 2 (future: `{example_restaurant_3}`, etc.)

2. **City Matching:**
   - Exact match (case-insensitive recommended)
   - If no examples found for city, variable resolves to empty string
   - Consider adding city normalization (e.g., "Auckland" vs "auckland")

3. **Active Status:**
   - Only `is_active = true` records used
   - Allows temporary deactivation without deletion
   - Useful for seasonal campaigns or A/B testing

4. **Restaurant Deletion:**
   - `ON DELETE SET NULL` allows keeping example even if restaurant deleted
   - `display_name` and `store_url` preserved
   - Admin should manually deactivate or update if needed

#### Example Data

```sql
-- Auckland examples
INSERT INTO city_example_customers (
  organisation_id,
  city,
  restaurant_id,
  display_name,
  store_url,
  display_order,
  is_active
) VALUES
  (
    '00000000-0000-0000-0000-000000000001',
    'Auckland',
    'aaaaaaaa-1111-1111-1111-111111111111',
    'Burger King',
    'https://burgerking.pumpd.co.nz',
    1,
    true
  ),
  (
    '00000000-0000-0000-0000-000000000001',
    'Auckland',
    'aaaaaaaa-2222-2222-2222-222222222222',
    'Pizza Hut',
    'https://pizzahut.pumpd.co.nz',
    2,
    true
  );

-- Wellington examples
INSERT INTO city_example_customers (
  organisation_id,
  city,
  restaurant_id,
  display_name,
  store_url,
  display_order,
  is_active
) VALUES
  (
    '00000000-0000-0000-0000-000000000001',
    'Wellington',
    'bbbbbbbb-1111-1111-1111-111111111111',
    'Hell Pizza',
    'https://hellpizza.pumpd.co.nz',
    1,
    true
  ),
  (
    '00000000-0000-0000-0000-000000000001',
    'Wellington',
    'bbbbbbbb-2222-2222-2222-222222222222',
    'Subway',
    'https://subway.pumpd.co.nz',
    2,
    true
  );
```

## Modified Tables

### No structural changes to existing tables

The variable enhancement system works with existing schema:

- `tasks` - Already has `message` and `message_rendered` fields
- `sequence_instances` - No changes needed
- `message_templates` - No changes needed
- `task_templates` - No changes needed
- `restaurants` - Source of variable data, no changes

## Row-Level Security (RLS)

### city_example_customers Policies

```sql
-- Enable RLS
ALTER TABLE city_example_customers ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view examples from their organization
CREATE POLICY "Users can view org's example customers"
  ON city_example_customers
  FOR SELECT
  USING (
    organisation_id = (
      SELECT organisation_id
      FROM user_organizations
      WHERE user_id = auth.uid()
      LIMIT 1
    )
  );

-- Policy: Admins can insert examples
CREATE POLICY "Admins can insert example customers"
  ON city_example_customers
  FOR INSERT
  WITH CHECK (
    organisation_id = (
      SELECT organisation_id
      FROM user_organizations
      WHERE user_id = auth.uid()
      LIMIT 1
    )
    AND EXISTS (
      SELECT 1 FROM user_organizations
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'super_admin')
    )
  );

-- Policy: Admins can update examples
CREATE POLICY "Admins can update example customers"
  ON city_example_customers
  FOR UPDATE
  USING (
    organisation_id = (
      SELECT organisation_id
      FROM user_organizations
      WHERE user_id = auth.uid()
      LIMIT 1
    )
    AND EXISTS (
      SELECT 1 FROM user_organizations
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'super_admin')
    )
  );

-- Policy: Admins can delete examples
CREATE POLICY "Admins can delete example customers"
  ON city_example_customers
  FOR DELETE
  USING (
    organisation_id = (
      SELECT organisation_id
      FROM user_organizations
      WHERE user_id = auth.uid()
      LIMIT 1
    )
    AND EXISTS (
      SELECT 1 FROM user_organizations
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'super_admin')
    )
  );
```

## Migration File

**File:** `supabase/migrations/YYYYMMDDHHMMSS_create_city_example_customers.sql`

```sql
-- Migration: Create city_example_customers table for dynamic variables
-- Description: Stores example customer references for personalized messaging
-- Author: Development Team
-- Date: 2025-01-26

-- Create table
CREATE TABLE IF NOT EXISTS city_example_customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  city TEXT NOT NULL,
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE SET NULL,
  display_name TEXT NOT NULL,
  store_url TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_by UUID REFERENCES auth.users(id),

  CONSTRAINT unique_city_order_per_org
    UNIQUE (organisation_id, city, display_order)
);

-- Create indexes
CREATE INDEX idx_city_example_customers_city
  ON city_example_customers(organisation_id, city, is_active);

CREATE INDEX idx_city_example_customers_order
  ON city_example_customers(organisation_id, city, display_order);

CREATE INDEX idx_city_example_customers_restaurant
  ON city_example_customers(restaurant_id);

-- Create trigger for updated_at
CREATE TRIGGER update_city_example_customers_updated_at
  BEFORE UPDATE ON city_example_customers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE city_example_customers ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view org's example customers"
  ON city_example_customers
  FOR SELECT
  USING (
    organisation_id = (
      SELECT organisation_id
      FROM user_organizations
      WHERE user_id = auth.uid()
      LIMIT 1
    )
  );

CREATE POLICY "Admins can insert example customers"
  ON city_example_customers
  FOR INSERT
  WITH CHECK (
    organisation_id = (
      SELECT organisation_id
      FROM user_organizations
      WHERE user_id = auth.uid()
      LIMIT 1
    )
    AND EXISTS (
      SELECT 1 FROM user_organizations
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can update example customers"
  ON city_example_customers
  FOR UPDATE
  USING (
    organisation_id = (
      SELECT organisation_id
      FROM user_organizations
      WHERE user_id = auth.uid()
      LIMIT 1
    )
    AND EXISTS (
      SELECT 1 FROM user_organizations
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can delete example customers"
  ON city_example_customers
  FOR DELETE
  USING (
    organisation_id = (
      SELECT organisation_id
      FROM user_organizations
      WHERE user_id = auth.uid()
      LIMIT 1
    )
    AND EXISTS (
      SELECT 1 FROM user_organizations
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'super_admin')
    )
  );

-- Add comment
COMMENT ON TABLE city_example_customers IS
  'Stores example customer references for dynamic variable replacement in messages. Used for variables like {example_restaurant_1} and {example_restaurant_2}.';

-- Commit migration
-- Migration complete
```

## Rollback Plan

```sql
-- Rollback migration: Drop city_example_customers table
-- WARNING: This will delete all example customer data

-- Drop policies
DROP POLICY IF EXISTS "Users can view org's example customers"
  ON city_example_customers;
DROP POLICY IF EXISTS "Admins can insert example customers"
  ON city_example_customers;
DROP POLICY IF EXISTS "Admins can update example customers"
  ON city_example_customers;
DROP POLICY IF EXISTS "Admins can delete example customers"
  ON city_example_customers;

-- Drop trigger
DROP TRIGGER IF EXISTS update_city_example_customers_updated_at
  ON city_example_customers;

-- Drop indexes (CASCADE will drop them, but explicit for clarity)
DROP INDEX IF EXISTS idx_city_example_customers_city;
DROP INDEX IF EXISTS idx_city_example_customers_order;
DROP INDEX IF EXISTS idx_city_example_customers_restaurant;

-- Drop table
DROP TABLE IF EXISTS city_example_customers CASCADE;
```

## Query Performance

### Expected Usage Patterns

1. **Variable Resolution** (most frequent):
   ```sql
   SELECT * FROM city_example_customers
   WHERE organisation_id = $1
     AND city = $2
     AND is_active = true
   ORDER BY display_order ASC
   LIMIT 2;
   ```
   - Uses `idx_city_example_customers_city` composite index
   - Expected: < 1ms for 1000s of records

2. **Admin Management** (infrequent):
   ```sql
   SELECT * FROM city_example_customers
   WHERE organisation_id = $1
   ORDER BY city, display_order;
   ```
   - Full table scan acceptable (admin UI)
   - Expected: < 10ms for 1000s of records

3. **Bulk Sequence Creation** (moderate):
   - 100 restaurants × 1 query each = 100 queries
   - With caching: 1 query per unique city
   - Expected: < 100ms total for 10 cities

### Performance Optimization

**Phase 4 Implementation:**

```javascript
// Cache examples per city during bulk operations
const cityCache = new Map();

async function getExampleRestaurantsOptimized(city) {
  if (!cityCache.has(city)) {
    const examples = await getExampleRestaurants(city);
    cityCache.set(city, examples);
  }
  return cityCache.get(city);
}

// Clear cache after bulk operation completes
function clearExampleCache() {
  cityCache.clear();
}
```

## Data Migration Strategy

### Initial Population

**Option 1: Manual Entry** (Recommended for Phase 4 launch)

Advantages:
- Quality control
- Curated examples
- Verified store URLs

Process:
1. Identify top 5-10 cities
2. Select 2-3 best examples per city
3. Manually insert via admin UI (to be built in Phase 4)

**Option 2: Automated from Existing Data**

```sql
-- Auto-populate from successful customers
INSERT INTO city_example_customers (
  organisation_id,
  city,
  restaurant_id,
  display_name,
  store_url,
  display_order,
  is_active
)
SELECT
  organisation_id,
  city,
  id as restaurant_id,
  name as display_name,
  subdomain || '.pumpd.co.nz' as store_url,
  ROW_NUMBER() OVER (
    PARTITION BY organisation_id, city
    ORDER BY created_at ASC
  ) as display_order,
  true as is_active
FROM restaurants
WHERE subdomain IS NOT NULL
  AND city IS NOT NULL
  AND lead_status = 'customer'
  AND demo_store_built = true
ORDER BY city, created_at;
```

Advantages:
- Fast initial population
- Real customer data

Disadvantages:
- May include suboptimal examples
- Requires manual review and cleanup

### Maintenance

**Regular Tasks:**

1. **Add New Customers** (when restaurant goes live):
   - Admin manually adds to example list
   - Or automated trigger on status change

2. **Update URLs** (when subdomain changes):
   - Update `store_url` field
   - Or sync from restaurants table

3. **Deactivate Examples** (when restaurant churns):
   - Set `is_active = false`
   - Keep historical data

4. **Reorder Examples** (optimize for conversion):
   - Update `display_order` based on performance
   - A/B test different examples

## Admin UI Requirements

**Phase 4 Deliverable:** Admin interface for managing example customers

**Location:** `/admin/example-customers` or `/settings/messaging/examples`

**Features Required:**

1. **List View**
   - Group by city
   - Show active/inactive status
   - Display order controls (up/down arrows)

2. **Create Form**
   - City selector/autocomplete
   - Restaurant dropdown (from existing customers)
   - Manual fields: display_name, store_url
   - Display order number
   - Active checkbox

3. **Edit Form**
   - Same as create
   - Update display order
   - Toggle active status

4. **Delete**
   - Soft delete (set is_active = false)
   - Or hard delete with confirmation

5. **Bulk Operations**
   - Reorder multiple examples
   - Bulk activate/deactivate
   - Import from CSV

## Testing Data

```sql
-- Test data for development/staging
INSERT INTO city_example_customers (
  organisation_id,
  city,
  display_name,
  store_url,
  display_order,
  is_active
) VALUES
  -- Auckland
  ('test-org-id', 'Auckland', 'Test Restaurant 1', 'https://test1.pumpd.co.nz', 1, true),
  ('test-org-id', 'Auckland', 'Test Restaurant 2', 'https://test2.pumpd.co.nz', 2, true),
  ('test-org-id', 'Auckland', 'Inactive Example', 'https://inactive.pumpd.co.nz', 3, false),

  -- Wellington
  ('test-org-id', 'Wellington', 'Wellington Example 1', 'https://welly1.pumpd.co.nz', 1, true),
  ('test-org-id', 'Wellington', 'Wellington Example 2', 'https://welly2.pumpd.co.nz', 2, true),

  -- City with only one example
  ('test-org-id', 'Christchurch', 'Chch Example', 'https://chch1.pumpd.co.nz', 1, true);
```

## Monitoring & Metrics

**Queries to Monitor:**

1. **Usage by City:**
   ```sql
   SELECT city, COUNT(*) as example_count
   FROM city_example_customers
   WHERE is_active = true
   GROUP BY city
   ORDER BY example_count DESC;
   ```

2. **Cities Without Examples:**
   ```sql
   SELECT DISTINCT city
   FROM restaurants
   WHERE city NOT IN (
     SELECT DISTINCT city
     FROM city_example_customers
     WHERE is_active = true
   )
   ORDER BY city;
   ```

3. **Inactive Examples:**
   ```sql
   SELECT city, display_name, created_at
   FROM city_example_customers
   WHERE is_active = false
   ORDER BY city, display_order;
   ```

---

**Last Updated:** 2025-01-26
**Version:** 1.0
**Status:** Ready for Phase 4 Implementation
