# Firecrawl Integration for Lead Scraping

## Overview

This document defines the Firecrawl extraction configurations for each step of the lead scraping pipeline. It builds on the existing Firecrawl integration in `firecrawl-service.js`.

## Environment Configuration

```env
# Firecrawl API Configuration
FIRECRAWL_API_KEY=your_key_here
FIRECRAWL_API_URL=https://api.firecrawl.dev

# Rate Limiting Configuration
FIRECRAWL_CONCURRENCY_LIMIT=5
FIRECRAWL_RATE_LIMIT=30
FIRECRAWL_RATE_WINDOW=60000
```

## URL Templates

### UberEats Category Page URL

```
https://www.ubereats.com/{country_code}/category/{city}-{region_code}/{cuisine}?page={page_offset}
```

**Page Offset Behavior:**
- Default page offset is **1** (first page of results)
- The value entered by the user is used directly (no adjustment)
- Valid range: 1-999

**Examples:**
- Auckland Indian (page 1): `https://www.ubereats.com/nz/category/auckland-auk/indian?page=1`
- Wellington Chinese (page 1): `https://www.ubereats.com/nz/category/wellington-wgn/chinese?page=1`
- Christchurch Pizza (page 5): `https://www.ubereats.com/nz/category/christchurch-can/pizza?page=5`
- Sydney Thai (page 1): `https://www.ubereats.com/au/category/sydney-nsw/thai?page=1`

### UberEats Store Page URL

```
https://www.ubereats.com/nz/store/{store-slug}/{store-id}
```

**Example:**
`https://www.ubereats.com/nz/store/maharaja-indian-restaurant/5a3d2c1b-xxxx-xxxx-xxxx-xxxxxxxxxxxx`

---

## Step 1: Category Page Scan

### Purpose
Extract restaurant names and store URLs from UberEats category listing pages.

### Request Configuration

```javascript
const STEP_1_CONFIG = {
  method: 'extract',
  formats: ['json'],
  timeout: 60000,
  waitFor: 4000,
  onlyMainContent: false,

  prompt: `Extract all restaurant listings from this UberEats category page. For each restaurant:

1. Find the restaurant name (the main title/heading of each listing)
2. Find the store URL (the link to the restaurant's individual page)

Only extract restaurants that are currently available for ordering.
Do NOT include promotional banners, ads, or non-restaurant content.
Each restaurant should have a unique name and URL.

Format the store_link as a complete URL starting with https://www.ubereats.com`,

  schema: {
    type: "object",
    properties: {
      restaurants: {
        type: "array",
        description: "List of all restaurant listings on the page",
        items: {
          type: "object",
          properties: {
            restaurant_name: {
              type: "string",
              description: "The name of the restaurant as displayed"
            },
            store_link: {
              type: "string",
              description: "The full URL to the restaurant's UberEats store page"
            }
          },
          required: ["restaurant_name", "store_link"]
        }
      }
    },
    required: ["restaurants"]
  }
};
```

### Response Processing

```javascript
function processStep1Response(firecrawlResponse, jobId) {
  const restaurants = firecrawlResponse.data?.restaurants || [];

  // Validate and clean data
  const validRestaurants = restaurants
    .filter(r => r.restaurant_name && r.store_link)
    .filter(r => r.store_link.includes('ubereats.com/nz/store/'))
    .map(r => ({
      restaurant_name: r.restaurant_name.trim(),
      store_link: r.store_link.trim()
    }));

  // Deduplicate by store_link
  const uniqueRestaurants = [...new Map(
    validRestaurants.map(r => [r.store_link, r])
  ).values()];

  return uniqueRestaurants;
}
```

### Create Lead Records

```javascript
async function createLeadsFromStep1(restaurants, jobId, platform) {
  const leads = restaurants.map(r => ({
    lead_scrape_job_id: jobId,
    restaurant_name: r.restaurant_name,
    store_link: r.store_link,
    platform: platform,
    current_step: 1,
    step_progression_status: 'passed' // Auto-pass to step 2
  }));

  return await supabase
    .from('leads')
    .insert(leads)
    .select();
}
```

---

## Step 2: Store Page Enrichment

### Purpose
Batch extract detailed information from individual store pages.

### Request Configuration

```javascript
const STEP_2_CONFIG = {
  method: 'extract',
  formats: ['json'],
  timeout: 60000,
  waitFor: 5000,
  onlyMainContent: true,

  prompt: `Extract the following information from this UberEats restaurant store page:

1. Restaurant name - The main name displayed on the page
2. Number of reviews - The review count (may include "+" like "500+")
3. Average rating - The star rating out of 5.0
4. Address - The full street address of the restaurant
5. Cuisine types - Categories/tags describing the food type

Look for these in the restaurant header section at the top of the page.
The address is usually shown near the restaurant name.
Cuisine types are often displayed as tags or badges.

IMPORTANT: Extract ONLY the data that is visible on the page.
If a value is not visible, leave it empty rather than guessing.`,

  schema: {
    type: "object",
    properties: {
      restaurant_name: {
        type: "string",
        description: "The restaurant name as displayed on the store page"
      },
      number_of_reviews: {
        type: "string",
        description: "The review count, may include '+' (e.g., '500+', '3,000+')"
      },
      average_review_rating: {
        type: "number",
        description: "The average rating out of 5.0 (e.g., 4.7)"
      },
      address: {
        type: "string",
        description: "Full street address of the restaurant"
      },
      cuisine: {
        type: "array",
        description: "Array of cuisine type tags",
        items: { type: "string" }
      }
    },
    required: ["restaurant_name"]
  }
};
```

### Batch Processing

```javascript
async function processStep2Batch(leads, jobId) {
  const results = [];
  const batchSize = process.env.FIRECRAWL_CONCURRENCY_LIMIT || 5;

  // Process in batches
  for (let i = 0; i < leads.length; i += batchSize) {
    const batch = leads.slice(i, i + batchSize);

    const batchResults = await Promise.allSettled(
      batch.map(lead => extractStoreData(lead))
    );

    results.push(...batchResults);

    // Rate limiting delay between batches
    if (i + batchSize < leads.length) {
      await delay(2000);
    }
  }

  return results;
}

