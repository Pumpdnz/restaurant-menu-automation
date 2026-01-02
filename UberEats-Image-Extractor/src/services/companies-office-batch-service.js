/**
 * Companies Office Batch Service
 * Handles batch processing of Companies Office extraction for registration batches
 *
 * This service wraps the existing companies-office-routes.js functionality
 * and adds persistence for async user selection during batch processing.
 *
 * Flow:
 * 1. searchForRestaurant() - Runs search and persists candidates
 * 2. selectCompany() - Saves user's company selection
 * 3. extractAndSaveCompanyDetails() - Extracts full details and saves to restaurant
 */

const { getSupabaseClient } = require('./database-service');
const axios = require('axios');
const rateLimiter = require('./rate-limiter-service');

// Firecrawl API configuration
const FIRECRAWL_API_URL = process.env.FIRECRAWL_API_URL || 'https://api.firecrawl.dev';
const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;

// ============================================================================
// NAME AND ADDRESS CLEANING
// ============================================================================

/**
 * Clean restaurant name for Companies Office search
 * Removes location/store identifiers often appended by delivery platforms
 *
 * Examples:
 *   "Texas Chicken (Henderson)" -> "Texas Chicken"
 *   "Burger King (Queen Street)" -> "Burger King"
 *   "Pizza Hut (Mt Wellington)" -> "Pizza Hut"
 *   "KFC (CBD - Queen St)" -> "KFC"
 *
 * @param {string} name - Restaurant name possibly with location suffix
 * @returns {string} Cleaned restaurant name
 */
function cleanRestaurantName(name) {
  if (!name) return '';

  // Remove any text in parentheses (common for UberEats/DoorDash location suffixes)
  // This handles cases like "(Henderson)", "(Queen Street - CBD)", etc.
  const cleaned = name
    .replace(/\s*\([^)]*\)\s*/g, '') // Remove all (parenthetical text)
    .trim();

  // Return original if cleaning results in empty string
  return cleaned || name;
}

/**
 * Convert name to title case (capitalize first letter of each word)
 * Used for contact_name field while full_legal_name stays as-is
 *
 * @param {string} name - Name in any case (e.g., "JOHN WILLIAM SMITH")
 * @returns {string} Title case name (e.g., "John William Smith")
 */
function toTitleCase(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Parse street from a full address string
 * Extracts the street name portion by finding common street type suffixes
 *
 * @param {string} address - Full address string
 * @returns {string} Extracted street name
 */
function parseStreetFromAddress(address) {
  if (!address) return '';

  const streetTypes = [
    'street', 'road', 'avenue', 'lane', 'place', 'way',
    'crescent', 'drive', 'terrace', 'boulevard', 'court',
    'close', 'parade', 'highway', 'grove', 'rise', 'mews',
    'quay', 'esplanade', 'square', 'walk', 'path', 'row'
  ];

  const addressLower = address.toLowerCase();
  let earliestIndex = -1;
  let matchedType = '';

  for (const streetType of streetTypes) {
    const regex = new RegExp(`\\b${streetType}\\b`, 'i');
    const match = addressLower.match(regex);
    if (match) {
      const index = match.index;
      if (earliestIndex === -1 || index < earliestIndex) {
        earliestIndex = index;
        matchedType = streetType;
      }
    }
  }

  if (earliestIndex !== -1) {
    return address.substring(0, earliestIndex + matchedType.length)
      .replace(/[,\s]+$/, '') // Remove trailing commas and whitespace
      .trim();
  }

  // Fallback: take first 3 words
  const words = address.split(/\s+/);
  return words.slice(0, 3).join(' ')
    .replace(/[,\s]+$/, '') // Remove trailing commas and whitespace
    .trim();
}

// ============================================================================
// SCHEMAS (copied from companies-office-routes.js for batch use)
// ============================================================================

const COMPANIES_SEARCH_SCHEMA = {
  type: "object",
  properties: {
    companies: {
      type: "array",
      items: {
        type: "object",
        properties: {
          company_name: { type: "string", description: "Full legal company name" },
          company_number: { type: "string", description: "Company registration number" },
          nzbn: { type: "string", description: "New Zealand Business Number (13 digits)" },
          status: { type: "string", description: "Entity status: Registered, In liquidation, Removed, etc." },
          incorporation_date: { type: "string", description: "Date of incorporation" },
          registered_address: { type: "string", description: "Registered office address" }
        },
        required: ["company_name", "company_number"]
      }
    },
    total_results: { type: "integer", description: "Total number of results found" }
  }
};

const COMPANIES_SEARCH_PROMPT = `Extract all company search results from this Companies Register search page.

For each company in the search results, capture:
1. Company name (full legal name exactly as shown)
2. Company registration number (numeric ID)
3. NZBN (New Zealand Business Number) - 13-digit number if shown
4. Current status (Registered, In liquidation, Removed, etc.)
5. Incorporation date if shown
6. Registered address if shown

Count the total results found and include in total_results.

IMPORTANT: Only extract data visible on the page. Leave fields empty/null if not visible.
Extract ALL companies shown in the search results, not just the first few.`;

const COMPANY_DETAIL_SCHEMA = {
  type: "object",
  properties: {
    company_info: {
      type: "object",
      properties: {
        company_name: { type: "string" },
        company_number: { type: "string" },
        nzbn: { type: "string" },
        status: { type: "string" },
        incorporation_date: { type: "string" },
        entity_type: { type: "string" }
      }
    },
    addresses: {
      type: "array",
      items: {
        type: "object",
        properties: {
          address_type: { type: "string" },
          full_address: { type: "string" },
          contact_name: { type: "string" }
        }
      }
    },
    directors: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          full_legal_name: { type: "string" },
          position: { type: "string" },
          appointment_date: { type: "string" },
          cessation_date: { type: "string" },
          address: { type: "string" },
          status: { type: "string" }
        }
      }
    },
    shareholders: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          shareholder_type: { type: "string" },
          shares: { type: "number" },
          percentage: { type: "number" },
          address: { type: "string" }
        }
      }
    },
    nzbn_details: {
      type: "object",
      properties: {
        gst_numbers: { type: "array", items: { type: "string" } },
        phone_numbers: { type: "array", items: { type: "string" } },
        email_addresses: { type: "array", items: { type: "string" } },
        trading_name: { type: "string" },
        websites: { type: "array", items: { type: "string" } },
        industry_classifications: { type: "array", items: { type: "string" } }
      }
    }
  }
};

