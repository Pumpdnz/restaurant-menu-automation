# Database Schema: PDF Menu Processing

**Last Updated:** 2025-10-20

---

## Overview

This document describes the database schema used for storing menu data extracted from PDF files. The schema is designed to support multi-restaurant, multi-platform menu management with CDN image references and version tracking.

**Database:** Supabase (PostgreSQL 17.4.1)
**Project ID:** qgabsyggzlkcstjzugdh
**Restaurant ID:** f2995098-3a86-481e-9cf0-0faf73dcf799 (Chaat Street)

---

## Entity Relationship Diagram

```
┌──────────────┐
│ restaurants  │
│ (Chaat St.)  │
└──────┬───────┘
       │
       │ 1:N
       ▼
┌──────────────┐
│    menus     │      ┌─────────────────┐
│ (version 2)  │◄─────┤ extraction_jobs │
└──────┬───────┘      └─────────────────┘
       │
       │ 1:N
       ▼
┌──────────────┐
│  categories  │
│ (8 sections) │
└──────┬───────┘
       │
       │ 1:N
       ▼
┌──────────────┐
│  menu_items  │
│ (35 dishes)  │
└──────┬───────┘
       │
       │ 1:N
       ▼
┌──────────────┐
│ item_images  │
│ (with CDN)   │
└──────────────┘
```

---

## Table Schemas

### 1. restaurants

**Purpose:** Store restaurant information and metadata

```sql
CREATE TABLE restaurants (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                  VARCHAR NOT NULL,
  slug                  VARCHAR UNIQUE,
  address               TEXT,
  phone                 VARCHAR,
  email                 VARCHAR,
  website               VARCHAR,
  logo_url              TEXT,
  brand_colors          JSONB,
  metadata              JSONB DEFAULT '{}'::jsonb,

  -- Additional fields (truncated for brevity)
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),

  -- Constraints
  CONSTRAINT restaurants_pkey PRIMARY KEY (id)
);
```

**Key Fields for PDF Processing:**
- `id` - Restaurant identifier (f2995098-3a86-481e-9cf0-0faf73dcf799)
- `name` - "Chaat Street"
- `logo_url` - Restaurant logo URL
- `metadata` - Additional data storage

**Example Record:**
```json
{
  "id": "f2995098-3a86-481e-9cf0-0faf73dcf799",
  "name": "Chaat Street",
  "email": "chaat.street@example.com",
  "metadata": {
    "menu_source": "pdf",
    "pdf_processing_date": "2025-10-20"
  }
}
```

---

### 2. menus

**Purpose:** Store menu versions with platform tracking

```sql
CREATE TABLE menus (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id         UUID NOT NULL REFERENCES restaurants(id),
  extraction_job_id     UUID REFERENCES extraction_jobs(id),
  platform_id           UUID REFERENCES platforms(id),
  version               INTEGER DEFAULT 1,
  is_active             BOOLEAN DEFAULT true,
  menu_data             JSONB,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),

  -- Merge tracking
  merge_source_ids      UUID[],
  is_merged             BOOLEAN DEFAULT false,
  merge_operation_id    UUID REFERENCES merge_operations(id),
  organisation_id       UUID REFERENCES organisations(id),

  -- Constraints
  CONSTRAINT menus_pkey PRIMARY KEY (id),
  CONSTRAINT menus_restaurant_id_fkey FOREIGN KEY (restaurant_id)
    REFERENCES restaurants(id)
);
```

**Key Fields for PDF Processing:**
- `id` - Menu identifier (generated)
- `restaurant_id` - Links to Chaat Street
- `platform_id` - PDF platform ID (special platform for PDF imports)
- `version` - Menu version number (increment for updates)
- `is_active` - Only one active menu per restaurant
- `menu_data` - Optional JSON storage for full menu structure

