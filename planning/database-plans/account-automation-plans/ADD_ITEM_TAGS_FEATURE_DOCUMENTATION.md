# Add Item Tags Feature - Complete Documentation

## Feature Overview

The "Add Item Tags" feature automates the creation of predefined dietary and promotional tags on the Pumpd admin portal. It is accessible from the Pumpd Registration tab in the Restaurant Detail page.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Frontend (React)                             │
│  RestaurantDetail.jsx - "Add Item Tags" Button                  │
└──────────────────────────┬──────────────────────────────────────┘
                           │ POST /api/registration/add-item-tags
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Backend (Express)                            │
│  registration-routes.js - /add-item-tags endpoint               │
│  - Validates organisation context                                │
│  - Fetches restaurant name & credentials                        │
│  - Executes Playwright script                                   │
└──────────────────────────┬──────────────────────────────────────┘
                           │ node add-item-tags.js --email --password --name
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Playwright Script                            │
│  add-item-tags.js                                               │
│  - Logs into admin.pumpd.co.nz                                  │
│  - Navigates to Menu > Item Tags                                │
│  - Creates 10 predefined tags                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Files Modified/Created

| File | Type | Description |
|------|------|-------------|
| `scripts/restaurant-registration/add-item-tags.js` | Created | Playwright automation script |
| `UberEats-Image-Extractor/src/routes/registration-routes.js` | Modified | Added POST `/add-item-tags` endpoint |
| `UberEats-Image-Extractor/src/pages/RestaurantDetail.jsx` | Modified | Added button, handler, and state |

---

## Frontend Implementation

### Location
`UberEats-Image-Extractor/src/pages/RestaurantDetail.jsx`

### Changes Summary

#### 1. Import Added (Line 48)
```javascript
import { ..., Tag } from 'lucide-react';
```

#### 2. State Variables (Lines 182-184)
```javascript
// Item Tags states
const [isAddingTags, setIsAddingTags] = useState(false);
const [tagsStatus, setTagsStatus] = useState(null);
```

#### 3. Handler Function (Lines 658-714)
```javascript
const handleAddItemTags = async () => {
  // Validates registration status
  // Calls POST /api/registration/add-item-tags
  // Updates tagsStatus state
  // Shows toast notifications
};
```

#### 4. UI Components (Lines 4451-4504)
- "Add Item Tags" button with outline variant
- Loading spinner during operation
- Success/error alert messages

### Button Location
```
Pumpd Registration Tab
└── Menu CSV Upload Card
    ├── Prerequisites Status
    ├── File Input
    ├── Upload Menu Button
    ├── Add Item Tags Button  ← HERE
    ├── Upload Status Messages
    └── Tags Status Messages
```

---

## Backend Implementation

### Location
`UberEats-Image-Extractor/src/routes/registration-routes.js`

### Endpoint
```
POST /api/registration/add-item-tags
```

### Request
```json
{
  "restaurantId": "uuid-string"
}
```

### Response (Success)
```json
{
  "success": true,
  "message": "Item tags configured successfully",
  "output": "script stdout...",
  "error": null
}
```

### Response (Error)
```json
{
  "success": false,
  "error": "Error message here",
  "details": "script stderr if available"
}
```

### Implementation (Lines 1779-1897)
1. Validates organisation context from JWT
2. Fetches restaurant name from `restaurants` table
3. Fetches credentials via `pumpd_restaurants` → `pumpd_accounts` relationship
4. Executes script with 3-minute timeout
5. Parses stdout for success indicators
6. Returns appropriate response

---

## Script Implementation

### Location
```
/scripts/restaurant-registration/add-item-tags.js
```

### Usage
```bash
node add-item-tags.js \
  --email="restaurant@example.com" \
  --password="Password123!" \
  --name="Restaurant Name" \
  [--debug]
```

### Predefined Tags

