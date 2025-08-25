-- Migration: Create database functions for menu merge operations
-- Date: 2025-08-22
-- Description: Creates helper functions for menu merging functionality

-- Function to calculate similarity between two menu items
CREATE OR REPLACE FUNCTION calculate_item_similarity(
  item1 JSONB,
  item2 JSONB
) RETURNS DECIMAL(3,2) AS $$
DECLARE
  name_similarity DECIMAL(3,2);
  price_similarity DECIMAL(3,2);
  desc_similarity DECIMAL(3,2);
  total_similarity DECIMAL(3,2);
BEGIN
  -- Calculate name similarity using trigram similarity
  name_similarity := similarity(
    LOWER(item1->>'name'), 
    LOWER(item2->>'name')
  );
  
  -- Calculate price similarity (within 10% = full match)
  IF (item1->>'price')::DECIMAL > 0 AND (item2->>'price')::DECIMAL > 0 THEN
    price_similarity := CASE 
      WHEN ABS((item1->>'price')::DECIMAL - (item2->>'price')::DECIMAL) / 
           GREATEST((item1->>'price')::DECIMAL, (item2->>'price')::DECIMAL) <= 0.1 
      THEN 1.0
      ELSE 1.0 - (ABS((item1->>'price')::DECIMAL - (item2->>'price')::DECIMAL) / 
           GREATEST((item1->>'price')::DECIMAL, (item2->>'price')::DECIMAL))
    END;
  ELSE
    price_similarity := 0;
  END IF;
  
  -- Calculate description similarity
  IF item1->>'description' IS NOT NULL AND item2->>'description' IS NOT NULL THEN
    desc_similarity := similarity(
      LOWER(item1->>'description'), 
      LOWER(item2->>'description')
    );
  ELSE
    desc_similarity := 0;
  END IF;
  
  -- Calculate weighted total (40% name, 30% description, 20% price, 10% category)
  total_similarity := (name_similarity * 0.4) + 
                     (desc_similarity * 0.3) + 
                     (price_similarity * 0.2) +
                     (CASE WHEN item1->>'categoryName' = item2->>'categoryName' THEN 0.1 ELSE 0 END);
  
  RETURN LEAST(total_similarity, 1.0);
END;
$$ LANGUAGE plpgsql;

-- Function to find duplicate items across menus
CREATE OR REPLACE FUNCTION find_duplicate_items(
  menu_ids UUID[],
  threshold DECIMAL(3,2) DEFAULT 0.85
) RETURNS TABLE(
  group_id VARCHAR(255),
  item1_id UUID,
  item1_menu_id UUID,
  item1_data JSONB,
  item2_id UUID,
  item2_menu_id UUID,
  item2_data JSONB,
  similarity_score DECIMAL(3,2)
) AS $$
BEGIN
  RETURN QUERY
  WITH menu_items_cte AS (
    SELECT 
      mi.id as item_id,
      mi.menu_id,
      mi.name,
      mi.price,
      mi.description,
      c.name as category_name,
      jsonb_build_object(
        'id', mi.id,
        'menu_id', mi.menu_id,
        'name', mi.name,
        'price', mi.price,
        'description', mi.description,
        'categoryName', c.name,
        'tags', mi.tags
      ) as item_data
    FROM menu_items mi
    JOIN categories c ON mi.category_id = c.id
    WHERE mi.menu_id = ANY(menu_ids)
  )
  SELECT 
    MD5(CONCAT(mi1.item_id::TEXT, '-', mi2.item_id::TEXT)) as group_id,
    mi1.item_id as item1_id,
    mi1.menu_id as item1_menu_id,
    mi1.item_data as item1_data,
    mi2.item_id as item2_id,
    mi2.menu_id as item2_menu_id,
    mi2.item_data as item2_data,
    calculate_item_similarity(mi1.item_data, mi2.item_data) as similarity_score
  FROM menu_items_cte mi1
  CROSS JOIN menu_items_cte mi2
  WHERE mi1.menu_id < mi2.menu_id  -- Avoid duplicate pairs
    AND calculate_item_similarity(mi1.item_data, mi2.item_data) >= threshold;
END;
$$ LANGUAGE plpgsql;

