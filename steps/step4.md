You are building SmartHop — a Mumbai Metro last-mile shared ride platform.
Read PROJECT_CONTEXT.md at the project root before writing any code.
Follow the navigation architecture defined in PROJECT_CONTEXT.md exactly.
Also implement the navigation changes specified for this step in Section D.
After generating files: run npx tsc --noEmit — zero TypeScript errors required.
Never show raw Error.message to users — always use Sonner toasts.
All Leaflet map components must use: dynamic(import, { ssr: false }).

Create a FastAPI Python microservice for SmartHop ML inference.
I have pre-trained scikit-learn models already saved as .joblib files.
 
MY EXISTING MODEL FILES (already trained, just load them):
cluster_scaler.joblib — StandardScaler for clustering features
dbscan_model.joblib — DBSCAN clustering model
kmeans_model.joblib — K-Means clustering model
fare_lr_model.joblib — Linear Regression fare predictor
fare_rf_model.joblib — Random Forest fare predictor
fare_shared_rf_model.joblib — RF specifically trained on shared ride fares
fare_scaler.joblib — StandardScaler for fare features
driver_ranking_model.joblib — Driver ranking model
ranking_scaler.joblib — Scaler for ranking features
clustering_metrics.json — stored evaluation metrics
fare_metrics.json — stored evaluation metrics
ranking_metrics.json — stored evaluation metrics
 
FILE: requirements.txt
# IMPORTANT: Keep scikit-learn at 1.4.2 — this matches your trained model version.
# Upgrading scikit-learn will cause joblib compatibility warnings or failures.
# Python version must be 3.10.x to match scikit-learn 1.4.2 (not 3.11+).
fastapi==0.111.0
uvicorn==0.30.0
scikit-learn==1.4.2
pandas==2.2.2
numpy==1.26.4
joblib==1.4.2
pydantic==2.7.0
python-dotenv==1.0.1
 
FILE: main.py
FastAPI app. At startup load ALL .joblib files from ml/models/ using joblib.load().
Store in app.state: dbscan, kmeans, cluster_scaler, fare_lr, fare_rf,
fare_shared_rf, fare_scaler, driver_ranking, ranking_scaler.
Load JSON metrics files too. If any file missing: log warning, set to None.
CORS: allow_origins=['*'] for dev.
Include routers with prefix /api.
GET /health: return {status:'ok', models_loaded:{dbscan:bool, kmeans:bool,
  fare_rf:bool, fare_lr:bool, driver_ranking:bool}}
 
FILE: routers/cluster.py — POST /api/cluster-riders
Request: list of {user_id, pickup_lat, pickup_lng, drop_lat, drop_lng}
Use DBSCAN with cluster_scaler on [pickup_lat, pickup_lng, drop_lat, drop_lng].
Group by cluster label. Label -1 (noise) = solo group.
Return: list of {cluster_id, rider_ids, cluster_size, center_lat, center_lng}
 
FILE: routers/fare.py
POST /api/predict-fare (uses fare_rf_model + fare_scaler)
POST /api/predict-fare-lr (uses fare_lr_model for comparison)
POST /api/predict-fare-shared (uses fare_shared_rf_model)
Request for all: {distance_km, cluster_size, hour, day_of_week, demand_level}
Scale features with fare_scaler before prediction.
Calculate: solo_fare = prediction * cluster_size (approx)
savings_pct = ((solo_fare - shared_fare) / solo_fare) * 100
XAI from Random Forest feature_importances_:
  features = ['distance_km','cluster_size','hour','day_of_week','demand_level']
  Map to: distance_impact_pct, sharing_discount_pct, time_surge_pct
human_readable: f'Your fare of ₹{shared_fare:.0f} is based on {distance_km:.1f}km
  shared among {cluster_size} riders, saving you {savings_pct:.0f}% vs solo'
 
FILE: routers/route.py — POST /api/optimize-route
Request: {waypoints:[{lat,lng,label,user_id,address}], start_lat, start_lng}
Implement nearest-neighbor greedy algorithm:
Start at start_lat/lng. Each step: pick nearest unvisited waypoint (haversine).
Return: {waypoints (reordered), total_distance_km, total_duration_min (at 20kmh),
  optimized_order:[original indices]}
 
FILE: routers/ranking.py — POST /api/rank-drivers
Request: {drivers:[{driver_id, lat, lng, rating, acceptance_rate, total_rides}],
  station_lat, station_lng}
Scale features with ranking_scaler, predict scores with driver_ranking_model.
Return drivers sorted by score descending: [{driver_id, score}]
 
FILE: routers/analytics.py — GET /api/model-performance
Load and return contents of clustering_metrics.json, fare_metrics.json,
ranking_metrics.json from ml/models/ directory.
Add last_trained (file modification time), model_version='1.0.0'.
 
To run: cd ml-service && uvicorn main:app --reload --port 8000

✓  VERIFICATION CHECKLIST — Complete ALL items before moving to Step 05
☐	cd ml-service && pip install -r requirements.txt — no install errors
☐	uvicorn main:app --reload --port 8000 starts without crashing
◦	Terminal shows 'Application startup complete'
◦	Any 'model file not found' warnings are OK — errors are not OK
☐	Visit http://localhost:8000/health in browser
◦	Should return JSON with status:'ok'
◦	models_loaded should show true for models you copied over
☐	Visit http://localhost:8000/docs — FastAPI auto-docs page loads
☐	Test /api/predict-fare via docs UI (click 'Try it out'):
◦	Send: {distance_km:5.0, cluster_size:3, hour:8, day_of_week:1, demand_level:0.8}
◦	Should return shared_fare, solo_fare, savings_pct, explanation
☐	Test /api/cluster-riders with 3-4 nearby pickup coordinates — returns cluster groups
☐	Verify your .joblib files are in ml-service/ml/models/ — not in the Next.js folder
