# Add Option Sets - Backend/Frontend Implementation Roadmap

## Overview

This document provides a comprehensive implementation plan for integrating the "Add Option Sets" feature into the Pumpd Registration page, including the API endpoint and frontend UI.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Frontend (React)                             │
│  RestaurantDetail.jsx                                           │
│  ├── Menu Dropdown (Select component)                          │
│  ├── "Add Option Sets" Button                                   │
│  └── Status Display (success/error)                            │
└──────────────────────────┬──────────────────────────────────────┘
                           │ POST /api/registration/add-option-sets
                           │ Body: { restaurantId, menuId }
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Backend (Express)                            │
│  registration-routes.js - /add-option-sets endpoint             │
│  1. Validate organisation context                               │
│  2. Fetch restaurant name                                       │
│  3. Fetch credentials from pumpd_accounts                       │
│  4. Fetch option sets for menu via junction table               │
│  5. Structure data for script                                   │
│  6. Execute add-option-sets.js script                           │
│  7. Return result                                               │
└──────────────────────────┬──────────────────────────────────────┘
                           │ node add-option-sets.js --json="..."
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Playwright Script                            │
│  add-option-sets.js (developed in parallel session)             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Frontend Changes - RestaurantDetail.jsx

### 1.1 Add Icon Import (Line ~48)

Add `Settings2` icon for the option sets button:

```javascript
import {
  // ... existing imports
  Settings2  // ADD THIS - for option sets icon
} from 'lucide-react';
```

### 1.2 Add State Variables (After line ~184, after Item Tags states)

```javascript
// Option Sets states
const [selectedMenuForOptionSets, setSelectedMenuForOptionSets] = useState('');
const [isAddingOptionSets, setIsAddingOptionSets] = useState(false);
const [optionSetsStatus, setOptionSetsStatus] = useState(null);
```

### 1.3 Add Handler Function (After handleAddItemTags, around line ~715)

```javascript
// Option Sets handler
const handleAddOptionSets = async () => {
  if (!selectedMenuForOptionSets) {
    toast({
      title: "Error",
      description: "Please select a menu first",
      variant: "destructive"
    });
    return;
  }

  if (!registrationStatus?.account || registrationStatus.account.registration_status !== 'completed') {
    toast({
      title: "Error",
      description: "Account registration must be completed before adding option sets",
      variant: "destructive"
    });
    return;
  }

  if (!registrationStatus?.restaurant || registrationStatus.restaurant.registration_status !== 'completed') {
    toast({
      title: "Error",
      description: "Restaurant registration must be completed before adding option sets",
      variant: "destructive"
    });
    return;
  }

  setIsAddingOptionSets(true);
  setOptionSetsStatus(null);

  try {
    const response = await api.post('/registration/add-option-sets', {
      restaurantId: id,
      menuId: selectedMenuForOptionSets
    });

    setOptionSetsStatus(response.data);

    if (response.data.success) {
      toast({
        title: "Success",
        description: `Option sets configured successfully (${response.data.summary?.created || 0} created)`,
      });
    } else {
      toast({
        title: "Warning",
        description: response.data.message || "Option sets configuration completed with warnings",
        variant: "warning"
      });
    }
  } catch (error) {
    const errorMessage = error.response?.data?.error || error.message;
    setOptionSetsStatus({
      success: false,
      error: errorMessage
    });
    toast({
      title: "Error",
      description: errorMessage,
      variant: "destructive"
    });
  } finally {
    setIsAddingOptionSets(false);
  }
};
```

### 1.4 Add UI Components (After Add Item Tags button, around line ~4505)

Add after the Tags Status Messages section:

```jsx
{/* Option Sets Section */}
<div className="border-t pt-4 mt-4">
  <div className="space-y-3">
    <div className="flex items-center gap-2 text-sm font-medium">
      <Settings2 className="h-4 w-4" />
      Add Option Sets from Menu
    </div>

    {/* Menu Dropdown */}
    <Select
      value={selectedMenuForOptionSets}
      onValueChange={setSelectedMenuForOptionSets}
      disabled={isAddingOptionSets}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Select a menu..." />
      </SelectTrigger>
      <SelectContent>
        {restaurant?.menus && restaurant.menus.length > 0 ? (
          restaurant.menus.map((menu) => (
            <SelectItem key={menu.id} value={menu.id}>
              Version {menu.version} - {menu.platforms?.name || 'Unknown'}
              {menu.is_active && ' (Active)'}
            </SelectItem>
          ))
        ) : (
          <SelectItem value="none" disabled>
            No menus available
          </SelectItem>
        )}
      </SelectContent>
    </Select>

    {/* Add Option Sets Button */}
    <Button
      onClick={handleAddOptionSets}
      disabled={isAddingOptionSets || !selectedMenuForOptionSets}
      className="w-full"
      variant="outline"
    >
      {isAddingOptionSets ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Adding Option Sets...
        </>
      ) : (
        <>
          <Settings2 className="h-4 w-4 mr-2" />
          Add Option Sets
        </>
      )}
    </Button>

    {/* Option Sets Status Messages */}
    {optionSetsStatus && (
      <Alert className={optionSetsStatus.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
        {optionSetsStatus.success ? (
          <FileCheck className="h-4 w-4 text-green-600" />
        ) : (
          <AlertCircle className="h-4 w-4 text-red-600" />
        )}
        <AlertDescription className={optionSetsStatus.success ? 'text-green-800' : 'text-red-800'}>
          {optionSetsStatus.success
            ? `Option sets configured successfully! (${optionSetsStatus.summary?.created || 0} created, ${optionSetsStatus.summary?.failed || 0} failed)`
            : (optionSetsStatus.error || 'Failed to configure option sets')}
        </AlertDescription>
      </Alert>
    )}
  </div>
</div>
```

---

## Phase 2: Backend Changes - registration-routes.js

### 2.1 Add New Endpoint (After /add-item-tags endpoint, around line ~1898)

