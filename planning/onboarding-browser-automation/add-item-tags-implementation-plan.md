# Add Item Tags Feature - Implementation Plan

## Overview
Add a new "Add Tags" button to the Menu CSV Upload section of the Pumpd Registration tab that runs the `add-item-tags.js` Playwright script to configure item tags on the Pumpd admin portal.

---

## 1. Frontend Changes - RestaurantDetail.jsx

### File Location
`UberEats-Image-Extractor/src/pages/RestaurantDetail.jsx`

### 1.1 Add Import
Add `Tag` icon to the lucide-react imports (line ~48):
```javascript
import {
  // ... existing imports
  Tag  // ADD THIS
} from 'lucide-react';
```

### 1.2 Add State Variables
Add after line ~180 (after CSV Upload states):
```javascript
// Item Tags states
const [isAddingTags, setIsAddingTags] = useState(false);
const [tagsStatus, setTagsStatus] = useState(null);
```

### 1.3 Add Handler Function
Add after `handleCsvUpload` function (after line ~652):
```javascript
// Item Tags handler
const handleAddItemTags = async () => {
  if (!registrationStatus?.account || registrationStatus.account.registration_status !== 'completed') {
    toast({
      title: "Error",
      description: "Account registration must be completed before adding tags",
      variant: "destructive"
    });
    return;
  }

  if (!registrationStatus?.restaurant || registrationStatus.restaurant.registration_status !== 'completed') {
    toast({
      title: "Error",
      description: "Restaurant registration must be completed before adding tags",
      variant: "destructive"
    });
    return;
  }

  setIsAddingTags(true);
  setTagsStatus(null);

  try {
    const response = await api.post('/registration/add-item-tags', {
      restaurantId: id
    });

    setTagsStatus(response.data);

    if (response.data.success) {
      toast({
        title: "Success",
        description: "Item tags configured successfully",
      });
    } else {
      toast({
        title: "Warning",
        description: response.data.message || "Tag configuration completed with warnings",
        variant: "warning"
      });
    }
  } catch (error) {
    const errorMessage = error.response?.data?.error || error.message;
    setTagsStatus({
      success: false,
      error: errorMessage
    });
    toast({
      title: "Error",
      description: errorMessage,
      variant: "destructive"
    });
  } finally {
    setIsAddingTags(false);
  }
};
```

### 1.4 Add UI Button
Add the "Add Tags" button after the Upload Menu button (after line ~4386):
```jsx
{/* Add Tags Button */}
<Button
  onClick={handleAddItemTags}
  disabled={isAddingTags || !registrationStatus?.restaurant?.registration_status === 'completed'}
  className="w-full"
  variant="outline"
>
  {isAddingTags ? (
    <>
      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      Adding Tags...
    </>
  ) : (
    <>
      <Tag className="h-4 w-4 mr-2" />
      Add Item Tags
    </>
  )}
</Button>

{/* Tags Status Messages */}
{tagsStatus && (
  <Alert className={tagsStatus.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
    {tagsStatus.success ? (
      <FileCheck className="h-4 w-4 text-green-600" />
    ) : (
      <AlertCircle className="h-4 w-4 text-red-600" />
    )}
    <AlertDescription className={tagsStatus.success ? 'text-green-800' : 'text-red-800'}>
      {tagsStatus.success
        ? 'Item tags configured successfully!'
        : (tagsStatus.error || 'Failed to configure item tags')}
    </AlertDescription>
  </Alert>
)}
```

---

## 2. Backend Changes - registration-routes.js

### File Location
`UberEats-Image-Extractor/src/routes/registration-routes.js`

### 2.1 Add New Endpoint
Add the following route (can be placed after `/configure-services` endpoint around line ~1777):

