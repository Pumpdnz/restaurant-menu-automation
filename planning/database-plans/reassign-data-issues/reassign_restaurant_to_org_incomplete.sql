BEGIN
  -- Update restaurant
  UPDATE restaurants 
  SET organisation_id = p_target_org_id,
      updated_at = NOW()
  WHERE id = p_restaurant_id;
  
  -- Update related menus
  UPDATE menus 
  SET organisation_id = p_target_org_id,
      updated_at = NOW()
  WHERE restaurant_id = p_restaurant_id;
  
  -- Update related extraction jobs
  UPDATE extraction_jobs
  SET organisation_id = p_target_org_id,
      updated_at = NOW()
  WHERE restaurant_id = p_restaurant_id;
  
  -- Update menu items through menus
  UPDATE menu_items mi
  SET organisation_id = p_target_org_id,
      updated_at = NOW()
  FROM menus m
  WHERE mi.menu_id = m.id
    AND m.restaurant_id = p_restaurant_id;
  
  -- Update categories through menus
  UPDATE categories c
  SET organisation_id = p_target_org_id,
      updated_at = NOW()
  FROM menus m
  WHERE c.menu_id = m.id
    AND m.restaurant_id = p_restaurant_id;
  
  -- Log the reassignment
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
      'source_org_id', (SELECT organisation_id FROM restaurants WHERE id = p_restaurant_id),
      'target_org_id', p_target_org_id
    )
  );
END;