**Example Record:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "restaurant_id": "f2995098-3a86-481e-9cf0-0faf73dcf799",
  "platform_id": "pdf-platform-uuid",
  "version": 2,
  "is_active": true,
  "menu_data": {
    "source": "pdf",
    "pdf_filename": "chaat-street-new-menu.pdf",
    "processed_date": "2025-10-20"
  }
}
```

**SQL Insert:**
```sql
INSERT INTO menus (restaurant_id, platform_id, version, is_active)
VALUES (
  'f2995098-3a86-481e-9cf0-0faf73dcf799',
  '<pdf-platform-id>',
  2,
  true
)
RETURNING id;
```

---

### 3. categories

**Purpose:** Store menu section groupings (e.g., "Short Bites", "Medium Bites")

```sql
CREATE TABLE categories (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  menu_id               UUID NOT NULL REFERENCES menus(id),
  name                  VARCHAR NOT NULL,
  description           TEXT,
  position              INTEGER,
  selector              VARCHAR,
  is_active             BOOLEAN DEFAULT true,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  organisation_id       UUID REFERENCES organisations(id),

  -- Constraints
  CONSTRAINT categories_pkey PRIMARY KEY (id),
  CONSTRAINT categories_menu_id_fkey FOREIGN KEY (menu_id)
    REFERENCES menus(id) ON DELETE CASCADE
);
```

**Key Fields for PDF Processing:**
- `id` - Category identifier (generated)
- `menu_id` - Links to menu record
- `name` - Category name from PDF ("Short Bites", "Medium Bites", etc.)
- `position` - Display order (1, 2, 3...)
- `description` - Optional category description

**Example Records (Chaat Street):**
```json
[
  {
    "id": "cat-uuid-1",
    "menu_id": "menu-uuid",
    "name": "Short Bites",
    "position": 1
  },
  {
    "id": "cat-uuid-2",
    "menu_id": "menu-uuid",
    "name": "Medium Bites",
    "position": 2
  },
  {
    "id": "cat-uuid-3",
    "menu_id": "menu-uuid",
    "name": "Flatbreads",
    "position": 3
  }
  // ... 5 more categories
]
```

**SQL Insert:**
```sql
INSERT INTO categories (menu_id, name, position)
VALUES
  ('<menu-id>', 'Short Bites', 1),
  ('<menu-id>', 'Medium Bites', 2),
  ('<menu-id>', 'Flatbreads', 3),
  ('<menu-id>', 'Fries', 4),
  ('<menu-id>', 'Dessert', 5),
  ('<menu-id>', 'Street Drinks', 6),
  ('<menu-id>', 'Non Alcoholics', 7),
  ('<menu-id>', 'Mocktails', 8)
