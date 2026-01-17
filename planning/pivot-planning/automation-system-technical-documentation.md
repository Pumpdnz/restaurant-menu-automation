# Pumpd Automation System - Technical Documentation

This document provides a comprehensive technical explanation of the Pumpd restaurant automation system. It serves as both reference material for the xGrowth video demo and as case study documentation for future agency positioning.

---

## System Overview

The Pumpd automation system transforms a minimal lead form submission into a fully configured customer account through four major phases:

1. **Lead Capture** - Meta ads → Pabbly workflow → CRM record
2. **Multi-Source Enrichment** - Firecrawl scraping with validation
3. **Asset Processing** - Logo extraction, menu extraction, data transformation
4. **Automated Onboarding** - Parallel Playwright scripts for account setup

**Key Metrics:**
- Research time: 45 minutes → 3 minutes (93% reduction)
- Onboarding time: 4 hours → 15 minutes (94% reduction)
- Outreach-to-demo conversion: 67% (vs ~15-20% industry average)

---

## Phase 1: Lead Capture Flow

### Input: Meta Ads Lead Form
```
restaurant_name: string
contact_name: string
contact_phone: string
contact_email: string
weekly_sales_on_ubereats: enum ($1-2,500 | $2,500-5,000 | $5,000-10,000 | $10,000+)
city: string
```

### Automation: Pabbly Workflow
Triggered by Meta lead form webhook:

1. **Google Calendar** - Creates follow-up task
2. **HubSpot Contact** - Creates contact record
3. **HubSpot Company** - Creates company record
4. **HubSpot Deal** - Creates deal in "New Lead" stage
5. **HubSpot Associations** - Links contact ↔ company ↔ deal
6. **Supabase API** - Creates restaurant record

### Output: CRM Record
New record in `restaurants` table with:
- Basic contact info from lead form
- Lead tracking fields (lead_stage, lead_warmth, lead_status)
- Empty enrichment fields ready for population

---

## Phase 2: Multi-Source Data Enrichment

### Primary Method: Google Search Button

**Endpoint:** `POST /api/google-business-search`

**Architecture:** Priority-based multi-URL scraping with dynamic search termination

#### Step 1: Platform URL Discovery
Searches for restaurant presence across:
- UberEats (`site:ubereats.com`)
- DoorDash (`site:doordash.com`)
- Facebook (`site:facebook.com`)
- Instagram (`site:instagram.com`)
- Me&You (`site:meandyou.co.nz`)
- Mobi2Go (`site:mobi2go.com`)
- DeliverEasy (`site:delivereasy.co.nz`)
- NextOrder (`site:nextorder.co.nz`)
- FoodHub (`site:foodhub.co.nz`)
- OrderMeal (`site:ordermeal.co.nz`)
- General website search

#### Step 2: Extraction Priority System
```
Priority 1: UberEats URL → Extract address & hours (most reliable)
Priority 2: Restaurant website → Extract phone & fallback for all fields
Priority 3: Other platforms → Fill remaining gaps
```

#### Step 3: Dynamic Search Termination
The system tracks missing fields and stops when all required data is found:
```javascript
const extractionGoals = {
  address: !extractedData.address,
  phone: !extractedData.phone,
  openingHours: extractedData.openingHours.length === 0
};

if (!extractionGoals.address && !extractionGoals.phone && !extractionGoals.openingHours) {
  console.log('All required data found, skipping remaining URLs');
  break;
}
```

#### Validation Rules

**Address Validation:**
- Rejects `'null'` strings
- Rejects numbers-only values (e.g., `"35341547"`)
- Requires actual text content

**Phone Validation (NZ-specific):**
```javascript
// Valid patterns:
+64[2-9]\d{7,9}    // International format
0[3-9]\d{7}        // Area codes 3-9
02[0-9]\d{7,8}     // Mobile
0800\d{6,7}        // Toll-free
0508\d{6}          // Premium
```

**Hours Validation:**
- Rejects entries containing "menu"
- Validates day names
- Expands "Every day" to all 7 days
- Handles day ranges (e.g., "Monday-Saturday")

### Hours Parsing: Midnight Crossing Detection

**Problem:** Restaurants that close after midnight (e.g., "Friday 4pm-2am") need special handling because downstream systems (CloudWaitress forms) don't understand cross-day time slots.

**Solution:** Split into two entries:

**Input:**
```
Friday: 4:00pm - 2:00am
```

**Output:**
```json
[
  {"day": "Friday", "hours": {"open": "16:00", "close": "23:59"}},
  {"day": "Saturday", "hours": {"open": "00:00", "close": "02:00"}}
]
```