const COMPANY_DETAIL_PROMPT = `Extract complete company information from this Companies Register detail page.

Extract from each panel/section:

1. BASIC INFO: Company name, number, NZBN, status, incorporation date, entity type

2. ADDRESSES: All addresses with type (Registered office, Address for service, etc.)
   Include any contact names listed with addresses

3. DIRECTORS: All directors with name, full legal name if different
   Position, appointment date, cessation date, address, status (Active/Ceased)
   Focus on ACTIVE directors

4. SHAREHOLDERS: All shareholders with name, type (individual/company)
   Number of shares, percentage ownership, address if shown

5. NZBN DETAILS: GST numbers, phone numbers, email addresses
   Trading name, websites, industry classifications

IMPORTANT: Extract data exactly as displayed. Leave fields empty/null if not visible.`;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function buildNameSearchUrl(restaurantName) {
  const encodedName = encodeURIComponent(restaurantName);
  return `https://app.companiesoffice.govt.nz/companies/app/ui/pages/companies/search?q=${encodedName}&entityStatusGroups=REGISTERED&advancedPanel=true&mode=advanced#results`;
}

function buildAddressSearchUrl(street, city) {
  const searchQuery = city ? `${street} ${city}`.trim() : street;
  const encodedQuery = encodeURIComponent(searchQuery);
  return `https://app.companiesoffice.govt.nz/companies/app/ui/pages/companies/search?q=&entityStatusGroups=REGISTERED&addressKeyword=${encodedQuery}&advancedPanel=true&mode=advanced#results`;
}

function buildDetailUrl(companyNumber) {
  return `https://app.companiesoffice.govt.nz/companies/app/ui/pages/companies/${companyNumber}/detail`;
}

async function firecrawlExtract(url, schema, prompt, options = {}) {
  const { maxRetries = 3, retryDelay = 5000 } = options;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      await rateLimiter.acquireSlot('companies-office-extraction');

      const response = await axios.post(
        `${FIRECRAWL_API_URL}/v2/scrape`,
        {
          url,
          formats: [{
            type: 'json',
            prompt,
            schema
          }],
          waitFor: 4000,
          onlyMainContent: true,
          removeBase64Images: true
        },
        {
          headers: {
            'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
            'Content-Type': 'application/json'
          },
          timeout: 150000
        }
      );

      if (response.data.success) {
        return response.data.data?.json || response.data.data;
      } else {
        throw new Error(response.data.error || 'Firecrawl extraction failed');
      }
    } catch (error) {
      const isRetryable =
        error.message?.includes('TIMEOUT') ||
        error.message?.includes('rate') ||
        error.response?.status >= 500;

      if (!isRetryable || attempt >= maxRetries) {
        throw error;
      }

      console.log(`[CompaniesOfficeBatch] Retry ${attempt + 1}/${maxRetries} after ${retryDelay * (attempt + 1)}ms`);
      await new Promise(r => setTimeout(r, retryDelay * (attempt + 1)));
    }
  }
}

