import os
import json
import joblib
import logging
import time
import uuid
from dataclasses import dataclass
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Model and metrics directory
MODELS_DIR = os.path.join(os.path.dirname(__file__), "ml", "models")
POLICY_VERSIONS = {
    "fare": "fare-policy-v2.0.0",
    "clustering": "cluster-policy-v2.0.0",
    "routing": "route-policy-v2.0.0",
}


@dataclass
class MLConfig:
    supported_features: tuple = ("v2",)

@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.ml_config = MLConfig(
        supported_features=("v2",),
    )

    # Load all .joblib files
    models_to_load = {
        "dbscan": "dbscan_model.joblib",
        "kmeans": "kmeans_model.joblib",
        "cluster_scaler": "cluster_scaler.joblib",
        "fare_lr": "fare_lr_model.joblib",
        "fare_rf": "fare_rf_model.joblib",
        "fare_shared_rf": "fare_shared_rf_model.joblib",
        "fare_scaler": "fare_scaler.joblib",
        "driver_ranking": "driver_ranking_model.joblib",
        "ranking_scaler": "ranking_scaler.joblib"
    }
    
    app.state.models = {}
    app.state.model_versions = {}
    for key, filename in models_to_load.items():
        path = os.path.join(MODELS_DIR, filename)
        if os.path.exists(path):
            try:
                app.state.models[key] = joblib.load(path)
                app.state.model_versions[key] = f"mtime:{int(os.path.getmtime(path))}"
                logger.info(f"Successfully loaded {filename}")
            except Exception as e:
                logger.error(f"Error loading {filename}: {e}")
                app.state.models[key] = None
                app.state.model_versions[key] = None
        else:
            logger.warning(f"File not found: {filename}")
            app.state.models[key] = None
            app.state.model_versions[key] = None

    # Load JSON metrics
    metrics_to_load = {
        "clustering": "clustering_metrics.json",
        "fare": "fare_metrics.json",
        "ranking": "ranking_metrics.json"
    }
    
    app.state.metrics = {}
    for key, filename in metrics_to_load.items():
        path = os.path.join(MODELS_DIR, filename)
        if os.path.exists(path):
            try:
                with open(path, 'r') as f:
                    app.state.metrics[key] = json.load(f)
                logger.info(f"Successfully loaded {filename}")
            except Exception as e:
                logger.error(f"Error loading {filename}: {e}")
                app.state.metrics[key] = None
        else:
            logger.warning(f"File not found: {filename}")
            app.state.metrics[key] = None

    yield
    # Cleanup (if needed)

app = FastAPI(
    title="SmartHop ML Service",
    description="ML Inference service for Mumbai Metro last-mile shared rides",
    version="1.0.0",
    lifespan=lifespan
)


@app.middleware("http")
async def add_request_context(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
    request.state.request_id = request_id
    start = time.perf_counter()
    response = await call_next(request)
    elapsed_ms = int((time.perf_counter() - start) * 1000)
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Response-Time-Ms"] = str(elapsed_ms)
    logger.info("request_id=%s path=%s status=%s latency_ms=%s", request_id, request.url.path, response.status_code, elapsed_ms)
    return response

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Dev only
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Import and include routers
from routers import cluster, fare, route, ranking, analytics

app.include_router(cluster.router, prefix="/api", tags=["Clustering"])
app.include_router(fare.router, prefix="/api", tags=["Fare Prediction"])
app.include_router(route.router, prefix="/api", tags=["Route Optimization"])
app.include_router(ranking.router, prefix="/api", tags=["Driver Ranking"])
app.include_router(analytics.router, prefix="/api", tags=["Model Analytics"])

@app.get("/api/health")
async def health():
    metrics_loaded = {
        k: v is not None for k, v in app.state.metrics.items()
    }
    return {
        "status": "ok",
        "models_loaded": {
            k: v is not None for k, v in app.state.models.items()
        },
        "metrics_loaded": metrics_loaded,
        "model_versions": app.state.model_versions,
        "supported_features": ["v2"],
        "policy_versions": POLICY_VERSIONS,
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