**Detection Logic:**
```javascript
const openTime = parseTime(open24);   // Minutes since midnight
const closeTime = parseTime(close24);

if (closeTime < openTime && closeTime !== 0) {
  // Midnight crossing detected - split into two entries
  entries.push({day: day, hours: {open: open24, close: "23:59"}});
  entries.push({day: getNextDay(day), hours: {open: "00:00", close: close24}});
}
```

**Time Conversion:**
- `"5pm"` → `"17:00"`
- `"5:30pm"` → `"17:30"`
- `"midnight"` → `"00:00"`
- `"late"` / `"late night"` → `"23:00"`

### Fallback Method 1: Platform-Specific Details Extraction

**Endpoint:** `POST /api/platform-details-extraction`

**Purpose:** Re-scrape specific fields from individual platform URLs

**Platform Capabilities:**
| Platform | Address | Hours | Phone |
|----------|---------|-------|-------|
| UberEats | ✓ | ✓ | ✗ |
| DoorDash | ✗ | ✓ | ✗ |
| Website | ✓ | ✓ | ✓ |
| Me&You | ✓ | ✓ | ✓ |
| Mobi2Go | ✓ | ✓ | ✓ |
| DeliverEasy | ✓ | ✓ | ✓ |
| NextOrder | ✓ | ✓ | ✓ |
| FoodHub | ✓ | ✓ | ✓ |
| OrderMeal | ✓ | ✓ | ✓ |

**UI Flow:**
1. User clicks "Get Details" button next to platform URL
2. Dialog shows available fields for that platform
3. User selects which fields to extract
4. System scrapes only requested fields
5. Data persists to database

### Fallback Method 2: Manual Edit

**Purpose:** Human override when automated extraction fails

**UI:** "Edit Details" button opens editable form for all fields

---

## Phase 3: Asset Processing

### Logo Extraction & Processing

**Endpoint:** `POST /api/extract-logo`

#### Step 1: Logo Candidate Extraction
Uses Firecrawl with JSON extraction schema to find logo candidates:

**Candidate Properties:**
- `url`: Direct image URL
- `confidence`: 0-100 probability score
- `width`, `height`: Pixel dimensions
- `location`: header/nav/footer/content
- `isGraphic`: Boolean (graphic vs photo)
- `hasLogoIndicators`: Boolean (logo in filename/class)
- `altText`: Alt attribute
- `format`: svg/png/jpg
- `reason`: Why this might be the logo

**Fallback Candidates:**
- Open Graph image (30% confidence)
- Apple Touch Icon (25% confidence)
- Favicon (20% confidence)

**Aspect Ratio Validation:**
- Rejects images with extreme aspect ratios (>4 or <0.25)

#### Step 2: User Selection
User selects correct logo from candidates or pastes URL manually

#### Step 3: Image Processing (Sharp + RemoveBG)

**Output Formats:**

| Format | Size | Purpose |
|--------|------|---------|
| Original | Native | Archive |
| Standard | 500x500 | Web display |
| No Background | Trimmed | Overlays |
| Thermal v1 (Inverted) | 265px wide | Light logo on dark thermal |
| Thermal v2 (Standard) | 265px wide | Dark logo on light thermal |
| Thermal v3 (High Contrast) | 265px wide | Binary threshold |
| Thermal v4 (Adaptive) | 265px wide | Preserved mid-tones |
| Favicon | 32x32 | Browser tab |

**Thermal Processing:**
Multiple algorithms ensure at least one version works well on receipt printers:
- Inverted: Light pixels → black
- Standard: Dark pixels → black
- High Contrast: Binary threshold at 128
- Adaptive: Preserves mid-tones for detail

#### Step 4: Color Extraction (Vibrant.js)

**Extracts 5 colors:**
1. **Primary** - Most vibrant color (main brand)
2. **Secondary** - Dark vibrant or muted (contrast)
3. **Tertiary** - Next distinct color
4. **Accent** - Light vibrant (highlights)
5. **Background** - Light muted (page background)

**Theme Detection:**
```javascript
const theme = getBrightness(dominantRgb) > 128 ? 'light' : 'dark';
```

### Menu Extraction

#### Standard Extraction
**Platforms:** UberEats, DoorDash, other delivery platforms

**Output:**
- Categories (name, display name, description)
- Items (name, price, description, image URL)
- Basic structure for CSV export

#### Premium Extraction (UberEats Only)

**7-Phase Process:**

**Phase 1: Category Extraction**
- Scrapes all menu category names from store page

