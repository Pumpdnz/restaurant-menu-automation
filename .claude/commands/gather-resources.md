# Parallel Agent Orchestration for User Onboarding

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
- These agents are specialsed to locate the logo and colors of a restaurant and each use a distinct method
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
  - mcp__puppeteer__puppeteer_navigate
  - mcp__puppeteer__puppeteer_evaluate
  - mcp__puppeteer__puppeteer_screenshot
  - Bash
  - Read
  - Write

- restaurant-logo-instagram:
  - mcp__puppeteer__puppeteer_navigate
  - mcp__puppeteer__puppeteer_evaluate
  - mcp__puppeteer__puppeteer_screenshot
  - Bash
  - Read
  - Write

- restaurant-logo-search:
  - Bash
  - Read
  - Write
  - Glob
  - LS

**Processes**:
- restaurant-logo-website:
  - Navigate to official website
  - Analyze CSS/design for:
    - Primary brand color (hex code)
    - Secondary brand color (hex code)
    - Logo URL if available

- restaurant-logo-instagram
  - Navigate to instagram account
  - Run script to download instagram profile picture
  - Analyze design for:
    - Primary brand color (hex code)
    - Secondary brand color (hex code)
    - Additional brand colors (hex code(s))

- restaurant-logo-search
  - Runs script: search-and-screenshot.cjs "[Restaurant Name]" "[Location]"
    - Returns screenshot of search results
  - Reads the screenshot and evaluates results based on criteria to select the index of the best logo
  - Runs script: extract-selected-logo.cjs "[Restaurant Name]" "[Location]" [selected-index]
    - Extracts full resolution image URL
    - Saves URL and metadata
  - Runs script: download-and-analyze-logo.cjs "[Restaurant Name]" "[Location]"
    - Downloads the logo
    - Analyzes colors
      - If this times out, manually download:
      ```bash
      cd /automation/planning/downloaded-images/[RestaurantName]-[Location]/
      curl -L -o logo.png "$(cat logo-url.txt)"
      ```
  - Evaluates logo and extracts colors

**Report / Response**:
- All agents respond to the orchestration agent with the following structured format:

✅ Logo successfully extracted from ([Website URL] / Instagram / Google Search) 

📁 Downloaded to: /automation/planning/downloaded-images/RestaurantName-Location/logo.jpg/.png
📊 Image: 150x150px, 25KB
🎨 Primary Color: #E31E24 - Red
🎨 Secondary Color: #FFFFFF - White
🎨 Additional Colors: #000000 - Black
🔍 Source:
🎨 Theme?:
⚠️ Note?:

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
- Makes a POST request to the /generate-csv endpoint and saves CSV files to @automation/extracted-menus/
- Follows same naming patterns and image download process as direct method
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
