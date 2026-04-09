from fastapi import APIRouter, Request
from pydantic import BaseModel
from typing import List
import math
import time
import uuid

router = APIRouter()
ROUTE_POLICY_VERSION = "route-policy-v2.0.0"

class Waypoint(BaseModel):
    lat: float
    lng: float
    label: str = ""
    user_id: str = ""
    address: str = ""
    completed: bool = False
    member_id: str = ""
    request_id: str = ""

class RouteRequest(BaseModel):
    waypoints: List[Waypoint]
    start_lat: float
    start_lng: float


def _optimize_route_result(data: RouteRequest):
    if not data.waypoints:
        return {
            "waypoints": [],
            "total_distance_km": 0,
            "total_duration_min": 0,
            "optimized_order": []
        }

    unvisited = list(enumerate(data.waypoints))
    current_lat, current_lng = data.start_lat, data.start_lng
    optimized_order = []
    total_distance = 0

    while unvisited:
        nearest_idx = -1
        min_dist = float('inf')
        list_pos = -1

        for i, (original_idx, wp) in enumerate(unvisited):
            dist = haversine(current_lat, current_lng, wp.lat, wp.lng)
            if dist < min_dist:
                min_dist = dist
                nearest_idx = original_idx
                list_pos = i

        total_distance += min_dist
        optimized_order.append(nearest_idx)
        wp = unvisited.pop(list_pos)[1]
        current_lat, current_lng = wp.lat, wp.lng

    reordered_waypoints = [data.waypoints[i] for i in optimized_order]
    total_duration_min = (total_distance / 20) * 60

    return {
        "waypoints": reordered_waypoints,
        "total_distance_km": total_distance,
        "total_duration_min": total_duration_min,
        "optimized_order": optimized_order
    }

def haversine(lat1, lon1, lat2, lon2):
    R = 6371  # Earth radius in km
    dLat = math.radians(lat2 - lat1)
    dLon = math.radians(lon2 - lon1)
    a = (math.sin(dLat / 2) * math.sin(dLat / 2) +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dLon / 2) * math.sin(dLon / 2))
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

@router.post("/optimize-route-v2")
async def optimize_route_v2(request: Request, data: RouteRequest):
    start = time.perf_counter()
    request_id = getattr(request.state, "request_id", str(uuid.uuid4()))
    result = _optimize_route_result(data)
    latency_ms = int((time.perf_counter() - start) * 1000)

    return {
        "data": result,
        "error": None,
        "metadata": {
            "request_id": request_id,
            "latency_ms": latency_ms,
            "fallback_used": False,
            "contract_version": "v2",
            "policy_version": ROUTE_POLICY_VERSION,
        },
    }
