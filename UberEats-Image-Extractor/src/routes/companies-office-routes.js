/**
 * Companies Office Routes
 * API routes for NZ Companies Office extraction operations
 */

const express = require('express');
const router = express.Router();
const axios = require('axios');
const { authMiddleware } = require('../../middleware/auth');
const {
  requireCompaniesOfficeExtraction
} = require('../../middleware/feature-flags');
const { UsageTrackingService } = require('../services/usage-tracking-service');
const rateLimiter = require('../services/rate-limiter-service');
const db = require('../services/database-service');

// Firecrawl API configuration
const FIRECRAWL_API_URL = process.env.FIRECRAWL_API_URL || 'https://api.firecrawl.dev';
const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;

// ============================================================================
// SCHEMAS AND PROMPTS
// ============================================================================

/**
 * Step 1: Search results extraction schema
 */
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

/**
 * Step 2: Company detail page extraction schema
 */
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
          address_type: { type: "string", description: "Type: Registered Office, Address for Service, etc." },
          full_address: { type: "string" },
          contact_name: { type: "string", description: "Contact person name if listed with address" }
        }
      }
    },
    directors: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string", description: "Director display name" },
          full_legal_name: { type: "string", description: "Full legal name if different from display name" },
          position: { type: "string" },
          appointment_date: { type: "string" },
          cessation_date: { type: "string" },
          address: { type: "string" },
          status: { type: "string", description: "Active or Ceased" }
        }
      }
    },
    shareholders: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          shareholder_type: { type: "string", description: "Individual or Company" },
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

1. BASIC INFO (top of page):
   - Company name, number, NZBN, status, incorporation date, entity type

2. ADDRESSES (addressPanel):
   - All addresses with type (Registered office, Address for service, etc.)
   - Include any contact names listed with addresses
   - These contact names are useful for prospecting

3. DIRECTORS (directorsPanel):
   - All directors with name, full legal name if different
   - Position, appointment date, cessation date
   - Director address, status (Active/Ceased)
   - Focus on ACTIVE directors

4. SHAREHOLDERS (shareholdersPanel):
   - All shareholders with name, type (individual/company)
   - Number of shares, percentage ownership
   - Shareholder address if shown

5. NZBN DETAILS (nzbnDetailsPanel):
   - GST numbers, phone numbers, email addresses
   - Trading name, websites
   - Industry classifications
   - NOTE: Most of these fields are often empty

IMPORTANT:
- Extract data exactly as displayed on the page
- Leave fields empty/null if not visible
- For directors and shareholders, focus on those with Active status
- Extract ALL entries in each section, not just the first few`;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Build Companies Office search URL by name
 */
function buildNameSearchUrl(restaurantName) {
  const encodedName = encodeURIComponent(restaurantName);
  return `https://app.companiesoffice.govt.nz/companies/app/ui/pages/companies/search?q=${encodedName}&entityStatusGroups=REGISTERED&advancedPanel=true&mode=advanced#results`;
}

/**
 * Parse address to extract only street portion
 * Extracts everything up to and including street type words
 * Input: "363 Colombo Street Christchurch Canterbury 8023"
 * Output: "363 Colombo Street"
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
    // Use word boundary to match whole words only
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
    return address.substring(0, earliestIndex + matchedType.length).trim();
  }

  // Fallback: return first 3 words if no street type found
  const words = address.split(/\s+/);
  return words.slice(0, 3).join(' ');
}

/**
 * Build Companies Office search URL by address
 * Uses street from address + city from restaurant record
 */
function buildAddressSearchUrl(street, city) {
  const searchQuery = city ? `${street} ${city}`.trim() : street;
  const encodedQuery = encodeURIComponent(searchQuery);
  console.log(`[CompaniesOffice] Address search query: "${searchQuery}"`);
  return `https://app.companiesoffice.govt.nz/companies/app/ui/pages/companies/search?q=&entityStatusGroups=REGISTERED&addressKeyword=${encodedQuery}&advancedPanel=true&mode=advanced#results`;
}

/**
 * Build Companies Office detail URL
 */
