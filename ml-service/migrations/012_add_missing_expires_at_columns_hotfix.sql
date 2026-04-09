-- Hotfix: ensure expires_at exists for confirm_ride and waiting-room queries
-- Some environments were bootstrapped without these columns.

ALTER TABLE public.ride_requests
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

ALTER TABLE public.ride_groups
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

-- Backfill only where missing to keep old data usable and avoid immediate expiry.
UPDATE public.ride_requests
SET expires_at = COALESCE(created_at, NOW()) + interval '3 minutes'
WHERE expires_at IS NULL;

UPDATE public.ride_groups
SET expires_at = COALESCE(created_at, NOW()) + interval '3 minutes'
WHERE expires_at IS NULL AND status = 'forming';

ALTER TABLE public.ride_requests
  ALTER COLUMN expires_at SET DEFAULT (NOW() + interval '3 minutes');

ALTER TABLE public.ride_groups
  ALTER COLUMN expires_at SET DEFAULT (NOW() + interval '3 minutes');

CREATE INDEX IF NOT EXISTS idx_ride_requests_status_expires
  ON public.ride_requests(status, expires_at);

CREATE INDEX IF NOT EXISTS idx_ride_groups_station_status_expires
  ON public.ride_groups(station_id, status, expires_at);
