-- SmartHop Permanent Rebuild
-- Phase 1A: Full reset of app-owned public schema objects.
-- Run this first in Supabase SQL Editor.

BEGIN;

-- Extensions required by this project.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Drop triggers first to avoid dependency noise.
DROP TRIGGER IF EXISTS trg_users_set_timestamp ON public.users;
DROP TRIGGER IF EXISTS trg_users_sync_name_fields ON public.users;
DROP TRIGGER IF EXISTS trg_metro_tickets_set_timestamp ON public.metro_tickets;
DROP TRIGGER IF EXISTS trg_ride_requests_set_timestamp ON public.ride_requests;
DROP TRIGGER IF EXISTS trg_ride_groups_set_timestamp ON public.ride_groups;
DROP TRIGGER IF EXISTS trg_ride_members_set_timestamp ON public.ride_members;
DROP TRIGGER IF EXISTS trg_routes_set_timestamp ON public.routes;
DROP TRIGGER IF EXISTS trg_driver_locations_set_timestamp ON public.driver_locations;
DROP TRIGGER IF EXISTS trg_fare_transactions_set_timestamp ON public.fare_transactions;
DROP TRIGGER IF EXISTS trg_ride_members_recalc_group_fare ON public.ride_members;
DROP TRIGGER IF EXISTS trg_fare_transactions_recalc_group_fare ON public.fare_transactions;

-- Drop functions (all known variants that caused drift/overload issues).
DROP FUNCTION IF EXISTS public.set_timestamp();
DROP FUNCTION IF EXISTS public.sync_user_name_fields();
DROP FUNCTION IF EXISTS public.confirm_ride(uuid, uuid, text, text, numeric);
DROP FUNCTION IF EXISTS public.confirm_ride(uuid, uuid, text, text);
DROP FUNCTION IF EXISTS public.confirm_ride(uuid, uuid, varchar);
DROP FUNCTION IF EXISTS public.confirm_ride(uuid, uuid, text);
DROP FUNCTION IF EXISTS public.confirm_ride(uuid, uuid, uuid, uuid, numeric, numeric, integer, numeric, integer, numeric);
DROP FUNCTION IF EXISTS public.confirm_ride(uuid, text, text, uuid, numeric, numeric, integer, numeric, integer, numeric, varchar);
DROP FUNCTION IF EXISTS public.recalculate_group_fares(uuid);
DROP FUNCTION IF EXISTS public.expire_stale_forming_groups(integer);
DROP FUNCTION IF EXISTS public.trg_recalculate_group_fares();

-- Drop app tables in dependency order.
DROP TABLE IF EXISTS public.fare_transactions CASCADE;
DROP TABLE IF EXISTS public.driver_locations CASCADE;
DROP TABLE IF EXISTS public.routes CASCADE;
DROP TABLE IF EXISTS public.ride_members CASCADE;
DROP TABLE IF EXISTS public.ride_groups CASCADE;
DROP TABLE IF EXISTS public.ride_requests CASCADE;
DROP TABLE IF EXISTS public.metro_tickets CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;
DROP TABLE IF EXISTS public.metro_stations CASCADE;

COMMIT;
