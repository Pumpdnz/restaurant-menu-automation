# Finalise Setup Feature Implementation Plan

## Overview
This document outlines the implementation plan for the "Finalise Setup" feature in the Pumpd Registration tab. This feature will complete the restaurant setup process by configuring system settings, creating API keys, and setting up Uber integration using the user's own credentials rather than admin credentials.

## Key Findings from Existing Implementation

### Existing Patterns to Follow

1. **Script Parameter Pattern (from setup-stripe-payments.js)**
   - Scripts accept `--email`, `--password`, and `--name` parameters
   - User credentials come from `pumpd_accounts` table (`user_password_hint` field)
   - Scripts are executed with proper escaping and timeout handling

2. **Dual Database Architecture (from onboarding-service.js)**
   - Main database: `qgabsyggzlkcstjzugdh.supabase.co`
   - Onboarding database: `lqcgatpunhuiwcyqesap.supabase.co`
   - Separate Supabase clients with service keys
   - RPC functions used for cross-database queries

3. **Frontend Pattern (from RestaurantDetail.jsx)**
   - Card components with action buttons
   - State management for loading/success/error states
   - Toast notifications for user feedback
   - Alert components for status display

4. **Backend Pattern (from registration-routes.js)**
   - Get restaurant details first
   - Fetch account credentials from `pumpd_accounts`
   - Execute script with proper timeout (180000ms)
   - Parse stdout for success indicators
   - Log actions to `registration_logs` table

## Architecture Overview

### Data Flow
1. Frontend initiates setup process with selected options
2. Backend retrieves user credentials from `pumpd_accounts` table
3. Backend fetches onboarding data from onboarding database
4. Modified scripts execute using user credentials (not admin)
5. Results are stored back in databases
6. Frontend receives confirmation

### Key Components
- **Frontend**: New card component with three action buttons
- **Backend**: Three new API endpoints following existing patterns
- **Scripts**: Modified versions that accept user credentials as parameters
- **Database**: Dual database queries using existing service patterns

## Frontend Implementation

### 1. New Card Component Structure (Following Existing Pattern)
```jsx
// Location: UberEats-Image-Extractor/src/pages/RestaurantDetail.jsx
// Position: Below Onboarding User Management card (after line 4200)

<Card className="mt-4">
  <CardHeader>
    <CardTitle className="flex items-center gap-2">
      <Settings className="h-5 w-5" />
      Finalise Setup
    </CardTitle>
    <CardDescription>
      Complete the restaurant setup process after user onboarding
    </CardDescription>
  </CardHeader>
  <CardContent className="space-y-4">
    {/* System Settings Section */}
    <div className="border rounded-lg p-4 space-y-3">
      <h4 className="font-medium">1. Setup System Settings</h4>
      <p className="text-sm text-gray-600">
        Configure printers, audio notifications, webhooks, and receipt settings
      </p>

      {/* Receipt Logo Selection */}
      <div className="space-y-2">
        <Label>Receipt Logo (optional)</Label>
        <RadioGroup value={selectedReceiptLogo} onValueChange={setSelectedReceiptLogo}>
          {availableLogos.map((logo, index) => (
            <RadioGroupItem key={index} value={logo.path}>
              <img src={logo.url} alt={`Logo ${index + 1}`} className="h-12" />
            </RadioGroupItem>
          ))}
        </RadioGroup>
      </div>

      <Button
        onClick={() => handleSystemSettings()}
        disabled={systemSettingsLoading}
      >
        {systemSettingsLoading ? <Loader2 className="animate-spin" /> : <Settings />}
        Setup System Settings
      </Button>
    </div>

    {/* API Key Section */}
    <div className="border rounded-lg p-4 space-y-3">
      <h4 className="font-medium">2. Create API Key</h4>
      <p className="text-sm text-gray-600">
        Generate an API key for the "invalid phone number fixer" service
      </p>
      <Button
        onClick={() => handleCreateApiKey()}
        disabled={apiKeyLoading || !systemSettingsComplete}
      >
        {apiKeyLoading ? <Loader2 className="animate-spin" /> : <Key />}
        Create API Key
      </Button>
      {apiKey && (
        <Alert>
          <AlertDescription>
            API Key created: <code>{apiKey}</code>
          </AlertDescription>
        </Alert>
      )}
    </div>

    {/* Uber Integration Section */}
    <div className="border rounded-lg p-4 space-y-3">
      <h4 className="font-medium">3. Configure Uber Integration</h4>
      <p className="text-sm text-gray-600">
        Setup Uber Delivery Management with company details
      </p>
      <Button
        onClick={() => handleUberIntegration()}
        disabled={uberIntegrationLoading || !apiKey}
      >
        {uberIntegrationLoading ? <Loader2 className="animate-spin" /> : <Truck />}
        Configure Uber Integration
      </Button>
    </div>

    {/* Overall Status */}
    {setupComplete && (
      <Alert className="bg-green-50 border-green-200">
        <CheckCircle className="h-4 w-4 text-green-600" />
        <AlertTitle>Setup Complete!</AlertTitle>
        <AlertDescription>
          All restaurant setup tasks have been completed successfully.
        </AlertDescription>
      </Alert>
    )}
  </CardContent>
</Card>
```

