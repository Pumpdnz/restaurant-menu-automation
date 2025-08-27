# Logo Extraction Optimization Plan

## Current State

### Implementation Overview
The logo extraction system has been updated with:
1. **Multi-candidate selection workflow**: Instead of automatically selecting a logo, we now present multiple candidates to users
2. **New API endpoints**:
   - `/api/website-extraction/logo-candidates` - Returns up to 5 logo candidates
   - `/api/website-extraction/process-selected-logo` - Processes the selected candidate
3. **Enhanced color extraction**: Now extracts 5 colors (primary, secondary, tertiary, accent, background)
4. **Frontend dialog**: Shows candidates with confidence scores, dimensions, and preview images

### Current Problems
1. **Firecrawl is not consistently finding actual logos** - Often returns banners, hero images, or product photos
2. **Small logos are being missed** - The 86x86 Base Pizza logo wasn't found
3. **Confidence scoring is unreliable** - High confidence given to incorrect images

### Current Firecrawl Prompt
```
Your task is to find the restaurant's logo image. Look for these specific patterns:

WHERE TO LOOK (in priority order):
1. The very first image in the header/navigation area
2. Images that appear as clickable links to the homepage
3. Images with 'logo' in their filename, class, id, or alt text
4. SVG files in the header area
5. Images in <a> tags that link to "/" or the homepage
6. The smallest non-icon image in the header (often 50-300px)

[Additional characteristics and exclusions...]
```

## Test Websites and Expected Logos

### 1. Biggies Pizza ✅ (Currently Working)
- **Website**: https://www.biggiespizza.co.nz/
- **Expected Logo**: https://images.squarespace-cdn.com/content/v1/65a5e29740b6451450acc55c/9aa7382e-a7d7-4bd3-9d5d-854fe30407eb/Main%2BLogo%2B-%2BBiggies_Texture_Shadow.png?format=1500w
- **Characteristics**: Squarespace CDN, PNG format, in header

### 2. Smokey Ts ✅ (Currently Working)
- **Website**: https://www.smokeytsbbq.com/
- **Expected Logos**: 
  - https://images.squarespace-cdn.com/content/v1/5c91b804348cd927ada07849/1587892015499-BGHTTSIV9HAJMEDYJ5HE/Smokey+T%27s+Logo+Red+Tagline-01.png
  - https://images.squarespace-cdn.com/content/v1/5c91b804348cd927ada07849/1587892015499-BGHTTSIV9HAJMEDYJ5HE/Smokey+T%27s+Logo+Red+Tagline-01.png?format=750w
- **Characteristics**: Squarespace CDN, has "Logo" in filename

### 3. Saigon Kingdom ❌ (Problematic)
- **Website**: https://www.saigonkingdom.co.nz/
- **Expected Candidates**:
  - https://www.saigonkingdom.co.nz/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Fsaigonlogo.816c8435.png&w=256&q=75
  - https://www.saigonkingdom.co.nz/_next/image?url=%2Fimg%2Ftownoverlay.png&w=640&q=75
  - https://www.saigonkingdom.co.nz/_next/image?url=%2Fimg%2Ffranktonoverlay.png&w=640&q=75
- **Characteristics**: Next.js optimized images, "saigonlogo" in first URL

### 4. Pedros House of Lamb ❌ (Problematic)
- **Website**: https://www.pedros.co.nz/
- **Expected Logo**: https://images.squarespace-cdn.com/content/v1/57f80ba8b8a79bc648bdb494/1491443428719-LJBWZMK7WUDDQ5I6ZQBN/Pedros+Vertical+Font+White+Small.jpg?format=1500w
- **Characteristics**: Squarespace CDN, JPG format, descriptive filename

### 5. Thai Opal ✅ (Currently Working)
- **Website**: https://thaiopal.co.nz/
- **Expected Logo**: https://thaiopal.co.nz/wp-content/uploads/2022/12/Logo-tOPAL.png
- **Characteristics**: WordPress upload, has "Logo" in filename, PNG format

### 6. Gone Burger ❌ (Problematic)
- **Website**: https://www.goneburger.nz/
- **Expected Logo**: https://www.goneburger.nz/wp-content/uploads/2017/02/GBLogo_minpixels.png
- **Characteristics**: WordPress upload, has "Logo" in filename, PNG format

### 7. Romans Kitchen ✅ (Currently Working)
- **Website**: https://romanskitchen.co.nz/
- **Expected Logo**: https://romanskitchen.co.nz/images/119a561fc6ff714c5ff244562292f434.png
- **Characteristics**: Direct image path, PNG format

### 8. Base Pizza ❌ (Most Problematic)
- **Website**: https://www.basepizza.co.nz/
- **Expected Logo**: https://static.wixstatic.com/media/612842_debc78d112f44a46b419de058bda9ec3~mv2.jpg/v1/crop/x_23,y_37,w_1011,h_1013/fill/w_86,h_86,al_c,q_80,usm_0.66_1.00_0.01,enc_avif,quality_auto/_edited_edited_edited.jpg
- **Characteristics**: Wix CDN, very small (86x86), cropped/processed image

