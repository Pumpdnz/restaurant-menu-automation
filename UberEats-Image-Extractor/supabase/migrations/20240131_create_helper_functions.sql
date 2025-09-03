-- Migration: Create helper functions for option sets management
-- Date: 2024-01-31
-- Description: Creates utility functions for working with option sets

-- Function 1: Get option sets for a menu item with all details
CREATE OR REPLACE FUNCTION get_menu_item_option_sets(
  p_menu_item_id UUID,
  p_organisation_id UUID
)
RETURNS TABLE (
  option_set_id UUID,
  option_set_name VARCHAR,
  option_set_type VARCHAR,
  is_required BOOLEAN,
  min_selections INTEGER,
  max_selections INTEGER,
  display_order INTEGER,
  options JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check access
  IF NOT has_org_access(p_organisation_id) THEN
    RAISE EXCEPTION 'Access denied to organisation';
  END IF;
  
  RETURN QUERY
  SELECT 
    os.id AS option_set_id,
    os.name AS option_set_name,
    os.type AS option_set_type,
    os.is_required,
    os.min_selections,
    os.max_selections,
    os.display_order,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', osi.id,
          'name', osi.name,
          'description', osi.description,
          'price', osi.price,
          'price_display', osi.price_display,
          'is_default', osi.is_default,
          'is_available', osi.is_available,
          'display_order', osi.display_order
        ) ORDER BY osi.display_order, osi.name
      ) FILTER (WHERE osi.id IS NOT NULL),
      '[]'::jsonb
    ) AS options
  FROM public.option_sets os
  LEFT JOIN public.option_set_items osi 
    ON osi.option_set_id = os.id 
    AND osi.organisation_id = p_organisation_id
  WHERE os.menu_item_id = p_menu_item_id
    AND os.organisation_id = p_organisation_id
  GROUP BY 
    os.id, 
    os.name, 
    os.type, 
    os.is_required, 
    os.min_selections, 
    os.max_selections, 
    os.display_order
  ORDER BY os.display_order, os.name;
END;
$$;

