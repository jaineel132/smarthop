You are building SmartHop — a Mumbai Metro last-mile shared ride platform.
Read PROJECT_CONTEXT.md at the project root before writing any code.
Follow the navigation architecture defined in PROJECT_CONTEXT.md exactly.
Also implement the navigation changes specified for this step in Section D.
After generating files: run npx tsc --noEmit — zero TypeScript errors required.
Never show raw Error.message to users — always use Sonner toasts.
All Leaflet map components must use: dynamic(import, { ssr: false }).

⚠  NOTE:  ⚠  Go to supabase
 Do NOT create tables manually via the UI — SQL is faster and error-free. Enable PostGIS FIRST before creating any tables.

You are helping me build SmartHop — a Mumbai Metro last-mile shared ride platform.
Generate a complete Supabase SQL migration file to set up the entire database.
 
STEP A — Enable PostGIS extension first:
CREATE EXTENSION IF NOT EXISTS postgis;
 
STEP B — Create all 9 tables:
 
1. metro_stations (create this FIRST — other tables reference it)
   id uuid PRIMARY KEY DEFAULT gen_random_uuid()
   name text NOT NULL
   line text CHECK (line IN ('Line 1','Line 2A','Line 7'))
   lat double precision NOT NULL
   lng double precision NOT NULL
   geom geometry(Point,4326)
   zone text
 
2. users
   id uuid PRIMARY KEY DEFAULT gen_random_uuid()
   email text UNIQUE NOT NULL
   name text NOT NULL
   role text CHECK (role IN ('rider','driver','admin')) DEFAULT 'rider'
   home_station_id uuid REFERENCES metro_stations(id)
   avatar_url text
   onboarding_complete boolean DEFAULT false
   driver_rating numeric(3,2) DEFAULT 5.0
   created_at timestamptz DEFAULT now()
 
3. metro_tickets
   id uuid PRIMARY KEY DEFAULT gen_random_uuid()
   user_id uuid REFERENCES users(id) ON DELETE CASCADE
   from_station_id uuid REFERENCES metro_stations(id)
   to_station_id uuid REFERENCES metro_stations(id)
   qr_code text
   fare numeric(10,2)
   status text DEFAULT 'active'
   alert_enabled boolean DEFAULT false
   created_at timestamptz DEFAULT now()
 
4. ride_requests
   id uuid PRIMARY KEY DEFAULT gen_random_uuid()
   user_id uuid REFERENCES users(id)
   pickup_station_id uuid REFERENCES metro_stations(id)
   dest_lat double precision
   dest_lng double precision
   dest_address text
   hour integer
   day_of_week integer
   demand_level numeric(4,3) DEFAULT 0.5
   status text DEFAULT 'pending'
   created_at timestamptz DEFAULT now()
 
5. ride_groups
   id uuid PRIMARY KEY DEFAULT gen_random_uuid()
   station_id uuid REFERENCES metro_stations(id)
   driver_id uuid REFERENCES users(id)
   cluster_id text
   status text DEFAULT 'forming'
   fare_total numeric(10,2)
   distance_km numeric(10,2)
   duration_min integer
   created_at timestamptz DEFAULT now()
 
6. ride_members
   id uuid PRIMARY KEY DEFAULT gen_random_uuid()
   group_id uuid REFERENCES ride_groups(id) ON DELETE CASCADE
   user_id uuid REFERENCES users(id)
   request_id uuid REFERENCES ride_requests(id)
   fare_share numeric(10,2)
   savings_pct numeric(5,2)
   solo_fare numeric(10,2)
   status text DEFAULT 'confirmed'
 
7. routes
   id uuid PRIMARY KEY DEFAULT gen_random_uuid()
   group_id uuid REFERENCES ride_groups(id) ON DELETE CASCADE
   waypoints jsonb NOT NULL
   total_distance_km numeric(10,2)
   total_duration_min integer
   optimized_order jsonb
 
8. driver_locations
   id uuid PRIMARY KEY DEFAULT gen_random_uuid()
   driver_id uuid REFERENCES users(id) UNIQUE
   lat double precision
   lng double precision
   is_online boolean DEFAULT false
   current_station_id uuid REFERENCES metro_stations(id)
   updated_at timestamptz DEFAULT now()
 
9. fare_transactions
   id uuid PRIMARY KEY DEFAULT gen_random_uuid()
   group_id uuid REFERENCES ride_groups(id)
   user_id uuid REFERENCES users(id)
   amount numeric(10,2)
   status text DEFAULT 'pending'
   paid_at timestamptz
 
STEP C — PostGIS trigger to auto-set geom from lat/lng on insert and update on metro_stations.
 