function buildDetailUrl(companyNumber) {
  return `https://app.companiesoffice.govt.nz/companies/app/ui/pages/companies/${companyNumber}/detail`;
}

/**
 * Make a Firecrawl extraction request
 */
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

      console.log(`[CompaniesOffice] Retry ${attempt + 1}/${maxRetries} after ${retryDelay * (attempt + 1)}ms`);
      await new Promise(r => setTimeout(r, retryDelay * (attempt + 1)));
    }
  }
}

/**
 * Deduplicate companies by company_number
 */
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
// ROUTE HANDLERS
// ============================================================================

/**
 * POST /api/companies-office/search
 * Step 1: Search Companies Office by restaurant name and address
 * Returns search results from both searches, deduplicated
 */
router.post('/search', authMiddleware, requireCompaniesOfficeExtraction, async (req, res) => {
  try {
    const { restaurantId, restaurantName, street, city } = req.body;

    if (!restaurantId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: restaurantId'
      });
    }

    if (!restaurantName && !street) {
      return res.status(400).json({
        success: false,
        error: 'At least one of restaurantName or street is required'
      });
    }

    console.log(`[CompaniesOffice] Starting search for restaurant ${restaurantId}`);
    console.log(`[CompaniesOffice] Name: "${restaurantName}", Street: "${street}", City: "${city}"`);

    // Build search URLs
    const searchPromises = [];
    const searchSources = [];

    if (restaurantName) {
      const nameUrl = buildNameSearchUrl(restaurantName);
      console.log(`[CompaniesOffice] Name search URL: ${nameUrl}`);
      searchPromises.push(
        firecrawlExtract(nameUrl, COMPANIES_SEARCH_SCHEMA, COMPANIES_SEARCH_PROMPT)
          .catch(err => {
            console.error('[CompaniesOffice] Name search failed:', err.message);
            return { companies: [], error: err.message };
          })
      );
      searchSources.push('name');
    }

    if (street) {
      const addressUrl = buildAddressSearchUrl(street, city);
      console.log(`[CompaniesOffice] Address search URL: ${addressUrl}`);
      searchPromises.push(
        firecrawlExtract(addressUrl, COMPANIES_SEARCH_SCHEMA, COMPANIES_SEARCH_PROMPT)
          .catch(err => {
            console.error('[CompaniesOffice] Address search failed:', err.message);
            return { companies: [], error: err.message };
          })
      );
      searchSources.push('address');
    }

    // Execute searches in parallel
    const results = await Promise.all(searchPromises);

    // Process results
    const byName = searchSources[0] === 'name' ? (results[0]?.companies || []) : [];
    const byAddress = searchSources.includes('address')
      ? (results[searchSources.indexOf('address')]?.companies || [])
      : [];

    // Combine and deduplicate
    const allCompanies = [...byName, ...byAddress];
    const combined = deduplicateCompanies(allCompanies);

    console.log(`[CompaniesOffice] Search complete: ${byName.length} by name, ${byAddress.length} by address, ${combined.length} unique`);

    // Track usage (non-blocking)
    UsageTrackingService.trackContactExtraction(req.user.organisationId, 'companies_office_search', {
      restaurant_id: restaurantId,
      restaurant_name: restaurantName,
      results_by_name: byName.length,
      results_by_address: byAddress.length,
      total_unique: combined.length
    }).catch(err => console.error('[UsageTracking] Failed to track:', err));

    res.json({
      success: true,
      data: {
        byName,
        byAddress,
        combined,
        searchUrls: {
          name: restaurantName ? buildNameSearchUrl(restaurantName) : null,
          address: street ? buildAddressSearchUrl(street, city) : null
        }
      }
    });

  } catch (error) {
    console.error('[CompaniesOffice] Search error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/companies-office/details
 * Step 2: Extract detailed information for selected companies
 */
router.post('/details', authMiddleware, requireCompaniesOfficeExtraction, async (req, res) => {
  try {
    const { restaurantId, companyNumbers } = req.body;

    if (!restaurantId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: restaurantId'
      });
    }

    if (!companyNumbers || !Array.isArray(companyNumbers) || companyNumbers.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'companyNumbers array is required and must not be empty'
      });
    }

    console.log(`[CompaniesOffice] Extracting details for ${companyNumbers.length} companies`);

    // Extract details in batches (conservative concurrency for Companies Office)
    const BATCH_SIZE = 3;
    const companies = [];

    for (let i = 0; i < companyNumbers.length; i += BATCH_SIZE) {
      const batch = companyNumbers.slice(i, i + BATCH_SIZE);

      const batchResults = await Promise.allSettled(
        batch.map(async (companyNumber) => {
          const detailUrl = buildDetailUrl(companyNumber);
          console.log(`[CompaniesOffice] Extracting: ${detailUrl}`);

          const details = await firecrawlExtract(
            detailUrl,
            COMPANY_DETAIL_SCHEMA,
            COMPANY_DETAIL_PROMPT
          );

          return {
            company_number: companyNumber,
            detail_url: detailUrl,
            ...details
          };
        })
      );

      // Process batch results
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          companies.push(result.value);
        } else {
          console.error('[CompaniesOffice] Detail extraction failed:', result.reason?.message);
          companies.push({
            company_number: batch[batchResults.indexOf(result)],
            error: result.reason?.message || 'Extraction failed'
          });
        }
      }

      // Delay between batches
      if (i + BATCH_SIZE < companyNumbers.length) {
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    // Track usage for each successful extraction
    const successCount = companies.filter(c => !c.error).length;
    for (let i = 0; i < successCount; i++) {
      UsageTrackingService.trackContactExtraction(req.user.organisationId, 'companies_office_detail', {
        restaurant_id: restaurantId,
        company_number: companies[i]?.company_number
      }).catch(err => console.error('[UsageTracking] Failed to track:', err));
    }

    console.log(`[CompaniesOffice] Detail extraction complete: ${successCount}/${companyNumbers.length} successful`);

    res.json({
      success: true,
      data: {
        companies,
        successCount,
        failedCount: companyNumbers.length - successCount
      }
    });

  } catch (error) {
    console.error('[CompaniesOffice] Details error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/companies-office/save
 * Step 3: Save selected company details to restaurant record
 */
router.post('/save', authMiddleware, requireCompaniesOfficeExtraction, async (req, res) => {
  try {
    const { restaurantId, selections } = req.body;

    if (!restaurantId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: restaurantId'
      });
    }

    if (!selections || typeof selections !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'selections object is required'
      });
    }

    console.log(`[CompaniesOffice] Saving selections for restaurant ${restaurantId}`);

    // Build update object from selections
    const updateData = {};

    // Handle direct field mappings
    const fieldMappings = {
      full_legal_name: 'full_legal_name',
      company_name: 'company_name',
      company_number: 'company_number',
      nzbn: 'nzbn',
      gst_number: 'gst_number',
      contact_name: 'contact_name',
      contact_email: 'contact_email'
    };

    for (const [selectionKey, dbField] of Object.entries(fieldMappings)) {
      if (selections[selectionKey]?.save && selections[selectionKey].value) {
        updateData[dbField] = selections[selectionKey].value;
      }
    }

    // Handle additional_contacts_metadata (JSONB field)
    if (selections.additional_contacts_metadata?.save && selections.additional_contacts_metadata.value) {
      updateData.additional_contacts_metadata = selections.additional_contacts_metadata.value;
    }

    // Update restaurant record
    if (Object.keys(updateData).length > 0) {
      const { error: updateError } = await db.supabase
        .from('restaurants')
        .update(updateData)
        .eq('id', restaurantId)
        .eq('organisation_id', req.user.organisationId);

      if (updateError) {
        throw new Error(`Failed to update restaurant: ${updateError.message}`);
      }

      console.log(`[CompaniesOffice] Updated ${Object.keys(updateData).length} fields for restaurant ${restaurantId}`);
    } else {
      console.log(`[CompaniesOffice] No fields selected to save`);
    }

    res.json({
      success: true,
      savedFields: Object.keys(updateData),
      message: Object.keys(updateData).length > 0
        ? `Saved ${Object.keys(updateData).length} field(s) successfully`
        : 'No fields were selected to save'
    });

  } catch (error) {
    console.error('[CompaniesOffice] Save error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
