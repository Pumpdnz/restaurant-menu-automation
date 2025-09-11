# Website Customization Implementation Plan

## Overview
This document outlines the implementation plan for adding website customization features to the Pumpd Registration tab in the RestaurantDetail page. This feature will allow users to generate code injections and configure website settings for their registered Pumpd restaurants using updated automation scripts with smart restaurant matching.

## Current State Analysis

### Existing Components
1. **Frontend**: RestaurantDetail.jsx has Pumpd Registration tab with account registration, restaurant registration, and CSV upload features
2. **Backend**: registration-routes.js handles script execution via `execAsync`
3. **Authentication**: Routes require organisation context via `req.user?.organisationId`
4. **Scripts**: 
   - `ordering-page-customization.js`: Generates code injections with hardcoded credentials
   - `edit-website-settings-dark.js` & `edit-website-settings-light.js`: Configure website settings with admin password
5. **Database Schema**:
   - `restaurants` table: primary_color, secondary_color, theme, logo_url, instagram_url, facebook_url, address, phone, cuisine (array)
   - `pumpd_accounts` table: email, user_password_hint, restaurant_id

### Issues to Address
1. Scripts use hardcoded credentials or admin password
2. Scripts don't support smart restaurant matching
3. Generated code location needs better management
4. No integration with database for colors and theme

## Requirements

### Functional Requirements
1. Add new Website Customization section below CSV Upload section
2. Two action buttons:
   - "Generate code injections" - runs ordering-page-customization.js
   - "Configure Website Settings" - runs appropriate edit-website-settings script
3. Get theme colors (primary, secondary) and theme from database
4. Select correct script based on theme (dark vs light)
5. Use user credentials from database (not admin password)
6. Implement smart restaurant matching per migration guide
7. Better file management for generated code

### Technical Requirements
1. Use existing authentication and organisation context
2. Get credentials from pumpd_accounts table
3. Get restaurant details from restaurants table
4. Update scripts to accept password and name arguments
5. Add smart matching logic to website settings scripts
6. Generate code in predictable location for reuse
7. Pass generated file paths between scripts

## Implementation Design

### Frontend Changes (RestaurantDetail.jsx)

#### 1. Add Website Customization Section
```javascript
// New section structure (below CSV Upload):
<Card className="mb-4">
  <CardHeader>
    <h3 className="text-lg font-semibold flex items-center gap-2">
      <Palette className="h-5 w-5" />
      Website Customization
    </h3>
    <p className="text-sm text-gray-600">
      Generate and apply custom styling to your Pumpd website
    </p>
  </CardHeader>
  <CardContent>
    {/* Prerequisites status */}
    <div className="mb-4 space-y-2">
      <div className="flex items-center gap-2">
        {registrationStatus?.account ? (
          <CheckCircle className="h-4 w-4 text-green-500" />
        ) : (
          <XCircle className="h-4 w-4 text-gray-400" />
        )}
        <span className="text-sm">Account registered</span>
      </div>
      <div className="flex items-center gap-2">
        {registrationStatus?.restaurant ? (
          <CheckCircle className="h-4 w-4 text-green-500" />
        ) : (
          <XCircle className="h-4 w-4 text-gray-400" />
        )}
        <span className="text-sm">Restaurant registered</span>
      </div>
      <div className="flex items-center gap-2">
        {restaurant.primary_color && restaurant.secondary_color ? (
          <CheckCircle className="h-4 w-4 text-green-500" />
        ) : (
          <XCircle className="h-4 w-4 text-gray-400" />
        )}
        <span className="text-sm">Theme colors configured</span>
      </div>
    </div>

    {/* Action buttons */}
    <div className="space-y-2">
      <Button
        onClick={handleGenerateCodeInjections}
        disabled={!canCustomize || isGenerating}
        className="w-full"
      >
        {isGenerating ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Generating...
          </>
        ) : (
          <>
            <Code className="mr-2 h-4 w-4" />
            Generate Code Injections
          </>
        )}
      </Button>

      <Button
        onClick={handleConfigureWebsite}
        disabled={!canCustomize || !codeGenerated || isConfiguring}
        className="w-full"
      >
        {isConfiguring ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Configuring...
          </>
        ) : (
          <>
            <Settings className="mr-2 h-4 w-4" />
            Configure Website Settings
          </>
        )}
      </Button>
    </div>

    {/* Status messages */}
    {customizationStatus && (
      <div className={`mt-4 p-3 rounded ${
        customizationStatus.success ? 'bg-green-50' : 'bg-red-50'
      }`}>
        <p className={`text-sm ${
          customizationStatus.success ? 'text-green-700' : 'text-red-700'
        }`}>
          {customizationStatus.message}
        </p>
      </div>
    )}
  </CardContent>
</Card>
```

