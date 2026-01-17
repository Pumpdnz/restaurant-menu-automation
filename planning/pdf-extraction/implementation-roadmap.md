# Implementation Roadmap: PDF Menu Processing (Option A)

**Last Updated:** 2025-10-20
**Status:** Not Started
**Restaurant:** Chaat Street (ID: `f2995098-3a86-481e-9cf0-0faf73dcf799`)

---

## Overview

This roadmap outlines the step-by-step implementation of a manual-automated hybrid solution for importing menu data from PDF files when no online ordering platform is available for automated scraping.

**Goal:** Successfully import Chaat Street's new menu from PDF into their Pumpd online ordering system using existing infrastructure.

**Approach:** Compress images → Upload to CDN → Create database records → Generate CSV → Import via Playwright

---

## Current Status

**Phase:** Planning
**Date Started:** 2025-10-20
**Expected Completion:** 1-2 days for implementation + testing

### What Works Now
- ✅ UploadCare CDN integration is functional
- ✅ Database schema supports CDN image references
- ✅ CSV generation logic exists in server.js
- ✅ Automated CSV import script (Playwright) is working
- ✅ Image compression capability exists (Sharp library available)

### What's Missing
- ❌ Image compression script for batch processing
- ❌ Batch CDN upload script with progress tracking
- ❌ CSV merging script (old CDN refs + new items)
- ❌ Database record creation from CSV
- ❌ Manual PDF data extraction completed

---

## Prerequisites

### Technical Requirements

1. **Environment Setup**
   ```bash
   # Ensure you're in the automation directory
   cd /Users/giannimunro/Desktop/cursor-projects/automation

   # Verify dependencies
   npm list sharp axios uuid csv-parse csv-stringify
   ```

2. **Environment Variables** (`/scripts/.env`)
   ```env
   UPLOADCARE_PUBLIC_KEY=f4394631faa29564fd1d
   UPLOADCARE_SECRET_KEY=<your-secret-key>
   SHARP_QUALITY=90
   DEBUG_MODE=false
   ```

3. **Database Access**
   - Supabase project ID: `qgabsyggzlkcstjzugdh`
   - Restaurant record exists: `f2995098-3a86-481e-9cf0-0faf73dcf799`

4. **Files Prepared**
   - ✅ PDF menu: `planning/pdf-extraction/chaat-street-new-menu.pdf`
   - ✅ Existing CSV: `planning/pdf-extraction/Chaat Street_menu.csv`
   - ✅ New images: `planning/pdf-extraction/chaat-street-photos/` (13 files)

### Knowledge Requirements

- Understanding of existing CSV format (35 rows, 20 columns)
- Familiarity with UploadCare service (`src/services/uploadcare-service.js`)
- Access to Pumpd admin dashboard for verification

---

## Phase 1: Image Compression Pipeline

**Duration:** 2-3 hours
**Status:** Not Started

### Objectives

1. Create reusable image compression script
2. Compress 13 high-res images (6-11MB) to ~500KB each
3. Maintain visual quality while meeting CDN requirements
4. Preserve original filename structure for mapping

### Tasks

#### 1.1 Create Compression Script

- [ ] Create directory: `scripts/pdf-menu-processing/`
- [ ] Create file: `scripts/pdf-menu-processing/compress-images.js`
- [ ] Implement Sharp-based compression with these specs:
  - Target size: 500KB per image
  - Max size: 1MB (CDN limit)
  - Format: JPEG with quality 85-90
  - Max dimensions: 1920px width, maintain aspect ratio
  - Progressive JPEG for web optimization

**Script Requirements:**
```javascript
// Command-line interface
node compress-images.js \
  --input <input-directory> \
  --output <output-directory> \
  --quality <1-100> \
  --max-width <pixels> \
  --max-size <bytes>

// Features needed:
- Batch processing with progress bar
- Automatic quality adjustment if size exceeds max
- Preserve original filenames
- Generate compression report (JSON)
- Handle errors gracefully (skip corrupt images)
```

