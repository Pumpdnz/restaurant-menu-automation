# PDF Menu Extraction - Option A (Manual Processing)

**Last Updated:** 2025-10-20

## Overview

This document outlines the immediate solution for importing menu data from PDF files when no online ordering platform is available for automated scraping. This approach was created specifically for Chaat Street restaurant (ID: `f2995098-3a86-481e-9cf0-0faf73dcf799`) but serves as a template for similar future scenarios.

### The Challenge

- Restaurant changing menu during onboarding
- New menu only available as PDF (`chaat-street-new-menu.pdf`)
- 13 high-resolution images (6-11MB each) - too large for Cloudwaitress CDN
- No online ordering platform available for automated extraction
- Need to maintain compatibility with existing CSV import workflow

### The Solution

A hybrid manual-automated approach that:
1. Compresses oversized images to CDN-acceptable sizes (~500KB)
2. Manually extracts menu data from PDF into structured CSV
3. Reuses existing CDN images where menu items haven't changed
4. Uploads new compressed images to UploadCare CDN
5. Generates CSV with proper CDN references for automated import

## Documentation Structure

```
planning/pdf-extraction/
├── README.md                        # This file - project overview
├── implementation-roadmap.md        # Phase-by-phase implementation plan
├── architecture.md                  # System design and data flow
├── database-schema.md              # Database tables and relationships
├── service-layer.md                # Service components breakdown
├── image-processing-pipeline.md    # Image compression and upload workflow
├── chaat-street-new-menu.pdf      # Source PDF menu
├── Chaat Street_menu.csv          # Existing menu with CDN references
└── chaat-street-photos/           # New menu item images (uncompressed)
    ├── BEDAI KE ALOO-2.jpg        # 9.7MB
    ├── BOMBE KULFI-1.jpg          # 6.3MB
    ├── Charred Cabbage Poriyal-2.jpg  # 10MB
    └── ...                        # 10 more images
```

### Reference Files

```
planning/pdf-extraction/reference-files/
├── uploadcare-integration-plan.md  # UploadCare CDN integration details
├── Multi-Platform-Extraction-Analysis.md
└── Platform-Expansion-Implementation-Summary.md
```

## Architecture Overview

```
┌─────────────────┐
│   PDF Menu      │
│  (Manual Read)  │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────────────────┐
│  Manual Data Extraction                         │
│  - Compare with existing CSV                    │
│  - Identify new items vs existing items         │
│  - Map images to menu items                     │
└────────┬────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────┐
│  Image Processing Pipeline                      │
│  ┌───────────────────────────────────────────┐  │
│  │ 1. Load high-res images (6-11MB each)    │  │
│  │ 2. Compress with Sharp (~500KB target)   │  │
│  │ 3. Upload to UploadCare CDN               │  │
│  │ 4. Receive CDN IDs and URLs               │  │
│  └───────────────────────────────────────────┘  │
└────────┬────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────┐
│  Database Record Creation                       │
│  - Create menu record                           │
│  - Create category records                      │
│  - Create menu_item records                     │
│  - Create item_images records with CDN data     │
└────────┬────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────┐
│  Enhanced CSV Generation                        │
│  - Include all Cloudwaitress required fields    │
│  - Add CDN references (isCDNImage=TRUE)         │
│  - Include imageCDNID and imageCDNFilename      │
└────────┬────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────┐
│  Automated Import (Existing Script)             │
│  - Use import-csv-menu.js via Playwright        │
│  - Imports to Pumpd admin dashboard             │
│  - Images already on CDN, references work       │
└─────────────────────────────────────────────────┘
```

## Core Principles

1. **Reuse Before Upload**: Check existing CSV for items with CDN images before uploading new ones
2. **Compress First**: Always compress images before CDN upload (target ~500KB, max 1MB)
3. **Database First**: Create proper database records before CSV generation
4. **CSV Compatibility**: Generated CSV must match exact format expected by `import-csv-menu.js`
5. **Manual Verification**: Human verification at each critical step to ensure data accuracy

## Existing UI Patterns

This solution does NOT involve UI changes. It leverages:
- Existing UploadCare service (`src/services/uploadcare-service.js`)
- Existing database service (`src/services/database-service.js`)
- Existing CSV generation logic (server.js, lines 4100-4300)
- Existing import script (`scripts/restaurant-registration/import-csv-menu.js`)

## Implementation Location

### New Files to Create

```
scripts/
└── pdf-menu-processing/
    ├── compress-images.js           # Image compression utility
    ├── upload-to-cdn.js            # Batch CDN upload with progress
    ├── create-menu-from-csv.js     # Database record creation
    └── merge-csv-references.js     # Merge old CDN refs with new items
```

