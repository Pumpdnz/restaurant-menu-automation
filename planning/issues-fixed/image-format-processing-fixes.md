# Image Format Processing Fixes

**Date:** 2026-01-03
**Session Summary:** Fixed multiple image format processing issues in branding extraction

---

## Issues Addressed

### 1. SVG Logo Not Converting to PNG
**Problem:** When branding extraction retrieved an SVG logo, the main `logo_url` field stored the SVG format while all other logo versions (standard, nobg, thermal, favicon) were correctly converted to PNG.

**Root Cause:** In `logo-extraction-service.js`, line 663 preserved the original format:
```javascript
versions.original = `data:image/${metadata.format};base64,${logoBuffer.toString('base64')}`;
```

**Solution:** Added SVG detection and conversion before saving the original version.

---

### 2. AVIF/HEIF Images Failing to Process
**Problem:** AVIF files (HEIF format with AV1 compression) failed to process into logo versions. Error: `heif: Invalid input: Unspecified: Bitstream not supported by this decoder (2.0)`

**Root Cause:** Sharp's prebuilt binaries only support 8-bit AVIF. The test file was 10-bit (`bitsPerSample: 10`).

**Solution (Local):**
- Installed system libvips via Homebrew: `brew install vips`
- Rebuilt sharp from source to use system libvips with full AVIF support
- Required installing `node-addon-api` and `node-gyp` as dependencies

**Solution (Production):**
- Added fallback code to save original with correct MIME type when processing fails
- Prebuilt sharp handles most common formats; edge cases gracefully degrade

---

### 3. ICO Favicon Files Not Processing
**Problem:** When Firecrawl extracted a `.ico` favicon URL, sharp failed with "Input buffer contains unsupported image format" because sharp doesn't support ICO format.

**Root Cause:** ICO is a container format that can hold multiple images at different sizes. Sharp cannot decode it natively.

**Solution:**
- Installed `sharp-ico` package for ICO decoding
- Added ICO detection by URL extension and magic bytes (`00 00 01 00`)
- Extract largest image from ICO container, convert to PNG, then process

---

## Files Modified

### UberEats-Image-Extractor/src/services/logo-extraction-service.js
- Added `sharp-ico` import
- Added ICO detection by magic bytes before processing
- Added pre-conversion for problematic formats (HEIF/AVIF/SVG) to PNG
- Updated all processing steps to use `workingBuffer` instead of `logoBuffer`
- Fixed catch block to use correct MIME type for fallback

### UberEats-Image-Extractor/src/services/registration-batch-service.js
- Added ICO favicon detection and conversion using sharp-ico
- Handles both URL extension check and magic byte detection

### UberEats-Image-Extractor/server.js
- Added ICO handling to `/api/website-extraction/branding` endpoint favicon processing
- Lines 7623-7672: ICO detection, conversion, and processing

### UberEats-Image-Extractor/package.json
- Added `sharp-ico: ^0.1.5`
- Added `node-addon-api: ^8.5.0` (for local source builds)
- Added `node-gyp: ^11.5.0` (for local source builds)

### Dockerfile
- Reverted to simple prebuilt approach after source build attempts failed
- Removed build dependencies (libvips-dev, libglib2.0-dev, etc.)
- Production uses prebuilt sharp with fallback handling

---

## Technical Details

### ICO Detection Logic
```javascript
// Check by URL extension
const isIcoUrl = faviconUrl.toLowerCase().endsWith('.ico');

// Check by magic bytes (ICO files start with 00 00 01 00)
const isIcoMagic = buffer.length >= 4 &&
  buffer[0] === 0 && buffer[1] === 0 &&
  buffer[2] === 1 && buffer[3] === 0;

if (isIcoUrl || isIcoMagic) {
  const images = sharpIco.sharpsFromIco(buffer);
  // Get largest image (last in array)
  const largestImage = images[images.length - 1];
  processableBuffer = await largestImage.png().toBuffer();
}
```

### Problematic Format Pre-conversion
```javascript
const problematicFormats = ['heif', 'avif', 'svg'];

if (problematicFormats.includes(metadata.format)) {
  workingBuffer = await sharp(workingBuffer).png().toBuffer();
  metadata = await sharp(workingBuffer).metadata();
}
```

### Local Sharp Source Build (macOS)
```bash
# Install system libvips
brew install vips

# Install build dependencies
npm install node-addon-api node-gyp --legacy-peer-deps

# Remove prebuilt and build from source
rm -rf node_modules/sharp
npm install sharp --ignore-scripts --legacy-peer-deps
cd node_modules/sharp && npm run build
```

---

## Environment Differences

| Feature | Local (macOS) | Production (Railway) |
|---------|---------------|---------------------|
| Sharp Build | Source (system vips) | Prebuilt binaries |
| Vips Version | 8.18.0 | Bundled 8.17.x |
| AVIF 10-bit | ✅ Full support | ⚠️ Partial (fallback) |
| ICO Favicon | ✅ Works | ✅ Works |
| SVG Conversion | ✅ Works | ✅ Works |

---

## Dockerfile Decisions

### Attempted (Failed)
Building sharp from source in Docker required:
- `libvips-dev`, `libheif-dev`, `libglib2.0-dev`, `pkg-config`, `build-essential`, `python3`

Failed with: `fatal error: glib-object.h: No such file or directory`

The issue was complex header path discovery on Ubuntu Jammy in the Playwright base image.

### Final Approach
Reverted to simple prebuilt approach:
```dockerfile
RUN npm ci --omit=dev --legacy-peer-deps
```

Rationale:
- Production stability over edge case support
- Fallback code handles unsupported formats gracefully
- 10-bit AVIF logos are rare; most images work fine
- Reduces build complexity and time

---

## Testing

### Local Test for AVIF
```bash
node -e "
const sharp = require('sharp');
console.log('Sharp versions:', sharp.versions);
// Should show vips: '8.18.0' for full support
"
```

### Verify ICO Handling
Test with a `.ico` favicon URL - should see log:
```
[API] Converting ICO favicon to PNG
```

---

## Future Improvements

1. **Consider using a Docker image with vips pre-installed** if full AVIF support becomes critical in production
2. **Monitor fallback occurrences** to understand how often 10-bit AVIF logos are encountered
3. **Alternative CDN formats** - Request PNG versions when AVIF fails (some CDNs support format negotiation)
