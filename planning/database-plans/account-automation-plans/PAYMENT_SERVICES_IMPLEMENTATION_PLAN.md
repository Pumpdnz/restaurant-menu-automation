# Payment and Services Configuration Implementation Plan

## Overview
This document outlines the implementation plan for adding Payment Setup and Services Configuration features to the Pumpd Registration tab in the RestaurantDetail page. These features will allow users to automatically configure Stripe payments and service settings for their registered Pumpd restaurants using updated automation scripts with smart restaurant matching.

## Current State Analysis

### Existing Scripts
1. **setup-stripe-payments.js**:
   - ES module format (import/export)
   - Uses admin password from environment
   - Clicks first restaurant (#restaurant-list-item-0)
   - Configures Stripe with NZD, Accordion layout, Flat theme
   - Sets min/max order values ($2/$9999)
   - Captures Stripe Connect URL (critical output)

2. **setup-services-settings.js**:
   - ES module format (import/export)
   - Uses admin password from environment
   - Clicks first restaurant (#restaurant-list-item-0)
   - Configures Pickup and Delivery settings
   - Sets order timing, auto statuses, minimum orders
   - Disables Dine-ins and Table Bookings

### Required Updates
Both scripts need:
1. Accept password as command-line argument (not admin password)
2. Accept restaurant name for smart matching
3. Implement smart restaurant selection logic from MIGRATION_GUIDE_RESTAURANT_MATCHING.md
4. For Stripe script: Return the Stripe Connect URL for database storage

## Requirements

### Functional Requirements

#### Payment Setup Button
1. Execute updated setup-stripe-payments.js script
2. Use user credentials from pumpd_accounts table
3. Capture Stripe Connect URL from script output
4. Store Stripe Connect URL in database
5. Display URL to user for completing Stripe onboarding

#### Services Configuration Button
1. Execute updated setup-services-settings.js script
2. Use user credentials from pumpd_accounts table
3. Configure all service settings automatically
4. Report success/failure status

### Technical Requirements
1. Both buttons disabled until account and restaurant are registered
2. Use existing authentication and organisation context
3. Scripts can remain as ES modules (Node.js handles them automatically)
4. Execute scripts with simple `node scriptPath` command
5. Parse script output to extract important information
6. Update database with Stripe Connect URL

## Database Schema Updates

### restaurants Table
Use existing `stripe_connect_url` column:
- No schema changes needed
- Column already exists in restaurants table
- Each restaurant has its own Stripe Connect URL
- No need for additional boolean or timestamp columns

## Implementation Design

### Frontend Changes (RestaurantDetail.jsx)

#### 1. Add Payment and Services Section
```javascript
// New section below Website Customization
<Card className="mb-4">
  <CardHeader>
    <h3 className="text-lg font-semibold flex items-center gap-2">
      <CreditCard className="h-5 w-5" />
      Payment & Services Configuration
    </h3>
    <p className="text-sm text-gray-600">
      Configure Stripe payments and service settings for your restaurant
    </p>
  </CardHeader>
  <CardContent>
    {/* Prerequisites check */}
    <div className="mb-4">
      <div className="flex items-center gap-2 text-sm">
        <CheckCircle className={registrationStatus?.account ? "text-green-500" : "text-gray-400"} />
        <span>Account registered</span>
      </div>
      <div className="flex items-center gap-2 text-sm">
        <CheckCircle className={registrationStatus?.restaurant ? "text-green-500" : "text-gray-400"} />
        <span>Restaurant registered</span>
      </div>
    </div>

    {/* Action buttons */}
    <div className="flex gap-4">
      <Button
        onClick={handleSetupStripePayments}
        disabled={!registrationStatus?.account || !registrationStatus?.restaurant || isConfiguringPayments}
        className="flex items-center gap-2"
      >
        {isConfiguringPayments ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <CreditCard className="h-4 w-4" />
        )}
        Setup Stripe Payments
      </Button>

      <Button
        onClick={handleConfigureServices}
        disabled={!registrationStatus?.account || !registrationStatus?.restaurant || isConfiguringServices}
        className="flex items-center gap-2"
      >
        {isConfiguringServices ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Settings className="h-4 w-4" />
        )}
        Configure Services
      </Button>
    </div>

    {/* Status/Results display */}
    {paymentStatus && (
      <Alert className="mt-4">
        <AlertDescription>
          {paymentStatus.success ? (
            <>
              <CheckCircle className="inline h-4 w-4 text-green-500 mr-2" />
              Stripe configuration completed!
              {paymentStatus.stripeConnectUrl && (
                <div className="mt-2">
                  <strong>Complete Stripe setup here:</strong>
                  <a 
                    href={paymentStatus.stripeConnectUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="block text-blue-600 underline break-all"
                  >
                    {paymentStatus.stripeConnectUrl}
                  </a>
                </div>
              )}
            </>
          ) : (
            <>
              <AlertCircle className="inline h-4 w-4 text-red-500 mr-2" />
              {paymentStatus.error}
            </>
          )}
        </AlertDescription>
      </Alert>
    )}

    {servicesStatus && (
      <Alert className="mt-4">
        <AlertDescription>
          {servicesStatus.success ? (
            <>
              <CheckCircle className="inline h-4 w-4 text-green-500 mr-2" />
              Services configured successfully!
            </>
          ) : (
            <>
              <AlertCircle className="inline h-4 w-4 text-red-500 mr-2" />
              {servicesStatus.error}
            </>
          )}
        </AlertDescription>
      </Alert>
    )}
  </CardContent>
</Card>
```

#### 2. State Management
```javascript
// Payment and Services states
const [isConfiguringPayments, setIsConfiguringPayments] = useState(false);
const [paymentStatus, setPaymentStatus] = useState(null);
const [isConfiguringServices, setIsConfiguringServices] = useState(false);
const [servicesStatus, setServicesStatus] = useState(null);
```

#### 3. Handler Functions
```javascript
const handleSetupStripePayments = async () => {
  setIsConfiguringPayments(true);
  setPaymentStatus(null);
  
  try {
    const response = await fetch('/api/registration/setup-stripe-payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabase.auth.session()?.access_token}`
      },
      body: JSON.stringify({ restaurantId: restaurant.id })
    });
    
    const result = await response.json();
    setPaymentStatus(result);
    
    // If successful and we have a Stripe URL, also update local state
    if (result.success && result.stripeConnectUrl) {
      // Could trigger a refresh of registration status here
      await fetchRegistrationStatus();
    }
  } catch (error) {
    setPaymentStatus({ 
      success: false, 
      error: error.message 
    });
  } finally {
    setIsConfiguringPayments(false);
  }
};