-- Function to get unique items from specified menus
CREATE OR REPLACE FUNCTION get_unique_menu_items(
  menu_ids UUID[],
  exclude_duplicates BOOLEAN DEFAULT TRUE
) RETURNS TABLE(
  item_id UUID,
  menu_id UUID,
  item_data JSONB
) AS $$
BEGIN
  IF exclude_duplicates THEN
    -- Return items that don't have duplicates in other menus
    RETURN QUERY
    WITH all_items AS (
      SELECT 
        mi.id as item_id,
        mi.menu_id,
        jsonb_build_object(
          'id', mi.id,
          'menu_id', mi.menu_id,
          'name', mi.name,
          'price', mi.price,
          'description', mi.description,
          'categoryName', c.name,
          'tags', mi.tags,
          'imageURL', (SELECT url FROM item_images WHERE menu_item_id = mi.id LIMIT 1)
        ) as item_data
      FROM menu_items mi
      JOIN categories c ON mi.category_id = c.id
      WHERE mi.menu_id = ANY(menu_ids)
    ),
    duplicates AS (
      SELECT DISTINCT item1_id, item2_id
      FROM find_duplicate_items(menu_ids, 0.85)
    )
    SELECT ai.*
    FROM all_items ai
    WHERE NOT EXISTS (
      SELECT 1 FROM duplicates d 
      WHERE d.item1_id = ai.item_id OR d.item2_id = ai.item_id
    );
  ELSE
    -- Return all items
    RETURN QUERY
    SELECT 
      mi.id as item_id,
      mi.menu_id,
      jsonb_build_object(
        'id', mi.id,
        'menu_id', mi.menu_id,
        'name', mi.name,
        'price', mi.price,
        'description', mi.description,
        'categoryName', c.name,
        'tags', mi.tags,
        'imageURL', (SELECT url FROM item_images WHERE menu_item_id = mi.id LIMIT 1)
      ) as item_data
    FROM menu_items mi
    JOIN categories c ON mi.category_id = c.id
    WHERE mi.menu_id = ANY(menu_ids);
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to create a merged menu
CREATE OR REPLACE FUNCTION create_merged_menu(
  p_restaurant_id UUID,
  p_source_menu_ids UUID[],
  p_platform_id UUID,
  p_merge_config JSONB,
  p_performed_by VARCHAR(255) DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_new_menu_id UUID;
  v_merge_operation_id UUID;
  v_max_version INTEGER;
BEGIN
  -- Get the max version for this restaurant/platform
  SELECT COALESCE(MAX(version), 0) + 1 INTO v_max_version
  FROM menus
  WHERE restaurant_id = p_restaurant_id 
    AND platform_id = p_platform_id;
  
  -- Create the new merged menu
  INSERT INTO menus (
    restaurant_id,
    platform_id,
    version,
    is_active,
    is_merged,
    merge_source_ids,
    menu_data
  ) VALUES (
    p_restaurant_id,
    p_platform_id,
    v_max_version,
    FALSE,  -- Not active by default
    TRUE,   -- Is a merged menu
    p_source_menu_ids,
    '{}'::JSONB
  ) RETURNING id INTO v_new_menu_id;
  
  -- Create merge operation record
  INSERT INTO merge_operations (
    restaurant_id,
    source_menu_ids,
    result_menu_id,
    merge_config,
    performed_by
  ) VALUES (
    p_restaurant_id,
    p_source_menu_ids,
    v_new_menu_id,
    p_merge_config,
    p_performed_by
  ) RETURNING id INTO v_merge_operation_id;
  
  -- Update the menu with the merge operation ID
  UPDATE menus 
  SET merge_operation_id = v_merge_operation_id
  WHERE id = v_new_menu_id;
  
  RETURN v_new_menu_id;
END;
$$ LANGUAGE plpgsql;

-- Add trigram extension if not exists (needed for similarity function)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Add comments
COMMENT ON FUNCTION calculate_item_similarity IS 'Calculates similarity score between two menu items (0.00-1.00)';
COMMENT ON FUNCTION find_duplicate_items IS 'Finds duplicate items across multiple menus based on similarity threshold';
COMMENT ON FUNCTION get_unique_menu_items IS 'Gets unique items from specified menus, optionally excluding duplicates';
COMMENT ON FUNCTION create_merged_menu IS 'Creates a new menu from merging multiple source menus';