### 2. State Management
```javascript
// Additional state variables needed
const [selectedReceiptLogo, setSelectedReceiptLogo] = useState('');
const [availableLogos, setAvailableLogos] = useState([]);
const [systemSettingsLoading, setSystemSettingsLoading] = useState(false);
const [systemSettingsComplete, setSystemSettingsComplete] = useState(false);
const [apiKeyLoading, setApiKeyLoading] = useState(false);
const [apiKey, setApiKey] = useState('');
const [uberIntegrationLoading, setUberIntegrationLoading] = useState(false);
const [setupComplete, setSetupComplete] = useState(false);

// Load available logos on component mount
useEffect(() => {
  if (restaurant?.restaurant_id) {
    fetchAvailableLogos(restaurant.restaurant_id);
  }
}, [restaurant?.restaurant_id]);
```

### 3. Handler Functions
```javascript
const handleSystemSettings = async () => {
  setSystemSettingsLoading(true);
  try {
    const response = await fetch('/api/registration/setup-system-settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        restaurantId: restaurant.restaurant_id,
        receiptLogoPath: selectedReceiptLogo
      })
    });

    if (!response.ok) throw new Error('Failed to setup system settings');

    const result = await response.json();
    setSystemSettingsComplete(true);
    toast.success('System settings configured successfully');
  } catch (error) {
    toast.error(`Failed to setup system settings: ${error.message}`);
  } finally {
    setSystemSettingsLoading(false);
  }
};

const handleCreateApiKey = async () => {
  setApiKeyLoading(true);
  try {
    const response = await fetch('/api/registration/create-api-key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        restaurantId: restaurant.restaurant_id
      })
    });

    if (!response.ok) throw new Error('Failed to create API key');

    const result = await response.json();
    setApiKey(result.apiKey);
    toast.success('API key created successfully');
  } catch (error) {
    toast.error(`Failed to create API key: ${error.message}`);
  } finally {
    setApiKeyLoading(false);
  }
};

const handleUberIntegration = async () => {
  setUberIntegrationLoading(true);
  try {
    const response = await fetch('/api/registration/configure-uber-integration', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        restaurantId: restaurant.restaurant_id
      })
    });

    if (!response.ok) throw new Error('Failed to configure Uber integration');

    setSetupComplete(true);
    toast.success('Uber integration configured successfully');
  } catch (error) {
    toast.error(`Failed to configure Uber integration: ${error.message}`);
  } finally {
    setUberIntegrationLoading(false);
  }
};

const fetchAvailableLogos = async (restaurantId) => {
  try {
    const response = await fetch(`/api/registration/available-logos/${restaurantId}`);
    if (response.ok) {
      const logos = await response.json();
      setAvailableLogos(logos);
    }
  } catch (error) {
    console.error('Failed to fetch available logos:', error);
  }
};
```

## Backend Implementation

### 1. New API Endpoints