const handleConfigureServices = async () => {
  setIsConfiguringServices(true);
  setServicesStatus(null);
  
  try {
    const response = await fetch('/api/registration/configure-services', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabase.auth.session()?.access_token}`
      },
      body: JSON.stringify({ restaurantId: restaurant.id })
    });
    
    const result = await response.json();
    setServicesStatus(result);
  } catch (error) {
    setServicesStatus({ 
      success: false, 
      error: error.message 
    });
  } finally {
    setIsConfiguringServices(false);
  }
};
```

### Backend Implementation

#### 1. Script Updates Required

##### Module System Handling
The scripts currently use ES modules with `createRequire` workaround, which allows them to:
- Use ES module syntax (import/export)
- Import CommonJS modules via `createRequire`
- Be executed directly with `node scriptPath` without special flags
- Node.js automatically detects and handles the module type

No conversion needed - the scripts already work correctly as ES modules.

##### Add Smart Restaurant Matching
Both scripts need the complete smart matching logic from test-get-restaurant-id.js:
```javascript
// Add to both scripts after login
const normalizeForMatching = (str) => { /* ... */ };
const calculateMatchScore = (searchTerm, restaurantName) => { /* ... */ };
// Full matching implementation
```

##### Update Argument Parsing
```javascript
// Parse arguments
const email = getArg('email');
const password = getArg('password');  // NEW: User password
const restaurantName = getArg('name'); // NEW: For matching

// Validate
if (!email || !password || !restaurantName) {
  console.error('❌ Error: Missing required parameters');
  console.error('Required: --email=<email> --password=<password> --name=<restaurant_name>');
  process.exit(1);
}
```

#### 2. New Route: /api/registration/setup-stripe-payments
```javascript
router.post('/setup-stripe-payments', async (req, res) => {
  const { restaurantId } = req.body;
  const organisationId = req.user?.organisationId;
  
  if (!organisationId) {
    return res.status(401).json({ 
      success: false, 
      error: 'Organisation context required' 
    });
  }
  
  try {
    const { supabase } = require('../services/database-service');
    
    // Get restaurant details
    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('name')
      .eq('id', restaurantId)
      .eq('organisation_id', organisationId)
      .single();
    
    if (!restaurant) {
      throw new Error('Restaurant not found');
    }
    
    // Get account credentials
    const { data: account } = await supabase
      .from('pumpd_accounts')
      .select('email, user_password_hint')
      .eq('restaurant_id', restaurantId)
      .eq('organisation_id', organisationId)
      .single();
    
    if (!account || !account.email || !account.user_password_hint) {
      throw new Error('Restaurant account not found or incomplete credentials');
    }
    
    // Execute setup-stripe-payments.js script
    const scriptPath = path.join(__dirname, '../../../scripts/setup-stripe-payments.js');
    
    // Execute ES module script (Node handles module type automatically)
    const command = `node ${scriptPath} --email="${account.email}" --password="${account.user_password_hint}" --name="${restaurant.name}"`;
    
    console.log('[Stripe Setup] Executing:', command);
    
    const { stdout, stderr } = await execAsync(command, {
      env: { ...process.env, DEBUG_MODE: 'false' },
      timeout: 180000 // 3 minute timeout
    });
    
    console.log('[Stripe Setup] Script output:', stdout);
    
    // Parse Stripe Connect URL from output
    let stripeConnectUrl = null;
    const urlMatch = stdout.match(/Final URL: (https:\/\/[^\s]+)/);
    if (urlMatch) {
      stripeConnectUrl = urlMatch[1];
      console.log('[Stripe Setup] Extracted Stripe Connect URL:', stripeConnectUrl);
      
      // Save to database (restaurants table, not pumpd_accounts)
      const { error: updateError } = await supabase
        .from('restaurants')
        .update({
          stripe_connect_url: stripeConnectUrl
        })
        .eq('id', restaurantId)
        .eq('organisation_id', organisationId);
      
      if (updateError) {
        console.error('[Stripe Setup] Failed to save URL to database:', updateError);
      } else {
        console.log('[Stripe Setup] ✓ Saved Stripe Connect URL to database');
      }
    }
    
    // Check for success
    const success = stdout.includes('successfully configured') || 
                   stdout.includes('✅');
    
    res.json({
      success,
      message: success ? 'Stripe payments configured successfully' : 'Configuration failed',
      stripeConnectUrl,
      output: stdout,
      error: stderr || null
    });
    
  } catch (error) {
    console.error('[Stripe Setup] Error:', error);
    
    const isTimeout = error.code === 'ETIMEDOUT' || error.message.includes('timeout');
    
    res.status(500).json({
      success: false,
      error: isTimeout ? 
        'Stripe configuration timed out. Please try again.' :
        error.message,
      details: error.stderr || null
    });
  }
});
```

#### 3. New Route: /api/registration/configure-services
```javascript
router.post('/configure-services', async (req, res) => {
  const { restaurantId } = req.body;
  const organisationId = req.user?.organisationId;
  
  if (!organisationId) {
    return res.status(401).json({ 
      success: false, 
      error: 'Organisation context required' 
    });
  }
  
  try {
    const { supabase } = require('../services/database-service');
    
    // Get restaurant details
    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('name')
      .eq('id', restaurantId)
      .eq('organisation_id', organisationId)
      .single();
    
    if (!restaurant) {
      throw new Error('Restaurant not found');
    }
    
    // Get account credentials
    const { data: account } = await supabase
      .from('pumpd_accounts')
      .select('email, user_password_hint')
      .eq('restaurant_id', restaurantId)
      .eq('organisation_id', organisationId)
      .single();
    
    if (!account || !account.email || !account.user_password_hint) {
      throw new Error('Restaurant account not found or incomplete credentials');
    }
    
    // Execute setup-services-settings.js script
    const scriptPath = path.join(__dirname, '../../../scripts/setup-services-settings.js');
    
    // Execute ES module script (Node handles module type automatically)
    const command = `node ${scriptPath} --email="${account.email}" --password="${account.user_password_hint}" --name="${restaurant.name}"`;
    
    console.log('[Services Setup] Executing:', command);
    
    const { stdout, stderr } = await execAsync(command, {
      env: { ...process.env, DEBUG_MODE: 'false' },
      timeout: 240000 // 4 minute timeout (lots of configurations)
    });
    
    console.log('[Services Setup] Script output:', stdout);
    
    // Check for success
    const success = stdout.includes('All Services Settings have been configured successfully') || 
                   stdout.includes('✅');
    
    res.json({
      success,
      message: success ? 'Services configured successfully' : 'Configuration failed',
      output: stdout,
      error: stderr || null
    });
    
  } catch (error) {
    console.error('[Services Setup] Error:', error);
    
    const isTimeout = error.code === 'ETIMEDOUT' || error.message.includes('timeout');
    
    res.status(500).json({
      success: false,
      error: isTimeout ? 
        'Services configuration timed out. The process may take longer for complex configurations. Please try again.' :
        error.message,
      details: error.stderr || null
    });
  }
});
```

## Script Migration Details

### Module System Approach

Both scripts currently use ES modules with the `createRequire` workaround pattern:

```javascript
// Current ES module pattern in scripts
import { createRequire } from 'module';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';

const require = createRequire(import.meta.url);
const { chromium } = require('./restaurant-registration/node_modules/playwright');
```

This pattern allows the scripts to:
- Use modern ES module syntax
- Import CommonJS modules (like playwright) using createRequire
- Be executed directly with `node scriptPath` without special flags
- Work alongside other CommonJS scripts in the codebase

**No conversion is needed** - Node.js automatically detects the module type and handles execution properly.

### Smart Matching Implementation
Copy the complete matching logic from test-get-restaurant-id.js:
1. normalizeForMatching function
2. calculateMatchScore function
3. Restaurant finding and scoring logic
4. Multiple selector fallbacks for Manage button

### Dashboard Waiting Logic
Add improved waiting after login:
```javascript
// Wait for dashboard
await page.waitForURL('**/admin.pumpd.co.nz/**', { timeout: 15000 });

// Wait for loading overlay to disappear
await page.waitForFunction(() => {
  const loader = document.querySelector('.cover-loader');
  return !loader || !loader.classList.contains('active');
}, { timeout: 10000 });

// Wait for content to load
await page.waitForTimeout(5000);

try {
  await page.waitForSelector('h4', { timeout: 10000 });
  console.log('  ✓ Dashboard content loaded');
} catch (error) {
  console.log('  ⚠️ No h4 elements found, continuing anyway...');
}
```

## Implementation Steps

### Phase 1: Script Updates
1. Keep scripts as ES modules (no conversion needed)
2. Add password and restaurant name arguments
3. Implement smart restaurant matching logic
4. Test scripts with user credentials
5. Ensure Stripe Connect URL extraction works

### Phase 2: Database Updates
1. Verify stripe_connect_url column exists in restaurants table
2. Test database updates for storing Stripe URL
3. No schema changes needed (using existing column)

### Phase 3: Backend Routes
1. Create setup-stripe-payments route
2. Create configure-services route
3. Implement script execution with proper arguments
4. Parse script output for important data
5. Update database with Stripe URL

### Phase 4: Frontend Integration
1. Add Payment & Services section to RestaurantDetail
2. Implement state management for both operations
3. Add handler functions for API calls
4. Display results and Stripe Connect URL
5. Add proper loading states and error handling

### Phase 5: Testing
1. Test with single restaurant accounts
2. Test with multiple restaurant accounts
3. Test restaurant name matching edge cases
4. Test Stripe URL extraction and storage
5. Test error scenarios and timeouts

## Error Handling

### Script Failures
1. **Login failures**: Invalid credentials
2. **Restaurant not found**: Name matching failed
3. **Navigation errors**: UI changes or selectors broken
4. **Timeout errors**: Scripts taking too long
5. **Stripe Connect URL not captured**: Parsing failure

### User Feedback
1. Clear error messages for each failure type
2. Actionable suggestions (e.g., "Please ensure you're registered first")
3. Display partial success when applicable
4. Show Stripe Connect URL prominently when captured

## Security Considerations

1. **Credentials**: Never log passwords in plain text
2. **Script Execution**: Run with limited permissions and timeouts
3. **URL Validation**: Validate Stripe Connect URLs before storing
4. **Database Access**: Use RLS and organisation context
5. **Error Messages**: Don't expose sensitive system information

## Future Enhancements

1. **Progress Tracking**: Show real-time script progress
2. **Retry Logic**: Automatic retry on timeout
3. **Bulk Configuration**: Configure multiple restaurants
4. **Configuration Validation**: Verify settings were applied correctly
5. **Stripe Webhook**: Listen for Stripe connection completion
6. **Rollback**: Ability to reset configurations
7. **Configuration Templates**: Save and apply configuration presets

## Testing Checklist

- [ ] Scripts execute correctly as ES modules
- [ ] Scripts accept user password and restaurant name
- [ ] Smart matching finds correct restaurant
- [ ] Stripe Connect URL extracted correctly
- [ ] Stripe URL saved to database
- [ ] Services configuration completes all steps
- [ ] Frontend buttons disabled when prerequisites not met
- [ ] Loading states display correctly
- [ ] Error messages are helpful
- [ ] Success messages show Stripe URL
- [ ] Works with restaurants containing apostrophes
- [ ] Works with multiple restaurants per account
- [ ] Timeout handling works properly
- [ ] Database updates are atomic

## Dependencies

### NPM Packages
- playwright: Already installed for browser automation
- No new packages required

### Scripts to Update
- setup-stripe-payments.js: Add user password arg, add smart matching
- setup-services-settings.js: Add user password arg, add smart matching

### Database Changes
- restaurants table: Use existing stripe_connect_url column

## Notes

- The Stripe Connect URL is critical - users must complete the Stripe onboarding process
- Services configuration is extensive and may take 3-4 minutes to complete
- Both scripts should use headless: false initially for debugging
- Consider adding a "Check Configuration" feature to verify settings
- The 4-minute timeout for services should be sufficient but may need adjustment
- ES modules work seamlessly with the existing backend - no conversion needed
- Scripts use createRequire workaround to import CommonJS modules from ES modules