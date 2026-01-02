/**
 * Logo Extraction Service
 * 
 * Cloud-based logo and brand color extraction from restaurant websites
 * No local file storage - everything processed in memory
 */

const axios = require('axios');
const sharp = require('sharp');
const sharpIco = require('sharp-ico');
const FormData = require('form-data');
const { Vibrant } = require('node-vibrant/node');
const rateLimiter = require('./rate-limiter-service');

// Configuration
const REMOVE_BG_API_KEY = process.env.REMOVE_BG_API_KEY || '';
const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY || '';
const FIRECRAWL_API_URL = process.env.FIRECRAWL_API_URL || 'https://api.firecrawl.dev';

// Timeout configuration (in milliseconds)
const FIRECRAWL_TIMEOUT = 60000; // 60 seconds for Firecrawl API calls
const IMAGE_DOWNLOAD_TIMEOUT = 30000; // 30 seconds for image downloads

/**
 * Extract multiple logo candidates from website using Firecrawl
 */
async function extractLogoCandidatesWithFirecrawl(websiteUrl) {
  try {
    console.log('[Logo Extraction] Finding logo candidates with Firecrawl:', websiteUrl);
    
    // Scrape the website to find all potential logos
    const response = await axios.post(
      `${FIRECRAWL_API_URL}/v2/scrape`,
      {
        url: websiteUrl,
        formats: [{
          type: 'json',
          prompt: `Find ALL possible logo candidates for this restaurant website. Cast a wide net and return everything that could potentially be a logo:

            1. METADATA EXTRACTION:
               - og:image meta tag
               - twitter:image meta tag
               - favicon links
               - apple-touch-icon
               - Any meta images

            2. HEADER/NAV IMAGES:
               - ALL images in <header>, <nav> tags
               - ALL images in the top 400px of the page
               - Images before the main content starts

            3. SMALL IMAGES ANYWHERE:
               - ALL images smaller than 300x300 pixels
               - Especially focus on 50-150px range
               - Include tiny images (even 32x32 favicons)

            4. FILENAME INDICATORS:
               - Images with 'logo' in the URL
               - Images with 'brand' in the URL
               - Images with 'icon' in the URL
               - Images with restaurant name in URL

            5. HOMEPAGE LINKS:
               - Images that are clickable links to '/'
               - Images inside <a> tags pointing to homepage

            6. FIRST APPEARANCES:
               - The first 10 images in DOM order
               - The first image in the visual header

            DO NOT FILTER - Return EVERYTHING that matches ANY criteria above. Maximum 15 candidates, prioritize variety over duplicates.`,
          schema: {
            type: 'object',
            properties: {
              candidates: {
                type: 'array',
                maxItems: 15,
                items: {
                  type: 'object',
                  properties: {
                    url: { type: 'string', description: 'Direct URL to the image' },
                    confidence: { type: 'number', description: '0-100 confidence score' },
                    width: { type: 'number', description: 'Width in pixels' },
                    height: { type: 'number', description: 'Height in pixels' },
                    location: { type: 'string', description: 'Where on page (header/nav/footer/content)' },
                    isGraphic: { type: 'boolean', description: 'True if graphic/illustration, false if photo' },
                    hasLogoIndicators: { type: 'boolean', description: 'Has logo in filename/class/id' },
                    altText: { type: 'string', description: 'Alt text if available' },
                    format: { type: 'string', description: 'Image format (svg/png/jpg/etc)' },
                    reason: { type: 'string', description: 'Why this might be the logo' }
                  }
                }
              },
              fallbackOptions: {
                type: 'object',
                properties: {
                  ogImage: { type: 'string', description: 'Open Graph image URL' },
                  favicon: { type: 'string', description: 'Favicon URL' },
                  appleTouchIcon: { type: 'string', description: 'Apple touch icon URL' }
                }
              }
            }
          }
        }],
        waitFor: 3000
      },
      {
        headers: {
          'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.data?.data?.json) {
      const data = response.data.data.json;
      
      // Filter and validate candidates
      let validCandidates = [];
      
      if (data.candidates && Array.isArray(data.candidates)) {
        validCandidates = data.candidates.filter(candidate => {
          // Additional validation
          if (candidate.width && candidate.height) {
            const aspectRatio = candidate.width / candidate.height;
            // Skip extremely wide images that are likely banners
            if (candidate.width > 800 && aspectRatio > 4) {
              console.log('[Logo Extraction] Skipping banner-like image:', candidate.url);
              return false;
            }
          }
          return true;
        }).map(candidate => {
          // Resolve relative URLs to absolute
          if (candidate.url && !candidate.url.startsWith('http')) {
            try {
              const baseUrl = new URL(websiteUrl);
              const absoluteUrl = new URL(candidate.url, baseUrl).href;
              console.log('[Logo Extraction] Resolved relative URL:', candidate.url, '->', absoluteUrl);
              return { ...candidate, url: absoluteUrl };
            } catch (error) {
              console.log('[Logo Extraction] Failed to resolve URL:', candidate.url);
              return candidate;
            }
          }
          return candidate;
        });
      }
      
      // Add fallback options if no good candidates
      if (validCandidates.length === 0 && data.fallbackOptions) {
        const resolveUrl = (url) => {
          if (!url) return null;
          if (url.startsWith('http')) return url;
          try {
            const baseUrl = new URL(websiteUrl);
            return new URL(url, baseUrl).href;
          } catch {
            return url;
          }
        };
        
        if (data.fallbackOptions.ogImage) {
          const resolvedUrl = resolveUrl(data.fallbackOptions.ogImage);
          if (resolvedUrl) {
            validCandidates.push({
              url: resolvedUrl,
              confidence: 30,
              location: 'metadata',
              reason: 'Open Graph image (fallback)',
              format: 'unknown'
            });
          }
        }
        if (data.fallbackOptions.appleTouchIcon) {
          const resolvedUrl = resolveUrl(data.fallbackOptions.appleTouchIcon);
          if (resolvedUrl) {
            validCandidates.push({
              url: resolvedUrl,
              confidence: 25,
              location: 'metadata',
              reason: 'Apple touch icon (fallback)',
              format: 'png'
            });
          }
        }
        if (data.fallbackOptions.favicon) {
          const resolvedUrl = resolveUrl(data.fallbackOptions.favicon);
          if (resolvedUrl) {
            validCandidates.push({
              url: resolvedUrl,
              confidence: 20,
              location: 'metadata',
              reason: 'Favicon (fallback)',
              format: 'ico'
            });
          }
        }
      }
      
      console.log('[Logo Extraction] Found', validCandidates.length, 'logo candidates');
      return validCandidates;
    }

    return [];
  } catch (error) {
    console.error('[Logo Extraction] Firecrawl error:', error.message);
    return [];
  }
}

/**
 * Extract branding information using Firecrawl's branding format
 * This uses the new 'branding' format which provides accurate colors, logo, and metadata
 * @param {string} sourceUrl - The URL to extract branding from
 * @returns {Object} Branding data including logo, colors, and metadata
 */
async function extractBrandingWithFirecrawl(sourceUrl) {
  try {
    console.log('[Branding Extraction] Starting extraction from:', sourceUrl);

    // Acquire rate limiter slot before making the request
    await rateLimiter.acquireSlot(`branding-${sourceUrl}`);

    const response = await axios.post(
      `${FIRECRAWL_API_URL}/v2/scrape`,
      {
        url: sourceUrl,
        formats: ['branding'],
        waitFor: 3000
      },
      {
        headers: {
          'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: FIRECRAWL_TIMEOUT
      }
    );

    if (!response.data?.data?.branding) {
      console.log('[Branding Extraction] No branding data returned');
      return {
        success: false,
        error: 'No branding data returned from Firecrawl'
      };
    }

    const branding = response.data.data.branding;
    const metadata = response.data.data.metadata || {};

    // Map Firecrawl colors to our schema
    // "primary" -> primary_color
    // "accent" -> secondary_color
    // "textPrimary" -> tertiary_color
    // "buttonSecondary.background" -> accent_color (if present)
    // "background" -> background_color
    const colors = {
      primaryColor: branding.colors?.primary || null,
      secondaryColor: branding.colors?.accent || null,
      tertiaryColor: branding.colors?.textPrimary || null,
      accentColor: branding.components?.buttonSecondary?.background || null,
      backgroundColor: branding.colors?.background || null,
      // Theme from colorScheme (Firecrawl returns "light" or "dark")
      theme: branding.colorScheme || 'light'
    };

    // Extract images
    const images = {
      logoUrl: branding.images?.logo || null,
      faviconUrl: branding.images?.favicon || null,
      ogImageUrl: branding.images?.ogImage || metadata['og:image'] || metadata.ogImage || null
    };

    // Extract metadata for OG fields
    const extractedMetadata = {
      ogTitle: metadata['og:title'] || metadata.ogTitle || metadata.title || null,
      ogDescription: metadata['og:description'] || metadata.ogDescription || metadata.description || null,
      ogSiteName: metadata['og:site_name'] || metadata.ogSiteName || null
    };

    // Get LLM reasoning for confidence
    const confidence = branding.__llm_logo_reasoning?.confidence || 0;
    const logoReasoning = branding.__llm_logo_reasoning?.reasoning || null;

    console.log('[Branding Extraction] Extracted successfully:', {
      hasLogo: !!images.logoUrl,
      hasFavicon: !!images.faviconUrl,
      hasOgImage: !!images.ogImageUrl,
      theme: colors.theme,
      primaryColor: colors.primaryColor,
      confidence
    });

    return {
      success: true,
      colors,
      images,
      metadata: extractedMetadata,
      confidence,
      logoReasoning,
      rawBranding: branding,
      extractedAt: new Date().toISOString()
    };

  } catch (error) {
    console.error('[Branding Extraction] Error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Extract logo URL from website using Firecrawl (legacy - single result)
 */
async function extractLogoUrlWithFirecrawl(websiteUrl) {
  try {
    console.log('[Logo Extraction] Attempting with Firecrawl:', websiteUrl);
    
    // Scrape the website to find logo
    const response = await axios.post(
      `${FIRECRAWL_API_URL}/v2/scrape`,
      {
        url: websiteUrl,
        formats: [{
          type: 'json',
          prompt: `Extract the restaurant's main logo image URL. The logo is typically:
            - Located in the header or navigation area of the page
            - An image with class names containing "logo", "brand", "site-logo", or similar
            - In an element with id containing "logo" or "brand"
            - Often square or rectangular with aspect ratio between 0.5 and 3
            - Usually smaller than 500px in width or height
            - The first suitable image in the header area
            - Has "logo" in the image filename
            
            DO NOT select:
            - Background images or hero banners
            - Social media icons
            - Very wide images (aspect ratio > 3)
            - Gallery or food images
            
            Return the actual logo image URL, not a banner or background image.`,
          schema: {
            type: 'object',
            properties: {
              logoUrl: { type: 'string', description: 'Direct URL to the actual logo image (not banner/background)' },
              logoAlt: { type: 'string', description: 'Alt text of the logo' },
              isInHeader: { type: 'boolean', description: 'Whether the logo is in the header area' },
              hasLogoClass: { type: 'boolean', description: 'Whether the image has logo-related class names' },
              width: { type: 'number', description: 'Width of the logo image' },
              height: { type: 'number', description: 'Height of the logo image' },
              ogImage: { type: 'string', description: 'Open Graph image URL as fallback' },
              faviconUrl: { type: 'string', description: 'Favicon URL as last resort' }
            }
          }
        }],
        waitFor: 3000
      },
      {
        headers: {
          'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.data?.data?.json) {
      const data = response.data.data.json;
      
      // Validate the logo is reasonable
      if (data.logoUrl) {
        // Check aspect ratio if dimensions are provided
        if (data.width && data.height) {
          const aspectRatio = data.width / data.height;
          if (aspectRatio > 4 || aspectRatio < 0.25) {
            console.log('[Logo Extraction] Rejecting logo due to extreme aspect ratio:', aspectRatio);
            // Try fallbacks
            const logoUrl = data.ogImage || data.faviconUrl;
            if (logoUrl) {
              console.log('[Logo Extraction] Using fallback:', logoUrl);
              return logoUrl;
            }
          }
        }
        
        console.log('[Logo Extraction] Found logo URL:', data.logoUrl);
        console.log('[Logo Extraction] Logo details:', {
          inHeader: data.isInHeader,
          hasLogoClass: data.hasLogoClass,
          dimensions: data.width && data.height ? `${data.width}x${data.height}` : 'unknown'
        });
        return data.logoUrl;
      }
      
      // Fallback to OG image or favicon
      const logoUrl = data.ogImage || data.faviconUrl;
      if (logoUrl) {
        console.log('[Logo Extraction] Using fallback logo URL:', logoUrl);
        return logoUrl;
      }
    }
    
    console.log('[Logo Extraction] No logo found with Firecrawl');
    return null;
  } catch (error) {
    console.error('[Logo Extraction] Firecrawl error:', error.message);
    return null;
  }
}

/**
 * Extract logo URL from website using Puppeteer (fallback)
 */
async function extractLogoUrlWithPuppeteer(websiteUrl) {
  // This would use mcp__puppeteer if available
  // For now, returning null as this is a fallback
  console.log('[Logo Extraction] Puppeteer fallback not yet implemented');
  return null;
}

/**
 * Download image from URL to buffer
 */
async function downloadImageToBuffer(imageUrl, websiteUrl) {
  try {
    console.log('[Logo Extraction] Downloading image:', imageUrl);

    // Handle relative URLs
    let fullUrl = imageUrl;
    if (!imageUrl.startsWith('http')) {
      const baseUrl = new URL(websiteUrl);
      fullUrl = new URL(imageUrl, baseUrl.origin).href;
    }

    const response = await axios.get(fullUrl, {
      responseType: 'arraybuffer',
      timeout: IMAGE_DOWNLOAD_TIMEOUT,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; LogoExtractor/1.0)'
      }
    });

    return Buffer.from(response.data);
  } catch (error) {
    console.error('[Logo Extraction] Download error:', error.message);
    throw error;
  }
}

/**
 * Extract colors from logo image
 */
async function extractColorsFromLogo(logoBuffer) {
  try {
    console.log('[Logo Extraction] Extracting colors from logo');
    
    // Convert to PNG for color analysis
    const pngBuffer = await sharp(logoBuffer)
      .png()
      .toBuffer();
    
    // Use Vibrant to get color palette
    const palette = await Vibrant.from(pngBuffer).getPalette();
    
    // Extract colors from palette
    const colors = [];
    const paletteEntries = Object.entries(palette);
    
    for (const [swatchName, swatch] of paletteEntries) {
      if (swatch) {
        // Vibrant returns rgb as array [r, g, b]
        const rgb = swatch.rgb || swatch.getRgb?.() || [0, 0, 0];
        const hex = swatch.hex || swatch.getHex?.() || rgbToHex(rgb);
        const name = getColorName(rgb);
        const isNeutral = isNeutralColor(rgb);
        colors.push({ 
          hex, 
          rgb, 
          name, 
          isNeutral,
          swatchName,
          population: swatch.population || swatch.getPopulation?.() || 0
        });
      }
    }
    
    // Sort by population (prominence in image)
    colors.sort((a, b) => b.population - a.population);
    
    // Filter out neutral colors for brand colors
    const brandColors = colors.filter(c => !c.isNeutral);
    
    // Use Vibrant.js's specific swatches for better color selection
    // Priority: Vibrant > DarkVibrant > Muted > DarkMuted > LightVibrant > LightMuted
    let primaryColor = null;
    let secondaryColor = null;
    let tertiaryColor = null;
    let accentColor = null;
    let backgroundColor = null;
    
    // Primary: Most vibrant color (usually the main brand color)
    if (palette.Vibrant) {
      const rgb = palette.Vibrant.rgb || palette.Vibrant.getRgb?.() || [0, 0, 0];
      primaryColor = {
        hex: palette.Vibrant.hex || palette.Vibrant.getHex?.() || rgbToHex(rgb),
        rgb: rgb,
        name: getColorName(rgb)
      };
    }
    
    // Secondary: Dark vibrant or muted for contrast
    if (palette.DarkVibrant && (!primaryColor || !colorsAreSimilar(primaryColor.rgb, palette.DarkVibrant.rgb))) {
      const rgb = palette.DarkVibrant.rgb || palette.DarkVibrant.getRgb?.() || [0, 0, 0];
      secondaryColor = {
        hex: palette.DarkVibrant.hex || palette.DarkVibrant.getHex?.() || rgbToHex(rgb),
        rgb: rgb,
        name: getColorName(rgb)
      };
    } else if (palette.Muted) {
      const rgb = palette.Muted.rgb || palette.Muted.getRgb?.() || [0, 0, 0];
      secondaryColor = {
        hex: palette.Muted.hex || palette.Muted.getHex?.() || rgbToHex(rgb),
        rgb: rgb,
        name: getColorName(rgb)
      };
    }
    
    // Tertiary: Next best distinct color
    const tertiaryOptions = [palette.Muted, palette.DarkMuted, palette.LightVibrant];
    for (const swatch of tertiaryOptions) {
      if (swatch) {
        const rgb = swatch.rgb || swatch.getRgb?.() || [0, 0, 0];
        const hex = swatch.hex || swatch.getHex?.() || rgbToHex(rgb);
        if (!tertiaryColor && 
            (!primaryColor || !colorsAreSimilar(primaryColor.rgb, rgb)) &&
            (!secondaryColor || !colorsAreSimilar(secondaryColor.rgb, rgb))) {
          tertiaryColor = { hex, rgb, name: getColorName(rgb) };
          break;
        }
      }
    }
    
    // Accent: Light vibrant for highlights
    if (palette.LightVibrant) {
      const rgb = palette.LightVibrant.rgb || palette.LightVibrant.getRgb?.() || [0, 0, 0];
      accentColor = {
        hex: palette.LightVibrant.hex || palette.LightVibrant.getHex?.() || rgbToHex(rgb),
        rgb: rgb,
        name: getColorName(rgb)
      };
    }
    
    // Background: Light muted or most prominent neutral
    if (palette.LightMuted) {
      const rgb = palette.LightMuted.rgb || palette.LightMuted.getRgb?.() || [255, 255, 255];
      backgroundColor = {
        hex: palette.LightMuted.hex || palette.LightMuted.getHex?.() || rgbToHex(rgb),
        rgb: rgb,
        name: getColorName(rgb)
      };
    } else {
      // Find the most prominent neutral color
      const neutralColors = colors.filter(c => c.isNeutral);
      if (neutralColors.length > 0) {
        backgroundColor = {
          hex: neutralColors[0].hex,
          rgb: neutralColors[0].rgb,
          name: neutralColors[0].name
        };
      }
    }
    
    // Fallback to brand colors if specific swatches weren't found
    if (!primaryColor && brandColors.length > 0) primaryColor = brandColors[0];
    if (!secondaryColor && brandColors.length > 1) secondaryColor = brandColors[1];
    if (!tertiaryColor && brandColors.length > 2) tertiaryColor = brandColors[2];
    if (!accentColor && brandColors.length > 3) accentColor = brandColors[3];
    
    // Determine theme based on dominant color brightness
    const dominantSwatch = palette.Vibrant || palette.DarkVibrant || palette.Muted;
    const dominantRgb = dominantSwatch ? (dominantSwatch.rgb || dominantSwatch.getRgb?.() || [128, 128, 128]) : [128, 128, 128];
    const theme = getBrightness(dominantRgb) > 128 ? 'light' : 'dark';
    
    return {
      dominantColor: primaryColor?.hex,
      palette: colors,
      brandColors,
      primaryColor: primaryColor?.hex,
      secondaryColor: secondaryColor?.hex,
      tertiaryColor: tertiaryColor?.hex,
      accentColor: accentColor?.hex,
      backgroundColor: backgroundColor?.hex,
      theme
    };
  } catch (error) {
    console.error('[Logo Extraction] Color extraction error:', error.message);
    return {
      dominantColor: null,
      palette: [],
      brandColors: [],
      primaryColor: null,
      secondaryColor: null,
      theme: 'light'
    };
  }
}

/**
 * Remove background using Remove.bg API
 */
async function removeBackgroundFromBuffer(imageBuffer) {
  try {
    if (!REMOVE_BG_API_KEY || REMOVE_BG_API_KEY === 'your_api_key_here') {
      console.log('[Logo Extraction] Remove.bg API key not configured');
      return null;
    }

    console.log('[Logo Extraction] Calling Remove.bg API');
    
    const formData = new FormData();
    formData.append('image_file', imageBuffer, {
      filename: 'logo.png',
      contentType: 'image/png'
    });
    formData.append('size', 'regular');
    formData.append('type', 'product');
    formData.append('crop', 'true');
    
    const response = await axios.post('https://api.remove.bg/v1.0/removebg', formData, {
      headers: {
        ...formData.getHeaders(),
        'X-Api-Key': REMOVE_BG_API_KEY,
      },
      responseType: 'arraybuffer'
    });
    
    console.log('[Logo Extraction] Background removed successfully');
    return Buffer.from(response.data);
    
  } catch (error) {
    console.error('[Logo Extraction] Remove.bg API error:', error.response?.data || error.message);
    return null;
  }
}

/**
 * Process logo into different versions
 * @param {Buffer} logoBuffer - The logo image buffer
 * @param {Object} options - Processing options
 * @param {boolean} options.skipFavicon - Skip favicon generation if already have one from Firecrawl
 */
async function processLogoVersions(logoBuffer, options = {}) {
  const versions = {};
  const { skipFavicon = false } = options;

  try {
    // Get metadata
    let workingBuffer = logoBuffer;

    // Check for ICO format first (by magic bytes) since sharp doesn't support it
    const isIcoMagic = logoBuffer.length >= 4 &&
      logoBuffer[0] === 0 && logoBuffer[1] === 0 &&
      logoBuffer[2] === 1 && logoBuffer[3] === 0;

    if (isIcoMagic) {
      try {
        console.log('[Logo Extraction] Detected ICO format, converting to PNG');
        const images = sharpIco.sharpsFromIco(logoBuffer);
        if (images && images.length > 0) {
          // Get the largest image (last in array)
          const largestImage = images[images.length - 1];
          workingBuffer = await largestImage.png().toBuffer();
          console.log('[Logo Extraction] Successfully converted ICO to PNG');
        }
      } catch (icoError) {
        console.error('[Logo Extraction] ICO conversion failed:', icoError.message);
      }
    }

    let metadata = await sharp(workingBuffer).metadata();
    console.log('[Logo Extraction] Processing logo versions:', metadata, { skipFavicon });

    // Pre-convert problematic formats (HEIF/AVIF/SVG) to PNG for compatibility
    const problematicFormats = ['heif', 'avif', 'svg'];

    if (problematicFormats.includes(metadata.format)) {
      try {
        console.log(`[Logo Extraction] Converting ${metadata.format.toUpperCase()} to PNG for processing`);
        workingBuffer = await sharp(workingBuffer)
          .png()
          .toBuffer();
        metadata = await sharp(workingBuffer).metadata();
        console.log(`[Logo Extraction] Successfully converted to PNG`);
      } catch (conversionError) {
        console.error(`[Logo Extraction] Failed to convert ${metadata.format}:`, conversionError.message);
        // Keep original buffer but log the issue
      }
    }

    // 1. Original (as base64) - use the converted buffer if available
    versions.original = `data:image/${metadata.format};base64,${workingBuffer.toString('base64')}`;
    
    // 2. Standard (500x500, maintaining aspect ratio)
    const standardBuffer = await sharp(workingBuffer)
      .resize(500, 500, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 0 }
      })
      .png()
      .toBuffer();
    versions.standard = `data:image/png;base64,${standardBuffer.toString('base64')}`;

    // 3. No Background version
    try {
      // Check if already transparent
      const hasAlpha = metadata.hasAlpha || metadata.channels === 4;

      if (hasAlpha) {
        // Already transparent, just trim
        const noBgBuffer = await sharp(workingBuffer)
          .trim()
          .png()
          .toBuffer();
        versions.nobg = `data:image/png;base64,${noBgBuffer.toString('base64')}`;
        console.log('[Logo Extraction] Logo already transparent, trimmed edges');
      } else {
        // Try to use Remove.bg API
        const noBgBuffer = await removeBackgroundFromBuffer(workingBuffer);
        
        if (noBgBuffer) {
          // Successfully removed background, apply trim to remove any remaining whitespace
          const trimmedBuffer = await sharp(noBgBuffer)
            .trim()
            .png()
            .toBuffer();
          versions.nobg = `data:image/png;base64,${trimmedBuffer.toString('base64')}`;
          console.log('[Logo Extraction] Background removed via API and trimmed');
        } else {
          // API failed or not configured, use original
          console.log('[Logo Extraction] Using original as no-bg version');
          versions.nobg = versions.original;
        }
      }
    } catch (error) {
      console.error('[Logo Extraction] No-bg processing error:', error.message);
      // Fallback to original
      versions.nobg = versions.original;
    }
    
    // 4. Multiple Thermal Versions (265px wide for thermal printers)
    // Create thermal versions from the no-background image if available
    let thermalSourceBuffer;
    if (versions.nobg && versions.nobg !== versions.original) {
      // Extract buffer from the no-bg base64 data URL
      const noBgBase64 = versions.nobg.split(',')[1];
      thermalSourceBuffer = Buffer.from(noBgBase64, 'base64');
    } else {
      thermalSourceBuffer = workingBuffer;
    }
    
    // Resize to 265px wide, maintaining aspect ratio
    const thermalBuffer = await sharp(thermalSourceBuffer)
      .resize(265, null, {
        fit: 'inside',
        withoutEnlargement: false,
        background: { r: 255, g: 255, b: 255, alpha: 0 } // Transparent background
      })
      .ensureAlpha() // Ensure alpha channel exists
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    const { data, info } = thermalBuffer;
    
    // === VERSION 1: Inverted (for light background logos) ===
    // Light pixels become black, dark pixels become light
    const processedDataV1 = Buffer.allocUnsafe(data.length);
    
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      
      if (a === 0) {
        // Keep transparent pixels transparent
        processedDataV1[i] = 0;
        processedDataV1[i + 1] = 0;
        processedDataV1[i + 2] = 0;
        processedDataV1[i + 3] = 0;
      } else {
        // Convert to grayscale
        const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
        
        // Light/white pixels (> 200) become black (will print)
        // Dark pixels become lighter shades of gray (less ink)
        let thermal;
        if (gray > 200) {
          thermal = 0; // Light pixels become black
        } else if (gray > 100) {
          thermal = Math.round((200 - gray) * 0.3); // 0-30 range
        } else {
          thermal = Math.round(100 - (gray * 0.7)); // 30-100 range
        }
        
        processedDataV1[i] = thermal;
        processedDataV1[i + 1] = thermal;
        processedDataV1[i + 2] = thermal;
        processedDataV1[i + 3] = a;
      }
    }
    
    const finalThermalBufferV1 = await sharp(processedDataV1, {
      raw: { width: info.width, height: info.height, channels: 4 }
    }).png().toBuffer();
    
    versions.thermal = `data:image/png;base64,${finalThermalBufferV1.toString('base64')}`;
    
    // === VERSION 2: Standard (for dark background logos like Base Pizza) ===
    // Dark pixels stay dark, light pixels become white
    const processedDataV2 = Buffer.allocUnsafe(data.length);
    
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      
      if (a === 0) {
        // Transparent pixels become white
        processedDataV2[i] = 255;
        processedDataV2[i + 1] = 255;
        processedDataV2[i + 2] = 255;
        processedDataV2[i + 3] = 0;
      } else {
        const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
        
        // Dark pixels (< 100) stay black
        // Light pixels become white
        let thermal;
        if (gray < 100) {
          thermal = 0; // Dark stays dark
        } else if (gray < 200) {
          thermal = Math.round((gray - 100) * 1.5); // 0-150 range
        } else {
          thermal = 255; // Light becomes white
        }
        
        processedDataV2[i] = thermal;
        processedDataV2[i + 1] = thermal;
        processedDataV2[i + 2] = thermal;
        processedDataV2[i + 3] = a;
      }
    }
    
    const finalThermalBufferV2 = await sharp(processedDataV2, {
      raw: { width: info.width, height: info.height, channels: 4 }
    }).png().toBuffer();
    
    versions.thermal_alt = `data:image/png;base64,${finalThermalBufferV2.toString('base64')}`;
    
    // === VERSION 3: High Contrast (simple black/white threshold) ===
    // Pure binary: dark < 128 = black, light >= 128 = white
    const processedDataV3 = Buffer.allocUnsafe(data.length);
    
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      
      if (a === 0) {
        // Transparent becomes white
        processedDataV3[i] = 255;
        processedDataV3[i + 1] = 255;
        processedDataV3[i + 2] = 255;
        processedDataV3[i + 3] = 0;
      } else {
        const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
        // Simple threshold at 128
        const thermal = gray < 128 ? 0 : 255;
        
        processedDataV3[i] = thermal;
        processedDataV3[i + 1] = thermal;
        processedDataV3[i + 2] = thermal;
        processedDataV3[i + 3] = a;
      }
    }
    
    const finalThermalBufferV3 = await sharp(processedDataV3, {
      raw: { width: info.width, height: info.height, channels: 4 }
    }).png().toBuffer();
    
    versions.thermal_contrast = `data:image/png;base64,${finalThermalBufferV3.toString('base64')}`;
    
    // === VERSION 4: Adaptive (preserves mid-tones) ===
    // Keeps more grayscale levels for better detail
    const processedDataV4 = Buffer.allocUnsafe(data.length);
    
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      
      if (a === 0) {
        // Transparent becomes white
        processedDataV4[i] = 255;
        processedDataV4[i + 1] = 255;
        processedDataV4[i + 2] = 255;
        processedDataV4[i + 3] = 0;
      } else {
        const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
        
        // Adaptive levels with more gradation
        let thermal;
        if (gray < 64) {
          thermal = 0; // Very dark = black
        } else if (gray < 128) {
          thermal = Math.round((gray - 64) * 0.5); // Dark gray (0-32)
        } else if (gray < 192) {
          thermal = Math.round(32 + (gray - 128) * 2.875); // Medium gray (32-216)
        } else {
          thermal = 255; // Light = white
        }
        
        processedDataV4[i] = thermal;
        processedDataV4[i + 1] = thermal;
        processedDataV4[i + 2] = thermal;
        processedDataV4[i + 3] = a;
      }
    }
    
    const finalThermalBufferV4 = await sharp(processedDataV4, {
      raw: { width: info.width, height: info.height, channels: 4 }
    }).png().toBuffer();
    
    versions.thermal_adaptive = `data:image/png;base64,${finalThermalBufferV4.toString('base64')}`;

    // 5. Favicon (32x32) - skip if Firecrawl already provided one
    if (!skipFavicon) {
      const faviconBuffer = await sharp(workingBuffer)
        .resize(32, 32, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 0 }
        })
        .png()
        .toBuffer();
      versions.favicon = `data:image/png;base64,${faviconBuffer.toString('base64')}`;
    } else {
      console.log('[Logo Extraction] Skipping favicon generation (provided by Firecrawl)');
    }

    return versions;
  } catch (error) {
    console.error('[Logo Extraction] Processing error:', error.message);
    // Return at least the original with correct MIME type detection
    try {
      const fallbackMetadata = await sharp(logoBuffer).metadata();
      return {
        original: `data:image/${fallbackMetadata.format || 'png'};base64,${logoBuffer.toString('base64')}`
      };
    } catch {
      // If even metadata fails, use generic octet-stream
      return {
        original: `data:application/octet-stream;base64,${logoBuffer.toString('base64')}`
      };
    }
  }
}

