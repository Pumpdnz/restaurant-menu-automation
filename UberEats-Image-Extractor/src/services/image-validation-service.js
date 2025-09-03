/**
 * Image Validation Service for Menu Items
 * 
 * Validates menu item images to identify placeholders and ensure quality
 * Based on testing documented in extraction_debug_log.md
 */

class ImageValidationService {
  constructor() {
    // Known placeholder image patterns from UberEats
    this.placeholderPatterns = [
      '/_static/8ab3af80072120d4.png',  // Common gray placeholder
      '/_static/29ed4bc0793fd578.svg',  // SVG placeholder
      '/_static/',                       // General static placeholder pattern
      '/placeholder/',                    // Generic placeholder
      'no-image',                        // No image indicator
      'default-image',                   // Default image
      'coming-soon'                      // Coming soon placeholder
    ];
    
    // Known low-quality image patterns
    this.lowQualityPatterns = [
      'thumb',                           // Thumbnail images
      'small',                           // Small images
      '64x64',                          // Very small dimensions
      '128x128',                        // Small dimensions
      'low-res'                         // Low resolution indicator
    ];
  }
  
  /**
   * Check if an image URL is a placeholder
   * @param {string} url - Image URL to validate
   * @returns {boolean} True if the image is a placeholder
   */
  isPlaceholder(url) {
    if (!url) {
      return true;
    }
    
    const lowerUrl = url.toLowerCase();
    
    // Check against known placeholder patterns
    for (const pattern of this.placeholderPatterns) {
      if (lowerUrl.includes(pattern.toLowerCase())) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Check if an image URL is low quality
   * @param {string} url - Image URL to validate
   * @returns {boolean} True if the image is low quality
   */
  isLowQuality(url) {
    if (!url) {
      return true;
    }
    
    const lowerUrl = url.toLowerCase();
    
    // Check against low quality patterns
    for (const pattern of this.lowQualityPatterns) {
      if (lowerUrl.includes(pattern.toLowerCase())) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Extract image dimensions from URL if available
   * @param {string} url - Image URL
   * @returns {object|null} Object with width and height, or null
   */
  extractDimensions(url) {
    if (!url) {
      return null;
    }
    
    // Look for dimension patterns like 640x640, 1024x768, etc.
    const dimensionMatch = url.match(/(\d{2,4})x(\d{2,4})/);
    
    if (dimensionMatch) {
      return {
        width: parseInt(dimensionMatch[1]),
        height: parseInt(dimensionMatch[2])
      };
    }
    
    // Look for width/height parameters
    const widthMatch = url.match(/[?&]w=(\d+)/);
    const heightMatch = url.match(/[?&]h=(\d+)/);
    
    if (widthMatch || heightMatch) {
      return {
        width: widthMatch ? parseInt(widthMatch[1]) : null,
        height: heightMatch ? parseInt(heightMatch[1]) : null
      };
    }
    
    return null;
  }
  
  /**
   * Get the quality score of an image URL
   * @param {string} url - Image URL
   * @returns {object} Quality assessment
   */
  assessQuality(url) {
    const assessment = {
      url,
      hasImage: !!url,
      isPlaceholder: false,
      isLowQuality: false,
      dimensions: null,
      qualityScore: 0,  // 0-100
      recommendation: ''
    };
    
    if (!url) {
      assessment.recommendation = 'No image URL provided';
      return assessment;
    }
    
    // Check if placeholder
    assessment.isPlaceholder = this.isPlaceholder(url);
    if (assessment.isPlaceholder) {
      assessment.qualityScore = 0;
      assessment.recommendation = 'Replace placeholder with actual product image';
      return assessment;
    }
    
    // Check if low quality
    assessment.isLowQuality = this.isLowQuality(url);
    
    // Extract dimensions
    assessment.dimensions = this.extractDimensions(url);
    
    // Calculate quality score
    let score = 50;  // Base score for having a non-placeholder image
    
    if (!assessment.isLowQuality) {
      score += 20;
    }
    
    if (assessment.dimensions) {
      const minDimension = Math.min(
        assessment.dimensions.width || 0,
        assessment.dimensions.height || 0
      );
      
      if (minDimension >= 800) {
        score += 30;  // High resolution
      } else if (minDimension >= 400) {
        score += 20;  // Medium resolution
      } else if (minDimension >= 200) {
        score += 10;  // Low resolution
      }
    } else {
      // No dimensions found, assume medium quality
      score += 15;
    }
    
    assessment.qualityScore = Math.min(score, 100);
    
    // Set recommendation
    if (assessment.qualityScore >= 80) {
      assessment.recommendation = 'Good quality image';
    } else if (assessment.qualityScore >= 60) {
      assessment.recommendation = 'Acceptable quality, consider higher resolution';
    } else if (assessment.qualityScore >= 40) {
      assessment.recommendation = 'Low quality, should replace with better image';
    } else {
      assessment.recommendation = 'Very low quality, urgent replacement needed';
    }
    
    return assessment;
  }
  
  /**
   * Validate all images in a batch of menu items
   * @param {Array} items - Array of menu items with image URLs
   * @param {string} orgId - Organization ID for logging
   * @returns {object} Validation results
   */
  async validateBatch(items, orgId) {
    console.log(`[${orgId}] Starting image validation for ${items.length} items`);
    
    const results = [];
    let stats = {
      total: items.length,
      hasImage: 0,
      placeholders: 0,
      lowQuality: 0,
      goodQuality: 0,
      averageScore: 0
    };
    
    for (const item of items) {
      const imageUrl = item.imageUrl || item.image || item.imageURL;
      const assessment = this.assessQuality(imageUrl);
      
      // Add item metadata to assessment
      assessment.itemName = item.name || item.dishName || item.itemName;
      assessment.itemId = item.id || item.uuid;
      
      results.push(assessment);
      
      // Update stats
      if (assessment.hasImage) {
        stats.hasImage++;
      }
      if (assessment.isPlaceholder) {
        stats.placeholders++;
      }
      if (assessment.isLowQuality) {
        stats.lowQuality++;
      }
      if (assessment.qualityScore >= 80) {
        stats.goodQuality++;
      }
      stats.averageScore += assessment.qualityScore;
    }
    
    // Calculate average score
    stats.averageScore = stats.total > 0 
      ? Math.round(stats.averageScore / stats.total) 
      : 0;
    
    // Calculate percentages
    stats.percentages = {
      withImages: ((stats.hasImage / stats.total) * 100).toFixed(1) + '%',
      placeholders: ((stats.placeholders / stats.total) * 100).toFixed(1) + '%',
      lowQuality: ((stats.lowQuality / stats.total) * 100).toFixed(1) + '%',
      goodQuality: ((stats.goodQuality / stats.total) * 100).toFixed(1) + '%'
    };
    
    console.log(`[${orgId}] Image validation complete:`);
    console.log(`[${orgId}]   - Items with images: ${stats.hasImage}/${stats.total} (${stats.percentages.withImages})`);
    console.log(`[${orgId}]   - Placeholders: ${stats.placeholders} (${stats.percentages.placeholders})`);
    console.log(`[${orgId}]   - Low quality: ${stats.lowQuality} (${stats.percentages.lowQuality})`);
    console.log(`[${orgId}]   - Good quality: ${stats.goodQuality} (${stats.percentages.goodQuality})`);
    console.log(`[${orgId}]   - Average quality score: ${stats.averageScore}/100`);
    
    return {
      items: results,
      stats
    };
  }
  
  /**
   * Get items that need image replacement
   * @param {Array} validationResults - Results from validateBatch
   * @param {number} minScore - Minimum quality score (default 60)
   * @returns {Array} Items needing replacement
   */
  getItemsNeedingReplacement(validationResults, minScore = 60) {
    return validationResults.items.filter(item => 
      item.isPlaceholder || item.qualityScore < minScore
    ).map(item => ({
      itemName: item.itemName,
      itemId: item.itemId,
      currentUrl: item.url,
      qualityScore: item.qualityScore,
      reason: item.isPlaceholder ? 'Placeholder image' : 'Low quality',
      recommendation: item.recommendation
    }));
  }
  
  /**
   * Generate image quality report
   * @param {object} validationResults - Results from validateBatch
   * @returns {string} Formatted report
   */
  generateReport(validationResults) {
    const { stats } = validationResults;
    const needsReplacement = this.getItemsNeedingReplacement(validationResults);
    
    let report = '=== Image Quality Report ===\n\n';
    report += `Total Items: ${stats.total}\n`;
    report += `Average Quality Score: ${stats.averageScore}/100\n\n`;
    
    report += 'Statistics:\n';
    report += `  • Items with images: ${stats.hasImage} (${stats.percentages.withImages})\n`;
    report += `  • Placeholder images: ${stats.placeholders} (${stats.percentages.placeholders})\n`;
    report += `  • Low quality images: ${stats.lowQuality} (${stats.percentages.lowQuality})\n`;
    report += `  • Good quality images: ${stats.goodQuality} (${stats.percentages.goodQuality})\n\n`;
    
    if (needsReplacement.length > 0) {
      report += `Items Needing Image Replacement (${needsReplacement.length}):\n`;
      needsReplacement.forEach((item, index) => {
        report += `  ${index + 1}. ${item.itemName}\n`;
        report += `     - Score: ${item.qualityScore}/100\n`;
        report += `     - Reason: ${item.reason}\n`;
        report += `     - ${item.recommendation}\n`;
      });
    } else {
      report += 'All items have acceptable image quality!\n';
    }
    
    return report;
  }
}

module.exports = new ImageValidationService();