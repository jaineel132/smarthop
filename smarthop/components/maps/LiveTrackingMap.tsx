'use client'

import React, { useEffect, useState, useMemo } from 'react'
import Map, { Marker, Source, Layer, NavigationControl, useMap } from 'react-map-gl/mapbox'
import 'mapbox-gl/dist/mapbox-gl.css'
import { Waypoint } from '@/types'
import { getDirections, createRouteGeoJSON } from '@/lib/mapbox'

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

interface LiveTrackingMapProps {
  driverLat: number | null
  driverLng: number | null
  riderLat: number | null
  riderLng: number | null
  waypoints: Waypoint[]
  currentStopIndex: number
}

/**
 * Component to handle auto-fitting bounds when points change
 */
function FitBounds({ points }: { points: [number, number][] }) {
  const { current: map } = useMap();

  useEffect(() => {
    if (map && points.length > 0) {
      if (points.length === 1) {
        map.flyTo({ center: points[0], zoom: 15 });
        return;
      }

      const bounds = points.reduce(
        (acc, point) => [
          [Math.min(acc[0][0], point[0]), Math.min(acc[0][1], point[1])],
          [Math.max(acc[1][0], point[0]), Math.max(acc[1][1], point[1])]
        ],
        [[points[0][0], points[0][1]], [points[0][0], points[0][1]]]
      );

      map.fitBounds(bounds as any, { padding: 80, duration: 2000 });
    }
  }, [points, map]);

  return null;
}

export default function LiveTrackingMap({
  driverLat,
  driverLng,
  riderLat,
  riderLng,
  waypoints,
  currentStopIndex,
}: LiveTrackingMapProps) {
  const [routeData, setRouteData] = useState<any>(null);

  // Memoize all points involved for bounds fitting
  const allPoints: [number, number][] = useMemo(() => {
    const pts: [number, number][] = [];
    if (driverLat && driverLng) pts.push([driverLng, driverLat]);
    if (riderLat && riderLng) pts.push([riderLng, riderLat]);
    waypoints.forEach(wp => pts.push([wp.lng, wp.lat]));
    return pts;
  }, [driverLat, driverLng, riderLat, riderLng, waypoints]);

  // Fetch real-road route whenever relevant coordinates or waypoints change
  useEffect(() => {
    async function fetchRoute() {
      if (driverLat && driverLng && waypoints.length > 0) {
        const incompleteWaypoints = waypoints.slice(Math.max(0, currentStopIndex));
        
        // Need at least 2 coordinates for Mapbox Directions (driver + 1 waypoint)
        if (incompleteWaypoints.length === 0) {
          setRouteData(null);
          return;
        }

        const coords = [
          { lat: driverLat, lng: driverLng },
          ...incompleteWaypoints.map(wp => ({ lat: wp.lat, lng: wp.lng }))
        ];

        try {
          const route = await getDirections(coords);
          setRouteData(createRouteGeoJSON(route.geometry));
        } catch (err) {
          console.error("Failed to fetch Mapbox road geometry:", err);
          const linePoints = coords.map(c => [c.lng, c.lat]);
          setRouteData({
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: linePoints }
          });
        }
      }
    }
    fetchRoute();
  }, [driverLat, driverLng, waypoints, currentStopIndex]);

  const initialViewState = {
    latitude: driverLat || riderLat || 19.076,
    longitude: driverLng || riderLng || 72.8777,
    zoom: 14
  }

  return (
    <div className="relative w-full h-[55vh] min-h-[280px] rounded-t-xl overflow-hidden border-x border-t border-slate-200">
      <Map
        initialViewState={initialViewState}
        mapStyle="mapbox://styles/mapbox/navigation-night-v1"
        mapboxAccessToken={MAPBOX_TOKEN}
        style={{ width: '100%', height: '100%' }}
      >
        <NavigationControl position="top-right" showCompass={false} />
        <FitBounds points={allPoints} />

        {/* Real-Road Route Polyline */}
        {routeData && (
          <Source id="route-source" type="geojson" data={routeData}>
            <Layer
              id="route-line"
              type="line"
              layout={{ "line-join": "round", "line-cap": "round" }}
              paint={{
                "line-color": "#60a5fa",
                "line-width": 6,
                "line-opacity": 0.8,
                "line-dasharray": [1, 1.5]
              }}
            />
          </Source>
        )}

        {/* Rider Marker (YOU) */}
        {riderLat && riderLng && (
          <Marker latitude={riderLat} longitude={riderLng} anchor="center">
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 rounded-full bg-teal-700 border-2 border-white shadow-xl flex items-center justify-center text-white font-bold text-[10px] ring-2 ring-blue-400/30">
                YOU
              </div>
              <div className="w-1 h-2 bg-teal-700" />
            </div>
          </Marker>
        )}

        {/* Driver Marker */}
        {driverLat && driverLng && (
          <Marker latitude={driverLat} longitude={driverLng} anchor="center" rotationAlignment="map">
            <div className="relative flex items-center justify-center">
              <div className="absolute w-12 h-12 rounded-full bg-teal-500/20 animate-ping" />
              <div className="w-10 h-10 bg-blue-900 rounded-full flex items-center justify-center text-xl border-2 border-white shadow-2xl z-10">
                🚗
              </div>
            </div>
          </Marker>
        )}

        {/* Waypoint Markers */}
        {waypoints.map((wp, i) => {
          let bg = '#94a3b8'
          let content = `${i + 1}`
          let ring = 'ring-slate-400/20'
          
          if (i < currentStopIndex) {
            bg = '#10b981' // Green for completed
            content = '✓'
            ring = 'ring-green-400/20'
          } else if (i === currentStopIndex) {
            bg = '#3b82f6' // Blue for current
            ring = 'ring-blue-400/40'
          }

          return (
            <Marker key={i} latitude={wp.lat} longitude={wp.lng} anchor="center">
              <div 
                className={`w-7 h-7 rounded-full text-white flex items-center justify-center text-xs font-bold border-2 border-white shadow-md ring-4 ${ring} transition-all`}
                style={{ backgroundColor: bg }}
              >
                {content}
              </div>
            </Marker>
          )
        })}
      </Map>
    </div>
  )
}
