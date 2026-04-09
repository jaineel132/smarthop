-- SmartHop Permanent Rebuild
-- Phase 2: Canonical RPCs, fare consistency, and lifecycle utilities.
-- Run after 002_schema_core.sql.

BEGIN;

-- Canonical confirm_ride signature used by frontend:
-- p_rider_id, p_ride_request_id, p_ml_version, p_cluster_id, p_fare_amount
CREATE OR REPLACE FUNCTION public.confirm_ride(
  p_rider_id uuid,
  p_ride_request_id uuid,
  p_ml_version text,
  p_cluster_id text,
  p_fare_amount numeric DEFAULT 0
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group_id uuid;
  v_station_id uuid;
  v_dest_lat numeric;
  v_dest_lng numeric;
  v_member_inserted integer := 0;
BEGIN
  SELECT pickup_station_id, dest_lat, dest_lng
  INTO v_station_id, v_dest_lat, v_dest_lng
  FROM public.ride_requests
  WHERE id = p_ride_request_id;

  IF v_station_id IS NULL THEN
    RAISE EXCEPTION 'Ride request not found: %', p_ride_request_id;
  END IF;

  -- Try to reuse a currently forming group for the same station+cluster.
  SELECT id
  INTO v_group_id
  FROM public.ride_groups
  WHERE station_id = v_station_id
    AND cluster_id = p_cluster_id
    AND status = 'forming'
  ORDER BY created_at DESC
  LIMIT 1;

  -- Create if none found.
  IF v_group_id IS NULL THEN
    BEGIN
      INSERT INTO public.ride_groups (
        station_id,
        cluster_id,
        status,
        ml_version,
        fare_total,
        center_lat,
        center_lng
      )
      VALUES (
        v_station_id,
        p_cluster_id,
        'forming',
        COALESCE(NULLIF(p_ml_version, ''), 'v2'),
        0,
        v_dest_lat,
        v_dest_lng
      )
      RETURNING id INTO v_group_id;
    EXCEPTION WHEN unique_violation THEN
      -- Another transaction won the race; fetch it.
      SELECT id
      INTO v_group_id
      FROM public.ride_groups
      WHERE station_id = v_station_id
        AND cluster_id = p_cluster_id
        AND status = 'forming'
      ORDER BY created_at DESC
      LIMIT 1;
    END;
  END IF;

  IF v_group_id IS NULL THEN
    RAISE EXCEPTION 'Unable to create or find forming group for station %, cluster %', v_station_id, p_cluster_id;
  END IF;

  INSERT INTO public.ride_members (
    group_id,
    user_id,
    request_id,
    fare_share,
    status
  )
  VALUES (
    v_group_id,
    p_rider_id,
    p_ride_request_id,
    GREATEST(COALESCE(p_fare_amount, 0), 0),
    'confirmed'
  )
  ON CONFLICT (group_id, user_id) DO UPDATE
  SET
    request_id = EXCLUDED.request_id,
    fare_share = EXCLUDED.fare_share,
    status = 'confirmed',
    updated_at = now();

  GET DIAGNOSTICS v_member_inserted = ROW_COUNT;

  UPDATE public.ride_requests
  SET
    status = 'matched',
    cluster_id = p_cluster_id,
    fare_amount = GREATEST(COALESCE(p_fare_amount, 0), 0),
    updated_at = now()
  WHERE id = p_ride_request_id;

  IF v_member_inserted > 0 THEN
    UPDATE public.ride_groups
    SET
      fare_total = COALESCE(fare_total, 0) + GREATEST(COALESCE(p_fare_amount, 0), 0),
      updated_at = now()
    WHERE id = v_group_id;
  END IF;

  RETURN v_group_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.recalculate_group_fares(
  p_group_id uuid
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_members_total numeric := 0;
  v_tx_total numeric := 0;
  v_final_total numeric := 0;
BEGIN
  SELECT COALESCE(SUM(fare_share), 0)
  INTO v_members_total
  FROM public.ride_members
  WHERE group_id = p_group_id
    AND status IN ('confirmed', 'arrived', 'completed');

  SELECT COALESCE(SUM(amount), 0)
  INTO v_tx_total
  FROM public.fare_transactions
  WHERE group_id = p_group_id
    AND status IN ('pending', 'paid');

  v_final_total := GREATEST(v_members_total, v_tx_total, 0);

  UPDATE public.ride_groups
  SET
    fare_total = v_final_total,
    updated_at = now()
  WHERE id = p_group_id;

  RETURN v_final_total;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_recalculate_group_fares()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_group_id uuid;
BEGIN
  v_group_id := COALESCE(NEW.group_id, OLD.group_id);
  IF v_group_id IS NOT NULL THEN
    PERFORM public.recalculate_group_fares(v_group_id);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_ride_members_recalc_group_fare ON public.ride_members;
CREATE TRIGGER trg_ride_members_recalc_group_fare
AFTER INSERT OR UPDATE OR DELETE ON public.ride_members
FOR EACH ROW EXECUTE FUNCTION public.trg_recalculate_group_fares();

DROP TRIGGER IF EXISTS trg_fare_transactions_recalc_group_fare ON public.fare_transactions;
CREATE TRIGGER trg_fare_transactions_recalc_group_fare
AFTER INSERT OR UPDATE OR DELETE ON public.fare_transactions
FOR EACH ROW EXECUTE FUNCTION public.trg_recalculate_group_fares();

-- Utility to prevent stale forming groups from repeatedly appearing.
CREATE OR REPLACE FUNCTION public.expire_stale_forming_groups(
  p_age_minutes integer DEFAULT 5
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated integer := 0;
BEGIN
  UPDATE public.ride_groups
  SET
    status = 'cancelled',
    updated_at = now()
  WHERE status = 'forming'
    AND driver_id IS NULL
    AND created_at < now() - make_interval(mins => p_age_minutes);

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  RETURN v_updated;
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_ride(uuid, uuid, text, text, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recalculate_group_fares(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.expire_stale_forming_groups(integer) TO authenticated;

COMMIT;
