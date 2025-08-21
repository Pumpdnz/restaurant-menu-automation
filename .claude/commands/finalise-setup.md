# Finalise Restaurant Setup

This command completes the restaurant setup process by configuring system settings and creating an API key for the restaurant.

## Usage
```
/finalise-setup <email> [receipt-logo-path]
```

## Arguments
- `$USER_EMAIL` - The email address of the restaurant owner (required)
- `$PATH_TO_RECEIPT_LOGO` - Path to the receipt logo image file (optional)

## Example
```
/finalise-setup example123@example.com automation/planning/downloaded-images/examplerestaurant/logo-thermal.png
```

## Process

### Step 1: Retrieve User Onboarding Data
First, get the onboarding record for the user to extract all required configuration data:

```javascript
const userEmail = '$USER_EMAIL';
const receiptLogoPath = '$PATH_TO_RECEIPT_LOGO';

// Get onboarding record with all required fields
const result = await mcp__supabase__execute_sql({
  project_id: "lqcgatpunhuiwcyqesap",
  query: `
    SELECT 
      onboarding_id,
      gst_number,
      google_oauth_client_id,
      restaurant_name,
      restaurant_api_key,
      nzbn,
      company_name,
      director_name,
      director_mobile_number
    FROM public.user_onboarding 
    WHERE email = '${userEmail}'
    LIMIT 1
  `
});

if (!result || result.length === 0) {
  throw new Error(`User onboarding record not found for email: ${userEmail}`);
}

const onboardingData = result[0];
console.log('Found onboarding record:', {
  onboarding_id: onboardingData.onboarding_id,
  restaurant_name: onboardingData.restaurant_name,
  has_gst: !!onboardingData.gst_number,
  has_oauth: !!onboardingData.google_oauth_client_id,
  has_existing_api_key: !!onboardingData.restaurant_api_key,
  has_nzbn: !!onboardingData.nzbn,
  has_company_details: !!onboardingData.company_name && !!onboardingData.director_name
});
```

### Step 2: Execute System Settings Configuration
Run the setup-system-settings.js script with all available parameters:

```bash
# Build command with required and optional arguments
node /Users/giannimunro/Desktop/cursor-projects/automation/scripts/setup-system-settings.js \
  --email="${userEmail}" \
  ${receiptLogoPath ? `--receipt-logo="${receiptLogoPath}"` : ''} \
  ${onboardingData.gst_number ? `--gst="${onboardingData.gst_number}"` : ''} \
  ${onboardingData.google_oauth_client_id ? `--google-oauth="${onboardingData.google_oauth_client_id}"` : ''}
```

Wait for the script to complete and verify success by checking for:
- Receipt and Kitchen printer API keys created
- Webhook secret key generated
- Audio notifications configured
- Receipt logo uploaded (if provided)

### Step 3: Create Restaurant API Key
Execute the create-api-key.js script to generate an API key for the restaurant:

```bash
node /Users/giannimunro/Desktop/cursor-projects/automation/scripts/create-api-key.js \
  --email="${userEmail}"
```

The script will:
- Navigate to the Developers tab
- Create a new API key named "invalid phone number fixer"
- Grant access to all available restaurants
- Extract and save the generated API key

### Step 4: Update Database with API Key
After successful API key creation, read the saved API key and update the user_onboarding table:

```javascript
// Read the generated API key from the saved JSON file
// Sanitize email for filename (same as in create-api-key.js)
const sanitizedEmail = userEmail.replace(/[@\.]/g, '_');
const apiKeyFilePath = `/Users/giannimunro/Desktop/cursor-projects/automation/scripts/${sanitizedEmail}-api-key-data.json`;

const apiKeyData = JSON.parse(
  await fs.readFile(apiKeyFilePath, 'utf-8')
);

// Update the user_onboarding table with the API key
const updateResult = await mcp__supabase__execute_sql({
  project_id: "lqcgatpunhuiwcyqesap",
  query: `
    UPDATE public.user_onboarding 
    SET 
      restaurant_api_key = '${apiKeyData.key}',
      updated_at = CURRENT_TIMESTAMP
    WHERE onboarding_id = '${onboardingData.onboarding_id}'
    RETURNING onboarding_id, restaurant_api_key
  `
});

if (updateResult && updateResult.length > 0) {
  console.log('✅ Successfully updated restaurant API key in database');
  console.log('API Key:', updateResult[0].restaurant_api_key);
  
  // Clean up: Delete the temporary JSON file after successful database update
  try {
    await fs.unlink(apiKeyFilePath);
    console.log('🧹 Cleaned up temporary API key file:', apiKeyFilePath);
  } catch (cleanupError) {
    console.warn('⚠️ Could not delete temporary API key file:', cleanupError.message);
    // Non-critical error - continue execution
  }
} else {
  throw new Error('Failed to update API key in database');
}
```

### Step 5: Finalise Onboarding with Uber Integration
Execute the finalise-onboarding.js script to configure Uber Delivery Management:

```bash
node /Users/giannimunro/Desktop/cursor-projects/automation/scripts/finalise-onboarding.js \
  --email="${userEmail}" \
  --nzbn="${onboardingData.nzbn}" \
  --company-name="${onboardingData.company_name}" \
  --trading-name="${onboardingData.restaurant_name}" \
  --director-name="${onboardingData.director_name}" \
  --director-mobile="${onboardingData.director_mobile_number}"
```

The script will:
- Navigate to Integrations settings
- Configure Uber Delivery Management with company details
- Navigate to Services settings
- Set Uber as the default delivery provider
- Save all configurations

Wait for the script to complete and verify:
- Uber integration is enabled
- All company details are correctly entered
- Default delivery provider is set to Uber

### Step 6: Generate Summary Report
Create a comprehensive summary of the setup process:

```javascript
console.log('\n' + '='.repeat(60));
console.log('🎉 RESTAURANT SETUP COMPLETE');
console.log('='.repeat(60));
console.log(`
📧 Email: ${userEmail}
🏪 Restaurant: ${onboardingData.restaurant_name}
🆔 Onboarding ID: ${onboardingData.onboarding_id}

✅ Configured Settings:
  • System Settings configured
  • Receipt Printer created
  • Kitchen Printer created  
  • Audio Notifications set (Plucky, 5 repeats)
  • Webhook configured
  ${onboardingData.gst_number ? '• GST Number: ' + onboardingData.gst_number : '• GST: Not provided'}
  ${onboardingData.google_oauth_client_id ? '• Google OAuth configured' : '• Google OAuth: Not provided'}
  ${receiptLogoPath ? '• Receipt Logo uploaded' : '• Receipt Logo: Not provided'}

🚚 Uber Integration:
  • Uber Delivery Management enabled
  • Default delivery provider: Uber
  ${onboardingData.nzbn ? '• NZBN: ' + onboardingData.nzbn : '• NZBN: Not provided'}
  ${onboardingData.company_name ? '• Company: ' + onboardingData.company_name : '• Company: Not provided'}
  ${onboardingData.director_name ? '• Director: ' + onboardingData.director_name : '• Director: Not provided'}

🔑 API Key Information:
  • Name: invalid phone number fixer
  • Key: ${apiKeyData.key}
  • Access: ${apiKeyData.restaurants} restaurant(s)
  • Created: ${apiKeyData.createdAt}

📊 Database Status:
  • Onboarding record updated
  • API key stored successfully

Next Steps:
1. Test the printer configurations
2. Verify webhook is receiving events
3. Test the API key functionality
`);
console.log('='.repeat(60));
```

## Error Handling
The command should handle the following error scenarios:
- User onboarding record not found
- Missing required fields in onboarding record (NZBN, company details, etc.)
- System settings script failure
- API key creation failure
- Database update failure
- Uber integration script failure
- Missing required files or permissions

## Notes
- Both scripts run with `headless: false` to show browser automation
- Screenshots are saved for debugging purposes
- API key data is saved to JSON file as backup
- All configurations are logged for verification
- The process is idempotent - can be run multiple times safely