#### Endpoint 1: Setup System Settings (Following Existing Pattern)
```javascript
// Location: UberEats-Image-Extractor/src/routes/registration-routes.js

router.post('/setup-system-settings', async (req, res) => {
  const { restaurantId, receiptLogoPath } = req.body;
  const organisationId = req.user?.organisationId;

  if (!organisationId) {
    return res.status(401).json({
      success: false,
      error: 'Organisation context required'
    });
  }

  try {
    const { supabase } = require('../services/database-service');
    const onboardingService = require('../services/onboarding-service');

    // Step 1: Get restaurant details (following pattern from configure-payment)
    const { data: restaurant, error: restaurantError } = await supabase
      .from('restaurants')
      .select('name, contact_email')
      .eq('id', restaurantId)
      .eq('organisation_id', organisationId)
      .single();

    if (restaurantError || !restaurant) {
      throw new Error('Restaurant not found');
    }

    // Step 2: Get user credentials from pumpd_accounts (using user_password_hint like existing endpoints)
    const { data: account, error: accountError } = await supabase
      .from('pumpd_accounts')
      .select('email, user_password_hint')
      .eq('email', restaurant.contact_email)
      .single();

    if (!account || !account.user_password_hint) {
      throw new Error('Restaurant account credentials are incomplete. Please re-register the account.');
    }

    // Step 3: Get onboarding data from onboarding database
    const onboardingData = await onboardingService.getOnboardingDataByEmail(
      restaurant.contact_email
    );

    // Step 4: Convert receipt logo to PNG if provided
    let processedLogoPath = null;
    if (receiptLogoPath) {
      processedLogoPath = await imageService.convertToPng(receiptLogoPath);
    }

    // Step 5: Execute modified setup-system-settings script
    const scriptPath = path.join(
      process.cwd(),
      'scripts',
      'setup-system-settings-user.js' // Modified version
    );

    const args = [
      `--email="${restaurant.contact_email}"`,
      `--password="${account.password}"`, // Use user's password
      processedLogoPath ? `--receipt-logo="${processedLogoPath}"` : '',
      onboardingData.gst_number ? `--gst="${onboardingData.gst_number}"` : '',
      onboardingData.google_oauth_client_id ?
        `--google-oauth="${onboardingData.google_oauth_client_id}"` : ''
    ].filter(Boolean);

    const command = ['node', scriptPath, ...args].join(' ');

    const result = await new Promise((resolve, reject) => {
      exec(command, (error, stdout, stderr) => {
        if (error) {
          console.error('Script error:', stderr);
          reject(new Error(stderr || error.message));
        } else {
          resolve({ stdout, stderr });
        }
      });
    });

    // Step 6: Parse results and return
    res.json({
      success: true,
      message: 'System settings configured successfully',
      details: result.stdout
    });

  } catch (error) {
    console.error('Setup system settings error:', error);
    res.status(500).json({ error: error.message });
  }
});
```

#### Endpoint 2: Create API Key
```javascript
router.post('/create-api-key', async (req, res) => {
  const { restaurantId } = req.body;

  try {
    // Step 1: Get restaurant email
    const { data: restaurant, error: restaurantError } = await supabase
      .from('restaurants')
      .select('contact_email')
      .eq('restaurant_id', restaurantId)
      .single();

    if (restaurantError) throw restaurantError;

    // Step 2: Get user password
    const { data: account, error: accountError } = await supabase
      .from('pumpd_accounts')
      .select('password')
      .eq('email', restaurant.contact_email)
      .single();

    if (accountError) throw accountError;

    // Step 3: Execute modified create-api-key script
    const scriptPath = path.join(
      process.cwd(),
      'scripts',
      'create-api-key-user.js' // Modified version
    );

    const command = [
      'node',
      scriptPath,
      `--email="${restaurant.contact_email}"`,
      `--password="${account.password}"` // Use user's password
    ].join(' ');

    const result = await new Promise((resolve, reject) => {
      exec(command, (error, stdout, stderr) => {
        if (error) {
          reject(new Error(stderr || error.message));
        } else {
          resolve({ stdout, stderr });
        }
      });
    });

    // Step 4: Extract API key from output
    const apiKeyMatch = stdout.match(/API Key: ([A-Z0-9-]+)/);
    const apiKey = apiKeyMatch ? apiKeyMatch[1] : null;

    if (!apiKey) {
      throw new Error('Failed to extract API key from script output');
    }

    // Step 5: Update onboarding database with API key
    await onboardingService.updateOnboardingRecord(restaurant.contact_email, {
      restaurant_api_key: apiKey
    });

    res.json({
      success: true,
      apiKey: apiKey,
      message: 'API key created successfully'
    });

  } catch (error) {
    console.error('Create API key error:', error);
    res.status(500).json({ error: error.message });
  }
});
```

