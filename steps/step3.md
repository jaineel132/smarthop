You are building SmartHop — a Mumbai Metro last-mile shared ride platform.
Read PROJECT_CONTEXT.md at the project root before writing any code.
Follow the navigation architecture defined in PROJECT_CONTEXT.md exactly.
Also implement the navigation changes specified for this step in Section D.
After generating files: run npx tsc --noEmit — zero TypeScript errors required.
Never show raw Error.message to users — always use Sonner toasts.
All Leaflet map components must use: dynamic(import, { ssr: false }).

⚠  NOTE:  ⚠  These 6 files are the foundation everything else imports from. The AI must generate ALL six files in one prompt — do not split. After generation, run npx tsc --noEmit to catch any type errors before continuing.

Create 6 core library files for SmartHop (Next.js 15, TypeScript, Supabase).
 
FILE 1: types/index.ts
TypeScript interfaces for all database tables:
export interface MetroStation { id:string; name:string; line:'Line 1'|'Line 2A'|'Line 7'; lat:number; lng:number; zone?:string; }
export interface User { id:string; email:string; name:string; role:'rider'|'driver'|'admin'; home_station_id?:string; avatar_url?:string; onboarding_complete:boolean; driver_rating:number; }
export interface MetroTicket { id:string; user_id:string; from_station_id:string; to_station_id:string; qr_code:string; fare:number; status:string; alert_enabled:boolean; created_at:string; }
export interface RideRequest { id:string; user_id:string; pickup_station_id:string; dest_lat:number; dest_lng:number; dest_address:string; hour:number; day_of_week:number; demand_level:number; status:string; created_at:string; }
export interface RideGroup { id:string; station_id:string; driver_id?:string; cluster_id:string; status:'forming'|'accepted'|'in_progress'|'completed'|'cancelled'; fare_total:number; distance_km:number; duration_min:number; created_at:string; }
export interface RideMember { id:string; group_id:string; user_id:string; fare_share:number; savings_pct:number; solo_fare:number; status:string; }
export interface Route { id:string; group_id:string; waypoints:Waypoint[]; total_distance_km:number; total_duration_min:number; optimized_order:number[]; }
export interface Waypoint { lat:number; lng:number; label:string; user_id:string; address:string; completed:boolean; }
export interface DriverLocation { id:string; driver_id:string; lat:number; lng:number; is_online:boolean; current_station_id?:string; updated_at:string; }
export interface FareTransaction { id:string; group_id:string; user_id:string; amount:number; status:string; paid_at?:string; }
export interface FareExplanation { distance_impact_pct:number; sharing_discount_pct:number; time_surge_pct:number; human_readable:string; }
export interface FarePrediction { shared_fare:number; solo_fare:number; savings_pct:number; explanation:FareExplanation; }
export interface ClusterGroup { cluster_id:string; rider_ids:string[]; cluster_size:number; center_lat:number; center_lng:number; }
export interface RouteOptimization { waypoints:Waypoint[]; total_distance_km:number; total_duration_min:number; optimized_order:number[]; }
export interface ModelPerformance { fare_model:{mae_inr:number;r2_score:number;feature_importances:Record<string,number>}; cluster_model:{silhouette_score:number;avg_cluster_size:number;grouping_success_rate:number}; demand_model:{r2_score:number;training_samples:number}; last_trained:string; model_version:string; }
 
FILE 2: lib/supabase.ts
Two clients using @supabase/ssr:
createBrowserClient (for 'use client' components) and createServerClient (for server components/route handlers).
Use NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.
 
FILE 3: lib/stations.ts
Export const MUMBAI_METRO_STATIONS: MetroStation[] with all stations from Mumbai Metro
Line 1, 2A, and 7 with real lat/lng coordinates.
Export helper functions:
getStationById(id:string): MetroStation|undefined
getStationsByLine(line:string): MetroStation[]
getNearestStation(lat:number, lng:number): MetroStation — use haversine distance
getStationByName(name:string): MetroStation|undefined
 
FILE 4: lib/fare-chart.ts
Mumbai Metro fare structure: base ₹10, +₹5 per station hop, max ₹40.
Export: getMetroFare(fromId:string, toId:string): number
Export: METRO_FARE_CHART for direct lookup
 
FILE 5: lib/ml-api.ts
Async functions calling FastAPI at process.env.NEXT_PUBLIC_ML_SERVICE_URL.
Each function: try/catch, throw descriptive Error on failure.
Functions:
clusterRiders(requests): Promise<ClusterGroup[]> — POST /api/cluster-riders
predictFare(distance_km,cluster_size,hour,day,demand): Promise<FarePrediction> — POST /api/predict-fare
predictFareWithLR(same params): Promise<FarePrediction> — POST /api/predict-fare-lr
optimizeRoute(waypoints,start_lat,start_lng): Promise<RouteOptimization> — POST /api/optimize-route
getModelPerformance(): Promise<ModelPerformance> — GET /api/model-performance
checkMLHealth(): Promise<boolean> — GET /api/health, returns true if status 200
rankDrivers(drivers,group): Promise<string[]> — POST /api/rank-drivers (uses driver_ranking_model)
 
FILE 6: lib/utils.ts
haversineDistance(lat1,lng1,lat2,lng2): number — returns meters
formatCurrency(amount:number): string — returns '₹97.50'
formatDuration(minutes:number): string — returns '24 min' or '1h 4m'
getCurrentHour(): number
getCurrentDayOfWeek(): number — 0=Monday
isRushHour(): boolean — true if hour 8-10 or 17-21
getDemandLevel(hour:number, dayOfWeek:number): number — returns 0-1 float
  High demand: rush hours on weekdays = 0.8-1.0
  Medium: midday weekdays, weekend peaks = 0.4-0.7
  Low: night, early morning = 0.1-0.3


✓  VERIFICATION CHECKLIST — Complete ALL items before moving to Step 04
☐	Run npx tsc --noEmit — zero TypeScript errors
☐	lib/supabase.ts imports succeed — no module not found errors
☐	lib/stations.ts: open it and verify Mumbai station names and coordinates look correct
☐	Quick sanity test — in any component temporarily add:
◦	import { MUMBAI_METRO_STATIONS } from '@/lib/stations'
◦	console.log(MUMBAI_METRO_STATIONS.length) — should print 30+ stations
☐	lib/ml-api.ts: checkMLHealth() exists — this is called on every dashboard load
☐	lib/utils.ts: formatCurrency(97.5) should return '₹97.50' — test in console
