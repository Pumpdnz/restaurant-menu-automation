# Restaurant Registration Automation - Planning, Progress and Documentation of workflow

## Project Overview
- Automate the complete restaurant onboarding process from marketing lead to fully configured account, enabling the sales team to reach out to prospects with tailored product demos and close more deals

### Workflow Overview
- Call specialised subagents in phases with parallel execution to complete each task with precision while keeping the orchestration agent's context window clean and focused on the overall task

## Input Data - *Provided to Orchestration Agent from Marketing Lead Form*
```
Restaurant Name: [name]
City: [city]
Weekly Delivery App Sales: [sales_range]
Contact Name: [contact_name]
Email: [email]
Phone Number: [phone]
Create Time: [timestamp]
```

## Complete Workflow Steps

### Phase 1: *Parallel Execution of subagents specialised for information gathering*

#### Subagent 1 Specialisation: Basic Menu Data Extraction

**Agent Name**: delivery-url-finder

**Inputs**:
- Restaurant Name 
- Restaurant Location 
  - *Primary location identifier: **City***
  - *Optional additional location identifiers: **Suburb and/or Street name***

**Tools**:
- WebSearch

**Process**:
- Uses Websearch to find the UberEats URL of the restaurant's ordering page
- Extracts the base URL (e.g., `https://www.ubereats.com/nz/store/[restaurant-slug]/[store-id]`)

**Report / Response**:
- Responds to orchestration agent in the following structured JSON format:
```json
{
  "restaurantName": "exact restaurant name found",
  "location": "verified location",
  "uberEatsUrl": "full ordering URL or null", 
  "notes": "any important findings or limitations",
  "toolsUsed": ["list of tools invoked to complete task"],
  "Queries": ["list of queries used"],
  "taskCompletionStatus": "completed or manual intervention required"
}
```
#### Subagent 2 Specialisation: Comprehensive Business Details Extraction
**Agent Name**: google-business-extractor

**Inputs**:
- Restaurant Name 
- Restaurant Location 
  - *Primary location identifier: **City***
  - *Optional additional location identifiers: **Suburb and/or Street name***

**Tools**: 
- mcp__firecrawl__firecrawl_search
- mcp__firecrawl__firecrawl_scrape
- Write

**Process**:
- Uses 'mcp__firecrawl__firecrawl_search' to search Google for `"[Restaurant Name] [City] New Zealand"`
- Extracts business hours, address, phone, website url, social media url(s) and logo image links from search results
- Uses 'Write' to save the complete response from Firecrawl for logging, debugging and data capture to a file at path @automation/firecrawl-logs/firecrawl-search-logs/ using the file naming pattern "restaurantName-location-search.md" e.g., "../firecrawl-search-logs/smokeyTs-christchurch-search.md"
- Intelligently parses the information returned by firecrawl to resolve conflicts
- Follows up with further uses of 'firecrawl_scrape' to get missing or incomplete data

**Report / Response**:
- Responds to orchestration agent with the following structured JSON format:
```json
{
  "restaurantName": "exact restaurant name found by Firecrawl",
  "openingHours":[
    "days"{
      "openTime": "open time",
      "closeTime": "close time"
    }],
  "address": "exact street address of the business if found by Firecrawl",
  "phone": "exact phone number of the business if found by Firecrawl",
  "websiteUrl": "root domain of the restaurant's website if found by Firecrawl",
  "instagramUrl": "url of the restaurant's Instagram account if found by Firecrawl",
  "facebookUrl": "url of the restaurant's Facebook account if found by Firecrawl",
  "imageUrls": ["list of all image URLs found in metadata"],
  "cuisine": ["list of cuisine descriptors"],
  "notes": "any important findings or limitations",
  "toolsUsed": ["list of tools invoked to complete task"],
  "taskCompletionStatus": "completed or manual intervention required",
  "search_query_used": "[exact query you searched]",
  "extraction_notes": "[what was/wasn't found]",
  "warnings": ["any issues encountered"]
}
```
### Phase 2: Parallel Execution of Specific Resource Gathering Agents

IMPORTANT: Based on the information returned by the google-business-extractor agent, ONLY call ONE of the following agents:
  - restaurant-logo-website (P0) 
  - restaurant-logo-instagram (P1)
  - restaurant-logo-search (P2)
