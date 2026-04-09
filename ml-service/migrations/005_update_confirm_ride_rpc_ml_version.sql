-- Phase 4: Update confirm_ride RPC to accept and persist ml_version parameter
-- This function is called by riders at confirmation time and should track which ML version was used

-- IMPORTANT: This migration assumes the existing confirm_ride function exists.
-- If it doesn't, you'll need to create it based on your codebase.
-- This script REPLACES the existing function with an updated version that accepts p_ml_version.

CREATE OR REPLACE FUNCTION public.confirm_ride(
  p_user_id UUID,
  p_pickup_station_id UUID,
  p_cluster_id TEXT,
  p_ride_request_id UUID,
  p_fare_total NUMERIC,
  p_distance_km NUMERIC,
  p_duration_min INT,
  p_fare_share NUMERIC,
  p_savings_pct INT,
  p_solo_fare NUMERIC,
  p_ml_version VARCHAR DEFAULT 'v1'  -- NEW: ML version used for this group
)
RETURNS UUID AS $$
DECLARE
  v_group_id UUID;
BEGIN
  -- Check or create ride group with ml_version tracking
  SELECT id INTO v_group_id FROM ride_groups 
  WHERE cluster_id = p_cluster_id 
    AND station_id = p_pickup_station_id 
    AND status = 'forming'
  LIMIT 1;
  
  IF v_group_id IS NULL THEN
    -- Create new group with ml_version
    INSERT INTO ride_groups (
      station_id,
      cluster_id,
      status,
      ml_version,  -- NEW: persist the ML version
      created_at
    ) VALUES (
      p_pickup_station_id,
      p_cluster_id,
      'forming',
      p_ml_version,  -- NEW: store which version created this group
      NOW()
    )
    RETURNING id INTO v_group_id;
  END IF;
  
  -- Add member to group
  INSERT INTO ride_members (
    group_id,
    user_id,
    request_id,
    status
  ) VALUES (
    v_group_id,
    p_user_id,
    p_ride_request_id,
    'confirmed'
  )
  ON CONFLICT (group_id, user_id) DO NOTHING;
  
  RETURN v_group_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.confirm_ride IS 'Create or join a ride group with ML version attribution. Now tracks p_ml_version for observability.';
