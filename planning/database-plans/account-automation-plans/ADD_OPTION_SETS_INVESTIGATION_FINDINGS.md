# Add Option Sets Feature - Investigation Findings

## Overview

This document details the investigation findings for implementing the "Add Option Sets" feature, which will automate the creation of option sets on the Pumpd admin portal.

---

## 1. Database Schema Analysis

### 1.1 Core Tables

#### `option_sets` Table
Primary table storing option set definitions.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `name` | varchar | Display name (e.g., "Choose your size") |
| `description` | text | Optional description |
| `type` | varchar | Type: single_choice, multiple_choice, required_modifier, optional_modifier |
| `min_selections` | integer | Minimum selections required (default 0) |
| `max_selections` | integer | Maximum selections allowed |
| `is_required` | boolean | Whether selection is required (default false) |
| `multiple_selections_allowed` | boolean | Whether multiple selections allowed |
| `display_order` | integer | Display ordering |
| `organisation_id` | uuid | Foreign key to organisations |
| `extraction_source` | varchar | Source: ubereats, doordash, manual, import |
| `option_set_hash` | varchar | Hash for deduplication |

#### `option_set_items` Table
Individual options within each option set.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `option_set_id` | uuid | Foreign key to option_sets |
| `name` | varchar | Option name (e.g., "Small", "Add Bacon") |
| `price` | numeric | Price adjustment (-1000 to 1000) |
| `price_display` | text | Display format (e.g., "+$2.00") |
| `description` | text | Optional description |
| `is_default` | boolean | Whether selected by default |
| `is_available` | boolean | Whether currently available |
| `display_order` | integer | Display ordering |
| `organisation_id` | uuid | Foreign key to organisations |

#### `menu_item_option_sets` Junction Table
Links menu items to option sets (many-to-many relationship).

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `menu_item_id` | uuid | Foreign key to menu_items |
| `option_set_id` | uuid | Foreign key to option_sets |
| `display_order` | integer | Display ordering |
| `organisation_id` | uuid | Foreign key to organisations |

### 1.2 Related Tables

#### `menus` Table
| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `restaurant_id` | uuid | Foreign key to restaurants |
| `platform_id` | uuid | Source platform (UberEats, DoorDash, etc.) |
| `version` | integer | Menu version |
| `is_active` | boolean | Whether menu is active |
| `organisation_id` | uuid | Foreign key to organisations |

#### `menu_items` Table (relevant columns)
| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `menu_id` | uuid | Foreign key to menus |
| `name` | varchar | Item name |
| `has_option_sets` | boolean | Whether item has option sets |

---

## 2. Data Fetching Patterns

### 2.1 How Option Sets Are Fetched for a Menu

From `OptionSetsManagement.jsx`:

```javascript
const { data, error } = await supabase
  .from('menu_item_option_sets')
  .select(`
    option_set:option_sets!inner (
      *,
      option_set_items (*)
    ),
    menu_item:menu_items!inner (
      id,
      name,
      category:categories (
        name
      )
    )
  `)
  .eq('menu_item.menu_id', menuId)
  .eq('option_set.organisation_id', orgId);
```

### 2.2 Restaurant Menus Fetching

Menus are fetched via `/restaurants/${id}/details` API endpoint and returned as `restaurant.menus` array containing:
- `id` - Menu UUID
- `platform_id` - Source platform
- `version` - Menu version
- `is_active` - Active status

---

## 3. UI Flow Design

### 3.1 User Flow

1. User clicks "Add Option Sets" button in Menu CSV Upload section
2. Dropdown appears with list of available menus for the restaurant
3. User selects a menu
4. System fetches option sets associated with that menu
5. Script executes with:
   - Login credentials (from pumpd_accounts)
   - Restaurant name (for smart matching)
   - Option sets array (structured data)
   - Menu item mappings (for future extensibility)

### 3.2 Frontend Components Needed

1. **Menu Dropdown** - Select component listing restaurant menus
2. **Add Option Sets Button** - Triggers the workflow
3. **Loading State** - During script execution
4. **Status Display** - Success/error feedback

---

## 4. Data Structure for Script

### 4.1 Option Set Object Structure

