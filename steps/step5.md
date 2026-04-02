You are building SmartHop — a Mumbai Metro last-mile shared ride platform.
Read PROJECT_CONTEXT.md at the project root before writing any code.
Follow the navigation architecture defined in PROJECT_CONTEXT.md exactly.
Also implement the navigation changes specified for this step in Section D.
After generating files: run npx tsc --noEmit — zero TypeScript errors required.
Never show raw Error.message to users — always use Sonner toasts.
All Leaflet map components must use: dynamic(import, { ssr: false }).

⚠  NOTE:  ⚠  Build auth COMPLETELY before any other page — every protected page depends on it. Test login and signup manually in the browser before moving on. The middleware.ts file must be at the root of the project, not inside /app.


Build the complete authentication system for SmartHop.
Stack: Next.js 15 App Router, TypeScript, Supabase Auth, shadcn/ui, Framer Motion, Sonner.
 
FILE 1: middleware.ts (at project root, not inside /app)
Protect routes: /rider/*, /driver/*, /admin/*
Unauthenticated → redirect to /auth/login
After login: fetch role from public.users, redirect by role:
  rider → /rider/dashboard
  driver → /driver/dashboard
  admin → /admin/overview
Public routes: /, /auth/signup, /auth/login, /auth/callback
Use @supabase/ssr createServerClient for middleware session handling.
 
FILE 2: app/auth/callback/route.ts
Handle Supabase OAuth redirect. Exchange code for session.
After session: check if user exists in public.users:
  If not: insert new user row (email, name from metadata, role='rider')
  If yes: check onboarding_complete
Redirect: onboarding_complete=false → /onboarding, else → /rider/dashboard
 
FILE 3: hooks/useAuth.ts
'use client'
Returns: {user:User|null, role:string|null, loading:boolean, signOut:()=>Promise<void>}
Uses supabase.auth.onAuthStateChange to listen for auth events.
On auth: fetch role from public.users table. On signOut: call supabase.auth.signOut()
and redirect to /auth/login.
 
FILE 4: app/auth/signup/page.tsx
'use client'
Full-width centered layout. Framer Motion fadeInUp on mount.
 
Top: SmartHop logo (text-based: 'SmartHop' in blue, bold, large)
Subtitle: 'Mumbai Metro Last-Mile Rides'
 
Role selector — two cards side by side (grid-cols-2):
Card 1 — Rider: Train icon (Lucide), 'I am a Rider', 'Book shared rides from metro'
Card 2 — Driver: Car icon (Lucide), 'I am a Driver', 'Earn driving shared rides'
Selected: blue border + blue background tint + checkmark badge
Default selected: Rider
 
Form fields (shadcn Input + Label):
Full Name — required, min 2 chars
Email — required, valid email
Password — required, min 8 chars, show/hide toggle
 
Validate with zod. Show inline error messages below each field.
 
'Create Account' button (full width, blue):
On submit: supabase.auth.signUp({email, password, options:{data:{name, role}}})
On success: INSERT into public.users (id from auth, email, name, role, onboarding_complete=false)
Sonner toast.success('Account created!') then redirect to /onboarding
Sonner toast.error(message) on any error
 
Divider: 'or'
 
Google OAuth button (outline, Google icon SVG):
supabase.auth.signInWithOAuth({provider:'google', options:{redirectTo:'/auth/callback'}})
 
Footer link: 'Already have an account? Log in' → /auth/login
 
FILE 5: app/auth/login/page.tsx
'use client'
Same visual style as signup. Framer Motion fadeInUp.
Fields: Email + Password (with show/hide)
'Log In' button: supabase.auth.signInWithPassword({email, password})
On success: fetch role from public.users → redirect by role
Google OAuth button (same as signup)
'Forgot password?' link: toast.info('Check your email')
'Don't have an account? Sign up' → /auth/signup
Sonner toasts for all states.

✓  VERIFICATION CHECKLIST — Complete ALL items before moving to Step 06
☐	Sign up as a Rider with email+password — account created successfully
◦	Check Supabase Authentication tab — new user appears
◦	Check public.users table — new row with correct role='rider'
☐	Sign up as a Driver — role='driver' in database
☐	Log in with same credentials — redirected to /rider/dashboard or /driver/dashboard
☐	Visit /rider/dashboard while NOT logged in — redirected to /auth/login
☐	Visit /auth/login while already logged in — redirected to correct dashboard
☐	Sign out works — redirected to /auth/login, cannot access dashboard again
☐	Google OAuth button visible (even if not tested — it requires OAuth app setup)
☐	Sonner toast appears on signup success and on wrong password error
☐	No TypeScript errors: npx tsc --noEmit
