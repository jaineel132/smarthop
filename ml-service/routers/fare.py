from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
import pandas as pd
import numpy as np

router = APIRouter()

class FareRequest(BaseModel):
    distance_km: float
    cluster_size: int
    hour: int
    day_of_week: int
    demand_level: float

def calculate_fare_response(model, scaler, request_data: FareRequest):
    # Derive is_rush_hour (8-11 AM or 5-8 PM)
    is_rush = 1 if (8 <= request_data.hour <= 11) or (17 <= request_data.hour <= 20) else 0
    
    # Prepare features: distance_km, cluster_size, hour, day_of_week, demand_level, is_rush_hour
    features = [[
        request_data.distance_km,
        request_data.cluster_size,
        request_data.hour,
        request_data.day_of_week,
        request_data.demand_level,
        is_rush
    ]]
    
    # Scale features
    X_scaled = scaler.transform(features)
    
    # Predict shared fare
    shared_fare = float(model.predict(X_scaled)[0])
    
    # Calculate solo fare (as if they were alone)
    solo_features = [[
        request_data.distance_km,
        1,
        request_data.hour,
        request_data.day_of_week,
        request_data.demand_level,
        is_rush
    ]]
    X_solo_scaled = scaler.transform(solo_features)
    solo_fare = float(model.predict(X_solo_scaled)[0])
    
    # Savings
    savings_pct = ((solo_fare - shared_fare) / solo_fare) * 100 if solo_fare > 0 else 0
    
    # XAI/Explanation
    explanation = {
        "shared_fare": shared_fare,
        "solo_fare": solo_fare,
        "savings_pct": savings_pct,
        "human_readable": f"Your fare of ₹{shared_fare:.0f} is based on {request_data.distance_km:.1f}km "
                          f"shared among {request_data.cluster_size} riders, saving you {savings_pct:.0f}% vs solo"
    }
    
    # Add feature impact mapping
    if hasattr(model, "feature_importances_"):
        importances = model.feature_importances_
        # features = ['distance_km','cluster_size','hour','day_of_week','demand_level','is_rush_hour']
        explanation["distance_impact_pct"] = float(importances[0] * 100)
        explanation["sharing_discount_pct"] = float(importances[1] * 100)
        explanation["time_surge_pct"] = float((importances[2] + importances[4] + importances[5]) * 100)
        
    return explanation

@router.post("/predict-fare")
async def predict_fare(request: Request, data: FareRequest):
    model = request.app.state.models.get("fare_rf")
    scaler = request.app.state.models.get("fare_scaler")
    if model is None or scaler is None:
        raise HTTPException(status_code=503, detail="Fare prediction models not loaded")
    return calculate_fare_response(model, scaler, data)

@router.post("/predict-fare-lr")
async def predict_fare_lr(request: Request, data: FareRequest):
    model = request.app.state.models.get("fare_lr")
    scaler = request.app.state.models.get("fare_scaler")
    if model is None or scaler is None:
        raise HTTPException(status_code=503, detail="Fare LR prediction models not loaded")
    return calculate_fare_response(model, scaler, data)

@router.post("/predict-fare-shared")
async def predict_fare_shared(request: Request, data: FareRequest):
    model = request.app.state.models.get("fare_shared_rf")
    scaler = request.app.state.models.get("fare_scaler")
    if model is None or scaler is None:
        raise HTTPException(status_code=503, detail="Fare Shared prediction models not loaded")
    return calculate_fare_response(model, scaler, data)
