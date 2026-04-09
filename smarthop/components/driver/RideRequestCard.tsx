'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MapPin, Navigation, Clock, CheckCircle2, X } from 'lucide-react'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { RideGroup } from '@/types'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

interface RideRequestCardProps {
  group: RideGroup
  onAccept: () => void
  onDecline: () => void
  isAccepting?: boolean
}

export default function RideRequestCard({ group, onAccept, onDecline, isAccepting }: RideRequestCardProps) {
  const [timeLeft, setTimeLeft] = useState(30)
  const [passengerCount, setPassengerCount] = useState<number | null>(null)
  const [passengerNames, setPassengerNames] = useState<string[]>([])
  const [destinations, setDestinations] = useState<{address: string, lat: number, lng: number}[]>([])
  const [stationName, setStationName] = useState('Loading...')
  const [currentGroup, setCurrentGroup] = useState<RideGroup>(group)
  const [supabase] = useState(() => createSupabaseBrowserClient())

  const fareTotal = Number(currentGroup.fare_total ?? 0)
  const earnings = fareTotal.toFixed(2)

  useEffect(() => {
    const fetchData = async () => {
      try {
        console.log(`[RideRequestCard] Fetching data for group ${group.id}...`)
        
        // 1. Fetch station name with a timeout
        const { data: stationData, error: stnErr } = await Promise.race([
          supabase
            .from('metro_stations')
            .select('name')
            .eq('id', group.station_id)
            .single(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Station Fetch Timeout')), 15000))
        ]) as any

        if (stnErr) {
          console.warn('Station fetch error:', stnErr)
          setStationName('Metro Station')
        } else if (stationData) {
          setStationName(stationData.name)
        }

        // 2. Fetch members to get rider names and count
        const { data: members, error: memErr } = await supabase
          .from('ride_members')
          .select('request_id, user_id, users(name)', { count: 'exact' })
          .eq('group_id', group.id)
        
        if (memErr) {
          console.warn('Members fetch error:', memErr)
        } else if (members) {
          setPassengerCount(members.length)
          const names = members.map((m: any) => {
            const userObj = m.users || m.user
            if (Array.isArray(userObj)) return userObj[0]?.name || 'Rider'
            return userObj?.name || 'Rider'
          })
          setPassengerNames(names)

          // 2b. Fetch individual destinations for route preview
          const requestIds = members.map((m: any) => m.request_id).filter(Boolean)
          if (requestIds.length > 0) {
            const { data: requests } = await supabase
              .from('ride_requests')
              .select('dest_lat, dest_lng, dest_address')
              .in('id', requestIds)

            if (requests) {
              setDestinations(requests.map((r: any) => ({
                address: r.dest_address || 'Drop Point',
                lat: r.dest_lat,
                lng: r.dest_lng
              })))
            }
          }
        }

        // 3. Re-fetch group to get updated fare/distance
        const { data: updatedGroup, error: grpErr } = await supabase
          .from('ride_groups')
          .select('*')
          .eq('id', group.id)
          .single()
        
        if (updatedGroup) {
          setCurrentGroup(updatedGroup as RideGroup)
        }
      } catch (err) {
        console.error('[RideRequestCard] Fetch error:', err)
        setStationName('Metro Station')
      }
    }

    fetchData()

    // Real-time subscription for members joining this group
    const channel = supabase
      .channel(`group_members_${group.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ride_members',
          filter: `group_id=eq.${group.id}`
        },
        () => {
          fetchData()
        }
      )
      .subscribe()

    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)

    return () => {
      clearInterval(timer)
      supabase.removeChannel(channel)
    }
  }, [group.id, group.station_id, supabase])

  // Call onDecline when timer hits zero
  useEffect(() => {
    if (timeLeft === 0 && !isAccepting) {
      onDecline()
    }
  }, [timeLeft, onDecline, isAccepting])

  const progress = (timeLeft / 30) * 100

  return (
    <motion.div
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -100, opacity: 0 }}
      className="fixed top-4 left-4 right-4 z-50 pointer-events-none"
    >
      <Card className="shadow-2xl border-2 border-slate-200 pointer-events-auto bg-white/95 backdrop-blur-sm">
        <CardHeader className="pb-2">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                {passengerNames.length > 0 ? passengerNames.join(', ') : (passengerCount !== null ? `${passengerCount} Passengers` : '...')}
                <Badge variant="secondary" className="bg-teal-100 text-blue-700 hover:bg-teal-100">
                  ₹{earnings} payout
                </Badge>
              </CardTitle>
              <div className="flex items-center gap-1 text-sm text-slate-500 font-medium font-outfit">
                <MapPin className="w-4 h-4 text-slate-400" />
                Pickup: {stationName}
              </div>
            </div>
            
            {/* Circular Countdown Timer */}
            <div className="relative w-12 h-12 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90">
                <circle
                  cx="24"
                  cy="24"
                  r="20"
                  fill="none"
                  stroke="#f1f5f9"
                  strokeWidth="4"
                />
                <circle
                  cx="24"
                  cy="24"
                  r="20"
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth="4"
                  strokeDasharray="125.6"
                  strokeDashoffset={125.6 * (1 - progress / 100)}
                  className="transition-all duration-1000 ease-linear"
                />
              </svg>
              <span className="absolute text-xs font-bold text-slate-700">{timeLeft}s</span>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Route Preview</p>
            <div className="space-y-3 relative pl-4 border-l-2 border-dashed border-slate-200 ml-1">
              {/* Pickup station */}
              <div className="flex items-start gap-3 relative">
                <div className="absolute -left-[21px] mt-1.5 w-2.5 h-2.5 rounded-full bg-green-500 ring-2 ring-green-200" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-green-700 leading-tight">📍 {stationName}</p>
                  <p className="text-[10px] text-slate-400">Pickup Point</p>
                </div>
              </div>

              {/* Destinations */}
              {destinations.length > 0 ? (
                destinations.map((dest, idx) => (
                  <div key={idx} className="flex items-start gap-3 relative">
                    <div className="absolute -left-[21px] mt-1.5 w-2.5 h-2.5 rounded-full bg-red-400 ring-2 ring-red-100" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-800 leading-tight truncate">{dest.address}</p>
                      {idx === destinations.length - 1 && <p className="text-[10px] text-slate-500">Final Drop</p>}
                    </div>
                  </div>
                ))
              ) : (
                <div className="animate-pulse flex items-center gap-2">
                  <div className="h-2.5 bg-slate-200 rounded-full w-24"></div>
                </div>
              )}
            </div>
            <div className="pt-2 flex items-center gap-2 text-xs font-medium text-slate-500">
              <Navigation className="w-3.5 h-3.5" />
              {currentGroup.distance_km} km total route • {currentGroup.duration_min} min est.
            </div>
          </div>
        </CardContent>
        
        <CardFooter className="flex gap-3 pt-2">
          <Button 
            className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold h-12 shadow-md hover:shadow-lg transition-all"
            onClick={onAccept}
            disabled={isAccepting}
          >
            <CheckCircle2 className="w-5 h-5 mr-2" />
            {isAccepting ? 'Optimizing...' : 'Accept Ride'}
          </Button>
          <Button 
            variant="outline" 
            className="px-6 h-12 border-slate-200 hover:bg-slate-50 text-slate-600 font-medium"
            onClick={onDecline}
            disabled={isAccepting}
          >
            Decline
          </Button>
        </CardFooter>
      </Card>
    </motion.div>
  )
}
