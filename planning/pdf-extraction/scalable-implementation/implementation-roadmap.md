# Implementation Roadmap - PDF Menu Extraction System

## Overview

This roadmap outlines a phased approach to implementing automated PDF menu extraction, designed to deliver value incrementally while building toward a fully integrated, scalable solution.

## Current Status

**Status:** Planning Complete - Ready for Phase 1
**Date:** October 20, 2025
**Latest Update:** Chaat Street successfully onboarded manually (October 20, 2025) ✅
**Next Priority:** Begin Phase 1 implementation for scalable solution

## Prerequisites

### Technical Requirements
- [x] Firecrawl API access (`FIRECRAWL_API_KEY` available)
- [x] UploadCare CDN credentials (`UPLOADCARE_PUBLIC_KEY`, `UPLOADCARE_SECRET_KEY`)
- [x] Supabase database access (Project ID: `qgabsyggzlkcstjzugdh`)
- [x] Sharp library installed (v0.34.3 already installed ✅)
- [x] Node.js environment (current setup)
- [x] Existing extraction infrastructure
- [ ] Supabase Storage bucket: `pdf-extractions` (public, 24h TTL)

### Knowledge Requirements
- [x] Understand current extraction flow (UberEats/DoorDash)
- [x] Familiar with database schema (menus, categories, menu_items, item_images)
- [x] Know CSV export format and import script
- [ ] Review Firecrawl PDF parser documentation
- [ ] Understand Sharp image compression options

### Business Prerequisites
- [x] Immediate use case identified (Chaat Street) - ✅ Successfully completed manually
- [x] PDF sample available for testing
- [x] Image samples available (13 images)
- [x] Real-world validation completed (Chaat Street onboarding)
- [ ] User acceptance criteria defined
- [ ] Pricing model for PDF extractions (feature flag)

---

## Phase 1: Image Processing Foundation (Week 1)

**Goal:** Build robust image compression and upload pipeline that can be used immediately for manual workflows and later for automated PDF extraction.

**Duration:** 3-5 days
**Dependencies:** None
**Deliverables:** Working image compression and CDN upload scripts

### Tasks

#### 1.1 Image Compression Service
- [x] Sharp library available (v0.34.3 already installed)
- [ ] Create `src/services/image-compression-service.js`
- [ ] Implement compression function:
  - [ ] Input: Local file path or buffer
  - [ ] Target size: ~500KB (configurable)
  - [ ] Maintain aspect ratio
  - [ ] Quality optimization (progressive JPEG, 85% quality)
  - [ ] Format conversion support (PNG → JPEG, WebP)
- [ ] Add validation:
  - [ ] Check file size limits (reject > 20MB input)
  - [ ] Validate image dimensions (min 200px, max 4096px)
  - [ ] Verify output quality (not overly compressed)
- [ ] Implement error handling:
  - [ ] Invalid image formats
  - [ ] Corrupted files
  - [ ] Compression failures
- [ ] Add logging and metrics:
  - [ ] Original vs compressed size
  - [ ] Compression ratio
  - [ ] Processing time
- [ ] Write unit tests:
  - [ ] Test various input sizes (1MB, 5MB, 10MB)
  - [ ] Test different formats (JPEG, PNG, WebP)
  - [ ] Test edge cases (very small, very large)

#### 1.2 UploadCare Service Extension
- [ ] Extend `src/services/uploadcare-service.js`
- [ ] Add buffer upload method:
  - [ ] `uploadImageFromBuffer(buffer, filename, metadata)`
  - [ ] Support direct file uploads (not just URLs)
  - [ ] Maintain existing retry logic
- [ ] Add file upload method:
  - [ ] `uploadImageFromFile(filePath, filename, metadata)`
  - [ ] Read file, compress, upload
  - [ ] Cleanup temporary files
- [ ] Update batch upload:
  - [ ] Support mixed sources (URLs and buffers)
  - [ ] Integrate compression before upload
  - [ ] Track compression stats in progress
- [ ] Test with sample images:
  - [ ] Upload Chaat Street images
  - [ ] Verify CDN URLs work
  - [ ] Check metadata persistence

