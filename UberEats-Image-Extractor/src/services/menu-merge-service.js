const db = require('./database-service');

class MenuMergeService {
  constructor() {
    this.DUPLICATE_THRESHOLD = 0.80;  // Lowered for better duplicate detection
    this.POSSIBLE_THRESHOLD = 0.65;
  }

  get supabase() {
    return db.supabase;
  }

  /**
   * Validate that menus can be merged
   */
  async validateMergeRequest(menuIds, userId) {
    try {
      // Validate we have at least 2 menus
      if (!menuIds || menuIds.length < 2) {
        return {
          valid: false,
          errors: ['At least 2 menus are required for merging'],
          warnings: []
        };
      }

      // Validate maximum menus (performance consideration)
      if (menuIds.length > 5) {
        return {
          valid: false,
          errors: ['Maximum 5 menus can be merged at once'],
          warnings: []
        };
      }

      // Fetch menu details
      const { data: menus, error } = await this.supabase
        .from('menus')
        .select(`
          id,
          restaurant_id,
          platform_id,
          version,
          is_active,
          is_merged,
          menu_data,
          restaurants (
            id,
            name
          ),
          platforms (
            id,
            name
          )
        `)
        .in('id', menuIds);

      if (error) {
        throw new Error(`Failed to fetch menus: ${error.message}`);
      }

      if (!menus || menus.length !== menuIds.length) {
        return {
          valid: false,
          errors: ['One or more menus not found'],
          warnings: []
        };
      }

      // Check all menus belong to same restaurant
      const restaurantIds = [...new Set(menus.map(m => m.restaurant_id))];
      if (restaurantIds.length > 1) {
        return {
          valid: false,
          errors: ['All menus must belong to the same restaurant'],
          warnings: []
        };
      }

      // Count total items across menus
      const { data: itemCounts, error: countError } = await this.supabase
        .from('menu_items')
        .select('menu_id')
        .in('menu_id', menuIds);

      const totalItems = itemCounts ? itemCounts.length : 0;

      // Warnings
      const warnings = [];
      if (totalItems > 500) {
        warnings.push(`Large merge operation: ${totalItems} total items may take longer to process`);
      }

      const mergedMenus = menus.filter(m => m.is_merged);
      if (mergedMenus.length > 0) {
        warnings.push(`${mergedMenus.length} menu(s) are already merged menus`);
      }

      return {
        valid: true,
        errors: [],
        warnings,
        menuDetails: menus.map(m => ({
          id: m.id,
          name: `${m.restaurants.name} - ${m.platforms.name} v${m.version}`,
          itemCount: itemCounts.filter(item => item.menu_id === m.id).length,
          platform: m.platforms.name,
          version: m.version,
          isActive: m.is_active,
          isMerged: m.is_merged
        }))
      };
    } catch (error) {
      console.error('Validation error:', error);
      return {
        valid: false,
        errors: [error.message],
        warnings: []
      };
    }
  }

