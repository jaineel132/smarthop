import os
from fastapi import APIRouter, Request, HTTPException
import json
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

MODELS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "ml", "models")

@router.get("/model-performance")
async def get_model_performance(request: Request):
    metrics = request.app.state.metrics
    if not metrics:
        raise HTTPException(status_code=503, detail="Model metrics not loaded")
    
    response = {
        "clustering": metrics.get("clustering"),
        "fare": metrics.get("fare"),
        "ranking": metrics.get("ranking"),
        "model_version": "1.0.0"
    }
    
    # Add last_trained (modification time of models)
    try:
        # Check fare_rf_model as an indicator of last training
        path = os.path.join(MODELS_DIR, "fare_rf_model.joblib")
        if os.path.exists(path):
            response["last_trained"] = os.path.getmtime(path)
        else:
            response["last_trained"] = None
    except Exception as e:
        logger.error(f"Error getting file modification time: {e}")
        response["last_trained"] = None
        
    return response
