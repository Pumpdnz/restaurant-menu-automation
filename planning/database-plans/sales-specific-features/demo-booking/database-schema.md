# Demo Booking Feature - Database Schema

**Version:** 1.0
**Date:** 2025-01-19
**Status:** Design Approved

---

## Table of Contents
1. [Overview](#overview)
2. [Schema Changes](#schema-changes)
3. [Migration Scripts](#migration-scripts)
4. [Data Types & Constraints](#data-types--constraints)
5. [Indexes](#indexes)
6. [Example Data](#example-data)
7. [Rollback Plan](#rollback-plan)

---

## Overview

The demo booking feature adds 18 new columns to the `restaurants` table to store qualification data discovered during the demo booking process. Additionally, the `tasks` table constraint is updated to support the new `demo_meeting` task type.

### Key Principles
- **No Breaking Changes**: All new columns are nullable (optional)
- **Data Integrity**: Constraints ensure data quality where applicable
- **Performance**: Indexes added for filtering and JSONB querying
- **Backward Compatibility**: Existing records unaffected

---

## Schema Changes

### restaurants Table - New Columns

```sql
-- Contact & Business Context
contact_role TEXT
  -- Role/title of the contact person (e.g., Owner, Manager, Director)

number_of_venues INTEGER CHECK (number_of_venues > 0)
  -- Number of restaurant locations/venues

point_of_sale TEXT
  -- Name of POS system (e.g., Lightspeed, Square, Vend)

online_ordering_platform TEXT
  -- Current online ordering platform (e.g., Mr Yum, Mobi2Go, OrderMate)

online_ordering_handles_delivery BOOLEAN
  -- Whether the online ordering platform handles delivery
  -- NULL = unknown, TRUE = yes, FALSE = no

self_delivery BOOLEAN
  -- Whether they do their own delivery (vs third-party)
  -- NULL = unknown, TRUE = yes, FALSE = no

-- UberEats Metrics
weekly_uber_sales_volume NUMERIC(10, 2) CHECK (weekly_uber_sales_volume >= 0)
  -- Weekly sales volume on UberEats in dollars
  -- Precision: 10 digits total, 2 decimal places
  -- Example: 5000.00 = $5,000/week

uber_aov NUMERIC(10, 2) CHECK (uber_aov >= 0)
  -- Average order value on UberEats in dollars
  -- Example: 45.50 = $45.50 average order

uber_markup NUMERIC(5, 2) CHECK (uber_markup >= 0 AND uber_markup <= 100)
  -- Menu markup percentage on UberEats
  -- Example: 30.00 = 30% markup

uber_profitability NUMERIC(5, 2) CHECK (uber_profitability >= -100 AND uber_profitability <= 100)
  -- Profitability percentage on UberEats (can be negative)
  -- Example: 15.00 = 15% profit, -5.00 = 5% loss

uber_profitability_description TEXT
  -- Detailed explanation of profitability
  -- Example: "$70 order in store is $100 on Uber, keeps $25 after commission"

-- Marketing & Website
current_marketing_description TEXT
  -- Description of their current marketing efforts
  -- Free-form text for any marketing activities

website_type TEXT CHECK (website_type IN ('platform_subdomain', 'custom_domain'))
  -- Type of website they have
  -- 'platform_subdomain' = e.g., restaurant.mryum.com
  -- 'custom_domain' = e.g., www.restaurant.co.nz

-- Sales Context (JSON Arrays)
painpoints JSONB DEFAULT '[]'::jsonb
  -- Array of identified painpoints
  -- Format: [{type: 'predefined'|'custom', value: 'string'}, ...]

core_selling_points JSONB DEFAULT '[]'::jsonb
  -- Array of relevant selling points for this prospect
  -- Format: [{type: 'predefined'|'custom', value: 'string'}, ...]

features_to_highlight JSONB DEFAULT '[]'::jsonb
  -- Array of Pumpd features to emphasize for this prospect
  -- Format: [{type: 'predefined'|'custom', value: 'string'}, ...]

possible_objections JSONB DEFAULT '[]'::jsonb
  -- Array of anticipated objections
  -- Format: [{type: 'predefined'|'custom', value: 'string'}, ...]

-- Meeting Details
details TEXT
  -- Additional free-form notes or context from the demo booking

meeting_link TEXT
  -- Link to meeting (Calendly, Zoom, Google Meet, etc.)
  -- Can also be phone number, location, or meeting notes
  -- No validation - flexible format
```

### tasks Table - Constraint Update

```sql
-- Update task type constraint to include 'demo_meeting'
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_type_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_type_check CHECK (
  type IN (
    'internal_activity',
    'social_message',
    'text',
    'email',
    'call',
    'demo_meeting'  -- NEW
  )
);
```

---

## Migration Scripts

### Migration 1: Add Qualification Columns

**File:** `YYYYMMDD_add_demo_qualification_columns.sql`

```sql
-- Migration: Add demo booking qualification columns to restaurants table
-- Date: 2025-01-19
-- Description: Adds 18 new columns for capturing qualification data during demo booking
-- Author: Development Team
-- Estimated Time: ~2-3 minutes on production

BEGIN;

-- Contact & Business Context
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS contact_role TEXT,
  ADD COLUMN IF NOT EXISTS number_of_venues INTEGER,
  ADD COLUMN IF NOT EXISTS point_of_sale TEXT,
  ADD COLUMN IF NOT EXISTS online_ordering_platform TEXT,
  ADD COLUMN IF NOT EXISTS online_ordering_handles_delivery BOOLEAN,
  ADD COLUMN IF NOT EXISTS self_delivery BOOLEAN;

-- Add constraints for number_of_venues
ALTER TABLE public.restaurants
  ADD CONSTRAINT restaurants_number_of_venues_check
  CHECK (number_of_venues IS NULL OR number_of_venues > 0);

-- UberEats Metrics
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS weekly_uber_sales_volume NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS uber_aov NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS uber_markup NUMERIC(5, 2),
  ADD COLUMN IF NOT EXISTS uber_profitability NUMERIC(5, 2),
  ADD COLUMN IF NOT EXISTS uber_profitability_description TEXT;

-- Add constraints for UberEats metrics
ALTER TABLE public.restaurants
  ADD CONSTRAINT restaurants_weekly_uber_sales_volume_check
  CHECK (weekly_uber_sales_volume IS NULL OR weekly_uber_sales_volume >= 0);

ALTER TABLE public.restaurants
  ADD CONSTRAINT restaurants_uber_aov_check
  CHECK (uber_aov IS NULL OR uber_aov >= 0);

ALTER TABLE public.restaurants
  ADD CONSTRAINT restaurants_uber_markup_check
  CHECK (uber_markup IS NULL OR (uber_markup >= 0 AND uber_markup <= 100));

ALTER TABLE public.restaurants
  ADD CONSTRAINT restaurants_uber_profitability_check
  CHECK (uber_profitability IS NULL OR (uber_profitability >= -100 AND uber_profitability <= 100));

-- Marketing & Website
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS current_marketing_description TEXT,
  ADD COLUMN IF NOT EXISTS website_type TEXT;

-- Add constraint for website_type
ALTER TABLE public.restaurants
  ADD CONSTRAINT restaurants_website_type_check
  CHECK (website_type IS NULL OR website_type IN ('platform_subdomain', 'custom_domain'));

-- Sales Context (JSON Arrays)
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS painpoints JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS core_selling_points JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS features_to_highlight JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS possible_objections JSONB DEFAULT '[]'::jsonb;

-- Meeting Details
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS details TEXT,
  ADD COLUMN IF NOT EXISTS meeting_link TEXT;

-- Add B-tree indexes for filtering
CREATE INDEX IF NOT EXISTS idx_restaurants_contact_role
  ON public.restaurants(contact_role)
  TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_restaurants_number_of_venues
  ON public.restaurants(number_of_venues)
  TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_restaurants_website_type
  ON public.restaurants(website_type)
  TABLESPACE pg_default;

-- Add GIN indexes for JSONB array searching
CREATE INDEX IF NOT EXISTS idx_restaurants_painpoints
  ON public.restaurants USING GIN (painpoints)
  TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_restaurants_core_selling_points
  ON public.restaurants USING GIN (core_selling_points)
  TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_restaurants_features_to_highlight
  ON public.restaurants USING GIN (features_to_highlight)
  TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_restaurants_possible_objections
  ON public.restaurants USING GIN (possible_objections)
  TABLESPACE pg_default;

COMMIT;
```

### Migration 2: Add demo_meeting Task Type

**File:** `YYYYMMDD_add_demo_meeting_task_type.sql`

```sql
-- Migration: Add demo_meeting task type to tasks table
-- Date: 2025-01-19
-- Description: Updates task type constraint to include 'demo_meeting'
-- Author: Development Team
-- Estimated Time: <1 minute on production

BEGIN;

-- Drop existing constraint
ALTER TABLE public.tasks
  DROP CONSTRAINT IF EXISTS tasks_type_check;

-- Add new constraint with demo_meeting type
ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_type_check CHECK (
    type IN (
      'internal_activity',
      'social_message',
      'text',
      'email',
      'call',
      'demo_meeting'
    )
  );

COMMIT;
```

---

## Data Types & Constraints

### Numeric Fields

| Column | Type | Range | Precision | Example |
|--------|------|-------|-----------|---------|
| `number_of_venues` | INTEGER | > 0 | - | 3 |
| `weekly_uber_sales_volume` | NUMERIC(10,2) | >= 0 | $99,999,999.99 | 5000.00 |
| `uber_aov` | NUMERIC(10,2) | >= 0 | $99,999,999.99 | 45.50 |
| `uber_markup` | NUMERIC(5,2) | 0-100 | 999.99% | 30.00 |
| `uber_profitability` | NUMERIC(5,2) | -100 to 100 | 999.99% | 15.00 |

### Boolean Fields (Tri-state)

All boolean fields support three states:
- `NULL` - Unknown/Not asked
- `TRUE` - Yes
- `FALSE` - No

| Column | Meaning of TRUE | Meaning of FALSE | Meaning of NULL |
|--------|----------------|------------------|-----------------|
| `online_ordering_handles_delivery` | Platform handles delivery | Platform doesn't handle delivery | Unknown |
| `self_delivery` | Restaurant does own delivery | Uses third-party delivery | Unknown |

### Enum Fields

| Column | Allowed Values | Default |
|--------|---------------|---------|
| `website_type` | 'platform_subdomain', 'custom_domain', NULL | NULL |

### Text Fields (No Length Limit)

All text fields are unlimited length:
- `contact_role`
- `point_of_sale`
- `online_ordering_platform`
- `uber_profitability_description`
- `current_marketing_description`
- `details`
- `meeting_link`

### JSONB Array Fields

All JSONB fields store arrays of objects with this structure:

```json
[
  {
    "type": "predefined",
    "value": "High third-party commission fees"
  },
  {
    "type": "custom",
    "value": "Customer wants integrated loyalty program"
  }
]
```

**Schema Validation:**
- Each item must have `type` and `value` properties
- `type` must be either 'predefined' or 'custom'
- `value` must be a non-empty string
- Array can be empty: `[]`

---

## Indexes

### B-tree Indexes (Standard Filtering)

```sql
-- For filtering by contact role
CREATE INDEX idx_restaurants_contact_role ON restaurants(contact_role);

-- For filtering by number of venues
CREATE INDEX idx_restaurants_number_of_venues ON restaurants(number_of_venues);

-- For filtering by website type
CREATE INDEX idx_restaurants_website_type ON restaurants(website_type);
```

**Use Cases:**
- Filter restaurants by contact role (Owner, Manager, etc.)
- Filter by number of venues (single vs multi-location)
- Filter by website type (custom domain vs platform)

### GIN Indexes (JSONB Array Searching)

```sql
-- For searching within JSONB arrays
CREATE INDEX idx_restaurants_painpoints ON restaurants USING GIN (painpoints);
CREATE INDEX idx_restaurants_core_selling_points ON restaurants USING GIN (core_selling_points);
CREATE INDEX idx_restaurants_features_to_highlight ON restaurants USING GIN (features_to_highlight);
CREATE INDEX idx_restaurants_possible_objections ON restaurants USING GIN (possible_objections);
```

**Use Cases:**
```sql
-- Find restaurants with specific painpoint
SELECT * FROM restaurants
WHERE painpoints @> '[{"type": "predefined", "value": "High third-party commission fees"}]'::jsonb;

-- Find restaurants with any of multiple selling points
SELECT * FROM restaurants
WHERE core_selling_points ?| ARRAY['Get more customers to order directly', 'Improve margins on delivery'];
```

**Performance Characteristics:**
- GIN indexes excellent for containment queries (`@>`, `?`, `?|`, `?&`)
- Slightly larger than B-tree indexes
- Slower inserts/updates but much faster reads
- Perfect for filtering/searching scenarios

---

## Example Data

### Complete Example Restaurant Record

```sql
-- Example of a restaurant with full qualification data
INSERT INTO restaurants (
  id,
  organisation_id,
  name,
  contact_name,
  contact_email,
  contact_phone,
  city,

  -- Qualification data
  contact_role,
  number_of_venues,
  point_of_sale,
  online_ordering_platform,
  online_ordering_handles_delivery,
  self_delivery,
  weekly_uber_sales_volume,
  uber_aov,
  uber_markup,
  uber_profitability,
  uber_profitability_description,
  current_marketing_description,
  website_type,
  painpoints,
  core_selling_points,
  features_to_highlight,
  possible_objections,
  details,
  meeting_link
) VALUES (
  'b8e7d3c4-1234-5678-90ab-cdef12345678'::uuid,
  'org-uuid'::uuid,
  'Bella Pizza',
  'John Smith',
  'john@bellapizza.co.nz',
  '021 123 4567',
  'Auckland',

  -- Qualification data
  'Owner',
  3,
  'Lightspeed',
  'Mr Yum',
  TRUE,
  FALSE,
  5000.00,
  45.50,
  30.00,
  15.00,
  '$70 order in store becomes $100 on Uber. After 30% commission, keeps $70. Net: $0 profit but pays for platform fees.',
  'Currently running Facebook ads, Instagram posts 3x/week, email newsletter monthly',
  'custom_domain',
  '[
    {"type": "predefined", "value": "High third-party commission fees"},
    {"type": "predefined", "value": "Commission eating into margins"},
    {"type": "custom", "value": "Wants better loyalty program"}
  ]'::jsonb,
  '[
    {"type": "predefined", "value": "Get more customers to order directly"},
    {"type": "predefined", "value": "Improve margins on delivery by cutting delivery commissions to 5%"},
    {"type": "predefined", "value": "Built-in loyalty program"}
  ]'::jsonb,
  '[
    {"type": "predefined", "value": "5% commission on delivery orders"},
    {"type": "predefined", "value": "Custom Branding"},
    {"type": "predefined", "value": "Converting first-time customers to regulars with SMS Promotions"}
  ]'::jsonb,
  '[
    {"type": "predefined", "value": "Current Online Ordering is integrated with POS"},
    {"type": "predefined", "value": "Concerned about customer adoption"}
  ]'::jsonb,
  'Very interested in SMS marketing capabilities. Has tried email but low open rates. Mentioned they had custom website before but it broke and they moved to platform.',
  'https://calendly.com/john-smith/pumpd-demo'
);
```

### Example Queries

```sql
-- Find restaurants with 3+ venues
SELECT id, name, number_of_venues
FROM restaurants
WHERE number_of_venues >= 3;

-- Find restaurants concerned about commission fees
SELECT id, name, painpoints
FROM restaurants
WHERE painpoints @> '[{"value": "High third-party commission fees"}]'::jsonb
   OR painpoints @> '[{"value": "Commission eating into margins"}]'::jsonb;

-- Find profitable UberEats restaurants (good candidates)
SELECT id, name, weekly_uber_sales_volume, uber_profitability
FROM restaurants
WHERE uber_profitability > 10
  AND weekly_uber_sales_volume > 3000
ORDER BY weekly_uber_sales_volume DESC;

-- Find restaurants using Lightspeed POS (integration opportunity)
SELECT id, name, point_of_sale
FROM restaurants
WHERE point_of_sale ILIKE '%lightspeed%';

-- Get all demo meetings created this week
SELECT t.*, r.contact_name, r.meeting_link
FROM tasks t
JOIN restaurants r ON t.restaurant_id = r.id
WHERE t.type = 'demo_meeting'
  AND t.created_at >= NOW() - INTERVAL '7 days'
ORDER BY t.due_date;
```

---

## Rollback Plan

### Rollback Migration 1 (Qualification Columns)

**CAUTION**: This will delete all qualification data. Only run if absolutely necessary.

```sql
-- Rollback: Remove demo qualification columns from restaurants table
-- WARNING: This will permanently delete all qualification data

BEGIN;

-- Drop indexes first
DROP INDEX IF EXISTS idx_restaurants_contact_role;
DROP INDEX IF EXISTS idx_restaurants_number_of_venues;
DROP INDEX IF EXISTS idx_restaurants_website_type;
DROP INDEX IF EXISTS idx_restaurants_painpoints;
DROP INDEX IF EXISTS idx_restaurants_core_selling_points;
DROP INDEX IF EXISTS idx_restaurants_features_to_highlight;
DROP INDEX IF EXISTS idx_restaurants_possible_objections;

-- Drop constraints
ALTER TABLE public.restaurants DROP CONSTRAINT IF EXISTS restaurants_number_of_venues_check;
ALTER TABLE public.restaurants DROP CONSTRAINT IF EXISTS restaurants_weekly_uber_sales_volume_check;
ALTER TABLE public.restaurants DROP CONSTRAINT IF EXISTS restaurants_uber_aov_check;
ALTER TABLE public.restaurants DROP CONSTRAINT IF EXISTS restaurants_uber_markup_check;
ALTER TABLE public.restaurants DROP CONSTRAINT IF EXISTS restaurants_uber_profitability_check;
ALTER TABLE public.restaurants DROP CONSTRAINT IF EXISTS restaurants_website_type_check;

-- Drop columns
ALTER TABLE public.restaurants
  DROP COLUMN IF EXISTS contact_role,
  DROP COLUMN IF EXISTS number_of_venues,
  DROP COLUMN IF EXISTS point_of_sale,
  DROP COLUMN IF EXISTS online_ordering_platform,
  DROP COLUMN IF EXISTS online_ordering_handles_delivery,
  DROP COLUMN IF EXISTS self_delivery,
  DROP COLUMN IF EXISTS weekly_uber_sales_volume,
  DROP COLUMN IF EXISTS uber_aov,
  DROP COLUMN IF EXISTS uber_markup,
  DROP COLUMN IF EXISTS uber_profitability,
  DROP COLUMN IF EXISTS uber_profitability_description,
  DROP COLUMN IF EXISTS current_marketing_description,
  DROP COLUMN IF EXISTS website_type,
  DROP COLUMN IF EXISTS painpoints,
  DROP COLUMN IF EXISTS core_selling_points,
  DROP COLUMN IF EXISTS features_to_highlight,
  DROP COLUMN IF EXISTS possible_objections,
  DROP COLUMN IF EXISTS details,
  DROP COLUMN IF EXISTS meeting_link;

COMMIT;
```

### Rollback Migration 2 (demo_meeting Task Type)

**NOTE**: This will fail if any demo_meeting tasks exist. Delete those first.

```sql
-- Rollback: Remove demo_meeting from task type constraint
-- WARNING: This will fail if any tasks with type='demo_meeting' exist

BEGIN;

-- Drop existing constraint
ALTER TABLE public.tasks
  DROP CONSTRAINT IF EXISTS tasks_type_check;

-- Add back old constraint without demo_meeting
ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_type_check CHECK (
    type IN (
      'internal_activity',
      'social_message',
      'text',
      'email',
      'call'
    )
  );

COMMIT;
```

### Pre-Rollback Checklist

Before rolling back:
1. **Backup Data**: Export all qualification data
   ```sql
   COPY (SELECT * FROM restaurants WHERE contact_role IS NOT NULL) TO '/path/to/backup.csv' CSV HEADER;
   ```

2. **Check Dependencies**: Verify no demo_meeting tasks exist
   ```sql
   SELECT COUNT(*) FROM tasks WHERE type = 'demo_meeting';
   ```

3. **Notify Stakeholders**: Inform team of rollback and data loss

4. **Alternative**: Instead of dropping columns, consider deprecating them:
   ```sql
   -- Mark columns as deprecated rather than dropping
   COMMENT ON COLUMN restaurants.contact_role IS 'DEPRECATED - Do not use';
   ```

---

## Database Testing

### Pre-Migration Tests

```sql
-- Test 1: Verify restaurants table exists
SELECT COUNT(*) FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'restaurants';
-- Expected: 1

-- Test 2: Verify tasks table exists
SELECT COUNT(*) FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'tasks';
-- Expected: 1

-- Test 3: Check current task types
SELECT DISTINCT type FROM tasks;
-- Expected: internal_activity, email, call, social_message, text
```

### Post-Migration Tests

```sql
-- Test 1: Verify new columns exist
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'restaurants'
  AND column_name IN ('contact_role', 'meeting_link', 'painpoints');
-- Expected: 3 rows

-- Test 2: Verify indexes created
SELECT indexname FROM pg_indexes
WHERE tablename = 'restaurants'
  AND indexname LIKE 'idx_restaurants_%';
-- Expected: Multiple rows including new indexes

-- Test 3: Test demo_meeting task type constraint
INSERT INTO tasks (organisation_id, name, type)
VALUES ('org-uuid', 'Test Demo', 'demo_meeting');
-- Expected: Success

-- Test 4: Verify JSONB default values
SELECT painpoints FROM restaurants LIMIT 1;
-- Expected: [] for new records

-- Test 5: Test check constraints
INSERT INTO restaurants (organisation_id, name, number_of_venues)
VALUES ('org-uuid', 'Test', -1);
-- Expected: ERROR - check constraint violation

-- Test 6: Test GIN index functionality
SELECT * FROM restaurants
WHERE painpoints @> '[{"value": "test"}]'::jsonb;
-- Expected: Query executes (may return 0 rows)
```

---

**Document Prepared By:** Claude (AI Assistant)
**Last Updated:** 2025-01-19
**Version:** 1.0
**Status:** Ready for Migration
