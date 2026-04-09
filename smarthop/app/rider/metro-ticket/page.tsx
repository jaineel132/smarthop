'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowDownUp, Bell, Ticket as TicketIcon } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { useAuth } from '@/hooks/useAuth'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

const supabase = createSupabaseBrowserClient()
import { MUMBAI_METRO_STATIONS } from '@/lib/stations'
import { getMetroFare } from '@/lib/fare-chart'
import { requestPermission } from '@/lib/notifications'
import { useGeofence } from '@/hooks/useGeofence'

function generateQrDataUrl(payload: string) {
  const size = 21
  const cell = 8
  const padding = 16
  const totalSize = size * cell + padding * 2
  const hashBytes = Array.from(payload).map((character) => character.charCodeAt(0))

  const isDark = (row: number, column: number) => {
    const inFinderPattern = (originRow: number, originColumn: number) => {
      const localRow = row - originRow
      const localColumn = column - originColumn
      return localRow >= 0 && localRow < 7 && localColumn >= 0 && localColumn < 7
    }

    if (
      inFinderPattern(0, 0) ||
      inFinderPattern(0, size - 7) ||
      inFinderPattern(size - 7, 0)
    ) {
      const localRow = row < 7 ? row : row >= size - 7 ? row - (size - 7) : row
      const localColumn = column < 7 ? column : column >= size - 7 ? column - (size - 7) : column
      return (
        localRow === 0 || localRow === 6 ||
        localColumn === 0 || localColumn === 6 ||
        (localRow >= 2 && localRow <= 4 && localColumn >= 2 && localColumn <= 4)
      )
    }

    const index = (row * size + column) % hashBytes.length
    const value = hashBytes[index] ^ (row * 31 + column * 17)
    return value % 3 === 0
  }

  const rows: string[] = []
  for (let row = 0; row < size; row += 1) {
    let rowCells = ''
    for (let column = 0; column < size; column += 1) {
      if (isDark(row, column)) {
        rowCells += `<rect x="${padding + column * cell}" y="${padding + row * cell}" width="${cell}" height="${cell}" rx="1" />`
      }
    }
    rows.push(rowCells)
  }

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${totalSize}" height="${totalSize}" viewBox="0 0 ${totalSize} ${totalSize}" shape-rendering="crispEdges">
      <rect width="100%" height="100%" fill="#ffffff" />
      <g fill="#0f172a">${rows.join('')}</g>
    </svg>
  `

  return `data:image/svg+xml;base64,${btoa(svg)}`
}

export default function MetroTicketPage() {
  const router = useRouter()
  const { user } = useAuth()
  
  const [fromStationId, setFromStationId] = useState<string>('')
  const [toStationId, setToStationId] = useState<string>('')
  const [fare, setFare] = useState<number>(0)
  const [isBooking, setIsBooking] = useState(false)
  
  const [ticket, setTicket] = useState<any>(null)
  const [qrDataUrl, setQrDataUrl] = useState<string>('')
  const [alertEnabled, setAlertEnabled] = useState(false)

  const fromStation = MUMBAI_METRO_STATIONS.find(s => s.id === fromStationId) || null
  const toStation = MUMBAI_METRO_STATIONS.find(s => s.id === toStationId) || null

  // Geofence activation
  const { isActive: geofenceActive } = useGeofence(toStation, alertEnabled, {
    source: 'metro-alert',
    ticketId: ticket?.id ?? null,
    userId: user?.id ?? null,
  })

  useEffect(() => {
    if (fromStationId && toStationId) {
      setFare(getMetroFare(fromStationId, toStationId))
    } else {
      setFare(0)
    }
  }, [fromStationId, toStationId])

  const handleSwap = () => {
    const temp = fromStationId
    setFromStationId(toStationId)
    setToStationId(temp)
  }

  const handleBookTicket = async () => {
    if (!user) {
      toast.error('Please login to book a ticket')
      return
    }
    if (!fromStation || !toStation) return

    setIsBooking(true)
    const ticketId = `SH-${Date.now()}`
    const timestamp = Date.now()
    const validUntil = timestamp + 7200000 // 2 hours

    const qrData = JSON.stringify({
      id: ticketId,
      from: fromStation.name,
      to: toStation.name,
      fare,
      timestamp,
      valid_until: validUntil
    })

    try {
      const qrUrl = generateQrDataUrl(qrData)
      setQrDataUrl(qrUrl)

      const selectedFromStation = MUMBAI_METRO_STATIONS.find(s => s.id === fromStationId)
      const selectedToStation = MUMBAI_METRO_STATIONS.find(s => s.id === toStationId)

      if (!selectedFromStation || !selectedToStation) {
        throw new Error('Could not resolve selected station IDs.')
      }

      // Insert into supabase
      const { data, error } = await supabase.from('metro_tickets').insert({
        user_id: user.id,
        from_station_id: selectedFromStation.id,
        to_station_id: selectedToStation.id,
        fare,
        qr_code: qrData,
        alert_enabled: alertEnabled,
      }).select().single()

      if (error) throw error

      await supabase.from('handoff_events').insert({
        event_type: 'ticket_booked',
        user_id: user.id,
        ticket_id: data.id,
        station_id: selectedToStation.id,
        details: {
          from_station_id: selectedFromStation.id,
          to_station_id: selectedToStation.id,
          alert_enabled: alertEnabled,
        },
      })

      setTicket({
        ...data,
        displayId: ticketId,
        fromName: selectedFromStation.name,
        toName: selectedToStation.name,
        validUntil
      })
      
      toast.success('Ticket booked successfully!')
    } catch (err: any) {
      console.error(err)
      toast.error('Failed to book ticket')
    } finally {
      setIsBooking(false)
    }
  }

  const handleToggleAlert = async (checked: boolean) => {
    if (checked) {
      const granted = await requestPermission()
      if (granted) {
        setAlertEnabled(true)
        if (ticket) {
          await supabase.from('metro_tickets')
            .update({ alert_enabled: true })
            .eq('id', ticket.id)
        }
      } else {
        setAlertEnabled(false)
        toast.error('Enable notifications in browser settings')
      }
    } else {
      setAlertEnabled(false)
      if (ticket) {
        await supabase.from('metro_tickets')
          .update({ alert_enabled: false })
          .eq('id', ticket.id)
      }
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24 font-sans">
      <div className="bg-white border-b px-4 py-4 flex items-center sticky top-0 z-10 shadow-sm">
        <button onClick={() => router.back()} className="p-2 -ml-2 rounded-full hover:bg-slate-100 mr-2">
          <ArrowLeft className="w-5 h-5 text-slate-700" />
        </button>
        <h1 className="text-xl font-bold bg-clip-text text-transparent bg-linear-to-r from-blue-600 to-indigo-600">
          Book Metro Ticket
        </h1>
      </div>

      <div className="p-4 max-w-lg mx-auto">
        {!ticket ? (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="shadow-md border-slate-200/60 overflow-hidden mb-6">
              <div className="bg-slate-50 border-b p-4 pb-3">
                <div className="flex items-center text-slate-500 mb-1">
                  <TicketIcon className="w-4 h-4 mr-2" />
                  <span className="text-sm font-medium uppercase tracking-wider">Plan Journey</span>
                </div>
              </div>
              <CardContent className="p-5">
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700">From Station</label>
                    <select 
                      className="w-full p-3 border rounded-xl bg-slate-50 focus:ring-2 focus:ring-blue-500 focus:border-teal-600 transition-all outline-none"
                      value={fromStationId}
                      onChange={(e) => setFromStationId(e.target.value)}
                    >
                      <option value="">Select origin...</option>
                      {MUMBAI_METRO_STATIONS.map((s) => (
                        <option key={s.id} value={s.id}>{s.name} ({s.line})</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex justify-center -my-2 relative z-10">
                    <button 
                      onClick={handleSwap}
                      className="bg-white p-2.5 rounded-full shadow-md border hover:bg-slate-50 transition-colors"
                      type="button"
                    >
                      <ArrowDownUp className="w-4 h-4 text-teal-700" />
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700">To Station</label>
                    <select 
                      className="w-full p-3 border rounded-xl bg-slate-50 focus:ring-2 focus:ring-blue-500 focus:border-teal-600 transition-all outline-none"
                      value={toStationId}
                      onChange={(e) => setToStationId(e.target.value)}
                    >
                      <option value="">Select destination...</option>
                      {MUMBAI_METRO_STATIONS.map((s) => (
                        <option key={s.id} value={s.id}>{s.name} ({s.line})</option>
                      ))}
                    </select>
                  </div>

                  <AnimatePresence>
                    {fromStationId && toStationId && fare > 0 && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }} 
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="pt-4 border-t mt-4"
                      >
                        <div className="flex justify-between items-center bg-teal-50 p-4 rounded-xl border border-teal-100">
                          <span className="text-blue-900 font-medium">Standard Fare</span>
                          <span className="text-xl font-bold text-blue-700">{formatCurrency(fare)}</span>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </CardContent>
            </Card>

            <Button 
              className="w-full text-lg h-14 rounded-xl shadow-lg bg-teal-700 hover:bg-blue-700 transition-all"
              disabled={!fromStationId || !toStationId || isBooking}
              onClick={handleBookTicket}
            >
              {isBooking ? 'Generating Ticket...' : 'Book Ticket'}
            </Button>
          </motion.div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, y: 50 }} 
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Ticket Card */}
            <div className="bg-white rounded-3xl shadow-xl overflow-hidden border">
              <div className="bg-linear-to-r from-blue-600 to-indigo-600 p-6 text-white text-center relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-20">
                  <TicketIcon className="w-24 h-24 rotate-12 transform translate-x-4 -translate-y-4" />
                </div>
                <h2 className="text-2xl font-bold relative z-10 tracking-tight">SmartHop Metro Pass</h2>
                <p className="text-teal-100 mt-1 relative z-10 text-sm font-medium">Digital QR Ticket</p>
              </div>
              
              <div className="p-6 bg-white relative">
                {/* Decorative cutouts */}
                <div className="absolute left-0 top-0 -translate-x-1/2 -translate-y-1/2 w-6 h-6 bg-slate-50 rounded-full border-r"></div>
                <div className="absolute right-0 top-0 translate-x-1/2 -translate-y-1/2 w-6 h-6 bg-slate-50 rounded-full border-l"></div>
                
                <div className="flex justify-between items-center mb-6 px-2">
                  <div className="text-center w-2/5">
                    <p className="text-xs text-slate-500 uppercase font-semibold mb-1">From</p>
                    <p className="font-bold text-slate-800 line-clamp-2">{ticket.fromName}</p>
                  </div>
                  <div className="flex-1 flex justify-center text-slate-300">
                     <ArrowLeft className="w-5 h-5 rotate-180 text-teal-600" />
                  </div>
                  <div className="text-center w-2/5">
                    <p className="text-xs text-slate-500 uppercase font-semibold mb-1">To</p>
                    <p className="font-bold text-slate-800 line-clamp-2">{ticket.toName}</p>
                  </div>
                </div>

                <div className="flex justify-center my-6">
                  <div className="p-3 bg-white border-2 border-slate-100 shadow-sm rounded-2xl">
                    <img src={qrDataUrl} alt="Ticket QR Code" className="w-48 h-48" />
                  </div>
                </div>

                <div className="flex justify-between items-end border-t border-dashed pt-4 mb-4">
                  <div>
                    <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Date & Time</p>
                    <p className="text-sm font-medium text-slate-800">
                      {new Date(ticket.created_at || Date.now()).toLocaleString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        hour: 'numeric',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Paid</p>
                    <p className="text-lg font-bold text-slate-800">{formatCurrency(ticket.fare)}</p>
                  </div>
                </div>

                <div className="bg-slate-50 rounded-xl p-3 flex justify-between items-center">
                  <span className="font-mono text-xs text-slate-500 tracking-wider font-semibold">ID: {ticket.displayId}</span>
                  <span className="bg-green-100 text-green-700 text-xs px-2.5 py-1 rounded-full font-bold uppercase tracking-wide">
                    Valid 2 Hours
                  </span>
                </div>
              </div>
            </div>

            {/* Alert Toggle */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className={`p-2 rounded-full ${alertEnabled ? 'bg-teal-100 text-teal-700' : 'bg-slate-100 text-slate-500'}`}>
                  <Bell className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-semibold text-slate-800">Arrival Alert</p>
                  <p className="text-xs text-slate-500">Alert me near {ticket.toName}</p>
                </div>
              </div>
              <Switch checked={alertEnabled} onCheckedChange={handleToggleAlert} />
            </div>
            
            {geofenceActive && (
               <motion.p 
                 initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                 className="text-xs text-center text-teal-700 font-medium bg-teal-50 py-2 px-4 rounded-full border border-teal-100"
               >
                 Ride alert active — notification fires 500m before station
               </motion.p>
            )}

            <div className="pt-4 flex gap-3">
              <Button 
                variant="outline" 
                className="flex-1 h-12 rounded-xl text-teal-700 border-blue-200 hover:bg-teal-50 hover:text-blue-700 font-semibold"
                onClick={() => setTicket(null)}
              >
                Book Another
              </Button>
              <Button 
                className="flex-1 h-12 rounded-xl bg-slate-900 hover:bg-slate-800 font-semibold"
                onClick={() => router.push('/rider/dashboard')}
              >
                Done
              </Button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}