RETURNING id, name, position;
```

---

### 4. menu_items

**Purpose:** Store individual menu items with pricing and metadata

```sql
CREATE TABLE menu_items (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id           UUID NOT NULL REFERENCES categories(id),
  menu_id               UUID NOT NULL REFERENCES menus(id),
  name                  VARCHAR NOT NULL,
  description           TEXT,
  price                 NUMERIC,
  currency              VARCHAR DEFAULT 'NZD',
  tags                  TEXT[],
  dietary_info          JSONB,
  platform_item_id      VARCHAR,
  is_available          BOOLEAN DEFAULT true,
  metadata              JSONB DEFAULT '{}'::jsonb,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  organisation_id       UUID REFERENCES organisations(id),

  -- Option sets support
  has_option_sets       BOOLEAN DEFAULT false,
  option_sets_extracted_at TIMESTAMPTZ,
  extraction_method     VARCHAR CHECK (extraction_method IN (
    'standard', 'premium', 'clean-url', 'modal-fallback', 'manual'
  )),

  -- Image validation
  image_validated       BOOLEAN DEFAULT false,
  image_validation_data JSONB,

  -- Constraints
  CONSTRAINT menu_items_pkey PRIMARY KEY (id),
  CONSTRAINT menu_items_category_id_fkey FOREIGN KEY (category_id)
    REFERENCES categories(id) ON DELETE CASCADE,
  CONSTRAINT menu_items_menu_id_fkey FOREIGN KEY (menu_id)
    REFERENCES menus(id) ON DELETE CASCADE
);
```

**Key Fields for PDF Processing:**
- `id` - Menu item identifier (generated)
- `category_id` - Links to category
- `menu_id` - Links to menu (denormalized for performance)
- `name` - Item name from PDF ("Jhol Momo", "Bedai Ke Aloo", etc.)
- `description` - Item description
- `price` - Price in NZD
- `tags` - Array of tags (Halal, Vegan, Gluten Free, etc.)
- `dietary_info` - Structured dietary information
- `extraction_method` - 'manual' for PDF imports

**Example Records:**
```json
[
  {
    "id": "item-uuid-1",
    "category_id": "cat-uuid-1",
    "menu_id": "menu-uuid",
    "name": "Jhol Momo",
    "description": "Five pieces. Halal. Indo Nepalese chicken dumplings served with Timur and peanut achar.",
    "price": 24.00,
    "currency": "NZD",
    "tags": ["Dairy Free"],
    "dietary_info": {
      "dairy_free": true,
      "halal": true
    },
    "extraction_method": "manual"
  },
  {
    "id": "item-uuid-2",
    "category_id": "cat-uuid-1",
    "menu_id": "menu-uuid",
    "name": "Bedai Ke Aloo",
    "description": "Potato-filled fried bread with spicy chickpea curry",
    "price": 18.00,
    "currency": "NZD",
    "tags": ["Vegan", "Dairy Free"],
    "dietary_info": {
      "vegan": true,
      "dairy_free": true
    },
    "extraction_method": "manual"
  }
]
```

**Tags Array Parsing:**
```javascript
// CSV format: "Dairy Free~Vegan~Gluten Free"
const tagsString = "Dairy Free~Vegan~Gluten Free";
const tagsArray = tagsString.split('~').filter(Boolean);
// Result: ["Dairy Free", "Vegan", "Gluten Free"]
```

**SQL Insert:**
```sql
INSERT INTO menu_items (
  category_id,
  menu_id,
  name,
  description,
  price,
  currency,
  tags,
  extraction_method
)
VALUES (
  '<category-id>',
  '<menu-id>',
  'Jhol Momo',
  'Five pieces. Halal. Indo Nepalese chicken dumplings served with Timur and peanut achar.',
  24.00,
  'NZD',
  ARRAY['Dairy Free'],
  'manual'
)
RETURNING id;
```

---

### 5. item_images

**Purpose:** Store image references with CDN metadata

```sql
CREATE TABLE item_images (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  menu_item_id          UUID NOT NULL REFERENCES menu_items(id),
  url                   TEXT NOT NULL,
  type                  VARCHAR DEFAULT 'primary',
  width                 INTEGER,
  height                INTEGER,
  file_size             INTEGER,
  is_downloaded         BOOLEAN DEFAULT false,
  local_path            TEXT,
  created_at            TIMESTAMPTZ DEFAULT now(),
  organisation_id       UUID REFERENCES organisations(id),

  -- UploadCare CDN fields
  cdn_uploaded          BOOLEAN DEFAULT false,
  cdn_id                UUID,
  cdn_url               TEXT,
  cdn_filename          VARCHAR,
  cdn_metadata          JSONB,
  upload_status         VARCHAR,
  upload_error          TEXT,
  uploaded_at           TIMESTAMP,

  -- Constraints
  CONSTRAINT item_images_pkey PRIMARY KEY (id),
  CONSTRAINT item_images_menu_item_id_fkey FOREIGN KEY (menu_item_id)
    REFERENCES menu_items(id) ON DELETE CASCADE
);
```

**Key Fields for PDF Processing:**
- `id` - Image identifier (generated)
- `menu_item_id` - Links to menu item
- `url` - Original image URL (local file path for PDF imports)
- `type` - Image type ('primary', 'thumbnail', etc.)
- `cdn_uploaded` - **TRUE for CDN images** (IMPORTANT!)
- `cdn_id` - UploadCare UUID
- `cdn_url` - Full CDN URL (https://ucarecdn.com/uuid/)
- `cdn_filename` - Sanitized filename
- `upload_status` - 'success', 'failed', 'pending'

**Example Records:**
```json
[
  {
    "id": "img-uuid-1",
    "menu_item_id": "item-uuid-1",
    "url": "planning/pdf-extraction/chaat-street-photos/JHOL MOMO-1.jpg",
    "type": "primary",
    "cdn_uploaded": true,
    "cdn_id": "78b71d0b-c501-4209-b44d-8189c1675d7b",
    "cdn_url": "https://ucarecdn.com/78b71d0b-c501-4209-b44d-8189c1675d7b/",
    "cdn_filename": "small-bites-jhol-momo.jpeg",
    "upload_status": "success",
    "uploaded_at": "2025-10-20T14:30:00Z"
  },
  {
    "id": "img-uuid-2",
    "menu_item_id": "item-uuid-2",
    "url": "planning/pdf-extraction/chaat-street-photos/BEDAI KE ALOO-2.jpg",
    "type": "primary",
    "cdn_uploaded": true,
    "cdn_id": "550e8400-e29b-41d4-a716-446655440002",
    "cdn_url": "https://ucarecdn.com/550e8400-e29b-41d4-a716-446655440002/",
    "cdn_filename": "small-bites-bedai-ke-aloo.jpeg",
    "upload_status": "success",
    "uploaded_at": "2025-10-20T14:30:15Z"
  }
]
```

**SQL Insert:**
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
  uploaded_at
)
VALUES (
  '<menu-item-id>',
  'planning/pdf-extraction/chaat-street-photos/JHOL MOMO-1.jpg',
  'primary',
  true,
  '78b71d0b-c501-4209-b44d-8189c1675d7b',
  'https://ucarecdn.com/78b71d0b-c501-4209-b44d-8189c1675d7b/',
  'small-bites-jhol-momo.jpeg',
  'success',
  now()
)
RETURNING id;
```

