# Image Editing Automation Options Report

## Requirements
- Background removal
- Crop tool
- Color changing to full black (for thermal printer logos)

## Option 1: Local Python Libraries (Recommended for Control)

### **Rembg + Pillow**
**Pros:**
- Completely free, no API limits
- Works offline, no internet required
- Fast processing (local GPU/CPU)
- Full control over processing

**Cons:**
- Requires installation (~1GB for models)
- Initial setup complexity

**Implementation:**
```python
from rembg import remove
from PIL import Image, ImageOps

# Background removal
output = remove(Image.open('logo.png'))

# Convert to black for thermal printer
grayscale = output.convert('L')
black_logo = grayscale.point(lambda x: 0 if x < 128 else 255, '1')

# Crop to content
bbox = output.getbbox()
cropped = output.crop(bbox)
```

**Installation:** `pip install rembg[cpu] pillow`

## Option 2: MCP Servers (Best for Integration)

### **Available MCP Servers:**
1. **ImageSorcery MCP** - Uses Sharp.js
   - Crop, resize, rotate
   - Background removal via transparency
   - Format conversion

2. **Stability AI MCP** 
   - Background removal
   - Object replacement
   - Upscaling
   - Requires API key (paid)

3. **Image Process MCP**
   - Uses Sharp library
   - Resize, crop, rotate
   - Format conversion
   - Basic color manipulation

**Pros:**
- Direct Claude integration
- Chainable operations
- No code required in workflow

**Cons:**
- Limited to available MCP capabilities
- Some require API keys

## Option 3: Free APIs (Best for Quick Start)

### **Top Free Options:**

| Service | Free Tier | Features | API |
|---------|-----------|----------|-----|
| **Remove.bg** | 50/month | Best quality, automatic | ✅ |
| **Removal.AI** | Unlimited | Good quality, simple | ✅ |
| **Photoroom** | Unlimited | Good quality, editor | ✅ |
| **Pixelcut** | Unlimited | Fast, no signup | ✅ |

**Implementation Example (Remove.bg):**
```javascript
const axios = require('axios');
const FormData = require('form-data');

const formData = new FormData();
formData.append('image_file', fs.createReadStream('logo.png'));

axios.post('https://api.remove.bg/v1.0/removebg', formData, {
  headers: {
    'X-Api-Key': 'YOUR_API_KEY',
  },
  responseType: 'arraybuffer'
})
.then(response => {
  fs.writeFileSync('logo-no-bg.png', response.data);
});
```

## Option 4: Hybrid Approach (Recommended)

### **Workflow Design:**
```
1. Logo Downloaded → 
2. Background Removal (Removal.AI free API) →
3. Local Processing (Node.js Sharp/Jimp):
   - Crop to content
   - Convert to black/white for thermal
   - Resize to standard dimensions
4. Save processed versions
```

### **Implementation with Sharp (Node.js):**
```javascript
const sharp = require('sharp');

// After background removal via API
await sharp('logo-no-bg.png')
  .trim() // Auto-crop transparent pixels
  .resize(300, 300, { fit: 'inside' })
  .grayscale()
  .threshold(128) // Convert to black/white
  .toFile('logo-thermal.png');
```

## Recommended Solution

### **For Pumpd Workflow:**

1. **Install Sharp locally** (already in Node.js ecosystem)
   ```bash
   npm install sharp
   ```

2. **Use Removal.AI API** for background removal (unlimited free)

3. **Create processing script:**
   ```javascript
   // process-logo.js
   const sharp = require('sharp');
   const axios = require('axios');
   
   async function processLogo(inputPath) {
     // 1. Remove background via API
     const noBgPath = await removeBackground(inputPath);
     
     // 2. Create thermal version
     await sharp(noBgPath)
       .trim()
       .resize(200, 200, { fit: 'inside' })
       .grayscale()
       .threshold(128)
       .toFile('logo-thermal.png');
     
     // 3. Create standard version
     await sharp(noBgPath)
       .trim()
       .resize(500, 500, { fit: 'inside' })
       .toFile('logo-standard.png');
   }
   ```

## Implementation Priority

1. **Phase 1:** Add Sharp for local cropping/resizing (immediate)
2. **Phase 2:** Integrate Removal.AI for background removal (next week)
3. **Phase 3:** Add thermal printer conversion (when needed)

## Cost Analysis

- **Local (Rembg):** Free, ~1GB storage
- **MCP Servers:** Free for basic, paid for advanced
- **APIs:** 
  - Remove.bg: 50 free/month, then $0.20/image
  - Removal.AI: Free unlimited
  - Photoroom: Free unlimited
- **Sharp:** Free, lightweight (~30MB)

## Decision Matrix

| Criteria | Local | MCP | API | Hybrid |
|----------|-------|-----|-----|--------|
| Cost | ✅✅✅ | ✅✅ | ✅✅ | ✅✅✅ |
| Speed | ✅✅✅ | ✅✅ | ✅ | ✅✅ |
| Quality | ✅✅ | ✅✅ | ✅✅✅ | ✅✅✅ |
| Ease | ✅ | ✅✅✅ | ✅✅ | ✅✅ |
| Control | ✅✅✅ | ✅ | ✅ | ✅✅ |

## Final Recommendation

**Use Hybrid Approach:**
- **Sharp** (local) for cropping, resizing, thermal conversion
- **Removal.AI** (API) for background removal
- Add as a post-processing step after logo extraction agents
- Create `process-logo.js` script that runs after all agents complete