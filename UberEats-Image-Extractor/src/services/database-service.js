/**
 * Database Service Module
 * Handles all Supabase database operations for menu extraction system
 */

const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
// Prefer service role key for backend operations (bypasses RLS)
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

let supabase = null;
let currentOrgId = null;
let userSupabaseClient = null; // Store user-authenticated client

// Initialize database connection
function initializeDatabase() {
  if (!supabaseUrl || !supabaseKey) {
    console.warn('[Database] Supabase URL or key not found. Database operations will be disabled.');
    return false;
  }
  
  try {
    supabase = createClient(supabaseUrl, supabaseKey);
    console.log('[Database] Supabase client initialized successfully');
    return true;
  } catch (error) {
    console.error('[Database] Failed to initialize Supabase client:', error);
    return false;
  }
}

// Set user-authenticated Supabase client for RLS
function setUserSupabaseClient(token) {
  if (token && supabaseUrl) {
    userSupabaseClient = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    });
    console.log('[Database] User-authenticated Supabase client created');
  } else {
    userSupabaseClient = null;
  }
}

// Get the appropriate Supabase client (user-authenticated if available, otherwise default)
function getSupabaseClient() {
  return userSupabaseClient || supabase;
}

// Check if database is available
function isDatabaseAvailable() {
  return supabase !== null;
}

// Set the current organization ID for filtering
function setCurrentOrganizationId(orgId) {
  currentOrgId = orgId;
}

// Get the current organization ID or use default
function getCurrentOrganizationId() {
  return currentOrgId || '00000000-0000-0000-0000-000000000000';
}

/**
 * Platform Operations
 */
async function getPlatformByName(platformName) {
  if (!isDatabaseAvailable()) return null;
  
  try {
    // Always use lowercase for consistency
    const normalizedName = platformName.toLowerCase();
    
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('platforms')
      .select('*')
      .eq('name', normalizedName)
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('[Database] Error getting platform:', error);
    return null;
  }
}

/**
 * Restaurant Operations
 */
async function upsertRestaurant(restaurantData, organisationId = null) {
  if (!isDatabaseAvailable()) {
    console.error('[Database] Database not available for upsertRestaurant');
    return null;
  }
  
  const { name, url, platformName } = restaurantData;
  
  if (!name || !platformName) {
    console.error('[Database] Missing required fields for upsertRestaurant:', { name, platformName });
    return null;
  }
  
  // Use provided org ID or fall back to current org or default
  const orgId = organisationId || getCurrentOrganizationId();
  
  try {
    // Get platform
    console.log(`[Database] Looking up platform: ${platformName}`);
    const platform = await getPlatformByName(platformName);
    if (!platform) {
      console.error(`[Database] Platform ${platformName} not found in database`);
      throw new Error(`Platform ${platformName} not found`);
    }
    console.log(`[Database] Found platform: ${platform.name} with ID: ${platform.id}`);
    
    // Generate slug from name - append first 8 chars of org ID to ensure uniqueness
    // This ensures slugs are unique across organizations
    const baseSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const orgSuffix = orgId.substring(0, 8);
    const slug = `${baseSlug}-${orgSuffix}`;
    
    // Try to find existing restaurant by slug within organization
    let restaurant = await getSupabaseClient()
      .from('restaurants')
      .select('*')
      .eq('slug', slug)
      .eq('organisation_id', orgId)
      .single();
    
    if (restaurant.error && restaurant.error.code === 'PGRST116') {
      // Restaurant doesn't exist, create it
      const { data: newRestaurant, error: createError } = await getSupabaseClient()
        .from('restaurants')
        .insert({
          name,
          slug,
          organisation_id: orgId,
          metadata: restaurantData.metadata || {}
        })
        .select()
        .single();
      
      if (createError) throw createError;
      restaurant = { data: newRestaurant };
    } else if (restaurant.error) {
      throw restaurant.error;
    }
    
    // Upsert restaurant platform URL
    const { error: platformError } = await getSupabaseClient()
      .from('restaurant_platforms')
      .upsert({
        restaurant_id: restaurant.data.id,
        platform_id: platform.id,
        url,
        last_scraped_at: new Date().toISOString()
      }, {
        onConflict: 'restaurant_id,platform_id'
      });
    
    if (platformError) throw platformError;
    
    return {
      restaurant: restaurant.data,
      platform
    };
  } catch (error) {
    console.error('[Database] Error upserting restaurant:', {
      error: error.message,
      code: error.code,
      details: error.details,
      restaurantName: name,
      platformName,
      orgId
    });
    return null;
  }
}

/**
 * Extraction Job Operations
 */
async function createExtractionJob(jobData, organisationId = null) {
  if (!isDatabaseAvailable()) return null;
  
  // Use provided org ID or fall back to default
  const orgId = organisationId || '00000000-0000-0000-0000-000000000000';
  
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('extraction_jobs')
      .insert({
        job_id: jobData.jobId,
        restaurant_id: jobData.restaurantId,
        platform_id: jobData.platformId,
        url: jobData.url,
        job_type: jobData.jobType || 'full_menu',
        status: 'pending',
        config: jobData.config || {},
        organisation_id: orgId,
        created_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('[Database] Error creating extraction job:', error);
    return null;
  }
}

async function updateExtractionJob(jobId, updates) {
  if (!isDatabaseAvailable()) return null;
  
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('extraction_jobs')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('job_id', jobId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('[Database] Error updating extraction job:', error);
    return null;
  }
}

async function getExtractionJob(jobId) {
  if (!isDatabaseAvailable()) return null;
  
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('extraction_jobs')
      .select(`
        *,
        restaurants (name, slug),
        platforms (name)
      `)
      .eq('job_id', jobId)
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('[Database] Error getting extraction job:', error);
    return null;
  }
}

/**
 * Menu Operations
 */
