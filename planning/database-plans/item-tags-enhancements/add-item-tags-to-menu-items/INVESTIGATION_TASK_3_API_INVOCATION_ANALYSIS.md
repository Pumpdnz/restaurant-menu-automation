# Investigation Task 3: API Invocation Analysis

## Overview

This document analyzes how `add-item-tags.js` is invoked throughout the codebase and compares it with `add-option-sets.js` to understand the changes needed to pass menu item mapping data.

---

## 1. Current Invocation Paths for add-item-tags.js

### 1.1 Registration Routes API Endpoint

**File:** `/UberEats-Image-Extractor/src/routes/registration-routes.js`
**Endpoint:** `POST /api/registration/add-item-tags`
**Lines:** 2868-2997

**Current Implementation:**

```javascript
router.post('/add-item-tags', requireRegistrationItemTags, async (req, res) => {
  const { restaurantId } = req.body;  // ONLY parameter received
  const organisationId = req.user?.organisationId;

  // ... fetches restaurant name and account credentials ...

  // Build command with CLI arguments (NOT JSON payload)
  const command = [
    'node',
    scriptPath,
    `--email="${finalAccount.email}"`,
    `--password="${finalAccount.user_password_hint}"`,
    `--name="${restaurant.name.replace(/"/g, '\\"')}"`,
    `--admin-url="${scriptConfig.adminUrl}"`
  ].join(' ');

  const { stdout, stderr } = await execAsync(command, {
    env: { ...process.env, DEBUG_MODE: 'false' },
    timeout: 180000 // 3 minute timeout
  });
});
```

**Key Observations:**
- Only accepts `restaurantId` parameter
- Does NOT accept `menuId` parameter
- Passes credentials via CLI arguments (not JSON payload file)
- Does NOT fetch any menu item data from database
- Does NOT build any menuItemNames mapping

---

### 1.2 Registration Batch Service

**File:** `/UberEats-Image-Extractor/src/services/registration-batch-service.js`

#### 1.2.1 getSubStepEndpoint Function (Lines 2162-2176)

```javascript
// ===== PHASE 4 =====
itemTags: {
  endpoint: '/api/registration/add-item-tags',
  payload: {
    restaurantId,  // ONLY parameter passed
  },
},
```

**Key Observations:**
- Part of Phase 4 (Finalization)
- Payload only includes `restaurantId`
- Does NOT include `menuId` like option sets does

#### 1.2.2 Comparison with optionSets (Lines 2162-2168)

```javascript
// ===== PHASE 3 =====
optionSets: {
  endpoint: menu.selectedMenuId ? '/api/registration/add-option-sets' : null,
  payload: {
    restaurantId,
    menuId: menu.selectedMenuId,  // <-- KEY DIFFERENCE: menuId is passed
  },
},
```

**Key Observations:**
- Option sets requires `menuId` parameter
- Option sets endpoint is conditionally set (null if no menuId)
- Item tags has no such conditional logic

#### 1.2.3 Phase Execution (Lines 1848-1859)

```javascript
// ========== PHASE 4: Finalization (After menuImport) ==========
await updatePhaseProgress(job.id, 6, 'phase4', 'in_progress', phaseProgress);

if (menu.addItemTags && context.menuImportSucceeded) {
  await executeSubStep('itemTags', job, config, phaseProgress, context);
} else {
  const reason = !context.menuImportSucceeded ? 'Menu import failed or skipped' : 'Item tags disabled';
  updateSubStepInProgress(phaseProgress, 'itemTags', 'skipped', { reason });
}
```

**Key Observations:**
- Item tags only runs if `menu.addItemTags` is true AND menu import succeeded
- The `menu` config object is available and contains `selectedMenuId`
- The menuId IS available at execution time, just not being passed

#### 1.2.4 Dependencies and Phase Mapping (Lines 2745-2773)

```javascript
const SUB_STEP_DEPENDENCIES = {
  // ...
  optionSets: ['menuImport'],
  itemTags: ['menuImport']
};