#### 1.2 Test Compression

- [ ] Test on 2-3 sample images first
- [ ] Verify file sizes are <1MB
- [ ] Check visual quality is acceptable
- [ ] Measure processing time per image
- [ ] Document optimal quality settings

#### 1.3 Batch Process All Images

- [ ] Run compression on all 13 images
- [ ] Verify all compressed images are valid
- [ ] Create mapping file: `image-mapping.json`
  ```json
  {
    "BEDAI KE ALOO-2.jpg": {
      "original_size": "9.7MB",
      "compressed_size": "487KB",
      "compression_ratio": "95%",
      "menu_item_name": "Bedai Ke Aloo"
    }
  }
  ```
- [ ] Review compression report for any issues

### Deliverables

- ✅ `scripts/pdf-menu-processing/compress-images.js` (executable script)
- ✅ `scripts/pdf-menu-processing/compressed-images/` (13 compressed images)
- ✅ `scripts/pdf-menu-processing/image-mapping.json` (compression metadata)
- ✅ Compression report confirming all images <1MB

### Validation Criteria

- All 13 images compressed successfully
- All images under 1MB (preferably ~500KB)
- Visual quality acceptable (no obvious artifacts)
- Original filenames preserved
- Processing time <30 seconds total

---

## Phase 2: CDN Upload Pipeline

**Duration:** 3-4 hours
**Status:** Not Started
**Depends On:** Phase 1 complete

### Objectives

1. Create batch CDN upload script
2. Upload 13 compressed images to UploadCare
3. Receive and store CDN IDs and URLs
4. Handle upload errors and retries

### Tasks

#### 2.1 Create Upload Script

- [ ] Create file: `scripts/pdf-menu-processing/upload-to-cdn.js`
- [ ] Import existing UploadCare service
- [ ] Implement batch upload with concurrency control

**Script Requirements:**
```javascript
// Command-line interface
node upload-to-cdn.js \
  --images <directory> \
  --restaurant-id <uuid> \
  --output <cdn-mapping.json>

// Features needed:
- Use existing uploadcare-service.js
- Batch upload with max 5 concurrent uploads
- Progress tracking (X/13 uploaded)
- Automatic retry on failure (max 3 attempts)
- Generate CDN mapping file
- Validate CDN URLs are accessible
```

#### 2.2 Implement CDN Mapping

- [ ] For each uploaded image, store:
  - Original filename
  - CDN ID (UUID from UploadCare)
  - CDN URL (`https://ucarecdn.com/<uuid>/`)
  - CDN filename
  - Upload timestamp
  - Menu item name (from image filename)

#### 2.3 Test Upload

- [ ] Test with 1-2 images first
- [ ] Verify CDN URLs are accessible
- [ ] Check metadata is correctly stored
- [ ] Test retry mechanism with simulated failure
- [ ] Measure upload time per image

#### 2.4 Batch Upload All Images

- [ ] Upload all 13 compressed images
- [ ] Monitor progress and handle any errors
- [ ] Verify all CDN URLs work
- [ ] Generate final CDN mapping file

### Deliverables

- ✅ `scripts/pdf-menu-processing/upload-to-cdn.js` (executable script)
- ✅ `scripts/pdf-menu-processing/cdn-mapping.json` (CDN references)
  ```json
  {
    "BEDAI KE ALOO-2.jpg": {
      "cdn_id": "550e8400-e29b-41d4-a716-446655440000",
      "cdn_url": "https://ucarecdn.com/550e8400-e29b-41d4-a716-446655440000/",
      "cdn_filename": "bedai-ke-aloo.jpg",
      "uploaded_at": "2025-10-20T14:30:00Z",
      "menu_item_name": "Bedai Ke Aloo"
    }
  }
  ```
- ✅ Upload report with success/failure counts