#### 1.3 Manual Upload Script
- [ ] Create `scripts/manual-image-upload.js`
- [ ] Features:
  - [ ] Read images from local directory
  - [ ] Compress each image
  - [ ] Upload to UploadCare CDN
  - [ ] Generate image mapping JSON
  - [ ] Output CDN IDs and URLs
- [ ] CLI interface:
  - [ ] `--input-dir` for image directory
  - [ ] `--output-json` for mapping file
  - [ ] `--restaurant-id` for database linking
  - [ ] `--dry-run` for testing
- [ ] Progress reporting:
  - [ ] Show compression progress
  - [ ] Show upload progress
  - [ ] Display success/failure summary
- [ ] Error recovery:
  - [ ] Skip already uploaded images
  - [ ] Retry failed uploads
  - [ ] Save partial results

#### 1.4 Testing & Validation
- [ ] Test with Chaat Street images:
  - [ ] Compress 13 images (6-11MB → ~500KB)
  - [ ] Upload to UploadCare
  - [ ] Verify CDN URLs accessible
  - [ ] Check image quality acceptable
- [ ] Performance benchmarks:
  - [ ] Measure compression time per image
  - [ ] Measure upload time per image
  - [ ] Total time for batch processing
- [ ] Create test report:
  - [ ] Compression ratios achieved
  - [ ] CDN upload success rate
  - [ ] Image quality assessment
  - [ ] Performance metrics

### Success Criteria
- ✅ Images compress from 6-11MB to ~500KB reliably
- ✅ UploadCare uploads succeed >95% of time
- ✅ CDN URLs return valid images
- ✅ Manual script completes Chaat Street upload in < 10 minutes
- ✅ Image quality remains acceptable for menu display

### Risks & Mitigations
| Risk | Impact | Mitigation |
|------|--------|------------|
| Over-compression reduces quality | High | Implement quality checks, configurable thresholds |
| UploadCare rate limits | Medium | Use existing rate limiter, add backoff |
| Large batches timeout | Medium | Process in smaller chunks, save progress |
| Image format incompatibilities | Low | Support multiple formats, convert as needed |

---

## Phase 2: PDF Extraction Service (Week 2)

**Goal:** Implement Firecrawl-based PDF parsing to extract structured menu data automatically.

**Duration:** 5-7 days
**Dependencies:** Phase 1 complete
**Deliverables:** Working PDF extraction service with job management

### Tasks

#### 2.1 Firecrawl PDF Integration
- [ ] Research Firecrawl PDF parser capabilities:
  - [ ] Review API documentation
  - [ ] Understand parser options
  - [ ] Check rate limits and pricing
  - [ ] Test with sample PDFs
- [ ] Create `src/services/pdf-extraction-service.js`
- [ ] Implement PDF upload to Firecrawl:
  - [ ] Support file upload (not URL)
  - [ ] Configure parser options:
    - [ ] `parsers: ['pdf']`
    - [ ] `maxPages: 50` (configurable)
  - [ ] Handle extraction response