const SUB_STEP_PHASE_MAP = {
  // ...
  optionSets: 'phase3',
  itemTags: 'phase4'
};
```

**Key Observations:**
- Both itemTags and optionSets depend on menuImport
- Item tags is in phase4, option sets in phase3
- Both have access to the same menu context after menuImport completes

---

### 1.3 Frontend Components

#### 1.3.1 RestaurantDetail.jsx (Lines 944-1000)

```javascript
const handleAddItemTags = async () => {
  // ... validation ...

  const response = await railwayApi.post('/api/registration/add-item-tags', {
    restaurantId: id  // ONLY parameter sent
  });

  // ... handle response ...
};
```

**Key Observations:**
- Manual trigger from restaurant detail page
- Only sends `restaurantId`
- Does NOT select or send a menuId
- Contrast with option sets which requires menu selection

#### 1.3.2 Comparison: handleAddOptionSets (Lines 1002-1065)

```javascript
const handleAddOptionSets = async () => {
  if (!selectedMenuForOptionSets) {
    toast({
      title: "Error",
      description: "Please select a menu first",  // <-- Requires menu selection
      variant: "destructive"
    });
    return;
  }

  const response = await railwayApi.post('/api/registration/add-option-sets', {
    restaurantId: id,
    menuId: selectedMenuForOptionSets  // <-- Sends menuId
  });
};
```

**Key Observations:**
- Requires user to select a menu before running
- Sends both `restaurantId` and `menuId`
- Has UI for menu selection (selectedMenuForOptionSets state)

#### 1.3.3 YoloModeDialog.tsx (Lines 135-139, 269-272)

```typescript
interface FormData {
  menu: {
    selectedMenuId: string;
    uploadImages: boolean;
    addOptionSets: boolean;
    addItemTags: boolean;  // Toggle for enabling item tags
  };
}

// Default form values
menu: {
  selectedMenuId: restaurant.menus?.[0]?.id || '',
  uploadImages: true,
  addOptionSets: true,
  addItemTags: true,  // Enabled by default
},
```

**Key Observations:**
- YOLO mode has `addItemTags` toggle
- `selectedMenuId` IS available in the form data
- Item tags could receive the menuId from the same config

#### 1.3.4 MenuTab.tsx (Lines 229-237)

```jsx
<Checkbox
  id="add-item-tags"
  checked={formData.menu.addItemTags}
  onCheckedChange={(checked) =>
    updateFormData('menu', 'addItemTags', checked as boolean)
  }
/>
```

**Key Observations:**
- User can toggle item tags on/off
- No additional menu selection needed (inherits from parent menu selection)

---

## 2. Comparison: add-option-sets.js Invocation

### 2.1 API Endpoint (Lines 3003-3278)

```javascript
router.post('/add-option-sets', requireRegistrationOptionSets, async (req, res) => {
  const { restaurantId, menuId } = req.body;  // Receives menuId

  // Validates menuId is required
  if (!menuId) {
    return res.status(400).json({
      success: false,
      error: 'Menu ID is required'
    });
  }

  // Fetches menu items from database
  const { data: menuItems, error: menuItemsError } = await supabase
    .from('menu_items')
    .select('id, name')
    .eq('menu_id', menuId);

  // Creates menuItemIdToName mapping
  const menuItemIdToName = new Map();
  menuItems.forEach(item => {
    menuItemIdToName.set(item.id, item.name);
  });

  // Fetches option sets with menu item relationships
  const { data: menuItemOptionSets } = await supabase
    .from('menu_item_option_sets')
    .select(`option_set:option_sets (...), menu_item_id`)
    .in('menu_item_id', menuItemIds);

  // Builds menuItemMappings and optionSetsArray with menuItemNames
  const optionSetsArray = Array.from(uniqueOptionSets.values()).map(optionSet => {
    const itemIds = menuItemMappings[optionSet.id] || [];
    const menuItemNames = itemIds.map(id => menuItemIdToName.get(id)).filter(name => name);
    return { ...optionSetWithoutId, menuItemNames };
  });

  // Creates JSON payload file
  const scriptPayload = {
    email: finalAccount.email,
    password: finalAccount.user_password_hint,
    restaurantName: restaurant.name,
    adminUrl: scriptConfig.adminUrl,
    optionSets: optionSetsArray,
    menuItemMappings: menuItemMappings
  };

  // Writes payload to temp file
  const payloadPath = path.join(__dirname, `temp-option-sets-payload-${Date.now()}.json`);
  await require('fs').promises.writeFile(payloadPath, JSON.stringify(scriptPayload));

  // Executes script with payload file path
  const command = `node "${scriptPath}" --payload="${payloadPath}"`;

  // Cleans up temp file after execution
  await require('fs').promises.unlink(payloadPath);
});
```

### 2.2 Script Parameter Handling (add-option-sets.js Lines 152-198)

```javascript
// Parse arguments
const payloadPath = getArg('payload');

