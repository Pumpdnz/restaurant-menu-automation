# System Architecture - PDF Menu Extraction

## High-Level Overview

The PDF menu extraction system integrates with the existing menu extraction infrastructure, adding PDF as a new platform type alongside UberEats, DoorDash, and other online ordering platforms.

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Interface Layer                     │
├─────────────────────────────────────────────────────────────────┤
│  PDFExtraction.tsx  │  ExtractionProgress  │  Extractions List  │
│  (Upload & Config)  │  (Real-time Status)  │  (All Platforms)   │
└──────────────┬──────────────────┬──────────────────┬────────────┘
               │                  │                  │
               ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                          API Layer (Express)                     │
├─────────────────────────────────────────────────────────────────┤
│  POST /api/extractions/pdf           │  Upload PDF              │
│  GET  /api/extractions/:id/status    │  Check progress          │
│  GET  /api/extractions/:id/preview   │  Review data             │
│  POST /api/extractions/:id/confirm   │  Save to database        │
│  GET  /api/menus/:id/csv             │  Export CSV              │
└──────────────┬──────────────────┬──────────────────┬────────────┘
               │                  │                  │
               ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Service Layer                             │
├─────────────────────────────────────────────────────────────────┤
│  PDFExtractionService  │  ImageCompressionService                │
│  (Orchestrator)        │  (Sharp-based processing)               │
│                        │                                         │
│  UploadCareService     │  DatabaseService                        │
│  (CDN uploads)         │  (Persistence)                          │
│                        │                                         │
│  RateLimiterService    │  JobManagementService                   │
│  (API throttling)      │  (Progress tracking)                    │
└──────────────┬──────────────────┬──────────────────┬────────────┘
               │                  │                  │
               ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                      External Services                           │
├─────────────────────────────────────────────────────────────────┤
│  Firecrawl API         │  UploadCare CDN  │  Supabase DB        │
│  (PDF parsing)         │  (Image hosting) │  (Data storage)     │
└─────────────────────────────────────────────────────────────────┘
```

### Layer Responsibilities

**User Interface Layer**
- PDF upload and configuration
- Real-time extraction progress monitoring
- Data review and validation
- Image management and association
- Export and download controls

**API Layer**
- Request validation and authentication
- Rate limiting and throttling
- Job creation and status management
- Response formatting and error handling
- WebSocket connections for real-time updates

**Service Layer**
- Business logic orchestration
- External API integration
- Data transformation and validation
- Image processing and compression
- Database operations

**External Services**
- Firecrawl: PDF parsing and data extraction
- UploadCare: Image CDN hosting
- Supabase: PostgreSQL database

---

## Directory Structure

```
automation/
├── UberEats-Image-Extractor/
│   ├── server.js                              # Express server, API endpoints
│   ├── src/
│   │   ├── services/
│   │   │   ├── pdf-extraction-service.js      # NEW: PDF extraction orchestrator
│   │   │   ├── image-compression-service.js   # NEW: Sharp image compression
│   │   │   ├── uploadcare-service.js          # EXTEND: Add buffer upload
│   │   │   ├── database-service.js            # EXTEND: PDF job tracking
│   │   │   ├── rate-limiter-service.js        # EXISTING: API rate limiting
│   │   │   ├── premium-extraction-service.js  # EXISTING: Pattern reference
│   │   │   └── firecrawl-service.js           # EXISTING: Firecrawl integration
│   │   ├── pages/
│   │   │   ├── PDFExtraction.tsx              # NEW: PDF upload page
│   │   │   ├── ExtractionDetail.jsx           # EXTEND: Support PDF type
│   │   │   └── Extractions.jsx                # EXTEND: List PDF extractions
│   │   ├── components/
│   │   │   ├── PDFUpload.tsx                  # NEW: Drag-drop upload
│   │   │   ├── PDFExtractionProgress.tsx      # NEW: Progress indicator
│   │   │   └── ImageAssociation.tsx           # NEW: Image-to-item linking
│   │   └── utils/
│   │       ├── platform-detector.js           # EXTEND: Add PDF platform
│   │       └── csv-generator.js               # EXISTING: CSV export
│   └── package.json                           # ADD: sharp dependency
├── scripts/
│   ├── manual-image-upload.js                 # NEW: Manual upload script
│   └── restaurant-registration/
│       └── import-csv-menu.js                 # EXISTING: CSV import
└── planning/
    └── pdf-extraction/
        ├── scalable-implementation/           # This documentation
        ├── chaat-street-new-menu.pdf          # Test PDF
        ├── chaat-street-photos/               # Test images
        └── Chaat Street_menu.csv              # Reference CSV
