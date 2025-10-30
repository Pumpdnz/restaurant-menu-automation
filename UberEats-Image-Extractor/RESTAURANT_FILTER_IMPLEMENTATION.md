# Restaurant Filter for Image Selection - Implementation Summary

## ✅ Implementation Complete

Added the ability to filter menu item images by restaurant when generating videos in "Image to Video" mode.

## 🎯 What Was Implemented

### 1. Backend API Enhancement

**File**: `server.js` (line 3508)

**Endpoint**: `GET /api/menus/images`

**New Query Parameter**: `restaurantId` (optional)

**Changes**:
- Added support for optional `restaurantId` query parameter
- Extended join to include `menus` table to access `restaurant_id`
- Filters images by restaurant when parameter is provided
- Returns `restaurant_id` in response for each image

**Query Structure**:
```javascript
// Before (all images)
GET /api/menus/images

// After (filtered by restaurant)
GET /api/menus/images?restaurantId=uuid-here
```

**Database Join**:
```sql
item_images
  → menu_items (by menu_item_id)
    → menus (by menu_id)
      → filter by restaurant_id
```

**Response Format**:
```json
{
  "success": true,
  "count": 25,
  "restaurantId": "uuid-or-null",
  "images": [
    {
      "id": "uuid",
      "url": "https://...",
      "cdn_url": "https://..." or null,
      "item_name": "Burger Deluxe",
      "menu_item_id": "uuid",
      "restaurant_id": "uuid"
    }
  ]
}
```

### 2. ImageSelector Component Update

**File**: `src/components/social-media/ImageSelector.tsx`

**New Prop**: `restaurantId?: string`

**Changes**:
- Added optional `restaurantId` prop
- Updated `useEffect` dependency to re-fetch when restaurant changes
- Passes `restaurantId` as query parameter when calling API
- Maintains backwards compatibility (works without restaurant filter)

**Usage**:
```tsx
// Without filter
<ImageSelector value={imageId} onChange={setImageId} />

// With restaurant filter
<ImageSelector
  value={imageId}
  onChange={setImageId}
  restaurantId="uuid-here"
/>
```

### 3. VideoGeneration Page Enhancement

**File**: `src/pages/VideoGeneration.tsx`

**New Features**:
1. **Restaurant dropdown** for filtering images
2. **Auto-loads** list of restaurants on page mount
3. **"All Restaurants"** option to show all images
4. **Passes restaurant ID** to video generation API

**UI Structure** (Mode 1 only):
```tsx
<Card>
  {/* Restaurant Filter */}
  <Select value={selectedRestaurantId}>
    <SelectItem value="">All Restaurants</SelectItem>
    {restaurants.map(...)}
  </Select>

  {/* Image Selector with filter */}
  <ImageSelector
    value={selectedImageId}
    restaurantId={selectedRestaurantId || undefined}
  />
</Card>
```

**State Added**:
```typescript
const [selectedRestaurantId, setSelectedRestaurantId] = useState<string>('');
const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
const [loadingRestaurants, setLoadingRestaurants] = useState(false);
```

## 🔄 User Flow

### Image Selection with Restaurant Filter

1. User selects "Image to Video" mode
2. **Restaurant dropdown appears** at the top of the image selector
3. User can choose:
   - **"All Restaurants"** → Shows all images from all restaurants
   - **Specific restaurant** → Shows only that restaurant's images
4. Images update dynamically when restaurant selection changes
5. User selects an image
6. Restaurant ID is included in video generation request

### API Flow

```
User selects restaurant →
  Frontend calls /api/menus/images?restaurantId=uuid →
    Backend joins item_images → menu_items → menus →
      Filters by restaurant_id →
        Returns filtered images →
          UI displays restaurant-specific images
```

## 📊 Database Relationships

```
item_images (organisation_id, menu_item_id, url, cdn_url)
    ↓ (FK: menu_item_id)
menu_items (id, name, menu_id)
    ↓ (FK: menu_id)
menus (id, restaurant_id)
    ↓ (FK: restaurant_id)
restaurants (id, name)
```

**Filter Logic**:
- User's org: `item_images.organisation_id = user.organisationId`
- Restaurant: `menus.restaurant_id = selectedRestaurantId`

## ✅ Benefits

1. **Focused Image Selection**: Users can narrow down to a specific restaurant's menu items
2. **Better UX**: Reduces clutter when organizations have multiple restaurants
3. **Faster Selection**: Fewer images to scroll through
4. **Context Awareness**: Video is associated with correct restaurant in metadata
5. **Backwards Compatible**: Works with or without restaurant filter

## 🎨 UI Improvements

**Before**:
- Shows all images from all restaurants mixed together
- Hard to find specific restaurant's items

**After**:
- Dropdown to select restaurant
- Only shows relevant images
- "All Restaurants" option for flexibility
- Cleaner, more organized interface

## 🔐 Security

- ✅ Authentication required (`authMiddleware`)
- ✅ Organization filtering (RLS compatible)
- ✅ Only shows user's own restaurants and images
- ✅ Restaurant ID validated through join (can't access other orgs)

## 📝 Testing

### Test Cases

1. **No Filter (All Images)**:
   ```
   GET /api/menus/images
   → Returns all images for user's organization
   ```

2. **With Restaurant Filter**:
   ```
   GET /api/menus/images?restaurantId=uuid
   → Returns only images from that restaurant
   ```

3. **Empty Result**:
   ```
   GET /api/menus/images?restaurantId=uuid-with-no-images
   → Returns empty array, no errors
   ```

4. **UI Flow**:
   - Select "Image to Video" mode
   - See restaurant dropdown
   - Select a restaurant
   - Images update to show only that restaurant's items
   - Select an image
   - Generate video successfully

## 🚀 Next Steps (Future Enhancements)

1. **Menu-level filtering**: Filter by specific menu within restaurant
2. **Category filtering**: Filter by item category
3. **Recent items**: Show recently used images first
4. **Favorites**: Ability to mark favorite images
5. **Bulk operations**: Generate videos for multiple items at once

---

**Implementation Complete**: Restaurant filtering now works seamlessly for image-to-video generation! 🎉
