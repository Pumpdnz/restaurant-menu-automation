/**
 * Proposed API endpoint for batch image downloads
 * This would be added to the UberEats-Image-Extractor server.js
 */

/**
 * API endpoint to download all images from extracted menu data
 * 
 * POST /api/download-images
 * 
 * Request body:
 * {
 *   data: { menuItems: [...] },
 *   options: {
 *     outputPath: './downloads/restaurant-name',
 *     groupByCategory: true,
 *     skipPlaceholders: true
 *   }
 * }
 * 
 * Response:
 * {
 *   success: true,
 *   stats: {
 *     total: 17,
 *     downloaded: 15,
 *     failed: 0,
 *     noImage: 2
 *   },
 *   downloadPath: './downloads/restaurant-name',
 *   mappingFile: './downloads/restaurant-name/image-mapping.json'
 * }
 */
app.post('/api/download-images', async (req, res) => {
  const { data, options } = req.body;
  
  if (!data || !data.menuItems) {
    return res.status(400).json({
      success: false,
      error: 'Valid menu data is required'
    });
  }
  
  const {
    outputPath = './downloads',
    groupByCategory = true,
    skipPlaceholders = true
  } = options || {};
  
  console.log(`Starting batch download of ${data.menuItems.length} images`);
  
  try {
    const fs = require('fs').promises;
    const path = require('path');
    const https = require('https');
    const { pipeline } = require('stream/promises');
    
    // Create output directory
    await fs.mkdir(outputPath, { recursive: true });
    
    // Track statistics
    const stats = {
      total: data.menuItems.length,
      downloaded: 0,
      failed: 0,
      noImage: 0
    };
    
    // Download results
    const downloadResults = [];
    
    // Group items by category if requested
    const itemGroups = groupByCategory 
      ? groupItemsByCategory(data.menuItems)
      : { 'all': data.menuItems };
    
    // Process each group
    for (const [groupName, items] of Object.entries(itemGroups)) {
      // Create subdirectory for category
      const groupDir = groupByCategory 
        ? path.join(outputPath, sanitizeFolderName(groupName))
        : outputPath;
      
      await fs.mkdir(groupDir, { recursive: true });
      
      // Download each item's image
      for (const item of items) {
        const result = {
          dishName: item.dishName,
          categoryName: item.categoryName,
          originalUrl: item.imageURL,
          localPath: null,
          status: 'pending'
        };
        
        // Skip if no image or placeholder
        if (!item.imageURL || 
            (skipPlaceholders && item.imageURL.includes('placeholder'))) {
          result.status = 'no_image';
          stats.noImage++;
          downloadResults.push(result);
          continue;
        }
        
        try {
          // Generate safe filename
          const filename = `${sanitizeFilename(item.dishName)}.jpg`;
          const filepath = path.join(groupDir, filename);
          
          // Download image
          await downloadImage(item.imageURL, filepath);
          
          result.localPath = path.relative(outputPath, filepath);
          result.status = 'success';
          stats.downloaded++;
          
        } catch (error) {
          console.error(`Failed to download ${item.dishName}:`, error.message);
          result.status = 'failed';
          result.error = error.message;
          stats.failed++;
        }
        
        downloadResults.push(result);
      }
    }
    
    // Create mapping file
    const mappingData = {
      restaurant: data.restaurantInfo?.name || 'Unknown Restaurant',
      downloadDate: new Date().toISOString(),
      stats: stats,
      items: downloadResults
    };
    
    const mappingPath = path.join(outputPath, 'image-mapping.json');
    await fs.writeFile(mappingPath, JSON.stringify(mappingData, null, 2));
    
    // Return success response
    return res.json({
      success: true,
      stats: stats,
      downloadPath: outputPath,
      mappingFile: mappingPath
    });
    
  } catch (error) {
    console.error('Batch download error:', error);
    return res.status(500).json({
      success: false,
      error: `Batch download failed: ${error.message}`
    });
  }
});

/**
 * Helper function to download a single image
 */
async function downloadImage(url, filepath) {
  return new Promise((resolve, reject) => {
    const fs = require('fs');
    const https = require('https');
    const http = require('http');
    
    const file = fs.createWriteStream(filepath);
    const protocol = url.startsWith('https') ? https : http;
    
    const request = protocol.get(url, (response) => {
      if (response.statusCode !== 200) {
        fs.unlinkSync(filepath);
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        resolve(filepath);
      });
    });
    
    request.on('error', (err) => {
      fs.unlinkSync(filepath);
      reject(err);
    });
    
    request.setTimeout(30000, () => {
      request.destroy();
      reject(new Error('Download timeout'));
    });
  });
}

/**
 * Helper function to group items by category
 */
function groupItemsByCategory(items) {
  const groups = {};
  
  items.forEach(item => {
    const category = item.categoryName || 'Uncategorized';
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(item);
  });
  
  return groups;
}

/**
 * Helper function to sanitize folder names
 */
function sanitizeFolderName(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_');
}

/**
 * Helper function to sanitize filenames
 */
function sanitizeFilename(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .substring(0, 50);
}