# Restaurant Data Duplication - Solution Implementation Plan

## Executive Summary
Comprehensive plan to complete the `duplicate_restaurant_to_org` RPC function to duplicate ALL restaurant data including categories, images, option sets, and maintain proper foreign key relationships through ID mapping.

## Implementation Strategy

### Design Principles
1. **Complete Duplication**: All menu-related data copied
2. **ID Mapping**: Track old→new ID mappings for FK updates
3. **Dependency Order**: Duplicate in correct sequence
4. **Data Integrity**: All FKs reference new duplicated records
5. **Atomicity**: Single transaction (all or nothing)
6. **Performance**: Use temporary tables for mappings

### Duplication Sequence
```
1. Restaurant          (existing - create new with " (Copy)")
2. Menus              (existing - track mapping)
3. Categories         (NEW - track mapping, before menu items)
4. Menu Items         (existing - UPDATE to use new category_id, track mapping)
5. Option Sets        (NEW - track mapping)
6. Option Set Items   (NEW - use option_set mapping)
7. Item Images        (NEW - use menu_item mapping)
8. Menu Item Option Sets (NEW - use menu_item and option_set mappings)
```

## SQL Implementation

### Updated RPC Function

```sql
CREATE OR REPLACE FUNCTION duplicate_restaurant_to_org(
  p_restaurant_id UUID,
  p_target_org_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_new_restaurant_id UUID;
  v_source_org_id UUID;
  v_restaurant_count INTEGER := 0;
  v_menu_count INTEGER := 0;
  v_category_count INTEGER := 0;
  v_menu_item_count INTEGER := 0;
  v_option_set_count INTEGER := 0;
  v_option_set_item_count INTEGER := 0;
  v_item_image_count INTEGER := 0;
  v_menu_item_option_set_count INTEGER := 0;
BEGIN
  -- Get source organization ID for validation
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

  -- Create temporary tables for ID mappings
  CREATE TEMP TABLE IF NOT EXISTS menu_mapping (
    old_id UUID PRIMARY KEY,
    new_id UUID NOT NULL
  ) ON COMMIT DROP;

  CREATE TEMP TABLE IF NOT EXISTS category_mapping (
    old_id UUID PRIMARY KEY,
    new_id UUID NOT NULL
  ) ON COMMIT DROP;

  CREATE TEMP TABLE IF NOT EXISTS menu_item_mapping (
    old_id UUID PRIMARY KEY,
    new_id UUID NOT NULL
  ) ON COMMIT DROP;

  CREATE TEMP TABLE IF NOT EXISTS option_set_mapping (
    old_id UUID PRIMARY KEY,
    new_id UUID NOT NULL
  ) ON COMMIT DROP;

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
    organisation_id
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
    p_target_org_id
  FROM restaurants
  WHERE id = p_restaurant_id
  RETURNING id INTO v_new_restaurant_id;

  v_restaurant_count := 1;

  -- ===================================================================
  -- PHASE 2: Duplicate menus and track mapping
  -- ===================================================================
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
  WHERE restaurant_id = p_restaurant_id
  RETURNING id, (
    SELECT id FROM menus
    WHERE restaurant_id = p_restaurant_id
    ORDER BY created_at
    OFFSET (SELECT COUNT(*) FROM menu_mapping)
    LIMIT 1
  )
  INTO STRICT menu_mapping;

  -- Better approach: Use a CTE to capture both old and new IDs
  WITH duplicated_menus AS (
    INSERT INTO menus (
      restaurant_id,
      name,
      description,
      currency,
      language,
      organisation_id,
      is_active
    )
    SELECT
      v_new_restaurant_id,
      name,
      description,
      currency,
      language,
      p_target_org_id,
      is_active
    FROM menus
    WHERE restaurant_id = p_restaurant_id
    ORDER BY id
    RETURNING id
  ),
  source_menus AS (
    SELECT id
    FROM menus
    WHERE restaurant_id = p_restaurant_id
    ORDER BY id
  )
  INSERT INTO menu_mapping (old_id, new_id)
  SELECT s.id, d.id
  FROM source_menus s
  CROSS JOIN LATERAL (
    SELECT id FROM duplicated_menus
    OFFSET (ROW_NUMBER() OVER () - 1)
    LIMIT 1
  ) d;

  GET DIAGNOSTICS v_menu_count = ROW_COUNT;

  -- ===================================================================
  -- PHASE 3: Duplicate categories and track mapping
  -- ===================================================================
  WITH duplicated_categories AS (
    INSERT INTO categories (
      menu_id,
      name,
      description,
      display_order,
      organisation_id,
      is_active
    )
    SELECT
      mm.new_id,  -- Use mapped menu_id
      c.name,
      c.description,
      c.display_order,
      p_target_org_id,
      c.is_active
    FROM categories c
    JOIN menu_mapping mm ON c.menu_id = mm.old_id
    ORDER BY c.id
    RETURNING id, menu_id
  ),
  source_categories AS (
    SELECT c.id, c.menu_id
    FROM categories c
    WHERE c.menu_id IN (SELECT old_id FROM menu_mapping)
    ORDER BY c.id
  )
  INSERT INTO category_mapping (old_id, new_id)
  SELECT sc.id, dc.id
  FROM source_categories sc
  JOIN duplicated_categories dc ON TRUE
  WHERE (
    SELECT COUNT(*)
    FROM source_categories sc2
    WHERE sc2.id <= sc.id
  ) = (
    SELECT COUNT(*)
    FROM duplicated_categories dc2
    WHERE dc2.id <= dc.id
  );

  GET DIAGNOSTICS v_category_count = ROW_COUNT;

  -- ===================================================================
  -- PHASE 4: Duplicate menu items with correct category mapping
  -- ===================================================================
  WITH duplicated_items AS (
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
      display_order
    )
    SELECT
      mm.new_id,  -- Use mapped menu_id
      mi.name,
      mi.description,
      mi.price,
      mi.image_url,
      COALESCE(cm.new_id, mi.category_id),  -- Use mapped category_id if exists
      mi.metadata,
      p_target_org_id,
      mi.is_available,
      mi.display_order
    FROM menu_items mi
    JOIN menu_mapping mm ON mi.menu_id = mm.old_id
    LEFT JOIN category_mapping cm ON mi.category_id = cm.old_id
    ORDER BY mi.id
    RETURNING id, menu_id
  ),
  source_items AS (
    SELECT mi.id, mi.menu_id
    FROM menu_items mi
    WHERE mi.menu_id IN (SELECT old_id FROM menu_mapping)
    ORDER BY mi.id
  )
  INSERT INTO menu_item_mapping (old_id, new_id)
  SELECT si.id, di.id
  FROM source_items si
  JOIN duplicated_items di ON TRUE
  WHERE (
    SELECT COUNT(*)
    FROM source_items si2
    WHERE si2.id <= si.id
  ) = (
    SELECT COUNT(*)
    FROM duplicated_items di2
    WHERE di2.id <= di.id
  );

  GET DIAGNOSTICS v_menu_item_count = ROW_COUNT;

  -- ===================================================================
  -- PHASE 5: Duplicate option sets and track mapping
  -- ===================================================================
  WITH duplicated_option_sets AS (
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
      source_data,
      option_set_hash
    )
    SELECT DISTINCT
      os.name,
      os.type,
      os.min_selections,
      os.max_selections,
      os.is_required,
      p_target_org_id,
      os.description,
      os.display_order,
      os.multiple_selections_allowed,
      os.extraction_source,
      os.source_data,
      os.option_set_hash
    FROM option_sets os
    WHERE os.id IN (
      SELECT DISTINCT mios.option_set_id
      FROM menu_item_option_sets mios
      WHERE mios.menu_item_id IN (SELECT old_id FROM menu_item_mapping)
    )
    ORDER BY os.id
    RETURNING id
  ),
  source_option_sets AS (
    SELECT DISTINCT os.id
    FROM option_sets os
    WHERE os.id IN (
      SELECT DISTINCT mios.option_set_id
      FROM menu_item_option_sets mios
      WHERE mios.menu_item_id IN (SELECT old_id FROM menu_item_mapping)
    )
    ORDER BY os.id
  )
  INSERT INTO option_set_mapping (old_id, new_id)
  SELECT sos.id, dos.id
  FROM source_option_sets sos
  JOIN duplicated_option_sets dos ON TRUE
  WHERE (
    SELECT COUNT(*)
    FROM source_option_sets sos2
    WHERE sos2.id <= sos.id
  ) = (
    SELECT COUNT(*)
    FROM duplicated_option_sets dos2
    WHERE dos2.id <= dos.id
  );

  GET DIAGNOSTICS v_option_set_count = ROW_COUNT;

  -- ===================================================================
  -- PHASE 6: Duplicate option set items
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
    extraction_source
  )
  SELECT
    osm.new_id,  -- Use mapped option_set_id
    osi.name,
    osi.price,
    osi.is_default,
    osi.is_available,
    osi.metadata,
    p_target_org_id,
    osi.description,
    osi.price_display,
    osi.display_order,
    osi.extraction_source
  FROM option_set_items osi
  JOIN option_set_mapping osm ON osi.option_set_id = osm.old_id;

  GET DIAGNOSTICS v_option_set_item_count = ROW_COUNT;

  -- ===================================================================
  -- PHASE 7: Duplicate item images
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
    upload_error
  )
  SELECT
    mim.new_id,  -- Use mapped menu_item_id
    ii.url,
    ii.type,
    ii.width,
    ii.height,
    ii.file_size,
    ii.is_downloaded,
    ii.local_path,
    p_target_org_id,
    ii.cdn_uploaded,
    ii.cdn_id,
    ii.cdn_url,
    ii.cdn_filename,
    ii.cdn_metadata,
    ii.upload_status,
    ii.upload_error
  FROM item_images ii
  JOIN menu_item_mapping mim ON ii.menu_item_id = mim.old_id;

  GET DIAGNOSTICS v_item_image_count = ROW_COUNT;

  -- ===================================================================
  -- PHASE 8: Duplicate menu item option sets
  -- ===================================================================
  INSERT INTO menu_item_option_sets (
    menu_item_id,
    option_set_id,
    display_order,
    organisation_id
  )
  SELECT
    mim.new_id,  -- Use mapped menu_item_id
    osm.new_id,  -- Use mapped option_set_id
    mios.display_order,
    p_target_org_id
  FROM menu_item_option_sets mios
  JOIN menu_item_mapping mim ON mios.menu_item_id = mim.old_id
  JOIN option_set_mapping osm ON mios.option_set_id = osm.old_id;

  GET DIAGNOSTICS v_menu_item_option_set_count = ROW_COUNT;

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
        'menu_item_option_sets', v_menu_item_option_set_count
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
      'menu_item_option_sets', v_menu_item_option_set_count
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
      p_target_org_id,
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
$$ LANGUAGE plpgsql;
```

