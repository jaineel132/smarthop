-- Fix confirm_ride race on forming-group creation and make retries idempotent.
-- Prevents unique index violations on uq_ride_groups_forming_station_cluster
-- under concurrent rider confirmations.

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
  v_request_status TEXT;
  v_request_expires_at TIMESTAMPTZ;
  v_created_group BOOLEAN := FALSE;
BEGIN
  -- Idempotency: if this request is already in a group, return that group.
  SELECT rm.group_id
  INTO v_group_id
  FROM public.ride_members rm
  WHERE rm.request_id = p_ride_request_id
  LIMIT 1;

  IF v_group_id IS NOT NULL THEN
    RETURN v_group_id;
  END IF;

  -- Load ride request lifecycle state.
  SELECT pickup_station_id, status, expires_at
  INTO v_pickup_station_id, v_request_status, v_request_expires_at
  FROM public.ride_requests
  WHERE id = p_ride_request_id;

  IF v_pickup_station_id IS NULL THEN
    RAISE EXCEPTION 'Ride request not found: %', p_ride_request_id;
  END IF;

  IF v_request_status IS DISTINCT FROM 'pending' THEN
    RAISE EXCEPTION 'Ride request is no longer pending: %', p_ride_request_id;
  END IF;

  IF v_request_expires_at IS NOT NULL AND v_request_expires_at <= NOW() THEN
    UPDATE public.ride_requests
    SET status = 'expired'
    WHERE id = p_ride_request_id;

    RAISE EXCEPTION 'Ride request expired: %', p_ride_request_id;
  END IF;

  -- Find active forming group if present.
  SELECT rg.id
  INTO v_group_id
  FROM public.ride_groups rg
  WHERE rg.cluster_id = p_cluster_id
    AND rg.station_id = v_pickup_station_id
    AND rg.status = 'forming'
    AND (rg.expires_at IS NULL OR rg.expires_at > NOW())
  LIMIT 1;

  -- Create forming group when absent; handle concurrent insert race gracefully.
  IF v_group_id IS NULL THEN
    BEGIN
      INSERT INTO public.ride_groups (
        station_id,
        cluster_id,
        status,
        ml_version,
        fare_total,
        expires_at,
        created_at,
        updated_at
      )
      VALUES (
        v_pickup_station_id,
        p_cluster_id,
        'forming',
        p_ml_version,
        p_fare_amount,
        NOW() + INTERVAL '3 minutes',
        NOW(),
        NOW()
      )
      RETURNING id INTO v_group_id;

      v_created_group := TRUE;
    EXCEPTION
      WHEN unique_violation THEN
        -- Another transaction won creation; fetch the winner group.
        SELECT rg.id
        INTO v_group_id
        FROM public.ride_groups rg
        WHERE rg.cluster_id = p_cluster_id
          AND rg.station_id = v_pickup_station_id
          AND rg.status = 'forming'
          AND (rg.expires_at IS NULL OR rg.expires_at > NOW())
        LIMIT 1;
    END;
  END IF;

  IF v_group_id IS NULL THEN
    RAISE EXCEPTION 'Unable to resolve forming group for cluster=% and station=%', p_cluster_id, v_pickup_station_id;
  END IF;

  -- Add this rider's fare once when joining an existing group.
  IF NOT v_created_group THEN
    UPDATE public.ride_groups
    SET
      fare_total = COALESCE(fare_total, 0) + p_fare_amount,
      updated_at = NOW()
    WHERE id = v_group_id;
  END IF;

  -- Join group idempotently by request_id (safe on retried confirm calls).
  INSERT INTO public.ride_members (group_id, user_id, request_id, fare_share)
  VALUES (v_group_id, p_rider_id, p_ride_request_id, 0)
  ON CONFLICT (request_id) DO NOTHING;

  -- Mark request as matched once group membership exists.
  UPDATE public.ride_requests
  SET status = 'matched'
  WHERE id = p_ride_request_id;

  RETURN v_group_id;
END;
$$ LANGUAGE plpgsql;
