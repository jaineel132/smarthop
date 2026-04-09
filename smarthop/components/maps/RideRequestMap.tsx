'use client'

import React, { useEffect, useState, useCallback, useRef } from 'react'
import Map, { Marker, Source, Layer, NavigationControl } from 'react-map-gl/mapbox'
import 'mapbox-gl/dist/mapbox-gl.css'
import { MetroStation } from '@/types'
import { getDirections, createRouteGeoJSON } from '@/lib/mapbox'
import { Search, MapPin, Navigation } from 'lucide-react'

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

interface MapboxGeocodeResult {
  id: string;
  place_name: string;
  center: [number, number]; // [lng, lat]
  text: string;
}

interface RideRequestMapProps {
  pickupStation: MetroStation
  destLat: number | null
  destLng: number | null
  onDestinationSet: (lat: number, lng: number, address: string) => void
}

export default function RideRequestMap({ pickupStation, destLat, destLng, onDestinationSet }: RideRequestMapProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<MapboxGeocodeResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [routeData, setRouteData] = useState<any>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  // Mapbox Reverse Geocoding
  const reverseGeocode = useCallback(async (lat: number, lng: number) => {
    try {
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${MAPBOX_TOKEN}&limit=1`
      )
      const data = await res.json()
      const address = data.features?.[0]?.place_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`
      onDestinationSet(lat, lng, address)
    } catch {
      onDestinationSet(lat, lng, `${lat.toFixed(4)}, ${lng.toFixed(4)}`)
    }
  }, [onDestinationSet])

  // Mapbox Forward Geocoding (Search)
  const handleSearchChange = (value: string) => {
    setSearchQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (value.length < 3) {
      setSearchResults([])
      return
    }

    debounceRef.current = setTimeout(async () => {
      setIsSearching(true)
      try {
        const res = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(value)}.json?access_token=${MAPBOX_TOKEN}&limit=5&country=in&proximity=${pickupStation.lng},${pickupStation.lat}`
        )
        const data = await res.json()
        setSearchResults(data.features || [])
      } catch {
        setSearchResults([])
      } finally {
        setIsSearching(false)
      }
    }, 500)
  }

  const handleSelectResult = (result: MapboxGeocodeResult) => {
    const [lng, lat] = result.center
    onDestinationSet(lat, lng, result.place_name)
    setSearchQuery(result.text)
    setSearchResults([])
  }

  // Fetch Road-Legal Route when destination is set
  useEffect(() => {
    async function fetchRoute() {
      if (destLat && destLng) {
        try {
          const route = await getDirections([
            { lat: pickupStation.lat, lng: pickupStation.lng },
            { lat: destLat, lng: destLng }
          ])
          setRouteData(createRouteGeoJSON(route.geometry))
        } catch (err) {
          console.error("Road route fetch failed:", err)
          // Basic straight line fallback
          setRouteData({
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: [[pickupStation.lng, pickupStation.lat], [destLng, destLat]]
            }
          })
        }
      } else {
        setRouteData(null)
      }
    }
    fetchRoute()
  }, [pickupStation, destLat, destLng])

  const initialViewState = {
    latitude: pickupStation.lat,
    longitude: pickupStation.lng,
    zoom: 13
  }

  return (
    <div className="space-y-4">
      {/* Mapbox Powered Search */}
      <div className="relative group">
        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-teal-600 transition-colors">
          <Search className="w-4 h-4" />
        </div>
        <input
          type="text"
          placeholder="Where to?"
          className="w-full pl-11 pr-4 py-3.5 bg-white border border-slate-200 rounded-2xl shadow-sm focus:ring-4 focus:ring-blue-500/10 focus:border-teal-600 outline-none text-sm transition-all placeholder:text-slate-400"
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
        />
        {isSearching && (
          <div className="absolute right-4 top-4">
            <div className="w-4 h-4 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        
        {/* Results Dropdown */}
        {searchResults.length > 0 && (
          <div className="absolute top-full left-0 right-0 bg-white border border-slate-100 rounded-2xl mt-2 shadow-2xl z-[1000] overflow-hidden divide-y divide-slate-50 animate-in fade-in slide-in-from-top-2 duration-200">
            {searchResults.map((r) => (
              <button
                key={r.id}
                className="w-full text-left px-5 py-4 hover:bg-slate-50 flex items-start gap-4 transition-colors group"
                onClick={() => handleSelectResult(r)}
              >
                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0 group-hover:bg-teal-100 transition-colors">
                  <MapPin className="w-4 h-4 text-slate-400 group-hover:text-teal-700" />
                </div>
                <div className="flex-1 overflow-hidden">
                  <p className="text-sm font-semibold text-slate-900 leading-tight mb-0.5 truncate">{r.text}</p>
                  <p className="text-xs text-slate-500 truncate">{r.place_name}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Interactive Map */}
      <div className="rounded-3xl overflow-hidden border border-slate-200 shadow-xl relative aspect-[4/3] md:aspect-video group/map">
        <Map
          initialViewState={initialViewState}
          mapStyle="mapbox://styles/mapbox/streets-v12"
          mapboxAccessToken={MAPBOX_TOKEN}
          style={{ width: '100%', height: '100%' }}
          onClick={(e: any) => reverseGeocode(e.lngLat.lat, e.lngLat.lng)}
        >
          <NavigationControl position="top-right" showCompass={false} />

          {/* Pickup Marker */}
          <Marker latitude={pickupStation.lat} longitude={pickupStation.lng} anchor="bottom">
            <div className="flex flex-col items-center group">
              <div className="px-3 py-1 bg-teal-700 text-white text-[10px] font-bold rounded-full shadow-lg mb-1 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                {pickupStation.name}
              </div>
              <div className="w-9 h-9 rounded-full bg-teal-700 border-4 border-white shadow-xl flex items-center justify-center text-white ring-2 ring-blue-500/20">
                <Navigation className="w-4 h-4 fill-white rotate-45" />
              </div>
            </div>
          </Marker>

          {/* Destination Marker */}
          {destLat && destLng && (
            <Marker latitude={destLat} longitude={destLng} anchor="bottom">
              <div className="flex flex-col items-center animate-in zoom-in-50 duration-300">
                <div className="px-3 py-1 bg-rose-600 text-white text-[10px] font-bold rounded-full shadow-lg mb-1 whitespace-nowrap">
                  Destination
                </div>
                <div className="w-9 h-9 rounded-full bg-rose-600 border-4 border-white shadow-xl flex items-center justify-center text-white ring-2 ring-rose-500/20">
                  <MapPin className="w-4 h-4 fill-white" />
                </div>
              </div>
            </Marker>
          )}

          {/* Road Geometry Polyline */}
          {routeData && (
            <Source id="route-source" type="geojson" data={routeData}>
              <Layer
                id="route-line"
                type="line"
                layout={{ "line-join": "round", "line-cap": "round" }}
                paint={{
                  "line-color": "#3B82F6",
                  "line-width": 5,
                  "line-opacity": 0.8
                }}
              />
            </Source>
          )}
        </Map>
        
        {/* Helper Badge */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-5 py-2.5 bg-white/95 backdrop-blur-sm rounded-full shadow-2xl border border-white/50 flex items-center gap-2.5 animate-in slide-in-from-bottom-4 duration-500">
          <span className="flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-teal-500 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-600"></span>
          </span>
          <p className="text-[11px] font-bold text-slate-700 tracking-tight">Tap map to Pin Destination</p>
        </div>
      </div>
    </div>
  )
}
