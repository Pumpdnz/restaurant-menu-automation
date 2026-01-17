-- =====================================================================
-- Migration: Fix reassign_restaurant_to_org to include all organization-scoped tables
-- =====================================================================
-- Description: Updates the RPC function to reassign ALL organization-scoped data:
--   - restaurants, menus, extraction_jobs, menu_items, categories (existing)
--   - pumpd_accounts, pumpd_restaurants (NEW - direct via restaurant_id)
--   - item_images, menu_item_option_sets (NEW - via menu_items)
--   - option_sets, option_set_items (NEW - via menu_item_option_sets)
--   - tasks (NEW - direct via restaurant_id)
--
-- Changes:
--   - Adds 7 missing table updates
--   - Returns detailed affected_counts JSONB for verification
--   - Improved error handling with detailed logging
--   - Validates source/target organizations
--   - Prevents reassignment to same organization
-- =====================================================================

-- Drop existing function
DROP FUNCTION IF EXISTS reassign_restaurant_to_org(UUID, UUID);

-- Create updated function with SECURITY DEFINER to bypass RLS
CREATE OR REPLACE FUNCTION reassign_restaurant_to_org(
  p_restaurant_id UUID,
  p_target_org_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_source_org_id UUID;
  v_affected_counts JSONB;
  v_restaurant_count INTEGER;
  v_menu_count INTEGER;
  v_extraction_job_count INTEGER;
  v_menu_item_count INTEGER;
  v_category_count INTEGER;
  v_pumpd_account_count INTEGER;
  v_pumpd_restaurant_count INTEGER;
  v_item_image_count INTEGER;
  v_menu_item_option_set_count INTEGER;
  v_option_set_count INTEGER;
  v_option_set_item_count INTEGER;
  v_task_count INTEGER;
BEGIN
  -- Get source organization ID for logging
  SELECT organisation_id INTO v_source_org_id
  FROM restaurants
  WHERE id = p_restaurant_id;

  -- Validate restaurant exists
  IF v_source_org_id IS NULL THEN
    RAISE EXCEPTION 'Restaurant with ID % not found', p_restaurant_id;
  END IF;

  -- Validate target organization exists
  IF NOT EXISTS (SELECT 1 FROM organisations WHERE id = p_target_org_id) THEN
    RAISE EXCEPTION 'Target organization with ID % not found', p_target_org_id;
  END IF;

  -- Validate not reassigning to same organization
  IF v_source_org_id = p_target_org_id THEN
    RAISE EXCEPTION 'Restaurant is already in target organization';
  END IF;

  -- ===================================================================
  -- PHASE 1: Update core restaurant table
  -- ===================================================================
  UPDATE restaurants
  SET organisation_id = p_target_org_id,
      updated_at = NOW()
  WHERE id = p_restaurant_id;
  GET DIAGNOSTICS v_restaurant_count = ROW_COUNT;

  -- ===================================================================
  -- PHASE 2: Update menus
  -- ===================================================================
  UPDATE menus
  SET organisation_id = p_target_org_id,
      updated_at = NOW()
  WHERE restaurant_id = p_restaurant_id;
  GET DIAGNOSTICS v_menu_count = ROW_COUNT;

  -- ===================================================================
  -- PHASE 3: Update extraction jobs
  -- ===================================================================
  UPDATE extraction_jobs
  SET organisation_id = p_target_org_id,
      updated_at = NOW()
  WHERE restaurant_id = p_restaurant_id;
  GET DIAGNOSTICS v_extraction_job_count = ROW_COUNT;

  -- ===================================================================
  -- PHASE 4: Update menu items (via menus)
  -- ===================================================================
  UPDATE menu_items mi
  SET organisation_id = p_target_org_id,
      updated_at = NOW()
  FROM menus m
  WHERE mi.menu_id = m.id
    AND m.restaurant_id = p_restaurant_id;
  GET DIAGNOSTICS v_menu_item_count = ROW_COUNT;

  -- ===================================================================
  -- PHASE 5: Update categories (via menus)
  -- ===================================================================
  UPDATE categories c
  SET organisation_id = p_target_org_id,
      updated_at = NOW()
  FROM menus m
  WHERE c.menu_id = m.id
    AND m.restaurant_id = p_restaurant_id;
  GET DIAGNOSTICS v_category_count = ROW_COUNT;

  -- ===================================================================
  -- PHASE 6: Update pumpd_accounts (NEW - direct via restaurant_id)
  -- ===================================================================
  UPDATE pumpd_accounts
  SET organisation_id = p_target_org_id,
      updated_at = NOW()
  WHERE restaurant_id = p_restaurant_id;
  GET DIAGNOSTICS v_pumpd_account_count = ROW_COUNT;

  -- ===================================================================
  -- PHASE 7: Update pumpd_restaurants (NEW - direct via restaurant_id)
  -- ===================================================================
  UPDATE pumpd_restaurants
  SET organisation_id = p_target_org_id,
      updated_at = NOW()
  WHERE restaurant_id = p_restaurant_id;
  GET DIAGNOSTICS v_pumpd_restaurant_count = ROW_COUNT;

  -- ===================================================================
  -- PHASE 8: Update item_images (NEW - via menu_items)
  -- ===================================================================
  UPDATE item_images ii
  SET organisation_id = p_target_org_id
  FROM menu_items mi
  JOIN menus m ON mi.menu_id = m.id
  WHERE ii.menu_item_id = mi.id
    AND m.restaurant_id = p_restaurant_id;
  GET DIAGNOSTICS v_item_image_count = ROW_COUNT;

  -- ===================================================================
  -- PHASE 9: Update menu_item_option_sets (NEW - via menu_items)
  -- ===================================================================
  UPDATE menu_item_option_sets mios
  SET organisation_id = p_target_org_id
  FROM menu_items mi
  JOIN menus m ON mi.menu_id = m.id
  WHERE mios.menu_item_id = mi.id
    AND m.restaurant_id = p_restaurant_id;
  GET DIAGNOSTICS v_menu_item_option_set_count = ROW_COUNT;

  -- ===================================================================
  -- PHASE 10: Update option_sets (NEW - via menu_item_option_sets)
  -- Option sets are restaurant-specific and not shared across restaurants
  -- ===================================================================
  UPDATE option_sets os
  SET organisation_id = p_target_org_id,
      updated_at = NOW()
  FROM menu_item_option_sets mios
  JOIN menu_items mi ON mios.menu_item_id = mi.id
  JOIN menus m ON mi.menu_id = m.id
  WHERE os.id = mios.option_set_id
    AND m.restaurant_id = p_restaurant_id;
  GET DIAGNOSTICS v_option_set_count = ROW_COUNT;

  -- ===================================================================
  -- PHASE 11: Update option_set_items (NEW - via option_sets)
  -- ===================================================================
  UPDATE option_set_items osi
  SET organisation_id = p_target_org_id
  FROM option_sets os
  JOIN menu_item_option_sets mios ON os.id = mios.option_set_id
  JOIN menu_items mi ON mios.menu_item_id = mi.id
  JOIN menus m ON mi.menu_id = m.id
  WHERE osi.option_set_id = os.id
    AND m.restaurant_id = p_restaurant_id;
  GET DIAGNOSTICS v_option_set_item_count = ROW_COUNT;

  -- ===================================================================
  -- PHASE 12: Update tasks (NEW - direct via restaurant_id)
  -- Reassign all tasks associated with the restaurant
  -- ===================================================================
  UPDATE tasks
  SET organisation_id = p_target_org_id,
      updated_at = NOW()
  WHERE restaurant_id = p_restaurant_id;
  GET DIAGNOSTICS v_task_count = ROW_COUNT;

  -- ===================================================================
  -- Build affected counts JSON
  -- ===================================================================
  v_affected_counts := jsonb_build_object(
    'restaurants', v_restaurant_count,
    'menus', v_menu_count,
    'extraction_jobs', v_extraction_job_count,
    'menu_items', v_menu_item_count,
    'categories', v_category_count,
    'pumpd_accounts', v_pumpd_account_count,
    'pumpd_restaurants', v_pumpd_restaurant_count,
    'item_images', v_item_image_count,
    'menu_item_option_sets', v_menu_item_option_set_count,
    'option_sets', v_option_set_count,
    'option_set_items', v_option_set_item_count,
    'tasks', v_task_count
  );

  -- ===================================================================
  -- Log the reassignment
  -- ===================================================================
  INSERT INTO usage_events (
    organisation_id,
    event_type,
    event_subtype,
    metadata
  ) VALUES (
    p_target_org_id,
    'data_reassignment',
    'restaurant',
    jsonb_build_object(
      'restaurant_id', p_restaurant_id,
      'source_org_id', v_source_org_id,
      'target_org_id', p_target_org_id,
      'affected_counts', v_affected_counts,
      'timestamp', NOW()
    )
  );

  -- ===================================================================
  -- Return results
  -- ===================================================================
  RETURN jsonb_build_object(
    'success', true,
    'restaurant_id', p_restaurant_id,
    'source_org_id', v_source_org_id,
    'target_org_id', p_target_org_id,
    'affected_counts', v_affected_counts
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
      p_target_org_id,
      'data_reassignment',
      'error',
      jsonb_build_object(
        'restaurant_id', p_restaurant_id,
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
GRANT EXECUTE ON FUNCTION reassign_restaurant_to_org(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION reassign_restaurant_to_org(UUID, UUID) TO service_role;

-- ===================================================================
-- Add function comment
-- ===================================================================
COMMENT ON FUNCTION reassign_restaurant_to_org IS
  'Reassigns a restaurant and all related data from one organization to another. ' ||
  'Updates 12 tables: restaurants, menus, extraction_jobs, menu_items, categories, ' ||
  'pumpd_accounts, pumpd_restaurants, item_images, menu_item_option_sets, ' ||
  'option_sets, option_set_items, and tasks. Returns JSONB with affected counts.';

-- ===================================================================
-- Migration complete
-- ===================================================================
-- To verify the function was created successfully, run:
-- SELECT routine_name, routine_type
-- FROM information_schema.routines
-- WHERE routine_name = 'reassign_restaurant_to_org';
-- ===================================================================
