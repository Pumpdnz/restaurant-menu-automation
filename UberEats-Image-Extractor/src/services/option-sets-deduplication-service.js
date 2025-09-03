/**
 * Option Sets Deduplication Service
 * 
 * Identifies and deduplicates shared option sets across menu items
 * to avoid redundant storage and improve data consistency
 */

const crypto = require('crypto');

class OptionSetsDeduplicationService {
  constructor() {
    this.optionSetCache = new Map();
  }
  
  /**
   * Generate a unique hash for an option set based on its structure
   * @param {object} optionSet - Option set to hash
   * @returns {string} Hash identifier
   */
  generateOptionSetHash(optionSet) {
    // Create a normalized representation of the option set
    const normalized = {
      name: optionSet.name,
      required: optionSet.required || false,
      minSelections: optionSet.minSelections || 0,
      maxSelections: optionSet.maxSelections || 1,
      options: (optionSet.options || []).map(opt => ({
        name: opt.name,
        priceValue: opt.priceValue || 0,
        // Don't include description in hash as it might vary slightly
      })).sort((a, b) => a.name.localeCompare(b.name))
    };
    
    // Generate hash from normalized structure
    const jsonString = JSON.stringify(normalized);
    return crypto.createHash('md5').update(jsonString).digest('hex');
  }
  
  /**
   * Analyze items to find shared option sets
   * @param {Array} items - Array of items with optionSetsData
   * @returns {object} Analysis results with shared sets and assignments
   */
  analyzeSharedOptionSets(items) {
    const optionSetMap = new Map(); // hash -> option set data
    const itemAssignments = new Map(); // item id -> array of hashes
    const usageCount = new Map(); // hash -> count
    
    // First pass: identify all unique option sets
    items.forEach(item => {
      if (!item.optionSetsData?.optionSets) return;
      
      const itemHashes = [];
      
      item.optionSetsData.optionSets.forEach(optionSet => {
        const hash = this.generateOptionSetHash(optionSet);
        itemHashes.push(hash);
        
        // Store the option set if we haven't seen it before
        if (!optionSetMap.has(hash)) {
          optionSetMap.set(hash, {
            ...optionSet,
            hash,
            sharedAcrossItems: []
          });
        }
        
        // Track usage
        usageCount.set(hash, (usageCount.get(hash) || 0) + 1);
        
        // Track which items use this option set
        optionSetMap.get(hash).sharedAcrossItems.push(item.dishName || item.name);
      });
      
      itemAssignments.set(item.dishName || item.name, itemHashes);
    });
    
    // Identify shared vs unique option sets
    const sharedSets = [];
    const uniqueSets = [];
    
    optionSetMap.forEach((optionSet, hash) => {
      if (usageCount.get(hash) > 1) {
        sharedSets.push({
          ...optionSet,
          usageCount: usageCount.get(hash),
          isShared: true
        });
      } else {
        uniqueSets.push({
          ...optionSet,
          usageCount: 1,
          isShared: false
        });
      }
    });
    
    return {
      totalItems: items.length,
      totalOptionSets: optionSetMap.size,
      sharedSets: sharedSets.sort((a, b) => b.usageCount - a.usageCount),
      uniqueSets,
      itemAssignments: Object.fromEntries(itemAssignments),
      stats: {
        sharedCount: sharedSets.length,
        uniqueCount: uniqueSets.length,
        averageUsage: Array.from(usageCount.values()).reduce((a, b) => a + b, 0) / optionSetMap.size,
        maxUsage: Math.max(...Array.from(usageCount.values()))
      }
    };
  }
  
  /**
   * Deduplicate option sets for database storage
   * @param {Array} items - Items with option sets
   * @returns {object} Deduplicated structure ready for database
   */
  deduplicateForDatabase(items) {
    const analysis = this.analyzeSharedOptionSets(items);
    
    // Create master option sets (shared ones)
    const masterOptionSets = [];
    const optionSetHashToId = new Map();
    
    // Process shared sets first
    analysis.sharedSets.forEach((sharedSet, index) => {
      const masterId = `shared_${index}_${sharedSet.hash.substring(0, 8)}`;
      optionSetHashToId.set(sharedSet.hash, masterId);
      
      masterOptionSets.push({
        id: masterId,
        name: sharedSet.name,
        required: sharedSet.required,
        minSelections: sharedSet.minSelections,
        maxSelections: sharedSet.maxSelections,
        options: sharedSet.options,
        isShared: true,
        usageCount: sharedSet.usageCount
      });
    });
    
    // Process items with references to shared sets
    const processedItems = items.map(item => {
      if (!item.optionSetsData?.optionSets) {
        return {
          ...item,
          optionSetReferences: []
        };
      }
      
      const optionSetReferences = [];
      const uniqueOptionSets = [];
      
      item.optionSetsData.optionSets.forEach((optionSet, index) => {
        const hash = this.generateOptionSetHash(optionSet);
        
        if (optionSetHashToId.has(hash)) {
          // This is a shared option set, reference it
          optionSetReferences.push({
            masterSetId: optionSetHashToId.get(hash),
            displayOrder: index
          });
        } else {
          // This is a unique option set for this item
          uniqueOptionSets.push({
            ...optionSet,
            displayOrder: index
          });
        }
      });
      
      return {
        ...item,
        optionSetReferences,
        uniqueOptionSets,
        hasSharedOptionSets: optionSetReferences.length > 0,
        hasUniqueOptionSets: uniqueOptionSets.length > 0
      };
    });
    
    return {
      masterOptionSets,
      processedItems,
      analysis
    };
  }
  