async function extractStoreData(lead) {
  try {
    const response = await firecrawlExtract(lead.store_link, STEP_2_CONFIG);

    return {
      lead_id: lead.id,
      success: true,
      data: {
        number_of_reviews: response.data?.number_of_reviews || null,
        average_review_rating: response.data?.average_review_rating || null,
        address: response.data?.address || null,
        cuisine: response.data?.cuisine || []
      }
    };
  } catch (error) {
    return {
      lead_id: lead.id,
      success: false,
      error: error.message
    };
  }
}
```

### Update Lead Records

```javascript
async function updateLeadsFromStep2(results, jobId) {
  const updates = [];
  const failures = [];

  for (const result of results) {
    if (result.success) {
      updates.push({
        id: result.lead_id,
        number_of_reviews: result.data.number_of_reviews,
        average_review_rating: result.data.average_review_rating,
        address: result.data.address,
        cuisine: result.data.cuisine,
        current_step: 2,
        step_progression_status: 'processed'
      });
    } else {
      failures.push({
        id: result.lead_id,
        step_progression_status: 'failed',
        validation_errors: [result.error]
      });
    }
  }

  // Batch update successful leads
  for (const update of updates) {
    await supabase
      .from('leads')
      .update(update)
      .eq('id', update.id);
  }

  // Update failed leads
  for (const failure of failures) {
    await supabase
      .from('leads')
      .update(failure)
      .eq('id', failure.id);
  }

  return { updates: updates.length, failures: failures.length };
}
```

---

## Step 3: Google Business Lookup

### Purpose
Search Google for business details (phone, website, hours).

### Request Configuration

```javascript
const STEP_3_CONFIG = {
  method: 'extract',
  formats: ['json'],
  timeout: 60000,
  waitFor: 3000,

  // URL will be constructed as Google search
  urlTemplate: (lead) =>
    `https://www.google.com/search?q=${encodeURIComponent(lead.restaurant_name + ' ' + lead.address)}`,

  prompt: `Extract business contact information from this Google search results page.

Look for:
1. Phone number - In standard NZ format (+64 or 0X)
2. Website URL - The official business website (not delivery platforms)
3. Opening hours - Hours of operation if shown

Focus on the Knowledge Panel or Business Profile on the right side of results.
If multiple phone numbers exist, prefer the main/primary number.
For website, exclude UberEats, DoorDash, or other delivery platform links.`,

  schema: {
    type: "object",
    properties: {
      phone: {
        type: "string",
        description: "Business phone number"
      },
      website_url: {
        type: "string",
        description: "Official business website URL"
      },
      opening_hours: {
        type: "object",
        description: "Opening hours by day",
        properties: {
          monday: { type: "string" },
          tuesday: { type: "string" },
          wednesday: { type: "string" },
          thursday: { type: "string" },
          friday: { type: "string" },
          saturday: { type: "string" },
          sunday: { type: "string" }
        }
      },
      opening_hours_text: {
        type: "string",
        description: "Raw opening hours text as displayed"
      }
    }
  }
};
```

---

## Step 4: Social Media Discovery

### Purpose
Find social media profiles for the restaurant.

### Request Configuration

```javascript
const STEP_4_CONFIG = {
  method: 'extract',
  formats: ['json'],
  timeout: 45000,
  waitFor: 3000,

  // Search Google for social profiles
  urlTemplate: (lead) =>
    `https://www.google.com/search?q=${encodeURIComponent(lead.restaurant_name + ' ' + lead.city + ' instagram OR facebook')}`,

  prompt: `Find social media profiles for this restaurant.

Look for:
1. Instagram profile URL (instagram.com/...)
2. Facebook page URL (facebook.com/...)

Only include URLs that appear to be official restaurant accounts.
Verify the account name matches or closely relates to the restaurant name.
Exclude personal accounts or unrelated businesses.`,

  schema: {
    type: "object",
    properties: {
      instagram_url: {
        type: "string",
        description: "Instagram profile URL"
      },
      facebook_url: {
        type: "string",
        description: "Facebook page URL"
      }
    }
  }
};
```

### Alternative: Direct Platform Scrape

If available in business website:

```javascript
const STEP_4_WEBSITE_CONFIG = {
  method: 'extract',
  formats: ['json'],
  timeout: 30000,

  // Use the website_url from Step 3
  urlTemplate: (lead) => lead.website_url,

  prompt: `Find social media links on this restaurant's website.

Look in:
- Footer section
- Contact page
- Social media icons/links anywhere on the page

Extract:
1. Instagram URL
2. Facebook URL

Only extract valid URLs that point to social media profiles.`,

  schema: {
    type: "object",
    properties: {
      instagram_url: { type: "string" },
      facebook_url: { type: "string" }
    }
  }
};
```

---

## Step 5: Contact Enrichment

### Purpose
Find specific contact person details.

### Request Configuration

```javascript
const STEP_5_CONFIG = {
  method: 'extract',
  formats: ['json'],
  timeout: 45000,

  // Multiple sources to check
  sources: ['website', 'facebook', 'linkedin_search'],

  prompt: `Find contact person details for this restaurant business.

Look for:
1. Owner/Manager name
2. Direct email address (not generic info@ addresses if possible)
3. Direct phone number for the contact person

Check:
- About page
- Contact page
- Team/Staff page
- Facebook About section

Prioritize:
- Owner names
- Manager names
- Decision-maker roles`,

  schema: {
    type: "object",
    properties: {
      contact_name: {
        type: "string",
        description: "Name of the contact person (owner/manager)"
      },
      contact_email: {
        type: "string",
        description: "Email address for the contact"
      },
      contact_phone: {
        type: "string",
        description: "Phone number for the contact"
      },
      contact_role: {
        type: "string",
        description: "Role/position of the contact"
      }
    }
  }
};
```

---

## Data Validation

### Lead Validation Rules

```javascript
const VALIDATION_RULES = {
  step_1: {
    required: ['restaurant_name', 'store_link'],
    validators: {
      store_link: (val) => val && val.includes('ubereats.com/nz/store/')
    }
  },

  step_2: {
    required: ['address'],
    validators: {
      average_review_rating: (val) => !val || (val >= 0 && val <= 5),
      cuisine: (val) => !val || Array.isArray(val)
    }
  },

  step_3: {
    required: [], // All optional but valuable
    validators: {
      phone: (val) => !val || /^(\+64|0)[0-9\s\-]{8,15}$/.test(val),
      website_url: (val) => !val || val.startsWith('http')
    }
  },

  step_4: {
    required: [],
    validators: {
      instagram_url: (val) => !val || val.includes('instagram.com'),
      facebook_url: (val) => !val || val.includes('facebook.com')
    }
  },

  step_5: {
    required: [],
    validators: {
      contact_email: (val) => !val || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)
    }
  }
};

