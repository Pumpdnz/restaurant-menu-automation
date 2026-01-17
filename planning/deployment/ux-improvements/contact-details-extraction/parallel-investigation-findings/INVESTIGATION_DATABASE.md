# Investigation: Database Schema & Migration Patterns

## Migration File Convention

**Naming:** `YYYYMMDD_description.sql`
**Example:** `20250119_add_demo_qualification_columns.sql`

## Migration Structure Pattern

```sql
BEGIN;

-- Add columns with IF NOT EXISTS for safe re-runs
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS column_name TYPE;

-- Add constraints
ALTER TABLE public.restaurants
  ADD CONSTRAINT restaurants_column_check
  CHECK (condition);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_restaurants_column_name
  ON public.restaurants(column_name);

-- Add comments for documentation
COMMENT ON COLUMN public.restaurants.column_name IS 'Description';

COMMIT;
```

## JSONB Patterns

**Default Values:**
```sql
jsonb_field JSONB DEFAULT '[]'::jsonb  -- Empty array
jsonb_field JSONB DEFAULT '{}'::jsonb  -- Empty object
```

**GIN Indexes for JSONB:**
```sql
CREATE INDEX IF NOT EXISTS idx_restaurants_jsonb_field
  ON public.restaurants USING GIN (jsonb_field);
```

## Database Update Pattern in Code

```javascript
const { error } = await supabase
  .from('restaurants')
  .update({
    field1: value1,
    jsonb_field: { key: value }
  })
  .eq('id', restaurantId)
  .eq('organisation_id', organisationId);  // Multi-tenant safety
```

## Required Migration for Contact Extraction

```sql
-- File: 20251215_add_contact_extraction_columns.sql
BEGIN;

-- Contact/Business Details
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS full_legal_name TEXT,
  ADD COLUMN IF NOT EXISTS nzbn TEXT,
  ADD COLUMN IF NOT EXISTS company_number TEXT,
  ADD COLUMN IF NOT EXISTS gst_number TEXT;

-- Additional Contacts (JSONB)
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS additional_contacts_metadata JSONB DEFAULT '{}'::jsonb;

-- Personal Contact Social Links
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS contact_instagram TEXT,
  ADD COLUMN IF NOT EXISTS contact_facebook TEXT,
  ADD COLUMN IF NOT EXISTS contact_linkedin TEXT;

-- Indexes for searchable fields
CREATE INDEX IF NOT EXISTS idx_restaurants_nzbn
  ON public.restaurants(nzbn);

CREATE INDEX IF NOT EXISTS idx_restaurants_company_number
  ON public.restaurants(company_number);

CREATE INDEX IF NOT EXISTS idx_restaurants_additional_contacts
  ON public.restaurants USING GIN (additional_contacts_metadata);

-- Documentation
COMMENT ON COLUMN public.restaurants.full_legal_name IS 'Full legal name of owner from Companies Office';
COMMENT ON COLUMN public.restaurants.nzbn IS 'New Zealand Business Number';
COMMENT ON COLUMN public.restaurants.company_number IS 'Companies Office registration number';
COMMENT ON COLUMN public.restaurants.gst_number IS 'GST registration number';
COMMENT ON COLUMN public.restaurants.additional_contacts_metadata IS 'Non-primary contact details (directors, shareholders, etc)';

COMMIT;
```

## New Columns Summary

| Column | Type | Purpose |
|--------|------|---------|
| `full_legal_name` | TEXT | Owner's legal name |
| `nzbn` | TEXT | NZ Business Number |
| `company_number` | TEXT | Companies Office number |
| `gst_number` | TEXT | GST registration |
| `additional_contacts_metadata` | JSONB | Secondary contacts |
| `contact_instagram` | TEXT | Contact's Instagram |
| `contact_facebook` | TEXT | Contact's Facebook |
| `contact_linkedin` | TEXT | Contact's LinkedIn |