  /**
   * Compare menus and find duplicates
   */
  async compareMenus(menuIds, mergeMode = 'full') {
    try {
      // In price-only mode, we match items by name similarity
      if (mergeMode === 'price-only') {
        return this.comparePriceUpdate(menuIds);
      }
      // Use the improved database function to find duplicates with grouping
      const { data: duplicates, error: dupError } = await this.supabase
        .rpc('find_duplicate_items_with_groups', {
          menu_ids: menuIds,
          threshold: this.DUPLICATE_THRESHOLD
        });

      if (dupError) {
        throw new Error(`Failed to find duplicates: ${dupError.message}`);
      }

      // Get unique items from each menu
      const uniqueItemsPromises = menuIds.map(async (menuId) => {
        const { data, error } = await this.supabase
          .from('menu_items')
          .select(`
            id,
            menu_id,
            name,
            price,
            description,
            tags,
            categories (
              id,
              name
            ),
            item_images (
              url
            )
          `)
          .eq('menu_id', menuId);

        if (error) {
          console.error(`Failed to fetch items for menu ${menuId}:`, error);
          return { menuId, items: [] };
        }

        // Format items to match the structure used in duplicate detection
        const formattedItems = (data || []).map(item => ({
          id: item.id,
          menuId: item.menu_id,
          name: item.name,
          price: item.price,
          description: item.description,
          categoryName: this.normalizeCategoryName(item.categories?.name),
          categoryId: item.categories?.id,
          tags: item.tags,
          imageURL: item.item_images?.[0]?.url
        }));
        
        return { menuId, items: formattedItems };
      });

      const allMenuItems = await Promise.all(uniqueItemsPromises);

      // Group duplicates by master_group_id for better handling of cross-category duplicates
      const duplicateGroups = {};
      const subDuplicates = {};
      
      duplicates.forEach(dup => {
        const groupKey = dup.master_group_id || dup.group_id;
        
        if (dup.is_master) {
          // This is a master duplicate pair
          if (!duplicateGroups[groupKey]) {
            duplicateGroups[groupKey] = {
              groupId: groupKey,
              masterGroupId: dup.master_group_id,
              items: [],
              similarity: dup.similarity_score,
              suggestedResolution: null,
              subDuplicates: [] // Initialize as empty array
            };
          }
          
          // Add both items to the master group
          if (!duplicateGroups[groupKey].items.find(item => item.id === dup.item1_id)) {
            duplicateGroups[groupKey].items.push({
              ...dup.item1_data,
              menuId: dup.item1_menu_id
            });
          }
          if (!duplicateGroups[groupKey].items.find(item => item.id === dup.item2_id)) {
            duplicateGroups[groupKey].items.push({
              ...dup.item2_data,
              menuId: dup.item2_menu_id
            });
          }
        } else {
          // This is a sub-duplicate (e.g., Featured Items version)
          if (!subDuplicates[groupKey]) {
            subDuplicates[groupKey] = [];
          }
          subDuplicates[groupKey].push({
            item1: { ...dup.item1_data, menuId: dup.item1_menu_id },
            item2: { ...dup.item2_data, menuId: dup.item2_menu_id },
            similarity: dup.similarity_score
          });
        }
      });
      
      // Attach sub-duplicates to their master groups
      Object.keys(subDuplicates).forEach(masterGroupId => {
        if (duplicateGroups[masterGroupId]) {
          duplicateGroups[masterGroupId].subDuplicates = subDuplicates[masterGroupId];
          console.log(`Group ${masterGroupId} has ${subDuplicates[masterGroupId].length} sub-duplicates`);
        }
      });

      // Get items that are not in any duplicate group (including sub-duplicates)
      const duplicateItemIds = new Set();
      const featuredItemIds = [];
      
      Object.values(duplicateGroups).forEach(group => {
        // Add master duplicate items
        group.items.forEach(item => {
          duplicateItemIds.add(item.id);
          if (item.categoryName && item.categoryName.toLowerCase().includes('featured')) {
            featuredItemIds.push({ id: item.id, name: item.name, category: item.categoryName });
          }
        });
        // Add sub-duplicate items if they exist
        if (group.subDuplicates && group.subDuplicates.length > 0) {
          group.subDuplicates.forEach(subDup => {
            duplicateItemIds.add(subDup.item1.id);
            duplicateItemIds.add(subDup.item2.id);
            
            if (subDup.item1.categoryName && subDup.item1.categoryName.toLowerCase().includes('featured')) {
              featuredItemIds.push({ id: subDup.item1.id, name: subDup.item1.name, category: subDup.item1.categoryName });
            }
            if (subDup.item2.categoryName && subDup.item2.categoryName.toLowerCase().includes('featured')) {
              featuredItemIds.push({ id: subDup.item2.id, name: subDup.item2.name, category: subDup.item2.categoryName });
            }
          });
        }
      });
      
      console.log(`Total duplicate item IDs tracked: ${duplicateItemIds.size}`);
      console.log(`Featured items in duplicates: ${featuredItemIds.length}`);
      console.log('Sample featured item IDs:', featuredItemIds.slice(0, 5));

      const uniqueItems = {};
      allMenuItems.forEach(({ menuId, items }) => {
        const uniqueForMenu = items.filter(item => !duplicateItemIds.has(item.id));
        console.log(`Menu ${menuId}: ${items.length} total items, ${uniqueForMenu.length} unique items, ${items.length - uniqueForMenu.length} duplicates filtered`);
        
        // Check if any Featured Items are in the unique list
        const featuredInUnique = uniqueForMenu.filter(item => 
          item.categoryName && item.categoryName.toLowerCase().includes('featured')
        );
        if (featuredInUnique.length > 0) {
          console.log(`WARNING: ${featuredInUnique.length} Featured Items in unique list for menu ${menuId}:`);
          featuredInUnique.forEach(item => {
            console.log(`  - ${item.name} (${item.id}) in ${item.categoryName}`);
          });
        }
        
        uniqueItems[menuId] = uniqueForMenu;
      });

      // Get all categories
      const { data: categories, error: catError } = await this.supabase
        .from('categories')
        .select('id, name, menu_id')
        .in('menu_id', menuIds);

      if (catError) {
        console.error('Failed to fetch categories:', catError);
      }

      // Add suggested resolutions to duplicate groups
      Object.values(duplicateGroups).forEach(group => {
        group.suggestedResolution = this.suggestResolution(group.items, group.similarity);
      });

      // Calculate statistics
      const totalItems = allMenuItems.reduce((sum, { items }) => sum + items.length, 0);
      const duplicateCount = Object.keys(duplicateGroups).length;
      const uniqueCount = Object.values(uniqueItems).reduce((sum, items) => sum + items.length, 0);
      
      // Create category mapping information
      const categoryMappings = this.getCategoryMappings(categories);

      return {
        comparison: {
          duplicateGroups: Object.values(duplicateGroups),
          uniqueItems,
          categories: {
            all: [...new Set(categories?.map(c => c.name) || [])],
            byMenu: menuIds.reduce((acc, menuId) => {
              acc[menuId] = categories?.filter(c => c.menu_id === menuId).map(c => c.name) || [];
              return acc;
            }, {}),
            mappings: categoryMappings
          }
        },
        statistics: {
          totalItems,
          duplicates: duplicateCount,
          unique: uniqueCount,
          byMenu: menuIds.reduce((acc, menuId) => {
            const menuItems = allMenuItems.find(m => m.menuId === menuId)?.items || [];
            const menuDuplicates = duplicates.filter(d => 
              d.item1_menu_id === menuId || d.item2_menu_id === menuId
            ).length;
            acc[menuId] = {
              total: menuItems.length,
              duplicates: menuDuplicates,
              unique: uniqueItems[menuId]?.length || 0
            };
            return acc;
          }, {})
        }
      };
    } catch (error) {
      console.error('Comparison error:', error);
      throw error;
    }
  }

