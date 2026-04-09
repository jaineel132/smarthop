-- SmartHop Permanent Rebuild
-- Phase 1B: Canonical schema (single source of truth).
-- Run after 001_full_reset.sql.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Shared utility: auto-updated updated_at.
CREATE OR REPLACE FUNCTION public.set_timestamp()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Keep both name/full_name in sync because different pages query different fields.
CREATE OR REPLACE FUNCTION public.sync_user_name_fields()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.name IS NULL AND NEW.full_name IS NOT NULL THEN
    NEW.name = NEW.full_name;
  END IF;

  IF NEW.full_name IS NULL AND NEW.name IS NOT NULL THEN
    NEW.full_name = NEW.name;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TABLE public.metro_stations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  line text NOT NULL CHECK (line IN ('Line 1', 'Line 2A', 'Line 7')),
  lat numeric(10, 7) NOT NULL,
  lng numeric(10, 7) NOT NULL,
  zone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_metro_stations_name_line UNIQUE (name, line)
);

CREATE TABLE public.users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  name text,
  full_name text,
  role text NOT NULL DEFAULT 'rider' CHECK (role IN ('rider', 'driver', 'admin')),
  home_station_id uuid REFERENCES public.metro_stations(id) ON DELETE SET NULL,
  onboarding_complete boolean NOT NULL DEFAULT false,
  driver_rating numeric(3, 2) NOT NULL DEFAULT 4.80,
  vehicle_type text CHECK (vehicle_type IN ('auto', 'car')),
  vehicle_number text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.metro_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  from_station_id uuid NOT NULL REFERENCES public.metro_stations(id) ON DELETE RESTRICT,
  to_station_id uuid NOT NULL REFERENCES public.metro_stations(id) ON DELETE RESTRICT,
  qr_code text NOT NULL,
  fare numeric(10, 2) NOT NULL CHECK (fare >= 0),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'used', 'expired', 'cancelled')),
  alert_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.ride_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  pickup_station_id uuid NOT NULL REFERENCES public.metro_stations(id) ON DELETE RESTRICT,
  dest_lat numeric(10, 7) NOT NULL,
  dest_lng numeric(10, 7) NOT NULL,
  dest_address text,
  hour integer CHECK (hour BETWEEN 0 AND 23),
  day_of_week integer CHECK (day_of_week BETWEEN 0 AND 6),
  demand_level numeric(4, 2),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'matched', 'cancelled', 'expired')),
  cluster_id text,
  fare_amount numeric(10, 2) NOT NULL DEFAULT 0,
  distance_km numeric(10, 2),
  duration_min integer,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '3 minutes'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.ride_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id uuid NOT NULL REFERENCES public.metro_stations(id) ON DELETE RESTRICT,
  driver_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  cluster_id text NOT NULL,
  status text NOT NULL DEFAULT 'forming' CHECK (status IN ('forming', 'accepted', 'in_progress', 'completed', 'cancelled')),
  ml_version text NOT NULL DEFAULT 'v2',
  fare_total numeric(10, 2) NOT NULL DEFAULT 0,
  distance_km numeric(10, 2) NOT NULL DEFAULT 0,
  duration_min integer NOT NULL DEFAULT 0,
  center_lat numeric(10, 7),
  center_lng numeric(10, 7),
  geometry jsonb,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '3 minutes'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.ride_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.ride_groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  request_id uuid NOT NULL REFERENCES public.ride_requests(id) ON DELETE CASCADE,
  fare_share numeric(10, 2) NOT NULL DEFAULT 0,
  solo_fare numeric(10, 2) NOT NULL DEFAULT 0,
  savings_pct numeric(6, 2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'arrived', 'completed', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_ride_members_group_user UNIQUE (group_id, user_id),
  CONSTRAINT uq_ride_members_request UNIQUE (request_id)
);

