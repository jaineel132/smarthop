You are building SmartHop — a Mumbai Metro last-mile shared ride platform.
Read PROJECT_CONTEXT.md at the project root before writing any code.
Follow the navigation architecture defined in PROJECT_CONTEXT.md exactly.
Also implement the navigation changes specified for this step in Section D.
After generating files: run npx tsc --noEmit — zero TypeScript errors required.
Never show raw Error.message to users — always use Sonner toasts.
All Leaflet map components must use: dynamic(import, { ssr: false }).

⚠  NOTE:  ⚠  After completion, set onboarding_complete=true in Supabase. Add a check in middleware: if user is authenticated but onboarding_complete=false, always redirect to /onboarding even if they try to access dashboard directly.

Build the onboarding flow for SmartHop. Shown once after first signup.
 
FILE 1: components/shared/StepIndicator.tsx
Props: totalSteps:number, currentStep:number (1-indexed)
Render: numbered circles connected by lines.
Completed step: filled blue circle + checkmark icon
Current step: blue border, white fill, bold number
Future step: gray circle, gray number
Connecting line: blue if step completed, gray if not
 
FILE 2: app/onboarding/page.tsx
'use client'
useState for currentStep: 1|2|3
Framer Motion AnimatePresence for slide transitions between steps.
Use StepIndicator at top showing progress.
 
STEP 1 — Choose Home Station
Heading: 'Which metro station do you use most?'
Subheading: 'We will center your map here'
Combobox (searchable) of all stations from lib/stations.ts
Group by line in dropdown: Line 1, Line 2A, Line 7 as group headers
Show station name + line badge in each option
Next button: disabled until station selected
 
STEP 2 — Enable Ride Alerts
Large bell icon (Lucide Bell, size 64, blue)
Heading: 'Never miss your last-mile ride'
Description: 'SmartHop will send you a notification when your metro is
  500m from your destination station so your shared auto is ready when you arrive.'
Big button: 'Enable Notifications'
On click: await Notification.requestPermission()
If 'granted': show green checkmark + 'Notifications enabled!'
If 'denied': show amber text 'You can enable this later in browser settings'
Either way: show 'Continue' button to proceed
'Skip for now' text link below
 
STEP 3 — How It Works Tutorial
4 slides with Framer Motion slide animation (x: 100 enter, x: -100 exit)
Slide 1: Ticket icon — 'Book Metro Ticket' — 'Tap Book Ticket and get a QR code'
Slide 2: Bell icon — 'Get Notified Near Your Stop' — 'Alert fires 500m before arrival'
Slide 3: Users icon — 'Join a Shared Ride Group' — 'AI groups nearby commuters'
Slide 4: IndianRupee icon — 'Pay Only Your Share' — 'Fare split with full explanation'
Dot indicators below slides (click to navigate)
Previous / Next buttons. On slide 4: 'Get Started' button
 
ON COMPLETE (after 'Get Started'):
Update Supabase: UPDATE public.users SET
  home_station_id=[selected], onboarding_complete=true WHERE id=[userId]
Fetch role from current session
Redirect: rider → /rider/dashboard, driver → /driver/dashboard
Sonner toast.success('Welcome to SmartHop!')

✓  VERIFICATION CHECKLIST — Complete ALL items before moving to Step 07
☐	After signup, user lands on /onboarding automatically
☐	Step indicator shows Step 1 active, Steps 2 and 3 gray
☐	Station combobox: typing 'Ghatkopar' filters to Ghatkopar station
☐	'Next' button disabled until a station is selected
☐	Step 2: clicking 'Enable Notifications' triggers browser permission prompt
◦	On allow: green checkmark appears
◦	Skipping: 'Skip for now' still lets user continue
☐	Step 3: 4 slides navigate with dots and Next/Previous buttons
☐	After 'Get Started': public.users table in Supabase shows home_station_id and onboarding_complete=true
☐	Rider redirected to /rider/dashboard, driver to /driver/dashboard
☐	Visiting /onboarding as a user with onboarding_complete=true redirects to dashboard