async function createMenu(menuData, organisationId = null) {
  if (!isDatabaseAvailable()) return null;
  
  // Use provided org ID or get current organization context
  const orgId = organisationId || getCurrentOrganizationId();
  
  try {
    // Get the Supabase client
    const client = getSupabaseClient();
    
    // Get the latest version for this restaurant
    const { data: latestMenu } = await client
      .from('menus')
      .select('version')
      .eq('restaurant_id', menuData.restaurantId)
      .eq('platform_id', menuData.platformId)
      .eq('organisation_id', orgId)
      .order('version', { ascending: false })
      .limit(1)
      .single();
    
    const newVersion = latestMenu ? latestMenu.version + 1 : 1;
    
    // Deactivate previous menus
    if (latestMenu) {
      await client
        .from('menus')
        .update({ is_active: false })
        .eq('restaurant_id', menuData.restaurantId)
        .eq('platform_id', menuData.platformId)
        .eq('organisation_id', orgId);
    }
    
    // Create new menu
    const { data, error } = await client
      .from('menus')
      .insert({
        restaurant_id: menuData.restaurantId,
        extraction_job_id: menuData.extractionJobId,
        platform_id: menuData.platformId,
        organisation_id: orgId,
        version: newVersion,
        is_active: true,
        menu_data: menuData.rawData || {}
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('[Database] Error creating menu:', error);
    return null;
  }
}

/**
 * Category Operations
 */
async function createCategories(menuId, categories, organisationId = null) {
  if (!isDatabaseAvailable()) return [];
  
  try {
    // Use provided org ID or get current organization context
    const orgId = organisationId || getCurrentOrganizationId();
    const categoryData = categories.map((cat, index) => ({
      menu_id: menuId,
      name: cat.name,
      description: cat.description,
      position: cat.position || index + 1,
      selector: cat.selector,
      organisation_id: orgId  // Add organization context for RLS
    }));
    
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('categories')
      .insert(categoryData)
      .select();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('[Database] Error creating categories:', error);
    return [];
  }
}

/**
 * Menu Item Operations
 */
async function createMenuItems(menuId, categoryMap, items, organisationId = null) {
  if (!isDatabaseAvailable()) return [];
  
  try {
    // Use provided org ID or get current organization context
    const orgId = organisationId || getCurrentOrganizationId();
    
    // Debug category mapping
    console.log('[Database] Category map:', Object.keys(categoryMap));
    console.log('[Database] Sample item categories:', items.slice(0, 3).map(i => i.categoryName || i.category));
    
    const itemData = items.map(item => {
      // Try multiple fields for category name
      const categoryName = item.categoryName || item.category;
      const categoryId = categoryMap[categoryName];
      
      if (!categoryId) {
        console.warn(`[Database] No category ID found for item "${item.dishName || item.name}" with category "${categoryName}"`);
      }
      
      // Clean up description - filter out "null" string
      const description = item.dishDescription || item.description;
      const cleanDescription = (description && description !== 'null') ? description : null;
      
      return {
        menu_id: menuId,
        category_id: categoryId,
        name: item.dishName || item.name,
        description: cleanDescription,
        price: item.dishPrice || item.price,
        currency: item.currency || 'NZD',
        tags: item.tags || [],
        dietary_info: item.dietaryInfo || {},
        platform_item_id: item.platformItemId,
        is_available: item.isAvailable !== false,
        metadata: item.metadata || {},
        organisation_id: orgId  // Add organization context for RLS
      };
    });
    
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('menu_items')
      .insert(itemData)
      .select();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('[Database] Error creating menu items:', error);
    return [];
  }
}

/**
 * Image Operations
 */
async function createItemImages(itemImageMap, organisationId = null) {
  if (!isDatabaseAvailable()) return [];
  
  try {
    const imageData = [];
    
    // Use provided org ID or get current organization context
    const orgId = organisationId || getCurrentOrganizationId();
    
    for (const [itemId, images] of Object.entries(itemImageMap)) {
      if (Array.isArray(images)) {
        images.forEach(img => {
          imageData.push({
            menu_item_id: itemId,
            url: img.url || img,
            type: img.type || 'primary',
            organisation_id: orgId  // Add organization context for RLS
          });
        });
      } else if (images) {
        imageData.push({
          menu_item_id: itemId,
          url: images,
          type: 'primary',
          organisation_id: orgId  // Add organization context for RLS
        });
      }
    }
    
    if (imageData.length === 0) return [];
    
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('item_images')
      .insert(imageData)
      .select();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('[Database] Error creating item images:', error);
    return [];
  }
}

/**
 * Extraction Log Operations
 */
async function createExtractionLog(logData) {
  if (!isDatabaseAvailable()) return null;
  
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('extraction_logs')
      .insert({
        extraction_job_id: logData.jobId,
        log_level: logData.level || 'info',
        message: logData.message,
        details: logData.details || {}
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('[Database] Error creating extraction log:', error);
    return null;
  }
}

/**
 * Option Set Operations
 */
async function saveOptionSet(optionSetData, orgId) {
  if (!isDatabaseAvailable()) return null;
  
  try {
    const client = getSupabaseClient();
    
    // First save the option set
    const { data: optionSet, error: setError } = await client
      .from('option_sets')
      .insert({
        menu_item_id: optionSetData.menu_item_id,
        name: optionSetData.name,
        display_order: optionSetData.display_order || 0,
        is_required: optionSetData.required || false,
        min_selections: optionSetData.min_selections || 0,
        max_selections: optionSetData.max_selections || 1,
        organisation_id: orgId
      })
      .select()
      .single();
    
    if (setError) throw setError;
    
    // Then save the option set items if provided
    if (optionSetData.items && optionSetData.items.length > 0) {
      const itemsToInsert = optionSetData.items.map(item => ({
        option_set_id: optionSet.id,
        name: item.name,
        price: item.price || 0,
        display_order: item.display_order || 0,
        description: item.description || null,
        organisation_id: orgId
      }));
      
      const { data: items, error: itemsError } = await client
        .from('option_set_items')
        .insert(itemsToInsert)
        .select();
      
      if (itemsError) {
        console.error('[Database] Error saving option set items:', itemsError);
      }
      
      optionSet.items = items || [];
    }
    
    return optionSet;
  } catch (error) {
    console.error('[Database] Error saving option set:', error);
    return null;
  }
}

async function saveOptionSetItem(itemData, orgId) {
  if (!isDatabaseAvailable()) return null;
  
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('option_set_items')
      .insert({
        option_set_id: itemData.option_set_id,
        name: itemData.name,
        price: itemData.price || 0,
        display_order: itemData.display_order || 0,
        description: itemData.description || null,
        organisation_id: orgId
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('[Database] Error saving option set item:', error);
    return null;
  }
}

async function updateMenuItemOptionSets(menuItemId, hasOptionSets, orgId) {
  if (!isDatabaseAvailable()) return null;
  
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('menu_items')
      .update({ has_option_sets: hasOptionSets })
      .eq('id', menuItemId)
      .eq('organisation_id', orgId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('[Database] Error updating menu item option sets flag:', error);
    return null;
  }
}

async function bulkSaveOptionSets(optionSets, orgId) {
  if (!isDatabaseAvailable()) return [];
  
  if (!optionSets || optionSets.length === 0) {
    return [];
  }
  
  try {
    const client = getSupabaseClient();
    
    // Prepare all option sets for batch insert
    const optionSetsToInsert = optionSets.map(optionSet => ({
      menu_item_id: optionSet.menu_item_id,
      name: optionSet.name,
      display_order: optionSet.display_order || 0,
      is_required: optionSet.required || false,
      min_selections: optionSet.min_selections || 0,
      max_selections: optionSet.max_selections || 1,
      organisation_id: orgId
    }));
    
    // Batch insert all option sets
    const { data: savedSets, error: setsError } = await client
      .from('option_sets')
      .insert(optionSetsToInsert)
      .select();
    
    if (setsError) {
      console.error('[Database] Error batch saving option sets:', setsError);
      throw setsError;
    }
    
    // Prepare all option set items for batch insert
    const allItemsToInsert = [];
    savedSets.forEach((savedSet, index) => {
      const originalOptionSet = optionSets[index];
      if (originalOptionSet.items && originalOptionSet.items.length > 0) {
        const items = originalOptionSet.items.map(item => ({
          option_set_id: savedSet.id,
          name: item.name,
          price: item.price || 0,
          display_order: item.display_order || 0,
          description: item.description || null,
          organisation_id: orgId
        }));
        allItemsToInsert.push(...items);
      }
    });
    
    // Batch insert all option set items if there are any
    if (allItemsToInsert.length > 0) {
      const { data: savedItems, error: itemsError } = await client
        .from('option_set_items')
        .insert(allItemsToInsert)
        .select();
      
      if (itemsError) {
        console.error('[Database] Error batch saving option set items:', itemsError);
        // Don't throw here, option sets were saved successfully
      }
    }
    
    console.log(`[Database] Batch saved ${savedSets.length} option sets with ${allItemsToInsert.length} items`);
    return savedSets;
  } catch (error) {
    console.error('[Database] Error bulk saving option sets:', error);
    return [];
  }
}

/**
 * Save unique option sets with deduplication via hash
 * @param {Array} optionSets - Array of option sets with hashes
 * @param {string} orgId - Organization ID
 * @returns {Array} Saved option sets with their IDs
 */
async function bulkSaveUniqueOptionSets(optionSets, orgId) {
  if (!isDatabaseAvailable()) return [];
  
  if (!optionSets || optionSets.length === 0) {
    return [];
  }
  
  try {
    const client = getSupabaseClient();
    const savedOptionSets = [];
    
    // Process each option set individually to handle upsert logic
    for (const optionSet of optionSets) {
      // Prepare option set data (no menu_item_id!)
      const optionSetData = {
        name: optionSet.name,
        display_order: optionSet.display_order || 0,
        is_required: optionSet.required || optionSet.is_required || false,
        min_selections: optionSet.minSelections || optionSet.min_selections || 0,
        max_selections: optionSet.maxSelections || optionSet.max_selections || 1,
        organisation_id: orgId,
        option_set_hash: optionSet.option_set_hash,
        extraction_source: optionSet.extraction_source || 'ubereats', // Must be one of: ubereats, doordash, menulog, manual, import
        extracted_at: new Date().toISOString()
      };
      
      // Try to insert, or get existing if hash already exists
      const { data: existingSet, error: fetchError } = await client
        .from('option_sets')
        .select('*')
        .eq('organisation_id', orgId)
        .eq('option_set_hash', optionSet.option_set_hash)
        .single();
      
      let savedSet;
      if (existingSet) {
        // Option set already exists with this hash, use it
        savedSet = existingSet;
        console.log(`[Database] Option set "${optionSet.name}" already exists with hash ${optionSet.option_set_hash.substring(0, 8)}`);
      } else {
        // Insert new option set
        const { data: newSet, error: insertError } = await client
          .from('option_sets')
          .insert(optionSetData)
          .select()
          .single();
        
        if (insertError) {
          console.error('[Database] Error saving option set:', insertError);
          continue;
        }
        
        savedSet = newSet;
        console.log(`[Database] Saved new option set "${optionSet.name}" with hash ${optionSet.option_set_hash.substring(0, 8)}`);
        
        // Now save the option set items if they exist
        if (optionSet.options && optionSet.options.length > 0) {
          const optionItems = optionSet.options.map((option, idx) => ({
            option_set_id: savedSet.id,
            name: option.name,
            price: option.priceValue || 0, // Use only numeric priceValue, not string price
            price_display: option.priceDisplay || option.price_display || option.price || null, // Store string representation
            display_order: idx,
            is_available: option.isAvailable !== false,
            organisation_id: orgId,
            extraction_source: optionSet.extraction_source || 'ubereats', // Must match parent option_set
            extracted_at: new Date().toISOString()
          }));
          
          const { data: savedItems, error: itemsError } = await client
            .from('option_set_items')
            .insert(optionItems)
            .select();
          
          if (itemsError) {
            console.error('[Database] Error saving option set items:', itemsError);
          } else {
            savedSet.items = savedItems;
            console.log(`[Database] Saved ${savedItems.length} items for option set "${optionSet.name}"`);
          }
        }
      }
      
      // Store the mapping from temporary ID to real database ID
      savedOptionSets.push({
        ...savedSet,
        temporaryId: optionSet.id, // The ID from deduplication service
        usageCount: optionSet.usageCount,
        sharedAcrossItems: optionSet.sharedAcrossItems
      });
    }
    
    console.log(`[Database] Successfully saved/retrieved ${savedOptionSets.length} unique option sets`);
    return savedOptionSets;
    
  } catch (error) {
    console.error('[Database] Error in bulkSaveUniqueOptionSets:', error);
    return [];
  }
}

/**
 * Create junction table entries to link menu items to option sets
 * @param {Array} junctionEntries - Array of { menu_item_id, option_set_id, display_order }
 * @param {string} orgId - Organization ID
 * @returns {Array} Created junction entries
 */
async function bulkCreateJunctionEntries(junctionEntries, orgId) {
  if (!isDatabaseAvailable()) return [];
  
  if (!junctionEntries || junctionEntries.length === 0) {
    return [];
  }
  
  try {
    const client = getSupabaseClient();
    
    // Prepare junction entries for batch insert
    const entriesToInsert = junctionEntries.map(entry => ({
      menu_item_id: entry.menu_item_id,
      option_set_id: entry.option_set_id,
      display_order: entry.display_order || 0,
      organisation_id: orgId,
      created_at: new Date().toISOString()
    }));
    
    // Batch insert junction entries
    const { data: savedEntries, error } = await client
      .from('menu_item_option_sets')
      .insert(entriesToInsert)
      .select();
    
    if (error) {
      console.error('[Database] Error creating junction entries:', error);
      return [];
    }
    
    console.log(`[Database] Created ${savedEntries.length} menu item to option set links`);
    return savedEntries;
    
  } catch (error) {
    console.error('[Database] Error in bulkCreateJunctionEntries:', error);
    return [];
  }
}

async function getOptionSetsByMenuItem(menuItemId, orgId) {
  if (!isDatabaseAvailable()) return [];
  
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('option_sets')
      .select(`
        *,
        option_set_items (*)
      `)
      .eq('menu_item_id', menuItemId)
      .eq('organisation_id', orgId)
      .order('display_order');
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('[Database] Error getting option sets:', error);
    return [];
  }
}

/**
 * Save menu item with organization context
 */
async function saveMenuItem(itemData, orgId) {
  if (!isDatabaseAvailable()) return null;
  
  try {
    const client = getSupabaseClient();
    
    // Note: This function expects itemData to have category_id already set
    // If category name is provided instead, the caller should resolve it first
    const { data, error } = await client
      .from('menu_items')
      .insert({
        name: itemData.name,
        description: itemData.description,
        price: itemData.price,
        category_id: itemData.category_id, // Use category_id, not category
        menu_id: itemData.menu_id, // Menu ID is required
        image_url: itemData.image_url,
        has_option_sets: itemData.has_option_sets || false,
        is_available: itemData.is_available !== false,
        platform_item_id: itemData.platform_item_id || null,
        organisation_id: orgId
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('[Database] Error saving menu item:', error);
    return null;
  }
}

/**
 * Full Extraction Save
 * Saves complete extraction results to database
 */
async function saveExtractionResults(jobId, extractionData) {
  if (!isDatabaseAvailable()) return null;
  
  try {
    // Get the extraction job
    const job = await getExtractionJob(jobId);
    if (!job) {
      throw new Error('Extraction job not found');
    }
    
    // Create menu - pass organisation_id from job
    const menu = await createMenu({
      restaurantId: job.restaurant_id,
      extractionJobId: job.id,
      platformId: job.platform_id,
      rawData: extractionData
    }, job.organisation_id);
    
    if (!menu) {
      throw new Error('Failed to create menu');
    }
    
    // Extract categories from data - pass organisation_id from job
    const categories = extractionData.categories || [];
    const categoryRecords = await createCategories(menu.id, categories, job.organisation_id);
    
    // Create category map
    const categoryMap = {};
    categoryRecords.forEach(cat => {
      categoryMap[cat.name] = cat.id;
    });
    
    // Extract menu items
    const menuItems = extractionData.menuItems || [];
    
    // Debug: Check for duplicate image URLs in the extraction data
    console.log('[Database] DEBUG: Analyzing extraction data images...');
    const imageUrlCounts = {};
    const itemsWithImages = [];
    const itemsWithoutImages = [];
    
    menuItems.forEach((item, idx) => {
      const url = item.imageURL || item.dishImageURL;
      const itemName = item.dishName || item.name;
      
      if (url) {
        imageUrlCounts[url] = (imageUrlCounts[url] || 0) + 1;
        itemsWithImages.push(`${idx}: "${itemName}" -> ${url.substring(0, 50)}...`);
      } else {
        itemsWithoutImages.push(`${idx}: "${itemName}" -> NO IMAGE`);
      }
    });
    
    console.log(`[Database] Items with images (${itemsWithImages.length}):`);
    itemsWithImages.slice(0, 5).forEach(item => console.log(`  ${item}`));
    if (itemsWithImages.length > 5) console.log(`  ... and ${itemsWithImages.length - 5} more`);
    
    console.log(`[Database] Items without images (${itemsWithoutImages.length}):`);
    itemsWithoutImages.slice(0, 5).forEach(item => console.log(`  ${item}`));
    if (itemsWithoutImages.length > 5) console.log(`  ... and ${itemsWithoutImages.length - 5} more`);
    
    const duplicateImages = Object.entries(imageUrlCounts).filter(([url, count]) => count > 1);
    if (duplicateImages.length > 0) {
      console.log('[Database] WARNING: Duplicate image URLs detected:');
      duplicateImages.forEach(([url, count]) => {
        console.log(`  - ${url.substring(0, 50)}... appears ${count} times`);
      });
    }
    
    const itemRecords = await createMenuItems(menu.id, categoryMap, menuItems, job.organisation_id);
    
    // Create item image map - ORIGINAL LOGIC (index-based)
    console.log('[Database] DEBUG: Mapping images to created items...');
    const itemImageMap = {};
    itemRecords.forEach((item, index) => {
      const originalItem = menuItems[index];
      if (originalItem && (originalItem.imageURL || originalItem.dishImageURL)) {
        const imageUrl = originalItem.imageURL || originalItem.dishImageURL;
        itemImageMap[item.id] = imageUrl;
        console.log(`[Database] Mapping: Item[${index}] "${item.name}" (id: ${item.id}) -> ${imageUrl.substring(0, 50)}...`);
      } else {
        console.log(`[Database] Mapping: Item[${index}] "${item.name}" (id: ${item.id}) -> NO IMAGE`);
      }
    });
    
    // Create item images - pass organisation_id from job
    await createItemImages(itemImageMap, job.organisation_id);
    
    // Update job status
    await updateExtractionJob(jobId, {
      status: 'completed',
      completed_at: new Date().toISOString()
    });
    
    // Log completion
    await createExtractionLog({
      jobId: job.id,
      level: 'info',
      message: 'Extraction completed successfully',
      details: {
        menuId: menu.id,
        categoriesCount: categoryRecords.length,
        itemsCount: itemRecords.length
      }
    });
    
    return {
      menu,
      categories: categoryRecords,
      items: itemRecords
    };
  } catch (error) {
    console.error('[Database] Error saving extraction results:', error);
    
    // Update job with error
    await updateExtractionJob(jobId, {
      status: 'failed',
      error: error.message,
      completed_at: new Date().toISOString()
    });
    
    return null;
  }
}

/**
 * Get menu with all items
 */
async function getMenuWithItems(menuId) {
  if (!isDatabaseAvailable()) return null;
  
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('menus')
      .select(`
        *,
        restaurants (id, name, slug),
        platforms (name),
        categories (
          id,
          name,
          position,
          menu_items (
            *,
            item_images (*),
            menu_item_option_sets (
              display_order,
              option_set:option_sets (
                *,
                option_set_items (*)
              )
            )
          )
        )
      `)
      .eq('id', menuId)
      .single();
    
    if (error) throw error;
    
    // Transform the nested structure to flatten option sets
    // Convert menu_item_option_sets junction data to direct option_sets array
    if (data && data.categories) {
      data.categories.forEach(category => {
        if (category.menu_items) {
          category.menu_items.forEach(item => {
            // Transform junction table data to flat option_sets array
            if (item.menu_item_option_sets) {
              item.option_sets = item.menu_item_option_sets
                .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
                .map(junction => junction.option_set)
                .filter(Boolean); // Remove any null option_sets
              
              // Remove the junction table data from the response
              delete item.menu_item_option_sets;
            } else {
              item.option_sets = [];
            }
          });
        }
      });
    }
    
    return data;
  } catch (error) {
    console.error('[Database] Error getting menu with items:', error);
    return null;
  }
}

/**
 * Get menu ID for an extraction job
 */
async function getMenuIdForJob(extractionJobId) {
  if (!isDatabaseAvailable()) {
    return null;
  }

  try {
    const { data, error } = await getSupabaseClient()
      .from('menus')
      .select('id')
      .eq('extraction_job_id', extractionJobId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No menu found
        return null;
      }
      throw error;
    }

    return data?.id || null;
  } catch (error) {
    console.error('[Database] Failed to get menu ID for job:', error.message);
    return null;
  }
}

/**
 * Get active menu items view
 */
async function getActiveMenuItems(restaurantId, platformId = null) {
  if (!isDatabaseAvailable()) return [];
  
  try {
    let query = supabase
      .from('v_active_menu_items')
      .select('*')
      .eq('restaurant_id', restaurantId);
    
    if (platformId) {
      const platform = await getPlatformByName(platformId);
      if (platform) {
        query = query.eq('platform_id', platform.id);
      }
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('[Database] Error getting active menu items:', error);
    return [];
  }
}

/**
 * Get all restaurants
 */
async function getAllRestaurants() {
  if (!isDatabaseAvailable()) return [];
  
  const orgId = getCurrentOrganizationId();
  console.log(`[Database] getAllRestaurants called with org ID: ${orgId}`);
  
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('restaurants')
      .select(`
        *,
        restaurant_platforms (
          url,
          last_scraped_at,
          platforms (name)
        )
      `)
      .eq('organisation_id', orgId)
      .order('name');
    
    if (error) throw error;
    console.log(`[Database] Found ${data?.length || 0} restaurants for org ${orgId}`);
    return data;
  } catch (error) {
    console.error('[Database] Error getting all restaurants:', error);
    return [];
  }
}

/**
 * Get lightweight restaurant list for table display
 * Only fetches essential fields needed for the restaurants table
 */
async function getAllRestaurantsList() {
  if (!isDatabaseAvailable()) return [];
  
  const orgId = getCurrentOrganizationId();
  console.log(`[Database] getAllRestaurantsList called with org ID: ${orgId}`);
  
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('restaurants')
      .select(`
        id,
        name,
        address,
        contact_name,
        contact_phone,
        contact_email,
        created_at,
        email,
        phone,
        restaurant_platforms (
          url,
          last_scraped_at,
          platforms (name)
        )
      `)
      .eq('organisation_id', orgId)
      .order('name');
    
    if (error) throw error;
    console.log(`[Database] Found ${data?.length || 0} restaurants for org ${orgId} (lightweight)`);
    return data;
  } catch (error) {
    console.error('[Database] Error getting restaurants list:', error);
    return [];
  }
}

/**
 * Get restaurant by ID
 */
async function getRestaurantById(restaurantId) {
  if (!isDatabaseAvailable()) return null;
  
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('restaurants')
      .select(`
        *,
        restaurant_platforms (
          url,
          last_scraped_at,
          platforms (name, id)
        )
      `)
      .eq('id', restaurantId)
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('[Database] Error getting restaurant by ID:', error);
    return null;
  }
}

/**
 * Get all menus for a restaurant
 */
async function getRestaurantMenus(restaurantId) {
  if (!isDatabaseAvailable()) return [];
  
  try {
    const { data: menus, error } = await getSupabaseClient()
      .from('menus')
      .select(`
        *,
        platforms (name),
        extraction_jobs (
          job_id,
          status,
          created_at,
          completed_at
        ),
        menu_items (id)
      `)
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    // Add item count to each menu
    const menusWithCounts = menus.map(menu => {
      const itemCount = menu.menu_items ? menu.menu_items.length : 0;
      const { menu_items, ...menuWithoutItems } = menu;
      
      // For backward compatibility, also check menu_data
      const menuDataCount = menu.menu_data?.menuItems?.length || 0;
      
      return {
        ...menuWithoutItems,
        item_count: itemCount || menuDataCount
      };
    });
    
    return menusWithCounts;
  } catch (error) {
    console.error('[Database] Error getting restaurant menus:', error);
    return [];
  }
}

/**
 * Get all menus with restaurant data
 */
async function getAllMenus() {
  if (!isDatabaseAvailable()) return [];
  
  try {
    const client = getSupabaseClient();
    const { data: menus, error } = await client
      .from('menus')
      .select(`
        *,
        restaurants (id, name, slug, address),
        platforms (name),
        extraction_jobs (
          job_id,
          status,
          created_at,
          completed_at
        ),
        menu_items (id)
      `)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    // Add item count to each menu
    const menusWithCounts = menus.map(menu => {
      const itemCount = menu.menu_items ? menu.menu_items.length : 0;
      const { menu_items, ...menuWithoutItems } = menu;
      
      // For backward compatibility, also check menu_data
      const menuDataCount = menu.menu_data?.menuItems?.length || 0;
      
      return {
        ...menuWithoutItems,
        item_count: itemCount || menuDataCount
      };
    });
    
    return menusWithCounts;
  } catch (error) {
    console.error('[Database] Error getting all menus:', error);
    return [];
  }
}

/**
 * Get menu by extraction job ID
 */
async function getMenuByExtractionJobId(extractionJobId) {
  if (!isDatabaseAvailable()) return null;
  
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('menus')
      .select(`
        *,
        restaurants (id, name, slug, address),
        platforms (name)
      `)
      .eq('extraction_job_id', extractionJobId)
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('[Database] Error getting menu by extraction job ID:', error);
    return null;
  }
}