  /**
   * Suggest resolution for duplicate items
   */
  suggestResolution(items, similarity) {
    if (!items || items.length < 2) {
      return {
        recommended: 'keep_both',
        reason: 'Not enough items to compare',
        confidence: 0
      };
    }

    // If items are 100% identical (or very close to it), automatically suggest menu 1
    if (similarity >= 0.99) {
      return {
        recommended: 'keep_menu1',
        reason: 'Items are identical - keeping first menu version',
        confidence: 1.0
      };
    }

    // Score each item based on completeness
    const scores = items.map(item => ({
      item,
      score: this.scoreItemCompleteness(item)
    }));

    // Sort by score descending
    scores.sort((a, b) => b.score - a.score);

    const scoreDiff = scores[0].score - scores[1].score;
    
    // If scores are very close, suggest custom merge
    if (scoreDiff < 0.1) {
      return {
        recommended: 'custom',
        reason: 'Items have similar completeness, manual review recommended',
        confidence: 0.5
      };
    }

    // Otherwise recommend the more complete item
    const bestItem = scores[0].item;
    const menuIndex = items.findIndex(item => item.id === bestItem.id) + 1;

    return {
      recommended: `keep_menu${menuIndex}`,
      reason: this.getResolutionReason(scores[0], scores[1]),
      confidence: Math.min(scoreDiff, 1.0)
    };
  }

  /**
   * Score item completeness
   */
  scoreItemCompleteness(item) {
    let score = 0;
    
    // Has description (30%)
    if (item.description && item.description.length > 10) {
      score += 0.3;
    }
    
    // Has image (25%)
    if (item.imageURL || item.image_url) {
      score += 0.25;
    }
    
    // Has price (20%)
    if (item.price && item.price > 0) {
      score += 0.2;
    }
    
    // Has tags (15%)
    if (item.tags && item.tags.length > 0) {
      score += 0.15;
    }
    
    // Has category (10%)
    if (item.categoryName || item.category_name) {
      score += 0.1;
    }
    
    return score;
  }

  /**
   * Get resolution reason text
   */
  getResolutionReason(better, worse) {
    const reasons = [];
    
    if ((better.item.description?.length || 0) > (worse.item.description?.length || 0)) {
      reasons.push('more detailed description');
    }
    
    if ((better.item.imageURL || better.item.image_url) && !(worse.item.imageURL || worse.item.image_url)) {
      reasons.push('includes image');
    }
    
    if ((better.item.tags?.length || 0) > (worse.item.tags?.length || 0)) {
      reasons.push('more tags');
    }
    
    if (reasons.length === 0) {
      return 'More complete item data';
    }
    
    return `Item has ${reasons.join(', ')}`;
  }

