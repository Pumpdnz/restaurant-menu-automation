# Database Migrations

This directory contains SQL migration files for the Pumpd automation system.

## Current Migrations

### Demo Booking Feature (2025-01-19)

**Migration Files:**
1. `20250119_add_demo_qualification_columns.sql` - Adds 18 qualification columns to restaurants table
2. `20250119_add_demo_meeting_task_type.sql` - Adds demo_meeting to tasks type constraint
3. `20250119_rollback_demo_qualification.sql` - Rollback script (use only if needed)

**Execution Order:**
Run migrations in this order:
1. First: `20250119_add_demo_qualification_columns.sql`
2. Second: `20250119_add_demo_meeting_task_type.sql`

Both can be run independently, but run qualification columns first for logical ordering.

---

## How to Run Migrations

### Using Supabase CLI

```bash
# Navigate to project root
cd /Users/giannimunro/Desktop/cursor-projects/automation

# Run migrations (if using Supabase CLI)
supabase db push

# Or run specific migration
psql $DATABASE_URL -f supabase/migrations/20250119_add_demo_qualification_columns.sql
psql $DATABASE_URL -f supabase/migrations/20250119_add_demo_meeting_task_type.sql
```

### Using Supabase Dashboard

1. Go to https://supabase.com/dashboard/project/qgabsyggzlkcstjzugdh
2. Navigate to SQL Editor
3. Copy contents of migration file
4. Paste into editor
5. Click "Run"
6. Repeat for second migration file

### Using psql

```bash
# Connect to database
psql "postgresql://postgres:[PASSWORD]@db.qgabsyggzlkcstjzugdh.supabase.co:5432/postgres"

# Run migration
\i supabase/migrations/20250119_add_demo_qualification_columns.sql
\i supabase/migrations/20250119_add_demo_meeting_task_type.sql
```

---

## Pre-Migration Checklist

**Before running migrations in production:**

- [ ] Backup database
  ```sql
  -- Backup restaurants table
  pg_dump -h db.qgabsyggzlkcstjzugdh.supabase.co -U postgres -t restaurants > backup_restaurants_$(date +%Y%m%d).sql

  -- Backup tasks table
  pg_dump -h db.qgabsyggzlkcstjzugdh.supabase.co -U postgres -t tasks > backup_tasks_$(date +%Y%m%d).sql
  ```

- [ ] Test migrations in development environment first
- [ ] Review migration files for correctness
- [ ] Estimate migration time:
  - Qualification columns: ~2-3 minutes
  - Task type: <1 minute
- [ ] Schedule maintenance window (optional, migrations are non-breaking)
- [ ] Notify team of deployment

---

## Post-Migration Verification

After running migrations, verify success:

### 1. Verify New Columns

```sql
-- Check new columns exist
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'restaurants'
  AND column_name IN (
    'contact_role', 'number_of_venues', 'point_of_sale',
    'meeting_link', 'painpoints', 'core_selling_points'
  )
ORDER BY column_name;

-- Expected: 6 rows returned
```

### 2. Verify Indexes

```sql
-- Check indexes created
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'restaurants'
  AND indexname LIKE 'idx_restaurants_%'
ORDER BY indexname;

-- Expected: Should include new indexes for qualification fields
```

### 3. Verify Constraints

```sql
-- Check check constraints
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.restaurants'::regclass
  AND conname LIKE 'restaurants_%_check'
ORDER BY conname;

-- Expected: Should include new constraints
```

### 4. Verify Task Type

```sql
-- Check demo_meeting task type allowed
SELECT conname, pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'public.tasks'::regclass
  AND conname = 'tasks_type_check';

-- Expected: Should contain 'demo_meeting' in definition
```

### 5. Test Creating Demo Meeting Task

```sql
-- Test insert (then rollback)
BEGIN;

INSERT INTO tasks (organisation_id, name, type, restaurant_id)
VALUES (
  (SELECT id FROM organisations LIMIT 1),
  'Test Demo Meeting',
  'demo_meeting',
  (SELECT id FROM restaurants LIMIT 1)
);

ROLLBACK;

-- Expected: Should succeed (then rollback)
```

---

## Rollback Procedure

**⚠️ WARNING: Rollback will delete all qualification data**

Only rollback if absolutely necessary. Consider deprecating columns instead.

### To Rollback:

1. **Backup data first:**
   ```sql
   \copy (SELECT * FROM restaurants WHERE contact_role IS NOT NULL) TO '/tmp/qualification_backup.csv' CSV HEADER;
   ```

2. **Delete or convert demo_meeting tasks:**
   ```sql
   -- Check count
   SELECT COUNT(*) FROM tasks WHERE type = 'demo_meeting';

   -- Option A: Delete
   DELETE FROM tasks WHERE type = 'demo_meeting';

   -- Option B: Convert to internal_activity
   UPDATE tasks SET type = 'internal_activity' WHERE type = 'demo_meeting';
   ```

3. **Run rollback migration:**
   ```bash
   psql $DATABASE_URL -f supabase/migrations/20250119_rollback_demo_qualification.sql
   ```

### Alternative: Deprecate Instead of Rollback

Instead of dropping columns (which loses data), mark them as deprecated:

```sql
-- Mark columns as deprecated
COMMENT ON COLUMN restaurants.contact_role IS 'DEPRECATED - Do not use';
COMMENT ON COLUMN restaurants.meeting_link IS 'DEPRECATED - Do not use';
-- ... etc for all columns
```

This preserves data while preventing new usage.

---

## Troubleshooting

### Migration Fails: "column already exists"

This is safe to ignore. The migration uses `IF NOT EXISTS` so it can be run multiple times.

### Migration Fails: "constraint already exists"

Drop the old constraint first:
```sql
ALTER TABLE restaurants DROP CONSTRAINT IF EXISTS restaurants_number_of_venues_check;
```
Then re-run migration.

### Migration Takes Too Long

The migration should complete in 2-3 minutes. If it takes longer:
1. Check for locks: `SELECT * FROM pg_locks WHERE relation = 'restaurants'::regclass;`
2. Check active queries: `SELECT * FROM pg_stat_activity WHERE state = 'active';`
3. Consider running during low-traffic period

### JSONB Arrays Not Defaulting to []

Existing rows won't have the default. Update them:
```sql
UPDATE restaurants SET painpoints = '[]'::jsonb WHERE painpoints IS NULL;
UPDATE restaurants SET core_selling_points = '[]'::jsonb WHERE core_selling_points IS NULL;
UPDATE restaurants SET features_to_highlight = '[]'::jsonb WHERE features_to_highlight IS NULL;
UPDATE restaurants SET possible_objections = '[]'::jsonb WHERE possible_objections IS NULL;
```

---

## Migration History

| Date | Migration | Description | Status |
|------|-----------|-------------|--------|
| 2025-01-19 | `20250119_add_demo_qualification_columns.sql` | Add 18 qualification columns | ⏳ Pending |
| 2025-01-19 | `20250119_add_demo_meeting_task_type.sql` | Add demo_meeting type | ⏳ Pending |

---

## Support

For issues or questions:
1. Check troubleshooting section above
2. Review migration file comments
3. Consult [database-schema.md](../planning/database-plans/sales-specific-features/demo-booking/database-schema.md)
4. Contact development team

---

**Last Updated:** 2025-01-19
**Supabase Project ID:** qgabsyggzlkcstjzugdh