```javascript
{
  name: "Choose your size",           // Display name
  display_name: "Choose your size",   // Same as name for Pumpd
  is_required: true,                   // Required toggle
  multiple_selections_allowed: false,  // Select multiple toggle
  min_selections: 1,                   // Min options required
  max_selections: 1,                   // Max options required
  items: [
    { name: "Small", price: 0 },
    { name: "Medium", price: 2.50 },
    { name: "Large", price: 4.00 }
  ]
}
```

### 4.2 Full Payload Structure

```javascript
{
  email: "restaurant@example.com",
  password: "Password123!",
  restaurantName: "Test Restaurant",
  optionSets: [
    {
      name: "Choose your size",
      display_name: "Choose your size",
      is_required: true,
      multiple_selections_allowed: false,
      min_selections: 1,
      max_selections: 1,
      items: [
        { name: "Small", price: 0 },
        { name: "Medium", price: 2.50 }
      ]
    },
    // ... more option sets
  ],
  // For future extensibility - mapping of option sets to menu items
  menuItemMappings: {
    "option-set-id-1": ["menu-item-id-1", "menu-item-id-2"],
    "option-set-id-2": ["menu-item-id-3"]
  }
}
```

---

## 5. Script Implementation Details

### 5.1 Script Workflow

Based on `add-item-tags.js` template:

1. **Login** (same as add-item-tags.js)
2. **Navigate to Restaurant** (same smart matching)
3. **Navigate to Menu Section** (same)
4. **Click Option Sets Tab** (new selector)
5. **Create Option Sets Loop**:
   - Click "Create New Option Set" button
   - Fill Name input
   - Fill Display Name input
   - Click Conditions tab
   - Toggle Required (if needed)
   - Toggle Select Multiple (if needed)
   - Toggle Enable Option Quantity (if max_selections > 1)
   - Fill Min Options Required
   - Fill Max Options Required
   - Click Options tab
   - Add option items (click Add button N times)
   - Fill option names and prices
   - Click Save
6. **Summary and Cleanup**

### 5.2 Selectors Identified

```javascript
const SELECTORS = {
  // Tab navigation
  optionSetsTab: '#scroll-root > div > div > div > div > div > div.group__ButtonGroupComponent-dVAWMN.puSOV.bsl-1 > button:nth-child(2)',

  // Create form
  createButton: '#scroll-root > div > div > div > div > div > div.m-t-8 > div.grid-2.xs.xs-gap.m-t-10 > div:nth-child(1) > div > button',
  nameInput: 'form > div > div:nth-child(1) > div:nth-child(2) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > input',
  displayNameInput: 'form > div > div:nth-child(1) > div:nth-child(3) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > input',

  // Conditions tab
  conditionsTab: '#option-set-tab-options-tab-select-content > div.components__TabSelectOptionsComponent-USxIn.cCRcoK > div:nth-child(3) > div',
  requiredToggle: 'form > div > div:nth-child(1) > div:nth-child(1) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > div > label',
  selectMultipleToggle: 'form > div > div:nth-child(1) > div:nth-child(2) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > div > label',
  enableQuantityToggle: 'form > div > div:nth-child(1) > div:nth-child(3) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > div > label',
  minSelectionsInput: 'form > div > div:nth-child(1) > div:nth-child(4) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > input',
  maxSelectionsInput: 'form > div > div:nth-child(1) > div:nth-child(5) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > input',

  // Options tab
  optionsTab: '#option-set-tab-options-tab-select-content > div.components__TabSelectOptionsComponent-USxIn.cCRcoK > div:nth-child(2) > div',
  addOptionButton: 'form > div > div:nth-child(1) > div > div > div > div:nth-child(2) > button',

  // Save
  saveButton: 'form > div > div:last-child > button'
};
```

### 5.3 Option Items Input Pattern

Based on `register-restaurant-production.js` opening hours pattern:

```javascript
// Find all input fields in the options section
const optionsSection = page.locator('form > div > div:nth-child(1) > div');
const allInputs = await optionsSection.locator('input[type="text"]').all();

// Process inputs in groups (name, price per option)
let inputIndex = 0;
for (const item of optionSet.items) {
  const nameInput = allInputs[inputIndex];
  const priceInput = allInputs[inputIndex + 1];

  await nameInput.fill(item.name);
  await priceInput.fill(item.price.toString());

  inputIndex += 2;
}
```

---

## 6. API Endpoint Design

### 6.1 Endpoint Specification

```
POST /api/registration/add-option-sets
```

### 6.2 Request Body

```javascript
{
  restaurantId: "uuid",
  menuId: "uuid"  // Selected menu from dropdown
}
```

