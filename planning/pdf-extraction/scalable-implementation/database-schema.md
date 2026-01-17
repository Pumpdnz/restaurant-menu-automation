# Database Schema - PDF Menu Extraction

## Overview

The PDF extraction system leverages the existing database schema with minimal modifications. The core tables (`menus`, `categories`, `menu_items`, `item_images`) already support multi-platform menu management. We only need to extend `extraction_jobs` to track PDF-specific extraction details.

## Existing Schema (No Changes)

### Platforms Table
```sql
CREATE TABLE platforms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR NOT NULL UNIQUE,
  base_url VARCHAR,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**PDF Platform Record:**
```sql
INSERT INTO platforms (name, base_url, is_active) VALUES
  ('PDF', NULL, true);
```

### Restaurants Table
```sql
CREATE TABLE restaurants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR NOT NULL,
  slug VARCHAR UNIQUE,
  email VARCHAR,
  phone VARCHAR,
  address TEXT,
  logo_url TEXT,
  brand_colors JSONB,
  organisation_id UUID REFERENCES organisations(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  -- ... additional fields
);
```

### Menus Table
```sql
CREATE TABLE menus (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID REFERENCES restaurants(id) NOT NULL,
  extraction_job_id UUID REFERENCES extraction_jobs(id),
  platform_id UUID REFERENCES platforms(id),
  version INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  menu_data JSONB,
  organisation_id UUID REFERENCES organisations(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**PDF Menu Example:**
```sql
INSERT INTO menus (
  restaurant_id,
  extraction_job_id,
  platform_id,
  version,
  menu_data,
  organisation_id
) VALUES (
  'f2995098-3a86-481e-9cf0-0faf73dcf799',  -- Chaat Street
  '550e8400-e29b-41d4-a716-446655440000',  -- Job ID
  (SELECT id FROM platforms WHERE name = 'PDF'),
  1,
  '{"source": "chaat-street-new-menu.pdf", "pages": 4}'::jsonb,
  'nmjcjlstjavkefpswzxs'
);
```

### Categories Table
```sql
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  menu_id UUID REFERENCES menus(id) NOT NULL,
  name VARCHAR NOT NULL,
  description TEXT,
  position INTEGER,
  selector VARCHAR,
  is_active BOOLEAN DEFAULT true,
  organisation_id UUID REFERENCES organisations(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### Menu Items Table
```sql
CREATE TABLE menu_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id UUID REFERENCES categories(id) NOT NULL,
  menu_id UUID REFERENCES menus(id) NOT NULL,
  name VARCHAR NOT NULL,
  description TEXT,
  price NUMERIC,
  currency VARCHAR DEFAULT 'NZD',
  tags TEXT[],
  dietary_info JSONB,
  platform_item_id VARCHAR,
  is_available BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}'::jsonb,
  organisation_id UUID REFERENCES organisations(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**PDF Menu Item Example:**
```sql
INSERT INTO menu_items (
  category_id,
  menu_id,
  name,
  description,
  price,
  tags,
  metadata,
  organisation_id
) VALUES (
  'd921b036-...',  -- Short Bites category
  '4be2e25c-...',  -- Menu ID
  'Jhol Momo',
  'Five pieces. Halal. Indo Nepalese chicken dumplings served with Timur and peanut achar.',
  24.00,
  ARRAY['Dairy Free'],
  '{"extracted_from": "PDF", "page": 1, "position": "top"}'::jsonb,
  'nmjcjlstjavkefpswzxs'
);
```

### Item Images Table
```sql
CREATE TABLE item_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  menu_item_id UUID REFERENCES menu_items(id) NOT NULL,
  url TEXT NOT NULL,              -- Original source URL (or local path)
  type VARCHAR(50) DEFAULT 'primary',
  width INTEGER,
  height INTEGER,
  file_size INTEGER,

  -- CDN fields (already exist!)
  is_downloaded BOOLEAN DEFAULT false,
  local_path TEXT,
  cdn_uploaded BOOLEAN DEFAULT false,
  cdn_id UUID,
  cdn_url TEXT,
  cdn_filename VARCHAR,
  cdn_metadata JSONB,
  upload_status VARCHAR,
  upload_error TEXT,
  uploaded_at TIMESTAMP,

  organisation_id UUID REFERENCES organisations(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**PDF Image Example:**
```sql
INSERT INTO item_images (
  menu_item_id,
  url,
  type,
  cdn_uploaded,
  cdn_id,
  cdn_url,
  cdn_filename,
  upload_status,
  organisation_id
) VALUES (
  '55e2ff1b-...',  -- Jhol Momo item
  'local://chaat-street-photos/JHOL MOMO-1.jpg',
  'primary',
  true,
  '78b71d0b-c501-4209-b44d-8189c1675d7b',
  'https://ucarecdn.com/78b71d0b-c501-4209-b44d-8189c1675d7b/',
  'short-bites-jhol-momo.jpeg',
  'success',
  'nmjcjlstjavkefpswzxs'
);
```

### Upload Batches Table
```sql
CREATE TABLE upload_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_id UUID REFERENCES menus(id),
  total_images INTEGER NOT NULL,
  uploaded_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  status VARCHAR DEFAULT 'pending',
  started_at TIMESTAMP DEFAULT now(),
  completed_at TIMESTAMP,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);
```

---

## Modified Schema

### Extraction Jobs Table (Extended)

**Current Schema:**
```sql
CREATE TABLE extraction_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id VARCHAR UNIQUE NOT NULL,
  restaurant_id UUID REFERENCES restaurants(id),
  platform_id UUID REFERENCES platforms(id),
  url TEXT NOT NULL,
  job_type VARCHAR NOT NULL,
  status VARCHAR DEFAULT 'pending',
  progress JSONB DEFAULT '{}'::jsonb,
  config JSONB DEFAULT '{}'::jsonb,
  error TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  organisation_id UUID REFERENCES organisations(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**Proposed Extensions:**

```sql
-- Migration: Add PDF-specific fields to extraction_jobs
ALTER TABLE extraction_jobs
  -- PDF source tracking
  ADD COLUMN pdf_filename VARCHAR,
  ADD COLUMN pdf_file_size INTEGER,
  ADD COLUMN pdf_page_count INTEGER,

  -- Extraction results
  ADD COLUMN extraction_method VARCHAR
    CHECK (extraction_method IN ('standard', 'premium', 'pdf', 'manual')),
  ADD COLUMN extraction_confidence NUMERIC
    CHECK (extraction_confidence >= 0 AND extraction_confidence <= 1),
  ADD COLUMN extraction_metadata JSONB DEFAULT '{}'::jsonb,

  -- Image processing tracking
  ADD COLUMN images_extracted INTEGER DEFAULT 0,
  ADD COLUMN images_compressed INTEGER DEFAULT 0,
  ADD COLUMN images_uploaded INTEGER DEFAULT 0,

  -- Validation and quality
  ADD COLUMN validation_status VARCHAR
    CHECK (validation_status IN ('pending', 'passed', 'failed', 'needs_review')),
  ADD COLUMN validation_errors JSONB DEFAULT '[]'::jsonb;
```

**PDF Extraction Job Example:**
```sql
INSERT INTO extraction_jobs (
  job_id,
  restaurant_id,
  platform_id,
  url,
  job_type,
  status,
  progress,
  config,
  pdf_filename,
  pdf_file_size,
  pdf_page_count,
  extraction_method,
  extraction_confidence,
  extraction_metadata,
  images_extracted,
  images_compressed,
  images_uploaded,
  validation_status,
  organisation_id
) VALUES (
  'pdf_1729468800000_a1b2c3d4',
  'f2995098-3a86-481e-9cf0-0faf73dcf799',  -- Chaat Street
  (SELECT id FROM platforms WHERE name = 'PDF'),
  'local://planning/pdf-extraction/chaat-street-new-menu.pdf',
  'pdf_extraction',
  'processing',
  '{
    "step": "image_upload",
    "current": 5,
    "total": 13,
    "percentage": 38
  }'::jsonb,
  '{
    "auto_extract_images": true,
    "compression_quality": 85,
    "image_matching_threshold": 0.8
  }'::jsonb,
  'chaat-street-new-menu.pdf',
  4814646,  -- ~4.8MB
  4,
  'pdf',
  0.92,
  '{
    "parser": "firecrawl_pdf",
    "extraction_time_ms": 45320,
    "categories_found": 8,
    "items_found": 35
  }'::jsonb,
  13,
  13,
  5,
  'needs_review',
  'nmjcjlstjavkefpswzxs'
);
```

### Migration Script

```sql
-- Migration: add_pdf_extraction_support.sql
-- Description: Add PDF extraction tracking to extraction_jobs table
-- Date: 2025-10-20

BEGIN;

-- Add new columns for PDF tracking
ALTER TABLE extraction_jobs
  ADD COLUMN IF NOT EXISTS pdf_filename VARCHAR,
  ADD COLUMN IF NOT EXISTS pdf_file_size INTEGER,
  ADD COLUMN IF NOT EXISTS pdf_page_count INTEGER,
  ADD COLUMN IF NOT EXISTS extraction_method VARCHAR
    CHECK (extraction_method IN ('standard', 'premium', 'pdf', 'manual')),
  ADD COLUMN IF NOT EXISTS extraction_confidence NUMERIC
    CHECK (extraction_confidence >= 0 AND extraction_confidence <= 1),
  ADD COLUMN IF NOT EXISTS extraction_metadata JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS images_extracted INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS images_compressed INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS images_uploaded INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS validation_status VARCHAR
    CHECK (validation_status IN ('pending', 'passed', 'failed', 'needs_review')),
  ADD COLUMN IF NOT EXISTS validation_errors JSONB DEFAULT '[]'::jsonb;

-- Create index for PDF extractions
CREATE INDEX IF NOT EXISTS idx_extraction_jobs_pdf
  ON extraction_jobs(extraction_method)
  WHERE extraction_method = 'pdf';

-- Create index for validation status
CREATE INDEX IF NOT EXISTS idx_extraction_jobs_validation
  ON extraction_jobs(validation_status)
  WHERE validation_status = 'needs_review';

-- Update existing extraction methods (backfill)
UPDATE extraction_jobs
  SET extraction_method = CASE
    WHEN job_type = 'premium_extraction' THEN 'premium'
    WHEN job_type LIKE '%batch%' THEN 'standard'
    ELSE 'standard'
  END
  WHERE extraction_method IS NULL;

COMMIT;

-- Rollback script (if needed)
-- BEGIN;
-- ALTER TABLE extraction_jobs
--   DROP COLUMN IF EXISTS pdf_filename,
--   DROP COLUMN IF EXISTS pdf_file_size,
--   DROP COLUMN IF EXISTS pdf_page_count,
--   DROP COLUMN IF EXISTS extraction_method,
--   DROP COLUMN IF EXISTS extraction_confidence,
--   DROP COLUMN IF EXISTS extraction_metadata,
--   DROP COLUMN IF EXISTS images_extracted,
--   DROP COLUMN IF EXISTS images_compressed,
--   DROP COLUMN IF EXISTS images_uploaded,
--   DROP COLUMN IF EXISTS validation_status,
--   DROP COLUMN IF EXISTS validation_errors;
-- COMMIT;
```

---

## Data Models

### Extraction Job Progress

**Progress Tracking Schema:**
```typescript
interface ExtractionProgress {
  step: 'upload' | 'parsing' | 'transformation' | 'image_processing' | 'database_save' | 'completed';
  current: number;
  total: number;
  percentage: number;
  details?: {
    categoriesFound?: number;
    itemsFound?: number;
    imagesProcessed?: number;
    warnings?: string[];
  };
}
```

**Example:**
```json
{
  "step": "image_processing",
  "current": 8,
  "total": 13,
  "percentage": 61,
  "details": {
    "categoriesFound": 8,
    "itemsFound": 35,
    "imagesProcessed": 8,
    "warnings": [
      "Item 'Vada Pav' has no image association"
    ]
  }
}
```

### Extraction Configuration

**Config Schema:**
```typescript
interface ExtractionConfig {
  auto_extract_images: boolean;
  compression_quality: number;  // 60-95
  image_matching_threshold: number;  // 0.0-1.0
  max_items: number;  // Safety limit
  require_prices: boolean;  // Fail if prices missing
  validation_strict: boolean;  // Strict vs lenient validation
}
```

**Example:**
```json
{
  "auto_extract_images": true,
  "compression_quality": 85,
  "image_matching_threshold": 0.8,
  "max_items": 500,
  "require_prices": false,
  "validation_strict": false
}
```

### Extraction Metadata

**Metadata Schema:**
```typescript
interface ExtractionMetadata {
  parser: string;
  extraction_time_ms: number;
  categories_found: number;
  items_found: number;
  images_found: number;
  firecrawl_job_id?: string;
  pdf_structure?: {
    layout: 'single-column' | 'multi-column' | 'complex';
    quality: 'high' | 'medium' | 'low';
    has_images: boolean;
    is_scanned: boolean;
  };
}
```

**Example:**
```json
{
  "parser": "firecrawl_pdf",
  "extraction_time_ms": 45320,
  "categories_found": 8,
  "items_found": 35,
  "images_found": 13,
  "firecrawl_job_id": "fc_abc123xyz",
  "pdf_structure": {
    "layout": "single-column",
    "quality": "high",
    "has_images": true,
    "is_scanned": false
  }
}
```

### Validation Errors

**Validation Error Schema:**
```typescript
interface ValidationError {
  type: 'missing_field' | 'invalid_value' | 'data_quality' | 'image_association';
  severity: 'error' | 'warning' | 'info';
  message: string;
  item_id?: string;
  field?: string;
  suggested_fix?: string;
}
```

**Example:**
```json
[
  {
    "type": "missing_field",
    "severity": "warning",
    "message": "Item 'Vada Pav' is missing price",
    "item_id": "bGEUlOs1L",
    "field": "price",
    "suggested_fix": "Add price or mark as 'Market Price'"
  },
  {
    "type": "image_association",
    "severity": "info",
    "message": "No image found for 'Chai and Biscuit'",
    "item_id": "f0654e72",
    "suggested_fix": "Upload image manually or skip"
  }
]
```

---

## Query Examples

### Create PDF Extraction Job

```sql
INSERT INTO extraction_jobs (
  job_id,
  restaurant_id,
  platform_id,
  url,
  job_type,
  status,
  config,
  pdf_filename,
  extraction_method,
  validation_status,
  organisation_id
)
SELECT
  :jobId,
  :restaurantId,
  (SELECT id FROM platforms WHERE name = 'PDF'),
  :pdfPath,
  'pdf_extraction',
  'pending',
  :config::jsonb,
  :filename,
  'pdf',
  'pending',
  :organisationId
RETURNING *;
```

### Update Extraction Progress

```sql
UPDATE extraction_jobs
SET
  status = :status,
  progress = :progress::jsonb,
  images_compressed = :imagesCompressed,
  images_uploaded = :imagesUploaded,
  updated_at = now()
WHERE job_id = :jobId
RETURNING *;
```

### Get PDF Extractions for Restaurant

```sql
SELECT
  ej.*,
  p.name as platform_name,
  r.name as restaurant_name,
  COUNT(mi.id) as item_count,
  COUNT(ii.id) FILTER (WHERE ii.cdn_uploaded = true) as images_uploaded_count
FROM extraction_jobs ej
  JOIN platforms p ON ej.platform_id = p.id
  JOIN restaurants r ON ej.restaurant_id = r.id
  LEFT JOIN menus m ON ej.id = m.extraction_job_id
  LEFT JOIN menu_items mi ON m.id = mi.menu_id
  LEFT JOIN item_images ii ON mi.id = ii.menu_item_id
WHERE
  ej.restaurant_id = :restaurantId
  AND ej.extraction_method = 'pdf'
GROUP BY ej.id, p.name, r.name
ORDER BY ej.created_at DESC
LIMIT 50;
```

### Get Extractions Needing Review

```sql
SELECT
  ej.*,
  r.name as restaurant_name,
  jsonb_array_length(ej.validation_errors) as error_count
FROM extraction_jobs ej
  JOIN restaurants r ON ej.restaurant_id = r.id
WHERE
  ej.validation_status = 'needs_review'
  AND ej.status = 'completed'
  AND ej.organisation_id = :organisationId
ORDER BY ej.completed_at DESC;
```

### Get Menu with Complete Relations

```sql
SELECT
  m.*,
  json_agg(
    DISTINCT jsonb_build_object(
      'id', c.id,
      'name', c.name,
      'position', c.position,
      'items', (
        SELECT json_agg(
          jsonb_build_object(
            'id', mi.id,
            'name', mi.name,
            'description', mi.description,
            'price', mi.price,
            'tags', mi.tags,
            'images', (
              SELECT json_agg(
                jsonb_build_object(
                  'id', ii.id,
                  'cdn_url', ii.cdn_url,
                  'cdn_id', ii.cdn_id,
                  'cdn_filename', ii.cdn_filename,
                  'type', ii.type
                )
              )
              FROM item_images ii
              WHERE ii.menu_item_id = mi.id
                AND ii.cdn_uploaded = true
            )
          )
        )
        FROM menu_items mi
        WHERE mi.category_id = c.id
      )
    )
  ) as categories
FROM menus m
  JOIN categories c ON m.id = c.menu_id
WHERE m.id = :menuId
GROUP BY m.id;
```

---

## Indexes

### Existing Indexes
```sql
-- Primary keys (automatic)
-- Foreign keys (automatic)

-- Performance indexes (already exist)
CREATE INDEX idx_menus_restaurant_id ON menus(restaurant_id);
CREATE INDEX idx_menu_items_menu_id ON menu_items(menu_id);
CREATE INDEX idx_item_images_menu_item_id ON item_images(menu_item_id);
CREATE INDEX idx_extraction_jobs_restaurant_id ON extraction_jobs(restaurant_id);
```

### New Indexes (for PDF)
```sql
-- PDF extraction method
CREATE INDEX idx_extraction_jobs_pdf
  ON extraction_jobs(extraction_method)
  WHERE extraction_method = 'pdf';

-- Validation status (for review queue)
CREATE INDEX idx_extraction_jobs_validation
  ON extraction_jobs(validation_status)
  WHERE validation_status = 'needs_review';

-- CDN upload status (for incomplete uploads)
CREATE INDEX idx_item_images_upload_status
  ON item_images(upload_status)
  WHERE upload_status IN ('pending', 'failed');

-- Organisation + extraction method (multi-tenant queries)
CREATE INDEX idx_extraction_jobs_org_method
  ON extraction_jobs(organisation_id, extraction_method);
```

---

## Data Integrity

### Constraints

**Existing:**
```sql
-- Foreign key constraints ensure referential integrity
-- NOT NULL constraints on required fields
-- UNIQUE constraints on job_id, platform names, etc.
-- CHECK constraints on enums (status, validation_status, etc.)
```

**Additional for PDF:**
```sql
-- Ensure PDF extractions have required fields
ALTER TABLE extraction_jobs
  ADD CONSTRAINT chk_pdf_extraction_fields
  CHECK (
    extraction_method != 'pdf' OR (
      pdf_filename IS NOT NULL
      AND pdf_file_size IS NOT NULL
    )
  );

-- Ensure valid confidence scores
ALTER TABLE extraction_jobs
  ADD CONSTRAINT chk_extraction_confidence
  CHECK (
    extraction_confidence IS NULL OR (
      extraction_confidence >= 0 AND extraction_confidence <= 1
    )
  );

-- Ensure image counts are consistent
ALTER TABLE extraction_jobs
  ADD CONSTRAINT chk_image_counts
  CHECK (
    images_compressed <= images_extracted
    AND images_uploaded <= images_compressed
  );
```

### Triggers

**Update Timestamps:**
```sql
-- Already exists for all tables
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_extraction_jobs_updated_at
  BEFORE UPDATE ON extraction_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
```

**Audit Trail (Optional):**
```sql
CREATE TABLE extraction_jobs_audit (
  id UUID DEFAULT uuid_generate_v4(),
  job_id VARCHAR NOT NULL,
  action VARCHAR NOT NULL,  -- INSERT, UPDATE, DELETE
  old_data JSONB,
  new_data JSONB,
  changed_by VARCHAR,
  changed_at TIMESTAMPTZ DEFAULT now()
);

CREATE OR REPLACE FUNCTION audit_extraction_jobs()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'UPDATE') THEN
    INSERT INTO extraction_jobs_audit (job_id, action, old_data, new_data)
    VALUES (NEW.job_id, 'UPDATE', row_to_json(OLD), row_to_json(NEW));
  ELSIF (TG_OP = 'INSERT') THEN
    INSERT INTO extraction_jobs_audit (job_id, action, new_data)
    VALUES (NEW.job_id, 'INSERT', row_to_json(NEW));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_extraction_jobs_trigger
  AFTER INSERT OR UPDATE ON extraction_jobs
  FOR EACH ROW
  EXECUTE FUNCTION audit_extraction_jobs();
```

---

## Database Service Methods

### PDF Extraction Job Methods

```typescript
// Create new PDF extraction job
async createPDFExtractionJob(
  restaurantId: string,
  pdfFilename: string,
  fileSize: number,
  pageCount: number,
  config: ExtractionConfig,
  organisationId: string
): Promise<ExtractionJob>

// Update job progress
async updateExtractionJobProgress(
  jobId: string,
  progress: ExtractionProgress,
  imageStats?: {
    extracted?: number;
    compressed?: number;
    uploaded?: number;
  }
): Promise<ExtractionJob>

// Complete job successfully
async completeExtractionJob(
  jobId: string,
  metadata: ExtractionMetadata,
  validationStatus: 'passed' | 'needs_review',
  validationErrors?: ValidationError[]
): Promise<ExtractionJob>

// Fail job
async failExtractionJob(
  jobId: string,
  error: string
): Promise<ExtractionJob>

// Get job with full details
async getExtractionJobWithMenu(
  jobId: string
): Promise<ExtractionJobWithMenu>
```

### PDF Menu Methods

```typescript
// Save complete PDF extraction to database
async savePDFExtraction(
  jobId: string,
  restaurantId: string,
  menuData: {
    categories: Category[];
    items: MenuItem[];
    images: ItemImage[];
  },
  organisationId: string
): Promise<Menu>

// Link images to menu items
async linkImagesToItems(
  menuId: string,
  imageMappings: Array<{
    itemId: string;
    imageId: string;
  }>
): Promise<void>

// Get PDF menu with relations
async getPDFMenuWithRelations(
  menuId: string
): Promise<MenuWithRelations>
```

---

**Last Updated:** October 20, 2025
**Status:** Schema design complete, ready for implementation
