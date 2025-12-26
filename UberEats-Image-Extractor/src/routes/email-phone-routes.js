/**
 * Email/Phone Extraction Routes
 * API routes for extracting restaurant email and phone from multiple sources
 */

const express = require('express');
const router = express.Router();
const axios = require('axios');
const { authMiddleware } = require('../../middleware/auth');
const {
  requireEmailPhoneExtraction
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
 * Email/Phone extraction schema for websites
 */
const WEBSITE_CONTACT_SCHEMA = {
  type: "object",
  properties: {
    email: {
      type: "string",
      description: "Business email address (info@, contact@, hello@, etc.)"
    },
    phone: {
      type: "string",
      description: "Business phone number in local format"
    },
    additional_emails: {
      type: "array",
      items: { type: "string" },
      description: "Other email addresses found on the page"
    },
    additional_phones: {
      type: "array",
      items: { type: "string" },
      description: "Other phone numbers found on the page"
    }
  }
};

const WEBSITE_CONTACT_PROMPT = `Extract contact information from this restaurant website.

Find and extract:

1. PRIMARY EMAIL ADDRESS
   - Look for info@, contact@, hello@, enquiries@, bookings@, or similar business emails
   - Check the footer, contact page sections, header, and sidebar
   - Prefer general business emails over personal ones
   - Return null if not found

2. PRIMARY PHONE NUMBER
   - Extract the main business phone number
   - Include country/area code if shown (e.g., +64, 09, 021 for NZ)
   - Look in header, footer, contact sections
   - Return null if not found

3. ADDITIONAL EMAILS
   - Any other email addresses found (ordering, reservations, etc.)
   - Return empty array if none found

4. ADDITIONAL PHONES
   - Any other phone numbers (mobile, fax, different locations)
   - Return empty array if none found

IMPORTANT:
- Only extract data visible on the page
- Return null for missing primary fields
- Do NOT make up or guess contact information
- Validate that emails contain @ and a domain`;

/**
 * Email/Phone extraction schema for Facebook pages
 */
const FACEBOOK_CONTACT_SCHEMA = {
  type: "object",
  properties: {
    email: {
      type: "string",
      description: "Business email from Facebook page About section"
    },
    phone: {
      type: "string",
      description: "Business phone from Facebook page About section"
    },
    website: {
      type: "string",
      description: "Website URL from Facebook page"
    }
  }
};

const FACEBOOK_CONTACT_PROMPT = `Extract contact information from this Facebook business page.

Look in the About section, Page Info, or Contact Information areas for:

1. EMAIL ADDRESS
   - Business email listed on the page
   - Return null if not found

2. PHONE NUMBER
   - Business phone number listed on the page
   - Include country code if shown
   - Return null if not found

3. WEBSITE
   - Website URL linked from the Facebook page
   - Return null if not found

IMPORTANT:
- Only extract data visible on the page
- Return null for missing fields
- Do NOT make up or guess information`;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Make a Firecrawl extraction request
 */
async function firecrawlExtract(url, schema, prompt, options = {}) {
  const { maxRetries = 3, retryDelay = 5000 } = options;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      await rateLimiter.acquireSlot('email-phone-extraction');

      const response = await axios.post(
        `${FIRECRAWL_API_URL}/v2/scrape`,
        {
          url,
          formats: [{
            type: 'json',
            prompt,
            schema
          }],
          waitFor: 3000,
          onlyMainContent: false, // Need to check footer/header for contact info
          removeBase64Images: true
        },
        {
          headers: {
            'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
            'Content-Type': 'application/json'
          },
          timeout: 120000
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

      console.log(`[EmailPhone] Retry ${attempt + 1}/${maxRetries} after ${retryDelay * (attempt + 1)}ms`);
      await new Promise(r => setTimeout(r, retryDelay * (attempt + 1)));
    }
  }
}

/**
 * Validate email format
 */
function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

/**
 * Validate phone format (basic check)
 */
function isValidPhone(phone) {
  if (!phone || typeof phone !== 'string') return false;
  // Remove common formatting characters and check length
  const digits = phone.replace(/[\s\-\(\)\+\.]/g, '');
  return digits.length >= 7 && digits.length <= 15;
}

/**
 * Clean and normalize phone number
 */
function normalizePhone(phone) {
  if (!phone) return null;
  // Remove extra spaces, keep + and digits
  return phone.trim().replace(/\s+/g, ' ');
}

/**
 * Clean and normalize email
 */
function normalizeEmail(email) {
  if (!email) return null;
  return email.trim().toLowerCase();
}

// ============================================================================
// ROUTE HANDLERS
// ============================================================================

/**
 * POST /api/contact-extraction/extract
 * Extract email and/or phone from a source URL
 */
router.post('/extract', authMiddleware, requireEmailPhoneExtraction, async (req, res) => {
  try {
    const { restaurantId, source, sourceUrl, fields } = req.body;

    if (!restaurantId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: restaurantId'
      });
    }

    if (!source || !['website', 'facebook'].includes(source)) {
      return res.status(400).json({
        success: false,
        error: 'source must be "website" or "facebook"'
      });
    }

    if (!sourceUrl) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: sourceUrl'
      });
    }

    // Validate fields to extract (default to both)
    const extractFields = fields || ['email', 'phone'];
    if (!Array.isArray(extractFields) || extractFields.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'fields must be a non-empty array containing "email" and/or "phone"'
      });
    }

    console.log(`[EmailPhone] Extracting from ${source}: ${sourceUrl}`);
    console.log(`[EmailPhone] Fields: ${extractFields.join(', ')}`);

    // Select schema and prompt based on source
    const schema = source === 'facebook' ? FACEBOOK_CONTACT_SCHEMA : WEBSITE_CONTACT_SCHEMA;
    const prompt = source === 'facebook' ? FACEBOOK_CONTACT_PROMPT : WEBSITE_CONTACT_PROMPT;

    // Execute extraction
    const extractedData = await firecrawlExtract(sourceUrl, schema, prompt);

    // Process and validate results
    const result = {
      source,
      sourceUrl,
      extracted: {}
    };

    if (extractFields.includes('email')) {
      const email = normalizeEmail(extractedData?.email);
      result.extracted.email = isValidEmail(email) ? email : null;

      // Include additional emails if found (website only)
      if (source === 'website' && extractedData?.additional_emails?.length > 0) {
        result.extracted.additional_emails = extractedData.additional_emails
          .map(normalizeEmail)
          .filter(isValidEmail);
      }
    }

    if (extractFields.includes('phone')) {
      const phone = normalizePhone(extractedData?.phone);
      result.extracted.phone = isValidPhone(phone) ? phone : null;

      // Include additional phones if found (website only)
      if (source === 'website' && extractedData?.additional_phones?.length > 0) {
        result.extracted.additional_phones = extractedData.additional_phones
          .map(normalizePhone)
          .filter(isValidPhone);
      }
    }

    // Include website if extracted from Facebook
    if (source === 'facebook' && extractedData?.website) {
      result.extracted.website = extractedData.website;
    }

    console.log(`[EmailPhone] Extraction complete:`, result.extracted);

    // Track usage (non-blocking)
    UsageTrackingService.trackContactExtraction(req.user.organisationId, 'email_phone', {
      restaurant_id: restaurantId,
      source,
      source_url: sourceUrl,
      found_email: !!result.extracted.email,
      found_phone: !!result.extracted.phone
    }).catch(err => console.error('[UsageTracking] Failed to track:', err));

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('[EmailPhone] Extraction error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/contact-extraction/save
 * Save extracted email and phone to restaurant record
 */
router.post('/save', authMiddleware, requireEmailPhoneExtraction, async (req, res) => {
  try {
    const { restaurantId, email, phone, fieldType } = req.body;

    if (!restaurantId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: restaurantId'
      });
    }

    if (!fieldType || !['restaurant', 'contact'].includes(fieldType)) {
      return res.status(400).json({
        success: false,
        error: 'fieldType must be "restaurant" or "contact"'
      });
    }

    console.log(`[EmailPhone] Saving ${fieldType} contact info for restaurant ${restaurantId}`);

    // Build update object based on field type
    const updateData = {};

    if (fieldType === 'restaurant') {
      // Save to restaurant email/phone fields
      if (email !== undefined) {
        updateData.email = email || null;
      }
      if (phone !== undefined) {
        updateData.phone = phone || null;
      }
    } else if (fieldType === 'contact') {
      // Save to contact email/phone fields
      if (email !== undefined) {
        updateData.contact_email = email || null;
      }
      if (phone !== undefined) {
        updateData.contact_phone = phone || null;
      }
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one of email or phone must be provided'
      });
    }

    // Update restaurant record
    const { error: updateError } = await db.supabase
      .from('restaurants')
      .update(updateData)
      .eq('id', restaurantId)
      .eq('organisation_id', req.user.organisationId);

    if (updateError) {
      throw new Error(`Failed to update restaurant: ${updateError.message}`);
    }

    console.log(`[EmailPhone] Updated ${Object.keys(updateData).length} fields for restaurant ${restaurantId}`);

    res.json({
      success: true,
      savedFields: Object.keys(updateData),
      message: `Saved ${Object.keys(updateData).length} field(s) successfully`
    });

  } catch (error) {
    console.error('[EmailPhone] Save error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/contact-extraction/save-personal
 * Save personal contact details including social links
 */
router.post('/save-personal', authMiddleware, requireEmailPhoneExtraction, async (req, res) => {
  try {
    const {
      restaurantId,
      contact_email,
      contact_phone,
      contact_instagram,
      contact_facebook,
      contact_linkedin
    } = req.body;

    if (!restaurantId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: restaurantId'
      });
    }

    console.log(`[EmailPhone] Saving personal contact details for restaurant ${restaurantId}`);

    // Build update object
    const updateData = {};

    if (contact_email !== undefined) {
      updateData.contact_email = contact_email || null;
    }
    if (contact_phone !== undefined) {
      updateData.contact_phone = contact_phone || null;
    }
    if (contact_instagram !== undefined) {
      updateData.contact_instagram = contact_instagram || null;
    }
    if (contact_facebook !== undefined) {
      updateData.contact_facebook = contact_facebook || null;
    }
    if (contact_linkedin !== undefined) {
      updateData.contact_linkedin = contact_linkedin || null;
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one field must be provided'
      });
    }

    // Update restaurant record
    const { error: updateError } = await db.supabase
      .from('restaurants')
      .update(updateData)
      .eq('id', restaurantId)
      .eq('organisation_id', req.user.organisationId);

    if (updateError) {
      throw new Error(`Failed to update restaurant: ${updateError.message}`);
    }

    console.log(`[EmailPhone] Updated ${Object.keys(updateData).length} personal contact fields for restaurant ${restaurantId}`);

    res.json({
      success: true,
      savedFields: Object.keys(updateData),
      message: `Saved ${Object.keys(updateData).length} field(s) successfully`
    });

  } catch (error) {
    console.error('[EmailPhone] Save personal error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