### Validation Criteria

- All 13 images uploaded successfully
- All CDN URLs accessible and return valid images
- CDN mapping file complete and accurate
- Upload time <5 minutes total
- No failed uploads (or all retried successfully)

---

## Phase 3: CSV Data Processing

**Duration:** 4-6 hours (includes manual data entry)
**Status:** Not Started
**Depends On:** Phase 2 complete

### Objectives

1. Manually extract menu data from PDF
2. Compare new menu with existing CSV
3. Identify reusable CDN image references
4. Create merged CSV with new items + old CDN refs
5. Validate CSV format matches import requirements

### Tasks

#### 3.1 Analyze Existing CSV

- [ ] Open `planning/pdf-extraction/Chaat Street_menu.csv`
- [ ] Identify items with CDN images (`isCDNImage=TRUE`)
- [ ] Create lookup table: item name → CDN reference
  ```json
  {
    "Jhol Momo": {
      "imageCDNID": "78b71d0b-c501-4209-b44d-8189c1675d7b",
      "imageCDNFilename": "small-bites-bc9c318a9c96996e2d990faf2b0c65f6.jpeg"
    }
  }
  ```
- [ ] Count total items: 35 rows (excluding header)
- [ ] List categories: Short Bites, Medium Bites, Flatbreads, Fries, Dessert, Street Drinks, Non Alcoholics, Mocktails

#### 3.2 Manual PDF Data Extraction

- [ ] Open PDF: `planning/pdf-extraction/chaat-street-new-menu.pdf`
- [ ] Extract menu structure:
  - Categories (list all sections)
  - Menu items per category
  - Prices
  - Descriptions
  - Dietary tags (Halal, Vegan, Gluten Free, etc.)
- [ ] Create draft CSV with new menu structure
- [ ] Use existing CSV as template for formatting

**CSV Columns Required:**
```csv
menuID,menuName,menuDisplayName,menuDescription,
categoryID,categoryName,categoryDisplayName,categoryDescription,
dishID,dishName,dishPrice,dishType,dishDescription,
displayName,printName,tags,
isCDNImage,imageCDNID,imageCDNFilename,imageExternalURL
```

#### 3.3 Create CSV Merge Script

- [ ] Create file: `scripts/pdf-menu-processing/merge-csv-references.js`
- [ ] Implement logic to:
  1. Load old CSV and extract CDN references
  2. Load new draft CSV (from manual entry)
  3. Match items by name (fuzzy matching allowed)
  4. For matched items: copy old CDN references
  5. For new items: assign new CDN references from Phase 2
  6. For removed items: log but don't include
  7. Generate final merged CSV

**Script Requirements:**
```javascript
// Command-line interface
node merge-csv-references.js \
  --old-csv <path-to-old-csv> \
  --new-csv <path-to-draft-csv> \
  --cdn-mapping <path-to-cdn-mapping.json> \
  --output <path-to-final-csv>

// Features needed:
- Fuzzy name matching (handle minor differences)
- Preserve existing CDN refs when item unchanged
- Assign new CDN refs from cdn-mapping.json
- Validate all required CSV columns present
- Generate merge report (matched, new, removed items)
```

#### 3.4 Validate Final CSV

- [ ] Check CSV format matches expected structure
- [ ] Verify all new items have CDN image references
- [ ] Confirm all prices are valid numbers
- [ ] Check category IDs are consistent
- [ ] Validate tags format (tilde-separated: `Halal~Vegan`)
- [ ] Ensure `isCDNImage=TRUE` for all items with images

### Deliverables

- ✅ `planning/pdf-extraction/draft-menu.csv` (manually created)
- ✅ `scripts/pdf-menu-processing/merge-csv-references.js` (executable script)
- ✅ `scripts/pdf-menu-processing/final-menu-with-cdn.csv` (merged result)
- ✅ Merge report showing:
  - Items matched: X
  - New items: Y
  - Removed items: Z
  - CDN refs reused: A
  - New CDN refs assigned: B

