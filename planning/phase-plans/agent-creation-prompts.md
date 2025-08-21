# Agent Creation Prompts for Restaurant Registration Automation

## Overview
These prompts are designed to be used with the meta-agent to create specialized sub-agents for the restaurant registration automation workflow. The agents are organized into two stages:

- **Stage 1**: Information Gathering (can run in parallel)
- **Stage 2**: Menu Processing (runs after Stage 1 completes)

## Stage 1: Information Gathering Agents

### Agent A: menu-url-finder

```
Create a sub-agent for finding UberEats and DoorDash ordering page URLs for restaurants.

This agent should:
1. Take restaurant name and location from lead form data
2. Use WebSearch to find the restaurant's delivery platform URLs
3. Follow the optimization strategy from our validated workflow:
   - Search for "[restaurant name] [location] ubereats order online"
   - Search for "[restaurant name] [location] doordash order online"
   - Verify URLs contain "/store/" for UberEats or correct DoorDash format
4. Use Firecrawl to pre-analyze menu item count if URL found
5. Return structured data with:
   - uberEatsUrl (if found)
   - doorDashUrl (if found)
   - menuItemCount (from pre-analysis)
   - confidence score

The agent should be proactive when given restaurant information and should handle edge cases like multiple locations or similar restaurant names. It must verify URLs are ordering pages, not just listing pages.

Reference the best practices from step1-optimization-findings.md for URL extraction strategies.
```

### Agent B: google-business-scraper

```
Create a sub-agent for extracting business information from Google Business Profiles.

This agent should:
1. Take restaurant name and location from lead form data
2. Use WebSearch to find the Google Business Profile
3. Use Firecrawl with the validated schema to extract:
   - Complete business hours (including special hours)
   - Full address
   - Phone number
   - Google Maps URL
   - Service options (dine-in, takeout, delivery)
   - Website URL (if available)
4. Handle edge cases like:
   - Multiple locations for same restaurant
   - Temporarily closed businesses
   - Missing information fields
5. Return structured JSON with all extracted data

The agent should follow the exact extraction methods proven successful in step2-google-business-profile-findings.md, particularly using Firecrawl's schema-based extraction for reliable results.

Output should include confidence scores for ambiguous matches.
```

### Agent C: social-media-brand-identity-finder

```
Create a sub-agent for discovering restaurant social media accounts and brand identity.

This agent should:
1. Take restaurant name and location from lead form data
2. Search for social media accounts:
   - Facebook business page
   - Instagram profile
   - Restaurant website
3. Extract brand identity information:
   - Logo description (since images can't be scraped from social media)
   - Primary brand colors (if available from website)
   - Any brand guidelines or style information
4. Handle the limitations documented in step5-brand-identity-social-media-findings.md:
   - Social media platforms block scraping
   - Focus on finding URLs rather than scraping content
   - Use website for brand color extraction when available
5. Return structured data with:
   - facebookUrl
   - instagramUrl
   - websiteUrl
   - logoDescription
   - brandColors (array of hex codes or null)
   - brandIdentityNotes

The agent should be aware that social media scraping is blocked and focus on URL discovery through search results.
```

## Stage 2: Menu Processing Agent

### Agent D: extract-menu-csv-and-images

```
Create a sub-agent for extracting menu data and generating CSV files with image downloads.

This agent should:
1. Take the UberEats URL from the menu-url-finder agent
2. First use Firecrawl to analyze menu size (item count)
3. Based on menu size, choose extraction method:
   - Small menus (<50 items): Use direct /api/scrape endpoint
   - Large menus (50+ items): Use category-based batch extraction
4. Call the local menu scraper API (port 3007):
   - Make HTTP POST requests using appropriate method
   - Handle the ~46 second extraction time
   - Process the returned menu data
5. Generate CSV files:
   - Call script to create both versions (with/without imageURL)
   - Save to /automation/UberEats-Image-Extractor/downloads/csvs-from-script/
6. Download menu images:
   - Use /api/download-images endpoint
   - Organize by category
   - Generate mapping file
7. Return comprehensive results including:
   - CSV file paths (both versions)
   - Image download statistics
   - Total processing time
   - Any errors encountered

The agent must follow all best practices from step3.1-csv-generation-documentation.md and step3.2-image-download-documentation.md. It should handle API timeouts and provide detailed progress updates.
```

## Important Notes for Agent Creation

### Tool Requirements by Agent:

**menu-url-finder:**
- WebSearch (primary search tool)
- mcp__firecrawl-mcp__firecrawl_search (for additional search)
- mcp__firecrawl-mcp__firecrawl_scrape (for pre-analysis)

**google-business-scraper:**
- WebSearch (to find Google Business Profile)
- mcp__firecrawl-mcp__firecrawl_scrape (for extraction with schema)

**social-media-brand-identity-finder:**
- WebSearch (primary search)
- mcp__firecrawl-mcp__firecrawl_search (for finding social URLs)
- mcp__firecrawl-mcp__firecrawl_scrape (for website brand extraction)

**extract-menu-csv-and-images:**
- Bash (for API calls and running scripts)
- Read (to read responses and verify outputs)
- Write (to save results if needed)
- mcp__firecrawl-mcp__firecrawl_scrape (for menu size analysis)

### Execution Flow:
1. Main agent receives lead form data
2. Launches Stage 1 agents (A, B, C) in parallel
3. Waits for all Stage 1 agents to complete
4. Passes menu URL from Agent A to Agent D
5. Agent D processes menu and returns final outputs

### Error Handling:
- Each agent should handle its own errors gracefully
- Return partial results when possible
- Include error details in response for debugging
- Main agent should continue even if one Stage 1 agent fails

## Usage Instructions

To create each agent:
1. Open a new terminal with Claude Code
2. Copy the relevant prompt from above
3. Paste it to the meta-agent: `claude-code --agent meta-agent`
4. The meta-agent will create and save the agent configuration
5. Review the generated agent file in `.claude/agents/`
6. Test each agent individually before integration