-- Function 2: Clone option sets from one menu item to another
CREATE OR REPLACE FUNCTION clone_menu_item_option_sets(
  p_source_menu_item_id UUID,
  p_target_menu_item_id UUID,
  p_organisation_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cloned_count INTEGER := 0;
  v_option_set RECORD;
  v_new_option_set_id UUID;
BEGIN
  -- Check access
  IF NOT has_org_access(p_organisation_id) THEN
    RAISE EXCEPTION 'Access denied to organisation';
  END IF;
  
  -- Clone each option set
  FOR v_option_set IN 
    SELECT * FROM public.option_sets 
    WHERE menu_item_id = p_source_menu_item_id 
      AND organisation_id = p_organisation_id
  LOOP
    -- Insert the option set
    INSERT INTO public.option_sets (
      menu_item_id, organisation_id, name, description, type,
      min_selections, max_selections, is_required, display_order
    ) VALUES (
      p_target_menu_item_id, p_organisation_id, v_option_set.name, 
      v_option_set.description, v_option_set.type,
      v_option_set.min_selections, v_option_set.max_selections, 
      v_option_set.is_required, v_option_set.display_order
    ) RETURNING id INTO v_new_option_set_id;
    
    -- Clone all options for this set
    INSERT INTO public.option_set_items (
      option_set_id, organisation_id, name, description, price,
      price_display, is_default, is_available, display_order, metadata
    )
    SELECT 
      v_new_option_set_id, organisation_id, name, description, price,
      price_display, is_default, is_available, display_order, metadata
    FROM public.option_set_items
    WHERE option_set_id = v_option_set.id
      AND organisation_id = p_organisation_id;
    
    v_cloned_count := v_cloned_count + 1;
  END LOOP;
  
  -- Mark the target item as having option sets
  UPDATE public.menu_items 
  SET has_option_sets = true
  WHERE id = p_target_menu_item_id 
    AND organisation_id = p_organisation_id;
  
  RETURN v_cloned_count;
END;
$$;

-- Function 3: Validate placeholder images
CREATE OR REPLACE FUNCTION is_placeholder_image(p_image_url TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_image_url IS NULL THEN
    RETURN true;
  END IF;
  
  -- Check for known placeholder patterns
  RETURN p_image_url LIKE '%/_static/8ab3af80072120d4.png%'
      OR p_image_url LIKE '%/_static/29ed4bc0793fd578.svg%'
      OR p_image_url LIKE '%/placeholder%'
      OR p_image_url LIKE '%/no-image%'
      OR p_image_url LIKE '%/default%'
      OR p_image_url LIKE '%/missing%';
END;
$$;

-- Function 4: Get menu items needing option set extraction
CREATE OR REPLACE FUNCTION get_menu_items_for_option_extraction(
  p_menu_id UUID,
  p_organisation_id UUID,
  p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
  menu_item_id UUID,
  menu_item_name VARCHAR,
  modal_url TEXT,
  has_option_sets BOOLEAN,
  extraction_method VARCHAR
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check access
  IF NOT has_org_access(p_organisation_id) THEN
    RAISE EXCEPTION 'Access denied to organisation';
  END IF;
  
  RETURN QUERY
  SELECT 
    mi.id AS menu_item_id,
    mi.name AS menu_item_name,
    mi.modal_url,
    mi.has_option_sets,
    mi.extraction_method
  FROM public.menu_items mi
  WHERE mi.menu_id = p_menu_id
    AND mi.organisation_id = p_organisation_id
    AND mi.modal_url IS NOT NULL
    AND (
      mi.has_option_sets = false 
      OR mi.option_sets_extracted_at IS NULL
      OR mi.option_sets_extracted_at < NOW() - INTERVAL '30 days'
    )
  ORDER BY 
    mi.has_option_sets ASC,  -- Prioritize items without option sets
    mi.option_sets_extracted_at ASC NULLS FIRST
  LIMIT p_limit;
END;
$$;

-- Function 5: Generate option sets CSV export
CREATE OR REPLACE FUNCTION export_option_sets_csv(
  p_menu_id UUID,
  p_organisation_id UUID
)
RETURNS TABLE (
  csv_line TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check access
  IF NOT has_org_access(p_organisation_id) THEN
    RAISE EXCEPTION 'Access denied to organisation';
  END IF;
  
  -- Return CSV header
  RETURN QUERY SELECT 'MenuItem,OptionSet,Required,MinSelect,MaxSelect,OptionName,OptionPrice,PriceDisplay'::TEXT;
  
  -- Return CSV data rows
  RETURN QUERY
  SELECT 
    format(
      '"%s","%s",%s,%s,%s,"%s",%s,"%s"',
      replace(mi.name, '"', '""'),
      replace(os.name, '"', '""'),
      os.is_required::TEXT,
      os.min_selections::TEXT,
      os.max_selections::TEXT,
      replace(osi.name, '"', '""'),
      COALESCE(osi.price::TEXT, '0'),
      replace(COALESCE(osi.price_display, ''), '"', '""')
    ) AS csv_line
  FROM public.menu_items mi
  INNER JOIN public.option_sets os 
    ON os.menu_item_id = mi.id 
    AND os.organisation_id = p_organisation_id
  LEFT JOIN public.option_set_items osi 
    ON osi.option_set_id = os.id 
    AND osi.organisation_id = p_organisation_id
  WHERE mi.menu_id = p_menu_id
    AND mi.organisation_id = p_organisation_id
  ORDER BY 
    mi.name, 
    os.display_order, 
    os.name, 
    osi.display_order, 
    osi.name;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_menu_item_option_sets TO authenticated;
GRANT EXECUTE ON FUNCTION clone_menu_item_option_sets TO authenticated;
GRANT EXECUTE ON FUNCTION is_placeholder_image TO authenticated;
GRANT EXECUTE ON FUNCTION get_menu_items_for_option_extraction TO authenticated;
GRANT EXECUTE ON FUNCTION export_option_sets_csv TO authenticated;

-- Add comments
COMMENT ON FUNCTION get_menu_item_option_sets IS 'Retrieves all option sets and their items for a specific menu item';
COMMENT ON FUNCTION clone_menu_item_option_sets IS 'Clones all option sets from one menu item to another';
COMMENT ON FUNCTION is_placeholder_image IS 'Checks if an image URL is a known placeholder';
COMMENT ON FUNCTION get_menu_items_for_option_extraction IS 'Gets menu items that need option set extraction';
COMMENT ON FUNCTION export_option_sets_csv IS 'Exports option sets data as CSV format';