```javascript
/**
 * Add Option Sets to restaurant's Pumpd menu
 * Fetches option sets from database and uses add-option-sets.js script
 */
router.post('/add-option-sets', async (req, res) => {
  const { restaurantId, menuId } = req.body;
  const organisationId = req.user?.organisationId;

  console.log('[Option Sets] Request received:', { restaurantId, menuId, organisationId });

  if (!organisationId) {
    return res.status(401).json({
      success: false,
      error: 'Organisation context required'
    });
  }

  if (!menuId) {
    return res.status(400).json({
      success: false,
      error: 'Menu ID is required'
    });
  }

  try {
    const { supabase } = require('../services/database-service');

    // Get restaurant details
    const { data: restaurant, error: restaurantError } = await supabase
      .from('restaurants')
      .select('name')
      .eq('id', restaurantId)
      .eq('organisation_id', organisationId)
      .single();

    if (restaurantError || !restaurant) {
      throw new Error('Restaurant not found');
    }

    console.log('[Option Sets] Restaurant found:', restaurant.name);

    // Get account credentials through pumpd_restaurants relationship
    const { data: pumpdRestaurant, error: pumpdRestError } = await supabase
      .from('pumpd_restaurants')
      .select('*, pumpd_accounts(email, user_password_hint)')
      .eq('restaurant_id', restaurantId)
      .eq('organisation_id', organisationId)
      .single();

    const account = pumpdRestaurant?.pumpd_accounts || null;

    // Fallback to direct account lookup for backward compatibility
    let finalAccount = account;
    if (!finalAccount && !pumpdRestError) {
      const { data: directAccount } = await supabase
        .from('pumpd_accounts')
        .select('email, user_password_hint')
        .eq('restaurant_id', restaurantId)
        .eq('organisation_id', organisationId)
        .single();
      finalAccount = directAccount;
    }

    if (!finalAccount) {
      throw new Error('Restaurant account not found. Please ensure the restaurant is registered on Pumpd first.');
    }

    if (!finalAccount.email || !finalAccount.user_password_hint) {
      throw new Error('Restaurant account credentials are incomplete. Please re-register the account.');
    }

    console.log('[Option Sets] Account found:', finalAccount.email);

    // Fetch option sets for the selected menu
    const { data: menuItemOptionSets, error: optionSetsError } = await supabase
      .from('menu_item_option_sets')
      .select(`
        option_set:option_sets (
          id,
          name,
          description,
          is_required,
          multiple_selections_allowed,
          min_selections,
          max_selections,
          option_set_items (
            id,
            name,
            price,
            display_order
          )
        ),
        menu_item_id
      `)
      .eq('organisation_id', organisationId);

    if (optionSetsError) {
      throw new Error('Failed to fetch option sets: ' + optionSetsError.message);
    }

    // Filter to only include option sets linked to menu items in the selected menu
    const { data: menuItems, error: menuItemsError } = await supabase
      .from('menu_items')
      .select('id')
      .eq('menu_id', menuId);

    if (menuItemsError) {
      throw new Error('Failed to fetch menu items: ' + menuItemsError.message);
    }

    const menuItemIds = new Set(menuItems.map(item => item.id));
    const filteredOptionSets = menuItemOptionSets.filter(
      mios => menuItemIds.has(mios.menu_item_id)
    );

    // Deduplicate option sets and structure for script
    const uniqueOptionSets = new Map();
    const menuItemMappings = {};

    filteredOptionSets.forEach(item => {
      if (item.option_set) {
        const optionSetId = item.option_set.id;

        if (!uniqueOptionSets.has(optionSetId)) {
          // Sort option items by display_order
          const sortedItems = (item.option_set.option_set_items || [])
            .sort((a, b) => (a.display_order || 0) - (b.display_order || 0));

          uniqueOptionSets.set(optionSetId, {
            name: item.option_set.name,
            display_name: item.option_set.name,
            description: item.option_set.description || '',
            is_required: item.option_set.is_required || false,
            multiple_selections_allowed: item.option_set.multiple_selections_allowed || false,
            min_selections: item.option_set.min_selections || 0,
            max_selections: item.option_set.max_selections || 1,
            items: sortedItems.map(osi => ({
              name: osi.name,
              price: parseFloat(osi.price) || 0
            }))
          });
          menuItemMappings[optionSetId] = [];
        }

        menuItemMappings[optionSetId].push(item.menu_item_id);
      }
    });

    const optionSetsArray = Array.from(uniqueOptionSets.values());

    if (optionSetsArray.length === 0) {
      return res.json({
        success: true,
        message: 'No option sets found for this menu',
        summary: { total: 0, created: 0, failed: 0 }
      });
    }

    console.log(`[Option Sets] Found ${optionSetsArray.length} unique option sets`);

    // Create JSON payload for script
    const scriptPayload = {
      email: finalAccount.email,
      password: finalAccount.user_password_hint,
      restaurantName: restaurant.name,
      optionSets: optionSetsArray,
      menuItemMappings: menuItemMappings
    };

    // Execute add-option-sets.js script
    const scriptPath = path.join(__dirname, '../../../scripts/restaurant-registration/add-option-sets.js');

    // Pass JSON payload via stdin or file to avoid command line length limits
    const payloadPath = path.join(__dirname, '../../../scripts/restaurant-registration/temp-option-sets-payload.json');
    await require('fs').promises.writeFile(payloadPath, JSON.stringify(scriptPayload));

    const command = `node "${scriptPath}" --payload="${payloadPath}"`;

    console.log('[Option Sets] Executing option sets configuration script...');

    const { stdout, stderr } = await execAsync(command, {
      env: { ...process.env, DEBUG_MODE: 'false' },
      timeout: 300000 // 5 minute timeout (longer due to multiple option sets)
    });

    // Clean up temp file
    try {
      await require('fs').promises.unlink(payloadPath);
    } catch (e) {
      console.log('[Option Sets] Could not delete temp file:', e.message);
    }

    console.log('[Option Sets] Script output:', stdout);
    if (stderr) {
      console.error('[Option Sets] Script stderr:', stderr);
    }

    // Parse summary from output if available
    let summary = { total: optionSetsArray.length, created: 0, failed: 0 };
    const summaryMatch = stdout.match(/Successfully created: (\d+)\/(\d+)/);
    if (summaryMatch) {
      summary.created = parseInt(summaryMatch[1]);
      summary.total = parseInt(summaryMatch[2]);
      summary.failed = summary.total - summary.created;
    }

    // Check for success indicators
    const success = stdout.includes('Successfully') ||
                   stdout.includes('completed') ||
                   stdout.includes('Option sets configured') ||
                   summary.created > 0;

    console.log('[Option Sets] Configuration result:', success ? 'Success' : 'Partial/Failed');

    res.json({
      success,
      message: success ? 'Option sets configured successfully' : 'Configuration completed with warnings',
      summary,
      output: stdout,
      error: stderr || null
    });

  } catch (error) {
    console.error('[Option Sets] Error:', error);

    const isTimeout = error.code === 'ETIMEDOUT' || error.message.includes('timeout');

    res.status(500).json({
      success: false,
      error: isTimeout ?
        'Option sets configuration timed out. The process may be taking longer than expected. Please try again.' :
        error.message,
      details: error.stderr || null
    });
  }
});
```