### Validation Criteria

- Final CSV has correct number of rows (based on PDF menu)
- All items have valid CDN image references
- CSV format matches `Chaat Street_menu.csv` structure exactly
- No missing required fields
- All CDN URLs verified accessible

---

## Phase 4: Database Record Creation

**Duration:** 2-3 hours
**Status:** Not Started
**Depends On:** Phase 3 complete

### Objectives

1. Create menu record in database
2. Create category records
3. Create menu_item records
4. Create item_images records with CDN metadata
5. Link all records correctly with foreign keys

### Tasks

#### 4.1 Create Database Script

- [ ] Create file: `scripts/pdf-menu-processing/create-menu-from-csv.js`
- [ ] Import database service
- [ ] Implement CSV → Database transformation

**Script Requirements:**
```javascript
// Command-line interface
node create-menu-from-csv.js \
  --csv <path-to-final-csv> \
  --restaurant-id <uuid> \
  --platform-id <pdf-platform-id> \
  --dry-run

// Features needed:
- Parse CSV and group by categories
- Create menu record with version number
- Create category records with proper ordering
- Create menu_item records with all metadata
- Create item_images records with CDN data
- Dry-run mode for validation
- Transaction support (rollback on error)
```

#### 4.2 Database Operations Sequence

1. **Create Menu Record**
   ```sql
   INSERT INTO menus (id, restaurant_id, platform_id, version, is_active)
   VALUES (uuid, 'f2995098-3a86-481e-9cf0-0faf73dcf799', 'pdf-platform-id', 2, true)
   ```

2. **Create Category Records**
   - Extract unique categories from CSV
   - Assign position numbers (1, 2, 3...)
   - Create category records

3. **Create Menu Item Records**
   - For each CSV row:
     - Create menu_item with category_id
     - Parse tags array
     - Set dietary_info from tags
     - Include description, price, currency

4. **Create Item Images Records**
   - For each item with `isCDNImage=TRUE`:
     - Create item_images record
     - Set `cdn_uploaded=true`
     - Set `cdn_id`, `cdn_url`, `cdn_filename`
     - Set `type='primary'`

#### 4.3 Test with Dry Run

- [ ] Run script with `--dry-run` flag
- [ ] Review SQL statements to be executed
- [ ] Verify foreign key relationships
- [ ] Check for any data validation errors
- [ ] Confirm record counts match CSV

#### 4.4 Execute Database Creation

- [ ] Run script without dry-run flag
- [ ] Monitor for errors
- [ ] Verify records created successfully
- [ ] Check database counts:
  - 1 menu record
  - X category records
  - Y menu_item records
  - Z item_images records

#### 4.5 Validate Database State

- [ ] Query menu record and verify fields
- [ ] Check all categories have correct positions
- [ ] Verify menu_item → category relationships
- [ ] Confirm item_images → menu_item relationships
- [ ] Test CDN URLs from database records

### Deliverables

- ✅ `scripts/pdf-menu-processing/create-menu-from-csv.js` (executable script)
- ✅ Database records created in Supabase
- ✅ Database creation report with record counts
- ✅ Validation report confirming data integrity

### Validation Criteria

- Menu record exists and is_active=true
- All categories created with correct names and positions
- All menu items created with correct data
- All item_images records have valid CDN references
- Foreign key relationships all valid
- No orphaned records
- Record counts match CSV row counts

---

## Phase 5: CSV Import & Verification

**Duration:** 1-2 hours
**Status:** Not Started
**Depends On:** Phase 4 complete

### Objectives

1. Import CSV to Pumpd dashboard using existing script
2. Verify menu appears correctly in admin dashboard
3. Test CDN image loading
4. Validate customer-facing ordering page

### Tasks

#### 5.1 Prepare for Import