/**
 * Helper functions
 */

function rgbToHex(rgb) {
  return '#' + rgb.map(c => c.toString(16).padStart(2, '0')).join('');
}

function isNeutralColor(rgb) {
  const [r, g, b] = rgb;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const diff = max - min;
  
  // Check if it's a gray (low saturation)
  if (diff < 30) return true;
  
  // Check if it's very dark or very light
  const brightness = (r + g + b) / 3;
  if (brightness < 30 || brightness > 225) return true;
  
  return false;
}

function getBrightness(rgb) {
  const [r, g, b] = rgb;
  return (r * 299 + g * 587 + b * 114) / 1000;
}

function getColorName(rgb) {
  const [r, g, b] = rgb;
  const brightness = getBrightness(rgb);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const diff = max - min;
  
  // Check for neutrals
  if (diff < 30) {
    if (brightness < 60) return 'Black';
    if (brightness > 200) return 'White';
    return 'Gray';
  }
  
  // Determine hue - improved logic
  if (r >= g && r >= b) {
    // Red is dominant
    const greenRatio = g / r;
    if (greenRatio > 0.7) return 'Orange';
    if (greenRatio > 0.5) return 'Red-Orange';
    return 'Red';
  }
  if (g >= r && g >= b) {
    // Green is dominant
    const redRatio = r / g;
    const blueRatio = b / g;
    if (redRatio > 0.7) return 'Yellow-Green';
    if (redRatio > 0.5) return 'Yellow';
    return 'Green';
  }
  if (b >= r && b >= g) {
    // Blue is dominant
    const redRatio = r / b;
    const greenRatio = g / b;
    if (redRatio > 0.7) return 'Purple';
    if (greenRatio > 0.7) return 'Cyan';
    return 'Blue';
  }
  
  return 'Unknown';
}