CREATE TABLE public.routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL UNIQUE REFERENCES public.ride_groups(id) ON DELETE CASCADE,
  waypoints jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_distance_km numeric(10, 2) NOT NULL DEFAULT 0,
  total_duration_min integer NOT NULL DEFAULT 0,
  optimized_order jsonb NOT NULL DEFAULT '[]'::jsonb,
  geometry jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.driver_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  lat numeric(10, 7),
  lng numeric(10, 7),
  is_online boolean NOT NULL DEFAULT false,
  current_station_id uuid REFERENCES public.metro_stations(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.fare_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.ride_groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount numeric(10, 2) NOT NULL CHECK (amount >= 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'refunded')),
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_fare_transactions_group_user UNIQUE (group_id, user_id)
);

-- Performance indexes used by ride matching, dashboard polling, and earnings pages.
CREATE INDEX idx_users_role ON public.users(role);
CREATE INDEX idx_ride_requests_station_status_created ON public.ride_requests(pickup_station_id, status, created_at DESC);
CREATE INDEX idx_ride_requests_status_expires ON public.ride_requests(status, expires_at);
CREATE INDEX idx_ride_requests_user ON public.ride_requests(user_id);
CREATE INDEX idx_ride_groups_station_status_created ON public.ride_groups(station_id, status, created_at DESC);
CREATE INDEX idx_ride_groups_station_status_expires ON public.ride_groups(station_id, status, expires_at);
CREATE INDEX idx_ride_groups_driver_status_created ON public.ride_groups(driver_id, status, created_at DESC);
CREATE INDEX idx_ride_members_group ON public.ride_members(group_id);
CREATE INDEX idx_ride_members_user ON public.ride_members(user_id);
CREATE INDEX idx_driver_locations_station_online ON public.driver_locations(current_station_id, is_online);
CREATE INDEX idx_fare_transactions_group_status ON public.fare_transactions(group_id, status);
CREATE INDEX idx_fare_transactions_user_created ON public.fare_transactions(user_id, created_at DESC);

-- Prevent duplicate forming groups for same station+cluster under race.
CREATE UNIQUE INDEX uq_ride_groups_forming_station_cluster
ON public.ride_groups(station_id, cluster_id)
WHERE status = 'forming';

-- Updated-at triggers.
CREATE TRIGGER trg_metro_stations_set_timestamp
BEFORE UPDATE ON public.metro_stations
FOR EACH ROW EXECUTE FUNCTION public.set_timestamp();

CREATE TRIGGER trg_users_sync_name_fields
BEFORE INSERT OR UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.sync_user_name_fields();

CREATE TRIGGER trg_users_set_timestamp
BEFORE UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.set_timestamp();

CREATE TRIGGER trg_metro_tickets_set_timestamp
BEFORE UPDATE ON public.metro_tickets
FOR EACH ROW EXECUTE FUNCTION public.set_timestamp();

CREATE TRIGGER trg_ride_requests_set_timestamp
BEFORE UPDATE ON public.ride_requests
FOR EACH ROW EXECUTE FUNCTION public.set_timestamp();

CREATE TRIGGER trg_ride_groups_set_timestamp
BEFORE UPDATE ON public.ride_groups
FOR EACH ROW EXECUTE FUNCTION public.set_timestamp();

CREATE TRIGGER trg_ride_members_set_timestamp
BEFORE UPDATE ON public.ride_members
FOR EACH ROW EXECUTE FUNCTION public.set_timestamp();

CREATE TRIGGER trg_routes_set_timestamp
BEFORE UPDATE ON public.routes
FOR EACH ROW EXECUTE FUNCTION public.set_timestamp();

CREATE TRIGGER trg_driver_locations_set_timestamp
BEFORE UPDATE ON public.driver_locations
FOR EACH ROW EXECUTE FUNCTION public.set_timestamp();

CREATE TRIGGER trg_fare_transactions_set_timestamp
BEFORE UPDATE ON public.fare_transactions
FOR EACH ROW EXECUTE FUNCTION public.set_timestamp();

COMMIT;
