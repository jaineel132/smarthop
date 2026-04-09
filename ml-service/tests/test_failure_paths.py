from fastapi.testclient import TestClient

from main import app


def _fare_payload():
    return {
        "distance_km": 6.0,
        "cluster_size": 2,
        "hour": 10,
        "day_of_week": 3,
        "demand_level": 0.6,
    }


def _cluster_payload():
    return [
        {
            "user_id": "u1",
            "pickup_lat": 19.1200,
            "pickup_lng": 72.8400,
            "drop_lat": 19.1250,
            "drop_lng": 72.8450,
        }
    ]


def test_predict_fare_v2_returns_503_when_model_missing():
    with TestClient(app) as client:
        original_model = app.state.models.get("fare_rf")
        try:
            app.state.models["fare_rf"] = None
            response = client.post("/api/predict-fare-v2", json=_fare_payload())
        finally:
            app.state.models["fare_rf"] = original_model

    assert response.status_code == 503
    payload = response.json()
    assert payload["detail"] == "Fare prediction models not loaded"


def test_cluster_riders_v2_returns_503_when_model_missing():
    with TestClient(app) as client:
        original_model = app.state.models.get("dbscan")
        try:
            app.state.models["dbscan"] = None
            response = client.post("/api/cluster-riders-v2", json=_cluster_payload())
        finally:
            app.state.models["dbscan"] = original_model

    assert response.status_code == 503
    payload = response.json()
    assert payload["detail"] == "DBSCAN model not loaded"