```

### Key File Locations

**PDF Extraction Service** (`src/services/pdf-extraction-service.js`)
- Main orchestrator for PDF extraction workflow
- Coordinates Firecrawl API calls, data transformation, job management
- Handles errors and retries
- Tracks progress across all extraction steps

**Image Compression Service** (`src/services/image-compression-service.js`)
- Sharp-based image compression
- Reduces file sizes (6-11MB → ~500KB)
- Maintains aspect ratio and quality
- Supports JPEG, PNG, WebP formats

**UploadCare Service** (`src/services/uploadcare-service.js`)
- Extended to support buffer uploads (not just URLs)
- Batch processing with progress tracking
- CDN metadata management
- Retry logic for failed uploads

**Database Service** (`src/services/database-service.js`)
- CRUD operations for menus, categories, items, images
- PDF extraction job tracking
- Transaction management for atomic saves
- Audit trail for extraction history

**Server Endpoints** (`server.js`)
- PDF upload and extraction initiation
- Job status polling and WebSocket updates
- CSV export with CDN references
- Image upload and management

---

## Data Flow

### Primary Flow: PDF to Importable CSV

**IMPORTANT:** Firecrawl requires a URL to the PDF, not direct file upload. PDFs are first uploaded to Supabase Storage (temporary bucket), then the public URL is passed to Firecrawl for extraction.

**Architecture Note:** Supabase Storage is used for PDF hosting (temporary), while UploadCare CDN is reserved exclusively for client menu item images.

```
┌──────────┐
│   User   │
└────┬─────┘
     │ 1. Upload PDF + Config
     ▼
┌──────────────────────┐
│  POST /api/          │
│  extractions/pdf     │
└────┬─────────────────┘
     │ 2. Create Job
     ▼
┌──────────────────────────────────────┐
│  PDFExtractionService                │
│  ┌────────────────────────────────┐  │
│  │ createExtractionJob()          │  │
│  │ - Generate job ID              │  │
│  │ - Save to extraction_jobs      │  │
│  │ - Set status: 'pending'        │  │
│  └────────────────────────────────┘  │
└────┬─────────────────────────────────┘
     │ 3a. Upload PDF to Supabase Storage
     ▼
┌──────────────────────────────────────┐
│  Supabase Storage                    │
│  Bucket: pdf-extractions (temp)      │
│  - Store PDF with TTL (24 hours)     │
│  - Return public URL                 │
└────┬─────────────────────────────────┘
     │ 3b. Pass URL to Firecrawl
     ▼
┌──────────────────────────────────────┐
│  Firecrawl API                       │
│  POST /v2/scrape                     │
│  {                                   │
│    url: <uploadcare_cdn_url>,        │
│    parsers: ['pdf'],                 │
│    formats: [{                       │
│      type: 'json',                   │
│      schema: <menu_schema>           │
│    }]                                │
│  }                                   │
│  Note: +1 credit per page            │
└────┬─────────────────────────────────┘
     │ 4. Return structured data
     ▼
┌──────────────────────────────────────┐
│  PDFExtractionService                │
│  ┌────────────────────────────────┐  │
│  │ transformExtractedData()       │  │
│  │ - Normalize structure          │  │
│  │ - Generate UUIDs               │  │
│  │ - Validate prices/names        │  │
│  │ - Extract tags                 │  │
│  └────────────────────────────────┘  │
└────┬─────────────────────────────────┘
     │ 5. Process images (if available)
     ▼
