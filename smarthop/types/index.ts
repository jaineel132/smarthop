export interface MetroStation {
  id: string;
  name: string;
  line: 'Line 1' | 'Line 2A' | 'Line 7';
  lat: number;
  lng: number;
  zone?: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'rider' | 'driver' | 'admin';
  home_station_id?: string;
  avatar_url?: string;
  onboarding_complete: boolean;
  driver_rating: number;
}

export interface MetroTicket {
  id: string;
  user_id: string;
  from_station_id: string;
  to_station_id: string;
  qr_code: string;
  fare: number;
  status: string;
  alert_enabled: boolean;
  created_at: string;
}

export interface RideRequest {
  id: string;
  user_id: string;
  pickup_station_id: string;
  dest_lat: number;
  dest_lng: number;
  dest_address: string;
  hour: number;
  day_of_week: number;
  demand_level: number;
  status: string;
  created_at: string;
}

export interface RideGroup {
  id: string;
  station_id: string;
  driver_id?: string;
  cluster_id: string;
  status: 'forming' | 'accepted' | 'in_progress' | 'completed' | 'cancelled';
  fare_total: number;
  distance_km: number;
  duration_min: number;
  created_at: string;
}

export interface RideMember {
  id: string;
  group_id: string;
  user_id: string;
  fare_share: number;
  savings_pct: number;
  solo_fare: number;
  status: string;
}

export interface Route {
  id: string;
  group_id: string;
  waypoints: Waypoint[];
  total_distance_km: number;
  total_duration_min: number;
  optimized_order: number[];
}

export interface Waypoint {
  lat: number;
  lng: number;
  label: string;
  user_id: string;
  address: string;
  completed: boolean;
}

export interface DriverLocation {
  id: string;
  driver_id: string;
  lat: number;
  lng: number;
  is_online: boolean;
  current_station_id?: string;
  updated_at: string;
}

export interface FareTransaction {
  id: string;
  group_id: string;
  user_id: string;
  amount: number;
  status: string;
  paid_at?: string;
}

export interface FareExplanation {
  distance_impact_pct: number;
  sharing_discount_pct: number;
  time_surge_pct: number;
  human_readable: string;
}

export interface FarePrediction {
  shared_fare: number;
  solo_fare: number;
  savings_pct: number;
  explanation: FareExplanation;
}

export interface ClusterGroup {
  cluster_id: string;
  rider_ids: string[];
  cluster_size: number;
  center_lat: number;
  center_lng: number;
}

export interface RouteOptimization {
  waypoints: Waypoint[];
  total_distance_km: number;
  total_duration_min: number;
  optimized_order: number[];
}

export interface ModelPerformance {
  fare_model: {
    mae_inr: number;
    r2_score: number;
    feature_importances: Record<string, number>;
  };
  cluster_model: {
    silhouette_score: number;
    avg_cluster_size: number;
    grouping_success_rate: number;
  };
  demand_model: {
    r2_score: number;
    training_samples: number;
  };
  last_trained: string;
  model_version: string;
}