## Alternative Simpler Approach (Using Row Numbers)

The above approach has complexity with matching old→new IDs. Here's a simpler approach using arrays:

```sql
-- Simplified approach: Process menus one at a time in a loop
-- This is easier to understand and maintain

CREATE OR REPLACE FUNCTION duplicate_restaurant_to_org(
  p_restaurant_id UUID,
  p_target_org_id UUID
) RETURNS JSONB AS $$
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

  v_counts JSONB;
BEGIN
  -- Validation
  SELECT organisation_id INTO v_source_org_id
  FROM restaurants WHERE id = p_restaurant_id;

  IF v_source_org_id IS NULL THEN
    RAISE EXCEPTION 'Restaurant with ID % not found', p_restaurant_id;
  END IF;

  -- Phase 1: Duplicate restaurant
  INSERT INTO restaurants (
    name, platform, url, location, cuisine_type, price_range,
    rating, review_count, image_url, phone, address, hours,
    metadata, organisation_id
  )
  SELECT
    name || ' (Copy)', platform, url, location, cuisine_type, price_range,
    rating, review_count, image_url, phone, address, hours,
    metadata, p_target_org_id
  FROM restaurants
  WHERE id = p_restaurant_id
  RETURNING id INTO v_new_restaurant_id;

  -- Phase 2-8: Process each menu
  FOR v_old_menu_id IN
    SELECT id FROM menus WHERE restaurant_id = p_restaurant_id ORDER BY id
  LOOP
    -- Duplicate menu
    INSERT INTO menus (
      restaurant_id, name, description, currency, language,
      organisation_id, is_active
    )
    SELECT
      v_new_restaurant_id, name, description, currency, language,
      p_target_org_id, is_active
    FROM menus WHERE id = v_old_menu_id
    RETURNING id INTO v_new_menu_id;

    v_menu_mapping := v_menu_mapping || jsonb_build_object(v_old_menu_id::text, v_new_menu_id);

    -- Duplicate categories for this menu
    FOR v_old_category_id IN
      SELECT id FROM categories WHERE menu_id = v_old_menu_id ORDER BY id
    LOOP
      INSERT INTO categories (
        menu_id, name, description, display_order, organisation_id, is_active
      )
      SELECT
        v_new_menu_id, name, description, display_order, p_target_org_id, is_active
      FROM categories WHERE id = v_old_category_id
      RETURNING id INTO v_new_category_id;

      v_category_mapping := v_category_mapping || jsonb_build_object(v_old_category_id::text, v_new_category_id);
    END LOOP;

    -- Duplicate menu items for this menu
    FOR v_old_menu_item_id IN
      SELECT id FROM menu_items WHERE menu_id = v_old_menu_id ORDER BY id
    LOOP
      INSERT INTO menu_items (
        menu_id, name, description, price, image_url, category_id,
        metadata, organisation_id, is_available, display_order
      )
      SELECT
        v_new_menu_id,
        name,
        description,
        price,
        image_url,
        CASE
          WHEN category_id IS NOT NULL
          THEN (v_category_mapping->>category_id::text)::UUID
          ELSE NULL
        END,
        metadata,
        p_target_org_id,
        is_available,
        display_order
      FROM menu_items WHERE id = v_old_menu_item_id
      RETURNING id INTO v_new_menu_item_id;

      v_menu_item_mapping := v_menu_item_mapping || jsonb_build_object(v_old_menu_item_id::text, v_new_menu_item_id);

      -- Duplicate images for this menu item
      INSERT INTO item_images (
        menu_item_id, url, type, width, height, file_size,
        is_downloaded, local_path, organisation_id
      )
      SELECT
        v_new_menu_item_id, url, type, width, height, file_size,
        is_downloaded, local_path, p_target_org_id
      FROM item_images
      WHERE menu_item_id = v_old_menu_item_id;
    END LOOP;
  END LOOP;

  -- Phase: Duplicate option sets (collect all unique option sets used)
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
      name, type, min_selections, max_selections, is_required,
      organisation_id, description, display_order, multiple_selections_allowed
    )
    SELECT
      name, type, min_selections, max_selections, is_required,
      p_target_org_id, description, display_order, multiple_selections_allowed
    FROM option_sets WHERE id = v_old_option_set_id
    RETURNING id INTO v_new_option_set_id;

    v_option_set_mapping := v_option_set_mapping || jsonb_build_object(v_old_option_set_id::text, v_new_option_set_id);

    -- Duplicate option set items
    INSERT INTO option_set_items (
      option_set_id, name, price, is_default, is_available,
      metadata, organisation_id, description, display_order
    )
    SELECT
      v_new_option_set_id, name, price, is_default, is_available,
      metadata, p_target_org_id, description, display_order
    FROM option_set_items
    WHERE option_set_id = v_old_option_set_id;
  END LOOP;

  -- Phase: Duplicate menu_item_option_sets (junction table)
  INSERT INTO menu_item_option_sets (
    menu_item_id, option_set_id, display_order, organisation_id
  )
  SELECT
    (v_menu_item_mapping->>mios.menu_item_id::text)::UUID,
    (v_option_set_mapping->>mios.option_set_id::text)::UUID,
    mios.display_order,
    p_target_org_id
  FROM menu_item_option_sets mios
  WHERE mios.menu_item_id IN (
    SELECT id FROM menu_items
    WHERE menu_id IN (SELECT id FROM menus WHERE restaurant_id = p_restaurant_id)
  );

  -- Build counts
  v_counts := jsonb_build_object(
    'restaurants', 1,
    'menus', jsonb_object_length(v_menu_mapping),
    'categories', jsonb_object_length(v_category_mapping),
    'menu_items', jsonb_object_length(v_menu_item_mapping),
    'option_sets', jsonb_object_length(v_option_set_mapping),
    'option_set_items', (
      SELECT COUNT(*) FROM option_set_items
      WHERE option_set_id IN (
        SELECT (value::text)::UUID FROM jsonb_each(v_option_set_mapping)
      )
    ),
    'item_images', (
      SELECT COUNT(*) FROM item_images
      WHERE menu_item_id IN (
        SELECT (value::text)::UUID FROM jsonb_each(v_menu_item_mapping)
      )
    ),
    'menu_item_option_sets', (
      SELECT COUNT(*) FROM menu_item_option_sets
      WHERE menu_item_id IN (
        SELECT (value::text)::UUID FROM jsonb_each(v_menu_item_mapping)
      )
    )
  );

  -- Log
  INSERT INTO usage_events (organisation_id, event_type, event_subtype, metadata)
  VALUES (p_target_org_id, 'data_duplication', 'restaurant',
    jsonb_build_object(
      'source_restaurant_id', p_restaurant_id,
      'new_restaurant_id', v_new_restaurant_id,
      'duplicated_counts', v_counts,
      'timestamp', NOW()
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'source_restaurant_id', p_restaurant_id,
    'new_restaurant_id', v_new_restaurant_id,
    'duplicated_counts', v_counts
  );

EXCEPTION
  WHEN OTHERS THEN
    INSERT INTO usage_events (organisation_id, event_type, event_subtype, metadata)
    VALUES (p_target_org_id, 'data_duplication', 'error',
      jsonb_build_object('error', SQLERRM, 'source_restaurant_id', p_restaurant_id)
    );
    RAISE;
END;
$$ LANGUAGE plpgsql;
```