┌──────────────────────────────────────┐
│  Image Processing Pipeline           │
│  ┌────────────────────────────────┐  │
│  │ Extract images from PDF        │  │
│  │ ↓                              │  │
│  │ Compress with Sharp            │  │
│  │ (6-11MB → ~500KB)              │  │
│  │ ↓                              │  │
│  │ Upload to UploadCare CDN       │  │
│  │ ↓                              │  │
│  │ Store CDN metadata             │  │
│  └────────────────────────────────┘  │
└────┬─────────────────────────────────┘
     │ 6. Save to database
     ▼
┌──────────────────────────────────────┐
│  DatabaseService                     │
│  ┌────────────────────────────────┐  │
│  │ BEGIN TRANSACTION              │  │
│  │                                │  │
│  │ INSERT INTO menus              │  │
│  │   (restaurant_id, platform_id, │  │
│  │    extraction_job_id, ...)     │  │
│  │                                │  │
│  │ INSERT INTO categories         │  │
│  │   (menu_id, name, position...) │  │
│  │                                │  │
│  │ INSERT INTO menu_items         │  │
│  │   (category_id, menu_id,       │  │
│  │    name, price, description...)│  │
│  │                                │  │
│  │ INSERT INTO item_images        │  │
│  │   (menu_item_id, cdn_id,       │  │
│  │    cdn_url, cdn_filename...)   │  │
│  │                                │  │
│  │ UPDATE extraction_jobs         │  │
│  │   SET status = 'completed'     │  │
│  │                                │  │
│  │ COMMIT                         │  │
│  └────────────────────────────────┘  │
└────┬─────────────────────────────────┘
     │ 7. Generate CSV
     ▼
┌──────────────────────────────────────┐
│  GET /api/menus/:id/csv              │
│  ┌────────────────────────────────┐  │
│  │ Fetch menu with relations      │  │
│  │ Format CSV rows:               │  │
│  │   - menuID, categoryID         │  │
│  │   - dishID, dishName, price    │  │
│  │   - isCDNImage = TRUE          │  │
│  │   - imageCDNID = <uuid>        │  │
│  │   - imageCDNFilename           │  │
│  └────────────────────────────────┘  │
└────┬─────────────────────────────────┘
     │ 8. Download CSV
     ▼
┌──────────┐
│   User   │
└────┬─────┘
     │ 9. Import via script
     ▼
┌──────────────────────────────────────┐
│  import-csv-menu.js (Playwright)     │
│  - Login to customer account         │
│  - Navigate to menu import page      │
│  - Upload CSV file                   │
│  - Wait for import completion        │
│  - Verify menu created               │
└──────────────────────────────────────┘
```

### Alternative Flow: Manual Image Upload

```
┌──────────┐
│   User   │
└────┬─────┘
     │ 1. Upload PDF (no images)
     ▼
     ... (steps 2-4 same as above) ...
     │ 5. Skip image extraction
     ▼
┌──────────────────────────────────────┐
│  Save menu without images            │
│  - menu_items created                │
│  - item_images table empty           │
│  - Status: 'pending_images'          │
└────┬─────────────────────────────────┘
     │ 6. User uploads image directory
     ▼
┌──────────────────────────────────────┐
│  POST /api/menus/:id/images/upload   │
│  - Receive image files               │
│  - Match filenames to items          │
│  - Suggest associations              │
└────┬─────────────────────────────────┘
     │ 7. User confirms mappings
     ▼
┌──────────────────────────────────────┐
│  ImageCompressionService             │
│  FOR EACH image:                     │
│    - Compress (Sharp)                │
│    - Upload to UploadCare            │
│    - Create item_images record       │
│    - Link to menu_item               │
└────┬─────────────────────────────────┘
     │ 8. Update menu status
     ▼
