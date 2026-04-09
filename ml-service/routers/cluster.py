from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from typing import List
import numpy as np
import time
import uuid
from datetime import datetime, timezone

router = APIRouter()
CLUSTER_POLICY_VERSION = "cluster-policy-v2.0.0"

class RiderRequest(BaseModel):
    user_id: str
    pickup_lat: float
    pickup_lng: float
    drop_lat: float
    drop_lng: float
    created_at: str | None = None
    expires_at: str | None = None


MATCH_TIMEOUT_SECONDS = 3 * 60


def _parse_iso_dt(value: str | None):
    if not value:
        return None

    try:
        normalized = value.replace('Z', '+00:00')
        return datetime.fromisoformat(normalized)
    except ValueError:
        return None


def _is_request_fresh(request: RiderRequest) -> bool:
    now = datetime.now(timezone.utc)
    expires_at = _parse_iso_dt(request.expires_at)
    if expires_at is not None:
        return expires_at > now

    created_at = _parse_iso_dt(request.created_at)
    if created_at is None:
        return True

    return (now - created_at).total_seconds() < MATCH_TIMEOUT_SECONDS


def _build_features(riders: List[RiderRequest]) -> np.ndarray:
    features = []
    for r in riders:
        # Riders in a station waiting room are clustered by destination proximity.
        features.append([r.drop_lat, r.drop_lng])
    return np.array(features)


def _format_clusters(labels: np.ndarray, riders: List[RiderRequest]) -> list:
    clusters_data = {}
    for i, label in enumerate(labels):
        label = int(label)
        if label not in clusters_data:
            clusters_data[label] = {
                "cluster_size": 0,
                "rider_ids": [],
                "pickups": [],
                "drops": [],
            }

        clusters_data[label]["cluster_size"] += 1
        clusters_data[label]["rider_ids"].append(riders[i].user_id)
        clusters_data[label]["pickups"].append([riders[i].pickup_lat, riders[i].pickup_lng])
        clusters_data[label]["drops"].append([riders[i].drop_lat, riders[i].drop_lng])

    result = []

    for label, data in clusters_data.items():
        rider_chunks = [data["rider_ids"]]
        pickup_chunks = [data["pickups"]]
        drop_chunks = [data["drops"]]

        for i, r_chunk in enumerate(rider_chunks):
            p_chunk = np.array(pickup_chunks[i])
            d_chunk = np.array(drop_chunks[i])
            cluster_id = f"solo_{r_chunk[0]}" if label == -1 else f"cluster_{label}_{i}"

            result.append({
                "cluster_id": cluster_id,
                "rider_ids": r_chunk,
                "cluster_size": len(r_chunk),
                "center_lat": float(np.mean(p_chunk[:, 0])),
                "center_lng": float(np.mean(p_chunk[:, 1])),
                "drop_center_lat": float(np.mean(d_chunk[:, 0])),
                "drop_center_lng": float(np.mean(d_chunk[:, 1])),
            })

    return result

@router.post("/cluster-riders-v2")
async def cluster_riders_v2(request: Request, riders: List[RiderRequest]):
    riders = [rider for rider in riders if _is_request_fresh(rider)]

    if not riders:
        return {
            "data": [],
            "error": None,
            "metadata": {
                "request_id": getattr(request.state, "request_id", str(uuid.uuid4())),
                "latency_ms": 0,
                "fallback_used": False,
                "contract_version": "v2",
                "policy_version": CLUSTER_POLICY_VERSION,
            },
        }

    model = request.app.state.models.get("dbscan")
    if model is None:
        raise HTTPException(status_code=503, detail="DBSCAN model not loaded")

    start = time.perf_counter()
    request_id = getattr(request.state, "request_id", str(uuid.uuid4()))
    X = _build_features(riders)

    try:
        labels = model.fit_predict(X)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"DBSCAN inference failure: {exc}") from exc

    clusters = _format_clusters(labels, riders)
    model_version = request.app.state.model_versions.get("dbscan")
    latency_ms = int((time.perf_counter() - start) * 1000)

    enriched = []
    for cluster in clusters:
        enriched.append({
            **cluster,
            "clustering_info": {
                "algorithm": "dbscan",
                "model_version": model_version,
                "distance_metric": "destination_lat_lng",
            },
        })

    return {
        "data": enriched,
        "error": None,
        "metadata": {
            "request_id": request_id,
            "latency_ms": latency_ms,
            "fallback_used": False,
            "contract_version": "v2",
            "policy_version": CLUSTER_POLICY_VERSION,
        },
    }