#### Endpoint 3: Configure Uber Integration
```javascript
router.post('/configure-uber-integration', async (req, res) => {
  const { restaurantId } = req.body;

  try {
    // Step 1: Get restaurant email
    const { data: restaurant, error: restaurantError } = await supabase
      .from('restaurants')
      .select('contact_email, restaurant_name')
      .eq('restaurant_id', restaurantId)
      .single();

    if (restaurantError) throw restaurantError;

    // Step 2: Get user password
    const { data: account, error: accountError } = await supabase
      .from('pumpd_accounts')
      .select('password')
      .eq('email', restaurant.contact_email)
      .single();

    if (accountError) throw accountError;

    // Step 3: Get onboarding data for company details
    const onboardingData = await onboardingService.getOnboardingDataByEmail(
      restaurant.contact_email
    );

    if (!onboardingData.nzbn || !onboardingData.company_name ||
        !onboardingData.director_name || !onboardingData.director_mobile_number) {
      throw new Error('Missing required company details for Uber integration');
    }

    // Step 4: Execute finalise-onboarding script
    const scriptPath = path.join(
      process.cwd(),
      'scripts',
      'finalise-onboarding-user.js' // Modified version
    );

    const command = [
      'node',
      scriptPath,
      `--email="${restaurant.contact_email}"`,
      `--password="${account.password}"`, // Use user's password
      `--nzbn="${onboardingData.nzbn}"`,
      `--company-name="${onboardingData.company_name}"`,
      `--trading-name="${restaurant.restaurant_name}"`,
      `--director-name="${onboardingData.director_name}"`,
      `--director-mobile="${onboardingData.director_mobile_number}"`
    ].join(' ');

    const result = await new Promise((resolve, reject) => {
      exec(command, (error, stdout, stderr) => {
        if (error) {
          reject(new Error(stderr || error.message));
        } else {
          resolve({ stdout, stderr });
        }
      });
    });

    res.json({
      success: true,
      message: 'Uber integration configured successfully',
      details: result.stdout
    });

  } catch (error) {
    console.error('Configure Uber integration error:', error);
    res.status(500).json({ error: error.message });
  }
});
```

#### Endpoint 4: Get Available Logos
```javascript
router.get('/available-logos/:restaurantId', async (req, res) => {
  const { restaurantId } = req.params;

  try {
    // Get list of downloaded logos for this restaurant
    const logosDir = path.join(
      process.cwd(),
      'planning',
      'downloaded-images',
      restaurantId.toLowerCase().replace(/\s+/g, '-')
    );

    if (!fs.existsSync(logosDir)) {
      return res.json([]);
    }

    const files = await fs.promises.readdir(logosDir);
    const logoFiles = files.filter(file =>
      file.includes('logo') &&
      ['.png', '.jpg', '.jpeg'].some(ext => file.endsWith(ext))
    );

    const logos = logoFiles.map(file => ({
      path: path.join(logosDir, file),
      url: `/api/registration/logo-preview/${restaurantId}/${file}`,
      filename: file
    }));

    res.json(logos);

  } catch (error) {
    console.error('Get available logos error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/logo-preview/:restaurantId/:filename', async (req, res) => {
  const { restaurantId, filename } = req.params;

  try {
    const filePath = path.join(
      process.cwd(),
      'planning',
      'downloaded-images',
      restaurantId.toLowerCase().replace(/\s+/g, '-'),
      filename
    );

    if (fs.existsSync(filePath)) {
      res.sendFile(filePath);
    } else {
      res.status(404).json({ error: 'Logo not found' });
    }

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### 2. Service Updates

#### Update Onboarding Service
```javascript
// Location: src/services/onboarding-service.js

