# Service Layer - PDF Menu Extraction

## Overview

The service layer implements the business logic for PDF menu extraction, orchestrating the workflow from PDF upload to database persistence. Services are designed to be modular, testable, and reusable across different extraction methods.

---

## Service Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                  PDFExtractionService                         │
│                  (Main Orchestrator)                          │
└────────┬─────────────┬───────────────┬──────────────┬────────┘
         │             │               │              │
         ▼             ▼               ▼              ▼
┌──────────────┐ ┌──────────┐ ┌────────────┐ ┌──────────────┐
│  Firecrawl   │ │  Image   │ │ UploadCare │ │   Database   │
│   Service    │ │Compression│ │  Service   │ │   Service    │
│              │ │  Service  │ │            │ │              │
└──────────────┘ └──────────┘ └────────────┘ └──────────────┘
```

---

## 1. PDFExtractionService

**Location:** `src/services/pdf-extraction-service.js`

### Purpose
Main orchestrator for the PDF extraction workflow. Coordinates all sub-processes and manages extraction jobs from start to finish.

### Class Definition

```javascript
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const db = require('./database-service');
const imageCompression = require('./image-compression-service');
const uploadcare = require('./uploadcare-service');
const rateLimiter = require('./rate-limiter-service');

class PDFExtractionService {
  constructor() {
    this.firecrawlApiKey = process.env.FIRECRAWL_API_KEY;
    this.firecrawlApiUrl = process.env.FIRECRAWL_API_URL || 'https://api.firecrawl.dev';
    this.activeJobs = new Map();
  }

  /**
   * Extract menu from PDF (main entry point)
   */
  async extractMenuFromPDF(restaurantId, pdfBuffer, filename, config, organisationId) {
    const jobId = this.generateJobId();

    try {
      // 1. Create extraction job
      const job = await this.createJob(restaurantId, filename, pdfBuffer.length, config, organisationId);

      // 2. Upload PDF to Firecrawl and extract
      this.updateProgress(jobId, { step: 'parsing', percentage: 10 });
      const extractedData = await this.uploadAndExtract(pdfBuffer, filename);

      // 3. Transform and validate
      this.updateProgress(jobId, { step: 'transformation', percentage: 30 });
      const menuData = await this.transformData(extractedData);

      // 4. Process images (if config allows)
      if (config.auto_extract_images && extractedData.images?.length > 0) {
        this.updateProgress(jobId, { step: 'image_processing', percentage: 50 });
        await this.processImages(jobId, extractedData.images, menuData.items);
      }

      // 5. Save to database
      this.updateProgress(jobId, { step: 'database_save', percentage: 80 });
      const menu = await db.savePDFExtraction(job.id, restaurantId, menuData, organisationId);

      // 6. Complete job
      this.updateProgress(jobId, { step: 'completed', percentage: 100 });
      await db.completeExtractionJob(job.id, {
        parser: 'firecrawl_pdf',
        categories_found: menuData.categories.length,
        items_found: menuData.items.length
      }, 'passed');

      return { jobId: job.job_id, menuId: menu.id };
    } catch (error) {
      await db.failExtractionJob(jobId, error.message);
      throw error;
    }
  }