  /**
   * Compare menus for price update mode
   */
  async comparePriceUpdate(menuIds) {
    try {
      if (menuIds.length !== 2) {
        throw new Error('Price update mode requires exactly 2 menus');
      }

      // Menu 1 is the base (delivery platform), Menu 2 is the price source
      const [baseMenuId, priceMenuId] = menuIds;

      // Get all items from both menus
      const { data: baseItems, error: baseError } = await this.supabase
        .from('menu_items')
        .select(`
          id,
          menu_id,
          name,
          price,
          description,
          tags,
          categories (id, name),
          item_images (url)
        `)
        .eq('menu_id', baseMenuId);

      const { data: priceItems, error: priceError } = await this.supabase
        .from('menu_items')
        .select(`
          id,
          menu_id,
          name,
          price,
          description,
          categories (name)
        `)
        .eq('menu_id', priceMenuId);

      if (baseError || priceError) {
        throw new Error('Failed to fetch menu items');
      }

      // Match items by name similarity
      const priceMatches = [];
      const unmatchedBase = [];
      const unmatchedPrice = [...priceItems];

      for (const baseItem of baseItems) {
        let bestMatch = null;
        let bestScore = 0;

        for (const priceItem of unmatchedPrice) {
          // Calculate similarity score based on normalized names
          const baseNorm = this.normalizeItemName(baseItem.name);
          const priceNorm = this.normalizeItemName(priceItem.name);
          
          // Simple similarity check (could be enhanced with fuzzy matching)
          const score = this.calculateNameSimilarity(baseNorm, priceNorm);
          
          if (score > 0.8 && score > bestScore) {
            bestMatch = priceItem;
            bestScore = score;
          }
        }

        if (bestMatch) {
          priceMatches.push({
            groupId: `price_${baseItem.id}`,
            baseItem: {
              ...baseItem,
              categoryName: baseItem.categories?.name,
              imageURL: baseItem.item_images?.[0]?.url
            },
            priceItem: bestMatch,
            similarity: bestScore,
            priceDifference: bestMatch.price - baseItem.price,
            priceDifferencePercent: ((bestMatch.price - baseItem.price) / baseItem.price * 100).toFixed(1)
          });
          
          // Remove matched item from unmatched list
          const matchIndex = unmatchedPrice.indexOf(bestMatch);
          if (matchIndex > -1) {
            unmatchedPrice.splice(matchIndex, 1);
          }
        } else {
          unmatchedBase.push(baseItem);
        }
      }

      return {
        comparison: {
          mode: 'price-only',
          priceMatches,
          unmatchedBase,
          unmatchedPrice,
          statistics: {
            totalBaseItems: baseItems.length,
            totalPriceItems: priceItems.length,
            matched: priceMatches.length,
            unmatchedInBase: unmatchedBase.length,
            unmatchedInPriceSource: unmatchedPrice.length,
            averagePriceDifference: priceMatches.length > 0
              ? (priceMatches.reduce((sum, m) => sum + m.priceDifference, 0) / priceMatches.length).toFixed(2)
              : 0
          }
        }
      };
    } catch (error) {
      console.error('Price comparison error:', error);
      throw error;
    }
  }

  /**
   * Calculate name similarity for price matching
   */
  calculateNameSimilarity(name1, name2) {
    // Simple Levenshtein-based similarity
    // For now, using exact match after normalization
    if (name1 === name2) return 1;
    
    // Check if one contains the other
    if (name1.includes(name2) || name2.includes(name1)) return 0.9;
    
    // Calculate character overlap
    const set1 = new Set(name1.split(''));
    const set2 = new Set(name2.split(''));
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return intersection.size / union.size;
  }

  /**
   * Normalize item name for comparison
   */
  normalizeItemName(name) {
    return name
      .toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove special characters
      .replace(/\s+/g, ' ')     // Normalize whitespace
      .trim();
  }

