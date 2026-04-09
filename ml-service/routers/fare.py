from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from typing import Any, Dict
import time
import uuid

router = APIRouter()
FARE_POLICY_VERSION = "fare-policy-v2.0.0"

class FareRequest(BaseModel):
    distance_km: float
    cluster_size: int
    hour: int
    day_of_week: int
    demand_level: float


def _predict_fares(model, scaler, request_data: FareRequest) -> Dict[str, float]:
    is_rush = 1 if (8 <= request_data.hour <= 11) or (17 <= request_data.hour <= 20) else 0

    shared_features = [[
        request_data.distance_km,
        request_data.cluster_size,
        request_data.hour,
        request_data.day_of_week,
        request_data.demand_level,
        is_rush,
    ]]
    shared_scaled = scaler.transform(shared_features)
    shared_fare_raw = float(model.predict(shared_scaled)[0])

    solo_features = [[
        request_data.distance_km,
        1,
        request_data.hour,
        request_data.day_of_week,
        request_data.demand_level,
        is_rush,
    ]]
    solo_scaled = scaler.transform(solo_features)
    solo_fare_raw = float(model.predict(solo_scaled)[0])

    return {
        "is_rush": float(is_rush),
        "shared_fare_raw": round(shared_fare_raw, 2),
        "solo_fare_raw": round(solo_fare_raw, 2),
    }


def _apply_v2_policy(prediction: Dict[str, float], request_data: FareRequest) -> Dict[str, Any]:
    shared_fare_raw = prediction["shared_fare_raw"]
    solo_fare_raw = prediction["solo_fare_raw"]

    solo_fare = max(round(solo_fare_raw, 2), 25.0)
    if request_data.cluster_size > 1:
        shared_fare = min(max(round(shared_fare_raw, 2), 20.0), solo_fare)
        discount_reason = "MODEL_SENSITIVE_SHARE"
    else:
        shared_fare = solo_fare
        discount_reason = "SOLO_RIDE"

    savings_pct = ((solo_fare - shared_fare) / solo_fare) * 100 if solo_fare > 0 else 0.0

    return {
        "shared_fare": round(shared_fare, 2),
        "solo_fare": round(solo_fare, 2),
        "discount_pct": round(savings_pct, 2),
        "discount_reason": discount_reason,
    }


@router.post("/predict-fare-v2")
async def predict_fare_v2(request: Request, data: FareRequest):
    model = request.app.state.models.get("fare_rf")
    scaler = request.app.state.models.get("fare_scaler")
    if model is None or scaler is None:
        raise HTTPException(status_code=503, detail="Fare prediction models not loaded")

    start = time.perf_counter()
    request_id = getattr(request.state, "request_id", str(uuid.uuid4()))
    prediction = _predict_fares(model, scaler, data)
    adjusted = _apply_v2_policy(prediction, data)
    latency_ms = int((time.perf_counter() - start) * 1000)

    model_version = request.app.state.model_versions.get("fare_rf")
    cluster_size = max(data.cluster_size, 1)
    confidence = round(min(0.99, 0.6 + (0.05 * min(cluster_size, 5))), 2)

    return {
        "data": {
            "model_prediction": {
                "shared_fare_raw": prediction["shared_fare_raw"],
                "solo_fare_raw": prediction["solo_fare_raw"],
                "confidence_score": confidence,
                "model_version": model_version,
            },
            "adjusted_fare": adjusted,
            "explanation": {
                "factors": {
                    "distance_impact_pct": 60.0,
                    "demand_surge_pct": 15.0 if prediction["is_rush"] == 1 else 5.0,
                    "sharing_discount_pct": adjusted["discount_pct"],
                },
                "human_readable": (
                    f"Fare computed for {data.distance_km:.1f}km with {data.cluster_size} rider(s). "
                    f"Final shared fare is INR {adjusted['shared_fare']:.2f}."
                ),
            },
        },
        "error": None,
        "metadata": {
            "request_id": request_id,
            "latency_ms": latency_ms,
            "fallback_used": False,
            "contract_version": "v2",
            "policy_version": FARE_POLICY_VERSION,
        },
    }