  /**
   * Upload PDF to temporary storage and extract via Firecrawl
   *
   * NOTE: Firecrawl expects a URL, not direct file upload.
   * Architecture: Upload PDF to Supabase Storage (temp bucket),
   *               UploadCare CDN is reserved for client menu images only
   */
  async uploadAndExtract(pdfBuffer, filename) {
    await rateLimiter.acquireSlot('firecrawl-pdf');

    // Step 1: Upload PDF to Supabase Storage for temporary hosting
    const bucketName = 'pdf-extractions';
    const filePath = `temp/${Date.now()}-${filename}`;

    const { data: uploadData, error: uploadError } = await supabase
      .storage
      .from(bucketName)
      .upload(filePath, pdfBuffer, {
        contentType: 'application/pdf',
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      throw new Error(`Failed to upload PDF to storage: ${uploadError.message}`);
    }

    // Get public URL
    const { data: { publicUrl } } = supabase
      .storage
      .from(bucketName)
      .getPublicUrl(filePath);

    try {
      // Step 2: Extract data from PDF URL using Firecrawl
      const schema = this.buildExtractionSchema();

      const response = await axios.post(
        `${this.firecrawlApiUrl}/v2/scrape`,
        {
          url: publicUrl,
          parsers: ['pdf'],
          formats: [{
            type: 'json',
            schema: schema
          }],
          onlyMainContent: true
        },
        {
          headers: {
            'Authorization': `Bearer ${this.firecrawlApiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 120000  // 2 minutes
        }
      );

      if (!response.data.success) {
        throw new Error(`Firecrawl extraction failed: ${response.data.error}`);
      }

      return {
        extractedData: response.data.data.json,
        storagePath: filePath  // Save for cleanup
      };
    } catch (error) {
      // Clean up PDF on extraction failure
      await supabase.storage.from(bucketName).remove([filePath]);
      throw error;
    }
  }

  /**
   * Clean up temporary PDF from Supabase Storage
   */
  async cleanupPDF(storagePath) {
    try {
      const { error } = await supabase
        .storage
        .from('pdf-extractions')
        .remove([storagePath]);

      if (error) {
        console.error('Failed to cleanup PDF:', error);
      }
    } catch (error) {
      console.error('Error during PDF cleanup:', error);
    }
  }

  /**
   * Build Firecrawl extraction schema
   */
  buildExtractionSchema() {
    return {
      type: 'object',
      properties: {
        menu_name: { type: 'string' },
        categories: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              description: { type: 'string' },
              items: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    description: { type: 'string' },
                    price: { type: 'number' },
                    tags: { type: 'array', items: { type: 'string' } }
                  },
                  required: ['name']
                }
              }
            },
            required: ['name', 'items']
          }
        }
      },
      required: ['categories']
    };
  }

  /**
   * Transform Firecrawl output to database format
   */
  async transformData(extractedData) {
    const categories = [];
    const items = [];

    for (let i = 0; i < extractedData.categories.length; i++) {
      const cat = extractedData.categories[i];
      const categoryId = uuidv4();

      categories.push({
        id: categoryId,
        name: cat.name,
        description: cat.description || null,
        position: i
      });

      for (const item of cat.items) {
        items.push({
          id: uuidv4(),
          category_id: categoryId,
          name: item.name,
          description: item.description || null,
          price: this.normalizePrice(item.price),
          tags: item.tags || [],
          metadata: { extracted_from: 'PDF' }
        });
      }
    }

    return { categories, items };
  }

  /**
   * Normalize price (handle "$15.00", "15", etc.)
   */
  normalizePrice(price) {
    if (!price) return null;

    if (typeof price === 'number') return price;

    // Remove currency symbols and parse
    const cleaned = price.toString().replace(/[^0-9.]/g, '');
    const parsed = parseFloat(cleaned);

    return isNaN(parsed) ? null : parsed;
  }

  /**
   * Process images (extract, compress, upload)
   */
  async processImages(jobId, images, items) {
    const processedImages = [];

    for (let i = 0; i < images.length; i++) {
      try {
        // Compress image
        const compressed = await imageCompression.compressImage(images[i].buffer, {
          targetSize: 500000
        });

        await db.updateExtractionJobProgress(jobId, null, {
          images_compressed: i + 1
        });

        // Upload to CDN
        const cdnResult = await uploadcare.uploadImageFromBuffer(
          compressed,
          images[i].filename,
          { extracted_from: 'PDF' }
        );

        await db.updateExtractionJobProgress(jobId, null, {
          images_uploaded: i + 1
        });

        processedImages.push({
          originalFilename: images[i].filename,
          cdnId: cdnResult.cdnId,
          cdnUrl: cdnResult.cdnUrl,
          cdnFilename: cdnResult.filename
        });
      } catch (error) {
        console.error(`Failed to process image ${images[i].filename}:`, error);
      }
    }

    return processedImages;
  }

  /**
   * Create extraction job record
   */
  async createJob(restaurantId, filename, fileSize, config, organisationId) {
    const jobId = this.generateJobId();

    return await db.createPDFExtractionJob(
      restaurantId,
      filename,
      fileSize,
      0,  // page count (will be updated)
      config,
      organisationId
    );
  }

  /**
   * Update job progress
   */
  updateProgress(jobId, progress) {
    // WebSocket notification (if connected)
    if (this.activeJobs.has(jobId)) {
      const ws = this.activeJobs.get(jobId);
      ws.send(JSON.stringify({ type: 'progress', data: progress }));
    }

    // Database update
    return db.updateExtractionJobProgress(jobId, progress);
  }

  /**
   * Generate unique job ID
   */
  generateJobId() {
    return `pdf_${Date.now()}_${uuidv4().slice(0, 8)}`;
  }

  /**
   * Validate extracted data
   */
  async validateExtractedData(menuData) {
    const errors = [];

    // Check for missing prices
    const itemsWithoutPrices = menuData.items.filter(item => !item.price);
    if (itemsWithoutPrices.length > 0) {
      errors.push({
        type: 'missing_field',
        severity: 'warning',
        message: `${itemsWithoutPrices.length} items missing prices`,
        item_ids: itemsWithoutPrices.map(i => i.id)
      });
    }

    // Check for very short descriptions
    const itemsWithShortDesc = menuData.items.filter(
      item => item.description && item.description.length < 10
    );
    if (itemsWithShortDesc.length > 0) {
      errors.push({
        type: 'data_quality',
        severity: 'info',
        message: `${itemsWithShortDesc.length} items have short descriptions`
      });
    }

    return errors;
  }
}

module.exports = new PDFExtractionService();
```

### Key Methods

| Method | Purpose | Returns |
|--------|---------|---------|
| `extractMenuFromPDF()` | Main entry point | `{ jobId, menuId }` |
| `uploadAndExtract()` | Firecrawl API integration | `extractedData` |
| `transformData()` | Convert to DB format | `{ categories, items }` |
| `processImages()` | Compress and upload images | `processedImages[]` |
| `createJob()` | Initialize extraction job | `ExtractionJob` |
| `updateProgress()` | Track progress | `void` |
| `validateExtractedData()` | Data quality checks | `errors[]` |

---

## 2. ImageCompressionService

**Location:** `src/services/image-compression-service.js`

### Purpose
Compress menu item images from source size (6-11MB) to target size (~500KB) while maintaining quality and aspect ratio.

### Class Definition

```javascript
const sharp = require('sharp');
const fs = require('fs').promises;

class ImageCompressionService {
  constructor() {
    this.defaultConfig = {
      targetSize: 500000,     // 500KB
      maxQuality: 95,
      minQuality: 60,
      maxDimension: 2048,
      format: 'jpeg',
      progressive: true
    };
  }

  /**
   * Compress image buffer to target size
   */
  async compressImage(inputBuffer, options = {}) {
    const config = { ...this.defaultConfig, ...options };
    const metadata = await sharp(inputBuffer).metadata();

    // Calculate resize dimensions (if needed)
    const { width, height } = this.calculateDimensions(
      metadata.width,
      metadata.height,
      config.maxDimension
    );

    // Initial compression attempt
    let quality = config.maxQuality;
    let compressed;

    while (quality >= config.minQuality) {
      compressed = await sharp(inputBuffer)
        .resize(width, height, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality, progressive: config.progressive })
        .toBuffer();

      // Check if target size achieved
      if (compressed.length <= config.targetSize) {
        break;
      }

      // Reduce quality and retry
      quality -= 5;
    }

    // Verify final size
    if (compressed.length > config.targetSize * 1.1) {  // 10% tolerance
      console.warn(`Could not achieve target size. Final: ${compressed.length}, Target: ${config.targetSize}`);
    }

    return compressed;
  }

  /**
   * Compress file on disk
   */
  async compressFile(inputPath, outputPath, options = {}) {
    const inputBuffer = await fs.readFile(inputPath);
    const compressed = await this.compressImage(inputBuffer, options);
    await fs.writeFile(outputPath, compressed);

    const inputSize = inputBuffer.length;
    const outputSize = compressed.length;
    const ratio = ((1 - outputSize / inputSize) * 100).toFixed(2);

    return {
      inputSize,
      outputSize,
      compressionRatio: ratio,
      success: true
    };
  }

  /**
   * Batch compress with progress tracking
   */
  async batchCompress(images, progressCallback) {
    const results = [];

    for (let i = 0; i < images.length; i++) {
      try {
        const compressed = await this.compressImage(images[i].buffer);

        results.push({
          index: i,
          filename: images[i].filename,
          originalSize: images[i].buffer.length,
          compressedSize: compressed.length,
          buffer: compressed,
          success: true
        });

        if (progressCallback) {
          progressCallback({ current: i + 1, total: images.length });
        }
      } catch (error) {
        results.push({
          index: i,
          filename: images[i].filename,
          error: error.message,
          success: false
        });
      }
    }

    return results;
  }

  /**
   * Calculate resize dimensions maintaining aspect ratio
   */
  calculateDimensions(width, height, maxDimension) {
    if (width <= maxDimension && height <= maxDimension) {
      return { width, height };
    }

    const aspectRatio = width / height;

    if (width > height) {
      return {
        width: maxDimension,
        height: Math.round(maxDimension / aspectRatio)
      };
    } else {
      return {
        width: Math.round(maxDimension * aspectRatio),
        height: maxDimension
      };
    }
  }

  /**
   * Validate image buffer
   */
  async validateImage(buffer) {
    try {
      const metadata = await sharp(buffer).metadata();

      return {
        valid: true,
        format: metadata.format,
        width: metadata.width,
        height: metadata.height,
        size: buffer.length
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }

  /**
   * Get image metadata
   */
  async getImageMetadata(buffer) {
    const metadata = await sharp(buffer).metadata();

    return {
      format: metadata.format,
      width: metadata.width,
      height: metadata.height,
      space: metadata.space,
      channels: metadata.channels,
      depth: metadata.depth,
      density: metadata.density,
      hasAlpha: metadata.hasAlpha,
      orientation: metadata.orientation
    };
  }

  /**
   * Estimate compression potential
   */
  async estimateCompression(buffer, targetSize) {
    const metadata = await sharp(buffer).metadata();
    const currentSize = buffer.length;
    const targetRatio = targetSize / currentSize;

    // Rough estimate based on typical compression ratios
    const estimatedQuality = Math.max(60, Math.min(95, Math.round(targetRatio * 100)));

    return {
      currentSize,
      targetSize,
      estimatedQuality,
      compressionNeeded: currentSize > targetSize,
      estimatedRatio: ((1 - targetRatio) * 100).toFixed(2) + '%'
    };
  }
}

module.exports = new ImageCompressionService();
```

### Compression Strategy

1. **Analyze Input**: Get dimensions, format, current size
2. **Calculate Resize**: Scale down if > 2048px (maintaining aspect ratio)
3. **Iterative Quality**: Start at 95%, reduce by 5% until target size reached
4. **Format Conversion**: Convert PNG → JPEG, apply progressive encoding
5. **Validation**: Ensure final size within 10% tolerance

### Performance

- **Single Image**: ~500ms for 10MB → 500KB
- **Batch (10 images)**: ~5 seconds (parallel processing)
- **Memory Usage**: ~2x input size (Sharp buffer management)

---

## 3. Existing Services (Extended)

### UploadCareService (Extension)

**New Method: Upload from Buffer**

```javascript
/**
 * Upload image from buffer (not URL)
 */
async uploadImageFromBuffer(buffer, filename, metadata = {}) {
  const formData = new FormData();
  formData.append('UPLOADCARE_PUB_KEY', this.publicKey);
  formData.append('UPLOADCARE_STORE', '1');
  formData.append('file', buffer, filename);

  if (metadata && Object.keys(metadata).length > 0) {
    formData.append('metadata', JSON.stringify(metadata));
  }

  const response = await axios.post(
    `${this.baseUrl}/base/`,
    formData,
    {
      headers: {
        ...formData.getHeaders(),
        ...this.generateAuthHeaders()
      },
      timeout: 60000
    }
  );

  return {
    success: true,
    cdnId: response.data.file,
    cdnUrl: `https://ucarecdn.com/${response.data.file}/`,
    filename: filename,
    size: buffer.length
  };
}
```

### DatabaseService (Extension)

**New Methods for PDF Extraction**

```javascript
/**
 * Create PDF extraction job
 */
async createPDFExtractionJob(restaurantId, filename, fileSize, pageCount, config, organisationId) {
  const jobId = `pdf_${Date.now()}_${uuidv4().slice(0, 8)}`;
  const platformId = await this.getPlatformId('PDF');

  const result = await this.pool.query(`
    INSERT INTO extraction_jobs (
      job_id, restaurant_id, platform_id, url, job_type,
      status, config, pdf_filename, pdf_file_size, pdf_page_count,
      extraction_method, validation_status, organisation_id
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    RETURNING *
  `, [
    jobId, restaurantId, platformId, `local://${filename}`, 'pdf_extraction',
    'pending', JSON.stringify(config), filename, fileSize, pageCount,
    'pdf', 'pending', organisationId
  ]);

  return result.rows[0];
}

/**
 * Save complete PDF extraction
 */
async savePDFExtraction(jobId, restaurantId, menuData, organisationId) {
  const client = await this.pool.connect();

  try {
    await client.query('BEGIN');

    // Insert menu
    const menuResult = await client.query(`
      INSERT INTO menus (restaurant_id, extraction_job_id, platform_id, menu_data, organisation_id)
      VALUES ($1, $2, (SELECT id FROM platforms WHERE name = 'PDF'), $3, $4)
      RETURNING *
    `, [restaurantId, jobId, JSON.stringify({ source: 'PDF' }), organisationId]);

    const menuId = menuResult.rows[0].id;

    // Insert categories
    for (const category of menuData.categories) {
      await client.query(`
        INSERT INTO categories (id, menu_id, name, description, position, organisation_id)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [category.id, menuId, category.name, category.description, category.position, organisationId]);
    }

    // Insert items
    for (const item of menuData.items) {
      await client.query(`
        INSERT INTO menu_items (
          id, category_id, menu_id, name, description, price, tags, metadata, organisation_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        item.id, item.category_id, menuId, item.name, item.description,
        item.price, item.tags, JSON.stringify(item.metadata), organisationId
      ]);
    }

    await client.query('COMMIT');
    return menuResult.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
```

---

## 4. Error Handling Patterns

### Service-Level Error Handling

```javascript
class PDFExtractionService {
  async extractMenuFromPDF(/* ... */) {
    try {
      // Main workflow
    } catch (error) {
      // Categorize error
      if (error.code === 'ECONNREFUSED') {
        throw new ExternalServiceError('Firecrawl API unavailable', { retryable: true });
      } else if (error.response?.status === 400) {
        throw new ValidationError('Invalid PDF format', { details: error.response.data });
      } else {
        throw new InternalError('Extraction failed', { cause: error });
      }
    }
  }
}
```

### Custom Error Classes

```javascript
class ExternalServiceError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'ExternalServiceError';
    this.retryable = options.retryable || false;
    this.retryAfter = options.retryAfter || 5000;
  }
}

class ValidationError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'ValidationError';
    this.details = options.details;
  }
}

class DataQualityError extends Error {
  constructor(message, warnings = []) {
    super(message);
    this.name = 'DataQualityError';
    this.warnings = warnings;
  }
}
```

---

## 5. Testing

### Unit Test Example

```javascript
describe('ImageCompressionService', () => {
  const service = require('./image-compression-service');

  it('compresses large image to target size', async () => {
    const largeImage = await fs.readFile('test/fixtures/10mb-image.jpg');

    const compressed = await service.compressImage(largeImage, {
      targetSize: 500000
    });

    expect(compressed.length).toBeLessThan(550000);  // Within 10%
    expect(compressed.length).toBeGreaterThan(450000);
  });

  it('maintains aspect ratio', async () => {
    const input = await fs.readFile('test/fixtures/wide-image.jpg');
    const inputMeta = await sharp(input).metadata();

    const compressed = await service.compressImage(input);
    const outputMeta = await sharp(compressed).metadata();

    const inputRatio = inputMeta.width / inputMeta.height;
    const outputRatio = outputMeta.width / outputMeta.height;

    expect(Math.abs(inputRatio - outputRatio)).toBeLessThan(0.01);
  });
});
```

### Integration Test Example

```javascript
describe('PDFExtractionService', () => {
  const service = require('./pdf-extraction-service');

  it('extracts menu from PDF successfully', async () => {
    const pdfBuffer = await fs.readFile('test/fixtures/sample-menu.pdf');

    const result = await service.extractMenuFromPDF(
      'test-restaurant-id',
      pdfBuffer,
      'sample-menu.pdf',
      { auto_extract_images: false },
      'test-org-id'
    );

    expect(result.jobId).toBeDefined();
    expect(result.menuId).toBeDefined();

    const menu = await db.getMenu(result.menuId);
    expect(menu.categories.length).toBeGreaterThan(0);
  });
});
```

---

**Last Updated:** October 20, 2025
**Status:** Service specifications complete, ready for implementation