- These agents are specialised to locate the logo and colors of a restaurant and each use a distinct method
- The restaurant's website is the most reliable source of the logo and colors. However, if the website url has not been found by the google-business-extractor agent, we should assume that the restaurant does not have their own website and should instead fallback to the instagram option. If the google-business-extractor agent returns neither a website url or an instagram url, fall back to the search option. 

#### Subagent 1 Specialisation: Logo and brand color extraction
**Agent Names**: IMPORTANT: Select only ONE option from this list:
- restaurant-logo-website (P0) 
- restaurant-logo-instagram (P1)
- restaurant-logo-search (P2)

**Inputs**:
- Restaurant website URL (if found by google-business-extractor in phase 1)
- Restaurant instagram URL (if found by google-business-extractor in phase 1)
- Restaurant Name
- Restaurant Location 
  - *Primary location identifier: **City***
  - *Optional additional location identifiers: **Suburb and/or Street name***

**Tools**:
- restaurant-logo-website:
  - Bash
  - Read
  - Edit

- restaurant-logo-instagram:
  - Bash
  - Read
  - Write
  - Glob
  - LS

- restaurant-logo-search:
  - Bash
  - Read
  - Write
  - Glob
  - LS
  - Edit

**Processes**:
- restaurant-logo-website:
  - Runs restaurant-logo-extractor.js script to extract logo from website
  - Downloads logo and manually extracts website colors
  - Processes logo to create three versions:
    - logo-nobg.png (background removed/cropped)
    - logo-standard.png (500x500 version)
    - logo-thermal.png (200x200 pure black for thermal printers)
  - Manually analyzes logo for brand colors
  - Updates brand-analysis.json with complete color data and theme

- restaurant-logo-instagram:
  - Runs instagram-image-extractor.js script
  - Downloads profile picture and post images
  - Processes logo to create three versions:
    - logo-nobg.png (background removed)
    - logo-standard.png (500x500 version)
    - logo-thermal.png (200x200 pure black for thermal printers)
  - Analyzes colors from logo and posts
  - Creates instagram-brand-analysis.json with colors and theme

- restaurant-logo-search:
  - Runs search-and-screenshot.cjs "[Restaurant Name]" "[Location]"
  - Evaluates search results and selects best logo
  - Runs extract-selected-logo.cjs to get full resolution URL
  - Downloads logo using download-logo-simple.cjs
  - Processes logo to create three versions:
    - logo-nobg.png (background removed/cropped)
    - logo-standard.png (500x500 version)
    - logo-thermal.png (200x200 pure black for thermal printers)
  - Manually analyzes and updates metadata.json with colors and theme

**Report / Response**:
- All agents respond to the orchestration agent with the following structured format:

```
✅ Logo successfully extracted from ([Website URL] / Instagram / Google Search)

📍 Restaurant: [Restaurant Name]
📍 Location: [Location]
🌐 Website/Instagram URL: [URL]
🔍 Source: Restaurant's Website / Instagram profile picture / Google Images search

📁 Files Created:
- Original: /automation/planning/downloaded-images/[restaurant-name]-[location]/logo-from-[source].[ext]
- Processed (Use full paths): logo-nobg.png, logo-standard.png, logo-thermal.png
- Analysis: [brand-analysis.json / instagram-brand-analysis.json / metadata.json]

📊 Logo Details:
- Format: [base64/url/svg/png/jpeg]
- Original Dimensions: [width]x[height]px
- Processing: [Background removed/Already transparent]
- Size: [size] bytes

🎨 Logo Colors:
- Primary: #[HEX] - [Color Name]
- Secondary: #[HEX] - [Color Name]
- Additional: [List any additional colors]

🎨 Website Colors (Only website agent):
- Primary: #XXXXXX - [Color Name] - [Usage]
- Secondary: #XXXXXX - [Color Name] - [Usage]

🖼️ Post Images (Only instagram agent):
- Downloaded: [X] images for additional brand context

🎭 Theme: [light/dark]
🔍 Source: [Website/Instagram/Google Search]
⚠️ Notes: [Any important observations]
```

#### Subagent 2 Specialisation: Menu CSV building and Image Extraction

