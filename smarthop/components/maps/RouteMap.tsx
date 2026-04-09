'use client'

import React, { useEffect, useState, useRef, useMemo } from 'react'
import Map, { Marker, Source, Layer, NavigationControl, MapRef, Popup } from 'react-map-gl/mapbox'
import 'mapbox-gl/dist/mapbox-gl.css'
import { Waypoint } from '@/types'
import { Button } from '@/components/ui/button'
import { LocateFixed, MapPin, Navigation, Info } from 'lucide-react'
import { getDirections, createRouteGeoJSON } from '@/lib/mapbox'

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

interface RouteMapProps {
  waypoints: Waypoint[]
  driverPos: [number, number] | null // [lat, lng] from legacy
  currentWaypointIndex: number
}

export default function RouteMap({ waypoints, driverPos, currentWaypointIndex }: RouteMapProps) {
  const mapRef = useRef<MapRef>(null)
  const [routeData, setRouteData] = useState<any>(null)
  const [selectedWaypoint, setSelectedWaypoint] = useState<Waypoint | null>(null)

  // Memoize driver coordinates in [lng, lat]
  const driverLngLat = useMemo(() => 
    driverPos ? [driverPos[1], driverPos[0]] as [number, number] : null
  , [driverPos])

  // Fetch true road-legal route
  useEffect(() => {
    async function fetchRoute() {
      if (waypoints.length > 0) {
        const coords = []
        if (driverPos) {
          coords.push({ lat: driverPos[0], lng: driverPos[1] })
        }
        // Only include non-completed waypoints for the current active path, 
        // or all waypoints if we want to show the full journey
        waypoints.forEach(wp => coords.push({ lat: wp.lat, lng: wp.lng }))

        if (coords.length >= 2) {
          try {
            const route = await getDirections(coords)
            setRouteData(createRouteGeoJSON(route.geometry))
          } catch (err) {
            console.error("Road-legal routing failed, falling back to straight lines:", err)
            setRouteData({
              type: 'Feature',
              geometry: {
                type: 'LineString',
                coordinates: coords.map(c => [c.lng, c.lat])
              }
            })
          }
        }
      }
    }
    fetchRoute()
  }, [waypoints, driverPos])

  const handleRecenter = () => {
    if (!mapRef.current) return
    
    if (driverLngLat) {
      mapRef.current.flyTo({
        center: driverLngLat,
        zoom: 16,
        duration: 2000,
        essential: true
      })
    } else if (waypoints.length > 0) {
      const bounds = waypoints.reduce(
        (acc, wp) => {
          return [
            [Math.min(acc[0][0], wp.lng), Math.min(acc[0][1], wp.lat)],
            [Math.max(acc[1][0], wp.lng), Math.max(acc[1][1], wp.lat)]
          ]
        },
        [[waypoints[0].lng, waypoints[0].lat], [waypoints[0].lng, waypoints[0].lat]]
      )
      
      mapRef.current.fitBounds(bounds as any, { padding: 80, duration: 1500 })
    }
  }

  const initialViewState = {
    longitude: driverLngLat?.[0] || waypoints[0]?.lng || 72.877,
    latitude: driverLngLat?.[1] || waypoints[0]?.lat || 19.076,
    zoom: 15
  }

  return (
    <div className="relative w-full h-full group/map">
      <Map
        ref={mapRef}
        initialViewState={initialViewState}
        mapStyle="mapbox://styles/mapbox/navigation-day-v1"
        mapboxAccessToken={MAPBOX_TOKEN}
        style={{ width: '100%', height: '100%' }}
      >
        <NavigationControl position="top-right" />

        {/* Road Geometry Layer */}
        {routeData && (
          <Source id="route-source" type="geojson" data={routeData} lineMetrics={true}>
            <Layer
              id="route-line"
              type="line"
              layout={{ "line-join": "round", "line-cap": "round" }}
              paint={{
                "line-color": "#3B82F6",
                "line-width": 6,
                "line-opacity": 0.8,
                "line-gradient": [
                  "interpolate", ["linear"], ["line-progress"],
                  0, "#60a5fa",
                  1, "#2563eb"
                ]
              }}
            />
          </Source>
        )}

        {/* Waypoint Markers */}
        {waypoints.map((wp, idx) => {
          const isCompleted = wp.completed
          const isCurrent = idx === currentWaypointIndex
          
          return (
            <Marker 
              key={idx} 
              latitude={wp.lat} 
              longitude={wp.lng} 
              anchor="bottom"
              onClick={(e: any) => {
                e.originalEvent.stopPropagation();
                setSelectedWaypoint(wp);
              }}
            >
              <div className="flex flex-col items-center cursor-pointer group">
                <div className={`
                  w-10 h-10 rounded-2xl border-4 border-white shadow-2xl flex items-center justify-center font-bold text-white transition-all
                  ${isCompleted ? 'bg-slate-400 scale-90 grayscale' : isCurrent ? 'bg-teal-700 ring-4 ring-blue-500/30 scale-110 shadow-blue-500/20' : 'bg-slate-800'}
                `}>
                  {idx + 1}
                </div>
                {isCurrent && (
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white rounded-full animate-pulse shadow-lg" />
                )}
              </div>
            </Marker>
          )
        })}

        {/* Driver/Self Position Marker */}
        {driverLngLat && (
          <Marker latitude={driverLngLat[1]} longitude={driverLngLat[0]} anchor="center">
            <div className="relative flex items-center justify-center">
              <div className="absolute w-12 h-12 bg-teal-600/30 rounded-full animate-ping" />
              <div className="w-10 h-10 bg-white rounded-full shadow-2xl border-4 border-teal-700 flex items-center justify-center text-teal-700 z-10">
                <Navigation className="w-5 h-5 fill-blue-600 rotate-[45deg]" />
              </div>
            </div>
          </Marker>
        )}

        {/* Info Popup */}
        {selectedWaypoint && (
          <Popup
            latitude={selectedWaypoint.lat}
            longitude={selectedWaypoint.lng}
            anchor="top"
            onClose={() => setSelectedWaypoint(null)}
            className="rounded-2xl overflow-hidden shadow-2xl"
          >
            <div className="p-4 min-w-[200px]">
              <div className="flex items-center gap-2 mb-2 text-teal-700">
                <MapPin className="w-4 h-4" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Stop Point</span>
              </div>
              <h3 className="font-bold text-slate-900 mb-1">{selectedWaypoint.label}</h3>
              <p className="text-xs text-slate-500 mb-3">{selectedWaypoint.address}</p>
              {selectedWaypoint.completed ? (
                <div className="px-3 py-1.5 bg-slate-100 rounded-lg text-slate-600 text-[10px] font-bold text-center">
                  COMPLETED
                </div>
              ) : (
                <div className="px-3 py-1.5 bg-teal-700 rounded-lg text-white text-[10px] font-bold text-center shadow-lg shadow-blue-500/20">
                  EN ROUTE
                </div>
              )}
            </div>
          </Popup>
        )}
      </Map>

      {/* Modern Floating Controls */}
      <div className="absolute bottom-6 right-6 flex flex-col gap-3">
        <Button
          variant="outline"
          size="icon"
          className="h-12 w-12 rounded-2xl bg-white/95 backdrop-blur-sm border-slate-200 shadow-2xl hover:bg-white text-slate-700 hover:text-teal-700 transition-all hover:scale-105"
          onClick={handleRecenter}
        >
          <LocateFixed className="h-6 w-6" />
        </Button>
      </div>
      
      {/* Visual Indicator for Active Navigation */}
      {driverLngLat && (
        <div className="absolute top-6 left-6 px-4 py-2.5 bg-white/90 backdrop-blur-md border border-white/20 rounded-2xl shadow-xl flex items-center gap-3 animate-in fade-in slide-in-from-left-4 duration-500">
          <div className="w-8 h-8 rounded-full bg-teal-700 flex items-center justify-center text-white">
            <Navigation className="w-4 h-4 fill-white" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-teal-700 uppercase tracking-tighter">Live Tracker</p>
            <p className="text-xs font-semibold text-slate-800">Your Route is Active</p>
          </div>
        </div>
      )}
    </div>
  )
}
