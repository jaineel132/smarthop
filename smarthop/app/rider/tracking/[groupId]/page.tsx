'use client'

import React, { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { ArrowLeft, Phone, Star, Clock, Users, MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { useAuth } from '@/hooks/useAuth'
import { useDriverLocation } from '@/hooks/useRealtime'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { RideGroup, Waypoint } from '@/types'

const LiveTrackingMap = dynamic(
  () => import('@/components/maps/LiveTrackingMap'),
  { ssr: false }
)

const supabase = createSupabaseBrowserClient()

export default function TrackingPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = use(params)
  const router = useRouter()
  const { user } = useAuth()

  const [group, setGroup] = useState<RideGroup | null>(null)
  const [waypoints, setWaypoints] = useState<Waypoint[]>([])
  const [driverName, setDriverName] = useState('Driver')
  const [driverRating, setDriverRating] = useState(5.0)
  const [driverAvatar, setDriverAvatar] = useState<string | null>(null)
  const [riderCount, setRiderCount] = useState(0)
  const [currentStopIndex, setCurrentStopIndex] = useState(0)
  const [loading, setLoading] = useState(true)

  const driverLocation = useDriverLocation(group?.driver_id ?? null)

  // Fetch ride data
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch group
        const { data: groupData } = await supabase
          .from('ride_groups')
          .select('*')
          .eq('id', groupId)
          .single()

        if (groupData) {
          setGroup(groupData)

          // Fetch driver profile
          if (groupData.driver_id) {
            const { data: driver } = await supabase
              .from('users')
              .select('name, driver_rating, avatar_url')
              .eq('id', groupData.driver_id)
              .single()

            if (driver) {
              setDriverName(driver.name)
              setDriverRating(driver.driver_rating ?? 5.0)
              setDriverAvatar(driver.avatar_url)
            }
          }
        }

        // Fetch route
        const { data: routeData } = await supabase
          .from('routes')
          .select('waypoints')
          .eq('group_id', groupId)
          .single()

        if (routeData?.waypoints) {
          setWaypoints(routeData.waypoints as Waypoint[])
          const completedCount = (routeData.waypoints as Waypoint[]).filter(w => w.completed).length
          setCurrentStopIndex(completedCount)
        }

        // Fetch member count
        const { count } = await supabase
          .from('ride_members')
          .select('*', { count: 'exact', head: true })
          .eq('group_id', groupId)

        setRiderCount(count ?? 0)
      } catch (err) {
        console.warn('Error fetching tracking data:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [groupId])

  // Poll group status every 10s
  useEffect(() => {
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from('ride_groups')
        .select('status')
        .eq('id', groupId)
        .single()

      if (data?.status === 'completed') {
        clearInterval(interval)
        toast.success('Ride completed!')
        router.push(`/rider/fare-summary/${groupId}`)
      }

      if (data) setGroup(prev => prev ? { ...prev, status: data.status } : prev)
    }, 10000)

    return () => clearInterval(interval)
  }, [groupId, router])

  // Rider location from browser
  const [riderLat, setRiderLat] = useState<number | null>(null)
  const [riderLng, setRiderLng] = useState<number | null>(null)

  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setRiderLat(pos.coords.latitude)
          setRiderLng(pos.coords.longitude)
        },
        () => {
          // Default to Mumbai center
          setRiderLat(19.076)
          setRiderLng(72.8777)
        }
      )
    }
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    )
  }

  const statusLabel =
    group?.status === 'accepted' ? 'On the way' :
    group?.status === 'in_progress' ? 'In transit' :
    group?.status === 'forming' ? 'Finding driver...' : 'Tracking'

  const statusColor =
    group?.status === 'accepted' ? 'text-green-600' :
    group?.status === 'in_progress' ? 'text-blue-600' :
    'text-amber-600'

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3 flex items-center sticky top-0 z-30 shadow-sm">
        <button onClick={() => router.push('/rider/dashboard')} className="p-2 -ml-2 rounded-full hover:bg-slate-100 mr-2">
          <ArrowLeft className="w-5 h-5 text-slate-700" />
        </button>
        <h1 className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
          Live Tracking
        </h1>
        <span className={`ml-auto text-sm font-semibold ${statusColor}`}>{statusLabel}</span>
      </div>

      {/* Map — top 55% */}
      <LiveTrackingMap
        driverLat={driverLocation.lat}
        driverLng={driverLocation.lng}
        riderLat={riderLat}
        riderLng={riderLng}
        waypoints={waypoints}
        currentStopIndex={currentStopIndex}
      />

      {/* Bottom Panel */}
      <div className="flex-1 bg-white rounded-t-3xl -mt-4 relative z-10 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] overflow-auto pb-24">
        <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto mt-3 mb-4" />

        <div className="px-5 space-y-4">
          {/* Driver Card */}
          <Card className="border-slate-200/60 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-lg font-bold shadow-md">
                  {driverAvatar ? (
                    <img src={driverAvatar} alt="" className="w-full h-full rounded-full object-cover" />
                  ) : (
                    driverName.charAt(0).toUpperCase()
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-slate-800">{driverName}</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                    <span className="text-sm text-slate-500">{driverRating.toFixed(1)}</span>
                    <span className="text-slate-300 mx-1">•</span>
                    <span className={`text-sm font-medium ${statusColor}`}>{statusLabel}</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-400 font-medium">AUTO</p>
                  <p className="text-sm font-bold text-slate-700">MH02AB1234</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ETA and Info */}
          <div className="flex gap-3">
            <div className="flex-1 bg-blue-50 rounded-xl p-3 text-center border border-blue-100">
              <Clock className="w-5 h-5 text-blue-600 mx-auto mb-1" />
              <p className="text-lg font-bold text-blue-900">~{group?.duration_min ?? 15} min</p>
              <p className="text-xs text-blue-500">ETA</p>
            </div>
            <div className="flex-1 bg-slate-50 rounded-xl p-3 text-center border border-slate-200">
              <Users className="w-5 h-5 text-slate-600 mx-auto mb-1" />
              <p className="text-lg font-bold text-slate-800">{riderCount}</p>
              <p className="text-xs text-slate-500">Co-riders</p>
            </div>
            <div className="flex-1 bg-slate-50 rounded-xl p-3 text-center border border-slate-200">
              <MapPin className="w-5 h-5 text-slate-600 mx-auto mb-1" />
              <p className="text-lg font-bold text-slate-800">{waypoints.length}</p>
              <p className="text-xs text-slate-500">Stops</p>
            </div>
          </div>

          {/* Stop Progress */}
          {waypoints.length > 0 && (
            <Card className="border-slate-200/60 shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs text-slate-500 uppercase font-semibold tracking-wider mb-3">Drop Points</p>
                <div className="flex items-center gap-1">
                  {waypoints.map((wp, i) => (
                    <React.Fragment key={i}>
                      <motion.div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 shrink-0 ${
                          i < currentStopIndex
                            ? 'bg-green-500 border-green-500 text-white'
                            : i === currentStopIndex
                              ? 'bg-blue-500 border-blue-500 text-white'
                              : 'bg-white border-slate-300 text-slate-400'
                        }`}
                        initial={{ scale: 0.8 }}
                        animate={{ scale: i === currentStopIndex ? 1.1 : 1 }}
                        transition={{ repeat: i === currentStopIndex ? Infinity : 0, repeatType: 'reverse', duration: 1 }}
                      >
                        {i < currentStopIndex ? '✓' : i + 1}
                      </motion.div>
                      {i < waypoints.length - 1 && (
                        <div className={`flex-1 h-0.5 ${i < currentStopIndex ? 'bg-green-400' : 'bg-slate-200'}`} />
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* SOS Button */}
      <Dialog>
        <DialogTrigger asChild>
          <button className="fixed bottom-6 right-5 z-50 w-14 h-14 bg-red-600 hover:bg-red-700 rounded-full shadow-lg flex items-center justify-center transition-all active:scale-95">
            <Phone className="w-6 h-6 text-white" />
          </button>
        </DialogTrigger>
        <DialogContent className="max-w-xs mx-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-center text-lg">Emergency?</DialogTitle>
          </DialogHeader>
          <div className="text-center space-y-4 py-2">
            <p className="text-slate-600">If you feel unsafe, call emergency services immediately.</p>
            <a
              href="tel:112"
              className="inline-flex items-center justify-center gap-2 w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
            >
              <Phone className="w-5 h-5" />
              Call 112
            </a>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
