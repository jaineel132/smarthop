-- Update confirm_ride to accept and set fare_total
-- This allows the frontend to pass the shared fare so it's available immediately for notifications

DROP FUNCTION IF EXISTS public.confirm_ride(UUID, UUID, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.confirm_ride(
  p_rider_id UUID,
  p_ride_request_id UUID,
  p_ml_version TEXT,
  p_cluster_id TEXT,
  p_fare_amount NUMERIC DEFAULT 0
)
RETURNS UUID AS $$
DECLARE
  v_group_id UUID;
  v_pickup_station_id UUID;
  v_current_fare_total NUMERIC;
  v_request_status TEXT;
  v_request_expires_at TIMESTAMPTZ;
BEGIN
  -- Load pickup_station_id from ride_request
  SELECT pickup_station_id, status, expires_at
  INTO v_pickup_station_id, v_request_status, v_request_expires_at
  FROM ride_requests
  WHERE id = p_ride_request_id;

  IF v_pickup_station_id IS NULL THEN
    RAISE EXCEPTION 'Ride request not found: %', p_ride_request_id;
  END IF;

  IF v_request_status IS DISTINCT FROM 'pending' THEN
    RAISE EXCEPTION 'Ride request is no longer pending: %', p_ride_request_id;
  END IF;

  IF v_request_expires_at IS NOT NULL AND v_request_expires_at <= NOW() THEN
    UPDATE ride_requests
    SET status = 'expired'
    WHERE id = p_ride_request_id;

    RAISE EXCEPTION 'Ride request expired: %', p_ride_request_id;
  END IF;

  -- Check or create ride group based on cluster_id (passed from frontend)
  SELECT id, COALESCE(fare_total, 0) INTO v_group_id, v_current_fare_total FROM ride_groups 
  WHERE cluster_id = p_cluster_id 
    AND station_id = v_pickup_station_id 
    AND status = 'forming'
    AND (expires_at IS NULL OR expires_at > NOW())
  LIMIT 1;
  
  IF v_group_id IS NULL THEN
    -- Create new forming group with initial fare
    INSERT INTO ride_groups (station_id, cluster_id, status, ml_version, fare_total, expires_at, created_at)
    VALUES (v_pickup_station_id, p_cluster_id, 'forming', p_ml_version, p_fare_amount, NOW() + INTERVAL '3 minutes', NOW())
    RETURNING id, COALESCE(fare_total, 0) INTO v_group_id, v_current_fare_total;
  ELSE
    -- Update existing group fare (accumulate if multiple riders)
    UPDATE ride_groups 
    SET fare_total = COALESCE(fare_total, 0) + p_fare_amount
    WHERE id = v_group_id;
  END IF;
  
  -- Add rider to group
  INSERT INTO ride_members (group_id, user_id, request_id, fare_share)
  VALUES (v_group_id, p_rider_id, p_ride_request_id, 0)
  ON CONFLICT (group_id, user_id) DO NOTHING;

  -- Mark ride_request as matched so it's not used in future clustering
  UPDATE ride_requests SET status = 'matched' WHERE id = p_ride_request_id;

  RETURN v_group_id;
END;
$$ LANGUAGE plpgsql;
