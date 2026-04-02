You are building SmartHop — a Mumbai Metro last-mile shared ride platform.
Read PROJECT_CONTEXT.md at the project root before writing any code.
Follow the navigation architecture defined in PROJECT_CONTEXT.md exactly.
Also implement the navigation changes specified for this step in Section D.
After generating files: run npx tsc --noEmit — zero TypeScript errors required.
Never show raw Error.message to users — always use Sonner toasts.
All Leaflet map components must use: dynamic(import, { ssr: false }).


⚠  NOTE:  ⚠  Run each npm install command SEPARATELY — do not chain them all into one command or dependency conflicts become hard to trace. After shadcn init, check that components/ui/ folder was created.

I am building SmartHop — a Next.js 15 App Router + TypeScript project.
Help me set up the entire project foundation.
 
STEP 1 — Create Next.js 15 project:
npx create-next-app@latest smarthop \
  --typescript --tailwind --eslint --app \
  --src-dir=false --import-alias='@/*'
When prompted: use App Router = Yes, Turbopack = Yes
 
STEP 2 — Install packages (run each line separately):
npm install @supabase/supabase-js @supabase/ssr
npm install leaflet react-leaflet @types/leaflet
npm install recharts
npm install framer-motion
npm install lucide-react
npm install sonner
npm install next-themes
npm install qrcode @types/qrcode
npm install zod react-hook-form @hookform/resolvers
npm install date-fns
npm install clsx tailwind-merge
 
STEP 3 — Initialize shadcn/ui:
npx shadcn@latest init
Choices: Style=new-york (NOT Default — Default is deprecated), BaseColor=Slate, CSSVariables=Yes
 
STEP 4 — Install shadcn components:
npx shadcn@latest add button card input label badge avatar
npx shadcn@latest add dialog sheet drawer tabs switch
npx shadcn@latest add select dropdown-menu navigation-menu
npx shadcn@latest add progress accordion alert skeleton
npx shadcn@latest add radio-group
 
STEP 5 — Create folder structure.
Create these directories (empty for now):
app/auth/signup/
app/auth/login/
app/auth/callback/
app/onboarding/
app/rider/dashboard/
app/rider/metro-ticket/
app/rider/request-ride/
app/rider/tracking/[groupId]/
app/rider/fare-summary/[groupId]/
app/rider/history/
app/driver/dashboard/
app/driver/route/[groupId]/
app/driver/earnings/
app/admin/overview/
app/admin/analytics/
app/admin/ml-performance/
components/maps/
components/shared/
components/rider/
components/driver/
components/admin/
lib/
hooks/
types/
 
In each app/*/page.tsx create a placeholder:
export default function Page() {
  return <div className='p-8'>Coming soon</div>
}
 
STEP 6 — Create next.config.ts:
const nextConfig = {
  images: { remotePatterns: [{ protocol:'https', hostname:'**' }] },
  webpack: (config) => {
    config.resolve.fallback = { fs: false };
    return config;
  }
};
export default nextConfig;
 
STEP 7 — Create .env.local at project root:
NEXT_PUBLIC_SUPABASE_URL=paste-your-supabase-url-here
NEXT_PUBLIC_SUPABASE_ANON_KEY=paste-your-anon-key-here
NEXT_PUBLIC_ML_SERVICE_URL=http://localhost:8000
 
STEP 8 — Run the app to verify no errors:
npm run dev
Visit http://localhost:3000 — should show Next.js default page with no console errors.
 
CRITICAL — TAILWIND V4 DIFFERENCE:
Tailwind v4 uses CSS-first configuration. There is NO tailwind.config.ts file.
All custom config goes inside app/globals.css using the @theme directive.
If your AI IDE generates a tailwind.config.ts file, DELETE it — it conflicts with v4.
If you see Tailwind class errors, check that globals.css has: @import 'tailwindcss';




✓  VERIFICATION CHECKLIST — Complete ALL items before moving to Step 03
☐	npm run dev starts with no errors in terminal
☐	http://localhost:3000 loads in browser (any page, even blank)
☐	components/ui/ folder exists and contains button.tsx, card.tsx etc.
☐	All app/*/page.tsx placeholders exist — no 404 errors when visiting routes
◦	Visit /rider/dashboard — should show 'Coming soon', not a 404
☐	.env.local has your real Supabase URL and anon key (not placeholder text)
☐	node_modules exists and is NOT committed to git
◦	Check .gitignore includes node_modules and .env.local
☐	No TypeScript errors: run npx tsc --noEmit in terminal — should complete silently
☐	Tailwind v4 check: NO tailwind.config.ts file in project root
◦	If it exists, delete it — Tailwind v4 uses CSS-first config in globals.css
◦	Check app/globals.css contains @import 'tailwindcss' at the top