#### 2. State Management
```javascript
const [isGenerating, setIsGenerating] = useState(false);
const [isConfiguring, setIsConfiguring] = useState(false);
const [codeGenerated, setCodeGenerated] = useState(false);
const [customizationStatus, setCustomizationStatus] = useState(null);
const [generatedFilePaths, setGeneratedFilePaths] = useState(null);

// Computed state
const canCustomize = registrationStatus?.account && 
                     registrationStatus?.restaurant && 
                     restaurant.primary_color && 
                     restaurant.secondary_color;
```

#### 3. Handler Functions
```javascript
const handleGenerateCodeInjections = async () => {
  setIsGenerating(true);
  setCustomizationStatus(null);
  
  try {
    const response = await fetch('/api/registration/generate-code-injections', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabase.auth.session()?.access_token}`
      },
      body: JSON.stringify({ restaurantId: restaurant.id })
    });
    
    const result = await response.json();
    
    if (result.success) {
      setCodeGenerated(true);
      setGeneratedFilePaths(result.filePaths);
      setCustomizationStatus({
        success: true,
        message: 'Code injections generated successfully'
      });
    } else {
      setCustomizationStatus({
        success: false,
        message: result.error || 'Failed to generate code injections'
      });
    }
  } catch (error) {
    setCustomizationStatus({
      success: false,
      message: error.message
    });
  } finally {
    setIsGenerating(false);
  }
};