**Agent Name**: menu-extractor-batch

**Inputs**: 
- UberEats URL
- Restaurant Name
- Restaurant Location   

**Tools**:
- Bash
- Read
- Write

**Process for menu-extractor-batch**:
- Uses the 'Bash' tool to interact with API endpoints of an internal app on port 3007
- Phase 1: Scans menu categories using the /api/scan-categories endpoint
- Phase 2: Starts async batch extraction job using /api/batch-extract-categories with async=true
- Phase 3: Polls /api/batch-extract-status/:jobId every 15 seconds for progress updates
- Phase 4: Retrieves results from /api/batch-extract-results/:jobId when complete
- Processes aggregated response containing all menu items from all categories
- Makes a POST request to the /generate-clean-csv endpoint and saves CSV files to @automation/extracted-menus/
- Follows same naming patterns and image download process as direct method
- Downloads and Organizes Menu Images
- The outputPath must be relative to the server's location: "./downloads/extracted-images/[restaurant-name-location]"
- Remove JSON files from json-resources folder after successful completion
- Average processing time: ~300 seconds (runs async without timeout issues)

**Report / Response**:
- Responds to the orchestration agent with the following structured markdown format:

**Menu Extraction Summary:**
- Restaurant: [Name]
- Total Items: [Count]
- Categories: [Count] (includes successful/failed breakdown)
- Extraction Method: Batch
- Processing Time: [Duration]

**Generated Files:**
- CSV with images: [Absolute path]
- CSV without images: [Absolute path]
- Image mapping file: [Absolute path]

**Image Download Results:**
- Total images: [Count]
- Successfully downloaded: [Count]
- Failed downloads: [Count]
- Storage location: [Absolute path]

**Category Extraction Details**:
- Successful categories: [List]
- Failed categories: [List with error reasons]

**Errors/Warnings:**
- [List any issues encountered]

**Next Steps:**
- [Any recommended follow-up actions]

### Phase 3: Account Creation & Configuration

#### Subagent 1 Specialisation: Pumpd account registration and restaurant creation

**Agent Name**: restaurant-registration-browser

**Inputs**:
- email: User email for registration (provided from lead form)
- password: User password 
  - IMPORTANT: (Set the user password following the established convention format "Restaurantname789!" for consistency)
- name: Restaurant name
- address: Full address including city and country as found by the google-business-extractor agent in phase 1 (e.g., "123 Main St, Wellington, New Zealand")
- phone: Restaurant phone number in format 041234567 (clean response from google-business-extractor agent or use lead form data as fallback if necessary. Do not include spaces or special characters)
- dayHours: Opening hours as JSON string in object or array format
  - IMPORTANT: Try to parse the response from the google-business-extractor agent into one of the following formats to reduce the possibility of errors
    - Standard hours (open 7 days per week and hours do not cross midnight): --dayHours='{"Monday":{"open":"11:00","close":"22:00"},"Tuesday":{"open":"11:00","close":"22:00"}}'
    - Complex hours (closed one or more days and/or hours cross midnight): --dayHours='[{"day":"Tuesday","hours":{"open":"09:30","close":"20:30"}},{"day":"Friday","hours":{"open":"09:30","close":"23:59"}},{"day":"Saturday","hours":{"open":"00:00","close":"02:00"}},{"day":"Saturday","hours":{"open":"09:30","close":"23:59"}},{"day":"Sunday","hours":{"open":"00:00","close":"02:00"}}]'

**Tools**:
- Bash
- Read
- Write

**Process**:
- Validates prompt to ensure proper formatting of argument variables
- Uses Bash to execute the script at path @automation/scripts/restaurant-registration/register-restaurant-production.js
```bash
node /Users/giannimunro/Desktop/cursor-projects/automation/scripts/restaurant-registration/register-restaurant-production.js \
  --email="[email]" \
  --password="[password]" \
  --name="[restaurant name]" \
  --address="[full address]" \
  --phone="[phone]" \
  --dayHours='[hours JSON]'
```

**Example Commands:**

Basic registration with default hours:
```bash
node /Users/giannimunro/Desktop/cursor-projects/automation/scripts/restaurant-registration/register-restaurant-production.js \
  --email="newrestaurant@gmail.com" \
  --password="Restaurantname789!" \
  --name="Pizza Palace" \
  --address="123 Cuba Street, Wellington, New Zealand" \
  --phone="041234567"
```

