# Metro-to-Last-Mile Manual Verification

This runbook validates the permanent handoff flow:
`Metro ticket -> 500m alert -> Request Ride with pickup prefilled -> Last-mile confirm -> Tracking timeout/success`.

## Pre-check

1. Frontend server is running.
2. ML service is running.
3. Supabase migrations already applied:
   - `009_update_confirm_ride_with_fare.sql`
   - `010_add_handoff_events.sql`
4. SQL validation file is available:
   - `011_handoff_validation_queries.sql`

## Functional Checks

### A. Happy Path (metro alert to successful ride)

1. Login as rider.
2. Open rider metro ticket page.
3. Select source and destination metro stations.
4. Enable arrival alert.
5. Book ticket.
6. Simulate entering 500m near destination station.
7. Confirm app redirects to request-ride with metro destination as pickup.
8. Verify pickup is prefilled and locked for metro-alert source.
9. Select final last-mile destination and continue.
10. Confirm ride and proceed to tracking.

Expected:
- No station mismatch.
- Confirm succeeds.
- Rider reaches tracking without errors.

### B. No-Driver Timeout Path

1. Repeat metro-alert handoff into request-ride.
2. Do not accept the forming group from any driver.
3. Wait for 3-minute timeout.

Expected:
- Rider transitions to no-driver-found terminal state.
- Retry path is available.
- No infinite loading loop.

### C. Notification Fallback Path

1. Deny browser notification permission.
2. Trigger 500m geofence event.

Expected:
- Fallback in-app message appears.
- Rider still redirects to request-ride with station context.

## Data Verification Queries

Run in Supabase SQL editor:

1. Open and run `011_handoff_validation_queries.sql`.
2. Confirm key outputs:
   - `has_canonical_confirm_ride_5arg = true`
   - `handoff_events` table exists and RLS is true
   - insert/select policies exist
   - event volume shows records after your tests

## Event Chain to Confirm

After completing the happy path, query output should include at least these events:

- `ticket_booked`
- `geofence_triggered`
- `notification_shown` OR `notification_fallback`
- `last_mile_opened`
- `last_mile_confirmed`

## Pass Criteria

Flow is considered stable and properly implemented when:

1. Metro destination always maps to the correct pickup UUID.
2. Alert-based handoff opens request-ride correctly.
3. Both success and timeout paths behave correctly.
4. Event trail is recorded in `handoff_events`.
5. No new frontend compile/type errors are present in modified files.