- [ ] Implement structured data extraction:
  - [ ] Define extraction schema:
    ```json
    {
      "menu_name": "string",
      "categories": [
        {
          "name": "string",
          "description": "string",
          "items": [
            {
              "name": "string",
              "price": "number",
              "description": "string",
              "tags": ["string"]
            }
          ]
        }
      ]
    }
    ```
  - [ ] Use LLM-based extraction (Firecrawl's JSON mode)
  - [ ] Validate extracted structure
  - [ ] Handle extraction errors gracefully

#### 2.2 Extraction Job Management
- [ ] Extend database schema (see `database-schema.md`):
  - [ ] Add PDF-specific fields to `extraction_jobs`
  - [ ] Track PDF upload path
  - [ ] Store extraction results
- [ ] Implement job lifecycle:
  - [ ] Create job: `createPDFExtractionJob(restaurantId, pdfPath, config)`
  - [ ] Track status: `pending` → `processing` → `completed` / `failed`
  - [ ] Update progress: Percentage complete
  - [ ] Store results: Structured menu data
- [ ] Add progress tracking:
  - [ ] PDF upload progress
  - [ ] Firecrawl processing progress
  - [ ] Database save progress
  - [ ] Overall completion percentage
- [ ] Implement error handling:
  - [ ] Firecrawl API errors
  - [ ] Invalid PDF format
  - [ ] Extraction schema validation failures
  - [ ] Database save failures
- [ ] Add retry logic:
  - [ ] Exponential backoff for API failures
  - [ ] Max 3 retry attempts
  - [ ] Save partial results

#### 2.3 Data Transformation
- [ ] Create menu structure transformer:
  - [ ] Convert Firecrawl output → database schema
  - [ ] Generate UUIDs for categories and items
  - [ ] Normalize prices (handle "$15.00", "15", etc.)
  - [ ] Parse tags from descriptions
  - [ ] Extract dietary info
- [ ] Implement validation:
  - [ ] Required fields present (name, price)
  - [ ] Valid data types
  - [ ] Reasonable price ranges
  - [ ] Category-item relationships
- [ ] Handle edge cases:
  - [ ] Duplicate item names
  - [ ] Missing prices (TBD, Market Price)
  - [ ] Complex descriptions with embedded info
  - [ ] Special characters and formatting

#### 2.4 Database Persistence
- [ ] Create transaction-based save:
  - [ ] Begin transaction
  - [ ] Create menu record
  - [ ] Create category records
  - [ ] Create menu_item records
  - [ ] Commit or rollback
- [ ] Implement `savePDFExtraction(jobId, extractedData)`:
  - [ ] Link to restaurant
  - [ ] Set platform to "PDF"
  - [ ] Mark extraction job as source
  - [ ] Update timestamps
- [ ] Add validation before save:
  - [ ] Check for duplicate menus
  - [ ] Validate foreign keys (restaurant_id exists)
  - [ ] Ensure category-item integrity
- [ ] Create audit trail:
  - [ ] Log extraction metadata
  - [ ] Store original PDF path
  - [ ] Track extraction config used
  - [ ] Record processing time

#### 2.5 Testing with Sample PDFs
- [ ] Test with Chaat Street PDF:
  - [ ] Upload PDF to Firecrawl
  - [ ] Extract menu structure
  - [ ] Validate extracted data
  - [ ] Compare with manual CSV
- [ ] Test with various PDF formats:
  - [ ] Single-column menus
  - [ ] Multi-column layouts
  - [ ] Image-heavy PDFs
  - [ ] Text-only PDFs
- [ ] Edge case testing:
  - [ ] Very large PDFs (20+ pages)
  - [ ] Scanned PDFs (OCR required)
  - [ ] Complex formatting
  - [ ] Multiple languages

### Success Criteria
- ✅ Extract structured data from PDF with >90% accuracy
- ✅ Handle Chaat Street PDF successfully
- ✅ Create complete database records (menu, categories, items)
- ✅ Job tracking shows accurate progress
- ✅ Error handling prevents data corruption

### Risks & Mitigations
| Risk | Impact | Mitigation |
|------|--------|------------|
| Firecrawl extraction inaccurate | High | Manual review step, confidence scoring |
| PDF format not supported | High | Fallback to manual entry, support common formats |
| Extraction too slow (>5 min) | Medium | Optimize parser config, use caching |
| Complex layouts confuse parser | Medium | Preprocessing step, layout detection |

---

## Phase 3: Image-to-Item Association (Week 3)

**Goal:** Link uploaded images to extracted menu items and manage the complete workflow.

**Duration:** 4-6 days
**Dependencies:** Phases 1 & 2 complete
**Deliverables:** Integrated image upload and menu extraction workflow

### Tasks

#### 3.1 Image Extraction from PDF
- [ ] Add PDF image extraction to service:
  - [ ] Use Firecrawl's image extraction
  - [ ] Save images to temporary directory
  - [ ] Track image-to-page mapping
- [ ] Implement image filtering:
  - [ ] Skip logos and decorations
  - [ ] Identify menu item images
  - [ ] Filter by size/dimensions
- [ ] Create image metadata:
  - [ ] Page number
  - [ ] Position on page
  - [ ] Probable menu item association

#### 3.2 Smart Image Matching
- [ ] Implement fuzzy matching algorithm:
  - [ ] Match image filenames to item names
  - [ ] Use position/proximity on page
  - [ ] Similarity scoring (0-100%)
- [ ] Create manual association UI (future):
  - [ ] Show extracted items
  - [ ] Show available images
  - [ ] Drag-and-drop linking
  - [ ] Bulk operations
- [ ] Handle multiple images per item:
  - [ ] Primary image
  - [ ] Additional images (gallery)
  - [ ] Image ordering

#### 3.3 Manual Image Upload Flow
- [ ] Create manual upload workflow:
  - [ ] Upload PDF → Extract menu structure
  - [ ] Pause for image upload
  - [ ] User uploads images via directory
  - [ ] User maps images to items
  - [ ] Complete extraction
- [ ] Implement image mapping tool:
  - [ ] Read uploaded images
  - [ ] Suggest matches based on filenames
  - [ ] Allow manual override
  - [ ] Validate all items have images
- [ ] Add partial save capability:
  - [ ] Save menu without images
  - [ ] Add images later
  - [ ] Update existing records

#### 3.4 Automated Pipeline Integration
- [ ] Create end-to-end workflow:
  - [ ] Upload PDF
  - [ ] Extract menu structure
  - [ ] Extract images from PDF
  - [ ] Compress images
  - [ ] Upload to CDN
  - [ ] Link images to items
  - [ ] Generate CSV
- [ ] Implement orchestration:
  - [ ] Sequential step execution
  - [ ] Progress tracking across steps
  - [ ] Error recovery at each step
  - [ ] Rollback capability
- [ ] Add configuration options:
  - [ ] Auto-extract images vs manual upload
  - [ ] Image matching threshold
  - [ ] Compression settings
  - [ ] CDN upload batch size

#### 3.5 CSV Export Enhancement
- [ ] Extend CSV export to include:
  - [ ] PDF-extracted menu data
  - [ ] CDN image references
  - [ ] Image metadata
  - [ ] Source tracking (PDF filename)
- [ ] Add export options:
  - [ ] With/without images
  - [ ] Full vs abbreviated format
  - [ ] Include extraction metadata
- [ ] Test CSV import:
  - [ ] Generate CSV from PDF extraction
  - [ ] Import using `import-csv-menu.js`
  - [ ] Verify menu created correctly

### Success Criteria
- ✅ Images automatically matched to items with >80% accuracy
- ✅ Manual override available for mismatches
- ✅ Complete workflow from PDF to CSV in <15 minutes
- ✅ Generated CSV imports successfully via existing script
- ✅ All data integrity maintained throughout pipeline

### Risks & Mitigations
| Risk | Impact | Mitigation |
|------|--------|------------|
| Image matching fails | High | Manual review step required |
| Some items have no images | Medium | Mark as optional, allow blank |
| PDF image quality poor | Medium | Request better source files |
| Workflow too complex | Medium | Provide step-by-step UI guidance |

---

## Phase 4: UI Integration (Week 4)

**Goal:** Build user-facing interface for PDF extraction workflow.

**Duration:** 5-7 days
**Dependencies:** Phases 1-3 complete
**Deliverables:** Production-ready UI for PDF menu extraction

### Tasks

#### 4.1 PDF Upload Component
- [ ] Create `src/pages/PDFExtraction.tsx`
- [ ] Build drag-and-drop interface:
  - [ ] Accept PDF files (<10MB)
  - [ ] Validate file type (application/pdf)
  - [ ] Preview file details (name, size, pages)
  - [ ] Upload progress indicator
- [ ] Add form inputs:
  - [ ] Restaurant selection dropdown
  - [ ] Menu name (optional)
  - [ ] Extraction options:
    - [ ] Auto-extract images
    - [ ] Image matching threshold
    - [ ] Compression quality
- [ ] Implement file upload:
  - [ ] POST to `/api/extractions/pdf`
  - [ ] Handle upload progress
  - [ ] Receive job ID
  - [ ] Redirect to progress page

#### 4.2 Extraction Progress UI
- [ ] Create `src/components/PDFExtractionProgress.tsx`
- [ ] Show multi-step progress:
  - [ ] Step 1: PDF Upload (0-20%)
  - [ ] Step 2: Menu Extraction (20-50%)
  - [ ] Step 3: Image Processing (50-80%)
  - [ ] Step 4: Database Save (80-100%)
- [ ] Implement real-time updates:
  - [ ] WebSocket connection for job updates
  - [ ] Poll status endpoint every 2 seconds
  - [ ] Update progress bar and status text
- [ ] Display extraction details:
  - [ ] Categories found
  - [ ] Items extracted
  - [ ] Images processed
  - [ ] Errors/warnings
- [ ] Add action buttons:
  - [ ] Cancel extraction
  - [ ] View extracted data
  - [ ] Download CSV
  - [ ] Start new extraction

#### 4.3 Data Review & Validation
- [ ] Create review interface:
  - [ ] Tabbed view (Categories, Items, Images)
  - [ ] Editable fields for corrections
  - [ ] Validation indicators (✓ valid, ⚠ warning, ✗ error)
- [ ] Implement validation rules:
  - [ ] All items have names
  - [ ] All items have prices (or marked TBD)
  - [ ] All categories have items
  - [ ] Image associations valid
- [ ] Add edit capabilities:
  - [ ] Edit item name/description/price
  - [ ] Re-categorize items
  - [ ] Add/remove images
  - [ ] Delete incorrect items
- [ ] Show comparison view:
  - [ ] Original PDF (embedded viewer)
  - [ ] Extracted data (side-by-side)
  - [ ] Highlight differences

#### 4.4 Image Management UI
- [ ] Create image gallery view:
  - [ ] Thumbnail grid of all images
  - [ ] Click to enlarge
  - [ ] Show CDN URL and metadata
- [ ] Implement image association:
  - [ ] Drag image to menu item
  - [ ] Auto-suggest based on names
  - [ ] Bulk operations (select multiple)
- [ ] Add manual upload:
  - [ ] Upload additional images
  - [ ] Replace existing images
  - [ ] Compress before upload
- [ ] Show CDN status:
  - [ ] Uploaded ✓
  - [ ] Uploading (progress)
  - [ ] Failed (retry button)

#### 4.5 Extractions List Integration
- [ ] Extend `src/pages/Extractions.jsx`:
  - [ ] Add PDF extraction cards
  - [ ] Show platform badge "PDF"
  - [ ] Display extraction status
  - [ ] Filter by platform type
- [ ] Add PDF-specific actions:
  - [ ] View extraction details
  - [ ] Re-extract menu
  - [ ] Download CSV
  - [ ] View original PDF
- [ ] Implement search/filter:
  - [ ] Filter by restaurant
  - [ ] Filter by date range
  - [ ] Filter by status (completed, failed)
  - [ ] Search by menu name

### Success Criteria
- ✅ Users can upload PDF and start extraction in <30 seconds
- ✅ Progress updates in real-time
- ✅ Review interface allows easy validation and corrections
- ✅ Image management is intuitive and efficient
- ✅ Integration with existing extraction list seamless

### Risks & Mitigations
| Risk | Impact | Mitigation |
|------|--------|------------|
| UI complexity overwhelming | High | Progressive disclosure, clear wizard flow |
| Real-time updates unreliable | Medium | Fallback to polling, show timestamps |
| PDF preview not supported | Low | External link to view PDF |
| Mobile UI not responsive | Low | Desktop-first, mobile as enhancement |

---

## Phase 5: Testing & Production (Week 5)

**Goal:** Comprehensive testing, documentation, and production deployment.

**Duration:** 5-7 days
**Dependencies:** All previous phases complete
**Deliverables:** Production-ready, documented, tested system

### Tasks

#### 5.1 End-to-End Testing
- [ ] Create test suite:
  - [ ] Unit tests for services
  - [ ] Integration tests for workflows
  - [ ] UI component tests
  - [ ] API endpoint tests
- [ ] Test scenarios:
  - [ ] Happy path: Simple PDF → CSV
  - [ ] Complex PDF: Multi-column, images
  - [ ] Edge cases: Large PDF, no images, bad formatting
  - [ ] Error scenarios: Invalid PDF, API failures, network issues
- [ ] Performance testing:
  - [ ] Benchmark extraction times
  - [ ] Load test concurrent extractions
  - [ ] Memory usage monitoring
  - [ ] CDN upload throughput
- [ ] User acceptance testing:
  - [ ] Internal team testing
  - [ ] Process 5 real restaurant PDFs
  - [ ] Gather feedback on UX
  - [ ] Iterate based on feedback

#### 5.2 Error Handling & Recovery
- [ ] Implement comprehensive error handling:
  - [ ] Graceful degradation (partial success)
  - [ ] Clear error messages for users
  - [ ] Detailed logging for developers
  - [ ] Automatic retry for transient failures
- [ ] Add recovery mechanisms:
  - [ ] Resume interrupted extractions
  - [ ] Rollback failed database saves
  - [ ] Re-upload failed images
  - [ ] Export partial results
- [ ] Create error documentation:
  - [ ] Common errors and solutions
  - [ ] Troubleshooting guide
  - [ ] Support escalation process

#### 5.3 Documentation
- [ ] User documentation:
  - [ ] How to extract menu from PDF (step-by-step)
  - [ ] How to review and validate extracted data
  - [ ] How to manage images
  - [ ] How to export and import CSV
- [ ] Developer documentation:
  - [ ] API endpoint reference
  - [ ] Service architecture overview
  - [ ] Database schema changes
  - [ ] Code examples and snippets
- [ ] Operations documentation:
  - [ ] Deployment procedures
  - [ ] Monitoring and alerts
  - [ ] Backup and recovery
  - [ ] Troubleshooting common issues

#### 5.4 Feature Flags & Rollout
- [ ] Implement feature flag:
  - [ ] Add `pdfExtraction` to organisation feature_flags
  - [ ] Set default: `{ enabled: false, ratePerItem: 0.05 }`
  - [ ] UI conditionally shows PDF upload based on flag
- [ ] Create rollout plan:
  - [ ] Phase 1: Internal testing (1 week)
  - [ ] Phase 2: Beta customers (2 weeks, 5 restaurants)
  - [ ] Phase 3: General availability (all customers)
- [ ] Set up monitoring:
  - [ ] Track extraction success rate
  - [ ] Monitor API error rates
  - [ ] Alert on failures
  - [ ] Usage analytics (extractions per day)

#### 5.5 Production Deployment
- [ ] Pre-deployment checklist:
  - [ ] All tests passing
  - [ ] Code reviewed and approved
  - [ ] Documentation complete
  - [ ] Database migrations tested
  - [ ] Rollback plan prepared
- [ ] Deployment steps:
  - [ ] Deploy database migrations
  - [ ] Deploy backend services
  - [ ] Deploy frontend updates
  - [ ] Enable feature flag for beta users
  - [ ] Monitor for issues
- [ ] Post-deployment validation:
  - [ ] Smoke tests on production
  - [ ] Process Chaat Street PDF successfully
  - [ ] Verify CSV import works
  - [ ] Check all integrations working

### Success Criteria
- ✅ 100% of test cases passing
- ✅ Extraction success rate >95% for well-formatted PDFs
- ✅ Zero data corruption or loss incidents
- ✅ User can complete full workflow without support
- ✅ Documentation covers all common scenarios

### Risks & Mitigations
| Risk | Impact | Mitigation |
|------|--------|------------|
| Production bugs not caught in testing | High | Comprehensive test coverage, beta period |
| Performance issues at scale | Medium | Load testing, monitoring, scaling plan |
| User adoption low | Medium | Training materials, onboarding support |
| Rollback required | Low | Tested rollback procedures, feature flag |

---

## Next Steps After Implementation

### Immediate (Month 1-2)
1. **Monitor and Iterate**
   - Track extraction success rates
   - Gather user feedback
   - Fix bugs and edge cases
   - Optimize performance

2. **Expand Platform Support**
   - Support additional platforms (Menulog, OrderMeal, etc.)
   - Unified extraction interface for all sources
   - Cross-platform menu merging

3. **Enhanced Image Processing**
   - AI-powered image matching
   - Automatic background removal
   - Image enhancement (brightness, contrast)
   - Generate missing images with AI

### Medium-Term (Month 3-6)
1. **Advanced Extraction Features**
   - OCR for scanned PDFs
   - Multi-language support
   - Nutritional info extraction
   - Allergen detection

2. **Workflow Automation**
   - Bulk PDF processing
   - Scheduled re-extractions
   - Automatic price updates
   - Menu diff and merge tools

3. **Analytics and Insights**
   - Menu analysis (price ranges, popular items)
   - Competitive intelligence (compare menus)
   - Trend detection (seasonal items)
   - Recommendation engine

### Long-Term (Month 6-12)
1. **AI-Powered Enhancements**
   - Generative menu descriptions
   - Automatic categorization
   - Price optimization suggestions
   - Image generation for items

2. **Multi-Source Integration**
   - Combine PDF + website + social media
   - Keep menus in sync across sources
   - Detect and flag discrepancies
   - Automated updates

3. **White-Label Platform**
   - Allow restaurants to self-serve
   - Upload PDFs directly
   - Review and approve extractions
   - Publish to their own site

---

## Handoff Summary

### What's Done
- [x] Planning and architecture documentation
- [x] Database schema designed
- [x] Service layer architecture defined
- [x] API endpoints specified
- [x] UI component structure planned
- [x] Testing strategy outlined
- [x] Deployment plan created

### What's Next
1. **Start Phase 1:** Image Processing Foundation
   - Install Sharp library
   - Create image compression service
   - Extend UploadCare service
   - Build manual upload script

2. **Immediate Use Case:** Chaat Street
   - Process Chaat Street images (13 files)
   - Test compression (6-11MB → ~500KB)
   - Upload to CDN
   - Validate quality

3. **Parallel Development:** Option A (Manual)
   - Create manual CSV extraction guide
   - Build database insert scripts
   - Process Chaat Street immediately while building automated solution

### Notes for Next Developer

#### Read Reference Files First
- `planning/pdf-extraction/reference-files/uploadcare-integration-plan.md` - CDN upload patterns
- `planning/pdf-extraction/reference-files/Multi-Platform-Extraction-Analysis.md` - Platform architecture
- `UberEats-Image-Extractor/src/services/premium-extraction-service.js` - Extraction orchestration example
- `UberEats-Image-Extractor/src/services/uploadcare-service.js` - Current CDN implementation

#### Review Current Implementation
- Database schema: Tables `menus`, `categories`, `menu_items`, `item_images`, `upload_batches`
- Existing CSV format: Already supports CDN fields (isCDNImage, imageCDNID, imageCDNFilename)
- Import automation: `scripts/restaurant-registration/import-csv-menu.js` works with generated CSV
- Rate limiting: Already implemented in `rate-limiter-service.js`

#### Implementation Order
1. **Don't skip Phase 1** - Image processing is foundational and provides immediate value
2. **Use Chaat Street as test case** - Real data, immediate business need
3. **Test each phase independently** - Don't wait for full integration to test
4. **Maintain backward compatibility** - Don't break existing extraction flows
5. **Document as you go** - Code comments, API docs, user guides

#### Key Architecture Decisions
- **Platform Detection:** PDF is a new platform type, parallel to UberEats/DoorDash
- **CDN Integration:** Reuse existing UploadCare service, extend for buffers
- **Database Schema:** Minimal changes, leverage existing structure
- **CSV Format:** No changes needed, already supports CDN metadata
- **Job Management:** Follow pattern from `premium-extraction-service.js`

---

**Last Updated:** October 20, 2025
**Next Review:** After Phase 1 completion
