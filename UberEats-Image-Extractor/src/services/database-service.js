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
    // Always use lowercase for consistency
    const normalizedName = platformName.toLowerCase();
    
    const { data, error } = await supabase
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
  if (!isDatabaseAvailable()) return null;
  
  const { name, url, platformName } = restaurantData;
  
  // Use provided org ID or fall back to default
  const orgId = organisationId || '00000000-0000-0000-0000-000000000000';
  
  try {
    // Get platform
    const platform = await getPlatformByName(platformName);
    if (!platform) {
      throw new Error(`Platform ${platformName} not found`);
    }
    
    // Generate slug from name
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    
    // Try to find existing restaurant by slug within organization
    let restaurant = await supabase
      .from('restaurants')
      .select('*')
      .eq('slug', slug)
      .eq('organisation_id', orgId)
      .single();
    
    if (restaurant.error && restaurant.error.code === 'PGRST116') {
      // Restaurant doesn't exist, create it
      const { data: newRestaurant, error: createError } = await supabase
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
async function createExtractionJob(jobData, organisationId = null) {
  if (!isDatabaseAvailable()) return null;
  
  // Use provided org ID or fall back to default
  const orgId = organisationId || '00000000-0000-0000-0000-000000000000';
  
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
async function createMenu(menuData, organisationId = null) {
  if (!isDatabaseAvailable()) return null;
  
  // Use provided org ID or fall back to default
  const orgId = organisationId || '00000000-0000-0000-0000-000000000000';
  
  try {
    // Get the latest version for this restaurant
    const { data: latestMenu } = await supabase
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
      await supabase
        .from('menus')
        .update({ is_active: false })
        .eq('restaurant_id', menuData.restaurantId)
        .eq('platform_id', menuData.platformId)
        .eq('organisation_id', orgId);
    }
    
    // Create new menu
    const { data, error } = await supabase
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

/**
 * Get all restaurants
 */
async function getAllRestaurants() {
  if (!isDatabaseAvailable()) return [];
  
  try {
    const { data, error } = await supabase
      .from('restaurants')
      .select(`
        *,
        restaurant_platforms (
          url,
          last_scraped_at,
          platforms (name)
        )
      `)
      .order('name');
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('[Database] Error getting all restaurants:', error);
    return [];
  }
}

/**
 * Get restaurant by ID
 */
async function getRestaurantById(restaurantId) {
  if (!isDatabaseAvailable()) return null;
  
  try {
    const { data, error } = await supabase
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
    const { data: menus, error } = await supabase
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
    const { data: menus, error } = await supabase
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
    const { data, error } = await supabase
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
    const { data: restaurant, error: restaurantError } = await supabase
      .from('restaurants')
      .select('id, name')
      .eq('id', restaurantId)
      .single();
    
    if (restaurantError || !restaurant) {
      throw new Error('Target restaurant not found');
    }
    
    // Update all menus with the new restaurant_id
    const { data, error } = await supabase
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
    const { data: menu, error: menuError } = await supabase
      .from('menus')
      .select('restaurant_id, platform_id')
      .eq('id', menuId)
      .single();
    
    if (menuError) throw menuError;
    
    // Deactivate all other menus for this restaurant/platform
    const { error: deactivateError } = await supabase
      .from('menus')
      .update({ is_active: false })
      .eq('restaurant_id', menu.restaurant_id)
      .eq('platform_id', menu.platform_id);
    
    if (deactivateError) throw deactivateError;
    
    // Activate the specified menu
    const { data, error } = await supabase
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
    const { data, error } = await supabase
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
    const { data: menuItems, error: itemsError } = await supabase
      .from('menu_items')
      .select('id')
      .eq('menu_id', menuId);
    
    if (itemsError) throw itemsError;
    
    // Delete associated item_images if there are menu items
    if (menuItems && menuItems.length > 0) {
      const itemIds = menuItems.map(item => item.id);
      
      const { error: imagesError } = await supabase
        .from('item_images')
        .delete()
        .in('menu_item_id', itemIds);
      
      if (imagesError) {
        console.error('[Database] Error deleting item images:', imagesError);
        // Continue with deletion even if images fail
      }
    }
    
    // Delete all menu_items for this menu
    const { error: deleteItemsError } = await supabase
      .from('menu_items')
      .delete()
      .eq('menu_id', menuId);
    
    if (deleteItemsError) throw deleteItemsError;
    
    // Finally, delete the menu itself
    const { data, error: deleteMenuError } = await supabase
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
    let query = supabase
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
    const { error } = await supabase
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
    const { data: extractionJob, error: jobError } = await supabase
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
    const { data: menus, error: menuError } = await supabase
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
    const { error: logsError } = await supabase
      .from('extraction_logs')
      .delete()
      .eq('job_id', jobId);
    
    if (logsError) {
      console.error('[Database] Error deleting extraction logs:', logsError);
      // Continue even if logs deletion fails
    }
    
    // Finally, delete the extraction job itself
    const { data, error: deleteError } = await supabase
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
    // Generate base slug if not provided
    let baseSlug = restaurantData.slug || restaurantData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    let slug = baseSlug;
    let slugSuffix = 1;
    
    // Check for existing slugs and append number if needed
    let slugExists = true;
    while (slugExists) {
      const { data: existing } = await supabase
        .from('restaurants')
        .select('id')
        .eq('slug', slug)
        .single();
      
      if (existing) {
        slug = `${baseSlug}-${slugSuffix}`;
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
    
    const { data, error } = await supabase
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
    const { data, error } = await supabase
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
    const { data: extractions, error: extractionError } = await supabase
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
    const { data: menus, error: menuError } = await supabase
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
    const { data, error: deleteError } = await supabase
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
    const { data, error } = await supabase
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
    const { data, error } = await supabase
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
        const { data: newCat, error } = await supabase
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
            const { data: newItem, error } = await supabase
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
                await supabase
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
    const { data, error } = await supabase
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
      const { id, imageURL, is_deleted, ...data } = update;
      
      // Check if item should be deleted
      if (is_deleted) {
        console.log('[Database] Deleting item:', id);
        
        // Delete the menu item and its associations
        // First delete image associations
        await supabase
          .from('item_images')
          .delete()
          .eq('menu_item_id', id);
        
        // Then delete the menu item itself
        const { error } = await supabase
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
        // Remove category name from update data as it's not a column
        const { category, ...restData } = updateData;
        updateData = restData;
        
        // Find or create the category with the new name
        // First, get the menu_id from the existing item
        const { data: existingItem } = await supabase
          .from('menu_items')
          .select('menu_id')
          .eq('id', id)
          .single();
          
        if (existingItem) {
          // Check if category with new name exists
          let { data: existingCategory } = await supabase
            .from('categories')
            .select('id')
            .eq('menu_id', existingItem.menu_id)
            .eq('name', category)
            .single();
          
          if (!existingCategory) {
            // Create new category
            const { data: newCategory } = await supabase
              .from('categories')
              .insert({
                menu_id: existingItem.menu_id,
                name: category,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              })
              .select()
              .single();
            
            existingCategory = newCategory;
          }
          
          if (existingCategory) {
            // Update item with new category_id
            updateData.category_id = existingCategory.id;
          }
        }
      }
      
      // Update the menu item (excluding imageURL as it's handled separately)
      console.log('[Database] Updating item:', id, 'with data:', updateData);
      
      const { data: updated, error } = await supabase
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
        // Handle image updates separately
        if (imageURL !== undefined) {
          // If imageURL is null, delete the image association
          if (imageURL === null) {
            // Delete existing image associations
            await supabase
              .from('item_images')
              .delete()
              .eq('menu_item_id', id);
          } else if (imageURL) {
            // First delete existing images
            await supabase
              .from('item_images')
              .delete()
              .eq('menu_item_id', id);
            
            // Then add the new image
            await supabase
              .from('item_images')
              .insert({
                menu_item_id: id,
                url: imageURL
              });
          }
        }
        
        // Fetch the updated item with its images
        const { data: itemWithImages } = await supabase
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
    const { data: category, error: catError } = await supabase
      .from('categories')
      .select('menu_id')
      .eq('id', categoryId)
      .single();
    
    if (catError) throw catError;
    
    const { data, error } = await supabase
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
      const { data: menus } = await supabase
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
    const { data: jobs, error: jobsError } = await supabase
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
    const { data: menus, error: menusError } = await supabase
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

// Export all functions
module.exports = {
  get supabase() { return supabase; },
  initializeDatabase,
  isDatabaseAvailable,
  
  // Platform operations
  getPlatformByName,
  
  // Restaurant operations
  upsertRestaurant,
  createRestaurant,
  updateRestaurant,
  deleteRestaurant,
  updateRestaurantWorkflow,
  getAllRestaurants,
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
  
  // Image operations
  createItemImages,
  
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
  getActiveMenuItems
};