# Simplified PDF Menu Processing Plan

**Last Updated:** 2025-10-20
**Restaurant:** Chaat Street (ID: `f2995098-3a86-481e-9cf0-0faf73dcf799`)

---

## Overview

**Goal:** Create a CSV file with CDN image references that can be imported using the existing `import-csv-menu.js` script.

**Simplified Workflow:**
```
PDF Menu → Manual CSV Creation → Image Compression → CDN Upload → CSV Enhancement → Import
```

**No database operations needed** - the import script will handle that automatically.

---

## 3-Phase Implementation

### Phase 1: CSV Creation (Manual)
**Duration:** 2-3 hours
**Goal:** Extract menu data from PDF into CSV format

#### Tasks
1. **Open the PDF menu**
   - Location: `planning/pdf-extraction/chaat-street-new-menu.pdf`
   - Read through all menu sections

2. **Open the reference CSV**
   - Location: `planning/pdf-extraction/Chaat Street_menu.csv`
   - Use this as template for structure

3. **Create draft CSV**
   - Copy column headers from existing CSV
   - For each menu item in PDF:
     - Extract: category, name, price, description, tags
     - Match image filename to menu item name
     - Leave CDN columns blank for now (we'll fill these in Phase 3)

**CSV Columns (leave CDN columns blank for now):**
```csv
menuID,menuName,menuDisplayName,menuDescription,categoryID,categoryName,categoryDisplayName,categoryDescription,dishID,dishName,dishPrice,dishType,dishDescription,displayName,printName,tags,isCDNImage,imageCDNID,imageCDNFilename,imageExternalURL
```

**Save as:** `scripts/pdf-menu-processing/draft-menu.csv`

---

### Phase 2: Image Processing
**Duration:** 1 hour
**Goal:** Compress images and upload to CDN

#### Step 2.1: Compress Images

Create `scripts/pdf-menu-processing/compress-images.js`:

```javascript
#!/usr/bin/env node
const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');
const glob = require('glob');

async function compressImage(inputPath, outputPath, quality = 85) {
  const stats = await fs.stat(inputPath);
  const originalSize = stats.size;

  let image = sharp(inputPath);
  const metadata = await image.metadata();

  // Resize if too large
  if (metadata.width > 1920) {
    image = image.resize(1920, null, { withoutEnlargement: true, fit: 'inside' });
  }

  // Compress
  image = image.jpeg({ quality, progressive: true, mozjpeg: true });
  await image.toFile(outputPath);

  const compressedSize = (await fs.stat(outputPath)).size;

  // If still > 1MB, reduce quality and retry
  if (compressedSize > 1048576 && quality > 50) {
    console.log(`  Reducing quality to ${quality - 10}...`);
    return compressImage(inputPath, outputPath, quality - 10);
  }

  return {
    originalSize,
    compressedSize,
    ratio: ((originalSize - compressedSize) / originalSize * 100).toFixed(1)
  };
}

async function main() {
  const inputDir = process.argv[2] || '../../planning/pdf-extraction/chaat-street-photos';
  const outputDir = process.argv[3] || './compressed-images';

  await fs.mkdir(outputDir, { recursive: true });

  const images = glob.sync(path.join(inputDir, '*.{jpg,jpeg,JPG}'));
  console.log(`Found ${images.length} images\n`);

  let totalOriginal = 0, totalCompressed = 0;

  for (let i = 0; i < images.length; i++) {
    const inputPath = images[i];
    const filename = path.basename(inputPath);
    const outputPath = path.join(outputDir, filename);

    process.stdout.write(`[${i + 1}/${images.length}] ${filename}... `);

    const result = await compressImage(inputPath, outputPath);
    totalOriginal += result.originalSize;
    totalCompressed += result.compressedSize;

    console.log(`${(result.originalSize / 1024 / 1024).toFixed(1)}MB → ${(result.compressedSize / 1024).toFixed(0)}KB (${result.ratio}% saved)`);
  }

  console.log(`\n✅ Total: ${(totalOriginal / 1024 / 1024).toFixed(1)}MB → ${(totalCompressed / 1024 / 1024).toFixed(1)}MB (${((totalOriginal - totalCompressed) / totalOriginal * 100).toFixed(1)}% saved)`);
}

main().catch(console.error);
```

**Run:**
```bash
cd scripts/pdf-menu-processing
node compress-images.js
```

#### Step 2.2: Upload to CDN

Create `scripts/pdf-menu-processing/upload-to-cdn.js`:

```javascript
#!/usr/bin/env node
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const glob = require('glob');

const UPLOADCARE_PUBLIC_KEY = process.env.UPLOADCARE_PUBLIC_KEY;
const UPLOADCARE_SECRET_KEY = process.env.UPLOADCARE_SECRET_KEY;

async function uploadImage(imageUrl, filename) {
  const formData = new URLSearchParams();
  formData.append('pub_key', UPLOADCARE_PUBLIC_KEY);
  formData.append('source_url', imageUrl);
  formData.append('store', '1');
  formData.append('filename', filename);

  const response = await axios.post('https://upload.uploadcare.com/from_url/', formData);

  // Wait for upload to complete
  if (response.data.token) {
    return await pollUploadStatus(response.data.token);
  }

  return {
    uuid: response.data.uuid,
    original_filename: response.data.original_filename
  };
}

async function pollUploadStatus(token, maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    const response = await axios.get(`https://upload.uploadcare.com/from_url/status/?token=${token}`);

    if (response.data.status === 'success') {
      return response.data;
    } else if (response.data.status === 'error') {
      throw new Error(response.data.error);
    }

    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  throw new Error('Upload timeout');
}