```javascript
/**
 * Add Item Tags to menu items
 * Uses add-item-tags.js script to automate tag configuration
 */
router.post('/add-item-tags', async (req, res) => {
  const { restaurantId } = req.body;
  const organisationId = req.user?.organisationId;

  console.log('[Item Tags] Request received:', { restaurantId, organisationId });

  if (!organisationId) {
    return res.status(401).json({
      success: false,
      error: 'Organisation context required'
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

    console.log('[Item Tags] Restaurant found:', restaurant.name);

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

    console.log('[Item Tags] Account found:', finalAccount.email);

    // Execute add-item-tags.js script
    const scriptPath = path.join(__dirname, '../../../scripts/restaurant-registration/add-item-tags.js');

    // Build command with proper escaping
    const command = [
      'node',
      scriptPath,
      `--email="${finalAccount.email}"`,
      `--password="${finalAccount.user_password_hint}"`,
      `--name="${restaurant.name.replace(/"/g, '\\"')}"`
    ].join(' ');

    console.log('[Item Tags] Executing item tags configuration script...');

    const { stdout, stderr } = await execAsync(command, {
      env: { ...process.env, DEBUG_MODE: 'false' },
      timeout: 180000 // 3 minute timeout
    });

    console.log('[Item Tags] Script output:', stdout);
    if (stderr) {
      console.error('[Item Tags] Script stderr:', stderr);
    }

    // Check for success indicators
    const success = stdout.includes('Successfully') ||
                   stdout.includes('completed') ||
                   stdout.includes('Item tags configured') ||
                   stdout.includes('Tags added');

    console.log('[Item Tags] Configuration result:', success ? 'Success' : 'Partial/Failed');

    res.json({
      success,
      message: success ? 'Item tags configured successfully' : 'Configuration completed with warnings',
      output: stdout,
      error: stderr || null
    });

  } catch (error) {
    console.error('[Item Tags] Error:', error);

    const isTimeout = error.code === 'ETIMEDOUT' || error.message.includes('timeout');

    res.status(500).json({
      success: false,
      error: isTimeout ?
        'Item tags configuration timed out. The process may be taking longer than expected. Please try again.' :
        error.message,
      details: error.stderr || null
    });
  }
});
```

---

## 3. Server.js Changes

### File Location
`UberEats-Image-Extractor/server.js`

### No Changes Required
The registration routes are already mounted at `/api/registration` (line ~7530):
```javascript
const registrationRoutes = require('./src/routes/registration-routes');
app.use('/api/registration', authMiddleware, registrationRoutes);
```

The new `/add-item-tags` endpoint will automatically be available at `/api/registration/add-item-tags`.

---

## 4. Implementation Order

1. **Add API endpoint** to `registration-routes.js`
   - Copy the pattern from `/configure-services`
   - Point to `add-item-tags.js` script

2. **Add frontend state variables** to `RestaurantDetail.jsx`
   - `isAddingTags` (boolean)
   - `tagsStatus` (object)

3. **Add handler function** to `RestaurantDetail.jsx`
   - `handleAddItemTags` async function

4. **Add UI button** to the Menu CSV Upload section
   - Add `Tag` icon import
   - Add button after Upload Menu button
   - Add status message display

---

## 5. Testing Checklist

- [ ] API endpoint returns 401 without organisation context
- [ ] API endpoint returns 404 if restaurant not found
- [ ] API endpoint returns error if account not registered
- [ ] API endpoint executes script with correct parameters
- [ ] API endpoint handles script timeout gracefully
- [ ] Frontend button is disabled during operation
- [ ] Frontend shows loading spinner during operation
- [ ] Frontend shows success toast on completion
- [ ] Frontend shows error toast on failure
- [ ] Frontend displays status alert after operation

---

## 6. Script Path Reference

The script is located at:
```
/Users/giannimunro/Desktop/cursor-projects/automation/scripts/restaurant-registration/add-item-tags.js
```

Relative path from registration-routes.js:
```
path.join(__dirname, '../../../scripts/restaurant-registration/add-item-tags.js')
```

---

## 7. UI Layout Summary

The button will be placed in this structure:
```
Menu CSV Upload Card
├── CardHeader (Title + Description)
└── CardContent
    ├── Prerequisites Status (checkmarks)
    ├── File Upload Section (input + clear button)
    ├── Upload Menu Button (existing)
    ├── Add Item Tags Button (NEW)  <-- ADD HERE
    ├── Upload Status Messages (existing)
    └── Tags Status Messages (NEW)  <-- ADD HERE
```
