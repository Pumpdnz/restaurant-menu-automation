#!/usr/bin/env node

import { removeBackgroundFromImageFile } from 'remove.bg';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

const DEBUG = process.env.DEBUG_MODE === 'true';
const API_KEY = process.env.REMOVE_BG_API_KEY;
const SIZE = process.env.REMOVE_BG_SIZE || 'regular';
const QUALITY = parseInt(process.env.SHARP_QUALITY || '90');

function log(message, ...args) {
  console.log(`[process-logo] ${message}`, ...args);
}

function debug(message, ...args) {
  if (DEBUG) {
    console.log(`[DEBUG] ${message}`, ...args);
  }
}

function error(message, ...args) {
  console.error(`[ERROR] ${message}`, ...args);
}

async function hasTransparency(imagePath) {
  try {
    const metadata = await sharp(imagePath).metadata();
    // Check if image has alpha channel or is PNG/WebP with transparency
    return metadata.hasAlpha || metadata.channels === 4;
  } catch (err) {
    debug('Could not detect transparency:', err.message);
    return false;
  }
}

async function processLogo(inputPath, outputDir) {
  try {
    // Validate input file exists
    if (!fs.existsSync(inputPath)) {
      throw new Error(`Input file not found: ${inputPath}`);
    }

    // Create output directory if it doesn't exist
    if (!outputDir) {
      outputDir = dirname(inputPath);
    }
    
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const baseName = path.basename(inputPath, path.extname(inputPath));
    
    log(`Processing logo: ${inputPath}`);
    log(`Output directory: ${outputDir}`);
    debug(`Using size: ${SIZE}, quality: ${QUALITY}`);
    
    // Check if image already has transparency
    const hasTransparentBg = await hasTransparency(inputPath);
    const noBgPath = path.join(outputDir, 'logo-nobg.png');
    
    let result = null;
    
    if (hasTransparentBg) {
      log('Image already has transparent background - skipping remove.bg API');
      
      // Just trim/crop the transparent areas and save as logo-nobg.png
      await sharp(inputPath)
        .trim()  // Auto-crop transparent pixels
        .png({ quality: QUALITY })
        .toFile(noBgPath);
      
      log('Transparent areas cropped successfully');
      
      // Create mock result object for consistency
      const metadata = await sharp(noBgPath).metadata();
      result = {
        creditsCharged: 0,
        rateLimitRemaining: 'N/A (skipped)',
        resultWidth: metadata.width,
        resultHeight: metadata.height,
        detectedType: 'already_transparent'
      };
      
    } else {
      // Validate API key only if we need to use it
      if (!API_KEY || API_KEY === 'your_api_key_here') {
        throw new Error('Please set REMOVE_BG_API_KEY in /automation/scripts/.env');
      }
      
      log('Removing background with remove.bg API...');
      try {
        result = await removeBackgroundFromImageFile({
          path: inputPath,
          apiKey: API_KEY,
          size: SIZE,
          type: 'auto',  // auto-detect logo/product
          crop: true,    // Auto-crop transparent regions
          outputFile: noBgPath
        });
      } catch (apiError) {
        // Handle remove.bg API errors
        if (Array.isArray(apiError)) {
          throw new Error(`API Error: ${apiError.map(e => e.title || e.message).join(', ')}`);
        } else if (apiError.message) {
          throw new Error(`API Error: ${apiError.message}`);
        } else {
          throw new Error(`API Error: ${JSON.stringify(apiError)}`);
        }
      }
      
      debug(`Credits charged: ${result.creditsCharged}`);
      debug(`Rate limit remaining: ${result.rateLimitRemaining}`);
      debug(`Result dimensions: ${result.resultWidth}x${result.resultHeight}`);
      
      if (!fs.existsSync(noBgPath)) {
        throw new Error('Background removal failed - output file not created');
      }
      
      log('Background removed successfully');
    }
    
    // Step 2: Create standard version (500x500) with Sharp
    const standardPath = path.join(outputDir, 'logo-standard.png');
    log('Creating standard version (500x500)...');
    
    await sharp(noBgPath)
      .resize(500, 500, { 
        fit: 'inside',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png({ quality: QUALITY })
      .toFile(standardPath);
    
    log('Standard version created');
    
    // Step 3: Create thermal printer version (200x200 pure black with transparent bg)
    const thermalPath = path.join(outputDir, 'logo-thermal.png');
    log('Creating thermal printer version (200x200 pure black)...');
    
    // Better method: Convert to grayscale first, then to black while preserving anti-aliasing
    await sharp(noBgPath)
      .resize(200, 200, {
        fit: 'inside',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
        kernel: 'lanczos3'  // High quality resizing algorithm
      })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })
      .then(({ data, info }) => {
        // Convert all non-transparent pixels to black with their original alpha
        // This preserves anti-aliasing for smoother edges
        for (let i = 0; i < data.length; i += 4) {
          const alpha = data[i + 3];
          if (alpha > 0) {
            // Calculate grayscale value for better contrast detection
            const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
            
            // Make all visible pixels black, but preserve the alpha for smoothness
            data[i] = 0;      // R = 0 (black)
            data[i + 1] = 0;  // G = 0 (black)  
            data[i + 2] = 0;  // B = 0 (black)
            // Keep original alpha - this preserves anti-aliasing
          }
        }
        
        return sharp(data, {
          raw: {
            width: info.width,
            height: info.height,
            channels: info.channels
          }
        })
        .png({ 
          quality: QUALITY,
          compressionLevel: 9
        })
        .toFile(thermalPath);
      });
    
    log('Thermal version created');
    
    // Return paths and API usage info
    const outputInfo = {
      success: true,
      input: inputPath,
      outputs: {
        nobg: noBgPath,
        standard: standardPath,
        thermal: thermalPath
      },
      apiUsage: {
        creditsCharged: result.creditsCharged,
        rateLimitRemaining: result.rateLimitRemaining,
        detectedType: result.detectedType
      },
      dimensions: {
        original: `${result.resultWidth}x${result.resultHeight}`,
        standard: '500x500',
        thermal: '200x200'
      }
    };
    
    log('✅ Logo processing complete!');
    log('Generated files:');
    log(`  - ${path.basename(noBgPath)} (background removed + cropped)`);
    log(`  - ${path.basename(standardPath)} (500x500 standard)`);
    log(`  - ${path.basename(thermalPath)} (200x200 B&W thermal)`);
    
    return outputInfo;
    
  } catch (err) {
    error('Failed to process logo:', err.message);
    
    // Check for specific API errors
    if (err.message && err.message.includes('rate limit')) {
      error('Rate limit exceeded. Please wait before trying again.');
    } else if (err.message && err.message.includes('credits')) {
      error('Insufficient credits. Free tier allows 50 calls/month.');
    }
    
    return {
      success: false,
      error: err.message,
      input: inputPath
    };
  }
}

