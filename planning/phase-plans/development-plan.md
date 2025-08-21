# Restaurant Registration Automation - Development Plan

## Documentation Index

### Workflow Documentation
- [restaurant-registration-ideal-flow.md](./restaurant-registration-ideal-flow.md) - Complete 10-step workflow
- [current-state.md](./current-state.md) - Current implementation status

### Step-by-Step Validation Results
- [step1-optimization-findings.md](./step1-optimization-findings.md) - Menu URL extraction
- [step2-google-business-profile-findings.md](./step2-google-business-profile-findings.md) - Google Business data
- [menu-scraper-direct-integration-plan.md](./menu-scraper-direct-integration-plan.md) - Menu scraper integration
- [menu-scraper-api-integration-results.md](./menu-scraper-api-integration-results.md) - API test results
- [step3.1-csv-generation-documentation.md](./step3.1-csv-generation-documentation.md) - CSV generation without imageURL
- [step3.2-image-download-documentation.md](./step3.2-image-download-documentation.md) - Menu item image downloads
- [step4-companies-register-decision.md](./step4-companies-register-decision.md) - NZ Companies Register
- [step5-brand-identity-social-media-findings.md](./step5-brand-identity-social-media-findings.md) - Brand & social media
- [api-integration-documentation.md](./api-integration-documentation.md) - API endpoints for automation

### Test Data
- Restaurant: Himalaya, Queenstown
- Menu Items: 17 successfully extracted
- CSV Outputs: 
  - `/automation/UberEats-Image-Extractor/downloads/csvs-from-script/himalaya_menu_2025-08-01_no_images.csv`
  - `/automation/UberEats-Image-Extractor/downloads/csvs-from-script/himalaya_menu_2025-08-01_with_images.csv`
- Downloaded Images: `/automation/UberEats-Image-Extractor/downloads/himalaya-test-*/`
  - 15 of 17 images successfully downloaded (88% success rate)
  - Organized by category (featured_items, mains)
  - Includes image-mapping.json for reference

## Current Sprint: Manual Validation & Documentation

### Progress Update (2025-08-01)

#### Completed Validations ✅

##### Step 1: Menu URL Extraction Validation ✅
**Status**: COMPLETED
**Test Case**: Himalaya Restaurant, Queenstown
**Documentation**: [step1-optimization-findings.md](./step1-optimization-findings.md)
**Key Findings**:
- Successfully extracted UberEats URL
- Implemented Firecrawl pre-analysis for menu item count
- Optimized extraction method selection based on menu size
- 17 menu items extracted successfully

##### Step 2: Google Business Profile Extraction ✅
**Status**: COMPLETED
**Test Case**: Himalaya Restaurant, Queenstown
**Documentation**: [step2-google-business-profile-findings.md](./step2-google-business-profile-findings.md)
**Key Findings**:
- Firecrawl API successfully extracted complete business hours
- All contact information captured (address, phone, hours)
- Google Maps URL and service options documented
- Puppeteer useful for visual verification but challenging for data extraction

##### Step 3: Integration with Local Menu Scraper ✅
**Status**: COMPLETED
**Documentation**: 
- [menu-scraper-direct-integration-plan.md](./menu-scraper-direct-integration-plan.md)
- [menu-scraper-api-integration-results.md](./menu-scraper-api-integration-results.md)
- [step3.1-csv-generation-documentation.md](./step3.1-csv-generation-documentation.md)
- [step3.2-image-download-documentation.md](./step3.2-image-download-documentation.md)
**Key Findings**:
- Direct API integration superior to browser automation
- Menu extraction takes ~46 seconds for small menus
- CSV generation is instant with/without imageURL column
- Batch image downloads implemented (88% success rate)
- API endpoints fully documented and tested:
  - `/api/scrape` - Direct URL scraping
  - `/api/generate-csv` - CSV generation
  - `/api/download-images` - Batch image downloads

##### Step 4: NZ Companies Register Search ✅
**Status**: MANUAL PROCESS
**Documentation**: [step4-companies-register-decision.md](./step4-companies-register-decision.md)
**Decision**: Deferred to manual process after prospect signup due to accuracy concerns

##### Step 5: Brand Identity & Social Media Discovery ✅
**Status**: COMPLETED
**Documentation**: [step5-brand-identity-social-media-findings.md](./step5-brand-identity-social-media-findings.md)
**Key Findings**:
- Facebook and Instagram URLs successfully found
- Logo identified (black/white geometric design)
- No dedicated website for this restaurant
- Social media platforms block automated scraping

