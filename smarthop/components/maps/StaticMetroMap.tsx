'use client'

import React from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { MUMBAI_METRO_STATIONS } from '@/lib/stations'
import { Badge } from '@/components/ui/badge'

// Mumbai Center
const CENTER: [number, number] = [19.0760, 72.8777]

export default function StaticMetroMap() {
  const getLineColor = (line: string) => {
    switch (line) {
      case 'Line 1': return '#3B82F6' // Blue
      case 'Line 2A': return '#EF4444' // Red
      case 'Line 7': return '#22C55E' // Green
      default: return '#94A3B8'
    }
  }

  return (
    <div className="w-full space-y-6">
      <div className="h-[300px] md:h-[420px] w-full rounded-xl overflow-hidden border border-slate-200 shadow-inner z-0">
        <MapContainer 
          center={CENTER} 
          zoom={11} 
          scrollWheelZoom={false}
          className="h-full w-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          {MUMBAI_METRO_STATIONS.map((station) => (
            <CircleMarker
              key={station.id}
              center={[station.lat, station.lng]}
              radius={7}
              pathOptions={{
                fillColor: getLineColor(station.line),
                color: 'white',
                weight: 2,
                opacity: 1,
                fillOpacity: 0.8
              }}
            >
              <Popup>
                <div className="p-1 space-y-2">
                  <h3 className="font-bold text-slate-900 m-0">{station.name}</h3>
                  <Badge 
                    style={{ backgroundColor: getLineColor(station.line) }}
                    className="text-white border-none"
                  >
                    {station.line}
                  </Badge>
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-6 py-4 bg-slate-50 rounded-lg dark:bg-slate-900">
        <div className="flex items-center space-x-2">
          <div className="h-3 w-3 rounded-full bg-[#3B82F6]" />
          <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Line 1 (Blue)</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="h-3 w-3 rounded-full bg-[#EF4444]" />
          <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Line 2A (Yellow/Red)</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="h-3 w-3 rounded-full bg-[#22C55E]" />
          <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Line 7 (Red/Green)</span>
        </div>
      </div>
    </div>
  )
}