**Phase 2: Menu Items with Modal URLs**
- Extracts `modalUrl` containing `modctx` parameter (dialog ID)
- Captures basic item data (name, price, description, image)

**Phase 3: URL Cleaning**
Converts modal URLs to direct item page URLs:
```
Input:  ?modctx=%7B%22sectionUuid%22%3A%22abc%22...%7D
Output: /store/restaurant/abc/def/ghi
```

**Phase 4: Option Sets Extraction**
- Scrapes individual item pages for detailed option sets
- Extracts: set name, required flag, min/max selections, options with prices

**Phase 5: Option Set Deduplication**
Many items share identical option sets. System deduplicates using SHA-256 hashing:

```javascript
// Normalized structure for hashing:
{
  name: "lowercase trimmed",
  required: boolean,
  minSelections: number,
  maxSelections: number,
  options: [
    { name: "lowercase trimmed sorted", priceValue: number }
  ]
}
```

**Classification:**
- **Shared Sets:** Used by 2+ items → stored once, linked via junction table
- **Unique Sets:** Item-specific → stored per item

**Phase 6: Image Validation**
- Filters out placeholder images (`_static` in URL)
- Prioritizes high-quality images from option set detail pages

**Phase 7: Database Persistence**
- Saves menu structure with deduplication
- Creates `option_sets` records (no menu_item_id - allows sharing)
- Creates `menu_item_option_sets` junction entries
- Updates menu item option set flags

### CDN Image Upload

**Purpose:** Upload menu images to CloudWaitress CDN before CSV import

**Process:**
1. User reviews extracted menu data in UI
2. Clicks "Upload Images to CDN"
3. System uploads each image to CloudWaitress CDN
4. Returns CDN image IDs
5. IDs are included in CSV export for menu import

### CSV Generation

**Menu CSV Headers:**
```
menuID, menuName, menuDisplayName, menuDescription,
categoryID, categoryName, categoryDisplayName, categoryDescription,
dishID, dishName, dishPrice, dishType, dishDescription,
displayName, printName, tags, imageId
```

**Option Sets CSV Headers:**
```
optionSetName, optionSetDisplayName, required, selectMultiple,
enableOptionQuantity, minOptionsRequired, maxOptionsAllowed, freeQuantity,
optionName, optionPrintName, optionPrice, menuItems
```

---

## Phase 4: Automated Onboarding

### Playwright Automation Scripts

All scripts use:
- `headless: false` for visual demonstration
- Smart restaurant matching (fuzzy matching with scoring)
- Multiple selector fallback strategies
- Screenshot capture for debugging
- `--debug` flag to keep browser open

### Script Sequence

#### 1. Register User Account (API)
**Method:** CloudWaitress API with HMAC authentication

**Process:**
1. Start registration: `POST /users/register/start`
2. Auto-verify using admin password bypass: `POST /users/register/verify`
3. Create `pumpd_accounts` record

#### 2. Register Restaurant (Playwright)
**Script:** `login-and-register-restaurant.js`

**Automates:**
- Login to admin.pumpd.co.nz
- Navigate to restaurant creation
- Fill restaurant details (name, address, phone)
- Configure operating hours (handles midnight-crossing splits)
- Submit registration

#### 3. Import CSV Menu (Playwright)
**Script:** `import-csv-menu.js`

**Automates:**
- Login with user credentials
- Smart restaurant matching by name
- Navigate to Menu section
- Open CSV import dialog
- Upload generated CSV file
- Verify import completion

#### 4. Add Item Tags (Playwright)
**Script:** `add-item-tags.js`

**Creates 10 predefined tags:**
| Tag | Color |
|-----|-------|
| Popular | #b400fa (purple) |
| New | #3f92ff (blue) |
| Deal | #4fc060 (green) |
| Vegan | #36AB36 (green) |
| Vegetarian | #32CD32 (light green) |
| Gluten Free | #FF8C00 (orange) |
| Dairy Free | #4682B4 (steel blue) |
| Nut Free | #DEB887 (tan) |
| Halal | #8B7355 (brown) |
| Spicy | #FF3333 (red) |

#### 5. Add Option Sets (Playwright)
**Script:** `add-option-sets.js`

**Automates:**
- Login with user credentials
- Navigate to Option Sets tab
- For each option set from extraction:
  - Create new option set
  - Configure name, display name
  - Set required/multiple selections
  - Set min/max selections
  - Add options with pricing
  - (Optional) Apply to specific menu items
  - Save

#### 6. Generate Code Injections (Playwright)
**Script:** `ordering-page-customization.js`

**Purpose:** Generate custom CSS/JS for website styling

