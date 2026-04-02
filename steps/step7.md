You are building SmartHop — a Mumbai Metro last-mile shared ride platform.
Read PROJECT_CONTEXT.md at the project root before writing any code.
Follow the navigation architecture defined in PROJECT_CONTEXT.md exactly.
Also implement the navigation changes specified for this step in Section D.
After generating files: run npx tsc --noEmit — zero TypeScript errors required.
Never show raw Error.message to users — always use Sonner toasts.
All Leaflet map components must use: dynamic(import, { ssr: false }).


⚠  NOTE:  ⚠  CRITICAL: Any component that uses Leaflet (React-Leaflet maps) MUST be imported with: const MapComponent = dynamic(() => import('@/components/maps/StaticMetroMap'), { ssr: false }). Leaflet uses window object and WILL crash on server render without this.


Build the public landing page for SmartHop.
Files: app/page.tsx and multiple component files.
Mobile-first design. No auth required.
 
CRITICAL: Leaflet must use dynamic import:
import dynamic from 'next/dynamic'
const StaticMetroMap = dynamic(() => import('@/components/maps/StaticMetroMap'), { ssr:false })
 
SECTION 1 — Hero (components/shared/HeroSection.tsx)
Full-width gradient background: bg-gradient-to-br from-blue-900 to-blue-700
Padding: py-20 on desktop, py-12 on mobile
Large heading (text-5xl desktop, text-3xl mobile, white, bold):
  'Smart Last-Mile Rides from Mumbai Metro'
Subheading (text-xl, blue-200):
  'Share an auto-rickshaw with commuters heading your way. Save up to 40%.'
Two CTA buttons (mt-8, flex gap-4, flex-col on mobile):
  Primary: white bg, blue text — 'Book a Ride' → /auth/signup
  Secondary: outline white — 'Drive with Us' → /auth/signup?role=driver
Framer Motion: heading fades up (y:30→0, opacity:0→1), buttons stagger 0.2s delay
 
SECTION 2 — How It Works (components/shared/HowItWorks.tsx)
White background, py-16
Centered heading: 'How SmartHop Works' (text-3xl, bold, dark)
4 steps in grid: grid-cols-1 mobile, grid-cols-2 md, grid-cols-4 lg
Each step: rounded card, light blue bg, center-aligned
  Step 1: Ticket icon (Lucide Ticket) — 'Book Metro Ticket'
  Step 2: Bell icon — 'Get Notified'
  Step 3: Users icon — 'Join a Group'
  Step 4: IndianRupee icon — 'Pay Your Share'
Framer Motion: cards animate in as they enter viewport (use useInView from framer-motion)
Stagger: each card delays 0.1s more than previous
 
SECTION 3 — Stats Strip
Dark blue background (bg-blue-900), py-8
3 stats in flex row (wrap on mobile):
  '12,400+ Rides' | 'Avg 38% Savings' | '3 Metro Lines'
Each: large white number, small blue-200 label below
 
SECTION 4 — Metro Map Preview
File: components/maps/StaticMetroMap.tsx
React-Leaflet MapContainer centered on Mumbai [19.0760, 72.8777] zoom=11
TileLayer: https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png
Plot all stations from MUMBAI_METRO_STATIONS (lib/stations.ts):
  CircleMarker for each station
  Color: Line 1 = blue (#3B82F6), Line 2A = red (#EF4444), Line 7 = green (#22C55E)
  Radius 7, fillOpacity 0.8
  Popup on click: station name + line badge
Map height: 300px mobile, 420px desktop
Section: white bg, py-16, heading 'Covering Mumbai Metro Lines 1, 2A & 7'
Line legend below map: colored dots with line names
 
SECTION 5 — Footer (components/shared/Footer.tsx)
Dark bg (bg-slate-900), white text
Top row: 'SmartHop' logo left, nav links right (How It Works, Login, Sign Up)
Bottom row: 'Built for Mumbai Metro commuters | College Project 2026'

✓  VERIFICATION CHECKLIST — Complete ALL items before moving to Step 08
☐	http://localhost:3000 shows the landing page — not Next.js default page
☐	Hero section visible with heading, subtext, and two buttons
☐	'Book a Ride' button navigates to /auth/signup
☐	Metro map renders with colored dots for all 3 lines — NO white screen error
☐	Click a station marker — popup shows station name
☐	How It Works: all 4 cards appear with icons and labels
☐	Page is readable on mobile: resize browser to 375px width
◦	Heading should be smaller but still legible
◦	Buttons should stack vertically
◦	Map should be shorter but visible
☐	No console errors in browser DevTools (F12 → Console)
☐	Check Framer Motion: refresh page — hero section should animate in