### Existing Files to Use

- `UberEats-Image-Extractor/src/services/uploadcare-service.js` - CDN upload
- `UberEats-Image-Extractor/src/services/database-service.js` - Database operations
- `scripts/restaurant-registration/import-csv-menu.js` - Final import

## Quick Start Guide

### Prerequisites

1. **Environment Variables** (in `/scripts/.env`):
   ```env
   UPLOADCARE_PUBLIC_KEY=your_key_here
   UPLOADCARE_SECRET_KEY=your_secret_here
   ```

2. **Dependencies Installed**:
   ```bash
   npm install sharp axios uuid csv-parse csv-stringify
   ```

3. **Files Prepared**:
   - PDF menu for reference
   - High-resolution images in a folder
   - Existing CSV with CDN references (if updating menu)

### Usage Steps

```bash
# Step 1: Compress images
cd scripts/pdf-menu-processing
node compress-images.js \
  --input ../../planning/pdf-extraction/chaat-street-photos \
  --output ./compressed-images

# Step 2: Create draft CSV manually
# Open the PDF, compare with existing CSV, create new CSV with new items

# Step 3: Upload new images to CDN
node upload-to-cdn.js \
  --images ./compressed-images \
  --csv ./draft-menu.csv \
  --restaurant-id f2995098-3a86-481e-9cf0-0faf73dcf799

# Step 4: Merge old CDN references
node merge-csv-references.js \
  --old-csv ../../planning/pdf-extraction/Chaat\ Street_menu.csv \
  --new-csv ./draft-menu.csv \
  --output ./final-menu-with-cdn.csv

# Step 5: Create database records
node create-menu-from-csv.js \
  --csv ./final-menu-with-cdn.csv \
  --restaurant-id f2995098-3a86-481e-9cf0-0faf73dcf799

# Step 6: Use existing import script
cd ../restaurant-registration
node import-csv-menu.js \
  --email chaat.street@example.com \
  --csv ../pdf-menu-processing/final-menu-with-cdn.csv
```

## Related Documentation

### Within This Project
- [Implementation Roadmap](./implementation-roadmap.md) - Detailed phase-by-phase plan
- [Architecture](./architecture.md) - System design and data flow diagrams
- [Database Schema](./database-schema.md) - Table structures and relationships
- [Service Layer](./service-layer.md) - Service components breakdown
- [Image Processing Pipeline](./image-processing-pipeline.md) - Image handling workflow

### Reference Files
- `reference-files/uploadcare-integration-plan.md` - UploadCare CDN integration details
- `../../extracted-menus/` - Previously extracted menu CSVs
- `../../scripts/restaurant-registration/import-csv-menu.js` - Import script documentation

### Existing System Documentation
- `../../CLAUDE.md` - Main project documentation
- `../../UberEats-Image-Extractor/` - Extraction system codebase

## Status

**Current Status:** Planning Phase
**Started:** 2025-10-20
**Restaurant:** Chaat Street (ID: f2995098-3a86-481e-9cf0-0faf73dcf799)

### Completed
- ✅ System analysis and architecture review
- ✅ Existing CSV format analysis
- ✅ Image compression requirements determined
- ✅ Database schema review
- ✅ UploadCare service capabilities confirmed

### In Progress
- 🔄 Documentation creation
- 🔄 Implementation planning

### Not Started
- ⏳ Image compression script
- ⏳ CDN upload script
- ⏳ CSV creation and merging scripts
- ⏳ Database record creation
- ⏳ Testing and validation

## Next Steps

1. **Complete Documentation** (Current Phase)
   - Finalize implementation roadmap
   - Document architecture details
   - Create database schema reference

2. **Implement Image Processing** (Phase 1)
   - Create compress-images.js script
   - Test compression on sample images
   - Verify CDN size requirements met

3. **Implement CDN Upload** (Phase 2)
   - Create upload-to-cdn.js script
   - Test batch upload functionality
   - Validate CDN responses

4. **CSV Processing** (Phase 3)
   - Manually extract PDF data
   - Create merge-csv-references.js
   - Generate final CSV with all CDN refs

5. **Database & Import** (Phase 4)
   - Create database records
   - Test CSV import
   - Validate in Pumpd dashboard

## Notes

- **Time Sensitivity**: This is an urgent onboarding requirement
- **Manual Steps**: Some manual data extraction required (PDF → CSV)
- **Future Automation**: Consider Firecrawl PDF parser for scalable solution
- **Image Quality**: Balance compression ratio vs visual quality
- **Validation**: Verify each phase before proceeding to next

## Contact

For questions or issues:
- Review existing documentation first
- Check reference files for similar patterns
- Test scripts with sample data before production use
