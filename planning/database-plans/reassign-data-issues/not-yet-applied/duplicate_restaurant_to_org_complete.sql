-- =====================================================================
-- Migration: Complete duplicate_restaurant_to_org function
-- =====================================================================
-- Description: Duplicates a restaurant and ALL related data to another organization
--   Including: restaurants, menus, categories, menu_items, item_images,
--   option_sets, option_set_items, menu_item_option_sets, tasks
--
-- Changes from original:
--   - Added category duplication with ID mapping
--   - Added menu_item ID mapping (CRITICAL)
--   - Added item_images duplication
--   - Added option_sets duplication with ID mapping
--   - Added option_set_items duplication
--   - Added menu_item_option_sets duplication
--   - Added tasks duplication (pending/active only, cleared user assignments)
--   - Returns JSONB with detailed counts
--   - Proper error handling and logging
-- =====================================================================

-- Drop existing function
DROP FUNCTION IF EXISTS duplicate_restaurant_to_org(UUID, UUID);

-- Create complete function with SECURITY DEFINER to bypass RLS
CREATE OR REPLACE FUNCTION duplicate_restaurant_to_org(
  p_restaurant_id UUID,
  p_target_org_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_restaurant_id UUID;
  v_source_org_id UUID;
  v_old_menu_id UUID;
  v_new_menu_id UUID;
  v_old_category_id UUID;
  v_new_category_id UUID;
  v_old_menu_item_id UUID;
  v_new_menu_item_id UUID;
  v_old_option_set_id UUID;
  v_new_option_set_id UUID;

  v_menu_mapping JSONB := '{}';
  v_category_mapping JSONB := '{}';
  v_menu_item_mapping JSONB := '{}';
  v_option_set_mapping JSONB := '{}';

  v_restaurant_count INTEGER := 0;
  v_menu_count INTEGER := 0;
  v_category_count INTEGER := 0;
  v_menu_item_count INTEGER := 0;
  v_option_set_count INTEGER := 0;
  v_option_set_item_count INTEGER := 0;
  v_item_image_count INTEGER := 0;
  v_menu_item_option_set_count INTEGER := 0;
  v_task_count INTEGER := 0;
BEGIN
  -- ===================================================================
  -- VALIDATION
  -- ===================================================================
  SELECT organisation_id INTO v_source_org_id
  FROM restaurants
  WHERE id = p_restaurant_id;

  IF v_source_org_id IS NULL THEN
    RAISE EXCEPTION 'Restaurant with ID % not found', p_restaurant_id;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM organisations WHERE id = p_target_org_id) THEN
    RAISE EXCEPTION 'Target organization with ID % not found', p_target_org_id;
  END IF;

  -- ===================================================================
  -- PHASE 1: Duplicate restaurant
  -- ===================================================================
  INSERT INTO restaurants (
    name,
    platform,
    url,
    location,
    cuisine_type,
    price_range,
    rating,
    review_count,
    image_url,
    phone,
    address,
    hours,
    metadata,
    organisation_id,
    is_active
  )
  SELECT
    name || ' (Copy)',
    platform,
    url,
    location,
    cuisine_type,
    price_range,
    rating,
    review_count,
    image_url,
    phone,
    address,
    hours,
    metadata,
    p_target_org_id,
    is_active
  FROM restaurants
  WHERE id = p_restaurant_id
  RETURNING id INTO v_new_restaurant_id;

  v_restaurant_count := 1;

  -- ===================================================================
  -- PHASE 2-8: Process each menu (with categories, items, images)
  -- ===================================================================
  FOR v_old_menu_id IN
    SELECT id FROM menus WHERE restaurant_id = p_restaurant_id ORDER BY id
  LOOP
    -- Duplicate menu
    INSERT INTO menus (
      restaurant_id,
      name,
      description,
      currency,
      language,
      organisation_id,
      is_active,
      created_at,
      updated_at
    )
    SELECT
      v_new_restaurant_id,
      name,
      description,
      currency,
      language,
      p_target_org_id,
      is_active,
      NOW(),
      NOW()
    FROM menus
    WHERE id = v_old_menu_id
    RETURNING id INTO v_new_menu_id;

    -- Track menu mapping
    v_menu_mapping := v_menu_mapping || jsonb_build_object(v_old_menu_id::text, v_new_menu_id);
    v_menu_count := v_menu_count + 1;

    -- ===================================================================
    -- Duplicate categories for this menu
    -- ===================================================================
    FOR v_old_category_id IN
      SELECT id FROM categories WHERE menu_id = v_old_menu_id ORDER BY id
    LOOP
      INSERT INTO categories (
        menu_id,
        name,
        description,
        display_order,
        organisation_id,
        is_active,
        created_at,
        updated_at
      )
      SELECT
        v_new_menu_id,
        name,
        description,
        display_order,
        p_target_org_id,
        is_active,
        NOW(),
        NOW()
      FROM categories
      WHERE id = v_old_category_id
      RETURNING id INTO v_new_category_id;

      -- Track category mapping
      v_category_mapping := v_category_mapping || jsonb_build_object(v_old_category_id::text, v_new_category_id);
      v_category_count := v_category_count + 1;
    END LOOP;

    -- ===================================================================
    -- Duplicate menu items for this menu
    -- ===================================================================
    FOR v_old_menu_item_id IN
      SELECT id FROM menu_items WHERE menu_id = v_old_menu_id ORDER BY id
    LOOP
      INSERT INTO menu_items (
        menu_id,
        name,
        description,
        price,
        image_url,
        category_id,
        metadata,
        organisation_id,
        is_available,
        display_order,
        created_at,
        updated_at
      )
      SELECT
        v_new_menu_id,
        name,
        description,
        price,
        image_url,
        -- Use mapped category_id if category exists
        CASE
          WHEN category_id IS NOT NULL AND v_category_mapping ? category_id::text
          THEN (v_category_mapping->>category_id::text)::UUID
          ELSE NULL
        END,
        metadata,
        p_target_org_id,
        is_available,
        display_order,
        NOW(),
        NOW()
      FROM menu_items
      WHERE id = v_old_menu_item_id
      RETURNING id INTO v_new_menu_item_id;

      -- Track menu item mapping (CRITICAL for images and option sets)
      v_menu_item_mapping := v_menu_item_mapping || jsonb_build_object(v_old_menu_item_id::text, v_new_menu_item_id);
      v_menu_item_count := v_menu_item_count + 1;

      -- ===================================================================
      -- Duplicate item images for this menu item
      -- ===================================================================
      INSERT INTO item_images (
        menu_item_id,
        url,
        type,
        width,
        height,
        file_size,
        is_downloaded,
        local_path,
        organisation_id,
        cdn_uploaded,
        cdn_id,
        cdn_url,
        cdn_filename,
        cdn_metadata,
        upload_status,
        upload_error,
        created_at
      )
      SELECT
        v_new_menu_item_id,
        url,
        type,
        width,
        height,
        file_size,
        is_downloaded,
        local_path,
        p_target_org_id,
        cdn_uploaded,
        cdn_id,
        cdn_url,
        cdn_filename,
        cdn_metadata,
        upload_status,
        upload_error,
        NOW()
      FROM item_images
      WHERE menu_item_id = v_old_menu_item_id;

      GET DIAGNOSTICS v_item_image_count = v_item_image_count + ROW_COUNT;
    END LOOP;
  END LOOP;

  -- ===================================================================
  -- PHASE 9: Duplicate option sets (collect all unique option sets used)
  -- ===================================================================
  FOR v_old_option_set_id IN
    SELECT DISTINCT os.id
    FROM option_sets os
    JOIN menu_item_option_sets mios ON os.id = mios.option_set_id
    WHERE mios.menu_item_id IN (
      SELECT id FROM menu_items
      WHERE menu_id IN (SELECT id FROM menus WHERE restaurant_id = p_restaurant_id)
    )
    ORDER BY os.id
  LOOP
    INSERT INTO option_sets (
      name,
      type,
      min_selections,
      max_selections,
      is_required,
      organisation_id,
      description,
      display_order,
      multiple_selections_allowed,
      extraction_source,
      extracted_at,
      source_data,
      option_set_hash,
      created_at,
      updated_at
    )
    SELECT
      name,
      type,
      min_selections,
      max_selections,
      is_required,
      p_target_org_id,
      description,
      display_order,
      multiple_selections_allowed,
      extraction_source,
      NOW(),
      source_data,
      option_set_hash,
      NOW(),
      NOW()
    FROM option_sets
    WHERE id = v_old_option_set_id
    RETURNING id INTO v_new_option_set_id;

    -- Track option set mapping
    v_option_set_mapping := v_option_set_mapping || jsonb_build_object(v_old_option_set_id::text, v_new_option_set_id);
    v_option_set_count := v_option_set_count + 1;

    -- ===================================================================
    -- Duplicate option set items for this option set
    -- ===================================================================
    INSERT INTO option_set_items (
      option_set_id,
      name,
      price,
      is_default,
      is_available,
      metadata,
      organisation_id,
      description,
      price_display,
      display_order,
      extraction_source,
      extracted_at,
      created_at
    )
    SELECT
      v_new_option_set_id,
      name,
      price,
      is_default,
      is_available,
      metadata,
      p_target_org_id,
      description,
      price_display,
      display_order,
      extraction_source,
      NOW(),
      NOW()
    FROM option_set_items
    WHERE option_set_id = v_old_option_set_id;

    GET DIAGNOSTICS v_option_set_item_count = v_option_set_item_count + ROW_COUNT;
  END LOOP;

  -- ===================================================================
  -- PHASE 10: Duplicate menu_item_option_sets (junction table)
  -- Links duplicated menu items to duplicated option sets
  -- ===================================================================
  INSERT INTO menu_item_option_sets (
    menu_item_id,
    option_set_id,
    display_order,
    organisation_id,
    created_at
  )
  SELECT
    (v_menu_item_mapping->>mios.menu_item_id::text)::UUID,
    (v_option_set_mapping->>mios.option_set_id::text)::UUID,
    mios.display_order,
    p_target_org_id,
    NOW()
  FROM menu_item_option_sets mios
  WHERE mios.menu_item_id IN (
    SELECT id FROM menu_items
    WHERE menu_id IN (SELECT id FROM menus WHERE restaurant_id = p_restaurant_id)
  )
  AND v_menu_item_mapping ? mios.menu_item_id::text
  AND v_option_set_mapping ? mios.option_set_id::text;

  GET DIAGNOSTICS v_menu_item_option_set_count = ROW_COUNT;

  -- ===================================================================
  -- PHASE 11: Duplicate tasks (pending and active only)
  -- Clear user assignments for new organization context
  -- ===================================================================
  INSERT INTO tasks (
    organisation_id,
    restaurant_id,
    task_template_id,
    message_template_id,
    assigned_to,
    created_by,
    name,
    description,
    status,
    type,
    priority,
    message,
    message_rendered,
    due_date,
    completed_at,
    cancelled_at,
    metadata,
    created_at,
    updated_at
  )
  SELECT
    p_target_org_id,
    v_new_restaurant_id,
    task_template_id,
    message_template_id,
    NULL, -- assigned_to cleared for new org
    NULL, -- created_by cleared for new org
    name,
    description,
    status, -- Keep original status (pending or active)
    type,
    priority,
    message,
    message_rendered,
    due_date,
    NULL, -- completed_at cleared
    NULL, -- cancelled_at cleared
    metadata,
    NOW(),
    NOW()
  FROM tasks
  WHERE restaurant_id = p_restaurant_id
    AND status IN ('pending', 'active'); -- Only duplicate pending and active tasks

  GET DIAGNOSTICS v_task_count = ROW_COUNT;

  -- ===================================================================
  -- Log the duplication
  -- ===================================================================
  INSERT INTO usage_events (
    organisation_id,
    event_type,
    event_subtype,
    metadata
  ) VALUES (
    p_target_org_id,
    'data_duplication',
    'restaurant',
    jsonb_build_object(
      'source_restaurant_id', p_restaurant_id,
      'new_restaurant_id', v_new_restaurant_id,
      'source_org_id', v_source_org_id,
      'target_org_id', p_target_org_id,
      'duplicated_counts', jsonb_build_object(
        'restaurants', v_restaurant_count,
        'menus', v_menu_count,
        'categories', v_category_count,
        'menu_items', v_menu_item_count,
        'option_sets', v_option_set_count,
        'option_set_items', v_option_set_item_count,
        'item_images', v_item_image_count,
        'menu_item_option_sets', v_menu_item_option_set_count,
        'tasks', v_task_count
      ),
      'timestamp', NOW()
    )
  );

  -- ===================================================================
  -- Return results
  -- ===================================================================
  RETURN jsonb_build_object(
    'success', true,
    'source_restaurant_id', p_restaurant_id,
    'new_restaurant_id', v_new_restaurant_id,
    'source_org_id', v_source_org_id,
    'target_org_id', p_target_org_id,
    'duplicated_counts', jsonb_build_object(
      'restaurants', v_restaurant_count,
      'menus', v_menu_count,
      'categories', v_category_count,
      'menu_items', v_menu_item_count,
      'option_sets', v_option_set_count,
      'option_set_items', v_option_set_item_count,
      'item_images', v_item_image_count,
      'menu_item_option_sets', v_menu_item_option_set_count,
      'tasks', v_task_count
    )
  );