---

## CSV to Database Mapping

### CSV Column → Database Field Mapping

| CSV Column | Database Table | Database Field | Notes |
|------------|---------------|----------------|-------|
| menuID | menus | id | Generated UUID |
| menuName | menus | menu_data.name | "Menu" (constant) |
| menuDisplayName | - | - | Not stored |
| menuDescription | menus | menu_data.description | Optional |
| categoryID | categories | id | Generated UUID |
| categoryName | categories | name | "Short Bites", etc. |
| categoryDisplayName | - | - | Not stored |
| categoryDescription | categories | description | Optional |
| dishID | menu_items | id | Generated UUID |
| dishName | menu_items | name | Item name |
| dishPrice | menu_items | price | Numeric value |
| dishType | menu_items | metadata.type | "standard" |
| dishDescription | menu_items | description | Full description |
| displayName | - | - | Not stored |
| printName | - | - | Not stored |
| tags | menu_items | tags | Array (split by ~) |
| isCDNImage | item_images | cdn_uploaded | "TRUE" → true |
| imageCDNID | item_images | cdn_id | UUID from UploadCare |
| imageCDNFilename | item_images | cdn_filename | Sanitized filename |
| imageExternalURL | item_images | url | Fallback URL |

### Example CSV Row → Database Records

**CSV Row:**
```csv
4be2e25c,Menu,,,d921b036,Short Bites,,,55e2ff1b,Jhol Momo,24,standard,Five pieces. Halal. Indo Nepalese chicken dumplings served with Timur and peanut achar.,,,Dairy Free,TRUE,78b71d0b-c501-4209-b44d-8189c1675d7b,small-bites-jhol-momo.jpeg,
```

**Database Records Created:**

1. **Menu Record:**
```sql
INSERT INTO menus (id, restaurant_id, version)
VALUES ('4be2e25c', 'f2995098-3a86-481e-9cf0-0faf73dcf799', 2);
```

2. **Category Record:**
```sql
INSERT INTO categories (id, menu_id, name, position)
VALUES ('d921b036', '4be2e25c', 'Short Bites', 1);
```

3. **Menu Item Record:**
```sql
INSERT INTO menu_items (
  id, category_id, menu_id, name, description, price, tags
)
VALUES (
  '55e2ff1b',
  'd921b036',
  '4be2e25c',
  'Jhol Momo',
  'Five pieces. Halal. Indo Nepalese chicken dumplings served with Timur and peanut achar.',
  24,
  ARRAY['Dairy Free']
);
```

4. **Item Image Record:**
```sql
INSERT INTO item_images (
  menu_item_id,
  cdn_uploaded,
  cdn_id,
  cdn_url,
  cdn_filename
)
VALUES (
  '55e2ff1b',
  true,
  '78b71d0b-c501-4209-b44d-8189c1675d7b',
  'https://ucarecdn.com/78b71d0b-c501-4209-b44d-8189c1675d7b/',
  'small-bites-jhol-momo.jpeg'
);
```

---

## Database Operations Sequence

### Complete Import Workflow

```javascript
async function importMenuFromCSV(csvPath, restaurantId) {
  // 1. Parse CSV
  const rows = await parseCSV(csvPath);
  const grouped = groupByCategories(rows);

  // 2. Create menu record
  const menu = await db.menus.create({
    restaurant_id: restaurantId,
    platform_id: PDF_PLATFORM_ID,
    version: 2,
    is_active: true
  });

  // 3. Create categories
  const categories = {};
  for (const [categoryName, items] of Object.entries(grouped)) {
    const category = await db.categories.create({
      menu_id: menu.id,
      name: categoryName,
      position: Object.keys(categories).length + 1
    });
    categories[categoryName] = category;
  }

  // 4. Create menu items and images
  for (const row of rows) {
    const category = categories[row.categoryName];

    // Create menu item
    const item = await db.menu_items.create({
      category_id: category.id,
      menu_id: menu.id,
      name: row.dishName,
      description: row.dishDescription,
      price: parseFloat(row.dishPrice),
      tags: row.tags.split('~').filter(Boolean)
    });

    // Create item image if CDN reference exists
    if (row.isCDNImage === 'TRUE' && row.imageCDNID) {
      await db.item_images.create({
        menu_item_id: item.id,
        url: row.imageExternalURL || '',
        type: 'primary',
        cdn_uploaded: true,
        cdn_id: row.imageCDNID,
        cdn_url: `https://ucarecdn.com/${row.imageCDNID}/`,
        cdn_filename: row.imageCDNFilename,
        upload_status: 'success'
      });
    }
  }

  return menu;
}
```

---

## Validation Queries

### Check Menu Import Success

```sql
-- Verify menu exists
SELECT * FROM menus
WHERE restaurant_id = 'f2995098-3a86-481e-9cf0-0faf73dcf799'
  AND version = 2;