/**
 * Bulk reassign menus to a different restaurant
 */
async function reassignMenusToRestaurant(menuIds, restaurantId) {
  if (!isDatabaseAvailable()) return { success: false, error: 'Database unavailable' };
  
  try {
    // First verify the target restaurant exists
    const { data: restaurant, error: restaurantError } = await getSupabaseClient()
      .from('restaurants')
      .select('id, name')
      .eq('id', restaurantId)
      .single();
    
    if (restaurantError || !restaurant) {
      throw new Error('Target restaurant not found');
    }
    
    // Update all menus with the new restaurant_id
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('menus')
      .update({ 
        restaurant_id: restaurantId,
        updated_at: new Date().toISOString()
      })
      .in('id', menuIds)
      .select();
    
    if (error) throw error;
    
    return {
      success: true,
      updatedCount: data ? data.length : 0,
      restaurant: restaurant
    };
  } catch (error) {
    console.error('[Database] Error reassigning menus:', error);
    return {
      success: false,
      error: error.message || 'Failed to reassign menus'
    };
  }
}

/**
 * Activate a specific menu version
 */
async function activateMenu(menuId) {
  if (!isDatabaseAvailable()) return null;
  
  try {
    // Get the menu to find restaurant_id and platform_id
    const { data: menu, error: menuError } = await getSupabaseClient()
      .from('menus')
      .select('restaurant_id, platform_id')
      .eq('id', menuId)
      .single();
    
    if (menuError) throw menuError;
    
    // Deactivate all other menus for this restaurant/platform
    const { error: deactivateError } = await getSupabaseClient()
      .from('menus')
      .update({ is_active: false })
      .eq('restaurant_id', menu.restaurant_id)
      .eq('platform_id', menu.platform_id);
    
    if (deactivateError) throw deactivateError;
    
    // Activate the specified menu
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('menus')
      .update({ is_active: true })
      .eq('id', menuId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('[Database] Error activating menu:', error);
    return null;
  }
}

/**
 * Deactivate a specific menu
 */
async function deactivateMenu(menuId) {
  if (!isDatabaseAvailable()) return null;
  
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('menus')
      .update({ is_active: false })
      .eq('id', menuId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('[Database] Error deactivating menu:', error);
    return null;
  }
}

/**
 * Toggle menu active status
 */
async function toggleMenuStatus(menuId, isActive) {
  if (!isDatabaseAvailable()) return null;
  
  try {
    if (isActive) {
      // If activating, deactivate others and activate this one
      return await activateMenu(menuId);
    } else {
      // If deactivating, just deactivate this one
      return await deactivateMenu(menuId);
    }
  } catch (error) {
    console.error('[Database] Error toggling menu status:', error);
    return null;
  }
}

/**
 * Hard delete a menu and all associated records
 */
async function deleteMenu(menuId) {
  if (!isDatabaseAvailable()) return false;
  
  try {
    // First, get all menu_items for this menu to delete associated images
    const { data: menuItems, error: itemsError } = await getSupabaseClient()
      .from('menu_items')
      .select('id')
      .eq('menu_id', menuId);
    
    if (itemsError) throw itemsError;
    
    // Delete associated item_images if there are menu items
    if (menuItems && menuItems.length > 0) {
      const itemIds = menuItems.map(item => item.id);
      
      const { error: imagesError } = await getSupabaseClient()
        .from('item_images')
        .delete()
        .in('menu_item_id', itemIds);
      
      if (imagesError) {
        console.error('[Database] Error deleting item images:', imagesError);
        // Continue with deletion even if images fail
      }
    }
    
    // Delete all menu_items for this menu
    const { error: deleteItemsError } = await getSupabaseClient()
      .from('menu_items')
      .delete()
      .eq('menu_id', menuId);
    
    if (deleteItemsError) throw deleteItemsError;
    
    // Finally, delete the menu itself
    const { data, error: deleteMenuError } = await getSupabaseClient()
      .from('menus')
      .delete()
      .eq('id', menuId)
      .select();
    
    if (deleteMenuError) throw deleteMenuError;
    
    // Return true if a menu was deleted
    return data && data.length > 0;
  } catch (error) {
    console.error('[Database] Error deleting menu:', error);
    return false;
  }
}

/**
 * Compare two menu versions
 */
async function compareMenus(menuId1, menuId2) {
  if (!isDatabaseAvailable()) return null;
  
  try {
    // Get both menus with their items
    const [menu1, menu2] = await Promise.all([
      getMenuWithItems(menuId1),
      getMenuWithItems(menuId2)
    ]);
    
    if (!menu1 || !menu2) {
      throw new Error('One or both menus not found');
    }
    
    // Build comparison data
    const comparison = {
      menu1: {
        id: menu1.id,
        version: menu1.version,
        created_at: menu1.created_at,
        categories: menu1.categories?.length || 0,
        items: 0
      },
      menu2: {
        id: menu2.id,
        version: menu2.version,
        created_at: menu2.created_at,
        categories: menu2.categories?.length || 0,
        items: 0
      },
      differences: {
        added: [],
        removed: [],
        modified: []
      }
    };
    
    // Create item maps for comparison
    const items1 = new Map();
    const items2 = new Map();
    
    menu1.categories?.forEach(cat => {
      cat.menu_items?.forEach(item => {
        comparison.menu1.items++;
        items1.set(item.name, { ...item, category: cat.name });
      });
    });
    
    menu2.categories?.forEach(cat => {
      cat.menu_items?.forEach(item => {
        comparison.menu2.items++;
        items2.set(item.name, { ...item, category: cat.name });
      });
    });
    
    // Find added and modified items
    for (const [name, item2] of items2) {
      const item1 = items1.get(name);
      if (!item1) {
        comparison.differences.added.push({
          name: item2.name,
          category: item2.category,
          price: item2.price
        });
      } else if (item1.price !== item2.price) {
        comparison.differences.modified.push({
          name: item2.name,
          category: item2.category,
          oldPrice: item1.price,
          newPrice: item2.price,
          change: item2.price - item1.price
        });
      }
    }
    
    // Find removed items
    for (const [name, item1] of items1) {
      if (!items2.has(name)) {
        comparison.differences.removed.push({
          name: item1.name,
          category: item1.category,
          price: item1.price
        });
      }
    }
    
    return comparison;
  } catch (error) {
    console.error('[Database] Error comparing menus:', error);
    return null;
  }
}

/**
 * Search menus by item name or description
 */
async function searchMenus(searchTerm, restaurantId = null) {
  if (!isDatabaseAvailable()) return [];
  
  try {
    let query = supabase
      .from('menu_items')
      .select(`
        *,
        menus!inner (
          id,
          version,
          is_active,
          restaurants (name, slug),
          platforms (name)
        ),
        categories (name)
      `)
      .or(`name.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`)
      .eq('menus.is_active', true);
    
    if (restaurantId) {
      query = query.eq('menus.restaurant_id', restaurantId);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('[Database] Error searching menus:', error);
    return [];
  }
}

/**
 * Get all extraction jobs with optional filters
 */
async function getExtractionJobs(filters = {}) {
  if (!isDatabaseAvailable()) return [];
  
  try {
    const client = getSupabaseClient();
    let query = client
      .from('extraction_jobs')
      .select(`
        *,
        restaurants (name, slug),
        platforms (name),
        menus!menus_extraction_job_id_fkey (id)
      `)
      .order('created_at', { ascending: false });
    
    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    
    if (filters.restaurantId) {
      query = query.eq('restaurant_id', filters.restaurantId);
    }
    
    if (filters.limit) {
      query = query.limit(filters.limit);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    // Transform the data to include menu_id at the top level
    const transformedData = data.map(job => ({
      ...job,
      menu_id: job.menus?.[0]?.id || null,
      menus: undefined // Remove the nested menus array
    }));
    
    return transformedData;
  } catch (error) {
    console.error('[Database] Error getting extraction jobs:', error);
    return [];
  }
}

/**
 * Cancel an extraction job
 */
async function cancelExtractionJob(jobId) {
  if (!isDatabaseAvailable()) return false;
  
  try {
    const { error } = await getSupabaseClient()
      .from('extraction_jobs')
      .update({
        status: 'cancelled',
        completed_at: new Date().toISOString(),
        error: 'Cancelled by user'
      })
      .eq('job_id', jobId);
    
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('[Database] Error cancelling extraction job:', error);
    return false;
  }
}

/**
 * Hard delete an extraction job and all associated data
 */
async function deleteExtraction(jobId) {
  if (!isDatabaseAvailable()) return false;
  
  try {
    // First, get the extraction job to find its UUID id
    const { data: extractionJob, error: jobError } = await getSupabaseClient()
      .from('extraction_jobs')
      .select('id')
      .eq('job_id', jobId)
      .single();
    
    if (jobError || !extractionJob) {
      console.error('[Database] Extraction job not found:', jobId);
      return false;
    }
    
    const extractionUuid = extractionJob.id;
    
    // Find all menus associated with this extraction job (using UUID)
    const { data: menus, error: menuError } = await getSupabaseClient()
      .from('menus')
      .select('id')
      .eq('extraction_job_id', extractionUuid);
    
    if (menuError) throw menuError;
    
    // Delete all associated menus (which will cascade delete menu_items and item_images)
    if (menus && menus.length > 0) {
      for (const menu of menus) {
        await deleteMenu(menu.id);
      }
    }
    
    // Delete extraction logs associated with this job
    const { error: logsError } = await getSupabaseClient()
      .from('extraction_logs')
      .delete()
      .eq('job_id', jobId);
    
    if (logsError) {
      console.error('[Database] Error deleting extraction logs:', logsError);
      // Continue even if logs deletion fails
    }
    
    // Finally, delete the extraction job itself
    const { data, error: deleteError } = await getSupabaseClient()
      .from('extraction_jobs')
      .delete()
      .eq('job_id', jobId)
      .select();
    
    if (deleteError) throw deleteError;
    
    // Return true if an extraction was deleted
    return data && data.length > 0;
  } catch (error) {
    console.error('[Database] Error deleting extraction:', error);
    return false;
  }
}

/**
 * Create a new restaurant
 */
async function createRestaurant(restaurantData) {
  if (!isDatabaseAvailable()) {
    console.error('[Database] Database not available for createRestaurant');
    return null;
  }
  
  console.log('[Database] Creating restaurant with data:', {
    name: restaurantData.name,
    fields: Object.keys(restaurantData),
    dataPreview: JSON.stringify(restaurantData).substring(0, 200)
  });
  
  try {
    // Get organization ID for slug uniqueness
    const orgId = getCurrentOrganizationId();
    const orgSuffix = orgId.substring(0, 8);
    
    // Generate base slug if not provided - append org ID for uniqueness
    let baseSlug = restaurantData.slug || restaurantData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    let slug = `${baseSlug}-${orgSuffix}`;
    let slugSuffix = 1;
    
    // Check for existing slugs and append number if needed
    let slugExists = true;
    while (slugExists) {
      const { data: existing } = await getSupabaseClient()
        .from('restaurants')
        .select('id')
        .eq('slug', slug)
        .single();
      
      if (existing) {
        slug = `${baseSlug}-${orgSuffix}-${slugSuffix}`;
        slugSuffix++;
      } else {
        slugExists = false;
      }
    }
    
    // Remove any relation fields that might be passed in
    const { 
      menus,
      restaurant_platforms,
      restaurants,
      platforms,
      menu_items,
      extraction_jobs,
      ...cleanData 
    } = restaurantData;
    
    const insertData = {
      ...cleanData,
      slug: slug,
      organisation_id: orgId, // Use the org ID variable we already have
      metadata: restaurantData.metadata || {},
      onboarding_status: restaurantData.onboarding_status || 'lead',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    console.log('[Database] Insert data prepared:', {
      slug: insertData.slug,
      hasMetadata: !!insertData.metadata,
      fieldsCount: Object.keys(insertData).length
    });
    
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('restaurants')
      .insert(insertData)
      .select()
      .single();
    
    if (error) {
      console.error('[Database] Supabase insert error:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });
      throw error;
    }
    
    console.log('[Database] Successfully created restaurant:', {
      id: data.id,
      name: data.name,
      slug: data.slug
    });
    
    return data;
  } catch (error) {
    console.error('[Database] Error creating restaurant:', {
      error: error.message || error,
      stack: error.stack
    });
    return null;
  }
}

/**
 * Update a restaurant
 */
async function updateRestaurant(restaurantId, updates) {
  if (!isDatabaseAvailable()) return null;
  
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('restaurants')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', restaurantId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('[Database] Error updating restaurant:', error);
    return null;
  }
}

/**
 * Hard delete a restaurant and all associated data
 */
async function deleteRestaurant(restaurantId) {
  if (!isDatabaseAvailable()) return false;
  
  try {
    // First, find all extraction jobs for this restaurant
    const { data: extractions, error: extractionError } = await getSupabaseClient()
      .from('extraction_jobs')
      .select('job_id')
      .eq('restaurant_id', restaurantId);
    
    if (extractionError) throw extractionError;
    
    // Delete all associated extractions (which will cascade delete menus, menu_items, and item_images)
    if (extractions && extractions.length > 0) {
      for (const extraction of extractions) {
        await deleteExtraction(extraction.job_id);
      }
    }
    
    // Find and delete any remaining menus that might not have extraction_job_id
    const { data: menus, error: menuError } = await getSupabaseClient()
      .from('menus')
      .select('id')
      .eq('restaurant_id', restaurantId);
    
    if (menuError) throw menuError;
    
    if (menus && menus.length > 0) {
      for (const menu of menus) {
        await deleteMenu(menu.id);
      }
    }
    
    // Finally, delete the restaurant itself
    const { data, error: deleteError } = await getSupabaseClient()
      .from('restaurants')
      .delete()
      .eq('id', restaurantId)
      .select();
    
    if (deleteError) throw deleteError;
    
    // Return true if a restaurant was deleted
    return data && data.length > 0;
  } catch (error) {
    console.error('[Database] Error deleting restaurant:', error);
    return false;
  }
}

/**
 * Get complete restaurant details including workflow fields
 */
async function getRestaurantDetails(restaurantId) {
  if (!isDatabaseAvailable()) return null;
  
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('restaurants')
      .select(`
        *,
        restaurant_platforms (
          url,
          platform_id,
          last_scraped_at,
          platforms (name, id)
        ),
        menus (
          id,
          version,
          is_active,
          created_at,
          platforms (name)
        )
      `)
      .eq('id', restaurantId)
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('[Database] Error getting restaurant details:', error);
    return null;
  }
}

/**
 * Update restaurant workflow fields
 */
async function updateRestaurantWorkflow(restaurantId, workflowData) {
  if (!isDatabaseAvailable()) {
    console.error('[Database] Database not available for updateRestaurantWorkflow');
    return null;
  }
  
  console.log('[Database] Updating restaurant workflow:', {
    restaurantId,
    fields: Object.keys(workflowData),
    dataPreview: JSON.stringify(workflowData).substring(0, 200)
  });
  
  try {
    // Remove only relation fields, keep platform URLs
    const { 
      menus,                  // Remove relation field
      restaurant_platforms,   // Remove relation field
      restaurants,            // Remove relation field
      platforms,              // Remove relation field
      menu_items,             // Remove relation field
      extraction_jobs,        // Remove relation field
      ...cleanData 
    } = workflowData;
    
    // Update main restaurant record including platform URLs
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('restaurants')
      .update({
        ...cleanData,
        updated_at: new Date().toISOString()
      })
      .eq('id', restaurantId)
      .select()
      .single();
    
    if (error) {
      console.error('[Database] Supabase update error:', {
        error: error,
        restaurantId: restaurantId,
        updateData: cleanData
      });
      throw error;
    }
    
    console.log('[Database] Successfully updated restaurant workflow:', {
      restaurantId: data.id,
      name: data.name
    });
    return data;
  } catch (error) {
    console.error('[Database] Error updating restaurant workflow:', {
      error: error.message || error,
      restaurantId: restaurantId,
      stack: error.stack
    });
    return null;
  }
}

/**
 * Duplicate a menu
 */
async function duplicateMenu(menuId) {
  if (!isDatabaseAvailable()) return null;
  
  try {
    // Get the original menu with all items
    const originalMenu = await getMenuWithItems(menuId);
    if (!originalMenu) {
      throw new Error('Menu not found');
    }
    
    // Create new menu
    const newMenu = await createMenu({
      restaurantId: originalMenu.restaurant_id,
      extractionJobId: originalMenu.extraction_job_id,
      platformId: originalMenu.platform_id,
      rawData: originalMenu.menu_data
    });
    
    if (!newMenu) {
      throw new Error('Failed to create duplicate menu');
    }
    
    // Duplicate categories and items
    if (originalMenu.categories) {
      const categoryMap = {};
      
      // Create categories
      for (const cat of originalMenu.categories) {
        const { data: newCat, error } = await getSupabaseClient()
          .from('categories')
          .insert({
            menu_id: newMenu.id,
            name: cat.name,
            description: cat.description,
            position: cat.position,
            selector: cat.selector
          })
          .select()
          .single();
        
        if (!error && newCat) {
          categoryMap[cat.id] = newCat.id;
        }
      }
      
      // Create items
      for (const cat of originalMenu.categories) {
        if (cat.menu_items) {
          for (const item of cat.menu_items) {
            const { data: newItem, error } = await getSupabaseClient()
              .from('menu_items')
              .insert({
                menu_id: newMenu.id,
                category_id: categoryMap[cat.id],
                name: item.name,
                description: item.description,
                price: item.price,
                currency: item.currency,
                tags: item.tags,
                dietary_info: item.dietary_info,
                platform_item_id: item.platform_item_id,
                is_available: item.is_available,
                metadata: item.metadata
              })
              .select()
              .single();
            
            // Duplicate images if exist
            if (!error && newItem && item.item_images) {
              for (const img of item.item_images) {
                await client
                  .from('item_images')
                  .insert({
                    menu_item_id: newItem.id,
                    url: img.url,
                    type: img.type
                  });
              }
            }
          }
        }
      }
    }
    
    return newMenu;
  } catch (error) {
    console.error('[Database] Error duplicating menu:', error);
    return null;
  }
}

/**
 * Update a single menu item
 */
async function updateMenuItem(itemId, updates) {
  if (!isDatabaseAvailable()) return null;
  
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('menu_items')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', itemId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('[Database] Error updating menu item:', error);
    return null;
  }
}

/**
 * Bulk update menu items
 */
async function bulkUpdateMenuItems(updates) {
  if (!isDatabaseAvailable()) return [];
  
  console.log('[Database] Bulk update called with', updates.length, 'items');
  
  try {
    const results = [];
    
    for (const update of updates) {
      // Log the full update object to see if category is present
      console.log('[Database] Processing update:', JSON.stringify(update, null, 2));
      const { id, imageURL, is_deleted, ...data } = update;
      
      // Check if item should be deleted
      if (is_deleted) {
        console.log('[Database] Deleting item:', id);
        
        // Delete the menu item and its associations
        // First delete image associations
        await getSupabaseClient()
          .from('item_images')
          .delete()
          .eq('menu_item_id', id);
        
        // Then delete the menu item itself
        const { error } = await getSupabaseClient()
          .from('menu_items')
          .delete()
          .eq('id', id);
        
        if (!error) {
          console.log('[Database] Successfully deleted item:', id);
          results.push({ id, deleted: true });
        } else {
          console.error('[Database] Error deleting item:', id, error);
        }
        continue; // Skip to next item
      }
      
      // Handle category rename if category field is present
      let updateData = { ...data };
      if (data.category) {
        console.log('[Database] Category field detected:', data.category);
        // Remove category name from update data as it's not a column
        const { category, ...restData } = updateData;
        updateData = restData;
        
        // Find or create the category with the new name
        // First, get the menu_id from the existing item
        const { data: existingItem, error: itemError } = await getSupabaseClient()
          .from('menu_items')
          .select('menu_id')
          .eq('id', id)
          .single();
        
        console.log('[Database] Existing item lookup:', { existingItem, itemError });
          
        if (existingItem) {
          // Check if category with new name exists
          let { data: existingCategory, error: catError } = await getSupabaseClient()
            .from('categories')
            .select('id')
            .eq('menu_id', existingItem.menu_id)
            .eq('name', category)
            .single();
          
          console.log('[Database] Category lookup result:', { existingCategory, catError });
          
          if (!existingCategory) {
            // Create new category
            console.log('[Database] Creating new category:', category);
            const orgId = getCurrentOrganizationId();
            const { data: newCategory, error: createError } = await getSupabaseClient()
              .from('categories')
              .insert({
                menu_id: existingItem.menu_id,
                name: category,
                organisation_id: orgId,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              })
              .select()
              .single();
            
            console.log('[Database] New category created:', { newCategory, createError });
            existingCategory = newCategory;
          }
          
          if (existingCategory) {
            // Update item with new category_id
            updateData.category_id = existingCategory.id;
            console.log('[Database] Setting category_id:', existingCategory.id);
          }
        }
      }
      
      // Update the menu item (excluding imageURL as it's handled separately)
      console.log('[Database] Updating item:', id, 'with data:', updateData);
      
      const { data: updated, error } = await getSupabaseClient()
        .from('menu_items')
        .update({
          ...updateData,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();
      
      if (!error && updated) {
        console.log('[Database] Successfully updated item:', id);
        // Handle image updates separately - ONLY if imageURL is explicitly provided
        if (imageURL !== undefined) {
          // Get existing images
          const { data: existingImages } = await getSupabaseClient()
            .from('item_images')
            .select('id, url')
            .eq('menu_item_id', id);
          
          const hasExistingImage = existingImages && existingImages.length > 0;
          const existingImageUrl = hasExistingImage ? existingImages[0].url : null;
          
          // If imageURL is null or empty string, delete the image association
          if (imageURL === null || imageURL === '') {
            if (hasExistingImage) {
              console.log('[Database] Deleting image association for item:', id);
              await getSupabaseClient()
                .from('item_images')
                .delete()
                .eq('menu_item_id', id);
            }
          } else if (imageURL && imageURL !== existingImageUrl) {
            // Only update if the URL has actually changed
            if (hasExistingImage) {
              // Update existing image
              console.log('[Database] Updating image URL for item:', id);
              await getSupabaseClient()
                .from('item_images')
                .update({ url: imageURL })
                .eq('menu_item_id', id);
            } else {
              // Create new image association
              console.log('[Database] Creating new image association for item:', id);
              await getSupabaseClient()
                .from('item_images')
                .insert({
                  menu_item_id: id,
                  url: imageURL,
                  is_primary: true
                });
            }
          }
          // If imageURL is the same as existing, do nothing
        }
        // If imageURL is undefined, preserve existing images (don't touch them)
        
        // Fetch the updated item with its images
        const { data: itemWithImages } = await getSupabaseClient()
          .from('menu_items')
          .select('*, item_images(url)')
          .eq('id', id)
          .single();
        
        results.push(itemWithImages || updated);
      } else if (error) {
        console.error('[Database] Error updating item:', id, error);
      } else {
        console.log('[Database] No update performed for item:', id);
      }
    }
    
    console.log('[Database] Bulk update completed. Results:', results.length);
    return results;
  } catch (error) {
    console.error('[Database] Error bulk updating menu items:', error);
    return [];
  }
}

/**
 * Add item to category
 */
async function addItemToCategory(categoryId, itemData) {
  if (!isDatabaseAvailable()) return null;
  
  try {
    // Get category to find menu_id
    const { data: category, error: catError } = await getSupabaseClient()
      .from('categories')
      .select('menu_id')
      .eq('id', categoryId)
      .single();
    
    if (catError) throw catError;
    
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('menu_items')
      .insert({
        menu_id: category.menu_id,
        category_id: categoryId,
        name: itemData.name,
        description: itemData.description,
        price: itemData.price,
        currency: itemData.currency || 'NZD',
        tags: itemData.tags || [],
        dietary_info: itemData.dietary_info || {},
        is_available: itemData.is_available !== false,
        metadata: itemData.metadata || {}
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('[Database] Error adding item to category:', error);
    return null;
  }
}

/**
 * Get price history for restaurant
 */
async function getPriceHistory(restaurantId, itemId = null) {
  if (!isDatabaseAvailable()) return [];
  
  try {
    let query = supabase
      .from('price_history')
      .select(`
        *,
        menu_items (name, category_id),
        extraction_jobs (created_at)
      `)
      .order('detected_at', { ascending: false });
    
    // Join through menu_items to get restaurant
    if (restaurantId) {
      // This requires a more complex query through menus
      const { data: menus } = await getSupabaseClient()
        .from('menus')
        .select('id')
        .eq('restaurant_id', restaurantId);
      
      if (menus) {
        const menuIds = menus.map(m => m.id);
        query = supabase
          .from('price_history')
          .select(`
            *,
            menu_items!inner (
              name,
              category_id,
              menu_id
            ),
            extraction_jobs (created_at)
          `)
          .in('menu_items.menu_id', menuIds)
          .order('detected_at', { ascending: false });
      }
    }
    
    if (itemId) {
      query = query.eq('menu_item_id', itemId);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('[Database] Error getting price history:', error);
    return [];
  }
}

/**
 * Get extraction statistics
 */
async function getExtractionStats() {
  if (!isDatabaseAvailable()) return null;
  
  try {
    // Get overall stats
    const { data: jobs, error: jobsError } = await getSupabaseClient()
      .from('extraction_jobs')
      .select('status, created_at, completed_at');
    
    if (jobsError) throw jobsError;
    
    const stats = {
      totalExtractions: jobs.length,
      successful: jobs.filter(j => j.status === 'completed').length,
      failed: jobs.filter(j => j.status === 'failed').length,
      avgDuration: 0,
      successRate: 0,
      itemsPerMenu: 0
    };
    
    // Calculate average duration
    const completedJobs = jobs.filter(j => j.status === 'completed' && j.completed_at);
    if (completedJobs.length > 0) {
      const durations = completedJobs.map(j => {
        const start = new Date(j.created_at);
        const end = new Date(j.completed_at);
        return (end - start) / 1000; // seconds
      });
      stats.avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    }
    
    // Calculate success rate
    if (jobs.length > 0) {
      stats.successRate = (stats.successful / jobs.length) * 100;
    }
    
    // Get items per menu average
    const { data: menus, error: menusError } = await getSupabaseClient()
      .from('menus')
      .select(`
        id,
        menu_items (id)
      `);
    
    if (!menusError && menus && menus.length > 0) {
      const itemCounts = menus.map(m => m.menu_items?.length || 0);
      stats.itemsPerMenu = itemCounts.reduce((a, b) => a + b, 0) / menus.length;
    }
    
    return stats;
  } catch (error) {
    console.error('[Database] Error getting extraction stats:', error);
    return null;
  }
}

/**
 * CDN Upload Operations
 */

/**
 * Get menu images for CDN upload
 */
async function getMenuImagesForUpload(menuId) {
  if (!isDatabaseAvailable()) return [];
  
  try {
    const client = getSupabaseClient();
    
    // First get menu items for this menu
    const { data: menuItems, error: menuError } = await client
      .from('menu_items')
      .select('id')
      .eq('menu_id', menuId);
    
    if (menuError) throw menuError;
    
    const menuItemIds = menuItems.map(item => item.id);
    
    // Then get images for these menu items
    const { data, error } = await client
      .from('item_images')
      .select(`
        *,
        menu_items (
          id,
          name,
          menu_id,
          categories (
            id,
            name
          )
        )
      `)
      .in('menu_item_id', menuItemIds)
      .or('cdn_uploaded.eq.false,cdn_uploaded.is.null');
    
    if (error) throw error;
    
    // Transform the data to include item and category names
    const transformedData = data.map(image => ({
      ...image,
      itemName: image.menu_items?.name,
      categoryName: image.menu_items?.categories?.name,
      menuItemId: image.menu_item_id
    }));
    
    console.log(`[Database] Found ${transformedData.length} images to upload for menu ${menuId}`);
    return transformedData;
  } catch (error) {
    console.error('[Database] Error getting menu images for upload:', error);
    return [];
  }
}

/**
 * Update image with CDN information
 */
async function updateImageCDNInfo(imageId, cdnData) {
  if (!isDatabaseAvailable()) return null;
  
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('item_images')
      .update({
        cdn_uploaded: true,
        cdn_id: cdnData.cdnId,
        cdn_url: cdnData.cdnUrl,
        cdn_filename: cdnData.filename,
        cdn_metadata: cdnData.metadata || {},
        upload_status: 'success',
        uploaded_at: new Date().toISOString()
      })
      .eq('id', imageId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('[Database] Error updating image CDN info:', error);
    return null;
  }
}

/**
 * Mark image upload as failed
 */
async function markImageUploadFailed(imageId, errorMessage) {
  if (!isDatabaseAvailable()) return null;
  
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('item_images')
      .update({
        upload_status: 'failed',
        upload_error: errorMessage,
        cdn_uploaded: false
      })
      .eq('id', imageId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('[Database] Error marking image upload as failed:', error);
    return null;
  }
}

/**
 * Create upload batch record
 */
async function createUploadBatch(menuId, totalImages) {
  if (!isDatabaseAvailable()) return null;
  
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('upload_batches')
      .insert({
        menu_id: menuId,
        total_images: totalImages,
        uploaded_count: 0,
        failed_count: 0,
        status: 'pending',
        started_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) throw error;
    console.log(`[Database] Created upload batch ${data.id} for ${totalImages} images`);
    return data;
  } catch (error) {
    console.error('[Database] Error creating upload batch:', error);
    return null;
  }
}

/**
 * Update upload batch progress
 */
async function updateUploadBatch(batchId, updates) {
  if (!isDatabaseAvailable()) return null;
  
  try {
    const client = getSupabaseClient();
    const updateData = {
      ...updates,
      updated_at: new Date().toISOString()
    };
    
    // Add completed_at if status is completed or failed
    if (updates.status === 'completed' || updates.status === 'failed') {
      updateData.completed_at = new Date().toISOString();
    }
    
    const { data, error } = await client
      .from('upload_batches')
      .update(updateData)
      .eq('id', batchId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('[Database] Error updating upload batch:', error);
    return null;
  }
}

/**
 * Get upload batch by ID
 */
async function getUploadBatch(batchId) {
  if (!isDatabaseAvailable()) return null;
  
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('upload_batches')
      .select(`
        *,
        menus (
          id,
          restaurants (name)
        )
      `)
      .eq('id', batchId)
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('[Database] Error getting upload batch:', error);
    return null;
  }
}

/**
 * Get pending images for batch (for resume functionality)
 */
async function getPendingImagesForBatch(batchId) {
  if (!isDatabaseAvailable()) return [];
  
  try {
    // Get the batch to find menu_id
    const batch = await getUploadBatch(batchId);
    if (!batch) return [];
    
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('item_images')
      .select(`
        *,
        menu_items!inner (
          id,
          name,
          menu_id,
          categories (
            name
          )
        )
      `)
      .eq('menu_items.menu_id', batch.menu_id)
      .or('cdn_uploaded.eq.false,cdn_uploaded.is.null')
      .neq('upload_status', 'success');
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('[Database] Error getting pending images for batch:', error);
    return [];
  }
}

/**
 * Get menu CDN images (for rollback)
 */
async function getMenuCDNImages(menuId) {
  if (!isDatabaseAvailable()) return [];
  
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('item_images')
      .select(`
        *,
        menu_items!inner (
          menu_id
        )
      `)
      .eq('menu_items.menu_id', menuId)
      .eq('cdn_uploaded', true)
      .not('cdn_id', 'is', null);
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('[Database] Error getting menu CDN images:', error);
    return [];
  }
}

/**
 * Clear image CDN info (for rollback)
 */
async function clearImageCDNInfo(imageId) {
  if (!isDatabaseAvailable()) return null;
  
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('item_images')
      .update({
        cdn_uploaded: false,
        cdn_id: null,
        cdn_url: null,
        cdn_filename: null,
        cdn_metadata: null,
        upload_status: null,
        upload_error: null,
        uploaded_at: null
      })
      .eq('id', imageId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('[Database] Error clearing image CDN info:', error);
    return null;
  }
}

/**
 * Get CDN upload statistics for a menu
 */
async function getMenuCDNStats(menuId) {
  if (!isDatabaseAvailable()) return null;
  
  try {
    const client = getSupabaseClient();
    
    // First get menu items for this menu
    const { data: menuItems, error: menuError } = await client
      .from('menu_items')
      .select('id')
      .eq('menu_id', menuId);
    
    if (menuError) throw menuError;
    
    const menuItemIds = menuItems.map(item => item.id);
    
    // Then get images for these menu items
    const { data: images, error } = await client
      .from('item_images')
      .select('cdn_uploaded, upload_status')
      .in('menu_item_id', menuItemIds);
    
    if (error) throw error;
    
    const stats = {
      totalImages: images.length,
      uploadedImages: images.filter(img => img.cdn_uploaded === true).length,
      failedUploads: images.filter(img => img.upload_status === 'failed').length,
      pendingUploads: images.filter(img => !img.cdn_uploaded && img.upload_status !== 'failed').length,
      uploadPercentage: 0
    };
    
    if (stats.totalImages > 0) {
      stats.uploadPercentage = Math.round((stats.uploadedImages / stats.totalImages) * 100);
    }
    
    return stats;
  } catch (error) {
    console.error('[Database] Error getting menu CDN stats:', error);
    return null;
  }
}

/**
 * Find existing CDN image by original URL (for deduplication)
 */
async function findCDNImageByUrl(originalUrl) {
  if (!isDatabaseAvailable()) return null;
  
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('item_images')
      .select('*')
      .eq('url', originalUrl)
      .eq('cdn_uploaded', true)
      .not('cdn_id', 'is', null)
      .limit(1)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows found
    return data;
  } catch (error) {
    console.error('[Database] Error finding CDN image by URL:', error);
    return null;
  }
}

// Export all functions
module.exports = {
  get supabase() { return supabase; },
  initializeDatabase,
  isDatabaseAvailable,
  setCurrentOrganizationId,
  getCurrentOrganizationId,
  setUserSupabaseClient,
  
  // Platform operations
  getPlatformByName,
  
  // Restaurant operations
  upsertRestaurant,
  createRestaurant,
  updateRestaurant,
  deleteRestaurant,
  updateRestaurantWorkflow,
  getAllRestaurants,
  getAllRestaurantsList,
  getRestaurantById,
  getRestaurantDetails,
  getRestaurantMenus,
  getAllMenus,
  getMenuByExtractionJobId,
  reassignMenusToRestaurant,
  
  // Extraction job operations
  createExtractionJob,
  updateExtractionJob,
  getExtractionJob,
  getExtractionJobs,
  cancelExtractionJob,
  deleteExtraction,
  
  // Menu operations
  createMenu,
  activateMenu,
  deactivateMenu,
  toggleMenuStatus,
  deleteMenu,
  duplicateMenu,
  compareMenus,
  
  // Category operations
  createCategories,
  addItemToCategory,
  
  // Menu item operations
  createMenuItems,
  updateMenuItem,
  bulkUpdateMenuItems,
  saveMenuItem,
  
  // Option set operations
  saveOptionSet,
  saveOptionSetItem,
  updateMenuItemOptionSets,
  bulkSaveOptionSets,
  bulkSaveUniqueOptionSets,
  bulkCreateJunctionEntries,
  getOptionSetsByMenuItem,
  
  // Image operations
  createItemImages,
  
  // CDN Upload operations
  getMenuImagesForUpload,
  updateImageCDNInfo,
  markImageUploadFailed,
  createUploadBatch,
  updateUploadBatch,
  getUploadBatch,
  getPendingImagesForBatch,
  getMenuCDNImages,
  clearImageCDNInfo,
  getMenuCDNStats,
  findCDNImageByUrl,
  
  // Log operations
  createExtractionLog,
  
  // Search operations
  searchMenus,
  
  // Analytics operations
  getPriceHistory,
  getExtractionStats,
  
  // Combined operations
  saveExtractionResults,
  getMenuWithItems,
  getActiveMenuItems,
  getMenuIdForJob
};