EXCEPTION
  WHEN OTHERS THEN
    -- Log error
    INSERT INTO usage_events (
      organisation_id,
      event_type,
      event_subtype,
      metadata
    ) VALUES (
      COALESCE(p_target_org_id, v_source_org_id),
      'data_duplication',
      'error',
      jsonb_build_object(
        'source_restaurant_id', p_restaurant_id,
        'source_org_id', v_source_org_id,
        'target_org_id', p_target_org_id,
        'error', SQLERRM,
        'timestamp', NOW()
      )
    );

    -- Re-raise the exception to rollback transaction
    RAISE;
END;
$$;

-- ===================================================================
-- Grant permissions
-- ===================================================================
GRANT EXECUTE ON FUNCTION duplicate_restaurant_to_org(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION duplicate_restaurant_to_org(UUID, UUID) TO service_role;

-- ===================================================================
-- Add function comment
-- ===================================================================
COMMENT ON FUNCTION duplicate_restaurant_to_org IS
  'Duplicates a restaurant and all related data to another organization. ' ||
  'Creates complete copy including: restaurants, menus, categories, menu_items, ' ||
  'item_images, option_sets, option_set_items, menu_item_option_sets, and tasks. ' ||
  'Duplicates only pending/active tasks with cleared user assignments. ' ||
  'Maintains all foreign key relationships through ID mapping. ' ||
  'Returns JSONB with new restaurant ID and detailed duplication counts.';

-- ===================================================================
-- Migration complete
-- ===================================================================
-- To verify the function was created successfully, run:
-- SELECT routine_name, routine_type, data_type
-- FROM information_schema.routines
-- WHERE routine_name = 'duplicate_restaurant_to_org';
-- ===================================================================