-- Count categories (should be 8)
SELECT COUNT(*) FROM categories
WHERE menu_id = '<menu-id>';

-- Count menu items (should be 35)
SELECT COUNT(*) FROM menu_items
WHERE menu_id = '<menu-id>';

-- Count images with CDN (should match items with images)
SELECT COUNT(*) FROM item_images
WHERE menu_item_id IN (
  SELECT id FROM menu_items WHERE menu_id = '<menu-id>'
)
AND cdn_uploaded = true;

-- Verify all foreign key relationships
SELECT
  m.id AS menu_id,
  m.restaurant_id,
  COUNT(DISTINCT c.id) AS category_count,
  COUNT(DISTINCT mi.id) AS item_count,
  COUNT(DISTINCT ii.id) AS image_count
FROM menus m
LEFT JOIN categories c ON c.menu_id = m.id
LEFT JOIN menu_items mi ON mi.menu_id = m.id
LEFT JOIN item_images ii ON ii.menu_item_id = mi.id
WHERE m.id = '<menu-id>'
GROUP BY m.id, m.restaurant_id;
```

### Verify CDN Images

```sql
-- Check all CDN URLs are valid format
SELECT
  mi.name,
  ii.cdn_url,
  ii.cdn_uploaded,
  ii.upload_status
FROM item_images ii
JOIN menu_items mi ON mi.id = ii.menu_item_id
WHERE mi.menu_id = '<menu-id>'
  AND ii.cdn_uploaded = true;

-- Find items without images
SELECT
  mi.name,
  mi.id
FROM menu_items mi
LEFT JOIN item_images ii ON ii.menu_item_id = mi.id
WHERE mi.menu_id = '<menu-id>'
  AND ii.id IS NULL;
```

---

## Data Integrity Constraints

### Foreign Key Cascade Rules

```sql
-- Categories cascade delete from menus
ON DELETE CASCADE

-- Menu items cascade delete from categories AND menus
ON DELETE CASCADE

-- Item images cascade delete from menu items
ON DELETE CASCADE
```

**Impact:** Deleting a menu record will automatically delete all related categories, menu items, and item images.

### Unique Constraints

- `restaurants.slug` - Restaurant URL slug must be unique
- `menus` - No unique constraints (multiple versions allowed)
- `categories` - Name can repeat across menus
- `menu_items` - Name can repeat across categories/menus
- `item_images` - cdn_id should be unique per menu_item

---

## Performance Considerations

### Indexes

```sql
-- Recommended indexes for PDF processing queries
CREATE INDEX idx_menus_restaurant_id ON menus(restaurant_id);
CREATE INDEX idx_categories_menu_id ON categories(menu_id);
CREATE INDEX idx_menu_items_menu_id ON menu_items(menu_id);
CREATE INDEX idx_menu_items_category_id ON menu_items(category_id);
CREATE INDEX idx_item_images_menu_item_id ON item_images(menu_item_id);
CREATE INDEX idx_item_images_cdn_id ON item_images(cdn_id);
```

### Query Optimization

**Efficient menu retrieval with all related data:**
```sql
SELECT
  m.id AS menu_id,
  c.id AS category_id,
  c.name AS category_name,
  c.position AS category_position,
  mi.id AS item_id,
  mi.name AS item_name,
  mi.price,
  mi.description,
  mi.tags,
  ii.cdn_url AS image_url
FROM menus m
JOIN categories c ON c.menu_id = m.id
JOIN menu_items mi ON mi.category_id = c.id
LEFT JOIN item_images ii ON ii.menu_item_id = mi.id AND ii.type = 'primary'
WHERE m.restaurant_id = 'f2995098-3a86-481e-9cf0-0faf73dcf799'
  AND m.is_active = true
ORDER BY c.position, mi.name;
```

---

## Summary

The database schema provides a robust, normalized structure for storing menu data with CDN image references. The cascade delete rules ensure data integrity, while indexes optimize query performance. The schema supports versioning, platform tracking, and future enhancements like option sets and menu merging.