  /**
   * Preview merged menu based on decisions
   */
  async previewMerge(menuIds, decisions, includeUnique = {}, mergeMode = 'full') {
    try {
      const mergedItems = [];
      const processedDuplicates = new Set();

      // Process duplicate decisions
      for (const [groupId, decision] of Object.entries(decisions)) {
        if (decision.action === 'exclude') {
          continue;
        }

        // Get items in this duplicate group
        const { data: duplicates, error } = await this.supabase
          .rpc('find_duplicate_items', {
            menu_ids: menuIds,
            threshold: this.DUPLICATE_THRESHOLD
          });

        if (error) {
          console.error('Failed to fetch duplicate group:', error);
          continue;
        }

        const groupDuplicates = duplicates.filter(d => d.group_id === groupId);
        if (groupDuplicates.length === 0) continue;

        const dup = groupDuplicates[0];
        let selectedItem = null;

        if (decision.action === 'keep_menu1') {
          selectedItem = dup.item1_data;
        } else if (decision.action === 'keep_menu2') {
          selectedItem = dup.item2_data;
        } else if (decision.action === 'custom' && decision.customFields) {
          // Build custom merged item
          selectedItem = this.buildCustomItem(
            [dup.item1_data, dup.item2_data],
            decision.customFields
          );
        }

        if (selectedItem) {
          mergedItems.push(selectedItem);
          processedDuplicates.add(dup.item1_id);
          processedDuplicates.add(dup.item2_id);
        }
      }

      // Add unique items
      for (const [menuId, itemIds] of Object.entries(includeUnique)) {
        const { data: items, error } = await this.supabase
          .from('menu_items')
          .select(`
            *,
            categories (name),
            item_images (url)
          `)
          .in('id', itemIds)
          .eq('menu_id', menuId);

        if (error) {
          console.error('Failed to fetch unique items:', error);
          continue;
        }

        items.forEach(item => {
          if (!processedDuplicates.has(item.id)) {
            mergedItems.push({
              id: item.id,
              name: item.name,
              price: item.price,
              description: item.description,
              categoryName: item.categories?.name,
              tags: item.tags,
              imageURL: item.item_images?.[0]?.url
            });
          }
        });
      }

      // Group items by category
      const categorizedItems = {};
      mergedItems.forEach(item => {
        const category = item.categoryName || 'Uncategorized';
        if (!categorizedItems[category]) {
          categorizedItems[category] = [];
        }
        categorizedItems[category].push(item);
      });

      return {
        preview: {
          menu: {
            name: 'Merged Menu (Preview)',
            itemCount: mergedItems.length,
            categories: Object.keys(categorizedItems).map(name => ({
              name,
              itemCount: categorizedItems[name].length
            })),
            items: mergedItems
          },
          changes: {
            added: mergedItems.length,
            modified: Object.values(decisions).filter(d => d.action === 'custom').length,
            excluded: Object.values(decisions).filter(d => d.action === 'exclude').length
          }
        }
      };
    } catch (error) {
      console.error('Preview error:', error);
      throw error;
    }
  }

  /**
   * Build custom item from field selections
   */
  buildCustomItem(items, customFields) {
    const customItem = {};
    
    // Start with base fields from first item
    const baseItem = items[0];
    customItem.name = baseItem.name;
    customItem.price = baseItem.price;
    customItem.description = baseItem.description;
    customItem.categoryName = baseItem.categoryName;
    customItem.tags = baseItem.tags || [];
    customItem.imageURL = baseItem.imageURL;
    
    // Apply custom field selections
    for (const [field, selection] of Object.entries(customFields)) {
      const sourceIndex = parseInt(selection.source.replace('menu', '')) - 1;
      if (items[sourceIndex]) {
        // Map 'image' field to 'imageURL' for consistency
        const targetField = field === 'image' ? 'imageURL' : field;
        customItem[targetField] = selection.value || items[sourceIndex][targetField];
      }
    }
    
    // Normalize category name
    if (customItem.categoryName) {
      customItem.categoryName = this.normalizeCategoryName(customItem.categoryName);
    }
    
    console.log('Built custom item:', customItem);
    
    return customItem;
  }
  
  /**
   * Normalize category names for consistency
   */
  normalizeCategoryName(categoryName) {
    if (!categoryName) return categoryName;
    
    // Use database normalization mappings
    const mappings = {
      'BURRITOS': 'Burritos',
      'NACHOS': 'Nachos',
      'QUESADILLA': 'Quesadilla',
      'DRINKS': 'Drinks',
      'SWEET': 'Sweet',
      'SIDES & SNACKS': 'Sides & Snacks',
      'TACO SALAD': 'Taco Salad',
      'Taco Salads': 'Taco Salad',
      'Featured items': 'Featured Items',
      'Kids\' Meals': 'Kids',
      'KIDS': 'Kids',
      'GREEN SALADS': 'Green Salads'
    };
    
    return mappings[categoryName] || categoryName;
  }
  
  /**
   * Get category mappings for display
   */
  getCategoryMappings(categories) {
    if (!categories) return [];
    
    const mappings = [];
    const seenMappings = new Set();
    
    categories.forEach(cat => {
      const normalized = this.normalizeCategoryName(cat.name);
      if (normalized !== cat.name) {
        const mappingKey = `${cat.name}=>${normalized}`;
        if (!seenMappings.has(mappingKey)) {
          mappings.push({
            original: cat.name,
            normalized: normalized,
            menuId: cat.menu_id
          });
          seenMappings.add(mappingKey);
        }
      }
    });
    
    return mappings;
  }

