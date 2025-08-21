/**
 * Database Service Module
 * Handles all Supabase database operations for menu extraction system
 */

const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_KEY;

let supabase = null;

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

// Check if database is available
function isDatabaseAvailable() {
  return supabase !== null;
}

/**
 * Platform Operations
 */
async function getPlatformByName(platformName) {
  if (!isDatabaseAvailable()) return null;
  
  try {
    const { data, error } = await supabase
      .from('platforms')
      .select('*')
      .eq('name', platformName)
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
async function upsertRestaurant(restaurantData) {
  if (!isDatabaseAvailable()) return null;
  
  const { name, url, platformName } = restaurantData;
  
  try {
    // Get platform
    const platform = await getPlatformByName(platformName);
    if (!platform) {
      throw new Error(`Platform ${platformName} not found`);
    }
    
    // Generate slug from name
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    
    // Try to find existing restaurant by slug
    let restaurant = await supabase
      .from('restaurants')
      .select('*')
      .eq('slug', slug)
      .single();
    
    if (restaurant.error && restaurant.error.code === 'PGRST116') {
      // Restaurant doesn't exist, create it
      const { data: newRestaurant, error: createError } = await supabase
        .from('restaurants')
        .insert({
          name,
          slug,
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
    const { error: platformError } = await supabase
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
    console.error('[Database] Error upserting restaurant:', error);
    return null;
  }
}

/**
 * Extraction Job Operations
 */
async function createExtractionJob(jobData) {
  if (!isDatabaseAvailable()) return null;
  
  try {
    const { data, error } = await supabase
      .from('extraction_jobs')
      .insert({
        job_id: jobData.jobId,
        restaurant_id: jobData.restaurantId,
        platform_id: jobData.platformId,
        url: jobData.url,
        job_type: jobData.jobType || 'full_menu',
        status: 'pending',
        config: jobData.config || {},
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
    const { data, error } = await supabase
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
    const { data, error } = await supabase
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
async function createMenu(menuData) {
  if (!isDatabaseAvailable()) return null;
  
  try {
    // Get the latest version for this restaurant
    const { data: latestMenu } = await supabase
      .from('menus')
      .select('version')
      .eq('restaurant_id', menuData.restaurantId)
      .eq('platform_id', menuData.platformId)
      .order('version', { ascending: false })
      .limit(1)
      .single();
    
    const newVersion = latestMenu ? latestMenu.version + 1 : 1;
    
    // Deactivate previous menus
    if (latestMenu) {
      await supabase
        .from('menus')
        .update({ is_active: false })
        .eq('restaurant_id', menuData.restaurantId)
        .eq('platform_id', menuData.platformId);
    }
    
    // Create new menu
    const { data, error } = await supabase
      .from('menus')
      .insert({
        restaurant_id: menuData.restaurantId,
        extraction_job_id: menuData.extractionJobId,
        platform_id: menuData.platformId,
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
async function createCategories(menuId, categories) {
  if (!isDatabaseAvailable()) return [];
  
  try {
    const categoryData = categories.map((cat, index) => ({
      menu_id: menuId,
      name: cat.name,
      description: cat.description,
      position: cat.position || index + 1,
      selector: cat.selector
    }));
    
    const { data, error } = await supabase
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
async function createMenuItems(menuId, categoryMap, items) {
  if (!isDatabaseAvailable()) return [];
  
  try {
    const itemData = items.map(item => ({
      menu_id: menuId,
      category_id: categoryMap[item.categoryName],
      name: item.dishName || item.name,
      description: item.dishDescription || item.description,
      price: item.dishPrice || item.price,
      currency: item.currency || 'NZD',
      tags: item.tags || [],
      dietary_info: item.dietaryInfo || {},
      platform_item_id: item.platformItemId,
      is_available: item.isAvailable !== false,
      metadata: item.metadata || {}
    }));
    
    const { data, error } = await supabase
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
async function createItemImages(itemImageMap) {
  if (!isDatabaseAvailable()) return [];
  
  try {
    const imageData = [];
    
    for (const [itemId, images] of Object.entries(itemImageMap)) {
      if (Array.isArray(images)) {
        images.forEach(img => {
          imageData.push({
            menu_item_id: itemId,
            url: img.url || img,
            type: img.type || 'primary'
          });
        });
      } else if (images) {
        imageData.push({
          menu_item_id: itemId,
          url: images,
          type: 'primary'
        });
      }
    }
    
    if (imageData.length === 0) return [];
    
    const { data, error } = await supabase
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
    const { data, error } = await supabase
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
    
    // Create menu
    const menu = await createMenu({
      restaurantId: job.restaurant_id,
      extractionJobId: job.id,
      platformId: job.platform_id,
      rawData: extractionData
    });
    
    if (!menu) {
      throw new Error('Failed to create menu');
    }
    
    // Extract categories from data
    const categories = extractionData.categories || [];
    const categoryRecords = await createCategories(menu.id, categories);
    
    // Create category map
    const categoryMap = {};
    categoryRecords.forEach(cat => {
      categoryMap[cat.name] = cat.id;
    });
    
    // Extract menu items
    const menuItems = extractionData.menuItems || [];
    const itemRecords = await createMenuItems(menu.id, categoryMap, menuItems);
    
    // Create item image map
    const itemImageMap = {};
    itemRecords.forEach((item, index) => {
      const originalItem = menuItems[index];
      if (originalItem.imageURL || originalItem.dishImageURL) {
        itemImageMap[item.id] = originalItem.imageURL || originalItem.dishImageURL;
      }
    });
    
    // Create item images
    await createItemImages(itemImageMap);
    
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
    const { data, error } = await supabase
      .from('menus')
      .select(`
        *,
        restaurants (name, slug),
        platforms (name),
        categories (
          id,
          name,
          position,
          menu_items (
            *,
            item_images (*)
          )
        )
      `)
      .eq('id', menuId)
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('[Database] Error getting menu with items:', error);
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

// Export all functions
module.exports = {
  initializeDatabase,
  isDatabaseAvailable,
  
  // Platform operations
  getPlatformByName,
  
  // Restaurant operations
  upsertRestaurant,
  
  // Extraction job operations
  createExtractionJob,
  updateExtractionJob,
  getExtractionJob,
  
  // Menu operations
  createMenu,
  
  // Category operations
  createCategories,
  
  // Menu item operations
  createMenuItems,
  
  // Image operations
  createItemImages,
  
  // Log operations
  createExtractionLog,
  
  // Combined operations
  saveExtractionResults,
  getMenuWithItems,
  getActiveMenuItems
};