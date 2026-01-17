# Add Item Tags Script - Implementation Documentation

## Overview

The `add-item-tags.js` script automates the creation of predefined item tags on the Pumpd admin portal. It logs into a restaurant account, navigates to the Menu > Item Tags section, and creates 10 standard tags with configured colors.

---

## Script Location

```
/Users/giannimunro/Desktop/cursor-projects/automation/scripts/restaurant-registration/add-item-tags.js
```

---

## Usage

### Command Line

```bash
node scripts/restaurant-registration/add-item-tags.js \
  --email="restaurant@example.com" \
  --password="Password123!" \
  --name="Restaurant Name"
```

### With Debug Mode (browser stays open)

```bash
# Using --debug flag
node scripts/restaurant-registration/add-item-tags.js \
  --email="restaurant@example.com" \
  --password="Password123!" \
  --name="Restaurant Name" \
  --debug

# Or using environment variable
DEBUG_MODE=true node scripts/restaurant-registration/add-item-tags.js \
  --email="restaurant@example.com" \
  --password="Password123!" \
  --name="Restaurant Name"
```

### Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `--email` | Yes | Login email for the Pumpd account |
| `--password` | Yes | User password for the Pumpd account |
| `--name` | Yes | Restaurant name for smart matching |
| `--debug` | No | Keep browser open after completion |

### Environment Variables

| Variable | Description |
|----------|-------------|
| `DEBUG_MODE` | Set to `true` to keep browser open (alternative to --debug flag) |

---

## Predefined Item Tags

The script creates the following 10 tags:

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

---

## Script Workflow

### Step 1: Login to Admin Portal
- Navigate to `https://admin.pumpd.co.nz/login`
- Fill email and password fields
- Click login button
- Wait for dashboard to load

### Step 2: Navigate to Restaurant
- Use smart matching algorithm to find restaurant by name
- Click "Manage" button for the matched restaurant
- Wait for restaurant management page to load

### Step 3: Navigate to Menu Section
- Click Menu navigation link (`#nav-link-menus`)
- Wait for menu page to load

### Step 4: Navigate to Item Tags Tab
- Click the Item Tags tab button (3rd button in button group)
- Wait for Item Tags page to load

### Step 5: Create Item Tags (Loop)
For each tag in the configuration:
1. Click "Create New Item Tag" button
2. Fill Tag Name field
3. Fill Tag Text field (same as name)
4. Click color picker to open dropdown
5. Fill color input with hex value
6. Click Save button
7. Wait 2000ms for save to complete

### Step 6: Completion
- Take final screenshot
- Log summary (success/fail counts)
- Close browser (or keep open in debug mode)

---

## Selectors Reference

```javascript
const SELECTORS = {
  // Create New Item Tag button
  createButton: '#scroll-root > div > div > div > div > div > div.m-t-8 > div.grid-2.xs.xs-gap.m-t-10 > div:nth-child(1) > div > button',

  // Tag Name input field
  tagNameField: 'form > div > div:nth-child(3) > div:nth-child(1) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > input',

  // Tag Text input field
  tagTextField: 'form > div > div:nth-child(3) > div:nth-child(2) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > input',

  // Color picker swatch (click to open)
  colorPicker: 'form > div > div:nth-child(3) > div:nth-child(4) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > div > div.group__FormGroupComponent-evaCTb.joUTxJ.m-b-0.m-r-6 > div > div > div > div.colorpicker__SwatchWrapper-kmfhwV.hqNLmj > div',

  // Color hex input field
  colorInput: 'form > div > div:nth-child(3) > div:nth-child(4) > div > div.group__FormGroupContent-ccjnpO.kpPgpj > div > div.group__FormGroupComponent-evaCTb.joUTxJ.m-b-0.m-r-6 > div > div > div > div.colorpicker__DropWrapper-hDQMcy.cAaOXs > div > div:nth-child(2) > div:nth-child(2) > div.flexbox-fix > div > div > input',

  // Save button
  saveButton: 'form > div > div:nth-child(4) > button'
};
```

---

## Smart Restaurant Matching

The script uses a fuzzy matching algorithm to find the correct restaurant:

1. **Normalization**: Converts names to lowercase, removes apostrophes, normalizes spaces
2. **Exact Match**: Score 1000 for exact match after normalization
3. **Word Matching**:
   - Exact word match: +10 points
   - Similar word (Levenshtein-like): +8 points
   - Substring match: +5 points
4. **Bonus**: +50 points if all search words match
5. **Penalty**: -2 points per extra word in restaurant name

---

## Error Handling

### Per-Tag Errors
- If a tag fails to create, the script:
  - Logs the error
  - Presses Escape to close any open modal
  - Continues to the next tag

### Fatal Errors
- Login failure
- Restaurant not found
- Menu navigation failure
- Item Tags tab not found

### Screenshots
Screenshots are saved to:
```
scripts/restaurant-registration/screenshots/csv-import-{step}-{timestamp}.png
```

---

## Output Examples

### Successful Run
```
🚀 Starting Menu Item Tags Configuration...

Configuration:
  Email: restaurant@example.com
  Password: *************
  Restaurant: Test Restaurant
  Debug Mode: OFF

🔐 STEP 1: Login to admin portal
  ✓ Credentials entered
  ✓ Clicked login

⏳ Waiting for dashboard...
  ✓ Reached dashboard: https://admin.pumpd.co.nz/...

🏪 STEP 2: Navigate to restaurant management
  🔍 Looking for restaurant: Test Restaurant
  ✅ Best match: "Test Restaurant" at index 0 (exact match)
  ✓ Clicked Manage button for Test Restaurant

📋 STEP 3: Navigate to Menu section
  ✓ Clicked Menu navigation

📥 STEP 4: Navigate to Item Tags tab
  ✓ Clicked Item tags tab button

🏷️  STEP 5: Creating Item Tags
  📋 10 tags to create

  [1/10] Creating tag: "Popular" (#b400fa)
      ✓ Created "Popular"
  [2/10] Creating tag: "New" (#3f92ff)
      ✓ Created "New"
  ...
  [10/10] Creating tag: "Spicy" (#FF3333)
      ✓ Created "Spicy"

📊 Item Tags Summary:
  ✅ Successfully created: 10/10

✅ All item tags configured successfully!

✨ Browser closed
```

### Partial Failure
```
📊 Item Tags Summary:
  ✅ Successfully created: 8/10
  ❌ Failed: 2/10

⚠️ Item tags partially configured
```

---

## Integration with API

The script is called from the registration routes API endpoint:

**Endpoint**: `POST /api/registration/add-item-tags`

**Request Body**:
```json
{
  "restaurantId": "uuid-here"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Item tags configured successfully",
  "output": "script stdout...",
  "error": null
}
```

**Script Execution**:
```javascript
const scriptPath = path.join(__dirname, '../../../scripts/restaurant-registration/add-item-tags.js');

const command = [
  'node',
  scriptPath,
  `--email="${account.email}"`,
  `--password="${account.user_password_hint}"`,
  `--name="${restaurant.name}"`
].join(' ');

const { stdout, stderr } = await execAsync(command, {
  env: { ...process.env, DEBUG_MODE: 'false' },
  timeout: 180000 // 3 minute timeout
});
```

---

## Troubleshooting

### Browser Closes Immediately
- Ensure `--debug` flag is passed or `DEBUG_MODE=true` is set
- Check that the script path is correct

### Restaurant Not Found
- Verify the restaurant name matches what's shown in the dashboard
- Check that the account has access to the restaurant

### Tag Creation Fails
- Check if tags already exist (duplicates may fail)
- Verify selectors haven't changed on the admin portal
- Run with `--debug` to inspect the page state

### Timeout Errors
- The API has a 3-minute timeout
- For slow connections, consider increasing the timeout
- Check network connectivity to admin.pumpd.co.nz

---

## Dependencies

- `playwright` - Browser automation
- `dotenv` - Environment variable loading
- `fs/promises` - Screenshot file operations
- `path` - File path handling

---

## Related Files

| File | Purpose |
|------|---------|
| `registration-routes.js` | API endpoint that calls this script |
| `RestaurantDetail.jsx` | Frontend UI with "Add Item Tags" button |
| `import-csv-menu.js` | Similar script pattern for CSV menu import |
| `add-item-tags-implementation-plan.md` | Frontend/API implementation details |