  /**
   * Execute merge and create new menu
   */
  async executeMerge(menuIds, decisions, includeUnique = {}, mergeMode = 'full', menuName, performedBy = null) {
    try {
      console.log('=== EXECUTE MERGE START ===');
      console.log('Menu IDs:', menuIds);
      console.log('Decisions count:', Object.keys(decisions).length);
      console.log('Decision types:', Object.values(decisions).map(d => d.action));
      
      // Get restaurant info
      const { data: sourceMenus, error: menuError } = await this.supabase
        .from('menus')
        .select('restaurant_id')
        .in('id', menuIds)
        .limit(1)
        .single();

      if (menuError) {
        throw new Error(`Failed to fetch source menu: ${menuError.message}`);
      }

      // Get the merged platform ID
      const { data: mergedPlatform, error: platformError } = await this.supabase
        .from('platforms')
        .select('id')
        .eq('name', 'merged')
        .single();

      if (platformError) {
        console.error('Failed to fetch merged platform:', platformError);
        throw new Error('Failed to fetch merged platform');
      }

      // Create merge configuration
      const mergeConfig = {
        decisions,
        sourceMenus: menuIds,
        timestamp: new Date().toISOString(),
        mergeMode
      };

      // Call database function to create merged menu
      const { data: newMenuId, error: createError } = await this.supabase
        .rpc('create_merged_menu', {
          p_restaurant_id: sourceMenus.restaurant_id,
          p_source_menu_ids: menuIds,
          p_platform_id: mergedPlatform.id,
          p_merge_config: mergeConfig,
          p_performed_by: performedBy
        });

      if (createError) {
        throw new Error(`Failed to create merged menu: ${createError.message}`);
      }

      console.log('Created new menu ID:', newMenuId);

      // Process and insert merged items
      const mergedItems = await this.buildMergedItems(menuIds, decisions, includeUnique);
      console.log('Built merged items count:', mergedItems.length);
      console.log('Sample merged item:', mergedItems[0]);
      
      // Insert items into the new menu
      if (mergedItems.length > 0) {
        // First, get or create categories for the new menu
        // Ensure all items have a category (use "Uncategorized" as fallback)
        const categorizedItems = mergedItems.map(item => ({
          ...item,
          categoryName: item.categoryName || 'Uncategorized'
        }));
        
        const categories = [...new Set(categorizedItems.map(item => item.categoryName))];
        const categoryMap = {};

        for (const categoryName of categories) {
          const { data: category, error: catError } = await this.supabase
            .from('categories')
            .insert({
              menu_id: newMenuId,
              name: categoryName
            })
            .select()
            .single();

          if (!catError && category) {
            categoryMap[categoryName] = category.id;
          } else if (catError) {
            console.error(`Failed to create category "${categoryName}":`, catError);
            // Try to get existing category if insert failed due to uniqueness
            const { data: existingCat } = await this.supabase
              .from('categories')
              .select('id')
              .eq('menu_id', newMenuId)
              .eq('name', categoryName)
              .single();
            
            if (existingCat) {
              categoryMap[categoryName] = existingCat.id;
            }
          }
        }

        // Insert menu items
        const itemsToInsert = categorizedItems
          .filter(item => {
            if (!item.name) {
              console.error('Item with null name:', item);
              return false;
            }
            if (!categoryMap[item.categoryName]) {
              console.warn(`Skipping item "${item.name}" - no category mapping for "${item.categoryName}"`);
              return false;
            }
            return true;
          })
          .map(item => ({
            menu_id: newMenuId,
            category_id: categoryMap[item.categoryName],
            name: item.name,
            price: item.price,
            description: item.description,
            tags: item.tags || []
          }));
        
        console.log('Items to insert count:', itemsToInsert.length);
        console.log('Sample items to insert:', itemsToInsert.slice(0, 2));

        const { data: insertedItems, error: insertError } = await this.supabase
          .from('menu_items')
          .insert(itemsToInsert)
          .select();

        if (insertError) {
          console.error('Failed to insert menu items:', insertError);
          throw new Error(`Failed to insert menu items: ${insertError.message}`);
        }

        // Insert item images if any
        const imageInserts = [];
        const filteredItems = categorizedItems.filter(item => categoryMap[item.categoryName]);
        
        insertedItems.forEach((item, index) => {
          if (filteredItems[index]?.imageURL) {
            imageInserts.push({
              menu_item_id: item.id,
              url: filteredItems[index].imageURL
            });
          }
        });

        if (imageInserts.length > 0) {
          await this.supabase
            .from('item_images')
            .insert(imageInserts);
        }
      }

      // Record merge decisions
      const { data: mergeOperation, error: opError } = await this.supabase
        .from('merge_operations')
        .select('id')
        .eq('result_menu_id', newMenuId)
        .single();

      if (!opError && mergeOperation) {
        const decisionRecords = Object.entries(decisions).map(([groupId, decision]) => ({
          merge_operation_id: mergeOperation.id,
          item_group_id: groupId,
          decision_type: decision.action,
          custom_selection: decision.customFields || {},
          similarity_score: decision.similarity || null
        }));

        await this.supabase
          .from('merge_decisions')
          .insert(decisionRecords);
      }

      return {
        success: true,
        menuId: newMenuId,
        statistics: {
          itemsCreated: mergedItems.length,
          duplicatesResolved: Object.keys(decisions).length,
          executionTime: Date.now()
        }
      };
    } catch (error) {
      console.error('Merge execution error:', error);
      throw error;
    }
  }