Registration with custom hours (closed Monday/Wednesday):
```bash
node /Users/giannimunro/Desktop/cursor-projects/automation/scripts/restaurant-registration/register-restaurant-production.js \
  --email="latenight@gmail.com" \
  --password="SecurePass123!" \
  --name="Late Night Bar" \
  --address="150 Cuba Street, Wellington, New Zealand" \
  --phone="042345678" \
  --dayHours='[{"day":"Tuesday","hours":{"open":"09:30","close":"20:30"}},{"day":"Thursday","hours":{"open":"09:30","close":"20:30"}},{"day":"Friday","hours":{"open":"17:00","close":"23:59"}},{"day":"Saturday","hours":{"open":"00:00","close":"03:00"}},{"day":"Saturday","hours":{"open":"17:00","close":"23:59"}},{"day":"Sunday","hours":{"open":"00:00","close":"03:00"}}]'
```

**Report / Response**:
- Responds to orchestration agent in the following structured format:

**Registration Summary:**
- User Email: [Email]
- Restaurant Name: [Name]
- Subdomain: [Generated subdomain].pumpd.co.nz
- Registration Method: Full (Account + Restaurant)
- Processing Time: [Duration]

**Configuration Applied:**
- Address: [Selected address]
- Phone: [Phone number]
- Operating Hours: Description of opening hours
- Locale: English - New Zealand
- Timezone: Auckland
- Currency: NZD
- Tax in Prices: Enabled

**Generated Resources:**
- Dashboard URL: https://admin.pumpd.co.nz/restaurants/[id]
- Screenshots: [Count] saved to /automation/scripts/restaurant-registration/screenshots/
- Browser Status: [Closed/Open for debugging]

**Operating Hours Details:**
- Monday: [Hours or Closed]
- Tuesday: [Hours or Closed]
- Wednesday: [Hours or Closed]
- Thursday: [Hours or Closed]
- Friday: [Hours or Closed]
- Saturday: [Hours or Closed]
- Sunday: [Hours or Closed]

**Errors/Warnings:**
- [List any issues encountered]


### Phase 4: Menu Configuration

#### Subagent 1 Specialisation: Complete Menu Import and Image Upload

**Agent Name**: menu-import-uploader

**Inputs**:
- email: User email for login (from restaurant-registration-browser phase 3)
- csvFile: Path to CSV file WITHOUT images (from menu-extractor-batch phase 2 - use the "_no_images.csv" version)
- imageMapping: Path to image-mapping.json file (from menu-extractor-batch phase 2)
- imagesDir: Path to directory containing menu images (from menu-extractor-batch phase 2)
- restaurantName: Restaurant name (for file matching)
- maxUploads: Maximum number of images to upload (optional, default: all)

**Tools**:
- Bash
- Read
- Write

**Process**:
- Phase 1: CSV Import
  - Validates CSV file exists and is the no_images version
  - Executes import-csv-menu.js script
  - Logs in to admin.pumpd.co.nz using provided credentials
  - Navigates to restaurant menu management
  - Imports CSV menu data
  - Verifies successful import before proceeding

- Phase 2: Image Upload
  - Validates image mapping and images directory
  - Executes upload-menu-images.js script
  - Logs in to admin portal (reuses session if possible)
  - Navigates to menu section
  - Opens menu categories sequentially
  - For each menu item with an image:
    - Calculates correct edit button index using position-based formula
    - Opens item edit dialog
    - Navigates to Image & Tags tab
    - Uploads image via Uploadcare widget
    - Saves changes
  - Tracks upload progress and success rate

**Report / Response**:

- Responds to orchestration agent in the following structured format:

**Menu Import Summary:**
- User Email: [Email]
- Restaurant Name: [Name]
- Processing Method: Sequential (CSV Import → Image Upload)
- Total Processing Time: [Duration]

**Phase 1 - CSV Import Results:**
- CSV File: [Filename] (no_images version)
- File Size: [Size in bytes]
- Import Status: [Success/Failed]
- Categories Imported: [Count if available]
- Items Imported: [Count if available]
- Screenshots Saved: [Count]
- Errors: [List any errors]