- [ ] Verify Chaat Street account exists in Pumpd
- [ ] Get restaurant email for login
- [ ] Ensure CSV is in correct location
- [ ] Backup existing menu (if any)

#### 5.2 Run Import Script

- [ ] Navigate to scripts directory:
  ```bash
  cd scripts/restaurant-registration
  ```
- [ ] Execute import:
  ```bash
  node import-csv-menu.js \
    --email chaat.street@example.com \
    --csv ../pdf-menu-processing/final-menu-with-cdn.csv
  ```
- [ ] Monitor Playwright automation
- [ ] Check for any import errors
- [ ] Review import logs

#### 5.3 Verify in Admin Dashboard

- [ ] Login to Pumpd admin: `https://admin.pumpd.co.nz`
- [ ] Navigate to Menu section
- [ ] Verify all categories appear
- [ ] Check menu items in each category
- [ ] Verify images load correctly from CDN
- [ ] Check prices display correctly
- [ ] Confirm tags/dietary info visible

#### 5.4 Test Customer Page

- [ ] Open customer ordering page
- [ ] Browse through all categories
- [ ] Verify menu item images load
- [ ] Check descriptions and prices
- [ ] Test "Add to Cart" functionality
- [ ] Verify dietary tags display

#### 5.5 Final Validation

- [ ] Compare PDF menu with imported menu
- [ ] Verify all items present
- [ ] Check all images display correctly
- [ ] Confirm pricing accuracy
- [ ] Test mobile responsive view
- [ ] Screenshot successful import

### Deliverables

- ✅ Menu successfully imported to Pumpd dashboard
- ✅ Import log with success confirmation
- ✅ Screenshots of admin dashboard
- ✅ Screenshots of customer ordering page
- ✅ Validation checklist completed

### Validation Criteria

- All categories visible in correct order
- All menu items imported successfully
- All CDN images loading without errors
- Prices match PDF menu
- Descriptions accurate
- Tags/dietary info correct
- Customer can add items to cart
- No console errors on ordering page

---

## Next Steps After Implementation

### Immediate (Same Day)
1. **User Acceptance Testing**
   - Have restaurant owner review imported menu
   - Make any necessary corrections
   - Get sign-off for launch

2. **Go Live**
   - Activate online ordering
   - Share ordering link with restaurant
   - Monitor for any issues

### Short Term (1 Week)
1. **Documentation**
   - Document any issues encountered
   - Note any CSV format adjustments needed
   - Update this roadmap with actual vs estimated times

2. **Process Refinement**
   - Identify manual steps that could be automated
   - Review image compression settings
   - Optimize upload performance

### Long Term (1 Month+)
1. **Automation Enhancement**
   - Evaluate Firecrawl PDF parser integration
   - Consider OCR for menu text extraction
   - Build UI for PDF upload and processing

2. **Feature Addition**
   - Add PDF extraction as platform option
   - Create admin UI for manual menu entry
   - Implement visual PDF annotation tool

---

## Handoff Summary

### What's Done
- ✅ Planning and documentation complete
- ✅ Existing system analyzed and understood
- ✅ CSV format requirements documented
- ✅ Database schema confirmed
- ✅ Implementation approach validated

### What's Next
- ⏳ Implement Phase 1: Image compression
- ⏳ Implement Phase 2: CDN upload
- ⏳ Implement Phase 3: CSV processing
- ⏳ Implement Phase 4: Database creation
- ⏳ Implement Phase 5: Import and verification

### Notes for Next Developer

#### Read Reference Files First
1. `planning/pdf-extraction/README.md` - Start here
2. `planning/pdf-extraction/architecture.md` - Understand data flow
3. `planning/pdf-extraction/reference-files/uploadcare-integration-plan.md` - CDN details
4. `planning/pdf-extraction/Chaat Street_menu.csv` - CSV format example

