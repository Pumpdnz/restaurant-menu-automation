/**
 * Onboarding Service Module
 * Handles all operations related to the onboarding database
 * 
 * This service manages the connection to the separate onboarding database
 * and provides methods for creating and updating onboarding records.
 */

const { createClient } = require('@supabase/supabase-js');

// Note: These credentials will need to be added to the .env file
// ONBOARDING_SUPABASE_URL=https://lqcgatpunhuiwcyqesap.supabase.co
// ONBOARDING_SUPABASE_SERVICE_KEY=<service_key_here>

// Initialize onboarding database client
let onboardingSupabase = null;

/**
 * Initialize the onboarding database connection
 * @returns {boolean} True if initialization successful
 */
const initializeOnboardingDatabase = () => {
  try {
    // Check if already initialized
    if (onboardingSupabase) {
      console.log('[Onboarding Service] Database client already initialized');
      return true;
    }

    // Check for required environment variables
    if (!process.env.ONBOARDING_SUPABASE_URL || !process.env.ONBOARDING_SUPABASE_SERVICE_KEY) {
      console.warn('[Onboarding Service] Missing environment variables. Service will operate in limited mode.');
      console.warn('[Onboarding Service] Add ONBOARDING_SUPABASE_URL and ONBOARDING_SUPABASE_SERVICE_KEY to .env file');
      return false;
    }

    // Create the client
    onboardingSupabase = createClient(
      process.env.ONBOARDING_SUPABASE_URL,
      process.env.ONBOARDING_SUPABASE_SERVICE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    console.log('[Onboarding Service] Database client initialized successfully');
    return true;
  } catch (error) {
    console.error('[Onboarding Service] Failed to initialize database:', error);
    return false;
  }
};

/**
 * Get onboarding record by email using database RPC function
 * @param {string} email - User email address
 * @returns {Promise<Object|null>} Onboarding record or null
 */
async function getOnboardingIdByEmail(email) {
  if (!onboardingSupabase) {
    console.warn('[Onboarding Service] Database not initialized. Attempting to initialize...');
    if (!initializeOnboardingDatabase()) {
      throw new Error('Onboarding database connection not available. Please configure ONBOARDING_SUPABASE credentials.');
    }
  }

  try {
    console.log('[Onboarding Service] Looking up onboarding record for:', email);

    // First get the onboarding_id using RPC
    const { data, error } = await onboardingSupabase
      .rpc('get_onboarding_id_by_email', {
        user_email: email
      });

    if (error) {
      console.error('[Onboarding Service] RPC error:', error);
      throw error;
    }

    if (!data || data.length === 0) {
      console.log('[Onboarding Service] No onboarding record found for:', email);
      return null;
    }

    const onboardingId = data[0].onboarding_id;
    console.log('[Onboarding Service] Found onboarding record:', onboardingId);

    // Now fetch the full record with all fields including GST and Google OAuth
    const { data: fullRecord, error: fetchError } = await onboardingSupabase
      .from('user_onboarding')
      .select('*')
      .eq('id', onboardingId)
      .single();

    if (fetchError) {
      console.error('[Onboarding Service] Error fetching full record:', fetchError);
      throw fetchError;
    }

    if (!fullRecord) {
      console.log('[Onboarding Service] Full record not found for ID:', onboardingId);
      return data[0]; // Return the basic data if full record not found
    }

    // Log what fields we actually got
    console.log('[Onboarding Service] Full record fields:', {
      has_gst: !!fullRecord.gst_number,
      gst_number: fullRecord.gst_number || 'not set',
      has_google_oauth: !!fullRecord.google_oauth_client_id,
      google_oauth_client_id: fullRecord.google_oauth_client_id ? '***' + fullRecord.google_oauth_client_id.slice(-4) : 'not set'
    });

    // Return the full record with the onboarding_id included
    return {
      ...data[0],
      ...fullRecord,
      onboarding_id: onboardingId // Ensure onboarding_id is included
    };
  } catch (error) {
    console.error('[Onboarding Service] Failed to get onboarding ID:', error);
    throw error;
  }
}

/**
 * Update onboarding record with restaurant data
 * @param {string} onboardingId - UUID of the onboarding record
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated record
 */
async function updateOnboardingRecord(onboardingId, updates) {
  if (!onboardingSupabase) {
    console.warn('[Onboarding Service] Database not initialized. Attempting to initialize...');
    if (!initializeOnboardingDatabase()) {
      throw new Error('Onboarding database connection not available. Please configure ONBOARDING_SUPABASE credentials.');
    }
  }

  try {
    console.log('[Onboarding Service] Updating onboarding record:', onboardingId);

    // Ensure venue_operating_hours is properly formatted if provided
    if (updates.venue_operating_hours) {
      // If it's an object/array, stringify it
      if (typeof updates.venue_operating_hours === 'object') {
        updates.venue_operating_hours = JSON.stringify(updates.venue_operating_hours);
      }
      // If it's already a string, leave it as is
    }

    // Add updated_at timestamp
    const updateData = {
      ...updates,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await onboardingSupabase
      .from('user_onboarding')
      .update(updateData)
      .eq('id', onboardingId)
      .select()
      .single();

    if (error) {
      console.error('[Onboarding Service] Update error:', error);
      throw error;
    }

    console.log('[Onboarding Service] Record updated successfully');
    return data;
  } catch (error) {
    console.error('[Onboarding Service] Failed to update record:', error);
    throw error;
  }
}

/**
 * Check if a user exists in the onboarding system
 * @param {string} email - User email address
 * @returns {Promise<boolean>} True if user exists
 */
async function checkUserExists(email) {
  try {
    const record = await getOnboardingIdByEmail(email);
    return record !== null;
  } catch (error) {
    console.error('[Onboarding Service] Error checking user existence:', error);
    return false;
  }
}

/**
 * Format operating hours from array format to descriptive string
 * @param {Array|Object} hours - Operating hours data
 * @returns {string} Formatted operating hours string
 */
function formatOperatingHours(hours) {
  if (!hours) {
    return 'Hours not specified';
  }

  try {
    // If it's already a string, return it
    if (typeof hours === 'string') {
      return hours;
    }

    // Handle array format (from restaurant.opening_hours)
    if (Array.isArray(hours)) {
      const formattedDays = hours
        .filter(day => day && day.day)
        .map(day => {
          if (!day.hours || (!day.hours.open && !day.hours.close)) {
            return `${day.day}: Closed`;
          }
          const open = day.hours.open || 'Closed';
          const close = day.hours.close || 'Closed';
          return `${day.day}: ${open} - ${close}`;
        })
        .filter(Boolean);

      return formattedDays.length > 0 ? formattedDays.join('. ') : 'Hours not specified';
    }

    // Handle object format with day keys
    if (typeof hours === 'object') {
      const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
      const descriptions = [];

      for (const day of days) {
        if (hours[day]) {
          const dayHours = hours[day];
          if (dayHours.closed) {
            descriptions.push(`${day.charAt(0).toUpperCase() + day.slice(1)}: Closed`);
          } else if (dayHours.times && dayHours.times.length > 0) {
            const timeRanges = dayHours.times.map(t => `${t.open} - ${t.close}`).join(' & ');
            descriptions.push(`${day.charAt(0).toUpperCase() + day.slice(1)}: ${timeRanges}`);
          }
        }
      }

      return descriptions.length > 0 ? descriptions.join('. ') : 'Hours not specified';
    }

    return 'Hours not specified';
  } catch (error) {
    console.error('[Onboarding Service] Error formatting operating hours:', error);
    return 'Hours not specified';
  }
}

/**
 * Generate a default password following the convention
 * @param {string} restaurantName - Restaurant name
 * @returns {string} Generated password
 */
function generateDefaultPassword(restaurantName) {
  if (!restaurantName) {
    return 'TempPassword789!';
  }

  // Remove special characters and spaces
  const cleanName = restaurantName.replace(/[^a-zA-Z0-9]/g, '');
  
  // Ensure we have something to work with
  if (!cleanName) {
    return 'Restaurant789!';
  }
  
  // Capitalize first letter, lowercase the rest
  const formatted = cleanName.charAt(0).toUpperCase() + cleanName.slice(1).toLowerCase();
  
  // Add standard suffix
  return `${formatted}789!`;
}

// Attempt to initialize on module load
initializeOnboardingDatabase();

module.exports = {
  initializeOnboardingDatabase,
  getOnboardingIdByEmail,
  updateOnboardingRecord,
  checkUserExists,
  formatOperatingHours,
  generateDefaultPassword
};