**Phase 2 - Image Upload Results:**
- Image Mapping File: [Filename]
- Total Items with Images: [Count]
- Images Successfully Uploaded: [Count]
- Images Failed: [Count]
- Upload Percentage: [Percentage]
- Categories Processed: [List]
- Screenshots Saved: [Count]
- Errors: [List any errors]

**File Resources Used:**
- CSV Path: [Absolute path]
- Image Mapping Path: [Absolute path]
- Images Directory: [Absolute path]
- Screenshot Directory: /automation/scripts/restaurant-registration/screenshots/

**Configuration Details:**
- Browser Mode: Non-headless
- DEBUG_MODE: [Enabled/Disabled]
- Max Upload Limit: [Number or "All"]
- Timeout Setting: 1800000ms

**Errors/Warnings:**
- [List any issues encountered during either phase]

**Next Steps:**
- [Any recommended follow-up actions or manual interventions needed]

### Phase 5: Website Code Injection Generation and Pumpd Website Settings Configuration 

#### Subagent 1 Specialisation: Website Customization and Branding

**Agent Name**: pumpd-website-customiser

**Required Inputs**:
- metadata_source: Which JSON file to read based on logo extraction method used:
  - `metadata.json` (if restaurant-logo-search was used)
  - `brand-analysis.json` (if restaurant-logo-website was used)
  - `instagram-brand-analysis.json` (if restaurant-logo-instagram was used)
- restaurant_name: Full restaurant name
- restaurant_dir: Directory name (e.g., `devil-burger-queenstown`) 
- email: Restaurant account email (from phase 3 registration)
- location: City/location name
- address: Full street address (from google-business-extractor)
- phone: Phone number

**Optional Inputs**:
- theme_override: Force light or dark theme (otherwise uses theme from JSON file)
- instagram_url: Instagram profile URL (from google-business-extractor if found)
- facebook_url: Facebook page URL (from google-business-extractor if found)
- cuisine: Cuisine type (if determined in previous phases)

**Tools**:
- Bash
- Read
- Write
- Glob
- LS

**Process**:
Phase 1 - Code Generation:
- Reads specified JSON file from `/automation/planning/downloaded-images/[restaurant_dir]/`
- Extracts brand colors from `logoColors` array
- Validates colors (no black/white as primary/secondary)
- If only one non-B/W color found, generates lighter shade for secondary
- Executes ordering-page-customization.js with colors and theme
- Generates code injection files in `/automation/generated-code/[restaurant_dir]/`

Phase 2 - Admin Configuration:
- Prepares paths for generated code injections and logo-nobg.png
- Extracts cuisine from JSON if not provided
- Executes appropriate website settings script (dark/light based on theme)
- Uploads code injections, logo, and restaurant details to admin portal
- Extracts hosted logo url for reuse: console.log(`  📌 Uploaded Logo URL: ${logoUrl}`)
- Configures social media links if provided

**Implementation Status**: ✅ READY

**Report / Response**:
```
✅ Website Customization Complete

📍 Restaurant: [Restaurant Name]
📧 Email: [Email]
📍 Location: [Location]

🎨 Brand Colors Applied:
- Primary: #[HEX] - [Color Name]
- Secondary: #[HEX] - [Color Name]
- Theme: [light/dark]

📁 Phase 1 - Code Generation:
✓ Head injection created
✓ Body injection created
✓ Component files generated

🚀 Phase 2 - Admin Configuration:
✓ Logged into admin portal
✓ Code injections uploaded
✓ Logo uploaded: logo-nobg.png
✓ Restaurant details configured
✓ Social media links added: [if applicable]
✓ Cuisine type set: [if available]

🔗 Website Preview:
https://[restaurant-slug].pumpd.co.nz

🔗 Hosted Logo URL:
https://ucarecdn.com/...

⚠️ Notes:
[Any warnings or manual steps needed]
```

### Phase 6: Payment and Services Configuration

#### Subagent 1 Specialisation: Stripe Payments and Services Settings

**Agent Name**: payment-services-configurator

**Required Inputs**:
- email: Restaurant account email (from phase 3 registration)

**Tools**:
- Bash
- Read
- Write

