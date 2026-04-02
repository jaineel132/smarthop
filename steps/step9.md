You are building SmartHop — a Mumbai Metro last-mile shared ride platform.
Read PROJECT_CONTEXT.md at the project root before writing any code.
Follow the navigation architecture defined in PROJECT_CONTEXT.md exactly.
Also implement the navigation changes specified for this step in Section D.
After generating files: run npx tsc --noEmit — zero TypeScript errors required.
Never show raw Error.message to users — always use Sonner toasts.
All Leaflet map components must use: dynamic(import, { ssr: false }).

⚠  NOTE:  ⚠  The Geolocation API and Notification API only work on HTTPS in production but work on localhost:3000 in development. Test the QR generation first, then test the geofence with two browser tabs (one acting as 'moving' device using DevTools → Location override).

Build the Metro Ticket page and Geofence notification system for SmartHop.
 
FILE 1: lib/notifications.ts
export function isNotificationSupported(): boolean { return 'Notification' in window }
export async function requestPermission(): Promise<boolean> {
  if (!isNotificationSupported()) return false
  const result = await Notification.requestPermission()
  return result === 'granted'
}
export function sendNotification(title:string, body:string, onClick?:()=>void): void {
  if (!isNotificationSupported() || Notification.permission !== 'granted') return
  const n = new Notification(title, {body, icon:'/favicon.ico'})
  if (onClick) n.onclick = () => { onClick(); n.close() }
}
 
FILE 2: lib/geofence.ts
export class GeofenceService {
  private watchId: number | null = null
  private triggered = false
  constructor(private targetLat:number, private targetLng:number, private radiusMeters=500) {}
  start(onEnter:()=>void): void {
    if (!navigator.geolocation) return
    this.triggered = false
    this.watchId = navigator.geolocation.watchPosition((pos) => {
      const dist = haversineDistance(pos.coords.latitude, pos.coords.longitude,
        this.targetLat, this.targetLng)
      if (dist < this.radiusMeters && !this.triggered) {
        this.triggered = true
        onEnter()
      }
    }, (err) => console.warn('Geofence error:', err),
    { enableHighAccuracy:true, maximumAge:10000 })
  }
  stop(): void { if (this.watchId) navigator.geolocation.clearWatch(this.watchId) }
  static isSupported(): boolean { return 'geolocation' in navigator }
}
Import haversineDistance from lib/utils.ts
 
FILE 3: hooks/useGeofence.ts
'use client'
export function useGeofence(station: MetroStation|null, enabled: boolean)
When enabled=true and station set:
  Create new GeofenceService(station.lat, station.lng)
  Call .start() with onEnter handler:
    sendNotification(
      'Arriving at ' + station.name + '!',
      'Book your last-mile ride now.',
      () => router.push('/rider/request-ride?station=' + station.id)
    )
On enabled=false or unmount: call .stop()
Returns: {isActive: boolean}
 
FILE 4: app/rider/metro-ticket/page.tsx
'use client'
import QRCode from 'qrcode'
 
State: fromStation, toStation, fare, ticket(saved ticket obj), alertEnabled, qrDataUrl
 
LAYOUT:
Header: back arrow + 'Book Metro Ticket' title
 
Journey Card (shadcn Card):
  'From' combobox: all stations from MUMBAI_METRO_STATIONS
  Swap button (↕) between From and To
  'To' combobox: same line as From only (filter by line)
  When both selected: show fare instantly using getMetroFare() in a badge
 
'Book Ticket' button (full width, blue, disabled until both stations selected):
  Generate ticket ID: 'SH-' + Date.now()
  QR data: JSON.stringify({id:ticketId, from:fromStation.name, to:toStation.name,
    fare, timestamp:Date.now(), valid_until:Date.now()+7200000})
  Generate QR: QRCode.toDataURL(qrData, {width:200, margin:2}) → qrDataUrl
  INSERT into metro_tickets table in Supabase
  Save ticket to local state to show ticket card
 
Ticket Card (shown after booking, Framer Motion slide up):
  Blue gradient header: 'SmartHop Metro Pass'
  From → To (arrow between)
  Date + Time + Fare
  QR code image (img tag with qrDataUrl as src)
  Ticket ID in monospace font
  Green badge: 'Valid for 2 hours'
 
Alert Toggle (below ticket card):
  Row: Bell icon + 'Alert me near [toStation.name]' + shadcn Switch
  On toggle ON: call requestPermission()
    If granted: setAlertEnabled(true), UPDATE metro_tickets SET alert_enabled=true
    If denied: toast.error('Enable notifications in browser settings')
  Status text if active: 'Ride alert active — notification fires 500m before station'
  useGeofence hook activated when alertEnabled=true

✓  VERIFICATION CHECKLIST — Complete ALL items before moving to Step 10
☐	Select From and To station — fare appears instantly below the dropdowns
☐	Swap button swaps the two stations
☐	'Book Ticket' creates a ticket card with a visible QR code image
☐	Ticket saved to Supabase — check metro_tickets table has a new row
☐	QR code is scannable — scan with phone camera (should show JSON text)
☐	Alert toggle ON triggers browser permission prompt
☐	After granting permission: toggle shows 'active' status text
☐	Test geofence via DevTools: F12 → More Tools → Sensors → Location
◦	Set location to Mumbai metro station coordinates
◦	Move location to within 500m of destination station
◦	Browser notification should fire
☐	Supabase metro_tickets table: alert_enabled=true when toggle is ON
