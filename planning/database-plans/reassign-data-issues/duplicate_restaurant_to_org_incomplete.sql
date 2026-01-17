
DECLARE
  v_new_restaurant_id UUID;
  v_menu_mapping JSONB := '{}';
  v_old_menu_id UUID;
  v_new_menu_id UUID;
BEGIN
  -- Create new restaurant in target org
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
  
  -- Duplicate menus
  FOR v_old_menu_id IN
    SELECT id FROM menus WHERE restaurant_id = p_restaurant_id
  LOOP
    INSERT INTO menus (
      restaurant_id,
      name,
      description,
      currency,
      language,
      organisation_id
    )
    SELECT
      v_new_restaurant_id,
      name,
      description,
      currency,
      language,
      p_target_org_id
    FROM menus
    WHERE id = v_old_menu_id
    RETURNING id INTO v_new_menu_id;
    
    -- Store menu mapping for items
    v_menu_mapping := v_menu_mapping || jsonb_build_object(v_old_menu_id::text, v_new_menu_id);
    
    -- Duplicate menu items
    INSERT INTO menu_items (
      menu_id,
      name,
      description,
      price,
      image_url,
      category_id,
      metadata,
      organisation_id
    )
    SELECT
      v_new_menu_id,
      name,
      description,
      price,
      image_url,
      category_id,
      metadata,
      p_target_org_id
    FROM menu_items
    WHERE menu_id = v_old_menu_id;
  END LOOP;
  
  RETURN v_new_restaurant_id;
END;