┌──────────────────────────────────────┐
│  UPDATE menus                        │
│    SET status = 'completed'          │
│  WHERE id = :menuId                  │
└────┬─────────────────────────────────┘
     │ 9. Generate CSV (with images)
     ▼
     ... (continue from step 7 above) ...
```

---

## Service Layer Architecture

### PDFExtractionService

**Responsibilities:**
- Orchestrate the complete PDF extraction workflow
- Coordinate between Firecrawl, image processing, and database services
- Manage extraction jobs and progress tracking
- Handle errors and implement retry logic

**Key Methods:**

```javascript
class PDFExtractionService {
  // Main orchestration
  async extractMenuFromPDF(restaurantId, pdfBuffer, config)

  // Sub-processes
  async uploadPDFToFirecrawl(pdfBuffer, schema)
  async transformExtractedData(firecrawlResponse)
  async extractImagesFromPDF(pdfBuffer)
  async processAndUploadImages(images, restaurantName)
  async saveToDatabase(restaurantId, menuData, images)

  // Job management
  async createJob(restaurantId, config)
  async updateJobProgress(jobId, progress)
  async completeJob(jobId, results)
  async failJob(jobId, error)

  // Utilities
  async validateExtractedData(menuData)
  async generatePreview(menuData)
}
```

**Dependencies:**
- `firecrawl-service.js` - API integration
- `image-compression-service.js` - Image processing
- `uploadcare-service.js` - CDN uploads
- `database-service.js` - Data persistence
- `rate-limiter-service.js` - API throttling

**Error Handling:**
- Wraps all external API calls in try-catch
- Implements exponential backoff for retries (3 attempts max)
- Saves partial results on failure
- Updates job status with error details
- Sends WebSocket notifications on critical errors

### ImageCompressionService

**Responsibilities:**
- Compress images to target size (~500KB)
- Maintain quality and aspect ratio
- Support multiple formats (JPEG, PNG, WebP)
- Validate compressed output

**Key Methods:**

```javascript
class ImageCompressionService {
  async compressImage(inputBuffer, options = {})
  async compressFile(inputPath, outputPath, options = {})
  async batchCompress(images, progressCallback)

  // Utilities
  async validateImage(buffer)
  async getImageMetadata(buffer)
  async estimateCompression(buffer, targetSize)
}
```

**Compression Strategy:**
1. Analyze input (size, dimensions, format)
2. Calculate target quality (iterative if needed)
3. Apply Sharp transformations:
   - Resize if too large (max 2048px)
   - Convert to JPEG if PNG
   - Apply progressive encoding
   - Set quality (85% default)
4. Validate output (size, quality, dimensions)
5. Retry with lower quality if target not met

**Configuration:**
```javascript
{
  targetSize: 500000,        // 500KB
  maxQuality: 95,
  minQuality: 60,
  maxDimension: 2048,
  format: 'jpeg',
  progressive: true,
  compressionLevel: 9
}
```

### UploadCareService (Extended)

**New Methods:**

```javascript
class UploadCareService {
  // EXISTING
  async uploadImageFromUrl(imageUrl, filename, metadata)
  async uploadBatch(images, progressCallback, batchId)
  async waitForUploadCompletion(token)
  sanitizeFilename(url, itemName, categoryName)

  // NEW
  async uploadImageFromBuffer(buffer, filename, metadata)
  async uploadImageFromFile(filePath, filename, metadata)
  async uploadCompressedImage(originalBuffer, filename, metadata)
}
```

**Enhanced Workflow:**
```
Input: Buffer/File
  ↓
Check if compression needed
  ↓ (if > 1MB)
Compress with ImageCompressionService
  ↓
Upload to UploadCare
  ↓
Poll for completion
  ↓
Return CDN metadata
```

### DatabaseService (Extended)

**New Methods:**

```javascript
class DatabaseService {
  // PDF extraction jobs
  async createPDFExtractionJob(restaurantId, config)
  async updateExtractionJobProgress(jobId, progress)
  async getExtractionJob(jobId)
  async listExtractionJobs(restaurantId, filters)