STEP D — Seed metro_stations with verified Mumbai Metro coordinates (42 total stations):
-- LINE 1 (12 stations, Blue Line, Versova to Ghatkopar):
INSERT INTO metro_stations (name, line, lat, lng, zone) VALUES
('Versova','Line 1',19.1307,72.8194,'West'),
('D.N. Nagar','Line 1',19.1207,72.8311,'West'),
('Azad Nagar','Line 1',19.1262,72.8382,'West'),
('Andheri','Line 1',19.1197,72.8466,'West'),
('Western Express Highway','Line 1',19.1118,72.8560,'Central'),
('Chakala','Line 1',19.1043,72.8609,'Central'),
('Airport Road','Line 1',19.0968,72.8654,'Central'),
('Marol Naka','Line 1',19.0917,72.8740,'Central'),
('Saki Naka','Line 1',19.0876,72.8834,'East'),
('Asalpha','Line 1',19.0847,72.8930,'East'),
('Jagruti Nagar','Line 1',19.0855,72.9006,'East'),
('Ghatkopar','Line 1',19.0860,72.9081,'East');
 
-- LINE 2A (17 stations, Yellow Line, Dahisar East to Andheri West):
INSERT INTO metro_stations (name, line, lat, lng, zone) VALUES
('Dahisar East','Line 2A',19.2482,72.8574,'North'),
('Anand Nagar','Line 2A',19.2389,72.8530,'North'),
('Kandarpada','Line 2A',19.2290,72.8492,'North'),
('Mandapeshwar','Line 2A',19.2198,72.8461,'North'),
('Eksar','Line 2A',19.2089,72.8433,'North'),
('Borivali West','Line 2A',19.2302,72.8545,'North'),
('Pahadi Eksar','Line 2A',19.1980,72.8412,'North'),
('Kandivali West','Line 2A',19.2053,72.8368,'North'),
('Dahanukarwadi','Line 2A',19.1921,72.8389,'North'),
('Valnai','Line 2A',19.1820,72.8365,'West'),
('Malad West','Line 2A',19.1864,72.8489,'West'),
('Lower Malad','Line 2A',19.1776,72.8442,'West'),
('Pahadi Goregaon','Line 2A',19.1700,72.8415,'West'),
('Goregaon West','Line 2A',19.1594,72.8318,'West'),
('Oshiwara','Line 2A',19.1498,72.8295,'West'),
('Lower Oshiwara','Line 2A',19.1402,72.8302,'West'),
('Andheri West','Line 2A',19.1207,72.8311,'West');
 
-- LINE 7 (13 stations, Red Line, Dahisar East to Gundavali):
INSERT INTO metro_stations (name, line, lat, lng, zone) VALUES
('Dahisar East','Line 7',19.2497,72.8697,'North'),
('Ovaripada','Line 7',19.2389,72.8626,'North'),
('Devipada','Line 7',19.2320,72.8574,'North'),
('Magathane','Line 7',19.2250,72.8572,'North'),
('Poisar','Line 7',19.2140,72.8570,'North'),
('Akurli','Line 7',19.2030,72.8562,'North'),
('Kurar','Line 7',19.1920,72.8548,'North'),
('Dindoshi','Line 7',19.1810,72.8530,'North'),
('Aarey','Line 7',19.1709,72.8417,'North'),
('Goregaon East','Line 7',19.1480,72.8650,'West'),
('Jogeshwari East','Line 7',19.1341,72.8496,'West'),
('Shankarwadi','Line 7',19.1260,72.8710,'West'),
('Gundavali','Line 7',19.1176,72.8676,'West');
 
STEP E — Enable Row Level Security on all tables. Write policies:
- users: authenticated users can read all, write only own row
- metro_stations: public read, no write
- ride_groups, ride_members: authenticated read all, write own
- driver_locations: authenticated read all, driver writes own row only
- metro_tickets, ride_requests, fare_transactions: user reads/writes own only
 
STEP F — Enable Supabase Realtime publication on:
driver_locations, ride_groups (for live tracking and driver accept/decline flow)




✓  VERIFICATION CHECKLIST — Complete ALL items before moving to Step 02
☐	Supabase project created at supabase.com and you can see the dashboard
☐	SQL ran without errors — check for any red error messages in SQL Editor
☐	All 9 tables visible in Supabase Table Editor
◦	Click 'Table Editor' in left sidebar — you should see all 9 tables listed
☐	metro_stations table has rows — click it and verify Mumbai stations are there
◦	Should see Ghatkopar, Versova, Andheri, etc. with lat/lng populated
☐	PostGIS working — run this in SQL Editor: SELECT PostGIS_Version();
◦	Should return a version number, not an error
☐	RLS enabled — in Table Editor, each table shows a lock icon
◦	Authentication → Policies — verify policies exist for each table
☐	Realtime enabled — go to Database → Replication — driver_locations and ride_groups are ON
☐	Copy your Project URL and anon key from Settings → API — you will need them in Step 2