**Automates:**
- Login to manage.pumpd.co.nz (super admin)
- Navigate to code injections generator
- Input primary and secondary colors
- Select theme (light/dark)
- Select preset (e.g., "Interactive Showcase")
- Configure components (welcome message with restaurant name)
- Export head and body tag injections

**Output:**
- `head-injection.html`: CSS, tracking codes, fonts
- `body-injection.html`: JavaScript, widgets

#### 7. Configure Website Settings (Playwright)
**Script:** `edit-website-settings-light.js` / `edit-website-settings-dark.js`

**Automates:**
- Login with user credentials
- Navigate to Settings → Website
- Upload logo images
- Configure brand colors (primary, secondary)
- Set theme (light/dark)
- Add SEO metadata:
  - Title: "{Restaurant} {Address} - Order Online for Delivery or Pickup"
  - Meta: "{Address} {Phone} - Best {Cuisine} in {City}"
- Paste code injections
- Add social media links (Instagram, Facebook)
- Save settings

#### 8. Configure Services Settings (Playwright)
**Script:** `setup-services-settings.js`

**Automates:**
- Configure delivery settings (enable, fees, zones)
- Configure pickup settings (enable, time slots)
- Set auto status update times
- Save configuration

#### 9. Configure Stripe Payments (Playwright)
**Script:** `setup-stripe-payments.js`

**Automates:**
- Navigate to Settings → Payments
- Enable Stripe integration
- Connect Stripe account
- Configure transaction fees
- Save configuration

#### 10. Create Onboarding User Account
**Method:** API

**Creates:** New record in `pumpd_users` table with role "new_sign_up"

#### 11. Update Onboarding Record
**Method:** API

**Populates:** All scraped data into onboarding dashboard fields

#### 12. Finalise Setup (Post-Close)
**Script:** `finalise-onboarding-user.js`

**Requires:** Data from completed onboarding dashboard (GST, NZBN, Google Auth ID)

**Automates:**
- Configure receipt printers with GST numbers
- Add thermal logo images
- Add Google Auth Client ID
- Configure webhook and API key
- Complete Uber Direct integration:
  - Fill NZBN (NZ Business Number)
  - Fill Legal Company Name
  - Fill Trading Name
  - Fill Director's Full Name
  - Fill Director's Mobile Number
  - Enable and save

### Parallel Execution

Many scripts can run simultaneously:
- User registration + Item tags
- Menu import + Website settings
- Option sets + Services settings

**Visual demonstration:** Multiple browser windows automating different tasks simultaneously (headless=false)

---

## Phase 5: Sales Automation

### Sequence Templates

**Structure:**
- Name, description, active status
- 1-50 ordered steps
- Each step has:
  - Task type (email, call, text, social_message, demo_meeting, internal_activity)
  - Delay value + unit (minutes/hours/days)
  - Message template reference

### Sequence Instances

**When started:**
1. Create `sequence_instances` record (restaurant_id, status='active')
2. Bulk create all tasks (first='active', rest='pending')
3. Calculate due_date for first task based on delay

**Progress tracking:**
- completed/total/percentage
- current_step_order increments as tasks complete
- Can pause, resume, cancel, or finish early

### Variable Replacement

**63 available variables organized by category:**

**Restaurant & Contact:**
```
{restaurant_name}, {contact_name}, {first_name}, {contact_email}, {city}, {cuisine}
```

**Example Restaurants (by city):**
```
{example_restaurant_1}, {example_restaurant_1_url}
```

**Dates:**
```
{today}, {current_date}, {current_year}, {last_contacted_day}
```

**UberEats Metrics:**
```
{weekly_uber_sales_volume} → "250 orders"
{uber_aov} → "$32.50"
{uber_markup} → "25.0%"
```

**Sales Context:**
```
{painpoints}, {core_selling_points}, {features_to_highlight}
```

**Demo/Platform URLs:**
```
{demo_store_url}, {ordering_url}, {admin_url}
```

**Formatting helpers:**
- `formatCurrency()` - NZD format
- `formatNumber()` - Locale string with suffix
- `formatPercentage()` - 1 decimal place
- `formatArray()` - Comma-separated
- `formatRelativeDate()` - "yesterday", "on Monday", "2 weeks ago"

---

## Evolution: Claude Code to Human-in-the-Loop

### Initial Design: Fully Automated
- Claude Code orchestrated all steps via subagents
- Custom slash command contained orchestration instructions
- Input: lead form data → Output: fully configured account

### Problem Discovered
- When steps failed, data wasn't persisted
- No way to intervene, correct, and continue
- All-or-nothing execution

