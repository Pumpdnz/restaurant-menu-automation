const express = require('express');
const router = express.Router();
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const multer = require('multer');
const fs = require('fs').promises;
const path = require('path');

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
    
    // Get account registration status
    const { data: account, error: accountError } = await supabase
      .from('pumpd_accounts')
      .select('*')
      .eq('organisation_id', organisationId)
      .eq('restaurant_id', restaurantId)
      .single();
    
    // Get restaurant registration status
    const { data: pumpdRestaurant, error: restaurantError } = await supabase
      .from('pumpd_restaurants')
      .select('*')
      .eq('organisation_id', organisationId)
      .eq('restaurant_id', restaurantId)
      .single();
    
    res.json({
      success: true,
      account: account || null,
      pumpdRestaurant: pumpdRestaurant || null,
      hasAccount: !!account && account.registration_status === 'completed',
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
router.post('/register-account', async (req, res) => {
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
    
    // Call CloudWaitress API to register user
    const CloudWaitressAPIService = require('../services/cloudwaitress-api-service');
    const cloudWaitressAPI = new CloudWaitressAPIService();
    
    try {
      console.log('[Registration] Starting CloudWaitress API call');
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
          retry_count: supabase.raw('retry_count + 1')
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
router.post('/register-restaurant', async (req, res) => {
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
    
    // Use email and password from request body first, fall back to database
    const email = requestEmail || restaurant.user_email || restaurant.email;
    const password = requestPassword || restaurant.user_password_hint;
    
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
      }
    } else {
      // For new_account_with_restaurant, we need to first create account via CloudWaitress API
      
      // Step 1: Register user via CloudWaitress API
      const CloudWaitressAPIService = require('../services/cloudwaitress-api-service');
      const cloudWaitressAPI = new CloudWaitressAPIService();
      
      try {
        // Use restaurant phone for registration
        const phone = restaurant.phone || '';
        
        console.log('[Registration] Creating new account via CloudWaitress API for:', email);
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
    
    // Execute Playwright script for restaurant registration only
    // All registration types now use login-and-register-restaurant.js since account should exist
    const scriptPath = '/Users/giannimunro/Desktop/cursor-projects/automation/scripts/restaurant-registration/login-and-register-restaurant.js';
    
    let command = `node ${scriptPath} --email="${email}" --password="${password}" --name="${restaurantName || restaurant.name}" --address="${restaurant.address || ''}" --phone="${restaurant.phone || ''}" --dayHours='${hoursJson}'`;
    
    // No longer need hasExistingRestaurants flag - the script now auto-detects
    
    console.log('[Registration] Executing restaurant registration:', command);
    
    try {
      const { stdout, stderr } = await execAsync(command, {
        env: { ...process.env, DEBUG_MODE: 'false' },
        timeout: 180000 // 3 minute timeout
      });
      
      // Parse subdomain and restaurant ID from stdout if available
      const subdomainMatch = stdout.match(/Subdomain:\s*([^\s]+)\.pumpd\.co\.nz/);
      const subdomain = subdomainMatch ? subdomainMatch[1] : restaurant.slug;
      
      // Parse restaurant ID from stdout
      const restaurantIdMatch = stdout.match(/RestaurantID:\s*([a-f0-9-]+)/);
      const pumpdRestaurantId = restaurantIdMatch ? restaurantIdMatch[1] : null;
      
      // Update restaurant registration status with the Pumpd restaurant ID
      await supabase
        .from('pumpd_restaurants')
        .update({
          registration_status: 'completed',
          registration_date: new Date().toISOString(),
          pumpd_restaurant_id: pumpdRestaurantId, // Save the Pumpd platform restaurant ID
          pumpd_subdomain: subdomain,
          pumpd_full_url: `https://${subdomain}.pumpd.co.nz`,
          dashboard_url: pumpdRestaurantId ? `https://admin.pumpd.co.nz/restaurant/${pumpdRestaurantId}` : `https://admin.pumpd.co.nz/restaurants/${subdomain}`,
          settings_url: pumpdRestaurantId ? `https://admin.pumpd.co.nz/restaurant/${pumpdRestaurantId}/settings` : `https://admin.pumpd.co.nz/restaurants/${subdomain}/settings`,
          menu_url: pumpdRestaurantId ? `https://admin.pumpd.co.nz/restaurant/${pumpdRestaurantId}/menu` : `https://admin.pumpd.co.nz/restaurants/${subdomain}/menu`
        })
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
router.post('/upload-csv-menu', upload.single('csvFile'), async (req, res) => {
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
    
    // Get account credentials from pumpd_accounts
    const { data: account, error: accountError } = await supabase
      .from('pumpd_accounts')
      .select('email, user_password_hint')
      .eq('restaurant_id', restaurantId)
      .eq('organisation_id', organisationId)
      .single();
    
    if (accountError || !account) {
      throw new Error('Restaurant account not found. Please ensure the restaurant is registered on Pumpd first.');
    }
    
    if (!account.email || !account.user_password_hint) {
      throw new Error('Restaurant account credentials are incomplete. Please re-register the account.');
    }
    
    console.log('[CSV Upload] Account found:', account.email);
    
    // Execute updated import-csv-menu.js script with smart matching
    const scriptPath = path.join(__dirname, '../../../scripts/restaurant-registration/import-csv-menu.js');
    
    // Build command with proper escaping
    const command = [
      'node',
      scriptPath,
      `--email="${account.email}"`,
      `--password="${account.user_password_hint}"`,
      `--name="${restaurant.name}"`,
      `--csvFile="${csvFile.path}"`
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
    
    // Parse results from stdout
    const success = stdout.includes('CSV import completed successfully') || 
                   stdout.includes('✅') ||
                   stdout.includes('Successfully imported') ||
                   stdout.includes('Import completed');
    
    // Clean up uploaded file
    try {
      await fs.unlink(csvFile.path);
      console.log('[CSV Upload] Temporary file cleaned up');
    } catch (unlinkError) {
      console.error('[CSV Upload] Failed to clean up file:', unlinkError);
    }
    
    res.json({
      success,
      message: success ? 'Menu uploaded successfully' : 'Upload completed with warnings',
      details: stdout.substring(stdout.lastIndexOf('\n', stdout.length - 2) + 1), // Get last meaningful line
      output: stdout
    });
    
  } catch (error) {
    console.error('[CSV Upload] Error:', error);
    
    // Clean up file on error
    if (csvFile?.path) {
      try {
        await fs.unlink(csvFile.path);
        console.log('[CSV Upload] Temporary file cleaned up after error');
      } catch (unlinkError) {
        console.error('[CSV Upload] Failed to clean up file after error:', unlinkError);
      }
    }
    
    // Determine if it's a timeout error
    const isTimeout = error.code === 'ETIMEDOUT' || error.message.includes('timeout');
    
    res.status(500).json({
      success: false,
      error: isTimeout ? 
        'Upload timed out. The menu may be too large or the server may be busy. Please try again.' :
        error.message,
      details: error.stderr || null
    });
  }
});

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
router.post('/generate-code-injections', async (req, res) => {
  const { restaurantId } = req.body;
  const organisationId = req.user?.organisationId;
  
  console.log('[Code Generation] Request received:', { restaurantId, organisationId });
  
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
    
    // Build command with proper escaping
    let command = [
      'node',
      scriptPath,
      `--primary="${restaurant.primary_color}"`,
      `--secondary="${restaurant.secondary_color}"`,
      `--name="${restaurant.name.replace(/"/g, '\\"')}"`
    ];
    
    // Add lightmode flag only if theme is explicitly "light"
    if (restaurant.theme === 'light') {
      command.push('--lightmode');
    }
    
    command = command.join(' ');
    
    console.log('[Code Generation] Executing command...');
    
    const { stdout, stderr } = await execAsync(command, {
      env: { ...process.env },
      timeout: 60000 // 1 minute timeout
    });
    
    console.log('[Code Generation] Script output:', stdout);
    if (stderr) {
      console.error('[Code Generation] Script stderr:', stderr);
    }
    
    // Parse output to find generated file paths
    const sanitizedName = restaurant.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const outputDir = path.join(__dirname, '../../../generated-code', sanitizedName);
    
    const filePaths = {
      headInjection: path.join(outputDir, 'head-injection.html'),
      bodyInjection: path.join(outputDir, 'body-injection.html'),
      configuration: path.join(outputDir, 'configuration.json')
    };
    
    // Verify files exist
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
    
    res.json({
      success: true,
      message: 'Code injections generated successfully',
      filePaths,
      output: stdout
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
 * Configure website settings with generated code
 * Uses edit-website-settings-dark.js or edit-website-settings-light.js based on theme
 */
router.post('/configure-website', async (req, res) => {
  const { restaurantId, filePaths } = req.body;
  const organisationId = req.user?.organisationId;
  
  console.log('[Website Config] Request received:', { restaurantId, organisationId, filePaths });
  
  if (!organisationId) {
    return res.status(401).json({ 
      success: false, 
      error: 'Organisation context required' 
    });
  }
  
  if (!filePaths?.headInjection || !filePaths?.bodyInjection) {
    return res.status(400).json({
      success: false,
      error: 'Generated file paths required. Please generate code injections first.'
    });
  }
  
  // Track temporary files for cleanup (declare outside try-catch for scope)
  const tempFiles = [];
  
  try {
    const { supabase } = require('../services/database-service');
    
    // Get restaurant and account details
    const { data: restaurant, error: restaurantError } = await supabase
      .from('restaurants')
      .select(`
        name,
        primary_color,
        secondary_color,
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
    
    if (restaurantError || !restaurant) {
      throw new Error('Restaurant not found');
    }
    
    console.log('[Website Config] Restaurant found:', restaurant.name);
    console.log('[Website Config] Theme:', restaurant.theme || 'dark');
    
    // Get account credentials from pumpd_accounts
    const { data: account, error: accountError } = await supabase
      .from('pumpd_accounts')
      .select('email, user_password_hint')
      .eq('restaurant_id', restaurantId)
      .eq('organisation_id', organisationId)
      .single();
    
    if (accountError || !account) {
      throw new Error('Restaurant account not found. Please ensure the restaurant is registered on Pumpd first.');
    }
    
    if (!account.email || !account.user_password_hint) {
      throw new Error('Restaurant account credentials are incomplete. Please re-register the account.');
    }
    
    console.log('[Website Config] Account found:', account.email);
    
    // Select appropriate script based on theme
    const isDark = restaurant.theme !== 'light';
    const scriptName = isDark ? 'edit-website-settings-dark.js' : 'edit-website-settings-light.js';
    const scriptPath = path.join(__dirname, '../../../scripts', scriptName);
    
    console.log('[Website Config] Using script:', scriptName);
    
    // Build command with all arguments
    let command = [
      'node',
      scriptPath,
      `--email="${account.email}"`,
      `--password="${account.user_password_hint}"`,
      `--name="${restaurant.name.replace(/"/g, '\\"')}"`,
      `--primary="${restaurant.primary_color}"`,
      `--head="${filePaths.headInjection}"`,
      `--body="${filePaths.bodyInjection}"`
    ];

    // Add secondary color if available
    if (restaurant.secondary_color) {
      command.push(`--secondary="${restaurant.secondary_color}"`);
    }
    
    // Add optional fields if available
    if (restaurant.logo_url) {
      // Check if it's a base64 data URL
      if (restaurant.logo_url.startsWith('data:image')) {
        // Convert base64 to PNG file
        const logoPath = await convertBase64ToPng(restaurant.logo_url);
        if (logoPath) {
          command.push(`--logo="${logoPath}"`);
          tempFiles.push(logoPath); // Track for cleanup
        }
      } else if (restaurant.logo_url.startsWith('http')) {
        // Download logo to temp location
        const logoPath = await downloadLogoIfNeeded(restaurant.logo_url);
        if (logoPath) {
          command.push(`--logo="${logoPath}"`);
          tempFiles.push(logoPath); // Track for cleanup
        }
      } else {
        // Local path
        command.push(`--logo="${restaurant.logo_url}"`);
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
      env: { ...process.env, DEBUG_MODE: 'false' },
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
    
    if (success) {
      console.log('[Website Config] ✓ Configuration completed successfully');
    } else {
      console.log('[Website Config] ⚠ Configuration may have issues');
    }
    
    // Clean up temporary files
    await cleanupTempFiles(tempFiles);
    
    res.json({
      success,
      message: success ? 'Website configured successfully' : 'Configuration completed with warnings',
      output: stdout,
      error: stderr || null,
      uploadedLogoUrl
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
      console.log(`[Website Config] ✓ Cleaned up temporary file: ${filePath}`);
    } catch (error) {
      console.warn(`[Website Config] ⚠️ Could not clean up temporary file ${filePath}:`, error.message);
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
 * Configure Stripe payment settings
 * Uses setup-stripe-payments.js or setup-stripe-payments-no-link.js script to automate Stripe configuration
 */
router.post('/configure-payment', async (req, res) => {
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
    
    // Get account credentials from pumpd_accounts
    const { data: account, error: accountError } = await supabase
      .from('pumpd_accounts')
      .select('email, user_password_hint')
      .eq('restaurant_id', restaurantId)
      .eq('organisation_id', organisationId)
      .single();
    
    if (accountError || !account) {
      throw new Error('Restaurant account not found. Please ensure the restaurant is registered on Pumpd first.');
    }
    
    if (!account.email || !account.user_password_hint) {
      throw new Error('Restaurant account credentials are incomplete. Please re-register the account.');
    }
    
    console.log('[Payment Config] Account found:', account.email);
    
    // Choose script based on includeConnectLink parameter
    const scriptName = includeConnectLink ? 'setup-stripe-payments.js' : 'setup-stripe-payments-no-link.js';
    const scriptPath = path.join(__dirname, '../../../scripts', scriptName);
    
    console.log('[Payment Config] Using script:', scriptName);
    
    // Build command with proper escaping
    const command = [
      'node',
      scriptPath,
      `--email="${account.email}"`,
      `--password="${account.user_password_hint}"`,
      `--name="${restaurant.name.replace(/"/g, '\\"')}"`
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
router.post('/configure-services', async (req, res) => {
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
    
    // Get account credentials from pumpd_accounts
    const { data: account, error: accountError } = await supabase
      .from('pumpd_accounts')
      .select('email, user_password_hint')
      .eq('restaurant_id', restaurantId)
      .eq('organisation_id', organisationId)
      .single();
    
    if (accountError || !account) {
      throw new Error('Restaurant account not found. Please ensure the restaurant is registered on Pumpd first.');
    }
    
    if (!account.email || !account.user_password_hint) {
      throw new Error('Restaurant account credentials are incomplete. Please re-register the account.');
    }
    
    console.log('[Services Config] Account found:', account.email);
    
    // Execute setup-services-settings.js script
    const scriptPath = path.join(__dirname, '../../../scripts/setup-services-settings.js');
    
    // Build command with proper escaping
    const command = [
      'node',
      scriptPath,
      `--email="${account.email}"`,
      `--password="${account.user_password_hint}"`,
      `--name="${restaurant.name.replace(/"/g, '\\"')}"`
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
 * Create onboarding user in Super Admin system
 * Creates a new user account in manage.pumpd.co.nz for restaurant onboarding
 */
router.post('/create-onboarding-user', async (req, res) => {
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
 */
router.post('/update-onboarding-record', async (req, res) => {
  const { 
    userEmail,
    restaurantId,
    contactPerson,
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
    
    // Get restaurant details including stripe_connect_url
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
        metadata
      `)
      .eq('id', restaurantId)
      .eq('organisation_id', organisationId)
      .single();
    
    if (restaurantError || !restaurant) {
      throw new Error('Restaurant not found');
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
    
    // Prepare update data
    // Note: organisation_name should be left blank or use restaurant name, 
    // NOT the extractor app's organisation
    const updateData = {
      restaurant_name: restaurant.name,
      organisation_name: additionalData.organisationName || '', // Leave blank unless explicitly provided
      address: restaurant.address || additionalData.address || '',
      email: restaurant.email || userEmail,
      phone: restaurant.phone || additionalData.phone || '',
      contact_person: contactPerson || additionalData.contactPerson || '',
      venue_operating_hours: formattedHours || additionalData.operatingHours || 'Hours not set',
      primary_color: restaurant.primary_color || '#3f92ff',
      secondary_color: restaurant.secondary_color || null,
      facebook_url: restaurant.facebook_url || null,
      instagram_url: restaurant.instagram_url || null,
      stripe_connect_link: restaurant.stripe_connect_url || null,
      logo_url: restaurant.hosted_logo_url || null,
      ...additionalData
    };
    
    console.log('[Onboarding] Updating record with data');
    
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

module.exports = router;