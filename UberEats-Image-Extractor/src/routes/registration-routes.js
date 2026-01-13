const express = require('express');
const router = express.Router();
const { exec, spawn } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const multer = require('multer');
const fs = require('fs').promises;
const path = require('path');
const { UsageTrackingService } = require('../services/usage-tracking-service');
const { OrganizationSettingsService } = require('../services/organization-settings-service');
const {
  requireRegistrationUserAccount,
  requireRegistrationRestaurant,
  requireRegistrationMenuUpload,
  requireRegistrationItemTags,
  requireRegistrationOptionSets,
  requireRegistrationCodeInjection,
  requireRegistrationWebsiteSettings,
  requireRegistrationStripePayments,
  requireRegistrationServicesConfig,
  requireRegistrationOnboardingUser,
  requireRegistrationFinalizeSetup,
  requireRegistrationOnboardingSync,
} = require('../../middleware/feature-flags');

// Configure multer for CSV file uploads
const upload = multer({ 
  dest: '/tmp/csv-uploads/',
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB max file size
  },
  fileFilter: (req, file, cb) => {
    // Only accept CSV files
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'), false);
    }
  }
});

/**
 * Pumpd Registration API Routes
 * 
 * These routes handle the automated registration of restaurants on the Pumpd platform
 * using Playwright scripts for browser automation.
 */

