# Menu Item Images Storage - System Compatibility Analysis

## ✅ System Is Already Compatible!

The existing image storage system in the database works perfectly with the social media video generation feature. **No additional steps or migrations are needed.**

## 📊 Database Structure Analysis

### `item_images` Table Structure
```sql
id                  uuid (PK)
menu_item_id        uuid (FK to menu_items)
url                 text (NOT NULL) -- Original extracted URL
cdn_url             text (NULL)     -- CDN URL if uploaded
organisation_id     uuid            -- Multi-tenant support
type                varchar         -- 'primary' (default)
cdn_uploaded        boolean         -- Upload status flag
created_at          timestamp
-- Additional metadata: width, height, file_size, etc.
```

### `menu_items` Table (Joined for names)
```sql
id                  uuid (PK)
name                varchar (NOT NULL) -- Item name for display
menu_id             uuid (FK)
category_id         uuid (FK)
-- Other fields...
```

## 🔄 How Images Are Currently Stored

### Extraction Process
1. **Web scraping** extracts image URLs from delivery platforms (UberEats, DoorDash)
2. URLs are stored in `item_images.url` field
3. Images are linked to menu items via `menu_item_id`
4. Organization ID ensures multi-tenant data isolation

### CDN Upload (Optional)
- Images can optionally be uploaded to UploadCare CDN
- When uploaded: `cdn_uploaded = true`, `cdn_url` is populated
- Currently, most images only have the original `url` (CDN upload is optional)

### Sample Data
```json
{
  "id": "f6a64ddb-1eaf-4b76-b34e-c6aa209195bb",
  "url": "https://tb-static.uber.com/prod/image-proc/processed_images/...",
  "cdn_url": null,
  "cdn_uploaded": false,
  "organisation_id": "00000000-0000-0000-0000-000000000000",
  "item_name": "Nutella Cheesecake",
  "menu_item_id": "005db34f-5022-475e-b878-8ea9b49a968a"
}
```

## 🎯 Integration with Video Generation

### ImageSelector Component (Mode 1)
The component expects images with:
- `id` - for selection
- `url` - original image URL
- `cdn_url` - CDN URL (optional)
- `item_name` - for display and search

### How It Works
```typescript
// Component displays: cdn_url || url
<img src={image.cdn_url || image.url} />
```

This means:
- ✅ If CDN URL exists → use it (faster, cached)
- ✅ If CDN URL is null → use original URL (still works!)
- ✅ No changes needed to storage mechanism

## 🚀 API Implementation

### New Endpoint: `GET /api/menus/images`

**Location**: `server.js` line 4720

**Purpose**: Fetch menu item images for authenticated user's organization

**Query**:
```sql
SELECT
  ii.id,
  ii.url,
  ii.cdn_url,
  ii.menu_item_id,
  mi.name as item_name
FROM item_images ii
JOIN menu_items mi ON ii.menu_item_id = mi.id
WHERE ii.organisation_id = :organisationId
ORDER BY ii.created_at DESC
LIMIT 500;
```

**Response Format**:
```json
{
  "success": true,
  "count": 150,
  "images": [
    {
      "id": "uuid",
      "url": "https://...",
      "cdn_url": "https://..." or null,
      "item_name": "Nutella Cheesecake",
      "menu_item_id": "uuid"
    }
  ]
}
```

**Features**:
- ✅ Authentication required (authMiddleware)
- ✅ Organization-based filtering (RLS)
- ✅ Joins with menu_items for item names
- ✅ Returns both URL types (original + CDN)
- ✅ Limited to 500 images to prevent excessive data transfer
- ✅ Ordered by most recent first

## 🔐 Security & Multi-Tenancy

### Access Control
- **Authentication**: Uses `authMiddleware` to verify JWT token
- **Organization Filtering**: Automatically filters by `req.user.organisationId`
- **RLS Compatible**: Respects Row Level Security if enabled

### Data Isolation
- Each organization only sees their own images
- Query explicitly filters on `organisation_id`
- No cross-organization data leakage

## 📝 Summary

### What We Found
1. ✅ Images stored as URLs (extracted from delivery platforms)
2. ✅ Optional CDN upload with separate URL field
3. ✅ Linked to menu items via foreign key
4. ✅ Organization-based multi-tenancy already in place
5. ✅ All necessary fields present in database

### What We Did
1. ✅ Created `/api/menus/images` endpoint
2. ✅ Implemented join with menu_items for names
3. ✅ Added organization filtering
4. ✅ Returned both URL types for flexibility

### What We Didn't Need to Do
- ❌ No database migrations required
- ❌ No new tables needed
- ❌ No changes to image storage mechanism
- ❌ No additional upload steps

### Compatibility Rating: **100% Compatible** ✅

The existing image storage system works seamlessly with the video generation feature. Images extracted from delivery platforms can be directly used as input for Sora 2 video generation without any modifications to the storage layer.

## 🎬 Video Generation Flow (Mode 1: Image-to-Video)

1. User selects "Image to Video" mode
2. ImageSelector component calls `GET /api/menus/images`
3. User selects an image from their menu items
4. Image ID is passed to video generation API
5. Backend fetches image URL (cdn_url || url)
6. Image is downloaded and passed to Sora 2 API
7. Sora animates the image based on user's prompt

**Result**: Existing extracted images become animated videos! 🎥
