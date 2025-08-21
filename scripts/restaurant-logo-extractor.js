#!/usr/bin/env node

/**
 * Restaurant Logo and Brand Color Extractor
 * 
 * This script extracts logos and brand colors from restaurant websites
 * Handles both URL-based and base64-embedded images efficiently
 * 
 * Usage:
 *   node restaurant-logo-extractor.js --url="https://restaurant.com" --name="Restaurant Name" --location="City"
 */

import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const require = createRequire(import.meta.url);
const { chromium } = require('./restaurant-registration/node_modules/playwright');

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Parse command line arguments
const args = process.argv.slice(2);
const getArg = (name) => {
  const arg = args.find(a => a.startsWith(`--${name}=`));
  return arg ? arg.split('=')[1] : null;
};

const websiteUrl = getArg('url');
const restaurantName = getArg('name') || 'restaurant';
const location = getArg('location') || 'unknown';

if (!websiteUrl) {
  console.error('❌ Error: Website URL is required');
  console.log('Usage: node restaurant-logo-extractor.js --url="https://restaurant.com" --name="Restaurant Name" --location="City"');
  process.exit(1);
}

// Sanitize names for file paths
const sanitize = (str) => str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

async function extractLogoAndColors() {
  console.log('🚀 Starting Logo and Brand Color Extraction...\n');
  console.log(`📍 Restaurant: ${restaurantName}`);
  console.log(`🌐 Website: ${websiteUrl}`);
  console.log(`📍 Location: ${location}\n`);

  const browser = await chromium.launch({ 
    headless: false,
    args: ['--disable-blink-features=AutomationControlled']
  });
  
  const context = await browser.newContext({
    viewport: { width: 1200, height: 800 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
  });
  
  const page = await context.newPage();

  try {
    // Navigate to website
    console.log('📱 Navigating to website...');
    await page.goto(websiteUrl, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Create output directory
    const outputDir = path.join(
      '/Users/giannimunro/Desktop/cursor-projects',
      'automation/planning/downloaded-images',
      `${sanitize(restaurantName)}-${sanitize(location)}`
    );
    fs.mkdirSync(outputDir, { recursive: true });
    console.log(`📁 Output directory: ${outputDir}\n`);

    // Take screenshot of homepage
    const screenshotPath = path.join(outputDir, 'website-screenshot.png');
    await page.screenshot({ path: screenshotPath, fullPage: false });
    console.log('📸 Screenshot saved\n');

    // Extract logo
    console.log('🔍 Searching for logo...');
    const logoData = await page.evaluate(() => {
      // Common logo selectors (broader search)
      const selectors = [
        'header img', 'nav img', '.logo img', 
        'img[alt*="logo" i]', 'img[class*="logo" i]',
        'img[src*="logo" i]', 'a[href="/"] img',
        '.navbar-brand img', '#logo img',
        // More comprehensive selectors
        'img[alt*="kitchen" i]', 'img[alt*="gorilla" i]',
        'img[width]', 'img[height]', 'img'
      ];

      for (const selector of selectors) {
        const img = document.querySelector(selector);
        if (img && img.src) {
          const width = img.naturalWidth || img.width;
          const height = img.naturalHeight || img.height;
          
          // Skip very small images (likely icons or arrows)
          if (width < 50 || height < 50) continue;
          
          const isBase64 = img.src.startsWith('data:image');
          
          if (isBase64) {
            // Extract base64 data
            const matches = img.src.match(/data:image\/(\w+);base64,(.+)/);
            if (matches) {
              return {
                type: 'base64',
                format: matches[1],
                data: matches[2],
                width: width,
                height: height,
                alt: img.alt || ''
              };
            }
          } else {
            // Regular URL
            return {
              type: 'url',
              src: img.src,
              width: width,
              height: height,
              alt: img.alt || ''
            };
          }
        }
      }

      // Check for SVG logos (skip small ones)
      const svgLogos = document.querySelectorAll('header svg, nav svg, .logo svg, svg[class*="logo"], svg');
      for (const svgLogo of svgLogos) {
        const width = svgLogo.width?.baseVal?.value || parseInt(svgLogo.getAttribute('width')) || 100;
        const height = svgLogo.height?.baseVal?.value || parseInt(svgLogo.getAttribute('height')) || 100;
        
        // Skip very small SVGs
        if (width < 50 || height < 50) continue;
        
        return {
          type: 'svg',
          html: svgLogo.outerHTML,
          width: width,
          height: height
        };
      }

      return null;
    });

    if (logoData) {
      console.log(`✅ Logo found: ${logoData.type} format`);
      
      let logoPath;
      if (logoData.type === 'base64') {
        // Save base64 image efficiently
        const buffer = Buffer.from(logoData.data, 'base64');
        logoPath = path.join(outputDir, `logo-from-website.${logoData.format || 'png'}`);
        fs.writeFileSync(logoPath, buffer);
        console.log(`💾 Logo saved: ${logoPath}`);
        console.log(`📊 Dimensions: ${logoData.width}x${logoData.height}px`);
        console.log(`📦 Size: ${buffer.length} bytes\n`);
        
      } else if (logoData.type === 'url') {
        // Download from URL
        const response = await page.context().request.get(logoData.src);
        const buffer = await response.body();
        const extension = logoData.src.split('.').pop().split('?')[0] || 'png';
        logoPath = path.join(outputDir, `logo-from-website.${extension}`);
        fs.writeFileSync(logoPath, buffer);
        console.log(`💾 Logo downloaded: ${logoPath}`);
        console.log(`📊 Dimensions: ${logoData.width}x${logoData.height}px`);
        console.log(`📦 Size: ${buffer.length} bytes\n`);
        
      } else if (logoData.type === 'svg') {
        // Save SVG
        logoPath = path.join(outputDir, 'logo-from-website.svg');
        fs.writeFileSync(logoPath, logoData.html);
        console.log(`💾 SVG logo saved: ${logoPath}\n`);
      }
    } else {
      console.log('⚠️ No logo found on the website\n');
    }

    // Extract brand colors
    console.log('🎨 Extracting brand colors...');
    const colorData = await page.evaluate(() => {
      const colors = new Map();
      
      // Elements likely to contain brand colors
      const selectors = [
        'header', 'nav', '.navbar', '.header',
        'button', '.btn', 'a.button',
        'h1', 'h2', '.hero-title',
        'footer', '.footer',
        '.primary', '.accent', '.brand'
      ];
      
      // Function to convert RGB to hex
      const rgbToHex = (rgb) => {
        const match = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (match) {
          const r = parseInt(match[1]);
          const g = parseInt(match[2]);
          const b = parseInt(match[3]);
          return '#' + [r, g, b].map(x => {
            const hex = x.toString(16);
            return hex.length === 1 ? '0' + hex : hex;
          }).join('').toUpperCase();
        }
        return null;
      };

      // Function to get color name
      const getColorName = (hex) => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        
        // Simple color naming logic
        if (r > 200 && g > 200 && b > 200) return 'White';
        if (r < 50 && g < 50 && b < 50) return 'Black';
        if (r > 150 && g < 100 && b < 100) return 'Red';
        if (r < 100 && g > 150 && b < 100) return 'Green';
        if (r < 100 && g < 100 && b > 150) return 'Blue';
        if (r > 200 && g > 150 && b < 100) return 'Yellow/Gold';
        if (r > 200 && g > 100 && b < 150) return 'Orange';
        if (r > 100 && g < 150 && b > 100) return 'Purple';
        if (Math.abs(r - g) < 20 && Math.abs(g - b) < 20) return 'Gray';
        return 'Mixed';
      };
      
      selectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
          const styles = window.getComputedStyle(el);
          
          // Collect colors with their usage context
          const checkColor = (color, context) => {
            if (color && color !== 'rgba(0, 0, 0, 0)' && color !== 'transparent') {
              const hex = rgbToHex(color);
              if (hex) {
                if (!colors.has(hex)) {
                  colors.set(hex, { 
                    hex, 
                    contexts: new Set(), 
                    count: 0,
                    name: getColorName(hex)
                  });
                }
                colors.get(hex).contexts.add(context);
                colors.get(hex).count++;
              }
            }
          };
          
          checkColor(styles.backgroundColor, 'background');
          checkColor(styles.color, 'text');
          checkColor(styles.borderColor, 'border');
        });
      });
      
      // Get theme
      const bodyBg = window.getComputedStyle(document.body).backgroundColor;
      const bodyBgHex = rgbToHex(bodyBg);
      const isDark = bodyBgHex && parseInt(bodyBgHex.slice(1), 16) < 0x808080;
      
      // Sort colors by usage count
      const sortedColors = Array.from(colors.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
      
      return {
        colors: sortedColors.map(c => ({
          hex: c.hex,
          name: c.name,
          usage: Array.from(c.contexts).join(', '),
          frequency: c.count
        })),
        theme: isDark ? 'dark' : 'light',
        background: bodyBgHex
      };
    });

    // Display color results
    console.log(`\n🎭 Theme: ${colorData.theme} theme`);
    console.log(`🖼️ Background: ${colorData.background}\n`);
    
    console.log('🎨 Top Brand Colors:\n');
    colorData.colors.forEach((color, index) => {
      if (index < 5) { // Show top 5 colors
        console.log(`  ${index + 1}. ${color.hex} - ${color.name}`);
        console.log(`     Used in: ${color.usage}`);
        console.log(`     Frequency: ${color.frequency} occurrences\n`);
      }
    });

    // Save results to JSON
    const resultsPath = path.join(outputDir, 'brand-analysis.json');
    const results = {
      restaurant: restaurantName,
      location: location,
      website: websiteUrl,
      extractedAt: new Date().toISOString(),
      logo: logoData ? {
        type: logoData.type,
        dimensions: `${logoData.width}x${logoData.height}`,
        saved: true
      } : null,
      colors: colorData.colors,
      theme: colorData.theme,
      backgroundColor: colorData.background
    };
    
    fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
    console.log(`📄 Results saved to: ${resultsPath}\n`);

    console.log('✅ Extraction completed successfully!');

  } catch (error) {
    console.error('❌ Error during extraction:', error.message);
  } finally {
    await browser.close();
  }
}

// Run the extraction
extractLogoAndColors().catch(console.error);