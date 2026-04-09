-- SmartHop Permanent Rebuild
-- Phase 5: Post-rebuild checks.
-- Run after 005_seed_metro_stations.sql and verify each query result.

-- 1) Confirm 42 stations loaded.
SELECT COUNT(*) AS station_count FROM public.metro_stations;

-- 2) Confirm canonical RPC signatures exist and no overload drift remains.
SELECT
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS args,
  pg_get_function_result(p.oid) AS returns
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('confirm_ride', 'recalculate_group_fares', 'expire_stale_forming_groups')
ORDER BY p.proname, args;

-- 3) Confirm realtime publication includes required tables.
SELECT schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND schemaname = 'public'
  AND tablename IN (
    'metro_stations',
    'users',
    'metro_tickets',
    'ride_requests',
    'ride_groups',
    'ride_members',
    'routes',
    'driver_locations',
    'fare_transactions'
  )
ORDER BY tablename;

-- 4) Confirm RLS is enabled on every core table.
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'metro_stations',
    'users',
    'metro_tickets',
    'ride_requests',
    'ride_groups',
    'ride_members',
    'routes',
    'driver_locations',
    'fare_transactions'
  )
ORDER BY tablename;

-- 5) Confirm no stale-forming cleanup errors.
SELECT public.expire_stale_forming_groups(5) AS stale_groups_marked_cancelled;
