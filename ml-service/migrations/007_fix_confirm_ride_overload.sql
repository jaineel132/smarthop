-- Fix function overload ambiguity by dropping all old confirm_ride variants
-- This clears out any conflicting versions and creates ONE canonical 4-arg function

DROP FUNCTION IF EXISTS public.confirm_ride(UUID, UUID, VARCHAR);
DROP FUNCTION IF EXISTS public.confirm_ride(UUID, UUID, TEXT);
DROP FUNCTION IF EXISTS public.confirm_ride(UUID, UUID, UUID, UUID, NUMERIC, NUMERIC, INT, NUMERIC, INT, NUMERIC);
DROP FUNCTION IF EXISTS public.confirm_ride(UUID, TEXT, TEXT, UUID, NUMERIC, NUMERIC, INT, NUMERIC, INT, NUMERIC, VARCHAR);

-- Create the ONE canonical 4-argument confirm_ride function
-- Takes: rider_id, ride_request_id, ml_version, cluster_id
-- Returns: group_id
CREATE FUNCTION public.confirm_ride(
  p_rider_id UUID,
  p_ride_request_id UUID,
  p_ml_version TEXT,
  p_cluster_id TEXT
)
RETURNS UUID AS $$
DECLARE
  v_group_id UUID;
  v_pickup_station_id UUID;
BEGIN
  -- Load pickup_station_id from ride_request
  SELECT pickup_station_id
  INTO v_pickup_station_id
  FROM ride_requests
  WHERE id = p_ride_request_id;

  IF v_pickup_station_id IS NULL THEN
    RAISE EXCEPTION 'Ride request not found: %', p_ride_request_id;
  END IF;

  -- Check or create ride group based on cluster_id (passed from frontend)
  SELECT id INTO v_group_id FROM ride_groups 
  WHERE cluster_id = p_cluster_id 
    AND station_id = v_pickup_station_id 
    AND status = 'forming'
  LIMIT 1;
  
  IF v_group_id IS NULL THEN
    -- Create new forming group
    INSERT INTO ride_groups (station_id, cluster_id, status, ml_version, created_at)
    VALUES (v_pickup_station_id, p_cluster_id, 'forming', p_ml_version, NOW())
    RETURNING id INTO v_group_id;
  END IF;
  
  -- Add rider to group (fare_share will be set by frontend/app logic separately)
  INSERT INTO ride_members (group_id, user_id, request_id, fare_share)
  VALUES (v_group_id, p_rider_id, p_ride_request_id, 0)
  ON CONFLICT (group_id, user_id) DO NOTHING;

  -- Mark ride_request as matched so it's not used in future clustering
  UPDATE ride_requests SET status = 'matched' WHERE id = p_ride_request_id;

  RETURN v_group_id;
END;
$$ LANGUAGE plpgsql;