  /**
   * Generate deduplication report
   * @param {object} analysis - Analysis results from analyzeSharedOptionSets
   * @returns {string} Formatted report
   */
  generateReport(analysis) {
    let report = '=== Option Sets Deduplication Report ===\n\n';
    
    report += `Total Items Analyzed: ${analysis.totalItems}\n`;
    report += `Total Unique Option Sets: ${analysis.totalOptionSets}\n`;
    report += `Shared Option Sets: ${analysis.stats.sharedCount}\n`;
    report += `Item-Specific Option Sets: ${analysis.stats.uniqueCount}\n`;
    report += `Average Usage per Set: ${analysis.stats.averageUsage.toFixed(1)}\n`;
    report += `Maximum Usage: ${analysis.stats.maxUsage}\n\n`;
    
    if (analysis.sharedSets.length > 0) {
      report += 'Top Shared Option Sets:\n';
      analysis.sharedSets.slice(0, 5).forEach((set, index) => {
        report += `  ${index + 1}. "${set.name}" - Used by ${set.usageCount} items\n`;
        report += `     Options: ${set.options.length} choices\n`;
        report += `     Required: ${set.required ? 'Yes' : 'No'}\n`;
        if (set.sharedAcrossItems.length <= 3) {
          report += `     Items: ${set.sharedAcrossItems.join(', ')}\n`;
        } else {
          report += `     Items: ${set.sharedAcrossItems.slice(0, 3).join(', ')} and ${set.sharedAcrossItems.length - 3} more\n`;
        }
        report += '\n';
      });
    }
    
    // Calculate savings
    const totalWithoutDedup = analysis.totalItems * (analysis.stats.sharedCount + analysis.stats.uniqueCount);
    const totalWithDedup = analysis.stats.sharedCount + analysis.stats.uniqueCount;
    const savings = totalWithoutDedup - totalWithDedup;
    const savingsPercent = ((savings / totalWithoutDedup) * 100).toFixed(1);
    
    report += `\nStorage Optimization:\n`;
    report += `  Without deduplication: ${totalWithoutDedup} option set records\n`;
    report += `  With deduplication: ${totalWithDedup} option set records\n`;
    report += `  Records saved: ${savings} (${savingsPercent}% reduction)\n`;
    
    return report;
  }
  
  /**
   * Check if two option sets are equivalent
   * @param {object} set1 - First option set
   * @param {object} set2 - Second option set
   * @returns {boolean} True if equivalent
   */
  areOptionSetsEquivalent(set1, set2) {
    return this.generateOptionSetHash(set1) === this.generateOptionSetHash(set2);
  }
  
  /**
   * Find similar option sets (fuzzy matching)
   * @param {object} targetSet - Option set to match
   * @param {Array} candidateSets - Array of option sets to search
   * @param {number} threshold - Similarity threshold (0-1)
   * @returns {Array} Similar option sets
   */
  findSimilarOptionSets(targetSet, candidateSets, threshold = 0.8) {
    const similar = [];
    
    candidateSets.forEach(candidate => {
      // Check name similarity
      const nameSimilarity = this.calculateSimilarity(
        targetSet.name.toLowerCase(),
        candidate.name.toLowerCase()
      );
      
      // Check option overlap
      const targetOptions = new Set(targetSet.options.map(o => o.name.toLowerCase()));
      const candidateOptions = new Set(candidate.options.map(o => o.name.toLowerCase()));
      
      const intersection = new Set([...targetOptions].filter(x => candidateOptions.has(x)));
      const union = new Set([...targetOptions, ...candidateOptions]);
      
      const optionSimilarity = intersection.size / union.size;
      
      // Combined similarity score
      const similarity = (nameSimilarity * 0.3 + optionSimilarity * 0.7);
      
      if (similarity >= threshold) {
        similar.push({
          ...candidate,
          similarity,
          nameSimilarity,
          optionSimilarity
        });
      }
    });
    
    return similar.sort((a, b) => b.similarity - a.similarity);
  }
  
  /**
   * Calculate string similarity (Levenshtein distance based)
   * @param {string} str1 - First string
   * @param {string} str2 - Second string
   * @returns {number} Similarity score (0-1)
   */
  calculateSimilarity(str1, str2) {
    const maxLen = Math.max(str1.length, str2.length);
    if (maxLen === 0) return 1;
    
    const distance = this.levenshteinDistance(str1, str2);
    return 1 - (distance / maxLen);
  }
  
  /**
   * Calculate Levenshtein distance between two strings
   * @param {string} str1 - First string
   * @param {string} str2 - Second string
   * @returns {number} Edit distance
   */
  levenshteinDistance(str1, str2) {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }
}

module.exports = new OptionSetsDeduplicationService();