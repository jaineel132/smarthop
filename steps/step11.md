You are building SmartHop — a Mumbai Metro last-mile shared ride platform.
Read PROJECT_CONTEXT.md at the project root before writing any code.
Follow the navigation architecture defined in PROJECT_CONTEXT.md exactly.
Also implement the navigation changes specified for this step in Section D.
After generating files: run npx tsc --noEmit — zero TypeScript errors required.
Never show raw Error.message to users — always use Sonner toasts.
All Leaflet map components must use: dynamic(import, { ssr: false }).

⚠  NOTE:  ⚠  For Realtime tracking to work, driver_locations must have Realtime enabled in Supabase (Step 1). Test by opening driver dashboard in one tab and rider tracking in another — update driver location in Supabase and verify the rider map moves.


Build three pages: Live Tracking, Fare Summary, and Ride History for SmartHop.
 
FILE 1: hooks/useRealtime.ts
'use client'
export function useDriverLocation(driverId: string|null)
Returns: {lat:number|null, lng:number|null, lastUpdated:Date|null}
Subscribes to Supabase Realtime on driver_locations WHERE driver_id=eq.[driverId]
Channel: 'driver-location-' + driverId
On postgres_changes UPDATE event: update state with new lat/lng
Cleanup: removeChannel on unmount
If driverId is null: return nulls
 
FILE 2: components/maps/LiveTrackingMap.tsx
Props: driverLat, driverLng, riderLat, riderLng, waypoints:Waypoint[], currentStopIndex:number
Leaflet map, ssr:false
Rider pin: blue CircleMarker at riderLat/riderLng with 'You' popup
Driver pin: custom icon (use Lucide Car rendered to SVG string or emoji div icon)
  Pulsing ring animation around driver pin using CSS keyframes
  When driverLat/Lng changes: flyTo driver position (map.flyTo([lat,lng], zoom, {duration:1}))
Waypoints: numbered DivIcons (1,2,3...) at each stop lat/lng
  Current stop: blue, completed: green checkmark, upcoming: gray
Route polyline: blue dashed line connecting all waypoints in order
Height: 55vh, minHeight:280px
scrollWheelZoom={false}
 
FILE 3: app/rider/tracking/[groupId]/page.tsx
'use client'
const LiveTrackingMap = dynamic(
  () => import('@/components/maps/LiveTrackingMap'),
  { ssr: false }
)
On load: fetch ride_group, route, ride_members, driver user profile
Use useDriverLocation(group.driver_id)
Poll ride_group status every 10s: when status='completed' → redirect to /rider/fare-summary/[groupId]
Layout:
  LiveTrackingMap (top 55% of screen)
  Bottom panel (45%):
    Driver card: avatar+name, star rating, 'On the way' status, auto number MH02AB1234
    ETA: '~[duration] min' static
    Stop progress: horizontal step bar — all drop points as steps
    SOS button: fixed bottom-right, red, small, Lucide Phone icon
      Opens shadcn Dialog: 'Emergency? Call 112' with tel:112 link
 
FILE 4: app/rider/fare-summary/[groupId]/page.tsx
'use client'
On load: fetch ride_group, ride_member (for this user), route
Call predictFare to get fresh XAI explanation
Layout:
  Animated green checkmark (Framer Motion scale 0→1.2→1)
  'Ride Complete!' heading
  Fare Card: 'Your share: ₹[fare_share]', total group fare, savings amount
  Green savings badge: '[savings_pct]% cheaper than solo'
  XAI Breakdown Card: 3 Progress bars (same as FareBreakdownAccordion in Step 10)
  Trip summary: From/To, distance, duration, co-riders count
  Rate Driver: 5 star buttons (shadcn RadioGroup style)
    On submit: UPDATE users SET driver_rating=newAvg WHERE id=driver_id
    toast.success('Thanks for rating!')
  CTA buttons: 'Book Return Ride' → /rider/request-ride, 'Dashboard' → /rider/dashboard
 
FILE 5: app/rider/history/page.tsx
'use client'
Fetch ride_members JOIN ride_groups WHERE user_id=[current user], order by created_at DESC
Layout:
  Top banner: 'Total saved: ₹[sum of savings]' in green card
  Rides list: shadcn Card for each, showing date, route, riders count, fare, savings %
  Each card expandable (shadcn Accordion) to show XAI breakdown
  Recharts BarChart at bottom: weekly spending last 4 weeks
    2 bars per week: shared_fare (blue) and solo_fare (gray) for comparison
    Tooltip: amounts on hover
  Empty state: 'No rides yet — book your first ride!' with button

✓  VERIFICATION CHECKLIST — Complete ALL items before moving to Step 12
☐	Tracking page loads at /rider/tracking/[groupId] without error
☐	LiveTrackingMap renders with rider pin visible
☐	Supabase Realtime test: manually UPDATE a row in driver_locations via Supabase SQL editor
◦	UPDATE driver_locations SET lat=19.09, lng=72.91 WHERE driver_id='[some id]'
◦	Rider tracking map pin should move without page refresh
☐	SOS dialog opens on SOS button click — shows tel:112 link
☐	Fare Summary page: checkmark animation plays on load
☐	XAI breakdown: 3 progress bars visible with labels and percentages
☐	Star rating submits and updates driver_rating in Supabase users table
☐	Ride History: shows list of past rides (book one first if empty)
☐	Recharts bar chart renders without error (may need data to show bars)
☐	'Book Return Ride' button navigates to request-ride page