// Add new method to get full onboarding data
async getOnboardingDataByEmail(email) {
  try {
    const { data, error } = await this.onboardingSupabase
      .from('user_onboarding')
      .select(`
        onboarding_id,
        email,
        gst_number,
        google_oauth_client_id,
        restaurant_name,
        restaurant_api_key,
        nzbn,
        company_name,
        director_name,
        director_mobile_number
      `)
      .eq('email', email)
      .single();

    if (error) {
      console.error('Error fetching onboarding data:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in getOnboardingDataByEmail:', error);
    return null;
  }
}
```

#### Create Image Service
```javascript
// Location: src/services/image-service.js

const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;

class ImageService {
  async convertToPng(inputPath) {
    try {
      // Generate output path
      const outputPath = inputPath.replace(/\.[^.]+$/, '-converted.png');

      // Convert to PNG using sharp
      await sharp(inputPath)
        .png({ quality: 90 })
        .toFile(outputPath);

      return outputPath;

    } catch (error) {
      console.error('Error converting image to PNG:', error);
      throw error;
    }
  }

  async resizeForReceipt(inputPath, width = 300) {
    try {
      const outputPath = inputPath.replace(/\.[^.]+$/, '-receipt.png');

      await sharp(inputPath)
        .resize(width, null, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .png({ quality: 90 })
        .toFile(outputPath);

      return outputPath;

    } catch (error) {
      console.error('Error resizing image:', error);
      throw error;
    }
  }
}

module.exports = new ImageService();
```

## Script Modifications

### 1. Modified Scripts Pattern (Based on Existing Scripts)

The modified scripts will follow the exact patterns from existing scripts including **smart restaurant matching**:

#### Critical Requirements for All Scripts

1. **Parameter Pattern** (from `setup-stripe-payments.js`):
```javascript
const email = getArg('email');
const password = getArg('password');  // User password, not admin
const restaurantName = getArg('name'); // For matching

// Scripts will use these credentials for login:
await page.fill('input[type="email"]', email);
await page.fill('input[type="password"]', password);
```

2. **Smart Restaurant Matching** (from `edit-website-settings-dark.js` lines 220-353):
```javascript
// Helper functions for smart matching
const normalizeForMatching = (str) => {
  return str
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

const calculateMatchScore = (searchTerm, restaurantNameInList) => {
  const searchNorm = normalizeForMatching(searchTerm);
  const nameNorm = normalizeForMatching(restaurantNameInList);

  // Exact match (after normalization) - highest priority
  if (searchNorm === nameNorm) {
    return { score: 1000, reason: 'exact match' };
  }

  // Word-based matching logic
  const searchWords = searchNorm.split(' ').filter(w => w.length > 1);
  const nameWords = nameNorm.split(' ');

  let score = 0;
  let matchedWords = 0;

  // Count matching words
  for (const searchWord of searchWords) {
    if (nameWords.includes(searchWord)) {
      score += 10;
      matchedWords++;
    } else if (nameWords.some(nameWord => {
      // Fuzzy matching for similar words
      const lengthDiff = Math.abs(nameWord.length - searchWord.length);
      if (lengthDiff <= 2) {
        const commonChars = searchWord.split('').filter(char => nameWord.includes(char)).length;
        return commonChars >= Math.min(searchWord.length, nameWord.length) - 1;
      }
      return false;
    })) {
      score += 8;
      matchedWords++;
    }
  }

  // Bonus for matching all words
  if (matchedWords === searchWords.length && searchWords.length > 0) {
    score += 50;
  }

  return { score, reason: `${matchedWords}/${searchWords.length} words matched` };
};

// Find best matching restaurant
const allRestaurantNames = await page.locator('h4').allTextContents();
let restaurantIndex = -1;
let bestScore = 0;

for (let i = 0; i < allRestaurantNames.length; i++) {
  const { score, reason } = calculateMatchScore(restaurantName, allRestaurantNames[i]);
  if (score > bestScore) {
    bestScore = score;
    restaurantIndex = i;
  }
}

// Click the correct Manage button using multiple fallback strategies
if (restaurantIndex >= 0) {
  const manageButton = page.locator(`#restaurant-list-item-${restaurantIndex} button:has-text("Manage")`).first();

  if (await manageButton.count() === 0) {
    // Try alternative selectors
    const alternativeButton = page.locator(`button[id="restaurant-list-item-view-store-${restaurantIndex}"]`).first();
    if (await alternativeButton.count() > 0) {
      await alternativeButton.click();
    } else {
      // Final fallback: index-based selection
      const allManageButtons = page.locator('button:has-text("Manage")');
      await allManageButtons.nth(restaurantIndex).click();
    }
  } else {
    await manageButton.click();
  }
}
```

#### setup-system-settings-user.js
- Copy from `setup-system-settings.js`
- Remove admin password defaults
- Add `--password` parameter for user password
- **MUST include smart restaurant matching logic**
- Keep all other functionality the same

#### create-api-key-user.js
- Copy from `create-api-key.js`
- Remove admin password defaults
- Add `--password` parameter for user password
- **MUST include smart restaurant matching logic**
- Keep all other functionality the same

#### finalise-onboarding-user.js
- New script for Uber integration
- Follow pattern from existing scripts
- Accept user credentials as parameters
- **MUST include smart restaurant matching logic**

### 2. Modified create-api-key-user.js
```javascript
// Location: scripts/create-api-key-user.js
// Copy from create-api-key.js and modify:

// Remove admin password defaults
// const password = process.env.ADMIN_PASSWORD || '7uo@%K2^Hz%yiXDeP39Ckp6BvF!2';

// Add password parameter
const password = getArg('password');

// Validate password is provided
if (!password) {
  console.error('❌ Error: Password is required');
  console.error('Usage: node create-api-key-user.js --email="email" --password="password"');
  process.exit(1);
}

// Modify the output to return structured JSON for easier parsing
// At the end of the script, add:
console.log(JSON.stringify({
  success: true,
  apiKey: apiKey,
  name: 'invalid phone number fixer',
  restaurants: optionsSelected
}));
```

### 3. Create finalise-onboarding-user.js
```javascript
// Location: scripts/finalise-onboarding-user.js
// New script based on finalise-setup.md workflow

#!/usr/bin/env node

import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const require = createRequire(import.meta.url);
const { chromium } = require('./restaurant-registration/node_modules/playwright');

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get parameters
const args = process.argv.slice(2);
const getArg = (name) => {
  const arg = args.find(a => a.startsWith(`--${name}=`));
  return arg ? arg.split('=')[1] : null;
};

const email = getArg('email');
const password = getArg('password');
const nzbn = getArg('nzbn');
const companyName = getArg('company-name');
const tradingName = getArg('trading-name');
const directorName = getArg('director-name');
const directorMobile = getArg('director-mobile');

// Validate required parameters
if (!email || !password || !nzbn || !companyName || !tradingName ||
    !directorName || !directorMobile) {
  console.error('❌ Error: Missing required parameters');
  process.exit(1);
}

async function configureUberIntegration() {
  const browser = await chromium.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    slowMo: 100
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    ignoreHTTPSErrors: true
  });

  const page = await context.newPage();

  try {
    // Login
    await page.goto('https://admin.pumpd.co.nz/login');
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/admin.pumpd.co.nz/**');

    // Navigate to restaurant management
    await page.locator('#restaurant-list-item-0 button:has-text("Manage")').first().click();
    await page.waitForURL('**/restaurant/**');

    // Navigate to Settings > Integrations
    await page.locator('#nav-link-settings').click();
    await page.waitForTimeout(2000);

    // Click Integrations tab
    await page.locator('text="Integrations"').click();
    await page.waitForTimeout(2000);

    // Configure Uber Delivery Management
    // ... (Add specific selectors for Uber integration form)

    console.log(JSON.stringify({
      success: true,
      message: 'Uber integration configured successfully'
    }));

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

configureUberIntegration();
```

## Database Schema Requirements

### Main Database (Menu-Builder)
- **pumpd_accounts**: Store user passwords (already exists)
- **restaurants**: Store contact_email, restaurant_name (already exists)

### Onboarding Database (lqcgatpunhuiwcyqesap)
- **user_onboarding**: Store all onboarding data including:
  - gst_number
  - google_oauth_client_id
  - restaurant_api_key
  - nzbn
  - company_name
  - director_name
  - director_mobile_number

## Error Handling

### Frontend Error States
- Display specific error messages for each step
- Allow retry for failed operations
- Show prerequisites for each step (e.g., system settings must complete before API key)

### Backend Error Handling
- Validate all required data before script execution
- Log detailed error messages for debugging
- Return structured error responses with actionable messages
- Implement timeout handling for long-running scripts

### Script Error Handling
- Add try-catch blocks around critical operations
- Return structured JSON responses for easier parsing
- Save screenshots on failure for debugging
- Implement retry logic for transient failures

## Security Considerations

1. **Password Management**
   - Never log passwords in plain text
   - Use secure transmission for password parameters
   - Validate password strength before use

2. **API Key Storage**
   - Store API keys securely in database
   - Never expose keys in logs or error messages
   - Implement key rotation if needed

3. **Script Execution**
   - Sanitize all inputs to prevent command injection
   - Run scripts with minimal necessary permissions
   - Implement rate limiting on endpoints

## Testing Plan

### Unit Tests
1. Test image conversion service
2. Test database query functions
3. Test parameter validation

### Integration Tests
1. Test complete system settings flow
2. Test API key creation and storage
3. Test Uber integration configuration

### End-to-End Tests
1. Test full setup flow from UI
2. Test error recovery scenarios
3. Test with different logo formats

## Critical Implementation Notes

### Key Differences from Original Plan

1. **Password Storage**
   - Passwords are stored in `pumpd_accounts.user_password_hint` (not `password`)
   - This field contains the actual password in plain text (as per existing system)

2. **Smart Restaurant Matching (CRITICAL)**
   - All scripts MUST implement the smart matching algorithm
   - This handles variations in restaurant names (apostrophes, spacing, etc.)
   - Already proven in `edit-website-settings-dark.js` and `setup-services-settings.js`
   - Example: "Tony's Pizza" will match "Tonys Pizza" or "tony pizza"
   - Multiple fallback strategies for finding the correct Manage button

3. **Script Execution Pattern**
   ```javascript
   const command = [
     'node',
     scriptPath,
     `--email="${account.email}"`,
     `--password="${account.user_password_hint}"`,
     `--name="${restaurant.name.replace(/"/g, '\\"')}"`
   ].join(' ');

   const { stdout, stderr } = await execAsync(command, {
     env: { ...process.env, DEBUG_MODE: 'false' },
     timeout: 180000 // 3 minute timeout
   });
   ```

4. **Success Detection**
   - Parse stdout for success indicators: `✅`, `Successfully`, `success`
   - Check specific patterns for each script type

5. **Receipt Logo Handling**
   - No need for complex logo selection UI
   - Can use existing logos from `planning/downloaded-images/[restaurant-name]/`
   - Simple radio selection like existing logo selection dialogs

6. **Database Context**
   - Always check `organisationId` from `req.user`
   - Filter all queries by `organisation_id`
   - Log all actions to `registration_logs` table

## Implementation Timeline

### Phase 1: Script Modifications (Day 1)
- Create setup-system-settings-user.js (copy and modify)
- Create create-api-key-user.js (copy and modify)
- Create finalise-onboarding-user.js (new script)

### Phase 2: Backend Endpoints (Day 1-2)
- Implement `/setup-system-settings` endpoint
- Implement `/create-api-key` endpoint
- Implement `/configure-uber-integration` endpoint
- Update onboarding-service.js with new methods

### Phase 3: Frontend Implementation (Day 2)
- Add Finalise Setup card component
- Implement state management
- Add handler functions
- Connect to backend endpoints

### Phase 4: Testing & Refinement (Day 3)
- Test complete workflow
- Handle edge cases
- Verify dual database integration

## Dependencies

### NPM Packages Required
- sharp: For image conversion
- Already have: playwright, supabase, express

### File Structure
```
/src
  /routes
    registration-routes.js (update)
  /services
    onboarding-service.js (update)
    image-service.js (new)
  /pages
    RestaurantDetail.jsx (update)

/scripts
  setup-system-settings-user.js (new)
  create-api-key-user.js (new)
  finalise-onboarding-user.js (new)
```

## Rollback Plan

If implementation fails:
1. Keep original scripts intact
2. Add feature flag to enable/disable new functionality
3. Maintain backward compatibility with existing workflows

## Success Metrics

1. All three setup operations complete successfully
2. User credentials work correctly for authentication
3. Data correctly flows between both databases
4. Receipt logos convert and upload properly
5. Error messages are clear and actionable

## Future Enhancements

1. Add progress tracking for long-running operations
2. Implement batch setup for multiple restaurants
3. Add verification step to confirm all settings applied
4. Create audit log for all setup operations
5. Add ability to revert/undo setup steps