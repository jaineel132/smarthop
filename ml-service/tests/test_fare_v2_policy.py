from routers.fare import FareRequest, _apply_v2_policy


def test_apply_v2_policy_solo_has_no_discount():
    request_data = FareRequest(
        distance_km=4.2,
        cluster_size=1,
        hour=10,
        day_of_week=2,
        demand_level=0.4,
    )
    prediction = {
        "shared_fare_raw": 48.0,
        "solo_fare_raw": 52.0,
    }

    adjusted = _apply_v2_policy(prediction, request_data)

    assert adjusted["solo_fare"] >= 25.0
    assert adjusted["shared_fare"] == adjusted["solo_fare"]
    assert adjusted["discount_reason"] == "SOLO_RIDE"


def test_apply_v2_policy_shared_never_exceeds_solo():
    request_data = FareRequest(
        distance_km=8.5,
        cluster_size=3,
        hour=18,
        day_of_week=4,
        demand_level=0.9,
    )
    prediction = {
        "shared_fare_raw": 120.0,
        "solo_fare_raw": 95.0,
    }

    adjusted = _apply_v2_policy(prediction, request_data)

    assert adjusted["solo_fare"] >= 25.0
    assert adjusted["shared_fare"] <= adjusted["solo_fare"]
    assert adjusted["shared_fare"] >= 20.0
    assert adjusted["discount_reason"] == "MODEL_SENSITIVE_SHARE"
