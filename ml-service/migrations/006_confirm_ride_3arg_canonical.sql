-- Phase 6: Create canonical 3-argument confirm_ride function for v2 ML
-- This is the final version that matches frontend expectations
-- Input: p_rider_id, p_ride_request_id, p_ml_version
-- Output: group_id

CREATE OR REPLACE FUNCTION public.confirm_ride(
  p_rider_id UUID,
  p_ride_request_id UUID,
  p_ml_version VARCHAR DEFAULT 'v2'
)
RETURNS UUID AS $$
DECLARE
  v_group_id UUID;
  v_pickup_station_id UUID;
  v_cluster_id TEXT;
  v_fare_amount NUMERIC;
  v_distance_km NUMERIC;
  v_duration_min INT;
  v_rider_count INT;
BEGIN
  -- Load ride_request details
  SELECT 
    pickup_station_id,
    cluster_id,
    COALESCE(fare_amount::numeric, 0),
    COALESCE(distance_km::numeric, 0),
    COALESCE(duration_min::integer, 0)
  INTO 
    v_pickup_station_id,
    v_cluster_id,
    v_fare_amount,
    v_distance_km,
    v_duration_min
  FROM ride_requests
  WHERE id = p_ride_request_id;

  IF v_pickup_station_id IS NULL THEN
    RAISE EXCEPTION 'Ride request not found: %', p_ride_request_id;
  END IF;

  -- Check or create ride group
  SELECT id INTO v_group_id FROM ride_groups 
  WHERE cluster_id = v_cluster_id 
    AND station_id = v_pickup_station_id 
    AND status = 'forming'
  LIMIT 1;
  
  IF v_group_id IS NULL THEN
    -- Create new forming group
    INSERT INTO ride_groups (
      station_id,
      cluster_id,
      status,
      ml_version,
      created_at
    ) VALUES (
      v_pickup_station_id,
      v_cluster_id,
      'forming',
      p_ml_version,
      NOW()
    )
    RETURNING id INTO v_group_id;
  END IF;
  
  -- Count riders already in group
  SELECT COUNT(*) INTO v_rider_count FROM ride_members
  WHERE group_id = v_group_id;

  -- Add rider to group
  INSERT INTO ride_members (
    group_id,
    user_id,
    request_id,
    pickup_location,
    dropoff_location,
    fare_share
  )
  VALUES (
    v_group_id,
    p_rider_id,
    p_ride_request_id,
    (SELECT pickup_location FROM ride_requests WHERE id = p_ride_request_id),
    (SELECT dropoff_location FROM ride_requests WHERE id = p_ride_request_id),
    v_fare_amount
  )
  ON CONFLICT (group_id, user_id) DO NOTHING;

  -- Create fare_transaction if not already exists
  INSERT INTO fare_transactions (
    group_id,
    user_id,
    amount,
    status,
    created_at
  )
  SELECT 
    v_group_id,
    p_rider_id,
    v_fare_amount,
    'pending',
    NOW()
  WHERE NOT EXISTS (
    SELECT 1 FROM fare_transactions 
    WHERE group_id = v_group_id AND user_id = p_rider_id
  );

  RETURN v_group_id;
END;
$$ LANGUAGE plpgsql;
