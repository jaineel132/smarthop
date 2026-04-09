import numpy as np

from routers.cluster import RiderRequest, _format_clusters


def test_format_clusters_v2_no_chunking_keeps_all_members():
    riders = [
        RiderRequest(user_id="u1", pickup_lat=19.10, pickup_lng=72.80, drop_lat=19.11, drop_lng=72.81),
        RiderRequest(user_id="u2", pickup_lat=19.10, pickup_lng=72.80, drop_lat=19.12, drop_lng=72.82),
        RiderRequest(user_id="u3", pickup_lat=19.10, pickup_lng=72.80, drop_lat=19.13, drop_lng=72.83),
        RiderRequest(user_id="u4", pickup_lat=19.10, pickup_lng=72.80, drop_lat=19.14, drop_lng=72.84),
    ]
    labels = np.array([0, 0, 0, 0])

    result = _format_clusters(labels, riders)

    assert len(result) == 1
    assert result[0]["cluster_size"] == 4
    assert set(result[0]["rider_ids"]) == {"u1", "u2", "u3", "u4"}


def test_format_clusters_v2_returns_single_cluster_per_label():
    riders = [
        RiderRequest(user_id="u1", pickup_lat=19.10, pickup_lng=72.80, drop_lat=19.11, drop_lng=72.81),
        RiderRequest(user_id="u2", pickup_lat=19.10, pickup_lng=72.80, drop_lat=19.12, drop_lng=72.82),
        RiderRequest(user_id="u3", pickup_lat=19.10, pickup_lng=72.80, drop_lat=19.13, drop_lng=72.83),
        RiderRequest(user_id="u4", pickup_lat=19.10, pickup_lng=72.80, drop_lat=19.14, drop_lng=72.84),
    ]
    labels = np.array([1, 1, 1, 1])

    result = _format_clusters(labels, riders)

    assert len(result) == 1
    assert result[0]["cluster_size"] == 4