function validateLeadForStep(lead, stepNumber) {
  const rules = VALIDATION_RULES[`step_${stepNumber}`];
  const errors = [];

  // Check required fields
  for (const field of rules.required) {
    if (!lead[field]) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  // Run validators
  for (const [field, validator] of Object.entries(rules.validators)) {
    if (!validator(lead[field])) {
      errors.push(`Invalid value for field: ${field}`);
    }
  }

  return {
    is_valid: errors.length === 0,
    validation_errors: errors
  };
}
```

---

## Duplicate Detection

### Check Against Existing Leads

```javascript
async function checkForDuplicates(lead, jobId) {
  // Check within same job by store_link
  const { data: jobDupes } = await supabase
    .from('leads')
    .select('id')
    .eq('lead_scrape_job_id', jobId)
    .eq('store_link', lead.store_link)
    .neq('id', lead.id);

  if (jobDupes?.length > 0) {
    return {
      is_duplicate: true,
      duplicate_of_lead_id: jobDupes[0].id
    };
  }

  // Check against existing restaurants by name + city
  const { data: restaurants } = await supabase
    .from('restaurants')
    .select('id, name')
    .ilike('name', lead.restaurant_name)
    .eq('city', lead.city);

  if (restaurants?.length > 0) {
    // Fuzzy match check
    const match = restaurants.find(r =>
      similarityScore(r.name, lead.restaurant_name) > 0.85
    );

    if (match) {
      return {
        is_duplicate: true,
        duplicate_of_restaurant_id: match.id
      };
    }
  }

  return { is_duplicate: false };
}
```

---

## Error Handling & Retries

### Retry Configuration

```javascript
const RETRY_CONFIG = {
  maxRetries: 3,
  retryDelay: 5000, // 5 seconds
  retryableErrors: [
    'TIMEOUT',
    'RATE_LIMITED',
    'SERVICE_UNAVAILABLE'
  ]
};

async function firecrawlWithRetry(url, config, retries = 0) {
  try {
    return await firecrawlExtract(url, config);
  } catch (error) {
    const isRetryable = RETRY_CONFIG.retryableErrors.some(e =>
      error.message.includes(e)
    );

    if (isRetryable && retries < RETRY_CONFIG.maxRetries) {
      await delay(RETRY_CONFIG.retryDelay * (retries + 1));
      return firecrawlWithRetry(url, config, retries + 1);
    }

    throw error;
  }
}
```

### Error Logging

```javascript
async function logExtractionError(jobId, stepNumber, leadId, error) {
  await supabase
    .from('lead_scrape_job_steps')
    .update({
      metadata: supabase.sql`metadata || ${JSON.stringify({
        errors: [{
          lead_id: leadId,
          error: error.message,
          timestamp: new Date().toISOString()
        }]
      })}::jsonb`
    })
    .eq('job_id', jobId)
    .eq('step_number', stepNumber);
}
```

---

## Progress Tracking

### Update Job Progress

```javascript
async function updateJobProgress(jobId, stepNumber, stats) {
  // Update step
  await supabase
    .from('lead_scrape_job_steps')
    .update({
      leads_processed: stats.processed,
      leads_passed: stats.passed,
      leads_failed: stats.failed,
      status: stats.status,
      completed_at: stats.status === 'completed' ? new Date().toISOString() : null
    })
    .eq('job_id', jobId)
    .eq('step_number', stepNumber);

  // Update job
  await supabase
    .from('lead_scrape_jobs')
    .update({
      current_step: stepNumber,
      leads_passed: stats.totalPassed,
      leads_failed: stats.totalFailed
    })
    .eq('id', jobId);
}
```

---

## Future Platform Extensions

### DoorDash Configuration

```javascript
const DOORDASH_STEP_1_CONFIG = {
  urlTemplate: 'https://www.doordash.com/category/{city}/{cuisine}',
  // DoorDash-specific extraction schema
};
```

### Google Maps Configuration

```javascript
const GOOGLE_MAPS_STEP_1_CONFIG = {
  urlTemplate: 'https://www.google.com/maps/search/{cuisine}+restaurants+{city}',
  // Google Maps-specific extraction schema
};
```

The lead scraping service should be designed to accept platform-specific configurations that can be added without modifying core logic.
