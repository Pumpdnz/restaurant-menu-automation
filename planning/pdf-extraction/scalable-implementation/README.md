# PDF Menu Extraction System - Scalable Implementation (Option B)

## Overview

This document outlines the automated, scalable solution for extracting menu data from PDF documents using Firecrawl's PDF parsing capabilities. This system enables restaurant onboarding when no online ordering platform exists, providing a complete pipeline from PDF input to importable CSV with CDN-hosted images.

## Business Context

### Problem Statement
Restaurant onboarding typically relies on scraping menu data from existing online ordering platforms (UberEats, DoorDash, etc.). However, some restaurants:
- Have no online ordering presence yet
- Are updating their menu during onboarding
- Only have PDF menus available

This creates a gap in the onboarding workflow that requires manual data entry, slowing down the process and increasing error rates.

### Solution
Automated PDF menu extraction system that:
1. Parses structured menu data from PDF documents using Firecrawl
2. Compresses and uploads menu item images to UploadCare CDN
3. Creates complete database records (menus, categories, items, images)
4. Generates CSV files compatible with existing import automation
5. Integrates seamlessly with current extraction workflow

## Documentation Structure

```
scalable-implementation/
├── README.md (this file)              # Project overview and quick start
├── implementation-roadmap.md          # Phase-by-phase implementation plan
├── architecture.md                    # System design and data flow
├── database-schema.md                 # Database changes and migrations
├── service-layer.md                   # Backend service architecture
├── image-processing-pipeline.md       # Image compression and CDN upload
└── api-specification.md               # API endpoints and contracts
```

## Architecture Overview

### High-Level Flow
```
PDF Document → Firecrawl Parser → Structured Data → Database Records
    ↓              ↓                    ↓                ↓
Images      → Compression       → UploadCare     → CDN References
    ↓              ↓                    ↓                ↓
                                    CSV Export   → Import Script
```

### Key Components

1. **PDF Extraction Service**
   - Firecrawl API integration with PDF parsers
   - Structured data extraction (menu structure, items, prices)
   - Extraction job management and progress tracking

2. **Image Processing Pipeline**
   - Image extraction from PDF
   - Compression (Sharp library: 6-11MB → ~500KB)
   - UploadCare CDN upload with retry logic
   - Database linking and metadata storage

3. **Database Layer**
   - Menu data persistence (menus, categories, menu_items)
   - Image metadata with CDN references (item_images)
   - Extraction job tracking
   - Audit trail for PDF extractions

4. **Export System**
   - CSV generation with CDN image references
   - Compatible with existing `import-csv-menu.js` script
   - Support for both manual and automated workflows

## Core Principles

### 1. Leverage Existing Infrastructure
- Use current database schema (menus, categories, menu_items, item_images)
- Integrate with existing UploadCare CDN service
- Maintain CSV format compatibility with import scripts
- Reuse rate limiting and job management patterns

### 2. Platform Detection
- Extend existing platform detection to support PDF as a platform type
- Enable multi-source menu management (PDF + UberEats + DoorDash)
- Maintain extraction history and source tracking

### 3. Scalability First
- Asynchronous job processing for large PDFs
- Batch image processing with progress tracking
- Rate-limited API calls (Firecrawl and UploadCare)
- Error handling and retry mechanisms

### 4. User Experience
- Progress indicators for multi-step extraction
- Clear error messages and validation
- Preview extracted data before committing
- Manual override capabilities for edge cases

## Existing System Integration

### Database Service (`database-service.js`)
**Current Capabilities:**
- Menu CRUD operations
- Image CDN metadata updates
- Upload batch tracking
- Transaction support

**Extensions Needed:**
- PDF extraction job tracking
- Platform type: "PDF"
- Image-to-item linking for manual uploads

### UploadCare Service (`uploadcare-service.js`)
**Current Capabilities:**
- Image upload from URL
- Batch processing with progress
- Filename sanitization
- Retry logic and error handling

**Extensions Needed:**
- Buffer/file upload (not just URL)
- Image compression pre-upload
- Validation of compressed image quality

### Export Service (in `server.js`)
**Current Capabilities:**
- CSV generation with CDN references
- Menu data serialization
- Multiple format support

**No Changes Needed** - Existing CSV format already supports:
- `isCDNImage`, `imageCDNID`, `imageCDNFilename`
- Works with any menu source (UberEats, DoorDash, PDF)

## Implementation Location

### New Files to Create