function colorsAreSimilar(rgb1, rgb2, threshold = 50) {
  if (!rgb1 || !rgb2) return false;
  const [r1, g1, b1] = rgb1;
  const [r2, g2, b2] = rgb2;
  
  const distance = Math.sqrt(
    Math.pow(r1 - r2, 2) + 
    Math.pow(g1 - g2, 2) + 
    Math.pow(b1 - b2, 2)
  );
  
  return distance < threshold;
}

/**
 * Main extraction function
 */
async function extractLogoAndColors(websiteUrl) {
  try {
    console.log('[Logo Extraction] Starting extraction for:', websiteUrl);
    
    // 1. Extract logo URL
    let logoUrl = await extractLogoUrlWithFirecrawl(websiteUrl);
    if (!logoUrl) {
      logoUrl = await extractLogoUrlWithPuppeteer(websiteUrl);
    }
    
    if (!logoUrl) {
      throw new Error('No logo found on website');
    }
    
    // 2. Download logo
    const logoBuffer = await downloadImageToBuffer(logoUrl, websiteUrl);
    
    // 3. Extract colors
    const colors = await extractColorsFromLogo(logoBuffer);
    
    // 4. Process logo versions
    const logoVersions = await processLogoVersions(logoBuffer);
    
    // 5. Return results
    return {
      success: true,
      logoUrl,
      logoVersions,
      colors,
      extractedAt: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('[Logo Extraction] Main extraction error:', error.message);
    return {
      success: false,
      error: error.message,
      extractedAt: new Date().toISOString()
    };
  }
}

module.exports = {
  extractLogoAndColors,
  extractLogoCandidatesWithFirecrawl,
  extractBrandingWithFirecrawl,
  extractLogoUrlWithFirecrawl,
  extractLogoUrlWithPuppeteer,
  downloadImageToBuffer,
  extractColorsFromLogo,
  processLogoVersions
};