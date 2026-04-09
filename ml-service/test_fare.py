import requests

data = {
    "distance_km": 5.0,
    "cluster_size": 3,
    "hour": 8,
    "day_of_week": 1,
    "demand_level": 0.8
}

try:
    response = requests.post("http://localhost:8000/api/predict-fare-v2", json=data)
    print(response.json())
except Exception as e:
    print(f"Error: {e}")