```
UberEats-Image-Extractor/
├── src/
│   ├── services/
│   │   ├── pdf-extraction-service.js      # NEW: Main PDF extraction orchestrator
│   │   ├── image-compression-service.js   # NEW: Sharp-based image compression
│   │   └── uploadcare-service.js          # EXTEND: Add buffer upload support
│   ├── pages/
│   │   ├── PDFExtraction.tsx              # NEW: PDF upload and extraction UI
│   │   └── Extractions.jsx                # EXTEND: Add PDF extraction type
│   └── components/
│       ├── PDFUpload.tsx                  # NEW: Drag-drop PDF upload
│       └── PDFExtractionProgress.tsx      # NEW: Progress tracking UI
└── server.js                              # EXTEND: Add PDF extraction endpoints
```

### Files to Modify

```
server.js                                   # Add PDF extraction endpoints
src/services/database-service.js           # Add PDF job tracking methods
src/services/uploadcare-service.js         # Add buffer upload method
src/utils/platform-detector.js             # Add PDF platform type
src/pages/Extractions.jsx                  # Add PDF extraction cards
```

## Quick Start Guide

### Prerequisites
- [x] Firecrawl API access with PDF parser support ([API Docs](https://docs.firecrawl.dev/api-reference/endpoint/scrape))
- [x] UploadCare account with API keys
- [x] Sharp library for image compression (v0.34.3 already installed)
- [x] Supabase database access

### Phase 1: Image Processing (Week 1)
1. Implement image compression service
2. Extend UploadCare service for buffer uploads
3. Create manual image upload script
4. Test with Chaat Street images

### Phase 2: PDF Extraction (Week 2)
1. Implement PDF extraction service
2. Add Firecrawl PDF parser integration
3. Create extraction job management
4. Build progress tracking

### Phase 3: UI Integration (Week 3)
1. Create PDF upload component
2. Build extraction progress UI
3. Add PDF extraction type to listings
4. Implement preview and validation

### Phase 4: Testing & Production (Week 4)
1. End-to-end testing with sample PDFs
2. Error handling and edge cases
3. Documentation and user guides
4. Production deployment

## Related Documentation

### Reference Files
- `planning/pdf-extraction/reference-files/uploadcare-integration-plan.md`
- `planning/pdf-extraction/reference-files/Multi-Platform-Extraction-Analysis.md`
- `planning/pdf-extraction/reference-files/Platform-Expansion-Implementation-Summary.md`

### Existing Implementation
- `UberEats-Image-Extractor/src/services/premium-extraction-service.js` - Pattern for extraction orchestration
- `UberEats-Image-Extractor/src/services/uploadcare-service.js` - CDN upload implementation
- `scripts/restaurant-registration/import-csv-menu.js` - CSV import automation

### Database Schema
- See Supabase project: `qgabsyggzlkcstjzugdh`
- Tables: restaurants, menus, categories, menu_items, item_images, upload_batches

## Status

**Current Status:** Planning Complete - Ready for Implementation
**Last Updated:** 2025-10-20

### Success Story: Chaat Street ✅
- **Restaurant:** Chaat Street (ID: `f2995098-3a86-481e-9cf0-0faf73dcf799`)
- **Status:** Successfully onboarded manually (October 20, 2025)
- **Result:** New paying customer! 🎉
- **Method:** Manual CSV creation + image compression + CDN upload
- **Learnings:** Validated the workflow and identified automation opportunities

This manual onboarding success validates the approach and provides a foundation for building the automated solution.

## Next Steps

### For Immediate Implementation (Option A)
1. Create image compression script using Sharp
2. Build manual CSV helper tool
3. Upload compressed images to UploadCare
4. Create database records for Chaat Street
5. Generate final CSV for import

### For Scalable Implementation (Option B)
1. **Read:** `implementation-roadmap.md` for detailed phases
2. **Review:** `architecture.md` for system design
3. **Start:** Phase 1 (Image Processing Pipeline)
4. **Test:** With Chaat Street as pilot case

## Success Criteria

### Functional Requirements
- ✅ Extract structured menu data from PDF
- ✅ Compress images from 6-11MB to ~500KB
- ✅ Upload images to UploadCare CDN
- ✅ Generate CSV compatible with import script
- ✅ Track extraction progress and errors

### Performance Requirements
- PDF extraction: < 5 minutes for typical menu
- Image processing: < 30 seconds per image
- Batch upload: Support 50+ images
- Error recovery: Automatic retry with backoff

### Integration Requirements
- No breaking changes to existing extraction flow
- Backward compatible CSV format
- Works with current import automation
- Seamless platform switching (PDF ↔ UberEats ↔ DoorDash)

---

**Project Owner:** Pumpd Restaurant Automation
**Technical Lead:** TBD
**Project Start:** 2025-10-20
**Target Completion:** 4 weeks from start