  // PDF menu operations
  async savePDFExtraction(jobId, menuData)
  async linkImagesToItems(menuId, imageMappings)
  async getPDFMenuWithImages(menuId)

  // Batch operations
  async createMenuWithRelations(restaurantId, menuData)
  async bulkInsertCategories(menuId, categories)
  async bulkInsertItems(categoryId, items)
  async bulkInsertImages(itemImageMappings)
}
```

**Transaction Management:**
```javascript
async createMenuWithRelations(restaurantId, menuData) {
  const client = await this.pool.connect();
  try {
    await client.query('BEGIN');

    // Insert menu
    const menu = await this.insertMenu(client, restaurantId, menuData);

    // Insert categories
    const categories = await this.bulkInsertCategories(
      client, menu.id, menuData.categories
    );

    // Insert items (with category IDs)
    for (const category of categories) {
      await this.bulkInsertItems(
        client, category.id, category.items
      );
    }

    // Insert images (with item IDs)
    if (menuData.images) {
      await this.bulkInsertImages(client, menuData.images);
    }

    await client.query('COMMIT');
    return menu;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
```

---

## Error Handling

### Error Categories

**1. User Errors (4xx)**
- Invalid PDF format
- File too large (>10MB)
- Missing required fields
- Invalid restaurant ID

**Response:**
```json
{
  "success": false,
  "error": {
    "type": "validation_error",
    "message": "Invalid PDF file format",
    "details": "File must be a valid PDF document",
    "code": "INVALID_PDF_FORMAT"
  }
}
```

**2. External Service Errors (5xx)**
- Firecrawl API failures
- UploadCare upload failures
- Database connection errors
- Network timeouts

**Response:**
```json
{
  "success": false,
  "error": {
    "type": "external_service_error",
    "message": "Failed to parse PDF",
    "details": "Firecrawl API returned error: timeout",
    "code": "FIRECRAWL_TIMEOUT",
    "retryable": true,
    "retryAfter": 5000
  }
}
```

**3. Data Quality Errors**
- Extraction confidence too low
- Missing required fields (prices, names)
- Invalid data structures
- Image matching failures

**Response:**
```json
{
  "success": true,
  "warnings": [
    {
      "type": "data_quality",
      "message": "Some items missing prices",
      "items": ["item-uuid-1", "item-uuid-2"],
      "suggestion": "Review and add prices manually"
    }
  ],
  "data": { /* extracted menu */ }
}
```

### Retry Strategy

**Exponential Backoff:**
```javascript
const retryDelays = [1000, 2000, 4000]; // 1s, 2s, 4s
let attempt = 0;

while (attempt < retryDelays.length) {
  try {
    return await externalAPICall();
  } catch (error) {
    if (!isRetryable(error)) throw error;

    attempt++;
    if (attempt >= retryDelays.length) throw error;

    await sleep(retryDelays[attempt]);
  }
}
```

**Retryable Errors:**
- Network timeouts
- Rate limit errors (429)
- Temporary service unavailable (503)
- Gateway errors (502, 504)

**Non-Retryable Errors:**
- Authentication failures (401)
- Invalid requests (400)
- Not found (404)
- Client errors (4xx except 429)

### Error Recovery

**Partial Success:**
- Save extracted data even if images fail
- Allow manual image upload later
- Mark items without prices for review
- Continue processing remaining items

**State Preservation:**
- Save extraction job with error details
- Store partial results in database
- Allow resume from last successful step
- Provide manual override options

**User Notifications:**
- Real-time error messages via WebSocket
- Email notifications for async failures
- Dashboard alerts for incomplete extractions
- Support ticket creation for critical errors

---

## Security Considerations

### Input Validation

**PDF Upload:**
- File size limit: 10MB
- MIME type validation: `application/pdf`
- Content scanning (virus/malware)
- PDF structure validation
- Page count limit (50 pages max)

**Image Upload:**
- File size limit: 20MB per image
- Allowed formats: JPEG, PNG, WebP
- Dimension limits: 200px - 4096px
- Content scanning
- EXIF data stripping

### Authentication & Authorization

**API Endpoints:**
- All PDF extraction endpoints require authentication
- JWT token validation
- Organisation-level permissions
- Rate limiting per organisation (see below)

**Feature Flags:**
```javascript
// Organisation-level feature flag
{
  pdfExtraction: {
    enabled: true,
    ratePerItem: 0.05,  // $0.05 per item extracted
    monthlyLimit: 1000   // Max items per month
  }
}
```

### Data Privacy

**Sensitive Data Handling:**
- PDFs stored temporarily (deleted after processing)
- No permanent storage of uploaded PDFs
- Images compressed and uploaded to CDN
- Database contains only menu data (no personal info)

**Audit Trail:**
- Log all PDF uploads (who, when, what)
- Track extraction jobs (source, config, results)
- Record all database changes
- Maintain history for compliance

### Rate Limiting

**API Rate Limits:**
```javascript
// Per organisation
{
  pdfUpload: {
    windowMs: 15 * 60 * 1000,  // 15 minutes
    maxRequests: 10             // 10 PDFs per window
  },
  imageUpload: {
    windowMs: 60 * 1000,        // 1 minute
    maxRequests: 50             // 50 images per minute
  }
}
```

**External API Limits:**
- Firecrawl: 100 requests/hour (tracked in rate-limiter-service.js)
- UploadCare: 1000 uploads/hour (tracked per batch)
- Supabase: No hard limits (monitor connection pool)

---

## Performance Considerations

### Bottlenecks

**1. PDF Parsing (Firecrawl)**
- Slowest step: 30-60 seconds for typical menu
- Dependent on PDF complexity and size
- Limited by Firecrawl API throughput

**Optimization:**
- Cache parsed results (24 hours)
- Parallel processing for multi-page PDFs
- Preprocess PDFs (remove unnecessary pages)

**2. Image Compression**
- CPU-intensive operation
- Scales with image size and count
- Sharp is fast but blocks event loop

**Optimization:**
- Worker threads for parallel compression
- Stream processing for large images
- Batch compression (5 images at a time)

**3. CDN Upload**
- Network-dependent (upload speed)
- UploadCare rate limits
- Sequential uploads slow for large batches

**Optimization:**
- Concurrent uploads (5 at a time)
- Retry failed uploads separately
- Compress before upload (reduces transfer time)

**4. Database Saves**
- Bulk inserts can be slow
- Foreign key checks add overhead
- Transaction locks during save

**Optimization:**
- Batch inserts (50 items per query)
- Prepared statements
- Connection pooling (already in place)

### Caching Strategy

**Redis Cache (Future):**
```javascript
{
  // Cache parsed PDF results (24 hours)
  `pdf:${pdfHash}`: {
    menuData: { /* extracted structure */ },
    timestamp: Date.now(),
    ttl: 86400000  // 24 hours
  },

  // Cache job status (5 minutes)
  `job:${jobId}:status`: {
    status: 'processing',
    progress: 45,
    timestamp: Date.now(),
    ttl: 300000  // 5 minutes
  }
}
```

### Monitoring Metrics

**Performance Metrics:**
- PDF extraction time (p50, p95, p99)
- Image compression time per image
- CDN upload time per image
- Database save time
- End-to-end workflow time

**Success Metrics:**
- Extraction success rate (%)
- Image upload success rate (%)
- Data quality score (%)
- User retry rate (%)

**Resource Metrics:**
- CPU usage during compression
- Memory usage during extraction
- Network bandwidth for uploads
- Database connection pool usage

---

## Integration Points

### Authentication (Existing)

**JWT Tokens:**
- Issued by Supabase Auth
- Validated in `authMiddleware`
- Contains user ID and organisation ID
- Expires after 24 hours

**Usage in PDF Extraction:**
```javascript
POST /api/extractions/pdf
Headers:
  Authorization: Bearer <jwt_token>

// Middleware extracts:
req.user = {
  id: 'user-uuid',
  organisationId: 'org-uuid',
  role: 'admin'
}
```

### Database Service (Existing)

**Connection Pool:**
```javascript
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

**Used in PDF Extraction:**
- All database operations use the existing pool
- Transactions for atomic menu saves
- Prepared statements for performance
- Error handling and retries

### UploadCare CDN (Existing)

**Current Implementation:**
```javascript
const uploadcare = new UploadCareService(
  process.env.UPLOADCARE_PUBLIC_KEY,
  process.env.UPLOADCARE_SECRET_KEY
);
```

**Extensions for PDF:**
- Add buffer upload support (not just URLs)
- Integrate compression before upload
- Maintain existing retry logic and batch processing

### UI Framework (React + TypeScript)

**Existing Patterns:**
- React components with TypeScript
- Shadcn UI components
- React Query for data fetching
- WebSocket for real-time updates

**PDF Extraction Components:**
- Follow existing patterns in `src/pages/`
- Reuse UI components from `src/components/`
- Integrate with existing extraction list
- Maintain consistent styling and UX

---

## Testing Strategy

### Unit Tests

**Services:**
```javascript
// image-compression-service.test.js
describe('ImageCompressionService', () => {
  it('compresses image to target size', async () => {
    const service = new ImageCompressionService();
    const input = await readFile('test-10mb.jpg');

    const output = await service.compressImage(input, {
      targetSize: 500000
    });

    expect(output.length).toBeLessThan(550000);  // Within 10%
    expect(output.length).toBeGreaterThan(450000);
  });

  it('maintains aspect ratio', async () => {
    // Test implementation
  });

  it('handles invalid input gracefully', async () => {
    // Test implementation
  });
});
```

### Integration Tests

**End-to-End Workflow:**
```javascript
// pdf-extraction.integration.test.js
describe('PDF Extraction Workflow', () => {
  it('extracts menu from PDF successfully', async () => {
    // 1. Upload PDF
    const response = await request(app)
      .post('/api/extractions/pdf')
      .attach('pdf', 'test-menu.pdf')
      .field('restaurantId', restaurantId);

    const jobId = response.body.jobId;

    // 2. Wait for completion
    await waitForJob(jobId, 'completed', 60000);

    // 3. Verify database records
    const menu = await db.getMenu(response.body.menuId);
    expect(menu).toBeDefined();
    expect(menu.categories.length).toBeGreaterThan(0);

    // 4. Verify CSV export
    const csv = await request(app)
      .get(`/api/menus/${menu.id}/csv`);

    expect(csv.text).toContain('isCDNImage,imageCDNID');
  });
});
```

### Performance Tests

**Load Testing:**
```javascript
// pdf-extraction.load.test.js
describe('PDF Extraction Performance', () => {
  it('handles 10 concurrent extractions', async () => {
    const promises = Array(10).fill(0).map(() =>
      extractPDF('test-menu.pdf', restaurantId)
    );

    const start = Date.now();
    await Promise.all(promises);
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(120000);  // Under 2 minutes
  });
});
```

### User Acceptance Tests

**Manual Testing Scenarios:**
1. Upload simple PDF (single column, text only)
2. Upload complex PDF (multi-column, images)
3. Upload large PDF (20+ pages)
4. Handle extraction errors gracefully
5. Review and edit extracted data
6. Associate images manually
7. Export CSV and import successfully

**Acceptance Criteria:**
- User can complete workflow without support
- Extraction accuracy >90% for well-formatted PDFs
- Clear error messages for failures
- Preview allows validation before committing
- CSV imports successfully via existing script

---

**Last Updated:** October 20, 2025
**Next Review:** After Phase 1 implementation