## Migration File

I'll create a clean migration file using the simpler loop-based approach.

## Testing Plan

### Pre-Duplication Snapshot
```sql
-- Get counts before duplication
SELECT
  (SELECT COUNT(*) FROM menus WHERE restaurant_id = 'SOURCE_ID') as menus,
  (SELECT COUNT(*) FROM categories c JOIN menus m ON c.menu_id = m.id
   WHERE m.restaurant_id = 'SOURCE_ID') as categories,
  (SELECT COUNT(*) FROM menu_items mi JOIN menus m ON mi.menu_id = m.id
   WHERE m.restaurant_id = 'SOURCE_ID') as menu_items,
  (SELECT COUNT(*) FROM item_images ii
   JOIN menu_items mi ON ii.menu_item_id = mi.id
   JOIN menus m ON mi.menu_id = m.id
   WHERE m.restaurant_id = 'SOURCE_ID') as images;
```

### Post-Duplication Verification
```sql
-- Verify duplicated data
SELECT
  (SELECT COUNT(*) FROM menus WHERE restaurant_id = 'NEW_ID') as menus,
  (SELECT COUNT(*) FROM categories c JOIN menus m ON c.menu_id = m.id
   WHERE m.restaurant_id = 'NEW_ID') as categories,
  (SELECT COUNT(*) FROM menu_items mi JOIN menus m ON mi.menu_id = m.id
   WHERE m.restaurant_id = 'NEW_ID') as menu_items,
  (SELECT COUNT(*) FROM item_images ii
   JOIN menu_items mi ON ii.menu_item_id = mi.id
   JOIN menus m ON mi.menu_id = m.id
   WHERE m.restaurant_id = 'NEW_ID') as images;
```

## Success Criteria
- ✅ All 8 tables duplicated correctly
- ✅ Foreign key references valid (menu_items.category_id points to new categories)
- ✅ No orphaned records
- ✅ JSONB return includes duplicated_counts
- ✅ Source restaurant data unchanged
- ✅ Performance < 10 seconds for large restaurants

## Next Steps
1. Review this approach
2. Create migration SQL file
3. Create verification queries
4. Test in development
5. Deploy to production