| # | Tag Name | Color | Hex Code |
|---|----------|-------|----------|
| 1 | Popular | Purple | `#b400fa` |
| 2 | New | Blue | `#3f92ff` |
| 3 | Deal | Green | `#4fc060` |
| 4 | Vegan | Dark Green | `#36AB36` |
| 5 | Vegetarian | Lime Green | `#32CD32` |
| 6 | Gluten Free | Orange | `#FF8C00` |
| 7 | Dairy Free | Steel Blue | `#4682B4` |
| 8 | Nut Free | Tan | `#DEB887` |
| 9 | Halal | Brown | `#8B7355` |
| 10 | Spicy | Red | `#FF3333` |

### Script Workflow

1. **Login** - Navigate to admin portal, enter credentials
2. **Find Restaurant** - Smart fuzzy matching by name
3. **Navigate to Menu** - Click menu navigation link
4. **Open Item Tags** - Click Item Tags tab
5. **Create Tags** - Loop through 10 tags, creating each with color
6. **Complete** - Log summary, close browser

### Smart Restaurant Matching

The script uses a scoring algorithm:
- Exact match: 1000 points
- Word match: +10 points per word
- Similar word: +8 points
- Substring match: +5 points
- All words bonus: +50 points
- Extra words penalty: -2 points per word

---

## Database Tables Used

| Table | Usage |
|-------|-------|
| `restaurants` | Fetch restaurant name |
| `pumpd_restaurants` | Link restaurant to Pumpd account |
| `pumpd_accounts` | Fetch email and password credentials |

### Query Pattern
```javascript
// Get credentials via relationship
const { data: pumpdRestaurant } = await supabase
  .from('pumpd_restaurants')
  .select('*, pumpd_accounts(email, user_password_hint)')
  .eq('restaurant_id', restaurantId)
  .eq('organisation_id', organisationId)
  .single();
```

---

## Error Handling

### Frontend
- Validates registration status before allowing action
- Displays toast notifications for success/warning/error
- Shows persistent alert with error details

### Backend
- Returns 401 if organisation context missing
- Returns 404 if restaurant not found
- Returns 500 with timeout message if script exceeds 3 minutes
- Catches and returns all script execution errors

### Script
- Per-tag error recovery (press Escape, continue to next)
- Screenshots saved on errors
- Final summary shows success/fail counts

---

## Success Indicators

The API checks stdout for these strings to determine success:
- `Successfully`
- `completed`
- `Item tags configured`
- `Tags added`

---

## Testing Checklist

### Frontend
- [ ] Button visible in Menu CSV Upload section
- [ ] Button disabled during operation
- [ ] Loading spinner shows during operation
- [ ] Success toast appears on completion
- [ ] Error toast appears on failure
- [ ] Status alert displays correct message

### Backend
- [ ] Returns 401 without auth token
- [ ] Returns 404 for non-existent restaurant
- [ ] Returns error if account not registered
- [ ] Executes script with correct parameters
- [ ] Handles timeout gracefully (3 min limit)

### Script
- [ ] Logs in successfully
- [ ] Finds correct restaurant by name
- [ ] Navigates to Item Tags tab
- [ ] Creates all 10 tags
- [ ] Handles individual tag failures gracefully
- [ ] Outputs correct success message

---

## Related Documentation

| Document | Location |
|----------|----------|
| Script Details | `planning/database-plans/account-automation-plans/ADD_ITEM_TAGS_IMPLEMENTATION_PLAN.md` |
| Implementation Plan | `planning/onboarding-browser-automation/add-item-tags-implementation-plan.md` |
| Similar Feature | `planning/database-plans/account-automation-plans/CSV_MENU_UPLOAD_IMPLEMENTATION_PLAN.md` |

---

## Maintenance Notes

### Adding New Tags
Edit the `ITEM_TAGS` array in `add-item-tags.js`:
```javascript
const ITEM_TAGS = [
  { name: 'New Tag', color: '#HEXCODE' },
  // ...
];
```

### Selector Updates
If Pumpd admin portal changes, update the `SELECTORS` object in the script.

### Timeout Adjustment
Modify timeout in `registration-routes.js`:
```javascript
timeout: 180000 // Current: 3 minutes
```