// Check registration status for a restaurant
router.get('/status/:restaurantId', async (req, res) => {
  const { restaurantId } = req.params;
  const organisationId = req.user?.organisationId;
  
  if (!organisationId) {
    return res.status(401).json({ 
      success: false, 
      error: 'Organisation context required' 
    });
  }
  
  try {
    const { supabase } = require('../services/database-service');

    // Get restaurant registration status with associated account
    const { data: pumpdRestaurant, error: restaurantError } = await supabase
      .from('pumpd_restaurants')
      .select('*, pumpd_accounts(*)')
      .eq('organisation_id', organisationId)
      .eq('restaurant_id', restaurantId)
      .single();

    // Extract the account from the restaurant relationship
    const account = pumpdRestaurant?.pumpd_accounts || null;

    // If no restaurant found, try to get account directly (for backward compatibility)
    let fallbackAccount = null;
    if (!pumpdRestaurant && !account) {
      const { data: directAccount } = await supabase
        .from('pumpd_accounts')
        .select('*')
        .eq('organisation_id', organisationId)
        .eq('restaurant_id', restaurantId)
        .single();
      fallbackAccount = directAccount;
    }

    res.json({
      success: true,
      account: account || fallbackAccount || null,
      pumpdRestaurant: pumpdRestaurant || null,
      hasAccount: !!(account || fallbackAccount) && (account?.registration_status === 'completed' || fallbackAccount?.registration_status === 'completed'),
      hasRestaurant: !!pumpdRestaurant && pumpdRestaurant.registration_status === 'completed'
    });
  } catch (error) {
    console.error('[Registration Status] Error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Register new account only (using Pumpd API when available)
router.post('/register-account', requireRegistrationUserAccount, async (req, res) => {
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
    const { data: restaurant, error: restaurantError } = await supabase
      .from('restaurants')
      .select('*')
      .eq('id', restaurantId)
      .eq('organisation_id', organisationId)
      .single();
    
    if (!restaurant) {
      return res.status(404).json({ 
        success: false, 
        error: 'Restaurant not found' 
      });
    }
    
    // Get email and password from request body, or fall back to database
    const email = req.body.email || restaurant.user_email || restaurant.email;
    const password = req.body.password || restaurant.user_password_hint;
    const phone = req.body.phone || restaurant.phone || '';
    
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }
    
    // Check if account already exists
    const { data: existingAccount } = await supabase
      .from('pumpd_accounts')
      .select('*')
      .eq('organisation_id', organisationId)
      .eq('restaurant_id', restaurantId)
      .single();
    
    if (existingAccount && existingAccount.registration_status === 'completed') {
      return res.json({
        success: false,
        error: 'Account already registered',
        account: existingAccount
      });
    }
    
    // Create or update pumpd_account record
    const accountData = {
      organisation_id: organisationId,
      restaurant_id: restaurantId,
      email: email,
      user_password_hint: password,
      registration_status: 'in_progress',
      registration_method: 'api' // Changed from 'new_account' to 'api'
    };
    
    const { data: account, error: accountInsertError } = await supabase
      .from('pumpd_accounts')
      .upsert(accountData, { 
        onConflict: 'organisation_id,restaurant_id,email' 
      })
      .select()
      .single();
    
    if (accountInsertError) throw accountInsertError;
    
    // Log the registration attempt
    await supabase
      .from('registration_logs')
      .insert({
        organisation_id: organisationId,
        restaurant_id: restaurantId,
        pumpd_account_id: account.id,
        action: 'account_creation',
        status: 'started',
        request_data: { 
          email: email,
          restaurant_name: restaurant.name 
        },
        script_name: 'pumpd-api',
        initiated_by: req.user?.email || 'system'
      });
    
    // Call CloudWaitress API to register user with organization-specific credentials
    const CloudWaitressAPIService = require('../services/cloudwaitress-api-service');
    const cwConfig = await OrganizationSettingsService.getCloudWaitressConfig(organisationId);
    const cloudWaitressAPI = new CloudWaitressAPIService(cwConfig);

    try {
      console.log('[Registration] Starting CloudWaitress API call for org:', organisationId);
      console.log('[Registration] Email:', email);
      console.log('[Registration] Phone:', phone);
      console.log('[Registration] Password format check - starts with capital:', password[0] === password[0].toUpperCase());
      console.log('[Registration] Password format check - ends with 789!:', password.endsWith('789!'));
      
      const apiResponse = await cloudWaitressAPI.registerUser(email, phone, password);
      
      console.log('[Registration] API Response received:', {
        success: apiResponse.success,
        hasData: !!apiResponse.data,
        alreadyExists: apiResponse.alreadyExists,
        error: apiResponse.error
      });
      
      if (apiResponse.success) {
        console.log('[Registration] Account registration successful, updating database');
        console.log('[Registration] User data from API:', apiResponse.data);
        
        // Update account with successful registration
        const updateResult = await supabase
          .from('pumpd_accounts')
          .update({
            registration_status: 'completed',
            pumpd_user_id: apiResponse.data?.user_id || email,
            pumpd_dashboard_url: 'https://admin.pumpd.co.nz',
            registration_date: new Date().toISOString(),
            retry_count: 0
          })
          .eq('id', account.id);
        
        console.log('[Registration] Database update result:', updateResult);
        
        // Log successful registration
        await supabase
          .from('registration_logs')
          .insert({
            organisation_id: organisationId,
            restaurant_id: restaurantId,
            pumpd_account_id: account.id,
            action: 'account_creation',
            status: 'success',
            response_data: apiResponse.data,
            script_name: 'cloudwaitress-api',
            initiated_by: req.user?.email || 'system'
          });
        
        // Track usage
        UsageTrackingService.trackRegistrationStep(organisationId, 'user_account', {
          restaurant_id: restaurantId,
          email: email
        }).catch(err => console.error('[UsageTracking] Failed to track user account registration:', err));

        res.json({
          success: true,
          message: 'Account registered successfully',
          account_id: account.id,
          email: email
        });
      } else if (apiResponse.alreadyExists) {
        console.log('[Registration] User already exists, marking as completed');
        
        // User already exists - mark as completed
        const existsUpdateResult = await supabase
          .from('pumpd_accounts')
          .update({
            registration_status: 'completed',
            pumpd_dashboard_url: 'https://admin.pumpd.co.nz',
            registration_date: new Date().toISOString()
          })
          .eq('id', account.id);
        
        console.log('[Registration] Existing account update result:', existsUpdateResult);
        
        res.json({
          success: true,
          message: 'Account already exists - ready for restaurant registration',
          account_id: account.id,
          alreadyExists: true
        });
      } else {
        console.error('[Registration] API call failed:', apiResponse.error);
        throw new Error(apiResponse.error || 'Registration failed');
      }
    } catch (apiError) {
      console.error('[Registration] CloudWaitress API error:', apiError);
      
      // Update account with error
      await supabase
        .from('pumpd_accounts')
        .update({
          registration_status: 'failed',
          last_error: apiError.message,
          retry_count: (account.retry_count || 0) + 1
        })
        .eq('id', account.id);
      
      // Log failed registration
      await supabase
        .from('registration_logs')
        .insert({
          organisation_id: organisationId,
          restaurant_id: restaurantId,
          pumpd_account_id: account.id,
          action: 'account_creation',
          status: 'failed',
          error_message: apiError.message,
          script_name: 'cloudwaitress-api',
          initiated_by: req.user?.email || 'system'
        });
      
      res.status(500).json({
        success: false,
        error: apiError.message
      });
    }
    
  } catch (error) {
    console.error('[Registration] Error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Register restaurant (with options for different registration flows)
router.post('/register-restaurant', requireRegistrationRestaurant, async (req, res) => {
  const { 
    restaurantId, 
    registrationType,
    email: requestEmail,
    password: requestPassword,
    restaurantName,
    address,
    phone,
    hours,
    city,
    cuisine
  } = req.body;
  // registrationType: 'new_account_with_restaurant', 'existing_account_first_restaurant', 'existing_account_additional_restaurant'
  const organisationId = req.user?.organisationId;
  
  if (!organisationId) {
    return res.status(401).json({ 
      success: false, 
      error: 'Organisation context required' 
    });
  }
  
  try {
    const { supabase } = require('../services/database-service');
    
    // Get restaurant details with opening hours
    const { data: restaurant, error: restaurantError } = await supabase
      .from('restaurants')
      .select('*')
      .eq('id', restaurantId)
      .eq('organisation_id', organisationId)
      .single();
    
    if (!restaurant) {
      return res.status(404).json({ 
        success: false, 
        error: 'Restaurant not found' 
      });
    }
    
    // Use email and password from request body
    const email = requestEmail || restaurant.user_email || restaurant.email;
    let password = requestPassword; // Will be updated if existing account found
    
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required for registration'
      });
    }
    
    // Get or create account record
    let account;
    if (registrationType !== 'new_account_with_restaurant') {
      // For existing account types, create an account record in our database
      // (they're logging into an existing Pumpd account, but we need to track it)
      const { data: existingAccount } = await supabase
        .from('pumpd_accounts')
        .select('*')
        .eq('organisation_id', organisationId)
        .eq('email', email)
        .maybeSingle();
      
      if (!existingAccount) {
        // Create account record for existing Pumpd account
        const { data: newAccount, error: accountError } = await supabase
          .from('pumpd_accounts')
          .insert({
            organisation_id: organisationId,
            restaurant_id: restaurantId,
            email: email,
            user_password_hint: password,
            registration_status: 'existing',
            registration_method: 'playwright',
            registration_date: new Date().toISOString(),
            restaurant_count: registrationType === 'existing_account_first_restaurant' ? 0 : 1,
            is_primary_account: true
          })
          .select()
          .single();
        
        if (accountError) {
          console.error('Failed to create account record:', accountError);
          return res.status(500).json({
            success: false,
            error: 'Failed to create account record'
          });
        }
        account = newAccount;
      } else {
        account = existingAccount;
        // Use the existing account's password instead of dialog/default
        if (existingAccount.user_password_hint) {
          password = existingAccount.user_password_hint;
          console.log('[Registration] Using existing account password for:', email);
        }
      }
    } else {
      // For new_account_with_restaurant, we need to first create account via CloudWaitress API

      // Step 1: Register user via CloudWaitress API with organization-specific credentials
      const CloudWaitressAPIService = require('../services/cloudwaitress-api-service');
      const cwConfig = await OrganizationSettingsService.getCloudWaitressConfig(organisationId);
      const cloudWaitressAPI = new CloudWaitressAPIService(cwConfig);

      try {
        // Use restaurant phone for registration
        const phone = restaurant.phone || '';

        console.log('[Registration] Creating new account via CloudWaitress API for:', email);
        console.log('[Registration] Using credentials for org:', organisationId);
        const apiResponse = await cloudWaitressAPI.registerUser(email, phone, password);
        
        if (apiResponse.success || apiResponse.alreadyExists) {
          // Create account record with API response
          const { data: newAccount, error: accountError } = await supabase
            .from('pumpd_accounts')
            .upsert({
              organisation_id: organisationId,
              restaurant_id: restaurantId,
              email: email,
              user_password_hint: password,
              registration_status: 'completed',
              registration_method: 'api',
              pumpd_user_id: apiResponse.data?.user_id || email,
              pumpd_dashboard_url: 'https://admin.pumpd.co.nz',
              registration_date: new Date().toISOString(),
              restaurant_count: 0, // Will be incremented after restaurant registration
              is_primary_account: true
            }, { 
              onConflict: 'organisation_id,restaurant_id,email' 
            })
            .select()
            .single();
          
          if (accountError) throw accountError;
          account = newAccount;
          
          // Log successful account creation
          await supabase
            .from('registration_logs')
            .insert({
              organisation_id: organisationId,
              restaurant_id: restaurantId,
              pumpd_account_id: newAccount.id,
              action: 'account_creation',
              status: 'success',
              response_data: apiResponse.data || { alreadyExists: true },
              script_name: 'cloudwaitress-api',
              initiated_by: req.user?.email || 'system'
            });
          
        } else {
          // API registration failed
          throw new Error(apiResponse.error || 'Account registration failed');
        }
      } catch (apiError) {
        console.error('[Registration] CloudWaitress API error:', apiError);
        
        // Log failed account creation
        await supabase
          .from('registration_logs')
          .insert({
            organisation_id: organisationId,
            restaurant_id: restaurantId,
            action: 'account_creation',
            status: 'failed',
            error_message: apiError.message,
            script_name: 'cloudwaitress-api',
            initiated_by: req.user?.email || 'system'
          });
        
        return res.status(500).json({
          success: false,
          error: `Failed to create user account: ${apiError.message}`
        });
      }
    }
    
    // Create or update pumpd_restaurant record
    const { data: pumpdRestaurant, error: restaurantInsertError } = await supabase
      .from('pumpd_restaurants')
      .upsert({
        organisation_id: organisationId,
        restaurant_id: restaurantId,
        pumpd_account_id: account.id,
        registration_status: 'in_progress',
        registration_type: registrationType === 'new_account_with_restaurant' ? 
          'account_and_restaurant' : 'restaurant_only',
        configured_name: restaurant.name,
        configured_address: restaurant.address,
        configured_phone: restaurant.phone,
        configured_hours: restaurant.opening_hours
      }, { 
        onConflict: 'organisation_id,restaurant_id' 
      })
      .select()
      .single();
    
    if (restaurantInsertError) throw restaurantInsertError;
    
    // Log the registration attempt
    await supabase
      .from('registration_logs')
      .insert({
        organisation_id: organisationId,
        restaurant_id: restaurantId,
        pumpd_account_id: account.id,
        pumpd_restaurant_id: pumpdRestaurant.id,
        action: 'restaurant_registration',
        status: 'started',
        request_data: { 
          registration_type: registrationType,
          restaurant_name: restaurant.name 
        },
        script_name: 'login-and-register-restaurant.js',
        initiated_by: req.user?.email || 'system'
      });
    
    // Format hours for the script - handle midnight crossing
    let hoursJson = '{}';
    if (restaurant.opening_hours && restaurant.opening_hours.length > 0) {
      // Convert from array format and handle midnight crossing
      const hoursArray = [];
      
      restaurant.opening_hours.forEach(day => {
        if (day.hours && day.hours.open && day.hours.close) {
          const openTime = day.hours.open;
          const closeTime = day.hours.close;
          
          // Check if close time is earlier than open time (midnight crossing)
          const openHour = parseInt(openTime.split(':')[0]);
          const closeHour = parseInt(closeTime.split(':')[0]);
          
          if (closeHour < openHour || (closeHour === openHour && parseInt(closeTime.split(':')[1]) < parseInt(openTime.split(':')[1]))) {
            // Midnight crossing - split into two entries
            hoursArray.push({
              day: day.day,
              hours: { open: openTime, close: "23:59" }
            });
            
            // Add next day entry for the after-midnight portion
            const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
            const currentIndex = days.indexOf(day.day);
            const nextDay = days[(currentIndex + 1) % 7];
            
            hoursArray.push({
              day: nextDay,
              hours: { open: "00:00", close: closeTime }
            });
          } else {
            // Normal hours
            hoursArray.push({
              day: day.day,
              hours: { open: openTime, close: closeTime }
            });
          }
        }
      });
      
      hoursJson = JSON.stringify(hoursArray);
    }

    // Get organization-specific script configuration (admin URL, country, timezone)
    const scriptConfig = await OrganizationSettingsService.getScriptConfig(organisationId);
    console.log('[Registration] Script config loaded:', {
      adminUrl: scriptConfig.adminUrl,
      country: scriptConfig.country,
      timezone: scriptConfig.timezoneDisplay,
      adminHostname: scriptConfig.adminHostname
    });

    // Execute Playwright script for restaurant registration only
    // All registration types now use login-and-register-restaurant.js since account should exist
    const scriptPath = path.join(__dirname, '../../../scripts/restaurant-registration/login-and-register-restaurant.js');

    let command = `node ${scriptPath} --email="${email}" --password="${password}" --name="${restaurantName || restaurant.name}" --address="${restaurant.address || ''}" --phone="${restaurant.phone || ''}" --dayHours='${hoursJson}' --admin-url="${scriptConfig.adminUrl}" --country="${scriptConfig.country}" --timezone="${scriptConfig.timezoneDisplay}"`;

    // No longer need hasExistingRestaurants flag - the script now auto-detects

    console.log('[Registration] Executing restaurant registration:', command);
    
    try {
      const { stdout, stderr } = await execAsync(command, {
        env: { ...process.env, DEBUG_MODE: 'false' },
        timeout: 180000 // 3 minute timeout
      });
      
      // Parse subdomain and restaurant ID from stdout if available
      // The subdomain format is: subdomain.domain (e.g., pizzapalace.pumpd.co.nz or pizzapalace.ozorders.com.au)
      const subdomainMatch = stdout.match(/Subdomain:\s*([^\s]+)/);
      const fullSubdomain = subdomainMatch ? subdomainMatch[1] : null;
      // Extract just the subdomain prefix (before the first dot of the domain)
      const subdomainBase = scriptConfig.adminHostname.replace(/^admin\./, '');
      const subdomain = fullSubdomain ? fullSubdomain.replace(`.${subdomainBase}`, '') : restaurant.slug;

      // Parse restaurant ID from stdout
      // Restaurant IDs are in format: RES followed by alphanumeric characters (e.g., REShTCa6OoFcRJM2zWdM9g4S)
      const restaurantIdMatch = stdout.match(/RestaurantID:\s*(RES[A-Za-z0-9_-]+)/);
      const pumpdRestaurantId = restaurantIdMatch ? restaurantIdMatch[1] : null;

      // Update restaurant registration status with the Pumpd restaurant ID
      // Only set dashboard URLs if we have a valid restaurant ID
      const updateData = {
        registration_status: 'completed',
        registration_date: new Date().toISOString(),
        pumpd_restaurant_id: pumpdRestaurantId, // Save the Pumpd platform restaurant ID
        pumpd_subdomain: subdomain,
        pumpd_full_url: `https://${subdomain}.${subdomainBase}`
      };

      // Only set the dashboard URLs if we successfully extracted the restaurant ID
      // Use the organization's admin URL instead of hardcoded pumpd.co.nz
      if (pumpdRestaurantId) {
        updateData.dashboard_url = `${scriptConfig.adminUrl}/restaurant/${pumpdRestaurantId}`;
        updateData.settings_url = `${scriptConfig.adminUrl}/restaurant/${pumpdRestaurantId}/settings`;
        updateData.menu_url = `${scriptConfig.adminUrl}/restaurant/${pumpdRestaurantId}/menus`;
      } else {
        console.log('  ⚠️ Warning: Could not extract restaurant ID from script output');
        // Don't set incorrect URLs - leave them null
        updateData.dashboard_url = null;
        updateData.settings_url = null;
        updateData.menu_url = null;
      }

      await supabase
        .from('pumpd_restaurants')
        .update(updateData)
        .eq('id', pumpdRestaurant.id);
      
      // Update account if it was a new registration
      if (registrationType === 'new_account_with_restaurant') {
        await supabase
          .from('pumpd_accounts')
          .update({
            registration_status: 'completed',
            registration_date: new Date().toISOString(),
            restaurant_count: 1
          })
          .eq('id', account.id);
      } else {
        // Increment restaurant count for existing account
        await supabase
          .from('pumpd_accounts')
          .update({
            restaurant_count: (account.restaurant_count || 0) + 1
          })
          .eq('id', account.id);
      }

      // Update restaurant onboarding_status to 'registered'
      await supabase
        .from('restaurants')
        .update({ onboarding_status: 'registered' })
        .eq('id', restaurantId)
        .eq('organisation_id', organisationId);

      // Log success
      await supabase
        .from('registration_logs')
        .insert({
          organisation_id: organisationId,
          restaurant_id: restaurantId,
          pumpd_account_id: account.id,
          pumpd_restaurant_id: pumpdRestaurant.id,
          action: 'restaurant_registration',
          status: 'success',
          response_data: { stdout, stderr, subdomain },
          script_name: 'login-and-register-restaurant.js',
          initiated_by: req.user?.email || 'system'
        });

      // Track usage
      UsageTrackingService.trackRegistrationStep(organisationId, 'restaurant', {
        restaurant_id: restaurantId,
        subdomain: subdomain
      }).catch(err => console.error('[UsageTracking] Failed to track restaurant registration:', err));

      res.json({
        success: true,
        message: 'Restaurant registered successfully',
        restaurant: { 
          ...pumpdRestaurant, 
          registration_status: 'completed',
          pumpd_subdomain: subdomain,
          dashboard_url: `https://admin.pumpd.co.nz/restaurants/${subdomain}`
        }
      });
      
    } catch (scriptError) {
      // Update registration status to failed
      await supabase
        .from('pumpd_restaurants')
        .update({
          registration_status: 'failed',
          last_error: scriptError.message,
          error_count: (pumpdRestaurant.error_count || 0) + 1
        })
        .eq('id', pumpdRestaurant.id);
      
      // Log failure
      await supabase
        .from('registration_logs')
        .insert({
          organisation_id: organisationId,
          restaurant_id: restaurantId,
          pumpd_account_id: account.id,
          pumpd_restaurant_id: pumpdRestaurant.id,
          action: 'restaurant_registration',
          status: 'failed',
          error_message: scriptError.message,
          script_name: 'login-and-register-restaurant.js',
          initiated_by: req.user?.email || 'system'
        });
      
      throw scriptError;
    }
    
  } catch (error) {
    console.error('[Restaurant Registration] Error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Get registration logs for a restaurant
router.get('/logs/:restaurantId', async (req, res) => {
  const { restaurantId } = req.params;
  const organisationId = req.user?.organisationId;
  
  if (!organisationId) {
    return res.status(401).json({ 
      success: false, 
      error: 'Organisation context required' 
    });
  }
  
  try {
    const { supabase } = require('../services/database-service');
    
    const { data: logs, error } = await supabase
      .from('registration_logs')
      .select('*')
      .eq('organisation_id', organisationId)
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (error) throw error;
    
    res.json({
      success: true,
      logs: logs || []
    });
  } catch (error) {
    console.error('[Registration Logs] Error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Upload CSV menu to Pumpd restaurant
router.post('/upload-csv-menu', requireRegistrationMenuUpload, upload.single('csvFile'), async (req, res) => {
  const { restaurantId } = req.body;
  const organisationId = req.user?.organisationId;
  const csvFile = req.file;
  
  console.log('[CSV Upload] Request received:', { 
    restaurantId, 
    organisationId,
    fileName: csvFile?.originalname,
    fileSize: csvFile?.size
  });
  
  if (!organisationId) {
    // Clean up uploaded file
    if (csvFile?.path) {
      try {
        await fs.unlink(csvFile.path);
      } catch (err) {
        console.error('[CSV Upload] Failed to clean up file:', err);
      }
    }
    return res.status(401).json({ 
      success: false, 
      error: 'Organisation context required' 
    });
  }
  
  if (!csvFile) {
    return res.status(400).json({
      success: false,
      error: 'CSV file is required'
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
    
    console.log('[CSV Upload] Restaurant found:', restaurant.name);

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

    console.log('[CSV Upload] Account found:', finalAccount.email);

    // Get organization-specific script configuration (admin URL)
    const scriptConfig = await OrganizationSettingsService.getScriptConfig(organisationId);
    console.log('[CSV Upload] Script config loaded:', {
      adminUrl: scriptConfig.adminUrl,
      adminHostname: scriptConfig.adminHostname
    });

    // Execute updated import-csv-menu.js script with smart matching
    const scriptPath = path.join(__dirname, '../../../scripts/restaurant-registration/import-csv-menu.js');

    // Build command with proper escaping
    const command = [
      'node',
      scriptPath,
      `--email="${finalAccount.email}"`,
      `--password="${finalAccount.user_password_hint}"`,
      `--name="${restaurant.name}"`,
      `--csvFile="${csvFile.path}"`,
      `--admin-url="${scriptConfig.adminUrl}"`
    ].join(' ');
    
    console.log('[CSV Upload] Executing command:', command);
    
    // Execute the script with a timeout
    const { stdout, stderr } = await execAsync(command, {
      env: { ...process.env, DEBUG_MODE: 'false', HEADLESS: 'false' },
      timeout: 120000 // 2 minute timeout
    });
    
    console.log('[CSV Upload] Script output:', stdout);
    if (stderr) {
      console.error('[CSV Upload] Script stderr:', stderr);
    }
    
    // Check for failure indicators FIRST (before success patterns)
    const failed = stdout.includes('CSV IMPORT FAILED') ||
                   stdout.includes('Import failed') ||
                   stdout.includes('rejected') ||
                   stderr.includes('FAILED');

    if (failed) {
      console.error('[CSV Upload] Script reported failure');
      // Extract error details from output
      const errorMatch = stdout.match(/❌ CSV IMPORT FAILED[:\s]*(.+?)(?:\n|$)/);
      const errorDetail = errorMatch ? errorMatch[1] : 'Unknown error';

      // Clean up file before returning error
      if (csvFile?.path) {
        try {
          await fs.unlink(csvFile.path);
        } catch (unlinkError) {
          console.error('[CSV Upload] Failed to clean up file:', unlinkError);
        }
      }

      return res.status(500).json({
        success: false,
        error: `Menu import failed: ${errorDetail}`,
        details: stdout.substring(stdout.lastIndexOf('❌'))
      });
    }

    // Parse results from stdout - only check success if no failure detected
    const success = stdout.includes('CSV import completed successfully') ||
                   stdout.includes('CSV IMPORT PROCESS COMPLETED');
    
    // Clean up uploaded file
    try {
      await fs.unlink(csvFile.path);
      console.log('[CSV Upload] Temporary file cleaned up');
    } catch (unlinkError) {
      console.error('[CSV Upload] Failed to clean up file:', unlinkError);
    }

    // Update restaurant onboarding_status to 'menu_imported' if successful
    if (success) {
      const { supabase } = require('../services/database-service');
      await supabase
        .from('restaurants')
        .update({ onboarding_status: 'menu_imported' })
        .eq('id', restaurantId)
        .eq('organisation_id', organisationId);

      // Track usage
      UsageTrackingService.trackRegistrationStep(organisationId, 'menu_upload', {
        restaurant_id: restaurantId
      }).catch(err => console.error('[UsageTracking] Failed to track menu upload:', err));
    }

    res.json({
      success,
      message: success ? 'Menu uploaded successfully' : 'Upload completed with warnings',
      details: stdout.substring(stdout.lastIndexOf('\n', stdout.length - 2) + 1), // Get last meaningful line
      output: stdout
    });
    
  } catch (error) {
    console.error('[CSV Upload] Error:', error.message);
    // Log stdout/stderr from failed script execution
    if (error.stdout) console.error('[CSV Upload] Script stdout:', error.stdout);
    if (error.stderr) console.error('[CSV Upload] Script stderr:', error.stderr);

    // Clean up file on error
    if (csvFile?.path) {
      try {
        await fs.unlink(csvFile.path);
        console.log('[CSV Upload] Temporary file cleaned up after error');
      } catch (unlinkError) {
        console.error('[CSV Upload] Failed to clean up file after error:', unlinkError);
      }
    }

    // Determine error type
    const isTimeout = error.code === 'ETIMEDOUT' || error.message.includes('timeout') || error.killed;

    // Extract meaningful error from script output if available
    let errorMessage = error.message;
    if (error.stdout) {
      const failMatch = error.stdout.match(/❌ CSV IMPORT FAILED[:\s]*(.+?)(?:\n|$)/);
      if (failMatch) {
        errorMessage = `Menu import failed: ${failMatch[1]}`;
      }
    }

    res.status(500).json({
      success: false,
      error: isTimeout ?
        'Upload timed out. The menu may be too large or the server may be busy. Please try again.' :
        errorMessage,
      details: error.stdout?.substring(error.stdout.lastIndexOf('❌')) || error.stderr || null
    });
  }
});

/**
 * Direct menu import - generates CSV internally and imports without file upload
 * This streamlines the process by checking CDN status and generating CSV on the backend
 */
router.post('/import-menu-direct', requireRegistrationMenuUpload, async (req, res) => {
  const { restaurantId, menuId } = req.body;
  const organisationId = req.user?.organisationId;

  console.log('[Direct Import] Request received:', { restaurantId, menuId, organisationId });

  if (!organisationId) {
    return res.status(401).json({ success: false, error: 'Organisation context required' });
  }

  if (!restaurantId || !menuId) {
    return res.status(400).json({ success: false, error: 'restaurantId and menuId are required' });
  }

  let tempFilePath = null;

  try {
    const { supabase } = require('../services/database-service');
    const db = require('../services/database-service');

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

    console.log('[Direct Import] Restaurant found:', restaurant.name);

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

    if (!finalAccount?.email || !finalAccount?.user_password_hint) {
      throw new Error('Restaurant account credentials not found. Please ensure registration is complete.');
    }

    console.log('[Direct Import] Account found:', finalAccount.email);

    // Generate CSV content internally
    console.log('[Direct Import] Generating CSV for menu:', menuId);
    const csvContent = await generateMenuCSVContent(db, menuId);

    // Write to temp file
    const tempDir = '/tmp/csv-uploads';
    await fs.mkdir(tempDir, { recursive: true });
    tempFilePath = path.join(tempDir, `direct-import-${Date.now()}-${restaurantId}.csv`);
    await fs.writeFile(tempFilePath, csvContent);

    console.log('[Direct Import] CSV written to:', tempFilePath);

    // Get script config
    const scriptConfig = await OrganizationSettingsService.getScriptConfig(organisationId);
    console.log('[Direct Import] Script config loaded:', {
      adminUrl: scriptConfig.adminUrl
    });

    // Execute import script
    const scriptPath = path.join(__dirname, '../../../scripts/restaurant-registration/import-csv-menu.js');
    const command = [
      'node', scriptPath,
      `--email="${finalAccount.email}"`,
      `--password="${finalAccount.user_password_hint}"`,
      `--name="${restaurant.name}"`,
      `--csvFile="${tempFilePath}"`,
      `--admin-url="${scriptConfig.adminUrl}"`
    ].join(' ');

    console.log('[Direct Import] Executing script...');
    const { stdout, stderr } = await execAsync(command, {
      env: { ...process.env, DEBUG_MODE: 'false', HEADLESS: 'false' },
      timeout: 120000 // 2 minute timeout
    });

    console.log('[Direct Import] Script output:', stdout);
    if (stderr) console.error('[Direct Import] Script stderr:', stderr);

    // Check for explicit failure indicators FIRST (before success patterns)
    const failed = (stdout.includes('❌') && stdout.includes('FAILED')) ||
                   stdout.includes('CSV IMPORT FAILED') ||
                   stdout.includes('File upload failed') ||
                   stderr.includes('FAILED');

    if (failed) {
      console.error('[Direct Import] Script reported failure');
      return res.status(500).json({
        success: false,
        error: 'Menu import failed - file upload error',
        details: stdout.substring(stdout.lastIndexOf('❌'))
      });
    }

    // Only check success if no failure detected above
    const success = stdout.includes('CSV import completed successfully') ||
                   stdout.includes('CSV IMPORT PROCESS COMPLETED');

    if (success) {
      await supabase
        .from('restaurants')
        .update({ onboarding_status: 'menu_imported' })
        .eq('id', restaurantId)
        .eq('organisation_id', organisationId);

      UsageTrackingService.trackRegistrationStep(organisationId, 'menu_upload', {
        restaurant_id: restaurantId,
        menu_id: menuId,
        method: 'direct_import'
      }).catch(err => console.error('[UsageTracking] Failed:', err));
    }

    res.json({
      success,
      message: success ? 'Menu imported successfully' : 'Import completed with warnings',
      details: stdout.substring(stdout.lastIndexOf('\n', stdout.length - 2) + 1)
    });

  } catch (error) {
    console.error('[Direct Import] Error:', error.message);
    // Log stdout/stderr from failed script execution
    if (error.stdout) console.error('[Direct Import] Script stdout:', error.stdout);
    if (error.stderr) console.error('[Direct Import] Script stderr:', error.stderr);

    // Determine error type
    const isTimeout = error.code === 'ETIMEDOUT' || error.message.includes('timeout') || error.killed;

    // Extract meaningful error from script output if available
    let errorMessage = error.message;
    if (error.stdout) {
      const failMatch = error.stdout.match(/❌ CSV IMPORT FAILED[:\s]*(.+?)(?:\n|$)/);
      if (failMatch) {
        errorMessage = `Menu import failed: ${failMatch[1]}`;
      }
    }

    res.status(500).json({
      success: false,
      error: isTimeout ?
        'Import timed out. Please try again.' :
        errorMessage,
      details: error.stdout?.substring(error.stdout.lastIndexOf('❌')) || error.stderr || null
    });
  } finally {
    // Cleanup temp file
    if (tempFilePath) {
      try {
        await fs.unlink(tempFilePath);
        console.log('[Direct Import] Temp file cleaned up');
      } catch (err) {
        console.error('[Direct Import] Failed to cleanup temp file:', err);
      }
    }
  }
});

/**
 * Helper function to generate CSV content with CDN information
 * Extracted from server.js csv-with-cdn endpoint logic
 */
async function generateMenuCSVContent(db, menuId) {
  const menu = await db.getMenuWithItems(menuId);

  if (!menu) throw new Error('Menu not found');

  // Field cleaning logic
  const UNWANTED_PHRASES = ['Plus small', 'Thumb up outline', 'No. 1 most liked', 'No. 2 most liked', 'No. 3 most liked'];
  const REGEX_PATTERNS = [/\d+%/g, /\(\d+\)/g];

  function cleanField(value) {
    if (!value || typeof value !== 'string') return value || '';
    let cleaned = value;
    UNWANTED_PHRASES.forEach(phrase => { cleaned = cleaned.replace(new RegExp(phrase, 'g'), ''); });
    REGEX_PATTERNS.forEach(pattern => { cleaned = cleaned.replace(pattern, ''); });
    cleaned = cleaned.replace(/\r?\n/g, ' ');
    cleaned = cleaned.replace(/;\s*;/g, ';').replace(/,\s*,/g, ',');
    cleaned = cleaned.replace(/\s+/g, ' ').replace(/^\s*[;,]\s*/, '').replace(/\s*[;,]\s*$/, '');
    return cleaned.trim();
  }

  function escapeCSVField(field) {
    if (field === null || field === undefined) return '';
    const str = String(field);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  function formatPrice(price) {
    if (typeof price === 'string') {
      price = price.replace(/[$€£¥\s]/g, '');
      price = parseFloat(price);
    }
    if (isNaN(price)) {
      return '0.00';
    }
    return price.toFixed(2);
  }

  const headers = [
    'menuID', 'menuName', 'menuDisplayName', 'menuDescription',
    'categoryID', 'categoryName', 'categoryDisplayName', 'categoryDescription',
    'dishID', 'dishName', 'dishPrice', 'dishType', 'dishDescription',
    'displayName', 'printName', 'tags',
    'isCDNImage', 'imageCDNID', 'imageCDNFilename', 'imageExternalURL'
  ];

  const rows = [];

  if (menu.categories) {
    menu.categories.forEach(category => {
      if (category.menu_items) {
        category.menu_items.forEach(item => {
          let isCDNImage = 'FALSE', imageCDNID = '', imageCDNFilename = '';

          if (item.item_images?.length > 0) {
            const primaryImage = item.item_images.find(img => img.type === 'primary') || item.item_images[0];
            if (primaryImage?.cdn_uploaded && primaryImage?.cdn_id) {
              isCDNImage = 'TRUE';
              imageCDNID = primaryImage.cdn_id;
              imageCDNFilename = primaryImage.cdn_filename || '';
            }
          }

          // Process tags
          let tagsString = '';
          if (item.tags) {
            if (Array.isArray(item.tags)) {
              tagsString = item.tags.join(', ');
            } else {
              tagsString = String(item.tags);
            }
            tagsString = cleanField(tagsString);
          }

          rows.push([
            '', // menuID
            escapeCSVField('Menu'), // menuName
            '', // menuDisplayName
            '', // menuDescription
            '', // categoryID
            escapeCSVField(cleanField(category.name || 'Uncategorized')), // categoryName
            '', // categoryDisplayName
            '', // categoryDescription
            '', // dishID
            escapeCSVField(cleanField(item.name || '')), // dishName
            formatPrice(item.price || 0), // dishPrice
            escapeCSVField(item.item_type || 'standard'), // dishType
            escapeCSVField(cleanField(item.description || '')), // dishDescription
            '', // displayName
            '', // printName
            escapeCSVField(tagsString), // tags
            isCDNImage, // isCDNImage
            imageCDNID, // imageCDNID
            imageCDNFilename, // imageCDNFilename
            '' // imageExternalURL
          ].join(','));
        });
      }
    });
  }

  console.log(`[Direct Import] Generated CSV with ${rows.length} items`);
  return [headers.join(','), ...rows].join('\n');
}

/**
 * Validate that file paths exist and are readable
 */
router.post('/validate-files', async (req, res) => {
  const { headPath, bodyPath } = req.body;
  const organisationId = req.user?.organisationId;
  
  console.log('[File Validation] Request received:', { headPath, bodyPath, organisationId });
  
  if (!organisationId) {
    return res.status(401).json({ 
      success: false, 
      error: 'Organisation context required' 
    });
  }
  
  if (!headPath || !bodyPath) {
    return res.status(400).json({
      success: false,
      valid: false,
      error: 'Both head and body file paths are required'
    });
  }
  
  try {
    // Check if files exist and are readable
    const errors = [];
    
    try {
      await fs.access(headPath, fs.constants.R_OK);
      console.log('[File Validation] ✓ Head file exists and is readable:', headPath);
    } catch (error) {
      errors.push(`Head file not found or not readable: ${headPath}`);
      console.error('[File Validation] ✗ Head file error:', error.message);
    }
    
    try {
      await fs.access(bodyPath, fs.constants.R_OK);
      console.log('[File Validation] ✓ Body file exists and is readable:', bodyPath);
    } catch (error) {
      errors.push(`Body file not found or not readable: ${bodyPath}`);
      console.error('[File Validation] ✗ Body file error:', error.message);
    }
    
    if (errors.length > 0) {
      return res.json({
        success: false,
        valid: false,
        error: errors.join('; ')
      });
    }
    
    // Optional: Check if files are HTML
    try {
      const headContent = await fs.readFile(headPath, 'utf-8');
      const bodyContent = await fs.readFile(bodyPath, 'utf-8');
      
      // Basic HTML validation - check if they contain HTML-like content
      const hasHTMLContent = (content) => {
        return content.includes('<') && content.includes('>');
      };
      
      if (!hasHTMLContent(headContent)) {
        errors.push('Head file does not appear to contain HTML content');
      }
      
      if (!hasHTMLContent(bodyContent)) {
        errors.push('Body file does not appear to contain HTML content');
      }
      
      if (errors.length > 0) {
        return res.json({
          success: false,
          valid: false,
          error: errors.join('; ')
        });
      }
      
      console.log('[File Validation] ✓ Both files contain valid HTML content');
    } catch (error) {
      console.error('[File Validation] Warning: Could not validate file contents:', error.message);
      // Don't fail validation, just log the warning
    }
    
    console.log('[File Validation] ✓ Files validated successfully');
    
    res.json({
      success: true,
      valid: true,
      message: 'Files validated successfully',
      paths: {
        head: headPath,
        body: bodyPath
      }
    });
    
  } catch (error) {
    console.error('[File Validation] Error:', error);
    res.status(500).json({
      success: false,
      valid: false,
      error: error.message
    });
  }
});

/**
 * Generate code injections for website customization
 * Uses ordering-page-customization.js script to generate head/body HTML files
 */
router.post('/generate-code-injections', requireRegistrationCodeInjection, async (req, res) => {
  const { restaurantId, noGradient } = req.body;
  const organisationId = req.user?.organisationId;

  console.log('[Code Generation] Request received:', { restaurantId, organisationId, noGradient });
  
  if (!organisationId) {
    return res.status(401).json({ 
      success: false, 
      error: 'Organisation context required' 
    });
  }
  
  try {
    const { supabase } = require('../services/database-service');
    
    // Get restaurant details including theme colors
    const { data: restaurant, error: restaurantError } = await supabase
      .from('restaurants')
      .select('name, primary_color, secondary_color, theme')
      .eq('id', restaurantId)
      .eq('organisation_id', organisationId)
      .single();
    
    if (restaurantError || !restaurant) {
      throw new Error('Restaurant not found');
    }
    
    if (!restaurant.primary_color || !restaurant.secondary_color) {
      return res.status(400).json({
        success: false,
        error: 'Restaurant colors not configured. Please set primary and secondary colors in the Branding tab.'
      });
    }
    
    console.log('[Code Generation] Restaurant:', restaurant.name);
    console.log('[Code Generation] Colors:', { 
      primary: restaurant.primary_color, 
      secondary: restaurant.secondary_color,
      theme: restaurant.theme || 'dark'
    });
    
    // Prepare script arguments
    const scriptPath = path.join(__dirname, '../../../scripts/ordering-page-customization.js');
    const sanitizedName = restaurant.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const outputDir = path.join(__dirname, '../../../generated-code', sanitizedName);
    const completionPath = path.join(outputDir, 'completion.json');

    // Determine execution mode based on environment
    const isProduction = process.env.NODE_ENV === 'production';
    console.log(`[Code Generation] Running in ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'} mode`);

    if (isProduction) {
      // PRODUCTION MODE: Use execAsync - waits for completion, captures output
      let command = `node "${scriptPath}" --primary="${restaurant.primary_color}" --secondary="${restaurant.secondary_color}" --name="${restaurant.name.replace(/"/g, '\\"')}"`;

      if (restaurant.theme === 'light') {
        command += ' --lightmode';
      }

      if (noGradient) {
        command += ' --no-gradient';
      }

      console.log('[Code Generation] Executing script (production):', command);

      const { stdout, stderr } = await execAsync(command, {
        env: { ...process.env, DEBUG_MODE: 'false' },
        timeout: 120000 // 2 minute timeout
      });

      if (stdout) console.log('[Code Generation] Output:', stdout);
      if (stderr) console.error('[Code Generation] Stderr:', stderr);

      // Verify completion file exists
      try {
        await fs.access(completionPath);
        const completionData = await fs.readFile(completionPath, 'utf-8');
        const completion = JSON.parse(completionData);
        if (!completion.success) {
          throw new Error('Script completed but reported failure');
        }
        console.log('[Code Generation] ✓ Completion verified');
      } catch (error) {
        throw new Error(`Script completed but output files not found: ${error.message}`);
      }

    } else {
      // DEVELOPMENT MODE: Use spawn detached - allows browser to stay open for manual adjustments
      const args = [
        scriptPath,
        `--primary=${restaurant.primary_color}`,
        `--secondary=${restaurant.secondary_color}`,
        `--name=${restaurant.name}`,
        '--keep-browser-open'  // Keep browser open in dev mode
      ];

      if (restaurant.theme === 'light') {
        args.push('--lightmode');
      }

      if (noGradient) {
        args.push('--no-gradient');
      }

      console.log('[Code Generation] Spawning script (development):', args.join(' '));

      const child = spawn('node', args, {
        detached: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env }
      });

      // Log child process output for debugging
      child.stdout.on('data', (data) => {
        console.log('[Code Generation Script]', data.toString().trim());
      });

      child.stderr.on('data', (data) => {
        console.error('[Code Generation Script Error]', data.toString().trim());
      });

      child.on('error', (err) => {
        console.error('[Code Generation] Failed to start script:', err);
      });

      // Unref so parent process doesn't wait for child
      child.unref();

      console.log('[Code Generation] Process spawned, polling for completion...');

      // Poll for completion.json file
      const maxAttempts = 90; // 90 seconds timeout (longer for dev mode)
      const pollInterval = 1000;

      let attempts = 0;
      let completionFound = false;

      while (attempts < maxAttempts && !completionFound) {
        try {
          await fs.access(completionPath);
          const completionData = await fs.readFile(completionPath, 'utf-8');
          const completion = JSON.parse(completionData);

          if (completion.success) {
            console.log('[Code Generation] ✓ Completion marker found');
            completionFound = true;
            break;
          }
        } catch (error) {
          // File doesn't exist yet, continue polling
        }

        attempts++;
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }

      if (!completionFound) {
        throw new Error('Script timed out waiting for completion. The script may still be running in the background.');
      }
    }

    // Define file paths for verification
    const filePaths = {
      headInjection: path.join(outputDir, 'head-injection.html'),
      bodyInjection: path.join(outputDir, 'body-injection.html'),
      configuration: path.join(outputDir, 'configuration.json'),
      completion: completionPath
    };

    // Verify all required files exist
    for (const [key, filePath] of Object.entries(filePaths)) {
      try {
        await fs.access(filePath);
        console.log(`[Code Generation] ✓ File exists: ${key}`);
      } catch {
        console.error(`[Code Generation] ✗ File not found: ${filePath}`);
        throw new Error(`Generated file not found: ${key}. The script may have failed to complete.`);
      }
    }
    
    console.log('[Code Generation] Success! Files generated at:', outputDir);

    // Read file contents for database storage
    let headContent, bodyContent, configContent;
    try {
      [headContent, bodyContent, configContent] = await Promise.all([
        fs.readFile(filePaths.headInjection, 'utf-8'),
        fs.readFile(filePaths.bodyInjection, 'utf-8'),
        fs.readFile(filePaths.configuration, 'utf-8').then(JSON.parse)
      ]);
      console.log('[Code Generation] Read file contents for database storage');
    } catch (readError) {
      console.error('[Code Generation] Failed to read files for database storage:', readError);
      // Continue without database storage - files still exist
    }

    // Store code injection content in database for production persistence
    // Uses UPSERT to create record if it doesn't exist (Phase 1 runs before restaurant registration in Phase 2)
    let codeInjectionId = null;
    if (headContent && bodyContent) {
      try {
        const { data: pumpdRestaurant, error: upsertError } = await supabase
          .from('pumpd_restaurants')
          .upsert({
            organisation_id: organisationId,
            restaurant_id: restaurantId,
            head_injection: headContent,
            body_injection: bodyContent,
            code_injection_config: {
              ...configContent,
              generatedBy: req.user?.id || null,
              generationMethod: 'manual',
              noGradient: noGradient || false
            },
            code_injection_generated_at: new Date().toISOString()
          }, {
            onConflict: 'organisation_id,restaurant_id'
          })
          .select('id')
          .single();

        if (upsertError) {
          console.error('[Code Generation] Failed to store in database:', upsertError);
        } else {
          codeInjectionId = pumpdRestaurant.id;
          console.log('[Code Generation] ✓ Stored in database:', codeInjectionId);
        }
      } catch (dbError) {
        console.error('[Code Generation] Database storage error:', dbError);
        // Don't fail - file-based approach still works
      }
    }

    // Track usage
    UsageTrackingService.trackRegistrationStep(organisationId, 'code_injection', {
      restaurant_id: restaurantId
    }).catch(err => console.error('[UsageTracking] Failed to track code injection:', err));

    res.json({
      success: true,
      message: 'Code injections generated successfully.',
      codeInjectionId,
      generatedAt: new Date().toISOString(),
      // Legacy: filePaths kept for backward compatibility during migration
      filePaths
    });
    
  } catch (error) {
    console.error('[Code Generation] Error:', error);
    
    const isTimeout = error.code === 'ETIMEDOUT' || error.message.includes('timeout');
    
    res.status(500).json({
      success: false,
      error: isTimeout ? 
        'Code generation timed out. Please try again.' :
        error.message,
      details: error.stderr || null
    });
  }
});

/**
 * Get existing code injection status for a restaurant
 * Returns whether code injection content exists in the database
 */
router.get('/code-injection/:restaurantId', async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const organisationId = req.user?.organisationId;

    if (!organisationId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { supabase } = require('../services/database-service');

    const { data: pumpdRestaurant, error } = await supabase
      .from('pumpd_restaurants')
      .select('id, head_injection, body_injection, code_injection_config, code_injection_generated_at')
      .eq('restaurant_id', restaurantId)
      .eq('organisation_id', organisationId)
      .single();

    if (error || !pumpdRestaurant) {
      return res.json({
        success: true,
        hasContent: false,
        codeInjectionId: null
      });
    }

    const hasContent = !!(pumpdRestaurant.head_injection && pumpdRestaurant.body_injection);

    res.json({
      success: true,
      hasContent,
      codeInjectionId: hasContent ? pumpdRestaurant.id : null,
      generatedAt: pumpdRestaurant.code_injection_generated_at,
      config: pumpdRestaurant.code_injection_config
    });

  } catch (error) {
    console.error('Error checking code injection:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * Configure website settings with generated code
 * Uses edit-website-settings-dark.js or edit-website-settings-light.js based on theme
 */
router.post('/configure-website', requireRegistrationWebsiteSettings, async (req, res) => {
  const { restaurantId, filePaths, codeInjectionId } = req.body;
  const organisationId = req.user?.organisationId;

  console.log('[Website Config] Request received:', { restaurantId, organisationId, codeInjectionId, hasFilePaths: !!filePaths });

  if (!organisationId) {
    return res.status(401).json({
      success: false,
      error: 'Organisation context required'
    });
  }

  // Track temporary files for cleanup (declare outside try-catch for scope)
  const tempFiles = [];

  // Code injection content - will be populated from database or files
  let codeInjectionContent = null;
  
  try {
    const { supabase } = require('../services/database-service');
    
    // Get restaurant and account details
    const { data: restaurant, error: restaurantError } = await supabase
      .from('restaurants')
      .select(`
        name,
        primary_color,
        secondary_color,
        tertiary_color,
        accent_color,
        background_color,
        theme,
        logo_nobg_url,
        logo_favicon_url,
        website_og_image,
        ubereats_og_image,
        doordash_og_image,
        facebook_cover_image,
        instagram_url,
        facebook_url,
        address,
        phone,
        cuisine
      `)
      .eq('id', restaurantId)
      .eq('organisation_id', organisationId)
      .single();
    
    if (restaurantError || !restaurant) {
      throw new Error('Restaurant not found');
    }
    
    console.log('[Website Config] Restaurant found:', restaurant.name);
    console.log('[Website Config] Theme:', restaurant.theme || 'dark');

    // Helper function to resolve color value from source name or hex code
    const resolveColorValue = (colorSource) => {
      const colorMap = {
        'white': '#FFFFFF',
        'black': '#000000',
        'primary': restaurant.primary_color,
        'secondary': restaurant.secondary_color,
        'tertiary': restaurant.tertiary_color,
        'accent': restaurant.accent_color,
        'background': restaurant.background_color
      };

      // If it's a hex color, return as-is
      if (colorSource?.startsWith('#')) {
        return colorSource;
      }

      // Otherwise look up from map, with fallback to white (for dark theme default)
      return colorMap[colorSource] || '#FFFFFF';
    };

    // Get account credentials and code injection content through pumpd_restaurants relationship
    const { data: pumpdRestaurant, error: pumpdRestError } = await supabase
      .from('pumpd_restaurants')
      .select('*, pumpd_subdomain, pumpd_full_url, head_injection, body_injection, code_injection_config, pumpd_accounts(email, user_password_hint)')
      .eq('restaurant_id', restaurantId)
      .eq('organisation_id', organisationId)
      .single();

    // Try to get code injection content from database first
    if (pumpdRestaurant?.head_injection && pumpdRestaurant?.body_injection) {
      codeInjectionContent = {
        head: pumpdRestaurant.head_injection,
        body: pumpdRestaurant.body_injection,
        config: pumpdRestaurant.code_injection_config
      };
      console.log('[Website Config] Using code injection content from database');
    } else if (filePaths?.headInjection && filePaths?.bodyInjection) {
      // Fall back to file paths
      console.log('[Website Config] Using code injection content from files');
    } else {
      return res.status(400).json({
        success: false,
        error: 'No code injection content available. Please generate code injections first.'
      });
    }

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

    console.log('[Website Config] Account found:', finalAccount.email);

    // Get organization-specific script configuration (admin URL, country)
    const scriptConfig = await OrganizationSettingsService.getScriptConfig(organisationId);
    console.log('[Website Config] Script config loaded:', {
      adminUrl: scriptConfig.adminUrl,
      country: scriptConfig.country,
      adminHostname: scriptConfig.adminHostname
    });

    // Select appropriate script based on theme
    const isDark = restaurant.theme !== 'light';
    const scriptName = isDark ? 'edit-website-settings-dark.js' : 'edit-website-settings-light.js';
    const scriptPath = path.join(__dirname, '../../../scripts', scriptName);

    console.log('[Website Config] Using script:', scriptName);

    // Determine code injection source and prepare arguments
    let headArg, bodyArg;
    let scriptEnv = { ...process.env, DEBUG_MODE: 'false' };

    if (codeInjectionContent) {
      // Database approach: Pass content via environment variables
      scriptEnv.HEAD_INJECTION_CONTENT = Buffer.from(codeInjectionContent.head).toString('base64');
      scriptEnv.BODY_INJECTION_CONTENT = Buffer.from(codeInjectionContent.body).toString('base64');
      headArg = '--head-from-env';
      bodyArg = '--body-from-env';
      console.log('[Website Config] Passing code injection via environment variables');
    } else {
      // Legacy file path approach
      headArg = `--head="${filePaths.headInjection}"`;
      bodyArg = `--body="${filePaths.bodyInjection}"`;
      console.log('[Website Config] Passing code injection via file paths');
    }

    // Build command with all arguments
    let command = [
      'node',
      scriptPath,
      `--email="${finalAccount.email}"`,
      `--password="${finalAccount.user_password_hint}"`,
      `--name="${restaurant.name.replace(/"/g, '\\"')}"`,
      `--primary="${restaurant.primary_color}"`,
      headArg,
      bodyArg,
      `--admin-url="${scriptConfig.adminUrl}"`
    ];

    // Add secondary color if available
    if (restaurant.secondary_color) {
      command.push(`--secondary="${restaurant.secondary_color}"`);
    }

    // Helper to resolve color from config value
    const resolveColor = (colorValue) => {
      if (!colorValue) return null;
      if (colorValue === 'primary') return restaurant.primary_color;
      if (colorValue === 'secondary') return restaurant.secondary_color;
      if (colorValue === 'black') return '#000000';
      if (colorValue === 'white') return '#FFFFFF';
      if (colorValue.startsWith('#')) return colorValue;
      return null;
    };

    // Helper to get logo buffer from base64 or URL
    const getLogoBuffer = async (logoUrl) => {
      if (logoUrl.startsWith('data:image')) {
        const base64Data = logoUrl.split(',')[1];
        return Buffer.from(base64Data, 'base64');
      } else if (logoUrl.startsWith('http')) {
        const axios = require('axios');
        const response = await axios.get(logoUrl, { responseType: 'arraybuffer' });
        return Buffer.from(response.data);
      }
      return null;
    };

    // Get tint configs from request (now with darkColor and lightColor)
    const { navLogoTintConfig, headerLogoTintConfig } = req.body;

    // Resolve nav logo colors
    const navDarkColor = resolveColor(navLogoTintConfig?.darkColor);
    const navLightColor = resolveColor(navLogoTintConfig?.lightColor);

    // Resolve header logo colors
    const headerDarkColor = resolveColor(headerLogoTintConfig?.darkColor);
    const headerLightColor = resolveColor(headerLogoTintConfig?.lightColor);

    // Add optional fields if available
    // Process nav bar logo with optional tinting and resizing (max 150x80 for nav bar fit)
    const NAV_LOGO_MAX_WIDTH = 150;
    const NAV_LOGO_MAX_HEIGHT = 80;

    if (restaurant.logo_nobg_url) {
      try {
        let navLogoBuffer = await getLogoBuffer(restaurant.logo_nobg_url);

        if (navLogoBuffer) {
          // Apply dual-color tint if configured
          if (navDarkColor || navLightColor) {
            navLogoBuffer = await colorizeLogoToColor(navLogoBuffer, navDarkColor, navLightColor);
            console.log(`[Website Config] Nav logo tinted - dark:${navDarkColor || 'keep'}, light:${navLightColor || 'keep'}`);
          }

          // Resize the buffer
          const sharp = require('sharp');
          const fs = require('fs').promises;
          const os = require('os');

          const resized = await sharp(navLogoBuffer)
            .resize(NAV_LOGO_MAX_WIDTH, NAV_LOGO_MAX_HEIGHT, {
              fit: 'inside',
              withoutEnlargement: true
            })
            .png()
            .toBuffer();

          const tempDir = os.tmpdir();
          const logoPath = path.join(tempDir, `nav-logo-${Date.now()}.png`);
          await fs.writeFile(logoPath, resized);

          command.push(`--logo="${logoPath}"`);
          tempFiles.push(logoPath);
          console.log('[Website Config] Nav bar logo processed:', logoPath);
        }
      } catch (navLogoError) {
        console.error('[Website Config] Failed to process nav logo:', navLogoError.message);
        // Fallback to original if processing fails
        if (restaurant.logo_nobg_url.startsWith('http')) {
          const downloadedLogo = await downloadLogoIfNeeded(restaurant.logo_nobg_url);
          if (downloadedLogo) {
            command.push(`--logo="${downloadedLogo}"`);
            tempFiles.push(downloadedLogo);
          }
        }
      }
    }

    // Add favicon if available (separate from logo)
    if (restaurant.logo_favicon_url) {
      // Check if it's a base64 data URL
      if (restaurant.logo_favicon_url.startsWith('data:image')) {
        // Convert base64 to PNG file
        const faviconPath = await convertBase64ToPng(restaurant.logo_favicon_url);
        if (faviconPath) {
          command.push(`--favicon="${faviconPath}"`);
          tempFiles.push(faviconPath); // Track for cleanup
          console.log('[Website Config] Using dedicated favicon:', faviconPath);
        }
      } else if (restaurant.logo_favicon_url.startsWith('http')) {
        // Download favicon to temp location
        const faviconPath = await downloadLogoIfNeeded(restaurant.logo_favicon_url);
        if (faviconPath) {
          command.push(`--favicon="${faviconPath}"`);
          tempFiles.push(faviconPath); // Track for cleanup
          console.log('[Website Config] Using dedicated favicon:', faviconPath);
        }
      } else {
        // Local path
        command.push(`--favicon="${restaurant.logo_favicon_url}"`);
        console.log('[Website Config] Using dedicated favicon:', restaurant.logo_favicon_url);
      }
    }

    if (restaurant.address) {
      command.push(`--address="${restaurant.address.replace(/"/g, '\\"')}"`);
    }
    
    if (restaurant.phone) {
      command.push(`--phone="${restaurant.phone}"`);
    }
    
    if (restaurant.instagram_url) {
      command.push(`--instagram="${restaurant.instagram_url}"`);
    }
    
    if (restaurant.facebook_url) {
      command.push(`--facebook="${restaurant.facebook_url}"`);
    }
    
    if (restaurant.cuisine && restaurant.cuisine.length > 0) {
      command.push(`--cuisine="${restaurant.cuisine.join(', ')}"`);
    }

    // Handle header configuration
    const { headerConfig, itemsConfig, textColorConfig, logoColorConfig } = req.body;

    if (headerConfig?.enabled) {
      command.push('--header-enabled=true');

      // Get selected background source
      const bgSource = headerConfig.backgroundSource;
      const bgImage = restaurant[bgSource];

      if (bgImage) {
        let bgPath = null;

        if (bgImage.startsWith('data:image')) {
          // Convert base64 to buffer first, then process for size limits
          const matches = bgImage.match(/^data:image\/([a-zA-Z]+);base64,(.+)$/);
          if (matches && matches.length === 3) {
            const buffer = Buffer.from(matches[2], 'base64');
            bgPath = await processHeaderBackgroundImage(buffer);
          }
        } else if (bgImage.startsWith('http')) {
          // Download first, then process for size limits
          const downloadedPath = await downloadLogoIfNeeded(bgImage);
          if (downloadedPath) {
            bgPath = await processHeaderBackgroundImage(downloadedPath);
            // Clean up downloaded file if processing created a new one
            if (bgPath && bgPath !== downloadedPath) {
              try { await fs.unlink(downloadedPath); } catch {}
            }
          }
        }

        if (bgPath) {
          command.push(`--header-bg="${bgPath}"`);
          tempFiles.push(bgPath);
          console.log('[Website Config] Header background ready:', bgPath);
        }
      }

      // Process header logo with optional tinting (resized no-bg logo to max 200x200)
      const HEADER_LOGO_MAX_WIDTH = 300;
      const HEADER_LOGO_MAX_HEIGHT = 300;

      if (restaurant.logo_nobg_url) {
        try {
          let headerLogoBuffer = await getLogoBuffer(restaurant.logo_nobg_url);

          if (headerLogoBuffer) {
            // Apply dual-color tint if configured
            if (headerDarkColor || headerLightColor) {
              headerLogoBuffer = await colorizeLogoToColor(headerLogoBuffer, headerDarkColor, headerLightColor);
              console.log(`[Website Config] Header logo tinted - dark:${headerDarkColor || 'keep'}, light:${headerLightColor || 'keep'}`);
            }

            // Resize the buffer
            const sharp = require('sharp');
            const fs = require('fs').promises;
            const os = require('os');

            const resized = await sharp(headerLogoBuffer)
              .resize(HEADER_LOGO_MAX_WIDTH, HEADER_LOGO_MAX_HEIGHT, {
                fit: 'inside',
                withoutEnlargement: true
              })
              .png()
              .toBuffer();

            const tempDir = os.tmpdir();
            const headerLogoPath = path.join(tempDir, `header-logo-${Date.now()}.png`);
            await fs.writeFile(headerLogoPath, resized);

            command.push(`--header-logo="${headerLogoPath}"`);
            tempFiles.push(headerLogoPath);
            console.log('[Website Config] Header logo processed:', headerLogoPath);
          }
        } catch (headerLogoError) {
          console.error('[Website Config] Failed to process header logo:', headerLogoError.message);
          // Fallback to original if processing fails
          if (restaurant.logo_nobg_url.startsWith('http')) {
            const downloadedLogo = await downloadLogoIfNeeded(restaurant.logo_nobg_url);
            if (downloadedLogo) {
              command.push(`--header-logo="${downloadedLogo}"`);
              tempFiles.push(downloadedLogo);
            }
          }
        }
      }
    }

    // Handle items configuration
    const itemLayout = itemsConfig?.layout || 'list';
    command.push(`--item-layout="${itemLayout}"`);
    console.log('[Website Config] Item layout:', itemLayout);

    // Handle text color configuration
    if (textColorConfig?.navText) {
      const navTextColor = resolveColorValue(textColorConfig.navText);
      command.push(`--nav-text-color="${navTextColor}"`);
      console.log('[Website Config] Nav text color:', navTextColor);
    }

    if (textColorConfig?.boxText) {
      const boxTextColor = resolveColorValue(textColorConfig.boxText);
      command.push(`--box-text-color="${boxTextColor}"`);
      console.log('[Website Config] Box text color:', boxTextColor);
    }

    // Add location if we have address (extract city/area from address)
    if (restaurant.address) {
      // Try to extract location from address (simple approach)
      const addressParts = restaurant.address.split(',');
      if (addressParts.length > 1) {
        const location = addressParts[addressParts.length - 2]?.trim() || addressParts[addressParts.length - 1]?.trim();
        if (location) {
          command.push(`--location="${location}"`);
        }
      }
    }
    
    command = command.join(' ');
    
    console.log('[Website Config] Executing configuration script...');
    
    const { stdout, stderr } = await execAsync(command, {
      env: scriptEnv,
      timeout: 240000 // 4 minute timeout - increased for complex configurations
    });
    
    console.log('[Website Config] Script output:', stdout);
    if (stderr) {
      console.error('[Website Config] Script stderr:', stderr);
    }
    
    // Check for success indicators
    const success = stdout.includes('Successfully') || 
                   stdout.includes('✅') ||
                   stdout.includes('Complete') ||
                   stdout.includes('Website Settings!');
    
    // Extract uploaded logo URL from script output
    let uploadedLogoUrl = null;
    const resultDataMatch = stdout.match(/===RESULT_DATA_START===([\s\S]*?)===RESULT_DATA_END===/);
    if (resultDataMatch) {
      try {
        const resultData = JSON.parse(resultDataMatch[1].trim());
        uploadedLogoUrl = resultData.uploadedLogoUrl;
        console.log('[Website Config] Extracted uploaded logo URL:', uploadedLogoUrl);
      } catch (parseError) {
        console.error('[Website Config] Failed to parse result data:', parseError);
      }
    }
    
    // Save uploaded logo URL to database if available
    if (uploadedLogoUrl) {
      try {
        const { supabase } = require('../services/database-service');
        
        const { error: updateError } = await supabase
          .from('restaurants')
          .update({ hosted_logo_url: uploadedLogoUrl })
          .eq('id', restaurantId)
          .eq('organisation_id', organisationId);
        
        if (updateError) {
          console.error('[Website Config] Failed to save hosted logo URL:', updateError);
        } else {
          console.log('[Website Config] ✓ Saved hosted logo URL to database');
        }
      } catch (dbError) {
        console.error('[Website Config] Database error saving logo URL:', dbError);
      }
    }
    
    // Compute demo store URL
    const demoStoreUrl = pumpdRestaurant?.pumpd_full_url ||
                        (pumpdRestaurant?.pumpd_subdomain ? `https://${pumpdRestaurant.pumpd_subdomain}.pumpd.co.nz` : null);

    if (success) {
      console.log('[Website Config] ✓ Configuration completed successfully');

      // Update restaurant with demo_store_built, demo_store_url, subdomain, and onboarding_status
      try {
        const updateData = {
          demo_store_built: true,
          onboarding_status: 'configured'
        };
        if (demoStoreUrl) {
          updateData.demo_store_url = demoStoreUrl;
        }
        if (pumpdRestaurant?.pumpd_subdomain) {
          updateData.subdomain = pumpdRestaurant.pumpd_subdomain;
        }

        const { error: demoUpdateError } = await supabase
          .from('restaurants')
          .update(updateData)
          .eq('id', restaurantId)
          .eq('organisation_id', organisationId);

        if (demoUpdateError) {
          console.error('[Website Config] Failed to update demo_store_built:', demoUpdateError);
        } else {
          console.log('[Website Config] ✓ Updated demo_store_built=true, onboarding_status=configured, demo_store_url:', demoStoreUrl, ', subdomain:', pumpdRestaurant?.pumpd_subdomain || 'N/A');
        }
      } catch (demoDbError) {
        console.error('[Website Config] Database error updating demo store status:', demoDbError);
      }
    } else {
      console.log('[Website Config] ⚠ Configuration may have issues');
    }

    // Clean up temporary files
    await cleanupTempFiles(tempFiles);

    // Track usage
    if (success) {
      UsageTrackingService.trackRegistrationStep(organisationId, 'website_settings', {
        restaurant_id: restaurantId,
        theme: restaurant.theme || 'dark'
      }).catch(err => console.error('[UsageTracking] Failed to track website settings:', err));
    }

    res.json({
      success,
      message: success ? 'Website configured successfully' : 'Configuration completed with warnings',
      output: stdout,
      error: stderr || null,
      uploadedLogoUrl,
      demoStoreUrl: success ? demoStoreUrl : null
    });

  } catch (error) {
    console.error('[Website Config] Error:', error);
    
    // Clean up temporary files even on error
    if (tempFiles && tempFiles.length > 0) {
      await cleanupTempFiles(tempFiles);
    }
    
    // Check if process was killed (often due to timeout)
    const isKilled = error.killed === true;
    const isTimeout = error.code === 'ETIMEDOUT' || error.message.includes('timeout') || isKilled;
    
    // Check if we got partial success from stdout
    let partialSuccess = false;
    let lastStep = '';
    if (error.stdout) {
      partialSuccess = error.stdout.includes('Head code injection added');
      // Extract last successful step from output
      const stepMatches = error.stdout.match(/STEP (\d+):[^\\n]+/g);
      if (stepMatches && stepMatches.length > 0) {
        lastStep = stepMatches[stepMatches.length - 1];
      }
    }
    
    res.status(500).json({
      success: false,
      error: isTimeout ? 
        `Website configuration timed out after 4 minutes. ${partialSuccess ? 'Partial configuration was applied (head code added).' : ''} ${lastStep ? `Last successful step: ${lastStep}` : ''} Please try running the configuration again to complete the process.` :
        error.message,
      details: error.stderr || null,
      partialSuccess,
      lastStep
    });
  }
});

/**
 * Helper function to convert base64 data URL to PNG file
 */
async function convertBase64ToPng(dataUrl) {
  try {
    // Extract base64 data from data URL
    const matches = dataUrl.match(/^data:image\/([a-zA-Z]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      console.error('[Website Config] Invalid base64 data URL format');
      return null;
    }
    
    const imageType = matches[1];
    const base64Data = matches[2];
    
    // Create temp file path
    const tempPath = path.join('/tmp', `logo-${Date.now()}.${imageType}`);
    
    // Convert base64 to buffer and write to file
    const buffer = Buffer.from(base64Data, 'base64');
    await fs.writeFile(tempPath, buffer);
    
    console.log('[Website Config] Base64 logo converted to:', tempPath);
    return tempPath;
    
  } catch (error) {
    console.error('[Website Config] Failed to convert base64 to PNG:', error);
    return null;
  }
}

/**
 * Helper function to clean up temporary files
 */
async function cleanupTempFiles(files) {
  if (!files || files.length === 0) return;

  for (const filePath of files) {
    try {
      await fs.unlink(filePath);
      console.log(`[Cleanup] ✓ Cleaned up temporary file: ${filePath}`);
    } catch (error) {
      console.warn(`[Cleanup] ⚠️ Could not clean up temporary file ${filePath}:`, error.message);
    }
  }
}

/**
 * Helper function to download logo if needed
 */
async function downloadLogoIfNeeded(logoUrl) {
  if (!logoUrl || logoUrl.startsWith('/')) {
    return logoUrl; // Local path or empty
  }
  
  const https = require('https');
  const http = require('http');
  const tempPath = path.join('/tmp', `logo-${Date.now()}.png`);
  
  return new Promise((resolve, reject) => {
    const protocol = logoUrl.startsWith('https') ? https : http;
    const file = require('fs').createWriteStream(tempPath);
    
    protocol.get(logoUrl, response => {
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        console.log('[Website Config] Logo downloaded to:', tempPath);
        resolve(tempPath);
      });
    }).on('error', err => {
      require('fs').unlink(tempPath, () => {});
      console.error('[Website Config] Failed to download logo:', err);
      // Don't reject, just return empty so script continues without logo
      resolve('');
    });
  });
}

/**
 * Resizes a base64 image to fit within max dimensions while maintaining aspect ratio
 * @param {string} base64Image - Base64 data URL
 * @param {number} maxWidth - Maximum width in pixels
 * @param {number} maxHeight - Maximum height in pixels
 * @returns {Promise<string|null>} - Path to resized temp file, or null on failure
 */
async function resizeBase64ImageToFile(base64Image, maxWidth, maxHeight) {
  try {
    const sharp = require('sharp');
    const fs = require('fs').promises;
    const os = require('os');

    // Extract base64 data
    const matches = base64Image.match(/^data:image\/([a-zA-Z]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      console.error('[Website Config] Invalid base64 image format for resizing');
      return null;
    }

    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, 'base64');

    // Resize with sharp - maintains aspect ratio, fits within bounds
    const resized = await sharp(buffer)
      .resize(maxWidth, maxHeight, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .png()
      .toBuffer();

    // Write to temp file
    const tempDir = os.tmpdir();
    const tempFile = path.join(tempDir, `header-logo-${Date.now()}.png`);
    await fs.writeFile(tempFile, resized);

    console.log(`[Website Config] Resized image to max ${maxWidth}x${maxHeight}: ${tempFile}`);
    return tempFile;
  } catch (error) {
    console.error('[Website Config] Failed to resize image:', error.message);
    return null;
  }
}

/**
 * Resizes an image file to fit within max dimensions while maintaining aspect ratio
 * @param {string} inputFilePath - Path to the image file
 * @param {number} maxWidth - Maximum width in pixels
 * @param {number} maxHeight - Maximum height in pixels
 * @returns {Promise<string|null>} - Path to resized temp file, or null on failure
 */
async function resizeFileToFile(inputFilePath, maxWidth, maxHeight) {
  try {
    const sharp = require('sharp');
    const fsPromises = require('fs').promises;
    const os = require('os');

    // Read the input file
    const inputBuffer = await fsPromises.readFile(inputFilePath);

    // Resize with sharp - maintains aspect ratio, fits within bounds
    const resized = await sharp(inputBuffer)
      .resize(maxWidth, maxHeight, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .png()
      .toBuffer();

    // Write to temp file
    const tempDir = os.tmpdir();
    const tempFile = path.join(tempDir, `nav-logo-${Date.now()}.png`);
    await fsPromises.writeFile(tempFile, resized);

    console.log(`[Website Config] Resized file to max ${maxWidth}x${maxHeight}: ${tempFile}`);
    return tempFile;
  } catch (error) {
    console.error('[Website Config] Failed to resize file:', error.message);
    return null;
  }
}

/**
 * Process header background image to ensure it's under 1MB
 * Resizes to max dimensions and iteratively reduces quality if needed
 * @param {Buffer|string} input - Image buffer or file path
 * @param {number} maxWidth - Maximum width (default 1920)
 * @param {number} maxHeight - Maximum height (default 1080)
 * @param {number} maxSizeBytes - Maximum file size in bytes (default 1MB)
 * @returns {Promise<string|null>} - Path to processed temp file
 */
async function processHeaderBackgroundImage(input, maxWidth = 1920, maxHeight = 1080, maxSizeBytes = 1048576) {
  const sharp = require('sharp');
  const fsPromises = require('fs').promises;
  const os = require('os');

  try {
    // Get input as buffer
    let inputBuffer;
    if (Buffer.isBuffer(input)) {
      inputBuffer = input;
    } else if (typeof input === 'string') {
      inputBuffer = await fsPromises.readFile(input);
    } else {
      console.error('[Website Config] Invalid input type for header background');
      return null;
    }

    // Initial resize
    let image = sharp(inputBuffer);
    const metadata = await image.metadata();

    // Resize if too large
    if (metadata.width > maxWidth || metadata.height > maxHeight) {
      image = image.resize(maxWidth, maxHeight, {
        fit: 'inside',
        withoutEnlargement: true
      });
    }

    // Start with quality 85, reduce until under size limit or quality 50
    let quality = 85;
    let outputBuffer;

    while (quality >= 50) {
      outputBuffer = await image
        .jpeg({ quality, progressive: true, mozjpeg: true })
        .toBuffer();

      if (outputBuffer.length <= maxSizeBytes) {
        break;
      }

      console.log(`[Website Config] Header BG size ${(outputBuffer.length / 1024 / 1024).toFixed(2)}MB > 1MB, reducing quality to ${quality - 10}`);
      quality -= 10;
    }

    // Write to temp file
    const tempDir = os.tmpdir();
    const tempFile = path.join(tempDir, `header-bg-${Date.now()}.jpg`);
    await fsPromises.writeFile(tempFile, outputBuffer);

    const finalSize = outputBuffer.length / 1024;
    console.log(`[Website Config] Header background processed: ${finalSize.toFixed(0)}KB (quality: ${quality})`);

    return tempFile;
  } catch (error) {
    console.error('[Website Config] Failed to process header background:', error.message);
    return null;
  }
}

/**
 * Colorizes a logo image with separate colors for dark and light pixels
 * Uses luminance to determine if a pixel is "dark" or "light" and maps accordingly
 * @param {Buffer} imageBuffer - The original image buffer
 * @param {string|null} darkColor - Hex color for dark pixels (null = keep original)
 * @param {string|null} lightColor - Hex color for light pixels (null = keep original)
 * @returns {Promise<Buffer>} - Colorized image buffer
 */
async function colorizeLogoToColor(imageBuffer, darkColor, lightColor) {
  const sharp = require('sharp');

  // Parse colors
  const parseHex = (hex) => {
    if (!hex) return null;
    const h = hex.replace('#', '');
    return {
      r: parseInt(h.substring(0, 2), 16),
      g: parseInt(h.substring(2, 4), 16),
      b: parseInt(h.substring(4, 6), 16)
    };
  };

  const dark = parseHex(darkColor);
  const light = parseHex(lightColor);

  // If neither color is set, return original
  if (!dark && !light) {
    return imageBuffer;
  }

  // Get raw pixel data at original resolution
  const { data, info } = await sharp(imageBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Luminance threshold (0.5 = middle gray)
  const THRESHOLD = 0.5;

  // Process pixels
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];

    if (a > 0) {
      // Calculate luminance (0 = black, 1 = white)
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

      if (luminance < THRESHOLD) {
        // Dark pixel
        if (dark) {
          data[i] = dark.r;
          data[i + 1] = dark.g;
          data[i + 2] = dark.b;
        }
      } else {
        // Light pixel
        if (light) {
          data[i] = light.r;
          data[i + 1] = light.g;
          data[i + 2] = light.b;
        }
      }
    }
  }

  // Convert back to PNG - use compression level 0 for no quality loss
  return sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 }
  })
    .png({ compressionLevel: 0 })
    .toBuffer();
}

/**
 * Configure Stripe payment settings
 * Uses setup-stripe-payments.js or setup-stripe-payments-no-link.js script to automate Stripe configuration
 */
router.post('/configure-payment', requireRegistrationStripePayments, async (req, res) => {
  const { restaurantId, includeConnectLink = false } = req.body; // Default to no-link version
  const organisationId = req.user?.organisationId;
  
  console.log('[Payment Config] Request received:', { restaurantId, organisationId, includeConnectLink });
  
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
    
    console.log('[Payment Config] Restaurant found:', restaurant.name);

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

    console.log('[Payment Config] Account found:', finalAccount.email);

    // Get organization-specific script configuration (admin URL, country)
    const scriptConfig = await OrganizationSettingsService.getScriptConfig(organisationId);
    console.log('[Payment Config] Script config loaded:', {
      adminUrl: scriptConfig.adminUrl,
      country: scriptConfig.country,
      adminHostname: scriptConfig.adminHostname
    });

    // Choose script based on includeConnectLink parameter
    const scriptName = includeConnectLink ? 'setup-stripe-payments.js' : 'setup-stripe-payments-no-link.js';
    const scriptPath = path.join(__dirname, '../../../scripts', scriptName);

    console.log('[Payment Config] Using script:', scriptName);

    // Build command with proper escaping
    const command = [
      'node',
      scriptPath,
      `--email="${finalAccount.email}"`,
      `--password="${finalAccount.user_password_hint}"`,
      `--name="${restaurant.name.replace(/"/g, '\\"')}"`,
      `--admin-url="${scriptConfig.adminUrl}"`,
      `--country="${scriptConfig.country}"`
    ].join(' ');
    
    console.log('[Payment Config] Executing payment configuration script...');
    
    const { stdout, stderr } = await execAsync(command, {
      env: { ...process.env, DEBUG_MODE: 'false' },
      timeout: 180000 // 3 minute timeout
    });
    
    console.log('[Payment Config] Script output:', stdout);
    if (stderr) {
      console.error('[Payment Config] Script stderr:', stderr);
    }
    
    // Only try to extract Stripe Connect URL if using the link version
    let stripeConnectUrl = null;
    if (includeConnectLink) {
      const urlMatch = stdout.match(/Final URL:\s*(https:\/\/[^\s]+)/);
      if (urlMatch) {
        stripeConnectUrl = urlMatch[1];
        console.log('[Payment Config] Extracted Stripe Connect URL:', stripeConnectUrl);
        
        // Save Stripe Connect URL to database
        if (stripeConnectUrl.includes('stripe.com')) {
          const { error: updateError } = await supabase
            .from('restaurants')
            .update({ stripe_connect_url: stripeConnectUrl })
            .eq('id', restaurantId)
            .eq('organisation_id', organisationId);
          
          if (updateError) {
            console.error('[Payment Config] Failed to save Stripe Connect URL:', updateError);
          } else {
            console.log('[Payment Config] ✓ Saved Stripe Connect URL to database');
          }
        }
      }
    }
    
    // Check for success indicators
    const success = stdout.includes('successfully configured') ||
                   stdout.includes('✅') ||
                   stdout.includes('Stripe payment method successfully');

    console.log('[Payment Config] Configuration result:', success ? 'Success' : 'Partial/Failed');

    // Track usage if successful
    if (success) {
      UsageTrackingService.trackRegistrationStep(organisationId, 'stripe_payments', {
        restaurant_id: restaurantId
      }).catch(err => console.error('[UsageTracking] Failed to track stripe payments:', err));
    }

    res.json({
      success,
      message: success ? 'Payment settings configured successfully' : 'Configuration completed with warnings',
      stripeConnectUrl,
      includeConnectLink,
      output: stdout,
      error: stderr || null
    });
    
  } catch (error) {
    console.error('[Payment Config] Error:', error);
    
    const isTimeout = error.code === 'ETIMEDOUT' || error.message.includes('timeout');
    
    res.status(500).json({
      success: false,
      error: isTimeout ? 
        'Payment configuration timed out. The process may be taking longer than expected. Please try again.' :
        error.message,
      details: error.stderr || null
    });
  }
});

/**
 * Configure Services settings
 * Uses setup-services-settings.js script to automate Services configuration
 */
router.post('/configure-services', requireRegistrationServicesConfig, async (req, res) => {
  const { restaurantId } = req.body;
  const organisationId = req.user?.organisationId;
  
  console.log('[Services Config] Request received:', { restaurantId, organisationId });
  
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
    
    console.log('[Services Config] Restaurant found:', restaurant.name);

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

    console.log('[Services Config] Account found:', finalAccount.email);

    // Get organization-specific script configuration (admin URL)
    const scriptConfig = await OrganizationSettingsService.getScriptConfig(organisationId);
    console.log('[Services Config] Script config loaded:', {
      adminUrl: scriptConfig.adminUrl,
      adminHostname: scriptConfig.adminHostname
    });

    // Execute setup-services-settings.js script
    const scriptPath = path.join(__dirname, '../../../scripts/setup-services-settings.js');

    // Build command with proper escaping
    const command = [
      'node',
      scriptPath,
      `--email="${finalAccount.email}"`,
      `--password="${finalAccount.user_password_hint}"`,
      `--name="${restaurant.name.replace(/"/g, '\\"')}"`,
      `--admin-url="${scriptConfig.adminUrl}"`
    ].join(' ');
    
    console.log('[Services Config] Executing services configuration script...');
    
    const { stdout, stderr } = await execAsync(command, {
      env: { ...process.env, DEBUG_MODE: 'false' },
      timeout: 180000 // 3 minute timeout
    });
    
    console.log('[Services Config] Script output:', stdout);
    if (stderr) {
      console.error('[Services Config] Script stderr:', stderr);
    }
    
    // Check for success indicators
    const success = stdout.includes('Successfully') || 
                   stdout.includes('✅') ||
                   stdout.includes('Services configured') ||
                   stdout.includes('Configuration saved');
    
    console.log('[Services Config] Configuration result:', success ? 'Success' : 'Partial/Failed');

    // Track usage
    if (success) {
      UsageTrackingService.trackRegistrationStep(organisationId, 'services_config', {
        restaurant_id: restaurantId
      }).catch(err => console.error('[UsageTracking] Failed to track services config:', err));
    }

    res.json({
      success,
      message: success ? 'Services settings configured successfully' : 'Configuration completed with warnings',
      output: stdout,
      error: stderr || null
    });

  } catch (error) {
    console.error('[Services Config] Error:', error);
    
    const isTimeout = error.code === 'ETIMEDOUT' || error.message.includes('timeout');
    
    res.status(500).json({
      success: false,
      error: isTimeout ? 
        'Services configuration timed out. The process may be taking longer than expected. Please try again.' :
        error.message,
      details: error.stderr || null
    });
  }
});

/**
 * Add Item Tags to menu items
 * Uses add-item-tags.js script to automate tag configuration on Pumpd admin portal
 *
 * Enhanced to support applying tags to menu items when menuId is provided.
 * Backwards compatible - if no menuId provided, just creates preset tags.
 */
router.post('/add-item-tags', requireRegistrationItemTags, async (req, res) => {
  const { restaurantId, menuId } = req.body;
  const organisationId = req.user?.organisationId;

  console.log('[Item Tags] Request received:', { restaurantId, menuId, organisationId });

  if (!organisationId) {
    return res.status(401).json({
      success: false,
      error: 'Organisation context required'
    });
  }

  // Temp file path for payload
  let payloadPath = null;

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

    // Get organization-specific script configuration (admin URL)
    const scriptConfig = await OrganizationSettingsService.getScriptConfig(organisationId);
    console.log('[Item Tags] Script config loaded:', {
      adminUrl: scriptConfig.adminUrl,
      adminHostname: scriptConfig.adminHostname
    });

    // Define preset tags with colors
    const PRESET_TAGS = [
      { name: 'Popular', color: '#b400fa' },
      { name: 'New', color: '#3f92ff' },
      { name: 'Deal', color: '#4fc060' },
      { name: 'Vegan', color: '#36AB36' },
      { name: 'Vegetarian', color: '#32CD32' },
      { name: 'Gluten Free', color: '#FF8C00' },
      { name: 'Dairy Free', color: '#4682B4' },
      { name: 'Nut Free', color: '#DEB887' },
      { name: 'Halal', color: '#8B7355' },
      { name: 'Spicy', color: '#FF3333' }
    ];

    // Build tag-to-menuItems mapping if menuId is provided
    let itemTagsArray = PRESET_TAGS.map(t => ({ ...t, menuItemNames: [] }));

    if (menuId) {
      console.log('[Item Tags] Fetching menu items with tags for menu:', menuId);

      // Fetch menu items that have tags
      const { data: menuItems, error: menuItemsError } = await supabase
        .from('menu_items')
        .select('id, name, tags')
        .eq('menu_id', menuId)
        .not('tags', 'is', null);

      if (menuItemsError) {
        console.error('[Item Tags] Error fetching menu items:', menuItemsError);
      } else if (menuItems && menuItems.length > 0) {
        console.log(`[Item Tags] Found ${menuItems.length} menu items with tags`);

        // Build tag-to-items mapping with case-insensitive matching
        const tagToMenuItems = new Map();
        const normalizeTag = (tag) => tag.trim().toLowerCase();

        // Initialize all preset tags in the map
        PRESET_TAGS.forEach(tag => {
          tagToMenuItems.set(normalizeTag(tag.name), []);
        });

        // Map common tag variants to canonical names
        const tagVariants = {
          'most liked': 'popular',
          'favourite': 'popular',
          'favorites': 'popular',
          'hot': 'spicy',
          'contains nuts': 'nut free',
          'gf': 'gluten free'
        };

        // Process each menu item's tags
        menuItems.forEach(item => {
          if (Array.isArray(item.tags)) {
            item.tags.forEach(tag => {
              let normalizedTag = normalizeTag(tag);

              // Check for variant mappings
              if (tagVariants[normalizedTag]) {
                normalizedTag = tagVariants[normalizedTag];
              }

              // Only include tags that match our preset tags
              if (tagToMenuItems.has(normalizedTag)) {
                tagToMenuItems.get(normalizedTag).push(item.name);
              }
            });
          }
        });

        // Build the final itemTags array with menuItemNames
        itemTagsArray = PRESET_TAGS.map(presetTag => {
          const normalizedName = normalizeTag(presetTag.name);
          const menuItemNames = tagToMenuItems.get(normalizedName) || [];
          return {
            name: presetTag.name,
            color: presetTag.color,
            menuItemNames
          };
        });

        // Log summary
        const tagsWithItems = itemTagsArray.filter(t => t.menuItemNames.length > 0);
        console.log(`[Item Tags] ${tagsWithItems.length} tags have menu items to apply:`);
        tagsWithItems.forEach(t => {
          console.log(`  - ${t.name}: ${t.menuItemNames.length} items`);
        });
      } else {
        console.log('[Item Tags] No menu items with tags found, creating tags only');
      }
    } else {
      console.log('[Item Tags] No menuId provided, creating tags only (legacy mode)');
    }

    // Create JSON payload for script
    const scriptPayload = {
      email: finalAccount.email,
      password: finalAccount.user_password_hint,
      restaurantName: restaurant.name,
      adminUrl: scriptConfig.adminUrl,
      itemTags: itemTagsArray
    };

    // Execute add-item-tags.js script
    const scriptPath = path.join(__dirname, '../../../scripts/restaurant-registration/add-item-tags.js');

    // Write payload to temp file to avoid command line length limits
    payloadPath = path.join(__dirname, `../../../scripts/restaurant-registration/temp-item-tags-payload-${Date.now()}.json`);
    await require('fs').promises.writeFile(payloadPath, JSON.stringify(scriptPayload));

    const command = `node "${scriptPath}" --payload="${payloadPath}"`;

    console.log('[Item Tags] Executing item tags configuration script...');

    const { stdout, stderr } = await execAsync(command, {
      env: { ...process.env, DEBUG_MODE: 'false' },
      timeout: 3600000 // 60 minute timeout (increased for large menus with many items)
    });

    // Clean up temp file
    try {
      await require('fs').promises.unlink(payloadPath);
      payloadPath = null;
    } catch (e) {
      console.log('[Item Tags] Could not delete temp file:', e.message);
    }

    console.log('[Item Tags] Script output:', stdout);
    if (stderr) {
      console.error('[Item Tags] Script stderr:', stderr);
    }

    // Parse summary from output if available
    let summary = { total: itemTagsArray.length, created: 0, failed: 0, itemsAssigned: 0 };
    const summaryMatch = stdout.match(/Successfully created: (\d+)\/(\d+)/);
    if (summaryMatch) {
      summary.created = parseInt(summaryMatch[1]);
      summary.total = parseInt(summaryMatch[2]);
      summary.failed = summary.total - summary.created;
    }
    const itemsMatch = stdout.match(/Menu items assigned: (\d+)/);
    if (itemsMatch) {
      summary.itemsAssigned = parseInt(itemsMatch[1]);
    }

    // Check for success indicators
    const success = stdout.includes('Successfully') ||
                   stdout.includes('completed') ||
                   stdout.includes('Item tags configured') ||
                   stdout.includes('Tags added') ||
                   summary.created > 0;

    console.log('[Item Tags] Configuration result:', success ? 'Success' : 'Partial/Failed');

    // Track usage
    if (success) {
      UsageTrackingService.trackRegistrationStep(organisationId, 'item_tags', {
        restaurant_id: restaurantId,
        menu_id: menuId || null,
        tags_created: summary.created,
        items_assigned: summary.itemsAssigned
      }).catch(err => console.error('[UsageTracking] Failed to track item tags:', err));
    }

    res.json({
      success,
      message: success ? 'Item tags configured successfully' : 'Configuration completed with warnings',
      summary,
      output: stdout,
      error: stderr || null
    });

  } catch (error) {
    console.error('[Item Tags] Error:', error);

    // Clean up temp file on error
    if (payloadPath) {
      try {
        await require('fs').promises.unlink(payloadPath);
      } catch (e) {
        // Ignore cleanup errors
      }
    }

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

/**
 * Add Option Sets to restaurant's Pumpd menu
 * Fetches option sets from database and uses add-option-sets.js script
 */
router.post('/add-option-sets', requireRegistrationOptionSets, async (req, res) => {
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

    // Fetch menu items for the selected menu (including names for mapping)
    const { data: menuItems, error: menuItemsError } = await supabase
      .from('menu_items')
      .select('id, name')
      .eq('menu_id', menuId);

    if (menuItemsError) {
      throw new Error('Failed to fetch menu items: ' + menuItemsError.message);
    }

    const menuItemIds = menuItems.map(item => item.id);

    // Create a map of menu item IDs to names for later lookup
    const menuItemIdToName = new Map();
    menuItems.forEach(item => {
      menuItemIdToName.set(item.id, item.name);
    });

    if (menuItemIds.length === 0) {
      return res.json({
        success: true,
        message: 'No menu items found for this menu',
        summary: { total: 0, created: 0, failed: 0 }
      });
    }

    // Fetch option sets for the menu items
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
      .in('menu_item_id', menuItemIds)
      .eq('organisation_id', organisationId);

    if (optionSetsError) {
      throw new Error('Failed to fetch option sets: ' + optionSetsError.message);
    }

    // Deduplicate option sets and structure for script
    const uniqueOptionSets = new Map();
    const menuItemMappings = {}; // Maps option set ID to array of menu item IDs

    menuItemOptionSets.forEach(item => {
      if (item.option_set) {
        const optionSetId = item.option_set.id;

        if (!uniqueOptionSets.has(optionSetId)) {
          // Sort option items by display_order
          const sortedItems = (item.option_set.option_set_items || [])
            .sort((a, b) => (a.display_order || 0) - (b.display_order || 0));

          uniqueOptionSets.set(optionSetId, {
            id: optionSetId, // Keep ID for mapping later
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

    // Convert to array and add menuItemNames to each option set
    const optionSetsArray = Array.from(uniqueOptionSets.values()).map(optionSet => {
      // Get menu item IDs for this option set and convert to names
      const itemIds = menuItemMappings[optionSet.id] || [];
      const menuItemNames = itemIds
        .map(id => menuItemIdToName.get(id))
        .filter(name => name); // Filter out any undefined names

      // Remove the temporary ID and add menuItemNames
      const { id, ...optionSetWithoutId } = optionSet;
      return {
        ...optionSetWithoutId,
        menuItemNames
      };
    });

    if (optionSetsArray.length === 0) {
      return res.json({
        success: true,
        message: 'No option sets found for this menu',
        summary: { total: 0, created: 0, failed: 0 }
      });
    }

    console.log(`[Option Sets] Found ${optionSetsArray.length} unique option sets`);

    // Get organization-specific script configuration (admin URL)
    const scriptConfig = await OrganizationSettingsService.getScriptConfig(organisationId);
    console.log('[Option Sets] Script config loaded:', {
      adminUrl: scriptConfig.adminUrl,
      adminHostname: scriptConfig.adminHostname
    });

    // Create JSON payload for script
    const scriptPayload = {
      email: finalAccount.email,
      password: finalAccount.user_password_hint,
      restaurantName: restaurant.name,
      adminUrl: scriptConfig.adminUrl,
      optionSets: optionSetsArray,
      menuItemMappings: menuItemMappings
    };

    // Execute add-option-sets.js script
    const scriptPath = path.join(__dirname, '../../../scripts/restaurant-registration/add-option-sets.js');

    // Pass JSON payload via file to avoid command line length limits
    const payloadPath = path.join(__dirname, `../../../scripts/restaurant-registration/temp-option-sets-payload-${Date.now()}.json`);
    await require('fs').promises.writeFile(payloadPath, JSON.stringify(scriptPayload));

    const command = `node "${scriptPath}" --payload="${payloadPath}"`;

    console.log('[Option Sets] Executing option sets configuration script...');

    const { stdout, stderr } = await execAsync(command, {
      env: { ...process.env, DEBUG_MODE: 'false' },
      timeout: 3600000 // 60 minute timeout (tripled for large menus with many option sets)
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

    // Track usage
    if (success) {
      UsageTrackingService.trackRegistrationStep(organisationId, 'option_sets', {
        restaurant_id: restaurantId,
        menu_id: menuId,
        option_sets_count: summary.created
      }).catch(err => console.error('[UsageTracking] Failed to track option sets:', err));
    }

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

/**
 * Create onboarding user in Super Admin system
 * Creates a new user account in manage.pumpd.co.nz for restaurant onboarding
 */
router.post('/create-onboarding-user', requireRegistrationOnboardingUser, async (req, res) => {
  const {
    userName,
    userEmail,
    userPassword,
    restaurantId
  } = req.body;
  
  const organisationId = req.user?.organisationId;
  
  if (!organisationId) {
    return res.status(401).json({ 
      success: false, 
      error: 'Organisation context required' 
    });
  }
  
  // Validate required fields
  if (!userName || !userEmail) {
    return res.status(400).json({
      success: false,
      error: 'User name and email are required'
    });
  }
  
  try {
    const { supabase } = require('../services/database-service');
    const onboardingService = require('../services/onboarding-service');
    
    // Get restaurant details for password generation if needed
    let generatedPassword = userPassword;
    
    if (!generatedPassword && restaurantId) {
      const { data: restaurant } = await supabase
        .from('restaurants')
        .select('name')
        .eq('id', restaurantId)
        .eq('organisation_id', organisationId)
        .single();
      
      if (restaurant) {
        generatedPassword = onboardingService.generateDefaultPassword(restaurant.name);
      }
    }
    
    if (!generatedPassword) {
      generatedPassword = 'TempPassword789!'; // Fallback
    }
    
    // Check if user already exists in onboarding system
    const existingUser = await onboardingService.checkUserExists(userEmail);
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'User already exists in onboarding system'
      });
    }
    
    // Execute the create-onboarding-user.js script
    const scriptPath = path.join(__dirname, '../../../scripts/create-onboarding-user.js');
    
    // Note: The script expects --name, --email, --password for the NEW USER
    // The admin credentials come from environment variables
    const command = [
      'node',
      scriptPath,
      `--name="${userName.replace(/"/g, '\\"')}"`,
      `--email="${userEmail}"`,
      `--password="${generatedPassword}"`
    ].join(' ');
    
    console.log('[Onboarding] Creating user:', userEmail);
    
    const { stdout, stderr } = await execAsync(command, {
      env: { ...process.env, DEBUG_MODE: 'false' },
      timeout: 120000 // 2 minute timeout
    });
    
    console.log('[Onboarding] Script output:', stdout);
    if (stderr) {
      console.error('[Onboarding] Script stderr:', stderr);
    }
    
    // Check for success indicators
    const success = stdout.includes('✅') ||
                   stdout.includes('User created successfully') ||
                   stdout.includes('Successfully created');
    
    if (success) {
      console.log('[Onboarding] User created successfully');

      // Log the creation if restaurant ID provided
      if (restaurantId) {
        await supabase
          .from('registration_logs')
          .insert({
            organisation_id: organisationId,
            restaurant_id: restaurantId,
            action: 'onboarding_user_creation',
            status: 'success',
            response_data: {
              userName,
              userEmail,
              passwordGenerated: !userPassword
            },
            initiated_by: req.user?.email || 'system'
          });
      }

      // Track usage
      UsageTrackingService.trackRegistrationStep(organisationId, 'onboarding_user', {
        restaurant_id: restaurantId,
        user_email: userEmail
      }).catch(err => console.error('[UsageTracking] Failed to track onboarding user:', err));

      res.json({
        success: true,
        userName,
        userEmail,
        passwordGenerated: !userPassword,
        message: 'Onboarding user created successfully'
      });
    } else {
      throw new Error('User creation failed - check Super Admin access');
    }
    
  } catch (error) {
    console.error('[Onboarding] Create user error:', error);
    
    // Log the failure if restaurant ID provided
    const { supabase } = require('../services/database-service');
    if (restaurantId) {
      await supabase
        .from('registration_logs')
        .insert({
          organisation_id: organisationId,
          restaurant_id: restaurantId,
          action: 'onboarding_user_creation',
          status: 'failed',
          error_message: error.message,
          initiated_by: req.user?.email || 'system'
        });
    }
    
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * Update onboarding record with restaurant data
 * Syncs restaurant information to the onboarding database
 * Feature-flagged: Only available to organizations with onboardingSync enabled
 */
router.post('/update-onboarding-record', requireRegistrationOnboardingSync, async (req, res) => {
  const {
    userEmail,
    restaurantId,
    contactPerson,
    updates = {},
    additionalData = {}
  } = req.body;

  const organisationId = req.user?.organisationId;

  if (!organisationId) {
    return res.status(401).json({
      success: false,
      error: 'Organisation context required'
    });
  }

  if (!userEmail || !restaurantId) {
    return res.status(400).json({
      success: false,
      error: 'User email and restaurant ID are required'
    });
  }

  try {
    const { supabase } = require('../services/database-service');
    const onboardingService = require('../services/onboarding-service');

    // If stripeConnectUrl is provided, save it to the restaurant record first
    if (updates.stripeConnectUrl !== undefined) {
      const { error: stripeUpdateError } = await supabase
        .from('restaurants')
        .update({ stripe_connect_url: updates.stripeConnectUrl })
        .eq('id', restaurantId)
        .eq('organisation_id', organisationId);

      if (stripeUpdateError) {
        console.error('[Onboarding] Failed to save Stripe Connect URL:', stripeUpdateError);
      } else {
        console.log('[Onboarding] ✓ Saved Stripe Connect URL to restaurant record');
      }
    }

    // Get restaurant details including stripe_connect_url AND contact fields
    const { data: restaurant, error: restaurantError } = await supabase
      .from('restaurants')
      .select(`
        name,
        slug,
        address,
        phone,
        email,
        opening_hours,
        primary_color,
        secondary_color,
        facebook_url,
        instagram_url,
        hosted_logo_url,
        stripe_connect_url,
        cuisine,
        metadata,
        contact_name,
        contact_phone,
        organisation_name,
        nzbn,
        company_name,
        full_legal_name,
        gst_number
      `)
      .eq('id', restaurantId)
      .eq('organisation_id', organisationId)
      .single();
    
    if (restaurantError || !restaurant) {
      throw new Error('Restaurant not found');
    }

    // Get the pumpd_restaurant_id from the pumpd_restaurants table
    const { data: pumpdRestaurant, error: pumpdRestError } = await supabase
      .from('pumpd_restaurants')
      .select('pumpd_restaurant_id')
      .eq('restaurant_id', restaurantId)
      .eq('organisation_id', organisationId)
      .single();

    if (pumpdRestError) {
      console.warn('[Onboarding] No pumpd_restaurant record found:', pumpdRestError.message);
    }

    console.log('[Onboarding] Getting onboarding record for:', userEmail);
    
    // Get onboarding record
    const onboarding = await onboardingService.getOnboardingIdByEmail(userEmail);
    
    if (!onboarding) {
      return res.status(404).json({
        success: false,
        error: 'Onboarding record not found. Please ensure user was created first.'
      });
    }
    
    console.log('[Onboarding] Found record:', onboarding.onboarding_id);
    
    // Format operating hours
    const formattedHours = onboardingService.formatOperatingHours(restaurant.opening_hours);
    
    // Prepare update data with proper field mappings
    // IMPORTANT: Only include fields that have actual values to avoid overwriting existing data
    const updateData = {};

    // Core fields - always include if we have them
    if (restaurant.name) {
      updateData.restaurant_name = restaurant.name;
      updateData.trading_name = restaurant.name;
    }
    if (restaurant.email || userEmail) {
      updateData.email = restaurant.email || userEmail;
    }

    // Optional fields - only include if we have values (don't send null/empty)
    if (restaurant.organisation_name) {
      updateData.organisation_name = restaurant.organisation_name;
    }
    if (pumpdRestaurant?.pumpd_restaurant_id) {
      updateData.restaurant_id = pumpdRestaurant.pumpd_restaurant_id;
    }
    if (restaurant.address || additionalData.address) {
      updateData.address = restaurant.address || additionalData.address;
    }
    if (restaurant.phone || additionalData.phone) {
      updateData.phone = restaurant.phone || additionalData.phone;
    }

    // Contact fields
    const contactPersonValue = updates.contactPerson || restaurant.contact_name || contactPerson || additionalData.contactPerson;
    if (contactPersonValue) {
      updateData.contact_person = contactPersonValue;
    }
    if (restaurant.contact_phone) {
      updateData.director_mobile_number = restaurant.contact_phone;
    }
    if (restaurant.full_legal_name) {
      updateData.director_name = restaurant.full_legal_name;
    }

    // Operating hours
    if (formattedHours || additionalData.operatingHours) {
      updateData.venue_operating_hours = formattedHours || additionalData.operatingHours;
    }

    // Branding
    if (restaurant.primary_color) {
      updateData.primary_color = restaurant.primary_color;
    }
    if (restaurant.secondary_color) {
      updateData.secondary_color = restaurant.secondary_color;
    }

    // Social/URLs
    if (restaurant.facebook_url) {
      updateData.facebook_url = restaurant.facebook_url;
    }
    if (restaurant.instagram_url) {
      updateData.instagram_url = restaurant.instagram_url;
    }
    if (restaurant.stripe_connect_url) {
      updateData.stripe_connect_link = restaurant.stripe_connect_url;
    }
    if (restaurant.hosted_logo_url) {
      updateData.logo_url = restaurant.hosted_logo_url;
    }

    // Companies Office fields - only include if we have values
    if (restaurant.nzbn) {
      updateData.nzbn = restaurant.nzbn;
    }
    if (restaurant.company_name) {
      updateData.company_name = restaurant.company_name;
    }
    if (restaurant.gst_number) {
      updateData.gst_number = restaurant.gst_number;
    }

    // Merge any additional data (but filter out null/empty values)
    if (additionalData) {
      for (const [key, value] of Object.entries(additionalData)) {
        if (value !== null && value !== undefined && value !== '') {
          updateData[key] = value;
        }
      }
    }

    console.log('[Onboarding] Fields being updated:', Object.keys(updateData));

    // Update record
    const updated = await onboardingService.updateOnboardingRecord(
      onboarding.onboarding_id, 
      updateData
    );
    
    console.log('[Onboarding] Record updated successfully');
    
    // Log the update
    await supabase
      .from('registration_logs')
      .insert({
        organisation_id: organisationId,
        restaurant_id: restaurantId,
        action: 'onboarding_record_update',
        status: 'success',
        response_data: {
          onboardingId: onboarding.onboarding_id,
          fieldsUpdated: Object.keys(updateData)
        },
        initiated_by: req.user?.email || 'system'
      });

    // Track usage for onboarding sync
    UsageTrackingService.trackRegistrationStep(organisationId, 'onboarding_sync', {
      restaurant_id: restaurantId,
      user_email: userEmail,
      fields_updated: Object.keys(updateData).length
    }).catch(err => console.error('[UsageTracking] Failed to track onboarding sync:', err));

    res.json({
      success: true,
      onboardingId: onboarding.onboarding_id,
      message: 'Onboarding record updated successfully',
      updatedFields: Object.keys(updateData).length
    });

  } catch (error) {
    console.error('[Onboarding] Update record error:', error);
    
    // Log the failure
    const { supabase } = require('../services/database-service');
    await supabase
      .from('registration_logs')
      .insert({
        organisation_id: organisationId,
        restaurant_id: restaurantId,
        action: 'onboarding_record_update',
        status: 'failed',
        error_message: error.message,
        initiated_by: req.user?.email || 'system'
      });
    
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * Setup System Settings endpoint
 * Configures GST, pickup times, and other system settings using user credentials
 */
router.post('/setup-system-settings', requireRegistrationFinalizeSetup, async (req, res) => {
  const { restaurantId, receiptLogoVersion } = req.body;
  const organisationId = req.user?.organisationId;

  console.log('[System Settings] Request received:', {
    restaurantId,
    receiptLogoVersion,
    organisationId,
    hasOrgId: !!organisationId
  });

  if (!restaurantId) {
    return res.status(400).json({ success: false, error: 'Restaurant ID required' });
  }

  if (!organisationId) {
    console.error('[System Settings] No organisation ID in request');
    return res.status(401).json({
      success: false,
      error: 'Organisation context required'
    });
  }

  try {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    const path = require('path');
    const onboardingService = require('../services/onboarding-service');
    const { supabase } = require('../services/database-service');

    // Get restaurant details
    console.log('[System Settings] Querying restaurant:', {
      id: restaurantId,
      organisation_id: organisationId
    });

    const { data: restaurant, error: restaurantError } = await supabase
      .from('restaurants')
      .select('*')
      .eq('id', restaurantId)
      .eq('organisation_id', organisationId)
      .single();

    if (restaurantError || !restaurant) {
      console.error('[System Settings] Restaurant query error:', restaurantError);
      console.error('[System Settings] Query params were:', {
        id: restaurantId,
        organisation_id: organisationId
      });
      throw new Error('Restaurant not found');
    }

    // Get user account through pumpd_restaurants relationship
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

    if (!finalAccount || !finalAccount.user_password_hint) {
      throw new Error('User account credentials not found. Please create a Pumpd account first.');
    }

    // Get GST number and Google OAuth from onboarding database
    let gstNumber = null;
    let googleOAuthClientId = null;
    try {
      const onboardingRecord = await onboardingService.getOnboardingIdByEmail(finalAccount.email);
      console.log('[System Settings] Onboarding record retrieved for:', finalAccount.email);

      if (onboardingRecord) {
        // Log what we received
        console.log('[System Settings] Onboarding record has fields:', {
          has_gst_number: !!onboardingRecord.gst_number,
          has_google_oauth_client_id: !!onboardingRecord.google_oauth_client_id,
          fields: Object.keys(onboardingRecord).join(', ')
        });

        if (onboardingRecord.gst_number) {
          gstNumber = onboardingRecord.gst_number;
          console.log('[System Settings] Found GST number from onboarding:', gstNumber);
        } else {
          console.log('[System Settings] No GST number in onboarding record');
        }

        if (onboardingRecord.google_oauth_client_id) {
          googleOAuthClientId = onboardingRecord.google_oauth_client_id;
          console.log('[System Settings] Found Google OAuth Client ID from onboarding:', googleOAuthClientId);
        } else {
          console.log('[System Settings] No Google OAuth Client ID in onboarding record');
        }
      } else {
        console.log('[System Settings] No onboarding record found for:', finalAccount.email);
      }
    } catch (error) {
      console.log('[System Settings] Could not retrieve onboarding data:', error.message);
    }

    // Process receipt logo
    let receiptLogoPath = null;
    const tempFiles = []; // Track temp files for cleanup

    if (receiptLogoVersion && restaurant[receiptLogoVersion]) {
      const logoUrl = restaurant[receiptLogoVersion];

      // Check if it's a base64 image
      if (logoUrl.startsWith('data:image')) {
        // Convert base64 to PNG file
        console.log('[System Settings] Converting base64 receipt logo to PNG...');
        const convertedPath = await convertBase64ToPng(logoUrl);
        if (convertedPath) {
          receiptLogoPath = convertedPath;
          tempFiles.push(convertedPath); // Track for cleanup
          console.log('[System Settings] Receipt logo converted to PNG:', convertedPath);
        } else {
          console.log('[System Settings] Failed to convert receipt logo, skipping...');
        }
      } else if (logoUrl.startsWith('http')) {
        // For HTTP URLs, download the logo
        console.log('[System Settings] Downloading receipt logo from URL...');
        const downloadedPath = await downloadLogoIfNeeded(logoUrl);
        if (downloadedPath) {
          receiptLogoPath = downloadedPath;
          tempFiles.push(downloadedPath); // Track for cleanup
          console.log('[System Settings] Receipt logo downloaded to:', downloadedPath);
        }
      } else {
        // For local paths, pass as-is
        receiptLogoPath = logoUrl;
        console.log('[System Settings] Using local receipt logo path');
      }
    }

    // Get organization-specific script configuration (admin URL, country)
    const scriptConfig = await OrganizationSettingsService.getScriptConfig(organisationId);
    console.log('[System Settings] Script config loaded:', {
      adminUrl: scriptConfig.adminUrl,
      country: scriptConfig.country,
      adminHostname: scriptConfig.adminHostname
    });

    // Prepare script arguments
    const scriptPath = path.resolve(__dirname, '../../../scripts/setup-system-settings-user.js');
    const args = [
      'node',
      scriptPath,
      `--email="${finalAccount.email}"`,
      `--password="${finalAccount.user_password_hint}"`,
      `--name="${restaurant.name.replace(/"/g, '\\"')}"`,
      `--admin-url="${scriptConfig.adminUrl}"`,
      `--country="${scriptConfig.country}"`,
      gstNumber ? `--gst="${gstNumber}"` : '',
      googleOAuthClientId ? `--google-oauth="${googleOAuthClientId}"` : '',
      receiptLogoPath ? `--receiptLogo="${receiptLogoPath}"` : ''
    ].filter(Boolean);

    const command = args.join(' ');

    console.log('[System Settings] Executing script for restaurant:', restaurant.name);
    console.log('[System Settings] Script arguments:', {
      email: finalAccount.email,
      hasPassword: !!finalAccount.user_password_hint,
      restaurantName: restaurant.name,
      gstNumber: gstNumber || 'not provided',
      googleOAuthClientId: googleOAuthClientId || 'not provided',
      receiptLogoPath: receiptLogoPath || 'not provided'
    });

    // Execute the script
    const { stdout, stderr } = await execAsync(command, {
      env: { ...process.env, DEBUG_MODE: 'false' },
      timeout: 180000 // 3 minute timeout
    });

    console.log('[System Settings] Script completed');

    // Parse script output to extract webhook secret and other data
    let scriptResult = null;
    let webhookSecret = null;

    try {
      const resultMatch = stdout.match(/### SCRIPT_RESULT_START ###\s*(.*?)\s*### SCRIPT_RESULT_END ###/s);
      if (resultMatch && resultMatch[1]) {
        scriptResult = JSON.parse(resultMatch[1]);
        webhookSecret = scriptResult.webhookSecret;
        console.log('[System Settings] Extracted webhook secret from script output');
      }
    } catch (parseError) {
      console.log('[System Settings] Could not parse script result:', parseError.message);
    }

    // Clean up temporary files
    await cleanupTempFiles(tempFiles);

    // Update ONBOARDING database with webhook secret
    if (webhookSecret) {
      try {
        const onboardingRecord = await onboardingService.getOnboardingIdByEmail(finalAccount.email);
        if (onboardingRecord && onboardingRecord.onboarding_id) {
          await onboardingService.updateOnboardingRecord(onboardingRecord.onboarding_id, {
            webhook_secret: webhookSecret
          });
          console.log('[System Settings] Updated onboarding database with webhook secret');
        }
      } catch (onboardingError) {
        console.error('[System Settings] Could not update onboarding database:', onboardingError.message);
      }
    }

    // Update MAIN database (pumpd_restaurants) with completion status
    try {
      // Get existing setup_completion to merge with new data
      const { data: existingRestaurant } = await supabase
        .from('pumpd_restaurants')
        .select('setup_completion')
        .eq('restaurant_id', restaurantId)
        .eq('organisation_id', organisationId)
        .single();

      const existingCompletion = existingRestaurant?.setup_completion || {};

      const updateData = {
        webhook_secret: webhookSecret,
        system_settings_completed_at: new Date().toISOString(),
        setup_completion: {
          ...existingCompletion,
          system_settings: true,
          system_settings_date: new Date().toISOString(),
          system_settings_data: {
            hasGst: !!gstNumber,
            hasGoogleOAuth: !!googleOAuthClientId,
            hasReceiptLogo: !!receiptLogoPath,
            webhookConfigured: !!webhookSecret
          }
        },
        updated_at: new Date().toISOString()
      };

      await supabase
        .from('pumpd_restaurants')
        .update(updateData)
        .eq('restaurant_id', restaurantId)
        .eq('organisation_id', organisationId);

      console.log('[System Settings] Updated main database with completion status');
    } catch (updateError) {
      console.error('[System Settings] Could not update main database:', updateError.message);
    }

    // Update restaurant onboarding_status to 'completed'
    try {
      await supabase
        .from('restaurants')
        .update({
          onboarding_status: 'completed',
          onboarding_completed_at: new Date().toISOString()
        })
        .eq('id', restaurantId)
        .eq('organisation_id', organisationId);
      console.log('[System Settings] ✓ Updated onboarding_status to completed');
    } catch (statusError) {
      console.error('[System Settings] Could not update onboarding_status:', statusError.message);
    }

    // Log success
    await supabase
      .from('registration_logs')
      .insert({
        organisation_id: organisationId,
        restaurant_id: restaurantId,
        action: 'system_settings_setup',
        status: 'completed',
        metadata: {
          gstNumber: !!gstNumber,
          googleOAuthClientId: !!googleOAuthClientId,
          receiptLogo: !!receiptLogoPath,
          webhookSecret: webhookSecret ? '***' + webhookSecret.slice(-4) : null
        },
        initiated_by: req.user?.email || 'system'
      });

    // Track usage
    UsageTrackingService.trackRegistrationStep(organisationId, 'finalize_setup', {
      restaurant_id: restaurantId,
      step: 'system_settings'
    }).catch(err => console.error('[UsageTracking] Failed to track system settings:', err));

    res.json({
      success: true,
      message: 'System settings configured successfully',
      hasGst: !!gstNumber,
      webhookConfigured: !!webhookSecret
    });

  } catch (error) {
    console.error('[System Settings] Setup error:', error);

    // tempFiles is declared in try block, so check if it exists
    if (typeof tempFiles !== 'undefined' && tempFiles && tempFiles.length > 0) {
      await cleanupTempFiles(tempFiles);
    }

    // Log the failure
    const { supabase } = require('../services/database-service');

    await supabase
      .from('registration_logs')
      .insert({
        organisation_id: organisationId,
        restaurant_id: restaurantId,
        action: 'system_settings_setup',
        status: 'failed',
        error_message: error.message,
        initiated_by: req.user?.email || 'system'
      });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Create API Key endpoint
 * Creates an API key for the restaurant using user credentials
 */
router.post('/create-api-key', async (req, res) => {
  const { restaurantId } = req.body;
  const organisationId = req.user?.organisationId;

  if (!restaurantId) {
    return res.status(400).json({ success: false, error: 'Restaurant ID required' });
  }

  if (!organisationId) {
    return res.status(401).json({
      success: false,
      error: 'Organisation context required'
    });
  }

  try {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    const path = require('path');
    const { supabase } = require('../services/database-service');

    // Get restaurant details
    const { data: restaurant, error: restaurantError } = await supabase
      .from('restaurants')
      .select('*')
      .eq('id', restaurantId)
      .eq('organisation_id', organisationId)
      .single();

    if (restaurantError || !restaurant) {
      console.error('[API Key] Restaurant query error:', restaurantError);
      throw new Error('Restaurant not found');
    }

    // Get user account through pumpd_restaurants relationship
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

    if (!finalAccount || !finalAccount.user_password_hint) {
      throw new Error('User account credentials not found. Please create a Pumpd account first.');
    }

    // Get organization-specific script configuration (admin URL)
    const scriptConfig = await OrganizationSettingsService.getScriptConfig(organisationId);
    console.log('[API Key] Script config loaded:', {
      adminUrl: scriptConfig.adminUrl,
      adminHostname: scriptConfig.adminHostname
    });

    // Prepare script arguments
    const scriptPath = path.resolve(__dirname, '../../../scripts/create-api-key-user.js');
    const command = [
      'node',
      scriptPath,
      `--email="${finalAccount.email}"`,
      `--password="${finalAccount.user_password_hint}"`,
      `--name="${restaurant.name.replace(/"/g, '\\"')}"`,
      `--admin-url="${scriptConfig.adminUrl}"`
    ].join(' ');

    console.log('[API Key] Creating API key for restaurant:', restaurant.name);

    // Execute the script
    const { stdout, stderr } = await execAsync(command, {
      env: { ...process.env, DEBUG_MODE: 'false' },
      timeout: 180000 // 3 minute timeout
    });

    // Extract API key from output if available
    let apiKey = null;
    let scriptResult = null;

    // First try to parse JSON output
    const resultMatch = stdout.match(/### SCRIPT_RESULT_START ###\s*(.*?)\s*### SCRIPT_RESULT_END ###/s);
    if (resultMatch && resultMatch[1]) {
      try {
        scriptResult = JSON.parse(resultMatch[1]);
        apiKey = scriptResult.apiKey;
        console.log('[API Key] Extracted API key from JSON output');
      } catch (parseError) {
        console.error('[API Key] Failed to parse JSON output:', parseError);
      }
    }

    // Fallback to regex matching if JSON parsing failed
    if (!apiKey) {
      const apiKeyMatch = stdout.match(/API Key:\s*([a-zA-Z0-9-]+)/);
      if (apiKeyMatch) {
        apiKey = apiKeyMatch[1];
        console.log('[API Key] Extracted API key using regex fallback');
      }
    }

    // Update onboarding database with API key
    if (apiKey && finalAccount.email) {
      try {
        const onboardingService = require('../services/onboarding-service');

        // Get onboarding record
        const onboardingRecord = await onboardingService.getOnboardingIdByEmail(finalAccount.email);

        if (onboardingRecord && onboardingRecord.onboarding_id) {
          // Update with API key
          await onboardingService.updateOnboardingRecord(onboardingRecord.onboarding_id, {
            restaurant_api_key: apiKey
          });

          console.log('[API Key] ✓ Saved API key to onboarding database');
        } else {
          console.warn('[API Key] Could not find onboarding record for email:', finalAccount.email);
        }
      } catch (onboardingError) {
        console.error('[API Key] Failed to update onboarding database:', onboardingError);
        // Don't fail the whole request if onboarding update fails
      }
    }

    // Update completion status in pumpd_restaurants
    try {
      const { data: existingRestaurant } = await supabase
        .from('pumpd_restaurants')
        .select('setup_completion')
        .eq('restaurant_id', restaurantId)
        .eq('organisation_id', organisationId)
        .single();

      const existingCompletion = existingRestaurant?.setup_completion || {};

      await supabase
        .from('pumpd_restaurants')
        .update({
          api_key_created_at: new Date().toISOString(),
          setup_completion: {
            ...existingCompletion,
            api_key: true,
            api_key_date: new Date().toISOString()
          },
          updated_at: new Date().toISOString()
        })
        .eq('restaurant_id', restaurantId)
        .eq('organisation_id', organisationId);

      console.log('[API Key] Updated completion status');
    } catch (updateError) {
      console.error('[API Key] Could not update completion status:', updateError.message);
    }

    // Log success
    await supabase
      .from('registration_logs')
      .insert({
        organisation_id: organisationId,
        restaurant_id: restaurantId,
        action: 'api_key_creation',
        status: 'completed',
        metadata: { hasApiKey: !!apiKey },
        initiated_by: req.user?.email || 'system'
      });

    // Track usage
    UsageTrackingService.trackRegistrationStep(organisationId, 'finalize_setup', {
      restaurant_id: restaurantId,
      step: 'api_key'
    }).catch(err => console.error('[UsageTracking] Failed to track API key creation:', err));

    res.json({
      success: true,
      message: 'API key created successfully',
      apiKey: apiKey
    });

  } catch (error) {
    console.error('[API Key] Creation error:', error);

    // Log the failure
    const { supabase } = require('../services/database-service');

    await supabase
      .from('registration_logs')
      .insert({
        organisation_id: organisationId,
        restaurant_id: restaurantId,
        action: 'api_key_creation',
        status: 'failed',
        error_message: error.message,
        initiated_by: req.user?.email || 'system'
      });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Configure Uber Integration endpoint
 * Configures Uber OAuth and integration using user credentials
 */
router.post('/configure-uber-integration', async (req, res) => {
  const { restaurantId } = req.body;
  const organisationId = req.user?.organisationId;

  if (!restaurantId) {
    return res.status(400).json({ success: false, error: 'Restaurant ID required' });
  }

  if (!organisationId) {
    return res.status(401).json({
      success: false,
      error: 'Organisation context required'
    });
  }

  try {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    const path = require('path');
    const onboardingService = require('../services/onboarding-service');
    const { supabase } = require('../services/database-service');

    // Get restaurant details
    const { data: restaurant, error: restaurantError } = await supabase
      .from('restaurants')
      .select('*')
      .eq('id', restaurantId)
      .eq('organisation_id', organisationId)
      .single();

    if (restaurantError || !restaurant) {
      console.error('[Uber Integration] Restaurant query error:', restaurantError);
      throw new Error('Restaurant not found');
    }

    // Get user account through pumpd_restaurants relationship
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

    if (!finalAccount || !finalAccount.user_password_hint) {
      throw new Error('User account credentials not found. Please create a Pumpd account first.');
    }

    // Get onboarding data from onboarding database
    let onboardingData = {};
    try {
      const onboardingRecord = await onboardingService.getOnboardingIdByEmail(finalAccount.email);
      if (onboardingRecord) {
        onboardingData = {
          nzbn: onboardingRecord.nzbn || '',
          companyName: onboardingRecord.company_name || '',
          tradingName: onboardingRecord.trading_name || '',
          directorName: onboardingRecord.director_name || '',
          directorMobile: onboardingRecord.director_mobile_number || ''
        };
        console.log('[Uber Integration] Retrieved onboarding data:', {
          hasNzbn: !!onboardingData.nzbn,
          hasCompanyName: !!onboardingData.companyName,
          hasTradingName: !!onboardingData.tradingName,
          hasDirectorName: !!onboardingData.directorName,
          hasDirectorMobile: !!onboardingData.directorMobile
        });
      }
    } catch (error) {
      console.error('[Uber Integration] Could not retrieve onboarding data:', error.message);
    }

    // Validate required onboarding data
    if (!onboardingData.nzbn || !onboardingData.companyName || !onboardingData.tradingName ||
        !onboardingData.directorName || !onboardingData.directorMobile) {
      throw new Error('Missing required onboarding data. Please ensure all business details are provided.');
    }

    // Get organization-specific script configuration (admin URL)
    const scriptConfig = await OrganizationSettingsService.getScriptConfig(organisationId);
    console.log('[Uber Integration] Script config loaded:', {
      adminUrl: scriptConfig.adminUrl,
      adminHostname: scriptConfig.adminHostname
    });

    // Prepare script arguments
    const scriptPath = path.resolve(__dirname, '../../../scripts/finalise-onboarding-user.js');
    const command = [
      'node',
      scriptPath,
      `--email="${finalAccount.email}"`,
      `--password="${finalAccount.user_password_hint}"`,
      `--name="${restaurant.name.replace(/"/g, '\\"')}"`,
      `--nzbn="${onboardingData.nzbn}"`,
      `--company-name="${onboardingData.companyName.replace(/"/g, '\\"')}"`,
      `--trading-name="${onboardingData.tradingName.replace(/"/g, '\\"')}"`,
      `--director-name="${onboardingData.directorName.replace(/"/g, '\\"')}"`,
      `--director-mobile="${onboardingData.directorMobile}"`,
      `--admin-url="${scriptConfig.adminUrl}"`
    ].join(' ');

    console.log('[Uber Integration] Configuring Uber integration for restaurant:', restaurant.name);

    // Execute the script
    const { stdout, stderr } = await execAsync(command, {
      env: { ...process.env, DEBUG_MODE: 'false' },
      timeout: 300000 // 5 minute timeout for OAuth flow
    });

    // Update completion status in pumpd_restaurants
    try {
      const { data: existingRestaurant } = await supabase
        .from('pumpd_restaurants')
        .select('setup_completion')
        .eq('restaurant_id', restaurantId)
        .eq('organisation_id', organisationId)
        .single();

      const existingCompletion = existingRestaurant?.setup_completion || {};

      await supabase
        .from('pumpd_restaurants')
        .update({
          uber_integration_completed_at: new Date().toISOString(),
          setup_completion: {
            ...existingCompletion,
            uber_integration: true,
            uber_integration_date: new Date().toISOString()
          },
          updated_at: new Date().toISOString()
        })
        .eq('restaurant_id', restaurantId)
        .eq('organisation_id', organisationId);

      console.log('[Uber Integration] Updated completion status in pumpd_restaurants');
    } catch (updateError) {
      console.error('[Uber Integration] Could not update completion status:', updateError.message);
    }

    // Log success
    await supabase
      .from('registration_logs')
      .insert({
        organisation_id: organisationId,
        restaurant_id: restaurantId,
        action: 'uber_integration_setup',
        status: 'completed',
        metadata: {
          hasNzbn: !!onboardingData.nzbn,
          hasDirectorInfo: !!onboardingData.directorName
        },
        initiated_by: req.user?.email || 'system'
      });

    // Track usage
    UsageTrackingService.trackRegistrationStep(organisationId, 'finalize_setup', {
      restaurant_id: restaurantId,
      step: 'uber_integration'
    }).catch(err => console.error('[UsageTracking] Failed to track Uber integration:', err));

    res.json({
      success: true,
      message: 'Uber integration configured successfully'
    });

  } catch (error) {
    console.error('[Uber Integration] Configuration error:', error);

    // Log the failure
    const { supabase } = require('../services/database-service');

    await supabase
      .from('registration_logs')
      .insert({
        organisation_id: organisationId,
        restaurant_id: restaurantId,
        action: 'uber_integration_setup',
        status: 'failed',
        error_message: error.message,
        initiated_by: req.user?.email || 'system'
      });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get setup completion status for a restaurant
 */
router.get('/setup-status/:restaurantId', async (req, res) => {
  const { restaurantId } = req.params;
  const organisationId = req.user?.organisationId;

  if (!organisationId) {
    return res.status(401).json({
      success: false,
      error: 'Organisation context required'
    });
  }

  try {
    const { supabase } = require('../services/database-service');

    // Get pumpd_restaurants record with setup completion status
    const { data: pumpdRestaurant, error } = await supabase
      .from('pumpd_restaurants')
      .select(`
        setup_completion,
        system_settings_completed_at,
        api_key_created_at,
        uber_integration_completed_at,
        webhook_secret
      `)
      .eq('restaurant_id', restaurantId)
      .eq('organisation_id', organisationId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      throw error;
    }

    // If no record exists, nothing is completed
    if (!pumpdRestaurant) {
      return res.json({
        success: true,
        status: {
          system_settings: false,
          api_key: false,
          uber_integration: false
        }
      });
    }

    // Return completion status
    res.json({
      success: true,
      status: {
        system_settings: pumpdRestaurant.setup_completion?.system_settings || !!pumpdRestaurant.system_settings_completed_at,
        api_key: pumpdRestaurant.setup_completion?.api_key || !!pumpdRestaurant.api_key_created_at,
        uber_integration: pumpdRestaurant.setup_completion?.uber_integration || !!pumpdRestaurant.uber_integration_completed_at,
        webhook_configured: !!pumpdRestaurant.webhook_secret
      },
      completion_dates: {
        system_settings: pumpdRestaurant.system_settings_completed_at,
        api_key: pumpdRestaurant.api_key_created_at,
        uber_integration: pumpdRestaurant.uber_integration_completed_at
      }
    });
  } catch (error) {
    console.error('[Setup Status] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================================
// SINGLE RESTAURANT ASYNC YOLO MODE
// ============================================================================

/**
 * Start async YOLO mode execution for a single restaurant
 * Returns immediately with job ID for polling
 *
 * This enables the RestaurantDetail.tsx YoloModeDialog to start execution
 * that survives dialog close and page navigation.
 */
router.post('/execute-single-restaurant', async (req, res) => {
  const { restaurantId, formData } = req.body;
  const organisationId = req.user?.organisationId;
  const authToken = req.headers.authorization?.replace('Bearer ', '');

  console.log('[Single Restaurant YOLO] Execution request:', {
    restaurantId,
    organisationId,
    hasFormData: !!formData
  });

  if (!organisationId) {
    return res.status(401).json({
      success: false,
      error: 'Organisation context required'
    });
  }

  if (!restaurantId) {
    return res.status(400).json({
      success: false,
      error: 'Restaurant ID is required'
    });
  }

  if (!formData) {
    return res.status(400).json({
      success: false,
      error: 'Form data is required'
    });
  }

  try {
    const registrationBatchService = require('../services/registration-batch-service');

    // Build auth context for server-to-server API calls
    const authContext = {
      token: authToken,
      organisationId: organisationId
    };

    // Start async execution (returns immediately)
    const { jobId } = await registrationBatchService.executeYoloModeForSingleRestaurant(
      restaurantId,
      formData,
      organisationId,
      authContext
    );

    console.log('[Single Restaurant YOLO] Execution started, job ID:', jobId);

    res.json({
      success: true,
      jobId,
      message: 'YOLO mode execution started'
    });

  } catch (error) {
    console.error('[Single Restaurant YOLO] Error starting execution:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get YOLO mode execution progress for a single restaurant
 * Used by frontend polling to check status and display progress
 */
router.get('/single-restaurant-progress/:restaurantId', async (req, res) => {
  const { restaurantId } = req.params;
  const organisationId = req.user?.organisationId;

  if (!organisationId) {
    return res.status(401).json({
      success: false,
      error: 'Organisation context required'
    });
  }

  try {
    const registrationBatchService = require('../services/registration-batch-service');

    const progress = await registrationBatchService.getSingleRestaurantYoloProgress(
      restaurantId,
      organisationId
    );

    if (!progress) {
      return res.json({
        status: 'not_started',
        message: 'No YOLO mode execution found for this restaurant'
      });
    }

    res.json(progress);

  } catch (error) {
    console.error('[Single Restaurant YOLO] Error getting progress:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Resume a failed YOLO mode execution for a single restaurant
 * Continues from the last completed phase
 */
router.post('/resume-single-restaurant/:restaurantId', async (req, res) => {
  const { restaurantId } = req.params;
  const organisationId = req.user?.organisationId;

  if (!organisationId) {
    return res.status(401).json({
      success: false,
      error: 'Organisation context required'
    });
  }

  try {
    const registrationBatchService = require('../services/registration-batch-service');
    const { getSupabaseClient } = require('../services/database-service');
    const client = getSupabaseClient();

    // Find the most recent job for this restaurant (single-restaurant mode has null batch_job_id)
    const { data: job, error: jobError } = await client
      .from('registration_jobs')
      .select(`
        *,
        steps:registration_job_steps(*),
        restaurant:restaurants(*)
      `)
      .eq('restaurant_id', restaurantId)
      .eq('organisation_id', organisationId)
      .is('batch_job_id', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (jobError || !job) {
      return res.status(404).json({
        success: false,
        error: 'No YOLO mode execution found for this restaurant'
      });
    }

    // Check if Step 6 has partial progress
    const step6 = job.steps?.find(s => s.step_number === 6);
    if (!step6?.sub_step_progress) {
      return res.status(400).json({
        success: false,
        error: 'No progress to resume from. Start a new execution instead.'
      });
    }

    // Detect last completed phase for response
    const lastCompletePhase = registrationBatchService.detectLastCompletePhase(step6.sub_step_progress);

    console.log(`[Single Restaurant YOLO] Resuming execution for restaurant ${restaurantId}, job ${job.id}, from ${lastCompletePhase || 'beginning'}`);

    // Return immediately, execute resume in background
    res.json({
      success: true,
      message: 'Resume initiated',
      jobId: job.id,
      resumingFrom: lastCompletePhase || 'beginning'
    });

    // Execute resume in background
    setImmediate(async () => {
      try {
        const authContext = {
          token: req.headers.authorization,
          organisationId
        };

        await registrationBatchService.resumeYoloModeForJob(job, null, authContext);
        console.log(`[Single Restaurant YOLO] Resume completed for job ${job.id}`);
      } catch (resumeError) {
        console.error(`[Single Restaurant YOLO] Resume failed for job ${job.id}:`, resumeError);
      }
    });

  } catch (error) {
    console.error('[Single Restaurant YOLO] Error resuming execution:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;