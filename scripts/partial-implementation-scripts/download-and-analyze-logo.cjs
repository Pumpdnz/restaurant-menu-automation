const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

// Configuration
const config = {
  restaurantName: process.argv[2] || 'Restaurant Name',
  city: process.argv[3] || 'City',
  baseDir: process.argv[4] || path.join(__dirname, '../planning/downloaded-images')
};

async function downloadWithCurl(url, filepath) {
  try {
    // Use curl with timeout (more reliable than Node's HTTP)
    execSync(`curl -L --max-time 30 -o "${filepath}" "${url}"`, { stdio: 'pipe' });
    
    // Verify file exists and has content
    const stats = fs.statSync(filepath);
    if (stats.size === 0) {
      throw new Error('Downloaded file is empty');
    }
    return true;
  } catch (error) {
    console.error('❌ Download failed:', error.message);
    return false;
  }
}

async function analyzeLogoColors() {
  const restaurantDir = path.join(config.baseDir, `${config.restaurantName.replace(/\s+/g, '')}-${config.city.replace(/\s+/g, '')}`);
  const urlFile = path.join(restaurantDir, 'logo-url.txt');
  const metadataFile = path.join(restaurantDir, 'metadata.json');
  
  // Check if URL file exists
  if (!fs.existsSync(urlFile)) {
    console.error(`❌ No logo URL found. Please run search-restaurant-logo.js first.`);
    console.error(`   Expected file: ${urlFile}`);
    process.exit(1);
  }
  
  const logoUrl = fs.readFileSync(urlFile, 'utf8').trim();
  console.log(`\n🔗 Logo URL: ${logoUrl}`);
  
  // Download the image using curl (more reliable)
  const logoPath = path.join(restaurantDir, 'logo.png');
  console.log('📥 Downloading logo...');
  
  const downloadSuccess = await downloadWithCurl(logoUrl, logoPath);
  if (!downloadSuccess) {
    console.error('❌ Failed to download logo');
    console.log('\n💡 Manual download command:');
    console.log(`   cd ${restaurantDir}`);
    console.log(`   curl -L -o logo.png "${logoUrl}"`);
    process.exit(1);
  }
  
  console.log(`✅ Logo downloaded to: ${logoPath}`);
  
  // Analyze colors using Puppeteer with base64 encoding (avoids file:// issues)
  console.log('\n🎨 Analyzing logo colors...');
  
  let browser;
  try {
    // Read image as base64
    const imageBuffer = fs.readFileSync(logoPath);
    const base64Image = imageBuffer.toString('base64');
    const dataUri = `data:image/png;base64,${base64Image}`;
    
    browser = await puppeteer.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'] // For compatibility
    });
    const page = await browser.newPage();
    
    // Set timeout for the page
    page.setDefaultTimeout(10000); // 10 second timeout
    
    // Create HTML page with canvas for color analysis using data URI (no file:// issues)
    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Logo Color Analyzer</title>
    </head>
    <body>
      <img id="logo" src="${dataUri}" crossorigin="anonymous">
      <canvas id="canvas"></canvas>
      <script>
        function analyzeColors() {
          return new Promise((resolve, reject) => {
            const img = document.getElementById('logo');
            const canvas = document.getElementById('canvas');
            const ctx = canvas.getContext('2d');
            
            // Set timeout for image loading
            const timeout = setTimeout(() => {
              reject(new Error('Image load timeout'));
            }, 5000);
            
            img.onload = function() {
              clearTimeout(timeout);
              
              try {
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);
                
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imageData.data;
                
                // Simple color extraction - get a few dominant colors
                const colorMap = new Map();
                
                // Sample every 10th pixel for speed
                for (let i = 0; i < data.length; i += 40) {
                  const r = data[i];
                  const g = data[i + 1];
                  const b = data[i + 2];
                  const a = data[i + 3];
                  
                  // Skip transparent pixels
                  if (a < 128) continue;
                  
                  // Skip pure white and pure black
                  if ((r === 255 && g === 255 && b === 255) || (r === 0 && g === 0 && b === 0)) continue;
                  
                  // Round colors to reduce variations
                  const roundedR = Math.round(r / 20) * 20;
                  const roundedG = Math.round(g / 20) * 20;
                  const roundedB = Math.round(b / 20) * 20;
                  
                  const key = \`\${roundedR},\${roundedG},\${roundedB}\`;
                  colorMap.set(key, (colorMap.get(key) || 0) + 1);
                }
                
                // Get top 5 colors
                const sortedColors = Array.from(colorMap.entries())
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 5)
                  .map(([rgb, count]) => {
                    const [r, g, b] = rgb.split(',').map(Number);
                    const hex = '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
                    return { hex, rgb: \`rgb(\${r}, \${g}, \${b})\`, count };
                  });
                
                resolve({
                  colors: sortedColors,
                  dimensions: { width: img.width, height: img.height }
                });
              } catch (err) {
                reject(err);
              }
            };
            
            img.onerror = function() {
              clearTimeout(timeout);
              reject(new Error('Image failed to load'));
            };
          });
        }
        
        window.analyzeColors = analyzeColors;
      </script>
    </body>
    </html>
    `;
    
    await page.setContent(htmlContent);
    
    // Run analysis with timeout
    const analysis = await page.evaluate(async () => {
      return await window.analyzeColors();
    }).catch(err => {
      console.error('⚠️ Color analysis failed:', err.message);
      return null;
    });
    
    await browser.close();
    
    if (analysis && analysis.colors && analysis.colors.length > 0) {
      // Update metadata with color analysis
      const metadata = fs.existsSync(metadataFile) 
        ? JSON.parse(fs.readFileSync(metadataFile, 'utf8'))
        : {};
      
      metadata.colorAnalysis = {
        primaryColors: analysis.colors,
        imageDimensions: analysis.dimensions,
        analyzedAt: new Date().toISOString()
      };
      
      fs.writeFileSync(metadataFile, JSON.stringify(metadata, null, 2));
      
      // Display results
      console.log('\n🎨 Primary Brand Colors:');
      analysis.colors.forEach((color, index) => {
        console.log(`  Color ${index + 1}: ${color.hex} - ${color.rgb}`);
      });
      
      console.log(`\n📐 Logo dimensions: ${analysis.dimensions.width}x${analysis.dimensions.height}px`);
      console.log(`\n✅ Analysis complete! Results saved to: ${metadataFile}`);
    } else {
      console.log('\n⚠️ Could not analyze colors automatically');
      console.log('Logo downloaded successfully, but color analysis failed');
      console.log('You can manually inspect the logo at:', logoPath);
    }
    
  } catch (error) {
    console.error('\n⚠️ Color analysis error:', error.message);
    console.log('Logo downloaded successfully at:', logoPath);
    console.log('Manual color analysis may be needed');
    
    if (browser) {
      await browser.close();
    }
  }
}

// Set overall timeout for the entire script
const scriptTimeout = setTimeout(() => {
  console.error('\n⏱️ Script timeout - taking too long');
  console.log('Try manual download:');
  console.log(`  cd ${path.join(config.baseDir, config.restaurantName.replace(/\s+/g, '') + '-' + config.city.replace(/\s+/g, ''))}`);
  console.log('  curl -L -o logo.png "$(cat logo-url.txt)"');
  process.exit(1);
}, 45000); // 45 second total timeout

// Usage instructions
if (process.argv.length < 4) {
  console.log(`
Usage: node download-and-analyze-logo.cjs <restaurant-name> <city> [base-dir]

This script downloads the logo found by search-restaurant-logo.js and analyzes its colors.

Examples:
  node download-and-analyze-logo.cjs "Artisan Cafe" "Rotorua"
  node download-and-analyze-logo.cjs "Pizza Palace" "Auckland" "/custom/base/path"
  `);
  clearTimeout(scriptTimeout);
  process.exit(1);
}

// Run the analysis
analyzeLogoColors()
  .then(() => {
    clearTimeout(scriptTimeout);
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    clearTimeout(scriptTimeout);
    process.exit(1);
  });