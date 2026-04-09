-- Add a durable audit trail for metro-to-last-mile handoff events.

BEGIN;

CREATE TABLE IF NOT EXISTS public.handoff_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL CHECK (event_type IN (
    'ticket_booked',
    'geofence_triggered',
    'notification_shown',
    'notification_fallback',
    'last_mile_opened',
    'last_mile_confirmed'
  )),
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ticket_id uuid REFERENCES public.metro_tickets(id) ON DELETE SET NULL,
  ride_request_id uuid REFERENCES public.ride_requests(id) ON DELETE SET NULL,
  station_id uuid REFERENCES public.metro_stations(id) ON DELETE SET NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_handoff_events_type_created ON public.handoff_events(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_handoff_events_user_created ON public.handoff_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_handoff_events_ticket_created ON public.handoff_events(ticket_id, created_at DESC);

ALTER TABLE public.handoff_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS p_handoff_events_select_auth ON public.handoff_events;
DROP POLICY IF EXISTS p_handoff_events_insert_auth ON public.handoff_events;

CREATE POLICY p_handoff_events_select_auth
ON public.handoff_events
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY p_handoff_events_insert_auth
ON public.handoff_events
FOR INSERT
TO authenticated
WITH CHECK (true);

COMMIT;