---

## Phase 3: Implementation Order

### Step 1: Add API Endpoint
1. Open `registration-routes.js`
2. Locate the `/add-item-tags` endpoint (around line 1897)
3. Add the new `/add-option-sets` endpoint after it
4. Verify imports for `fs.promises` and `path` are present

### Step 2: Add Frontend State Variables
1. Open `RestaurantDetail.jsx`
2. Find line ~184 (after Item Tags states)
3. Add the three new state variables

### Step 3: Add Handler Function
1. Locate `handleAddItemTags` function (around line ~658)
2. Add `handleAddOptionSets` function after it

### Step 4: Add Icon Import
1. Find the lucide-react imports (line ~48)
2. Add `Settings2` to the imports

### Step 5: Add UI Components
1. Find the Tags Status Messages section (around line ~4504)
2. Add the Option Sets UI section after it

---

## File Changes Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `registration-routes.js` | Add | New `/add-option-sets` endpoint (~150 lines) |
| `RestaurantDetail.jsx` | Add import | `Settings2` icon |
| `RestaurantDetail.jsx` | Add state | 3 state variables |
| `RestaurantDetail.jsx` | Add function | `handleAddOptionSets` handler |
| `RestaurantDetail.jsx` | Add UI | Menu dropdown, button, status display |

---

## API Specification

### Endpoint
```
POST /api/registration/add-option-sets
```

### Request
```json
{
  "restaurantId": "uuid",
  "menuId": "uuid"
}
```

### Response (Success)
```json
{
  "success": true,
  "message": "Option sets configured successfully",
  "summary": {
    "total": 15,
    "created": 15,
    "failed": 0
  },
  "output": "script stdout..."
}
```

### Response (Error)
```json
{
  "success": false,
  "error": "Error message",
  "details": "stderr if available"
}
```

---

## Testing Checklist

### Frontend
- [ ] Menu dropdown shows available menus
- [ ] Menu dropdown shows platform name and version
- [ ] Active menus are marked
- [ ] Button disabled when no menu selected
- [ ] Button disabled during operation
- [ ] Loading spinner shows during operation
- [ ] Success toast displays with count
- [ ] Error toast displays on failure
- [ ] Status alert shows summary

### Backend
- [ ] Returns 401 without auth token
- [ ] Returns 400 without menuId
- [ ] Returns 404 for invalid restaurant
- [ ] Returns error if account not registered
- [ ] Correctly fetches option sets for menu
- [ ] Deduplicates option sets properly
- [ ] Structures data correctly for script
- [ ] Handles empty option sets gracefully
- [ ] Cleans up temp payload file
- [ ] Handles timeout gracefully (5 min limit)