const handleConfigureWebsite = async () => {
  if (!generatedFilePaths) {
    setCustomizationStatus({
      success: false,
      message: 'Please generate code injections first'
    });
    return;
  }
  
  setIsConfiguring(true);
  setCustomizationStatus(null);
  
  try {
    const response = await fetch('/api/registration/configure-website', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabase.auth.session()?.access_token}`
      },
      body: JSON.stringify({ 
        restaurantId: restaurant.id,
        filePaths: generatedFilePaths
      })
    });
    
    const result = await response.json();
    setCustomizationStatus({
      success: result.success,
      message: result.success 
        ? 'Website configured successfully' 
        : result.error || 'Configuration failed'
    });
  } catch (error) {
    setCustomizationStatus({
      success: false,
      message: error.message
    });
  } finally {
    setIsConfiguring(false);
  }
};
```

### Backend Implementation

#### 1. New Route: /api/registration/generate-code-injections
```javascript
// In registration-routes.js

router.post('/generate-code-injections', async (req, res) => {
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
      .select('name, primary_color, secondary_color, theme')
      .eq('id', restaurantId)
      .eq('organisation_id', organisationId)
      .single();
    
    if (!restaurant?.primary_color || !restaurant?.secondary_color) {
      return res.status(400).json({
        success: false,
        error: 'Restaurant colors not configured'
      });
    }
    
    // Prepare script arguments
    const scriptPath = '/Users/giannimunro/Desktop/cursor-projects/automation/scripts/ordering-page-customization.js';
    
    // Build command with proper escaping
    let command = `node ${scriptPath}`;
    command += ` --primary="${restaurant.primary_color}"`;
    command += ` --secondary="${restaurant.secondary_color}"`;
    command += ` --name="${restaurant.name.replace(/"/g, '\\"')}"`;
    
    // Add lightmode flag only if theme is explicitly "light"
    if (restaurant.theme === 'light') {
      command += ' --lightmode';
    }
    
    console.log('[Code Generation] Executing:', command);
    
    const { stdout, stderr } = await execAsync(command, {
      env: { ...process.env },
      timeout: 60000 // 1 minute timeout
    });
    
    // Parse output to find generated file paths
    const outputDir = path.join(
      '/Users/giannimunro/Desktop/cursor-projects/automation/generated-code',
      sanitizeForPath(restaurant.name)
    );
    
    const filePaths = {
      headInjection: path.join(outputDir, 'head-injection.html'),
      bodyInjection: path.join(outputDir, 'body-injection.html'),
      configuration: path.join(outputDir, 'configuration.json')
    };
    
    // Verify files exist
    const fs = require('fs').promises;
    for (const [key, filePath] of Object.entries(filePaths)) {
      try {
        await fs.access(filePath);
      } catch {
        console.error(`[Code Generation] File not found: ${filePath}`);
        return res.status(500).json({
          success: false,
          error: `Generated file not found: ${key}`
        });
      }
    }
    
    res.json({
      success: true,
      message: 'Code injections generated successfully',
      filePaths,
      output: stdout
    });
    
  } catch (error) {
    console.error('[Code Generation] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Helper function to sanitize restaurant name for file paths
function sanitizeForPath(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
```

#### 2. New Route: /api/registration/configure-website
```javascript
router.post('/configure-website', async (req, res) => {
  const { restaurantId, filePaths } = req.body;
  const organisationId = req.user?.organisationId;
  
  if (!organisationId) {
    return res.status(401).json({ 
      success: false, 
      error: 'Organisation context required' 
    });
  }
  
  if (!filePaths?.headInjection || !filePaths?.bodyInjection) {
    return res.status(400).json({
      success: false,
      error: 'Generated file paths required'
    });
  }
  
  try {
    const { supabase } = require('../services/database-service');
    
    // Get restaurant and account details
    const { data: restaurant } = await supabase
      .from('restaurants')
      .select(`
        name, 
        primary_color, 
        theme,
        logo_url,
        instagram_url,
        facebook_url,
        address,
        phone,
        cuisine
      `)
      .eq('id', restaurantId)
      .eq('organisation_id', organisationId)
      .single();
    
    const { data: account } = await supabase
      .from('pumpd_accounts')
      .select('email, user_password_hint')
      .eq('restaurant_id', restaurantId)
      .eq('organisation_id', organisationId)
      .single();
    
    if (!account?.email || !account?.user_password_hint) {
      return res.status(400).json({
        success: false,
        error: 'Restaurant account not found or incomplete credentials'
      });
    }
    
    // Select appropriate script based on theme
    const isDark = restaurant.theme !== 'light';
    const scriptName = isDark ? 'edit-website-settings-dark.js' : 'edit-website-settings-light.js';
    const scriptPath = `/Users/giannimunro/Desktop/cursor-projects/automation/scripts/${scriptName}`;
    
    // Build command with all arguments
    let command = `node ${scriptPath}`;
    command += ` --email="${account.email}"`;
    command += ` --password="${account.user_password_hint}"`;
    command += ` --name="${restaurant.name.replace(/"/g, '\\"')}"`;
    command += ` --primary="${restaurant.primary_color}"`;
    command += ` --head="${filePaths.headInjection}"`;
    command += ` --body="${filePaths.bodyInjection}"`;
    
    // Add optional fields if available
    if (restaurant.logo_url) {
      // Download logo to temp location if it's a URL
      const logoPath = await downloadLogoIfNeeded(restaurant.logo_url);
      command += ` --logo="${logoPath}"`;
    }
    
    if (restaurant.address) {
      command += ` --address="${restaurant.address.replace(/"/g, '\\"')}"`;
    }
    
    if (restaurant.phone) {
      command += ` --phone="${restaurant.phone}"`;
    }
    
    if (restaurant.instagram_url) {
      command += ` --instagram="${restaurant.instagram_url}"`;
    }
    
    if (restaurant.facebook_url) {
      command += ` --facebook="${restaurant.facebook_url}"`;
    }
    
    if (restaurant.cuisine && restaurant.cuisine.length > 0) {
      command += ` --cuisine="${restaurant.cuisine.join(', ')}"`;
    }
    
    console.log('[Website Config] Executing:', scriptName);
    console.log('[Website Config] Restaurant:', restaurant.name);
    console.log('[Website Config] Theme:', isDark ? 'dark' : 'light');
    
    const { stdout, stderr } = await execAsync(command, {
      env: { ...process.env, DEBUG_MODE: 'false' },
      timeout: 120000 // 2 minute timeout
    });
    
    // Check for success indicators
    const success = stdout.includes('Successfully') || 
                   stdout.includes('✅') ||
                   stdout.includes('Complete');
    
    res.json({
      success,
      message: success ? 'Website configured successfully' : 'Configuration may have issues',
      output: stdout,
      error: stderr || null
    });
    
  } catch (error) {
    console.error('[Website Config] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Helper function to download logo if needed
async function downloadLogoIfNeeded(logoUrl) {
  if (!logoUrl || logoUrl.startsWith('/')) {
    return logoUrl; // Local path or empty
  }
  
  // Download to temp directory
  const https = require('https');
  const fs = require('fs');
  const path = require('path');
  const tempPath = path.join('/tmp', `logo-${Date.now()}.png`);
  
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(tempPath);
    https.get(logoUrl, response => {
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve(tempPath);
      });
    }).on('error', err => {
      fs.unlink(tempPath, () => {});
      reject(err);
    });
  });
}
```

### Script Updates

#### 1. Update ordering-page-customization.js
```javascript
// Changes needed:
// 1. Accept email and password as arguments (remove hardcoded credentials)
// 2. Add smart restaurant matching logic
// 3. Ensure consistent output directory structure

// Add to argument parsing:
const email = getArg('email') || 'claude.agent@gmail.com'; // Fallback for backward compatibility
const password = getArg('password') || '7uo@%K2^Hz%yiXDeP39Ckp6BvF!2'; // Fallback

// Replace hardcoded credentials:
const LOGIN_EMAIL = email;
const LOGIN_PASSWORD = password;

// Add smart matching logic after login (copy from migration guide)
// ... [insert smart matching code here] ...

// Ensure output directory is predictable:
const outputDir = path.join(__dirname, '..', 'generated-code', sanitize(restaurantName));
```

#### 2. Update edit-website-settings-dark.js and edit-website-settings-light.js
```javascript
// Major changes needed:
// 1. Accept password as argument (not use admin password)
// 2. Add smart restaurant matching logic
// 3. Remove hardcoded restaurant selection

// Update argument parsing:
const password = getArg('password'); // NEW: Required argument
const restaurantName = getArg('name'); // Already exists

// Update validation:
if (!email || !password || !restaurantName || !primaryColor || !headPath || !bodyPath) {
  console.error('❌ Error: Missing required parameters');
  console.error('Required: --email=<email> --password=<password> --name=<name> --primary=<color> --head=<path> --body=<path>');
  process.exit(1);
}

// Remove admin password usage:
// const password = process.env.ADMIN_PASSWORD || '7uo@%K2^Hz%yiXDeP39Ckp6BvF!2';

// Add improved waiting after login:
// [Copy from migration guide section 3]

// Replace restaurant selection with smart matching:
// [Copy complete smart matching code from migration guide section 4]
```

### Database Considerations

#### Required Fields
- **restaurants table**:
  - primary_color (text) - Required for generation
  - secondary_color (text) - Required for generation
  - theme (text) - Determines light/dark mode
  - name (text) - For restaurant matching
  - logo_url (text) - Optional
  - instagram_url (text) - Optional
  - facebook_url (text) - Optional
  - address (text) - Optional
  - phone (varchar) - Optional
  - cuisine (array) - Optional

- **pumpd_accounts table**:
  - email (varchar) - Login credential
  - user_password_hint (varchar) - Login credential
  - restaurant_id (uuid) - Links to restaurant

### Security Considerations

1. **Authentication**: Require valid user session and organisation context
2. **Input Validation**: Sanitize all inputs, especially restaurant names for file paths
3. **Command Injection**: Properly escape all shell arguments
4. **File Access**: Verify generated files exist before passing paths
5. **Temporary Files**: Clean up any downloaded logos
6. **Script Execution**: Run with timeout limits
7. **Password Security**: Never log passwords in console output

### Error Handling

1. **Missing Prerequisites**:
   - No account registered
   - No restaurant registered
   - Missing theme colors in database
   - Missing credentials

2. **Generation Failures**:
   - Script timeout
   - Login failed
   - Navigation errors
   - File write failures

3. **Configuration Failures**:
   - Generated files not found
   - Restaurant not found in list
   - Website settings navigation failed
   - Theme application failed

4. **User Feedback**:
   - Clear status messages
   - Differentiate between generation and configuration
   - Show which step failed
   - Provide actionable next steps

## Implementation Steps

### Phase 1: Script Migration
1. Update ordering-page-customization.js with user credentials support
2. Update edit-website-settings-dark.js with smart matching
3. Update edit-website-settings-light.js with smart matching
4. Test scripts independently with various restaurants

### Phase 2: Backend Routes
1. Create generate-code-injections route
2. Create configure-website route
3. Add helper functions for file management
4. Implement logo download functionality

### Phase 3: Frontend Integration
1. Add Website Customization section UI
2. Implement state management
3. Add handler functions
4. Connect to backend routes

### Phase 4: Integration Testing
1. Test complete flow from generation to configuration
2. Test with different themes (light/dark)
3. Test with missing optional fields
4. Test with multiple restaurants per account
5. Verify file cleanup

### Phase 5: Polish
1. Add progress indicators
2. Improve error messages
3. Add tooltips for prerequisites
4. Optional: Add preview of generated code

## Dependencies

### NPM Packages
- Already have: express, child_process, fs, path
- May need: https (for logo download)

### Scripts
- ordering-page-customization.js: Needs user credential support
- edit-website-settings-dark.js: Needs smart matching
- edit-website-settings-light.js: Needs smart matching

### Database Tables
- restaurants: Has all needed fields
- pumpd_accounts: Has credentials
- No new tables needed

## Testing Checklist

- [ ] Generate code with dark theme (default)
- [ ] Generate code with light theme
- [ ] Configure website with dark theme script
- [ ] Configure website with light theme script
- [ ] Smart matching finds correct restaurant
- [ ] Handles restaurants with apostrophes
- [ ] Optional fields (logo, social) work when present
- [ ] Optional fields omitted when absent
- [ ] Generated files are found and used
- [ ] Errors display helpful messages
- [ ] Success confirmations show
- [ ] Works with multiple restaurants per account
- [ ] Cannot configure without generating first
- [ ] Cannot proceed without prerequisites

## Future Enhancements

1. **Preview System**: Show preview of how website will look
2. **Color Picker**: Allow color selection in UI
3. **Template Gallery**: Multiple preset templates to choose from
4. **Rollback**: Undo last configuration
5. **History**: Track customization history
6. **A/B Testing**: Test different configurations
7. **Analytics**: Track which customizations perform best
8. **Batch Operations**: Customize multiple restaurants at once

## Migration Timeline

1. **Week 1**: Script migrations and testing
2. **Week 2**: Backend route implementation
3. **Week 3**: Frontend integration
4. **Week 4**: Testing and polish

## Notes

- Scripts will run sequentially (generate then configure)
- Generated files persist between runs for debugging
- Consider adding cleanup job for old generated files
- Theme defaults to dark if not specified
- Scripts have 1-2 minute timeouts for browser automation
- Logo download is handled server-side to avoid CORS issues