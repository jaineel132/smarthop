'use client'

import React, { useState } from 'react'
import Map, { Marker, Popup, NavigationControl } from 'react-map-gl/mapbox'
import 'mapbox-gl/dist/mapbox-gl.css'
import { MUMBAI_METRO_STATIONS } from '@/lib/stations'
import { MetroStation } from '@/types'
import { Badge } from '@/components/ui/badge'

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
const CENTER = { longitude: 72.8777, latitude: 19.0760 }

export default function StaticMetroMap() {
  const [selectedStation, setSelectedStation] = useState<MetroStation | null>(null)

  const getLineColor = (line: string) => {
    switch (line) {
      case 'Line 1': return '#3B82F6' // Blue
      case 'Line 2A': return '#FACC15' // Yellow
      case 'Line 7': return '#EF4444' // Red
      default: return '#94A3B8'
    }
  }

  return (
    <div className="w-full space-y-8">
      <div className="h-[350px] md:h-[480px] w-full rounded-2xl overflow-hidden border border-slate-200 shadow-2xl relative group/map">
        <Map
          initialViewState={{
            ...CENTER,
            zoom: 11
          }}
          mapStyle="mapbox://styles/mapbox/light-v11"
          mapboxAccessToken={MAPBOX_TOKEN}
          style={{ width: '100%', height: '100%' }}
        >
          <NavigationControl position="bottom-right" showCompass={false} />

          {MUMBAI_METRO_STATIONS.map((station) => (
            <Marker
              key={station.id}
              longitude={station.lng}
              latitude={station.lat}
              anchor="center"
              onClick={(e: any) => {
                e.originalEvent.stopPropagation();
                setSelectedStation(station);
              }}
            >
              <div 
                className="w-5 h-5 rounded-full border-2 border-white shadow-lg cursor-pointer transition-all hover:scale-125 hover:ring-4 hover:ring-white/50"
                style={{ backgroundColor: getLineColor(station.line) }}
              />
            </Marker>
          ))}

          {selectedStation && (
            <Popup
              longitude={selectedStation.lng}
              latitude={selectedStation.lat}
              anchor="bottom"
              offset={12}
              onClose={() => setSelectedStation(null)}
              className="rounded-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200"
            >
              <div className="p-3 min-w-[180px]">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Mumbai Metro</p>
                <h3 className="font-bold text-slate-900 text-sm mb-2">{selectedStation.name}</h3>
                <Badge 
                  style={{ backgroundColor: getLineColor(selectedStation.line) }}
                  className="text-white border-none px-2 py-0.5 text-[10px] font-semibold"
                >
                  {selectedStation.line}
                </Badge>
              </div>
            </Popup>
          )}
        </Map>
        
        {/* Helper Badge */}
        <div className="absolute top-6 left-6 px-4 py-2 bg-white/80 backdrop-blur-md rounded-full border border-white/50 shadow-lg pointer-events-none transition-opacity group-hover/map:opacity-100 opacity-60">
          <p className="text-[10px] font-bold text-slate-600">Click a station to see details</p>
        </div>
      </div>

      {/* Modern Legend */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-6 bg-slate-50/50 rounded-2xl border border-slate-100">
        <div className="flex items-center gap-3 p-3 bg-white rounded-xl shadow-sm border border-slate-50">
          <div className="h-4 w-4 rounded-full bg-[#3B82F6] ring-4 ring-blue-50" />
          <div>
            <p className="text-xs font-bold text-slate-800">Line 1</p>
            <p className="text-[10px] text-slate-400">Versova - Ghatkopar</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-3 bg-white rounded-xl shadow-sm border border-slate-50">
          <div className="h-4 w-4 rounded-full bg-[#FACC15] ring-4 ring-yellow-50" />
          <div>
            <p className="text-xs font-bold text-slate-800">Line 2A</p>
            <p className="text-[10px] text-slate-400">Dahisar (W) - DN Nagar</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-3 bg-white rounded-xl shadow-sm border border-slate-50">
          <div className="h-4 w-4 rounded-full bg-[#EF4444] ring-4 ring-rose-50" />
          <div>
            <p className="text-xs font-bold text-slate-800">Line 7</p>
            <p className="text-[10px] text-slate-400">Dahisar (E) - Andheri (E)</p>
          </div>
        </div>
      </div>
    </div>
  )
}
