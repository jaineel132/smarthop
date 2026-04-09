from fastapi.testclient import TestClient

from main import app


def _sample_riders():
    return [
        {
            "user_id": "u1",
            "pickup_lat": 19.1200,
            "pickup_lng": 72.8400,
            "drop_lat": 19.1250,
            "drop_lng": 72.8450,
        },
        {
            "user_id": "u2",
            "pickup_lat": 19.1201,
            "pickup_lng": 72.8401,
            "drop_lat": 19.1252,
            "drop_lng": 72.8451,
        },
        {
            "user_id": "u3",
            "pickup_lat": 19.1202,
            "pickup_lng": 72.8402,
            "drop_lat": 19.1410,
            "drop_lng": 72.8610,
        },
    ]


def _sample_fare_payload(cluster_size=3):
    return {
        "distance_km": 8.2,
        "cluster_size": cluster_size,
        "hour": 9,
        "day_of_week": 2,
        "demand_level": 0.7,
    }


def _sample_route_payload():
    return {
        "start_lat": 19.1200,
        "start_lng": 72.8400,
        "waypoints": [
            {"lat": 19.1290, "lng": 72.8510, "label": "A", "user_id": "u1", "address": "A", "completed": False, "member_id": "", "request_id": ""},
            {"lat": 19.1310, "lng": 72.8530, "label": "B", "user_id": "u2", "address": "B", "completed": False, "member_id": "", "request_id": ""},
            {"lat": 19.1400, "lng": 72.8600, "label": "C", "user_id": "u3", "address": "C", "completed": False, "member_id": "", "request_id": ""},
        ],
    }


def test_health_contract_has_versioning_fields():
    with TestClient(app) as client:
        response = client.get("/api/health")

    assert response.status_code == 200
    payload = response.json()
    assert "supported_features" in payload
    assert set(payload["supported_features"]) == {"v2"}
    assert "model_versions" in payload
    assert isinstance(payload["model_versions"], dict)


def test_fare_v2_contract_and_invariants():
    body = _sample_fare_payload(cluster_size=3)

    with TestClient(app) as client:
        v2 = client.post("/api/predict-fare-v2", json=body, headers={"X-Request-ID": "itest-fare"})

    assert v2.status_code == 200

    v2_data = v2.json()

    # V2 envelope shape is canonical.
    assert v2_data["error"] is None
    assert v2_data["metadata"]["contract_version"] == "v2"
    assert v2_data["metadata"]["request_id"] == "itest-fare"

    adjusted = v2_data["data"]["adjusted_fare"]
    assert adjusted["shared_fare"] <= adjusted["solo_fare"]
    assert adjusted["shared_fare"] >= 0
    assert adjusted["solo_fare"] >= 0


def test_cluster_v2_covers_all_riders_once():
    riders = _sample_riders()
    rider_ids = {r["user_id"] for r in riders}

    with TestClient(app) as client:
        v2 = client.post("/api/cluster-riders-v2", json=riders, headers={"X-Request-ID": "itest-cluster"})

    assert v2.status_code == 200

    v2_payload = v2.json()

    assert v2_payload["error"] is None
    assert v2_payload["metadata"]["contract_version"] == "v2"

    v2_members = [uid for c in v2_payload["data"] for uid in c["rider_ids"]]

    assert set(v2_members) == rider_ids
    assert len(v2_members) == len(rider_ids)


def test_route_v2_returns_expected_waypoint_count():
    body = _sample_route_payload()

    with TestClient(app) as client:
        v2 = client.post("/api/optimize-route-v2", json=body, headers={"X-Request-ID": "itest-route"})

    assert v2.status_code == 200

    v2_payload = v2.json()

    assert v2_payload["error"] is None
    assert v2_payload["metadata"]["contract_version"] == "v2"

    assert len(v2_payload["data"]["waypoints"]) == len(body["waypoints"])
    assert v2_payload["data"]["total_distance_km"] >= 0
