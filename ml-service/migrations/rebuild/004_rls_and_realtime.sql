-- SmartHop Permanent Rebuild
-- Phase 3: RLS and Realtime setup.
-- Run after 003_functions_and_lifecycle.sql.

BEGIN;

ALTER TABLE public.metro_stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metro_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ride_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ride_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ride_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fare_transactions ENABLE ROW LEVEL SECURITY;

-- Drop old policies if rerun.
DROP POLICY IF EXISTS p_metro_stations_select_auth ON public.metro_stations;
DROP POLICY IF EXISTS p_users_select_auth ON public.users;
DROP POLICY IF EXISTS p_users_insert_self ON public.users;
DROP POLICY IF EXISTS p_users_update_self ON public.users;
DROP POLICY IF EXISTS p_metro_tickets_select_own ON public.metro_tickets;
DROP POLICY IF EXISTS p_metro_tickets_insert_own ON public.metro_tickets;
DROP POLICY IF EXISTS p_metro_tickets_update_own ON public.metro_tickets;
DROP POLICY IF EXISTS p_ride_requests_select_auth ON public.ride_requests;
DROP POLICY IF EXISTS p_ride_requests_insert_own ON public.ride_requests;
DROP POLICY IF EXISTS p_ride_requests_update_auth ON public.ride_requests;
DROP POLICY IF EXISTS p_ride_groups_select_auth ON public.ride_groups;
DROP POLICY IF EXISTS p_ride_groups_modify_auth ON public.ride_groups;
DROP POLICY IF EXISTS p_ride_members_select_auth ON public.ride_members;
DROP POLICY IF EXISTS p_ride_members_modify_auth ON public.ride_members;
DROP POLICY IF EXISTS p_routes_select_auth ON public.routes;
DROP POLICY IF EXISTS p_routes_modify_auth ON public.routes;
DROP POLICY IF EXISTS p_driver_locations_select_auth ON public.driver_locations;
DROP POLICY IF EXISTS p_driver_locations_insert_self ON public.driver_locations;
DROP POLICY IF EXISTS p_driver_locations_update_self ON public.driver_locations;
DROP POLICY IF EXISTS p_fare_transactions_select_auth ON public.fare_transactions;
DROP POLICY IF EXISTS p_fare_transactions_modify_auth ON public.fare_transactions;

-- Metro stations are public to signed-in users.
CREATE POLICY p_metro_stations_select_auth
ON public.metro_stations
FOR SELECT
TO authenticated
USING (true);

-- Users: broad read for name/rating lookups across rider+driver flows.
CREATE POLICY p_users_select_auth
ON public.users
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY p_users_insert_self
ON public.users
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

CREATE POLICY p_users_update_self
ON public.users
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Metro tickets are owner-scoped.
CREATE POLICY p_metro_tickets_select_own
ON public.metro_tickets
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY p_metro_tickets_insert_own
ON public.metro_tickets
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY p_metro_tickets_update_own
ON public.metro_tickets
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Ride requests: broad SELECT is intentional for matching/driver previews.
CREATE POLICY p_ride_requests_select_auth
ON public.ride_requests
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY p_ride_requests_insert_own
ON public.ride_requests
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY p_ride_requests_update_auth
ON public.ride_requests
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Ride groups/members/routes are shared operational data.
CREATE POLICY p_ride_groups_select_auth
ON public.ride_groups
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY p_ride_groups_modify_auth
ON public.ride_groups
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY p_ride_members_select_auth
ON public.ride_members
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY p_ride_members_modify_auth
ON public.ride_members
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY p_routes_select_auth
ON public.routes
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY p_routes_modify_auth
ON public.routes
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Driver locations: everyone can read live coordinates, only owner can write.
CREATE POLICY p_driver_locations_select_auth
ON public.driver_locations
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY p_driver_locations_insert_self
ON public.driver_locations
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = driver_id);

CREATE POLICY p_driver_locations_update_self
ON public.driver_locations
FOR UPDATE
TO authenticated
USING (auth.uid() = driver_id)
WITH CHECK (auth.uid() = driver_id);

-- Fare transactions: broad operational access for earnings and ride completion.
CREATE POLICY p_fare_transactions_select_auth
ON public.fare_transactions
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY p_fare_transactions_modify_auth
ON public.fare_transactions
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Realtime publication for all live features.
DO $$
DECLARE
  t text;
  table_names text[] := ARRAY[
    'metro_stations',
    'users',
    'metro_tickets',
    'ride_requests',
    'ride_groups',
    'ride_members',
    'routes',
    'driver_locations',
    'fare_transactions'
  ];
BEGIN
  FOREACH t IN ARRAY table_names LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    EXCEPTION
      WHEN duplicate_object THEN
        NULL;
      WHEN invalid_parameter_value THEN
        NULL;
    END;
  END LOOP;
END
$$;

COMMIT;