function deduplicateCompanies(companies) {
  const seen = new Map();
  for (const company of companies) {
    if (company.company_number && !seen.has(company.company_number)) {
      seen.set(company.company_number, company);
    }
  }
  return Array.from(seen.values());
}

// ============================================================================
// SEARCH RECORD MANAGEMENT
// ============================================================================

/**
 * Get search record for a restaurant
 */
async function getSearchRecord(restaurantId, registrationJobId) {
  const client = getSupabaseClient();

  let query = client
    .from('companies_office_search_candidates')
    .select('*');

  if (registrationJobId) {
    query = query.eq('registration_job_id', registrationJobId);
  } else if (restaurantId) {
    query = query.eq('restaurant_id', restaurantId);
  } else {
    throw new Error('Either restaurantId or registrationJobId is required');
  }

  const { data, error } = await query.single();

  if (error && error.code !== 'PGRST116') { // PGRST116 = not found
    throw error;
  }

  return data;
}

/**
 * Create or update search record
 */
async function upsertSearchRecord(restaurantId, registrationJobId, data) {
  const client = getSupabaseClient();

  const record = {
    restaurant_id: restaurantId,
    registration_job_id: registrationJobId,
    ...data,
    updated_at: new Date().toISOString()
  };

  // Check if record exists
  const existing = await getSearchRecord(restaurantId, registrationJobId);

  if (existing) {
    const { data: updated, error } = await client
      .from('companies_office_search_candidates')
      .update(record)
      .eq('id', existing.id)
      .select()
      .single();

    if (error) throw error;
    return updated;
  } else {
    const { data: created, error } = await client
      .from('companies_office_search_candidates')
      .insert(record)
      .select()
      .single();

    if (error) throw error;
    return created;
  }
}

// ============================================================================
// MAIN SERVICE FUNCTIONS
// ============================================================================

/**
 * Search Companies Office for a restaurant and persist results
 *
 * @param {Object} params - Search parameters
 * @param {string} params.restaurantId - Restaurant UUID
 * @param {string} params.registrationJobId - Registration job UUID
 * @param {string} params.restaurantName - Restaurant name for search
 * @param {string} params.street - Street address
 * @param {string} params.city - City name
 * @returns {Promise<Object>} Search results
 */