// Load payload from file
const payloadContent = await fs.readFile(payloadPath, 'utf-8');
const payload = JSON.parse(payloadContent);

const { email, password, restaurantName, optionSets, menuItemMappings } = payload;
```

**Key Differences from add-item-tags.js:**
| Aspect | add-item-tags.js | add-option-sets.js |
|--------|------------------|-------------------|
| Parameters | CLI args (--email, --password, etc.) | JSON payload file (--payload) |
| Data source | Hardcoded ITEM_TAGS array | Database-fetched optionSets |
| Menu item mapping | None | menuItemNames array per option set |
| File I/O | None | Temp JSON file created/deleted |
| Timeout | 3 minutes | 60 minutes |

---

## 3. Required Changes

### 3.1 Changes to registration-routes.js

#### 3.1.1 Accept menuId Parameter

```javascript
router.post('/add-item-tags', requireRegistrationItemTags, async (req, res) => {
  const { restaurantId, menuId } = req.body;  // ADD: menuId parameter

  // ADD: Validate menuId (optional - could still work without for backwards compat)
  if (!menuId) {
    // Option 1: Return error (like option sets)
    // Option 2: Create tags without applying to menu items (current behavior)
  }
```

#### 3.1.2 Fetch Menu Items with Tags

```javascript
// ADD: Fetch menu items that have tags
const { data: menuItems, error: menuItemsError } = await supabase
  .from('menu_items')
  .select('id, name, tags')
  .eq('menu_id', menuId)
  .not('tags', 'is', null);  // Only items with tags

// ADD: Build tag-to-menuItems mapping
const tagToMenuItems = new Map();
menuItems.forEach(item => {
  if (item.tags && Array.isArray(item.tags)) {
    item.tags.forEach(tag => {
      if (!tagToMenuItems.has(tag)) {
        tagToMenuItems.set(tag, []);
      }
      tagToMenuItems.get(tag).push(item.name);
    });
  }
});
```

#### 3.1.3 Build and Pass JSON Payload

```javascript
// ADD: Structure payload similar to option sets
const scriptPayload = {
  email: finalAccount.email,
  password: finalAccount.user_password_hint,
  restaurantName: restaurant.name,
  adminUrl: scriptConfig.adminUrl,
  itemTags: PREDEFINED_TAGS.map(tag => ({
    name: tag.name,
    color: tag.color,
    menuItemNames: tagToMenuItems.get(tag.name) || []
  }))
};

// ADD: Write payload to temp file
const payloadPath = path.join(__dirname, `temp-item-tags-payload-${Date.now()}.json`);
await require('fs').promises.writeFile(payloadPath, JSON.stringify(scriptPayload));

// CHANGE: Execute with payload argument
const command = `node "${scriptPath}" --payload="${payloadPath}"`;

// ADD: Clean up temp file
await require('fs').promises.unlink(payloadPath);
```

---

### 3.2 Changes to registration-batch-service.js

#### 3.2.1 Update getSubStepEndpoint (Lines 2170-2176)

```javascript
// CHANGE FROM:
itemTags: {
  endpoint: '/api/registration/add-item-tags',
  payload: {
    restaurantId,
  },
},

// CHANGE TO:
itemTags: {
  endpoint: menu.selectedMenuId ? '/api/registration/add-item-tags' : null,  // Conditional like optionSets
  payload: {
    restaurantId,
    menuId: menu.selectedMenuId,  // ADD: menuId parameter
  },
},
```

#### 3.2.2 Update Timeout (Optional)

If applying tags to many items, may need longer timeout similar to option sets.

---

### 3.3 Changes to Frontend (Optional)

#### 3.3.1 RestaurantDetail.jsx

For manual trigger, could add menu selection similar to option sets:

```javascript
// ADD: State for selected menu
const [selectedMenuForTags, setSelectedMenuForTags] = useState('');

const handleAddItemTags = async () => {
  // ADD: Require menu selection
  if (!selectedMenuForTags) {
    toast({ title: "Error", description: "Please select a menu first" });
    return;
  }

  const response = await railwayApi.post('/api/registration/add-item-tags', {
    restaurantId: id,
    menuId: selectedMenuForTags  // ADD: Pass menuId
  });
};
```

**Alternative:** Could use same `selectedMenuForOptionSets` state for both features.

---

## 4. Payload Structure Proposal

### 4.1 Current add-item-tags.js Script Parameters

```javascript
// Current: CLI arguments
--email="test@example.com"
--password="Password123!"
--name="Test Restaurant"
--admin-url="https://admin.pumpd.co.nz"
```

### 4.2 Proposed JSON Payload Structure

```json
{
  "email": "test@example.com",
  "password": "Password123!",
  "restaurantName": "Test Restaurant",
  "adminUrl": "https://admin.pumpd.co.nz",
  "itemTags": [
    {
      "name": "Popular",
      "color": "#b400fa",
      "menuItemNames": ["Chicken Burger", "Beef Burger", "Fish & Chips"]
    },
    {
      "name": "Vegan",
      "color": "#36AB36",
      "menuItemNames": ["Garden Salad", "Vegan Burger", "Sweet Potato Fries"]
    },
    {
      "name": "Spicy",
      "color": "#FF3333",
      "menuItemNames": ["Hot Wings", "Jalapeño Burger"]
    },
    {
      "name": "New",
      "color": "#3f92ff",
      "menuItemNames": []  // No items - just create the tag
    }
  ]
}
```

### 4.3 Backwards Compatibility Considerations

The script could support both modes:

1. **CLI Arguments Mode (Legacy):** Creates tags without applying to items
2. **Payload Mode (Enhanced):** Creates tags AND applies to menu items

```javascript
// In add-item-tags.js
const payloadPath = getArg('payload');

if (payloadPath) {
  // New behavior: load from JSON, apply to menu items
  const payload = JSON.parse(await fs.readFile(payloadPath, 'utf-8'));
  // ... process with menuItemNames
} else {
  // Legacy behavior: CLI args, just create tags
  const email = getArg('email');
  const password = getArg('password');
  // ... existing behavior
}
```

---

## 5. Summary of Required Changes

| Component | Current State | Required Change | Priority |
|-----------|---------------|-----------------|----------|
| registration-routes.js | Only receives restaurantId | Accept menuId, fetch menu items with tags, build payload, write temp file | High |
| registration-batch-service.js | Only passes restaurantId | Add menuId to payload, make endpoint conditional | High |
| add-item-tags.js | CLI args only, hardcoded tags | Accept --payload arg, read JSON, apply to menu items | High |
| RestaurantDetail.jsx | No menu selection for tags | Add menu selector (optional - could share with option sets) | Medium |
| YoloModeDialog.tsx | Has selectedMenuId available | No change needed - already has menuId | None |

---

## 6. Data Flow Comparison

### Current Flow (add-item-tags.js):

```
Frontend/BatchService
    |
    v
POST /add-item-tags { restaurantId }
    |
    v
registration-routes.js
    - Fetch restaurant name
    - Fetch account credentials
    |
    v
Execute: node add-item-tags.js --email=... --password=... --name=...
    |
    v
add-item-tags.js
    - Uses hardcoded ITEM_TAGS array
    - Creates tags only (no menu item association)
```

### Proposed Flow (Enhanced):

```
Frontend/BatchService
    |
    v
POST /add-item-tags { restaurantId, menuId }
    |
    v
registration-routes.js
    - Fetch restaurant name
    - Fetch account credentials
    - Fetch menu items with tags (NEW)
    - Build tagToMenuItems mapping (NEW)
    - Write JSON payload to temp file (NEW)
    |
    v
Execute: node add-item-tags.js --payload="/path/to/temp-item-tags-payload-xxx.json"
    |
    v
add-item-tags.js
    - Read payload from JSON file (NEW)
    - For each tag:
      - Create tag if not exists
      - Navigate to "Add / Remove From Items" tab (NEW)
      - Apply to menuItemNames (NEW)
    |
    v
registration-routes.js
    - Delete temp file (NEW)
    - Return result
```

---

## 7. Risks and Considerations

1. **Performance:** Large menus with many tagged items may need longer timeout (currently 3 min vs 60 min for option sets)

2. **Tag Existence:** Script may need to detect if tag already exists vs creating new

3. **Backwards Compatibility:** Existing manual triggers from RestaurantDetail.jsx should continue working even without menuId (just creates tags without applying)

4. **Data Consistency:** Tags in database must match predefined tag names exactly for mapping to work

5. **Featured Items Handling:** Same duplicate-handling logic needed as option sets (click all matching checkboxes, not just first)
