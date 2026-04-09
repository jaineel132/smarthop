-- Manual validation queries for metro-to-last-mile permanent flow.
-- Run in Supabase SQL editor after applying migrations.

-- 1) Confirm latest confirm_ride signature exists.
SELECT
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS args,
  pg_get_function_result(p.oid) AS returns
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'confirm_ride'
ORDER BY args;

-- 1b) Confirm canonical 5-arg confirm_ride is present (includes p_fare_amount).
SELECT
  EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'confirm_ride'
      AND pg_get_function_identity_arguments(p.oid)
        LIKE '%p_rider_id uuid, p_ride_request_id uuid, p_ml_version text, p_cluster_id text, p_fare_amount numeric%'
  ) AS has_canonical_confirm_ride_5arg;

-- 2) Confirm handoff_events table exists and RLS is enabled.
SELECT
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename = 'handoff_events';

-- 3) Confirm handoff_events policies.
SELECT
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'handoff_events'
ORDER BY policyname;

-- 4) Validate demand_level type (run to verify 008 state, do not alter here).
SELECT
  column_name,
  data_type,
  numeric_precision,
  numeric_scale
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'ride_requests'
  AND column_name = 'demand_level';

-- 5) Quick station-duplicate awareness check.
SELECT name, COUNT(*) AS cnt
FROM public.metro_stations
GROUP BY name
HAVING COUNT(*) > 1
ORDER BY cnt DESC, name;

-- 6) Handoff event volume snapshot (last 24h).
SELECT
  event_type,
  COUNT(*) AS event_count
FROM public.handoff_events
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY event_type
ORDER BY event_count DESC;

-- 7) Spot-check latest handoff chain for debugging.
SELECT
  event_type,
  user_id,
  ticket_id,
  ride_request_id,
  station_id,
  created_at,
  details
FROM public.handoff_events
ORDER BY created_at DESC
LIMIT 50;

-- 8) Optional consistency check: metro-alert opens that never confirmed.
SELECT
  e.user_id,
  e.ticket_id,
  e.station_id,
  e.created_at AS opened_at
FROM public.handoff_events e
WHERE e.event_type = 'last_mile_opened'
  AND e.created_at >= NOW() - INTERVAL '24 hours'
  AND NOT EXISTS (
    SELECT 1
    FROM public.handoff_events c
    WHERE c.event_type = 'last_mile_confirmed'
      AND c.user_id = e.user_id
      AND c.ticket_id IS NOT DISTINCT FROM e.ticket_id
      AND c.created_at >= e.created_at
  )
ORDER BY e.created_at DESC;

-- 9) Optional event-sequence check by ticket (booked -> opened -> confirmed).
SELECT
  h.ticket_id,
  MAX(CASE WHEN h.event_type = 'ticket_booked' THEN h.created_at END) AS booked_at,
  MAX(CASE WHEN h.event_type = 'last_mile_opened' THEN h.created_at END) AS opened_at,
  MAX(CASE WHEN h.event_type = 'last_mile_confirmed' THEN h.created_at END) AS confirmed_at
FROM public.handoff_events h
WHERE h.ticket_id IS NOT NULL
GROUP BY h.ticket_id
ORDER BY MAX(h.created_at) DESC
LIMIT 50;