async function searchForRestaurant({ restaurantId, registrationJobId, restaurantName, street, city }) {
  console.log(`[CompaniesOfficeBatch] Searching for restaurant ${restaurantId}`);
  console.log(`[CompaniesOfficeBatch] Raw inputs - Name: "${restaurantName}", Street/Address: "${street}", City: "${city}"`);

  // Clean the restaurant name (remove location suffixes like "(Henderson)")
  const cleanedName = cleanRestaurantName(restaurantName);
  console.log(`[CompaniesOfficeBatch] Cleaned name: "${cleanedName}"`);

  // Parse street from full address if needed (extract just the street portion)
  const cleanedStreet = parseStreetFromAddress(street);
  console.log(`[CompaniesOfficeBatch] Cleaned street: "${cleanedStreet}"`);

  // Create initial search record with both original and cleaned values
  await upsertSearchRecord(restaurantId, registrationJobId, {
    search_queries: {
      restaurant_name: cleanedName,
      street: cleanedStreet,
      city,
      original_values: { restaurant_name: restaurantName, street, city }
    },
    status: 'searching',
    searched_at: new Date().toISOString()
  });

  try {
    // Build search URLs and execute in parallel
    const searchPromises = [];
    const searchSources = [];

    if (cleanedName) {
      const nameUrl = buildNameSearchUrl(cleanedName);
      console.log(`[CompaniesOfficeBatch] Name search URL: ${nameUrl}`);
      searchPromises.push(
        firecrawlExtract(nameUrl, COMPANIES_SEARCH_SCHEMA, COMPANIES_SEARCH_PROMPT)
          .catch(err => {
            console.error('[CompaniesOfficeBatch] Name search failed:', err.message);
            return { companies: [], error: err.message };
          })
      );
      searchSources.push('name');
    }

    if (cleanedStreet) {
      const addressUrl = buildAddressSearchUrl(cleanedStreet, city);
      console.log(`[CompaniesOfficeBatch] Address search URL: ${addressUrl}`);
      searchPromises.push(
        firecrawlExtract(addressUrl, COMPANIES_SEARCH_SCHEMA, COMPANIES_SEARCH_PROMPT)
          .catch(err => {
            console.error('[CompaniesOfficeBatch] Address search failed:', err.message);
            return { companies: [], error: err.message };
          })
      );
      searchSources.push('address');
    }

    const results = await Promise.all(searchPromises);

    // Process results
    const byName = searchSources[0] === 'name' ? (results[0]?.companies || []) : [];
    const byAddress = searchSources.includes('address')
      ? (results[searchSources.indexOf('address')]?.companies || [])
      : [];

    // Add match source to each result
    byName.forEach(c => c.match_source = 'name');
    byAddress.forEach(c => c.match_source = 'address');

    // Combine and deduplicate
    const allCompanies = [...byName, ...byAddress];
    const combined = deduplicateCompanies(allCompanies);

    console.log(`[CompaniesOfficeBatch] Search complete: ${byName.length} by name, ${byAddress.length} by address, ${combined.length} unique`);

    // Persist results
    await upsertSearchRecord(restaurantId, registrationJobId, {
      name_results: byName,
      address_results: byAddress,
      combined_results: combined,
      candidate_count: combined.length,
      status: combined.length > 0 ? 'awaiting_selection' : 'no_match'
    });

    return {
      combined,
      byName,
      byAddress
    };

  } catch (error) {
    console.error(`[CompaniesOfficeBatch] Search failed for restaurant ${restaurantId}:`, error);

    await upsertSearchRecord(restaurantId, registrationJobId, {
      status: 'failed',
      error_message: error.message
    });

    throw error;
  }
}

/**
 * Save user's company selection
 *
 * @param {string} restaurantId - Restaurant UUID (optional if registrationJobId provided)
 * @param {string} registrationJobId - Registration job UUID
 * @param {string|null} companyNumber - Selected company number or null for no match
 * @returns {Promise<Object>} Updated search record
 */
async function selectCompany(restaurantId, registrationJobId, companyNumber) {
  const client = getSupabaseClient();

  // Get the search record
  const searchRecord = await getSearchRecord(restaurantId, registrationJobId);
  if (!searchRecord) {
    throw new Error('Search record not found');
  }

  if (!companyNumber) {
    // User indicated no matching company
    return upsertSearchRecord(searchRecord.restaurant_id, registrationJobId, {
      status: 'no_match',
      selected_at: new Date().toISOString()
    });
  }

  // Find the selected company in combined results
  const selectedCompany = searchRecord.combined_results?.find(
    c => c.company_number === companyNumber
  );

  return upsertSearchRecord(searchRecord.restaurant_id, registrationJobId, {
    selected_company_number: companyNumber,
    selected_company_data: selectedCompany,
    status: 'selected',
    selected_at: new Date().toISOString()
  });
}

/**
 * Extract full company details and save to restaurant
 * Also auto-populates email and GST number from NZBN details
 *
 * @param {string} restaurantId - Restaurant UUID
 * @param {string} companyNumber - Company number to extract
 * @returns {Promise<Object>} Extracted company details
 */
async function extractAndSaveCompanyDetails(restaurantId, companyNumber) {
  const client = getSupabaseClient();

  console.log(`[CompaniesOfficeBatch] Extracting details for company ${companyNumber}`);

  // Extract full details from Companies Office
  const detailUrl = buildDetailUrl(companyNumber);
  const details = await firecrawlExtract(detailUrl, COMPANY_DETAIL_SCHEMA, COMPANY_DETAIL_PROMPT);

  // Auto-select defaults including email and GST from NZBN
  const selections = autoSelectDefaults(details);

  // Save to restaurant record
  await saveCompanyDetailsToRestaurant(restaurantId, selections, details);

  // Update the registration job's execution_config with extracted email/GST
  // This pre-populates the Yolo Mode configuration in Step 5
  await updateRegistrationJobConfig(restaurantId, details);

  console.log(`[CompaniesOfficeBatch] Saved company details to restaurant ${restaurantId}`);

  return details;
}