### Next Steps

#### Remaining Information Gathering Steps (6-10)
- [ ] Step 6: Pumpd Admin Registration
- [ ] Step 7: Restaurant Setup in Pumpd Admin
- [ ] Step 8: Menu Import
- [ ] Step 9: Ordering Page Customization
- [ ] Step 10: CloudWaitress Integration

### Development Sequence

#### Week 1: Core Workflow Validation ✅ COMPLETED
- [x] Complete Steps 1-5 manual validation
- [x] Document all selectors and processes
- [x] Create initial documentation
- [x] Test with Himalaya Restaurant case study

#### Week 2: Information Gathering Agents
- [ ] Build `menu-url-finder` agent
- [ ] Build `google-business-scraper` agent
- [ ] Build `nz-companies-search` agent
- [ ] Test agents individually

#### Week 3: Account Creation Flow
- [ ] Validate Pumpd registration process
- [ ] Validate CloudWaitress restaurant setup
- [ ] Document all form fields and requirements
- [ ] Create account creation functions

#### Week 4: Integration & Testing
- [ ] Connect all workflow steps
- [ ] Implement error handling
- [ ] Create logging system
- [ ] Run end-to-end tests

### Technical Decisions

#### Architecture Choices
1. **Execution Model**: Event-driven with queue system
2. **Storage**: Supabase for all persistent data
3. **Monitoring**: Custom dashboard for automation status
4. **Error Handling**: Retry with exponential backoff

#### Tool Selection
- **Primary**: Puppeteer for web automation
- **Search**: WebSearch for initial discovery
- **Scraping**: Combination of Puppeteer and Firecrawl
- **Database**: Supabase via MCP tools

### Risk Mitigation

#### Identified Risks
1. **Website Changes**: Selectors may break
   - Mitigation: Multiple selector strategies, regular testing
   
2. **Rate Limiting**: Too many requests to external sites
   - Mitigation: Implement delays, use proxies if needed
   
3. **Ambiguous Search Results**: Multiple businesses with similar names
   - Mitigation: Human review queue for unclear matches
   
4. **API Availability**: Local services might be down
   - Mitigation: Health checks, fallback procedures

### Answered Questions

1. **Menu Scraper Access**: Runs on ports 3007/5007. Direct API integration implemented.

2. **NZ Companies Register**: Deferred to manual process after signup.

3. **Brand Colors**: Use defaults (black/white) if not found, allow manual override.

### Outstanding Questions for User

1. **CloudWaitress Account Creation**: Do we have API access or must we use web interface?

2. **Error Handling**: What should happen when automation fails? Email notification? Manual queue?

3. **Data Validation**: What level of accuracy is required for extracted data? Should we implement confidence scores?

4. **Bulk Processing**: Expected volume of leads per day? Need for queue management?

5. **Pumpd Admin Access**: Do we have test credentials for validating Steps 6-10?

### Success Criteria

#### Phase 1 Complete When:
- All 10 workflow steps manually validated
- Documentation includes all selectors and edge cases
- Test successful with 5+ different restaurants
- Error scenarios identified and documented

#### Ready for Phase 2 When:
- Core functions created and tested
- Data models defined in Supabase
- Logging system implemented
- User approval on workflow

## Key Learnings from Phase 1

### Technical Insights
1. **Firecrawl**: Excellent for Google searches, blocked on social media
2. **Direct API**: Always preferable to browser automation where available
3. **Puppeteer**: Best for visual verification, challenging for data extraction
4. **Menu Scraper**: API integration works flawlessly (~46s for extraction)
5. **CSV Generation**: Successfully split into with/without imageURL versions
6. **Image Downloads**: 88% success rate with organized folder structure
7. **File Organization**: Centralized outputs in `/automation/UberEats-Image-Extractor/downloads/`

### Process Improvements
1. **Parallel Execution**: Steps 1, 2, and 5 can run simultaneously
2. **Caching**: Use maxAge parameter in Firecrawl for 500% speed improvement
3. **Fallbacks**: Always have alternative extraction methods

## Next Action Items

1. **Immediate**: Create subagents for parallel execution of Steps 1, 2, 5
2. **Next**: Set up ElevenLabs error notifications
3. **This Week**: Begin validation of Steps 6-10 (Pumpd Admin flow)
4. **Architecture**: Design queue system for bulk lead processing