// CLI usage
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes('--help')) {
    console.log(`
Usage: node process-logo.js [options]

Options:
  --input <path>    Path to input logo file (required)
  --dir <path>      Output directory (defaults to input directory)
  --test            Run test with preview size (0.25 credits)
  --help            Show this help message

Examples:
  node process-logo.js --input="../planning/downloaded-images/devil-burger-queenstown/logo-from-website.png"
  node process-logo.js --input="logo.jpg" --dir="./output" --test

Environment variables (set in /automation/scripts/.env):
  REMOVE_BG_API_KEY   Your remove.bg API key (required)
  REMOVE_BG_SIZE      Size option: preview, regular, full (default: regular)
  SHARP_QUALITY       Output quality 1-100 (default: 90)
  DEBUG_MODE          Enable debug output (default: false)
    `);
    process.exit(0);
  }
  
  // Parse arguments
  let inputPath = null;
  let outputDir = null;
  let testMode = false;
  
  for (let i = 0; i < args.length; i++) {
    if ((args[i] === '--input' || args[i].startsWith('--input=')) && i < args.length) {
      if (args[i].includes('=')) {
        inputPath = args[i].split('=')[1];
      } else if (i + 1 < args.length) {
        inputPath = args[i + 1];
        i++;
      }
      // Handle relative paths
      if (inputPath && !path.isAbsolute(inputPath)) {
        inputPath = path.join(__dirname, inputPath);
      }
    } else if ((args[i] === '--dir' || args[i].startsWith('--dir=')) && i < args.length) {
      if (args[i].includes('=')) {
        outputDir = args[i].split('=')[1];
      } else if (i + 1 < args.length) {
        outputDir = args[i + 1];
        i++;
      }
      if (outputDir && !path.isAbsolute(outputDir)) {
        outputDir = path.join(__dirname, outputDir);
      }
    } else if (args[i] === '--test') {
      testMode = true;
      // Override size for test mode
      process.env.REMOVE_BG_SIZE = 'preview';
      log('Test mode enabled - using preview size (0.25 credits)');
    }
  }
  
  if (!inputPath) {
    error('Input file is required. Use --input <path>');
    process.exit(1);
  }
  
  const result = await processLogo(inputPath, outputDir);
  
  if (!result.success) {
    process.exit(1);
  }
}

// Export for use in other scripts
export { processLogo };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}