**Process**:
Phase 1 - Stripe Payments Setup:
- Executes setup-stripe-payments.js script
- Logs into admin portal using email and default admin password
- Navigates to Settings → Payments
- Adds Stripe as payment method
- Configures Stripe settings:
  - Currency: NZD
  - Layout: Accordion without radio
  - Theme: Flat
  - Min Order: $2
  - Max Order: $9999
- Clicks "Connect to Stripe" button
- Captures Stripe Connect URL (critical for restaurant to complete setup)

Phase 2 - Services Configuration:
- Executes setup-services-settings.js script
- Logs into admin portal (reuses session if possible)
- Navigates to Settings → Services
- Configures Pickup settings:
  - Order timing: 0/15 minutes, 8 days ahead
  - Auto statuses: Confirm 1min, Ready 15min, Complete 30min
- Configures Delivery settings:
  - Map picker and force address enabled
  - Minimum order: $2
  - Order timing: 0/15 minutes, 8 days ahead
  - Auto statuses: Confirm 1min, Ready 15min, On Route 10min, Complete 30min
- Removes default checkout fields
- Disables Dine-ins and Table Bookings

**Implementation Status**: ✅ READY

**Report / Response**:
```
✅ Payment & Services Configuration Complete

📍 Restaurant Email: [Email]

💳 STRIPE PAYMENTS:
Status: Successfully Configured
- Payment Method: Stripe added
- Currency: NZD
- Layout: Accordion without radio
- Theme: Flat
- Min Order: $2
- Max Order: $9999

🔗 STRIPE CONNECT URL:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[STRIPE_CONNECT_URL]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ Restaurant must complete Stripe connection at this URL

🛠️ SERVICES SETTINGS:
Status: Successfully Configured

✓ Pickup Settings:
  - Order Timing: 0/15 minutes, 8 days ahead
  - Auto Statuses: Confirm 1min, Ready 15min, Complete 30min

✓ Delivery Settings:
  - Map Picker: Enabled
  - Force Address: Enabled
  - Minimum Order: $2
  - Order Timing: 0/15 minutes, 8 days ahead
  - Auto Statuses: Confirm 1min, Ready 15min, On Route 10min, Complete 30min

✓ Other Settings:
  - Custom Checkout: Default field removed
  - Dine-ins: Disabled
  - Table Bookings: Disabled

📸 Screenshots Saved:
- Payments: [Count] screenshots in /automation/scripts/screenshots/
- Services: [Count] screenshots in /automation/scripts/screenshots/

⏱️ Total Processing Time: [Duration]

⚠️ Notes:
[Any warnings or manual steps needed]
```

### Phase 7: Final Configuration & Onboarding Setup

#### Subagent 1 Specialisation: User Onboarding Account Setup

**Agent Name**: onboarding-account-setup

**Required Inputs**:
- userName: Owner's full name (from lead form)
- userEmail: Owner's email for login (from lead form)
- userPassword: Temporary password following established convention format "Restaurantname789!"
- restaurantName: Full restaurant name including location identifier (from Phase 1)
- organisationName: Organisation/company name (from Phase 3 registration)
- address: Full street address (from Phase 1 google-business-extractor)
- email: Restaurant contact email (from lead form and Phase 3 registration)
- phone: Restaurant phone number (from Phase 1 google-business-extractor)
- contactPerson: Primary contact name (from lead form and Phase 3 registration)
- venueOperatingHours: Operating hours as normal description but formatted as jsonb for database update "(e.g., Closed on Mondays, 9:00am to 9:30pm Tuesday - Thursday, 9:00am to 2:00am Friday and Saturday, 10:00am to 3:00pm on Sundays)"
- primaryColor: Primary brand color in hex format (from Phase 2 logo extraction)
- stripeConnectLink: Stripe Connect URL (from Phase 6 payment-services-configurator)
- logoUrl: Hosted logo URL (from Phase 5 pumpd-website-customiser)

**Optional Inputs**:
- secondaryColor: Secondary brand color (from Phase 2 if available)
- facebookUrl: Facebook page URL (from Phase 1 if found)
- instagramUrl: Instagram profile URL (from Phase 1 if found)

**Tools**:
- Bash
- mcp__supabase__execute_sql
- Read