function sanitizeFilename(filename, categoryName = '') {
  const baseName = path.basename(filename, path.extname(filename));
  const slug = baseName.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  if (categoryName) {
    const categorySlug = categoryName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    return `${categorySlug}-${slug}.jpg`;
  }

  return `${slug}.jpg`;
}

async function main() {
  const inputDir = process.argv[2] || './compressed-images';
  const images = glob.sync(path.join(inputDir, '*.{jpg,jpeg,JPG}'));

  console.log(`Found ${images.length} compressed images\n`);

  const mapping = {};

  for (let i = 0; i < images.length; i++) {
    const imagePath = images[i];
    const filename = path.basename(imagePath);
    const sanitized = sanitizeFilename(filename);

    process.stdout.write(`[${i + 1}/${images.length}] Uploading ${filename}... `);

    try {
      const result = await uploadImage(imagePath, sanitized);

      mapping[filename] = {
        cdn_id: result.uuid,
        cdn_url: `https://ucarecdn.com/${result.uuid}/`,
        cdn_filename: sanitized,
        uploaded_at: new Date().toISOString()
      };

      console.log(`✓ ${result.uuid}`);
    } catch (error) {
      console.log(`✗ ${error.message}`);
    }

    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  // Save mapping
  await fs.writeFile('./cdn-mapping.json', JSON.stringify(mapping, null, 2));
  console.log(`\n✅ Uploaded ${Object.keys(mapping).length}/${images.length} images`);
  console.log('📄 Mapping saved to: ./cdn-mapping.json');
}

main().catch(console.error);
```

**Run:**
```bash
node upload-to-cdn.js
```

---

### Phase 3: CSV Enhancement
**Duration:** 30 minutes
**Goal:** Add CDN references to CSV

Create `scripts/pdf-menu-processing/enhance-csv-with-cdn.js`:

```javascript
#!/usr/bin/env node
const fs = require('fs').promises;
const { parse } = require('csv-parse/sync');
const { stringify } = require('csv-stringify/sync');

async function main() {
  const csvPath = process.argv[2] || './draft-menu.csv';
  const mappingPath = process.argv[3] || './cdn-mapping.json';
  const outputPath = process.argv[4] || './final-menu-with-cdn.csv';

  // Load CSV
  const csvContent = await fs.readFile(csvPath, 'utf8');
  const items = parse(csvContent, { columns: true, skip_empty_lines: true });
  console.log(`Loaded ${items.length} items from CSV`);

  // Load CDN mapping
  const mapping = JSON.parse(await fs.readFile(mappingPath, 'utf8'));
  console.log(`Loaded ${Object.keys(mapping).length} CDN uploads\n`);

  // Build image lookup by dish name
  const imageByName = {};
  for (const [filename, cdnData] of Object.entries(mapping)) {
    // Extract dish name from filename (e.g., "JHOL MOMO-1.jpg" → "jhol momo")
    const baseName = filename.replace(/[-\d]+\.(jpg|jpeg|JPG|JPEG)$/i, '').trim().toLowerCase();
    imageByName[baseName] = cdnData;
  }

  // Enhance CSV with CDN references
  let enhanced = 0;
  for (const item of items) {
    const dishNameLower = item.dishName.toLowerCase();

    // Try exact match
    let cdnData = imageByName[dishNameLower];

    // Try fuzzy match
    if (!cdnData) {
      for (const [imageName, data] of Object.entries(imageByName)) {
        if (imageName.includes(dishNameLower) || dishNameLower.includes(imageName)) {
          cdnData = data;
          console.log(`Fuzzy match: "${item.dishName}" → "${imageName}"`);
          break;
        }
      }
    }

    if (cdnData) {
      item.isCDNImage = 'TRUE';
      item.imageCDNID = cdnData.cdn_id;
      item.imageCDNFilename = cdnData.cdn_filename;
      item.imageExternalURL = '';
      enhanced++;
    } else {
      item.isCDNImage = 'FALSE';
      item.imageCDNID = '';
      item.imageCDNFilename = '';
      item.imageExternalURL = '';
    }
  }

  // Write enhanced CSV
  const output = stringify(items, {
    header: true,
    columns: [
      'menuID', 'menuName', 'menuDisplayName', 'menuDescription',
      'categoryID', 'categoryName', 'categoryDisplayName', 'categoryDescription',
      'dishID', 'dishName', 'dishPrice', 'dishType', 'dishDescription',
      'displayName', 'printName', 'tags',
      'isCDNImage', 'imageCDNID', 'imageCDNFilename', 'imageExternalURL'
    ]
  });

  await fs.writeFile(outputPath, output);

  console.log(`\n✅ Enhanced ${enhanced}/${items.length} items with CDN references`);
  console.log(`📄 Final CSV saved to: ${outputPath}`);
}

main().catch(console.error);
```

**Run:**
```bash
node enhance-csv-with-cdn.js
```

---

## Complete Workflow

### Setup (One-time)

```bash
# Create directory
mkdir -p scripts/pdf-menu-processing
cd scripts/pdf-menu-processing

# Install dependencies
npm install sharp axios csv-parse csv-stringify

# Set environment variables
echo "UPLOADCARE_PUBLIC_KEY=f4394631faa29564fd1d" >> .env
echo "UPLOADCARE_SECRET_KEY=<your-secret>" >> .env
```

### Execution

```bash
cd scripts/pdf-menu-processing

# Step 1: Create draft CSV manually
# - Open: ../../planning/pdf-extraction/chaat-street-new-menu.pdf
# - Reference: ../../planning/pdf-extraction/Chaat Street_menu.csv
# - Create: ./draft-menu.csv

# Step 2: Compress images
node compress-images.js

# Step 3: Upload to CDN
node upload-to-cdn.js

# Step 4: Enhance CSV with CDN references
node enhance-csv-with-cdn.js

# Step 5: Use existing import script
cd ../restaurant-registration
node import-csv-menu.js \
  --email chaat.street@example.com \
  --csv ../pdf-menu-processing/final-menu-with-cdn.csv
```

---

## Deliverables

After completion, you'll have:

1. ✅ `compressed-images/` - 13 compressed images (~500KB each)
2. ✅ `cdn-mapping.json` - CDN upload results
3. ✅ `final-menu-with-cdn.csv` - Ready-to-import CSV with CDN references

The import script (`import-csv-menu.js`) will:
- Create menu records in database
- Create category records
- Create menu item records
- Create item image records with CDN references
- Upload CSV to Pumpd dashboard

---

## Timeline

| Phase | Duration | Output |
|-------|----------|--------|
| Phase 1: Manual CSV creation | 2-3 hours | draft-menu.csv |
| Phase 2: Image compression | 15 seconds | compressed-images/ |
| Phase 2: CDN upload | 30 seconds | cdn-mapping.json |
| Phase 3: CSV enhancement | 5 seconds | final-menu-with-cdn.csv |
| **Total** | **2-3 hours** | Ready-to-import CSV |

**Most of the time is manual data entry from PDF** - the scripts automate everything else.

---

## Validation Checklist

Before running import:

- [ ] CSV has all 20 columns in correct order
- [ ] All items have prices (numeric values)
- [ ] Tags are tilde-separated (e.g., "Halal~Vegan")
- [ ] CDN IDs are UUIDs (36 characters with dashes)
- [ ] CDN filenames end with .jpg or .jpeg
- [ ] isCDNImage is "TRUE" or "FALSE" (uppercase)
- [ ] All compressed images are < 1MB
- [ ] All CDN URLs are accessible in browser

Test CDN URL:
```bash
curl -I https://ucarecdn.com/<your-cdn-id>/
# Should return: HTTP/2 200
```

---

## Next Steps After Import

1. **Verify in Pumpd Dashboard**
   - Login to admin.pumpd.co.nz
   - Check menu appears correctly
   - Verify images load

2. **Test Customer Page**
   - Open customer ordering page
   - Browse categories
   - Test add to cart

3. **Get Restaurant Approval**
   - Have owner review menu
   - Make any necessary corrections
   - Get sign-off for launch

---

## Quick Reference

**Files to Create:**
```
scripts/pdf-menu-processing/
├── compress-images.js          # Image compression
├── upload-to-cdn.js           # CDN upload
├── enhance-csv-with-cdn.js    # CSV enhancement
├── draft-menu.csv             # Manual creation
├── compressed-images/         # Output folder
├── cdn-mapping.json          # CDN results
└── final-menu-with-cdn.csv   # Final output
```

**Environment Variables:**
```bash
UPLOADCARE_PUBLIC_KEY=f4394631faa29564fd1d
UPLOADCARE_SECRET_KEY=<your-secret>
```

**Import Command:**
```bash
cd scripts/restaurant-registration
node import-csv-menu.js \
  --email chaat.street@example.com \
  --csv ../pdf-menu-processing/final-menu-with-cdn.csv
```

---

## Summary

This simplified plan removes all database operations and focuses on creating a CSV file that the existing import script can handle. The workflow is:

1. **Manual:** Extract PDF data → CSV
2. **Automated:** Compress images (15s)
3. **Automated:** Upload to CDN (30s)
4. **Automated:** Add CDN refs to CSV (5s)
5. **Automated:** Import CSV (existing script handles database)

**Total time:** 2-3 hours (mostly manual data entry)
**Total automation:** <1 minute for image processing
**Complexity:** Low - just 3 simple scripts

The import script already handles all database operations, so we just need to prepare a properly formatted CSV with CDN references.