#### Review Current Implementation
1. `UberEats-Image-Extractor/src/services/uploadcare-service.js` - Reuse this!
2. `UberEats-Image-Extractor/src/services/database-service.js` - Database methods
3. `scripts/restaurant-registration/import-csv-menu.js` - Final import script
4. `UberEats-Image-Extractor/server.js` (lines 4100-4300) - CSV generation logic

#### Implementation Order for Additional Features
1. **Most Important**: Get image compression working first
2. **Second**: CDN upload with proper error handling
3. **Third**: CSV merging (this is where most complexity lives)
4. **Fourth**: Database creation (relatively straightforward)
5. **Last**: Import and verification (existing script handles this)

#### Key Architecture Decisions
- **Why not automate PDF extraction?** Time constraint + PDF parsing issues with API
- **Why compress images?** CDN has 1MB file size limit, originals are 6-11MB
- **Why merge CSVs?** Reuse existing CDN images where menu items haven't changed
- **Why create database records?** Required for future menu updates and version tracking
- **Why use existing import script?** Proven working solution, no need to recreate

#### Common Pitfalls to Avoid
1. Don't skip image compression - CDN will reject large files
2. Don't forget to test CDN URLs after upload
3. Don't assume CSV column order - it matters for import script
4. Don't skip dry-run for database operations
5. Don't forget to verify foreign key relationships

#### Testing Checklist
- [ ] Test compression on 1-2 images before batch
- [ ] Verify CDN uploads with test images
- [ ] Validate CSV format with existing parser
- [ ] Dry-run database operations first
- [ ] Test import on staging environment if available

---

## Estimated Timeline

| Phase | Duration | Dependencies | Risk Level |
|-------|----------|--------------|------------|
| Phase 1: Image Compression | 2-3 hours | None | Low |
| Phase 2: CDN Upload | 3-4 hours | Phase 1 | Low |
| Phase 3: CSV Processing | 4-6 hours | Phase 2 | Medium |
| Phase 4: Database Creation | 2-3 hours | Phase 3 | Medium |
| Phase 5: Import & Verification | 1-2 hours | Phase 4 | Low |
| **Total** | **12-18 hours** | Sequential | **Medium** |

**Contingency Time:** +4 hours for unexpected issues
**Total with Contingency:** 16-22 hours (2-3 working days)

---

## Success Metrics

- ✅ All 13 images compressed to <1MB
- ✅ All images uploaded to CDN successfully
- ✅ CSV format matches import requirements exactly
- ✅ Database records created without errors
- ✅ Menu imported and visible in Pumpd dashboard
- ✅ All CDN images loading correctly
- ✅ Restaurant owner approves final menu
- ✅ Online ordering functional

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Image compression reduces quality too much | Medium | Medium | Test with sample images first, adjust quality settings |
| CDN upload failures | Low | High | Implement retry logic, use existing uploadcare service |
| CSV format mismatch | Medium | High | Validate against existing CSV, test with import script |
| Database foreign key errors | Low | High | Dry-run first, validate relationships before commit |
| Manual data entry errors | High | Medium | Double-check against PDF, validate with restaurant owner |

---

## Support and Resources

### Technical Support
- Existing codebase: `automation/` repository
- UploadCare docs: https://uploadcare.com/docs/
- Sharp (image processing): https://sharp.pixelplumbing.com/
- Supabase docs: https://supabase.com/docs

### Key Files for Reference
- `planning/pdf-extraction/Chaat Street_menu.csv` - CSV format example
- `UberEats-Image-Extractor/src/services/uploadcare-service.js` - Working CDN upload
- `scripts/restaurant-registration/import-csv-menu.js` - Working import automation

### Debugging Tips
1. Enable `DEBUG_MODE=true` in `/scripts/.env`
2. Use `--dry-run` flags for validation
3. Test with small batches first
4. Check CloudWatch/Supabase logs for errors
5. Verify CDN URLs in browser before proceeding