**Process**:
1. **Create User Account**:
   - Navigate to /automation/scripts/ directory
   - Execute create-onboarding-user.js script with userName, userEmail, and userPassword
   - Creates "New Sign Up" user in Super Admin system
   - Organisation automatically set to "None" for later assignment

2. **Retrieve Onboarding Record**:
   - Use database function: `get_onboarding_id_by_email(userEmail)`
   - Extract onboarding_id from result
   - Handle error if record not found

3. **Update Database Record**:
   - Execute UPDATE query on user_onboarding table
   - Set all required fields:
     - restaurant_name, organisation_name, address
     - email, phone, contact_person
     - venue_operating_hours (as JSONB)
     - primary_color, stripe_connect_link, logo_url
   - Set optional fields if provided:
     - secondary_color, facebook_url, instagram_url
   - Update timestamp with NOW()

**Implementation Status**: ✅ READY

**Report / Response**:
```
✅ Onboarding Account Setup Complete

👤 USER ACCOUNT:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Email: [userEmail]
Name: [userName]
Role: New Sign Up
Status: Account created successfully
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 DATABASE RECORD:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Onboarding ID: [onboarding_id]
Updated Fields:
✓ Restaurant Name: [restaurantName]
✓ Organisation: [organisationName]
✓ Address: [address]
✓ Email: [email]
✓ Phone: [phone]
✓ Contact Person: [contactPerson]
✓ Operating Hours: Set
✓ Primary Color: [primaryColor]
✓ Logo URL: [logoUrl]
✓ Stripe Connect: Link saved
[✓ Secondary Color: [secondaryColor]] (if provided)
[✓ Facebook: [facebookUrl]] (if provided)
[✓ Instagram: [instagramUrl]] (if provided)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔗 NEXT STEPS:
1. Restaurant owner must complete Stripe connection:
   [stripeConnectLink]
   
2. Restaurant can now log in at:
   https://admin.pumpd.co.nz
   Email: [userEmail]
   Password: [Provided separately]

⏱️ Processing Time: [duration]
```

## Development Phases

### Phase 1: Manual Validation (Current Task)
- Execute each step manually with Puppeteer
- Document exact selectors and processes
- Identify dependencies between steps
- Create reusable functions for each task

### Phase 2: Sequential Automation
- Create single agent that executes all steps in order
- Add error handling and retry logic
- Log all actions and outputs
- Test with multiple restaurant examples

### Phase 3: Parallel Optimization
- Identify independent tasks (steps 1-5 can run in parallel)
- Create specialized subagents:
  - `menu-scraper-agent`
  - `google-business-agent`
  - `brand-identity-agent`
- Implement coordination agent to manage parallel execution

### Phase 4: Integration & Optimization
- Replace Puppeteer with direct API calls where possible
- Implement direct database operations via Supabase
- Create webhook endpoints for form submissions
- Add monitoring and alerting

### Phase 5: Production Deployment
- Create slash commands for manual triggers
- Set up automated triggers from marketing forms
- Implement queue system for bulk processing
- Add analytics and reporting

## Technical Requirements

### Tools & Access Needed
1. **Puppeteer** - Web automation
2. **Supabase MCP** - Database operations
3. **WebSearch/WebFetch** - Information gathering
4. **Local Apps**:
   - Firecrawl menu scraper (localhost:5005)
   - Ordering page customizer (localhost:8080)
5. **External Services**:
   - Google Search API (optional)
   - Companies Office API (if available)

### Data Storage
- Supabase tables for:
  - Lead tracking
  - Restaurant profiles
  - Automation logs
  - Error tracking

### Error Handling
- ElevenLabs text-to-speech notifications for errors
- Graceful failure handling - prevent subsequent tasks on error
- Manual intervention workflow with user confirmation
- Clear error messages with actionable instructions
- Rollback procedures for partial completions

## Success Metrics
- Time from lead to active account: < 10 minutes
- Data accuracy: > 95%
- Successful automation rate: > 80%
- Manual intervention required: < 20%

## Next Steps
1. Begin manual validation of each workflow step
2. Document precise selectors and API endpoints
3. Create proof-of-concept for steps 1-2
4. Review and refine workflow with stakeholder feedback