/**
 * Auto-select default values from company details
 * Includes email and GST number from NZBN details
 */
function autoSelectDefaults(details) {
  const activeDirector = findActiveDirector(details.directors);

  return {
    // Company info
    company_name: details.company_info?.company_name,
    company_number: details.company_info?.company_number,
    nzbn: details.company_info?.nzbn,

    // GST from NZBN details
    gst_number: details.nzbn_details?.gst_numbers?.[0],

    // Contact from active director (title case for contact_name, original for full_legal_name)
    contact_name: toTitleCase(activeDirector?.name),
    full_legal_name: activeDirector?.full_legal_name,

    // Email from NZBN details (business email)
    contact_email: details.nzbn_details?.email_addresses?.[0],

    // Phone from NZBN details
    contact_phone: details.nzbn_details?.phone_numbers?.[0],

    // Store full metadata
    save_full_metadata: true
  };
}

/**
 * Find first active director from directors array
 */
function findActiveDirector(directors) {
  if (!Array.isArray(directors)) return null;
  return directors.find(d =>
    d.status?.toLowerCase() === 'current' ||
    d.status?.toLowerCase() === 'active' ||
    !d.cessation_date
  );
}

/**
 * Save company details to restaurant record
 */
async function saveCompanyDetailsToRestaurant(restaurantId, selections, fullDetails) {
  const client = getSupabaseClient();

  const updates = {};

  if (selections.company_name) updates.company_name = selections.company_name;
  if (selections.company_number) updates.company_number = selections.company_number;
  if (selections.nzbn) updates.nzbn = selections.nzbn;
  if (selections.gst_number) updates.gst_number = selections.gst_number;
  if (selections.contact_name) updates.contact_name = selections.contact_name;
  if (selections.full_legal_name) updates.full_legal_name = selections.full_legal_name;
  if (selections.contact_email) updates.contact_email = selections.contact_email;
  if (selections.contact_phone) updates.contact_phone = selections.contact_phone;

  if (selections.save_full_metadata) {
    updates.additional_contacts_metadata = fullDetails;
  }

  updates.updated_at = new Date().toISOString();

  const { error } = await client
    .from('restaurants')
    .update(updates)
    .eq('id', restaurantId);

  if (error) throw error;
}

/**
 * Update registration job config with extracted email/GST
 * Pre-populates the Yolo Mode configuration in Step 5
 */
async function updateRegistrationJobConfig(restaurantId, details) {
  const client = getSupabaseClient();

  // Find the registration job for this restaurant
  const { data: job } = await client
    .from('registration_jobs')
    .select('id, execution_config')
    .eq('restaurant_id', restaurantId)
    .eq('status', 'in_progress')
    .single();

  if (!job) return; // No active job

  const nzbnDetails = details.nzbn_details || {};
  const currentConfig = job.execution_config || {};

  // Pre-populate from Companies Office extraction
  const updatedConfig = {
    ...currentConfig,
    // Only update if not already set
    email: currentConfig.email || nzbnDetails.email_addresses?.[0],
    gst_number: nzbnDetails.gst_numbers?.[0]
  };

  await client
    .from('registration_jobs')
    .update({ execution_config: updatedConfig })
    .eq('id', job.id);
}

/**
 * Get all search candidates for a batch (for UI display)
 */
async function getBatchSearchCandidates(batchId) {
  const client = getSupabaseClient();

  // Get all job IDs for this batch
  const { data: jobs } = await client
    .from('registration_jobs')
    .select('id, restaurant_id')
    .eq('batch_job_id', batchId);

  if (!jobs || jobs.length === 0) return [];

  const jobIds = jobs.map(j => j.id);

  // Get all search candidates for these jobs
  const { data: candidates, error } = await client
    .from('companies_office_search_candidates')
    .select(`
      *,
      restaurant:restaurants(id, name, address, city)
    `)
    .in('registration_job_id', jobIds);

  if (error) throw error;

  return candidates || [];
}

// ============================================================================
// MODULE EXPORTS
// ============================================================================

module.exports = {
  // Main functions
  searchForRestaurant,
  selectCompany,
  extractAndSaveCompanyDetails,

  // Record management
  getSearchRecord,
  upsertSearchRecord,
  getBatchSearchCandidates,

  // Helpers
  autoSelectDefaults,
  findActiveDirector,

  // Cleaning utilities
  cleanRestaurantName,
  parseStreetFromAddress
};