### 6.3 Backend Logic

1. Validate organisation context
2. Fetch restaurant name from `restaurants` table
3. Fetch credentials from `pumpd_accounts`
4. Fetch option sets for the menu:
   ```javascript
   const { data } = await supabase
     .from('menu_item_option_sets')
     .select(`
       option_set:option_sets (
         id, name, description, is_required,
         multiple_selections_allowed, min_selections, max_selections,
         option_set_items (id, name, price, display_order)
       ),
       menu_item_id
     `)
     .eq('menu_item.menu_id', menuId);
   ```
5. Deduplicate option sets
6. Structure data for script
7. Execute script with JSON payload
8. Return result

### 6.4 Response

```javascript
{
  success: true,
  message: "Option sets configured successfully",
  summary: {
    total: 15,
    created: 15,
    failed: 0
  },
  output: "script stdout..."
}
```

---

## 7. Implementation Plan

### Phase 1: Script Development (Parallel Session)

1. Create `add-option-sets.js` based on `add-item-tags.js` template
2. Implement option set creation loop with all toggles and inputs
3. Handle option items filling (dynamic number of items)
4. Add error recovery and summary reporting
5. Test with sample data

### Phase 2: Backend/Frontend Integration (Parallel Session)

1. Add state variables to `RestaurantDetail.jsx`:
   - `selectedMenuForOptions` - Selected menu UUID
   - `isAddingOptionSets` - Loading state
   - `optionSetsStatus` - Result status

2. Add menu dropdown component in CSV Upload section

3. Add handler function `handleAddOptionSets`:
   - Fetch option sets for selected menu
   - Call API endpoint
   - Display results

4. Add API endpoint to `registration-routes.js`:
   - Fetch and structure option sets data
   - Execute script with JSON payload
   - Return results

---

## 8. Considerations for Future Extensibility

### 8.1 Applying Option Sets to Menu Items

The `menuItemMappings` field in the payload structure allows for future implementation of applying option sets to menu items:

```javascript
// Future: Apply option sets to items after creation
menuItemMappings: {
  "Burger Size": ["burger-item-1", "burger-item-2"],
  "Add Extras": ["all-items"]
}
```

The script can be extended with additional steps:
1. After creating all option sets, navigate to individual menu items
2. Open item edit modal
3. Add option set associations
4. Save

### 8.2 Script Parameters for Extension

The script should accept an optional `--apply-to-items` flag:
```bash
node add-option-sets.js \
  --email="..." \
  --password="..." \
  --name="..." \
  --option-sets="[...]" \
  --apply-to-items="true" \
  --mappings="{...}"
```

---

## 9. Testing Checklist

### Script Testing
- [ ] Login works correctly
- [ ] Restaurant matching finds correct restaurant
- [ ] Option Sets tab navigation works
- [ ] Create button click works
- [ ] Name and display name filling works
- [ ] Conditions tab toggles work correctly
- [ ] Min/max selection inputs work
- [ ] Options tab navigation works
- [ ] Add Option button works N times
- [ ] Option name/price filling works
- [ ] Save button works
- [ ] Loop continues correctly for multiple option sets
- [ ] Error recovery works (Escape key)
- [ ] Summary output is correct

### Frontend Testing
- [ ] Menu dropdown populates correctly
- [ ] Button disabled when no menu selected
- [ ] Loading state during execution
- [ ] Success message displays
- [ ] Error message displays
- [ ] Status persists correctly

### API Testing
- [ ] Returns 401 without auth
- [ ] Returns 404 for invalid restaurant
- [ ] Correctly fetches and structures option sets
- [ ] Handles empty option sets gracefully
- [ ] Script execution works
- [ ] Timeout handling works

---

## 10. File Locations Summary

| Component | Location |
|-----------|----------|
| Script | `scripts/restaurant-registration/add-option-sets.js` |
| API Route | `UberEats-Image-Extractor/src/routes/registration-routes.js` |
| Frontend | `UberEats-Image-Extractor/src/pages/RestaurantDetail.jsx` |
| Reference: Tags Script | `scripts/restaurant-registration/add-item-tags.js` |
| Reference: Option Sets Management | `UberEats-Image-Extractor/src/components/menu/OptionSetsManagement.jsx` |
| Reference: Opening Hours Pattern | `scripts/restaurant-registration/register-restaurant-production.js` |
