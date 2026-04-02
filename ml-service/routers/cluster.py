from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from typing import List
import pandas as pd
import numpy as np

router = APIRouter()

class RiderRequest(BaseModel):
    user_id: str
    pickup_lat: float
    pickup_lng: float
    drop_lat: float
    drop_lng: float

@router.post("/cluster-riders")
async def cluster_riders(request: Request, riders: List[RiderRequest]):
    if not riders:
        return []
    
    dbscan = request.app.state.models.get("dbscan")
    cluster_scaler = request.app.state.models.get("cluster_scaler")
    
    if dbscan is None or cluster_scaler is None:
        raise HTTPException(status_code=503, detail="Clustering models not loaded")

    # Prepare features
    features = []
    for r in riders:
        features.append([r.pickup_lat, r.pickup_lng, r.drop_lat, r.drop_lng])
    
    X = np.array(features)
    X_scaled = cluster_scaler.transform(X)
    
    # Predict clusters
    labels = dbscan.fit_predict(X_scaled)
    
    # Group by labels
    clusters_data = {}
    for i, label in enumerate(labels):
        label = int(label)
        if label not in clusters_data:
            clusters_data[label] = {
                "cluster_size": 0,
                "rider_ids": [],
                "pickups": []
            }
        
        clusters_data[label]["cluster_size"] += 1
        clusters_data[label]["rider_ids"].append(riders[i].user_id)
        clusters_data[label]["pickups"].append([riders[i].pickup_lat, riders[i].pickup_lng])

    # Format result
    result = []
    for label, data in clusters_data.items():
        # Label -1 is noise (solo)
        cluster_id = f"solo_{data['rider_ids'][0]}" if label == -1 else f"cluster_{label}"
        
        # Calculate center
        pickups = np.array(data["pickups"])
        center_lat = float(np.mean(pickups[:, 0]))
        center_lng = float(np.mean(pickups[:, 1]))
        
        result.append({
            "cluster_id": cluster_id,
            "rider_ids": data["rider_ids"],
            "cluster_size": data["cluster_size"],
            "center_lat": center_lat,
            "center_lng": center_lng
        })
        
    return result
