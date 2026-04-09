-- SmartHop Permanent Rebuild
-- Phase 6: End-to-end smoke test companion queries
-- Use these while executing one full ride flow in UI.

-- A) Most recent ride requests
SELECT id, user_id, pickup_station_id, status, cluster_id, fare_amount, created_at
FROM public.ride_requests
ORDER BY created_at DESC
LIMIT 10;

-- B) Most recent ride groups
SELECT id, station_id, driver_id, cluster_id, status, ml_version, fare_total, distance_km, duration_min, created_at
FROM public.ride_groups
ORDER BY created_at DESC
LIMIT 10;

-- C) Members joined to latest groups
SELECT rm.id, rm.group_id, rm.user_id, rm.request_id, rm.fare_share, rm.solo_fare, rm.savings_pct, rm.status, rm.created_at
FROM public.ride_members rm
JOIN public.ride_groups rg ON rg.id = rm.group_id
ORDER BY rg.created_at DESC, rm.created_at ASC
LIMIT 30;

-- D) Fare transactions for latest groups
SELECT ft.id, ft.group_id, ft.user_id, ft.amount, ft.status, ft.paid_at, ft.created_at
FROM public.fare_transactions ft
JOIN public.ride_groups rg ON rg.id = ft.group_id
ORDER BY rg.created_at DESC, ft.created_at ASC
LIMIT 30;

-- E) Route record existence and route metrics
SELECT r.id, r.group_id, r.total_distance_km, r.total_duration_min, jsonb_array_length(r.waypoints) AS waypoint_count, r.created_at
FROM public.routes r
JOIN public.ride_groups rg ON rg.id = r.group_id
ORDER BY rg.created_at DESC
LIMIT 10;

-- F) Driver location heartbeat
SELECT driver_id, is_online, current_station_id, lat, lng, updated_at
FROM public.driver_locations
ORDER BY updated_at DESC
LIMIT 10;

-- G) Fare consistency check by group (members vs transactions vs ride_groups.fare_total)
SELECT
  g.id,
  g.status,
  g.fare_total,
  COALESCE(m.members_total, 0) AS members_total,
  COALESCE(t.tx_total, 0) AS tx_total,
  CASE
    WHEN g.fare_total = GREATEST(COALESCE(m.members_total, 0), COALESCE(t.tx_total, 0)) THEN 'OK'
    ELSE 'MISMATCH'
  END AS fare_consistency
FROM public.ride_groups g
LEFT JOIN (
  SELECT group_id, SUM(fare_share) AS members_total
  FROM public.ride_members
  WHERE status IN ('confirmed', 'arrived', 'completed')
  GROUP BY group_id
) m ON m.group_id = g.id
LEFT JOIN (
  SELECT group_id, SUM(amount) AS tx_total
  FROM public.fare_transactions
  WHERE status IN ('pending', 'paid')
  GROUP BY group_id
) t ON t.group_id = g.id
ORDER BY g.created_at DESC
LIMIT 20;

-- H) Duplicate safety checks
SELECT 'dup_forming_station_cluster' AS check_name, COUNT(*) AS issues
FROM (
  SELECT station_id, cluster_id
  FROM public.ride_groups
  WHERE status = 'forming'
  GROUP BY station_id, cluster_id
  HAVING COUNT(*) > 1
) x
UNION ALL
SELECT 'dup_member_group_user' AS check_name, COUNT(*) AS issues
FROM (
  SELECT group_id, user_id
  FROM public.ride_members
  GROUP BY group_id, user_id
  HAVING COUNT(*) > 1
) y
UNION ALL
SELECT 'dup_tx_group_user' AS check_name, COUNT(*) AS issues
FROM (
  SELECT group_id, user_id
  FROM public.fare_transactions
  GROUP BY group_id, user_id
  HAVING COUNT(*) > 1
) z;