### Solution: Human-in-the-Loop UI
- Each step is a discrete button
- Data persists immediately to database
- Failures can be fixed and retried
- Human provides judgment calls and QA
- Automation handles heavy lifting

### Design Principle
**The right balance:** Automate data gathering and repetitive tasks; keep human in loop for quality assurance and exception handling.

---

## Technical Stack

| Component | Technology |
|-----------|------------|
| Frontend | React, Tailwind CSS |
| Backend | Node.js, Express |
| Database | PostgreSQL (Supabase) |
| Web Scraping | Firecrawl API |
| Browser Automation | Playwright |
| Image Processing | Sharp, RemoveBG API |
| Color Extraction | Vibrant.js |
| Workflow Automation | Pabbly Connect |
| CRM | HubSpot |
| Email | AWS SES |
| SMS | Kudosity API |
| Hosting | Cloudflare, Netlify |

---

## Key Code Locations

### Lead Data Scraping & Validation
| File | Purpose | Key Lines |
|------|---------|-----------|
| `UberEats-Image-Extractor/server.js` | Google business search endpoint | 5379-5970 |
| `UberEats-Image-Extractor/server.js` | Platform details extraction | 6264-6597 |
| `UberEats-Image-Extractor/server.js` | Hours parsing & midnight detection | 6599-6664 |
| `UberEats-Image-Extractor/src/pages/RestaurantDetail.jsx` | Google search handler | 1486-1545 |
| `UberEats-Image-Extractor/src/pages/RestaurantDetail.jsx` | Details extraction UI | 2089-2160 |

### Logo Extraction & Processing
| File | Purpose |
|------|---------|
| `UberEats-Image-Extractor/src/services/logo-extraction-service.js` | Firecrawl logo candidates |
| `UberEats-Image-Extractor/src/services/logo-extraction-service.js` | Color extraction (Vibrant.js) |
| `UberEats-Image-Extractor/src/services/logo-extraction-service.js` | Sharp processing + RemoveBG |
| `scripts/process-logo.js` | CLI logo processor |

### Menu Extraction
| File | Purpose |
|------|---------|
| `UberEats-Image-Extractor/src/services/premium-extraction-service.js` | 7-phase premium extraction |
| `UberEats-Image-Extractor/src/services/option-sets-extraction-service.js` | Option sets from item pages |
| `UberEats-Image-Extractor/src/services/option-sets-deduplication-service.js` | SHA-256 deduplication |
| `UberEats-Image-Extractor/src/services/url-cleaning-service.js` | Modal → direct URL conversion |
| `UberEats-Image-Extractor/src/services/database-service.js` | Junction table persistence |
| `UberEats-Image-Extractor/src/utils/csv-generator.js` | CSV export |

### Playwright Automation
| File | Purpose |
|------|---------|
| `scripts/restaurant-registration/login-and-register-restaurant.js` | Restaurant registration |
| `scripts/restaurant-registration/import-csv-menu.js` | CSV menu import |
| `scripts/restaurant-registration/add-item-tags.js` | Item tags configuration |
| `scripts/restaurant-registration/add-option-sets.js` | Option sets configuration |
| `scripts/edit-website-settings-light.js` | Website settings (light theme) |
| `scripts/edit-website-settings-dark.js` | Website settings (dark theme) |
| `scripts/ordering-page-customization.js` | Code injection generator |
| `scripts/setup-services-settings.js` | Delivery/pickup settings |
| `scripts/setup-stripe-payments.js` | Stripe integration |
| `scripts/finalise-onboarding-user.js` | Uber Direct integration |

### Sales Features
| File | Purpose |
|------|---------|
| `UberEats-Image-Extractor/src/services/sequence-templates-service.js` | Template CRUD |
| `UberEats-Image-Extractor/src/services/sequence-instances-service.js` | Instance lifecycle |
| `UberEats-Image-Extractor/src/services/variable-replacement-service.js` | 63-variable replacement |
| `UberEats-Image-Extractor/src/hooks/useSequences.ts` | React Query hooks |
| `UberEats-Image-Extractor/src/pages/Restaurants.jsx` | CRM page |

---

## Results Summary

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Research time per account | 45 min | 3 min | 93% reduction |
| Onboarding time per customer | 4 hours | 15 min | 94% reduction |
| Outreach-to-demo conversion | ~15-20% | 67% | 3-4x improvement |
| Restaurants onboarded | - | 30+ | - |
| Manual processes automated | - | 98% | - |

---

*Document created for xGrowth GTM Engineer video demo preparation and future agency case study documentation.*
