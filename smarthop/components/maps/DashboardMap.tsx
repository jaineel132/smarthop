'use client'

import React, { useState } from 'react'
import Map, { Marker, Popup, NavigationControl } from 'react-map-gl/mapbox'
import 'mapbox-gl/dist/mapbox-gl.css'
import { MUMBAI_METRO_STATIONS } from '@/lib/stations'
import { Badge } from '@/components/ui/badge'
import { MetroStation } from '@/types'

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
const FALLBACK_CENTER = { latitude: 19.0760, longitude: 72.8777 };

interface DashboardMapProps {
  centerStation: MetroStation | null
}

export default function DashboardMap({ centerStation }: DashboardMapProps) {
  const [selectedStation, setSelectedStation] = useState<MetroStation | null>(null);

  const getLineColor = (line: string) => {
    switch (line) {
      case 'Line 1': return '#3B82F6' // Blue
      case 'Line 2A': return '#EF4444' // Red
      case 'Line 7': return '#22C55E' // Green
      default: return '#94A3B8'
    }
  }

  const initialViewState = {
    latitude: centerStation ? centerStation.lat : FALLBACK_CENTER.latitude,
    longitude: centerStation ? centerStation.lng : FALLBACK_CENTER.longitude,
    zoom: 12
  }

  return (
    <div className="w-full h-[260px] md:h-[340px] rounded-xl overflow-hidden border border-slate-200 shadow-inner z-0 relative">
      {!MAPBOX_TOKEN ? (
        <div className="w-full h-full bg-slate-100 flex items-center justify-center text-slate-500 text-sm">
          Map unavailable (missing token)
        </div>
      ) : (
      <Map
        initialViewState={initialViewState}
        style={{ width: '100%', height: '100%' }}
        mapStyle="mapbox://styles/mapbox/light-v11"
        mapboxAccessToken={MAPBOX_TOKEN}
      >
        <NavigationControl position="top-right" showCompass={false} />

        {MUMBAI_METRO_STATIONS.map((station) => {
          const isCenter = centerStation?.id === station.id
          
          return (
            <Marker
              key={station.id}
              latitude={station.lat}
              longitude={station.lng}
              anchor="center"
              onClick={(e: any) => {
                e.originalEvent.stopPropagation();
                setSelectedStation(station);
              }}
            >
              <div 
                className={`rounded-full border-2 border-white shadow-md cursor-pointer transition-transform hover:scale-125 ${isCenter ? 'w-6 h-6 animate-pulse ring-2 ring-blue-400' : 'w-4 h-4'}`}
                style={{ backgroundColor: getLineColor(station.line) }}
              />
            </Marker>
          )
        })}

        {selectedStation && (
          <Popup
            latitude={selectedStation.lat}
            longitude={selectedStation.lng}
            anchor="bottom"
            onClose={() => setSelectedStation(null)}
            closeButton={false}
            offset={10}
            className="z-50"
          >
            <div className="p-2 space-y-2 min-w-[140px]">
              <h3 className="font-bold text-slate-900 m-0 text-sm leading-tight">
                {selectedStation.name}
              </h3>
              {centerStation?.id === selectedStation.id && (
                <span className="block text-[10px] text-teal-700 font-semibold">Your home station</span>
              )}
              <Badge 
                style={{ backgroundColor: getLineColor(selectedStation.line) }}
                className="text-white border-none text-[10px] py-0 px-2"
              >
                {selectedStation.line}
              </Badge>
            </div>
          </Popup>
        )}
      </Map>
      )}
    </div>
  )
}