---

## Dependencies

The script (`add-option-sets.js`) is being developed in a parallel session. This implementation assumes the script will:

1. Accept a `--payload` argument pointing to a JSON file
2. Read the JSON payload containing:
   - email, password, restaurantName
   - optionSets array with items
   - menuItemMappings (for future use)
3. Output success messages containing "Successfully created: X/Y"
4. Exit with code 0 on success, non-zero on failure

---

## UI Layout

```
Menu CSV Upload Card
├── CardHeader
└── CardContent
    ├── Prerequisites Status
    ├── File Input
    ├── Upload Menu Button
    ├── Add Item Tags Button
    ├── Upload Status Messages
    ├── Tags Status Messages
    └── Option Sets Section (NEW)
        ├── Section Header (Settings2 icon + title)
        ├── Menu Dropdown (Select)
        ├── Add Option Sets Button
        └── Option Sets Status Messages
```

---

## Implementation Status

### Completed ✅

| Component | Status | Details |
|-----------|--------|---------|
| API Endpoint | ✅ Complete | `POST /api/registration/add-option-sets` |
| Frontend UI | ✅ Complete | Menu dropdown, button, status display |
| State Management | ✅ Complete | 3 state variables added |
| Handler Function | ✅ Complete | `handleAddOptionSets` implemented |
| Script Integration | ✅ Complete | Payload passed via temp JSON file |
| Menu Item Names | ✅ Complete | `menuItemNames` array added to payload |
| Script Functionality | ✅ Complete | Creates option sets, applies to menu items |

### Current Payload Structure

```javascript
{
  email: "...",
  password: "...",
  restaurantName: "...",
  optionSets: [
    {
      name: "Choose Spice Level",
      display_name: "Choose Spice Level",
      is_required: true,
      multiple_selections_allowed: false,
      min_selections: 1,
      max_selections: 1,
      items: [
        { name: "Mild", price: 0 },
        { name: "Medium", price: 0 },
        { name: "Hot", price: 0 }
      ],
      menuItemNames: ["Butter Chicken", "Vindaloo", "Korma"]
    }
  ],
  menuItemMappings: { ... }
}
```

---

## Outstanding Issues

None - all issues resolved.

---

## Resolved Issues

### ✅ Zero Price Display Issue (Fixed 2025-11-30)

**Problem:** Free option set items (price = 0) were being displayed with "0.00" in the Pumpd admin portal price field, which looked strange for choice-based options like spice levels.

**Solution:** Modified `add-option-sets.js` (lines 572-581) to skip filling the price input when price is 0 or undefined. The script now:
1. Only fills the price field when `item.price > 0`
2. Leaves the field empty/blank for free options
3. Logs "(Free)" instead of "$0.00" in console output

**Code Change:**
```javascript
// Fill Price input (number input in row) - only if price > 0
if (rowNumberInputs.length > 0 && item.price && item.price > 0) {
  const priceStr = item.price.toFixed(2);
  await rowNumberInputs[0].fill(priceStr);
  await page.waitForTimeout(100);
}

filledCount++;
const priceDisplay = item.price && item.price > 0 ? `$${item.price.toFixed(2)}` : '(Free)';
console.log(`      Added: "${item.name}" - ${priceDisplay}`);
```

---

## Files Modified

| File | Lines | Description |
|------|-------|-------------|
| `registration-routes.js` | 1899-2140 | Added `/add-option-sets` endpoint |
| `RestaurantDetail.jsx` | 49 | Added `Settings2` icon import |
| `RestaurantDetail.jsx` | 188-191 | Added 3 state variables |
| `RestaurantDetail.jsx` | 723-789 | Added `handleAddOptionSets` handler |
| `RestaurantDetail.jsx` | 4580-4649 | Added Option Sets UI section |
| `add-option-sets.js` | 572-581 | Fixed zero price display - skip filling price for free items |
