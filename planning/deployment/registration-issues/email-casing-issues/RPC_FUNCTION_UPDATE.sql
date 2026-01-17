BEGIN
  RETURN QUERY
  SELECT 
    uo.id as onboarding_id,
    uo.user_id,
    p.email,
    p.name,
    uo.status as onboarding_status,
    uo.created_at
  FROM public.profiles p
  INNER JOIN public.user_onboarding uo ON p.id = uo.user_id
  WHERE LOWER(p.email) = LOWER(user_email)
  LIMIT 1;
  
  -- If no record found, return empty result set
  IF NOT FOUND THEN
    RETURN;
  END IF;
END;