  /**
   * Build final merged items based on decisions
   */
  async buildMergedItems(menuIds, decisions, includeUnique = {}) {
    console.log('=== BUILD MERGED ITEMS START ===');
    console.log('Include unique settings:', includeUnique);
    const mergedItems = [];
    const processedIds = new Set();

    // Get all duplicate groups including sub-duplicates
    const { data: duplicates, error: dupError } = await this.supabase
      .rpc('find_duplicate_items_with_groups', {
        menu_ids: menuIds,
        threshold: this.DUPLICATE_THRESHOLD
      });

    if (dupError) {
      throw new Error(`Failed to fetch duplicates: ${dupError.message}`);
    }

    console.log('Found duplicates count:', duplicates.length);

    // Group by master_group_id to handle all related duplicates together
    const duplicatesByMaster = {};
    duplicates.forEach(dup => {
      const masterKey = dup.master_group_id || dup.group_id;
      if (!duplicatesByMaster[masterKey]) {
        duplicatesByMaster[masterKey] = {
          master: null,
          subDuplicates: []
        };
      }
      if (dup.is_master) {
        duplicatesByMaster[masterKey].master = dup;
      } else {
        duplicatesByMaster[masterKey].subDuplicates.push(dup);
      }
    });

    console.log('Duplicate groups count:', Object.keys(duplicatesByMaster).length);
    console.log('Processing decisions...');

    // Process duplicate decisions - apply master decision to all sub-duplicates
    for (const [groupId, decision] of Object.entries(decisions)) {
      console.log(`Processing decision for group ${groupId}: ${decision.action}`);
      if (decision.action === 'exclude') {
        continue;
      }

      const duplicateGroup = duplicatesByMaster[groupId];
      if (!duplicateGroup || !duplicateGroup.master) continue;

      // Only process the master duplicate - the decision applies to all sub-duplicates
      const masterDup = duplicateGroup.master;
      let selectedItem = null;
      
      // Mark all items in the group as processed
      processedIds.add(masterDup.item1_data.id);
      processedIds.add(masterDup.item2_data.id);
      
      // Check if we should include Featured Items versions
      // We'll include Featured Items if the decision includes them
      const includeFeaturedVersions = decision.includeFeatured !== false; // Default to true
      
      // Process sub-duplicates (Featured Items)
      duplicateGroup.subDuplicates.forEach(subDup => {
        processedIds.add(subDup.item1_data.id);
        processedIds.add(subDup.item2_data.id);
        
        // Add Featured Item versions if they should be included
        if (includeFeaturedVersions) {
          const item1IsFeatured = subDup.item1_data.categoryName && 
            subDup.item1_data.categoryName.toLowerCase().includes('featured');
          const item2IsFeatured = subDup.item2_data.categoryName && 
            subDup.item2_data.categoryName.toLowerCase().includes('featured');
          
          if (item1IsFeatured || item2IsFeatured) {
            let featuredItem = null;
            
            if (decision.action === 'keep_menu1' && item1IsFeatured) {
              featuredItem = subDup.item1_data;
            } else if (decision.action === 'keep_menu2' && item2IsFeatured) {
              featuredItem = subDup.item2_data;
            } else if (decision.action === 'keep_menu1' && item2IsFeatured) {
              // If keeping menu1 but featured is in menu2, use menu2's featured
              featuredItem = subDup.item2_data;
            } else if (decision.action === 'keep_menu2' && item1IsFeatured) {
              // If keeping menu2 but featured is in menu1, use menu1's featured
              featuredItem = subDup.item1_data;
            } else if (decision.action === 'custom' && decision.customFields) {
              // Use the same custom decision for featured version
              featuredItem = this.buildCustomItem(
                [subDup.item1_data, subDup.item2_data],
                decision.customFields
              );
            }
            
            if (featuredItem && !mergedItems.some(item => 
              item.name === featuredItem.name && 
              item.categoryName === 'Featured Items'
            )) {
              // Use description from the master item if Featured Item description is empty
              // Featured Items often don't have descriptions, but the main category items do
              let description = featuredItem.description;
              if (!description || description.trim() === '') {
                // Try to get description from the corresponding master item
                if (decision.action === 'keep_menu1') {
                  description = masterDup.item1_data.description || '';
                } else if (decision.action === 'keep_menu2') {
                  description = masterDup.item2_data.description || '';
                } else if (decision.action === 'custom') {
                  // For custom, use the description from the featuredItem which was built with custom logic
                  // If it's still empty, try the master item descriptions
                  if (!description) {
                    description = masterDup.item1_data.description || masterDup.item2_data.description || '';
                  }
                }
              }
              
              mergedItems.push({
                name: featuredItem.name,
                price: featuredItem.price,
                description: description,
                categoryName: 'Featured Items',
                tags: featuredItem.tags || [],
                imageURL: featuredItem.imageURL
              });
            }
          }
        }
      });

      if (decision.action === 'keep_menu1') {
        selectedItem = masterDup.item1_data;
      } else if (decision.action === 'keep_menu2') {
        selectedItem = masterDup.item2_data;
      } else if (decision.action === 'keep_both') {
        // For keep_both, add both items from the master pair only
        mergedItems.push({ 
          name: masterDup.item1_data.name,
          price: masterDup.item1_data.price,
          description: masterDup.item1_data.description,
          categoryName: this.normalizeCategoryName(masterDup.item1_data.categoryName),
          tags: masterDup.item1_data.tags || [],
          imageURL: masterDup.item1_data.imageURL
        });
        mergedItems.push({ 
          name: masterDup.item2_data.name,
          price: masterDup.item2_data.price,
          description: masterDup.item2_data.description,
          categoryName: this.normalizeCategoryName(masterDup.item2_data.categoryName),
          tags: masterDup.item2_data.tags || [],
          imageURL: masterDup.item2_data.imageURL
        });
        continue; // Move to next group
      } else if (decision.action === 'custom' && decision.customFields) {
        selectedItem = this.buildCustomItem(
          [masterDup.item1_data, masterDup.item2_data],
          decision.customFields
        );
      }

      if (selectedItem) {
        // Add the selected item once with normalized category
        mergedItems.push({
          name: selectedItem.name,
          price: selectedItem.price,
          description: selectedItem.description,
          categoryName: this.normalizeCategoryName(selectedItem.categoryName),
          tags: selectedItem.tags || [],
          imageURL: selectedItem.imageURL
        });
      }
    }

    // Add unique items that weren't processed as duplicates
    for (const menuId of menuIds) {
      // Check if this menu has unique items to include
      const uniqueItemIds = includeUnique[menuId] || [];
      
      if (uniqueItemIds.length === 0) {
        console.log(`Skipping unique items for menu ${menuId} - none selected`);
        continue;
      }
      
      const { data: items, error } = await this.supabase
        .from('menu_items')
        .select(`
          *,
          categories (name),
          item_images (url)
        `)
        .eq('menu_id', menuId)
        .in('id', uniqueItemIds);

      if (error) {
        console.error(`Failed to fetch items for menu ${menuId}:`, error);
        continue;
      }

      console.log(`Adding ${items.length} unique items from menu ${menuId}`);
      
      items.forEach(item => {
        if (!processedIds.has(item.id)) {
          mergedItems.push({
            name: item.name,
            price: item.price,
            description: item.description,
            categoryName: this.normalizeCategoryName(item.categories?.name),
            tags: item.tags,
            imageURL: item.item_images?.[0]?.url
          });
        }
      });
    }

    console.log('=== BUILD MERGED ITEMS END ===');
    console.log('Total merged items:', mergedItems.length);
    console.log('Processed IDs count:', processedIds.size);
    
    // Validate all items before returning
    const invalidItems = mergedItems.filter(item => !item.name);
    if (invalidItems.length > 0) {
      console.error('Found items with null/undefined names:');
      invalidItems.forEach((item, index) => {
        console.error(`Invalid item ${index}:`, JSON.stringify(item));
      });
    }
    
    // Filter out any items without names
    const validItems = mergedItems.filter(item => item.name);
    console.log(`Returning ${validItems.length} valid items (filtered ${mergedItems.length - validItems.length} invalid items)`);
    
    return validItems;
  }
}

module.exports = new MenuMergeService();