## Success Criteria
- **Primary Goal**: Logo URL must appear in the candidates list in 99% of cases
- **Secondary Goal**: Logo should have reasonable confidence score (>50%)
- **Acceptable Trade-off**: Having extra non-logo candidates is fine as long as the real logo is included

## Iteration Plan

### Phase 1: Pattern Analysis
Analyze the working vs non-working cases to identify patterns:

**Working Sites Common Patterns**:
- Direct filename contains "logo"
- Squarespace sites with clear logo images
- WordPress uploads with logo in path

**Non-Working Sites Common Patterns**:
- Very small images (< 100px)
- Wix processed images with complex URLs
- Next.js optimized images
- Images without "logo" in any identifiable attribute

### Phase 2: Prompt Iterations to Test

#### Iteration 1: Focus on ALL Header Images
```
Find ALL images in the header, navigation bar, and top section of the page.
Include every image regardless of size, from tiny icons to large banners.
Special attention to:
- The smallest images in the header (could be 50-150px logos)
- Images that link to the homepage
- Any image before the main content starts
Return ALL header images, sorted by likelihood of being a logo.
```

#### Iteration 2: URL Pattern Matching
```
Find images that match these URL patterns:
- Contains: logo, brand, identity, or the site name
- WordPress: /wp-content/uploads/ paths
- Squarespace: images.squarespace-cdn.com
- Wix: static.wixstatic.com with small dimensions
- Next.js: _next/image or _next/static
Include ALL images from these sources, especially if they're in the header area.
```

#### Iteration 3: Size-Based Comprehensive Search
```
Find ALL images on the page and categorize by size:
- Tiny (< 100px width or height) - could be favicons or small logos
- Small (100-300px) - typical logo size
- Medium (300-600px) - could be larger logos or small banners
- Large (> 600px) - likely banners but include if in header

Return at least one candidate from each size category found in the header/nav area.
```

#### Iteration 4: Multi-Strategy Approach
```
Use multiple strategies to find potential logos:

Strategy 1: Find the FIRST image in the header
Strategy 2: Find the SMALLEST non-icon image in the header
Strategy 3: Find images with 'logo' in URL/class/id/alt
Strategy 4: Find images that are links to homepage
Strategy 5: Find SVG files anywhere on page

Return the top candidate from EACH strategy, even if they overlap.
```

### Phase 3: Testing Methodology

1. **Create test script using MCP Firecrawl**:
   ```javascript
   const testSites = [
     { name: 'Biggies Pizza', url: '...', expected: '...' },
     // ... all test sites
   ];
   
   for (const site of testSites) {
     const result = await mcp__firecrawl__firecrawl_scrape({
       url: site.url,
       formats: [{ type: 'json', prompt: currentPrompt, schema: currentSchema }]
     });
     
     const found = result.candidates.some(c => 
       c.url.includes(site.expected) || 
       normalizeUrl(c.url) === normalizeUrl(site.expected)
     );
     
     console.log(`${site.name}: ${found ? '✅' : '❌'}`);
   }
   ```

2. **Success Metrics**:
   - Coverage: What % of test sites return the correct logo in candidates
   - Position: Average position of correct logo in candidates list
   - False Positives: How many non-logo images are returned

3. **Iterate until achieving 100% coverage on test sites**

### Phase 4: Schema Optimization

Current schema requests specific fields. We may need to adjust to:

```javascript
{
  type: 'object',
  properties: {
    candidates: {
      type: 'array',
      maxItems: 10, // Increase from 5 to ensure coverage
      items: {
        type: 'object',
        properties: {
          url: { type: 'string' },
          confidence: { type: 'number' },
          width: { type: 'number' },
          height: { type: 'number' },
          location: { type: 'string' },
          isInHeader: { type: 'boolean' },
          urlContainsLogo: { type: 'boolean' },
          isTinyImage: { type: 'boolean' }, // < 100px
          extractionStrategy: { type: 'string' }, // Which strategy found it
          // ... other indicators
        }
      }
    }
  }
}
```

### Phase 5: Fallback Strategies

If Firecrawl can't achieve 100% coverage, implement fallbacks:

1. **Direct DOM Inspection**: Use Puppeteer to get ALL images and filter locally
2. **Multiple Firecrawl Attempts**: Try different prompts if first attempt fails
3. **Manual URL Entry**: Allow users to paste logo URL directly
4. **Favicon Fallback**: Use favicon or apple-touch-icon as last resort

## Next Steps

1. **Immediate Action**: Test each prompt iteration using MCP Firecrawl tools
2. **Document Results**: Track which prompts work for which sites
3. **Refine Prompt**: Combine successful strategies from different iterations
4. **Update Code**: Implement the winning prompt and schema
5. **Add Monitoring**: Log which sites fail to find logos for continuous improvement

## Expected Outcome

By systematically testing different prompts and strategies, we should achieve:
- **99%+ coverage** for logo detection across diverse website platforms
- **Reduced false positives** through better targeting
- **Improved user experience** with more relevant candidates
- **Platform-specific handling** for Wix, Squarespace, WordPress, Next.js sites

The key insight is that we don't need perfect accuracy in ranking - we just need the correct logo to appear somewhere in the candidates list for users to select.