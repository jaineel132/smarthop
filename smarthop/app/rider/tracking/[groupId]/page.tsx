'use client'

import React, { useState, useEffect, useCallback, use } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { ArrowLeft, Phone, Star, Clock, Users, MapPin, Loader2, Car } from 'lucide-react'
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

export default function TrackingPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = use(params)
  const router = useRouter()
  const { user } = useAuth()

  const [supabase] = useState(() => createSupabaseBrowserClient())
  const [group, setGroup] = useState<RideGroup | null>(null)
  const [waypoints, setWaypoints] = useState<Waypoint[]>([])
  const [driverName, setDriverName] = useState('Driver')
  const [driverRating, setDriverRating] = useState(5.0)
  const [driverAvatar, setDriverAvatar] = useState<string | null>(null)
  const [riderCount, setRiderCount] = useState(0)
  const [fareShare, setFareShare] = useState<number | null>(null)
  const [savingsPct, setSavingsPct] = useState(0)
  const [currentStopIndex, setCurrentStopIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [myMemberStatus, setMyMemberStatus] = useState<string | null>(null)
  const [matchExpired, setMatchExpired] = useState(false)

  const driverLocation = useDriverLocation(group?.driver_id ?? null)
  const matchExpiredRef = React.useRef(false)
  const staleClaimHandledRef = React.useRef(false)
  const MATCH_TIMEOUT_MS = 3 * 60 * 1000
  const CLAIM_CONFIRM_GRACE_MS = 10 * 1000

  const getGroupFreshnessAnchorMs = useCallback((groupValue: RideGroup) => {
    const groupAny = groupValue as RideGroup & { updated_at?: string }
    const freshnessAnchor = groupAny.updated_at || groupValue.created_at
    return new Date(freshnessAnchor).getTime()
  }, [])

  const isStaleClaimedFormingGroup = useCallback((groupValue: RideGroup) => {
    if (groupValue.status !== 'forming' || !groupValue.driver_id) return false
    const anchorMs = getGroupFreshnessAnchorMs(groupValue)
    if (!Number.isFinite(anchorMs)) return false
    return Date.now() - anchorMs > CLAIM_CONFIRM_GRACE_MS
  }, [CLAIM_CONFIRM_GRACE_MS, getGroupFreshnessAnchorMs])

  const markMatchExpired = useCallback(async () => {
    if (matchExpiredRef.current) return
    matchExpiredRef.current = true
    setMatchExpired(true)

    try {
      const { data: members } = await supabase
        .from('ride_members')
        .select('request_id')
        .eq('group_id', groupId)

      const requestIds = (members || [])
        .map((member: any) => member.request_id)
        .filter(Boolean)

      const updates: Promise<any>[] = [
        Promise.resolve(supabase.from('ride_groups').update({ status: 'cancelled' }).eq('id', groupId)),
        Promise.resolve(supabase.from('ride_members').update({ status: 'cancelled' }).eq('group_id', groupId)),
        Promise.resolve(supabase.from('fare_transactions').update({ status: 'failed' }).eq('group_id', groupId)),
      ]

      if (requestIds.length > 0) {
        updates.push(
          Promise.resolve(
            supabase
              .from('ride_requests')
              .update({ status: 'expired' })
              .in('id', requestIds)
          )
        )
      }

      await Promise.all(updates)
    } catch (error) {
      console.warn('Failed to mark matching as expired:', error)
    }
  }, [groupId, supabase])

  // Fetch full ride data (group, route, driver, members)
  const fetchFullData = useCallback(async () => {
    try {
      // Fetch group
      const { data: groupData } = await supabase
        .from('ride_groups')
        .select('*')
        .eq('id', groupId)
        .single()

      if (groupData) {
        setGroup(groupData)

        if (isStaleClaimedFormingGroup(groupData as RideGroup)) {
          if (!staleClaimHandledRef.current) {
            staleClaimHandledRef.current = true
            toast.error('Driver confirmation took too long. Releasing your match...')
          }
          await markMatchExpired()
          return
        }

        // Fetch driver profile if driver assigned
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

        if (groupData.status === 'forming' && !groupData.driver_id) {
          const expiresAtMs = groupData.expires_at
            ? new Date(groupData.expires_at).getTime()
            : new Date(groupData.created_at).getTime() + MATCH_TIMEOUT_MS

          if (Number.isFinite(expiresAtMs) && Date.now() >= expiresAtMs) {
            await markMatchExpired()
            return
          }
        }
      }

      // Fetch route (maybe empty initially if driver hasn't accepted yet)
      const { data: routeData, error: routeError } = await supabase
        .from('routes')
        .select('waypoints')
        .eq('group_id', groupId)
        .maybeSingle()

      if (routeError && routeError.code !== 'PGRST116') {
         console.warn('Routes fetch warning:', routeError.message)
      }

      if (routeData?.waypoints) {
        setWaypoints(routeData.waypoints as Waypoint[])
        const completedCount = (routeData.waypoints as Waypoint[]).filter(w => w.completed).length
        setCurrentStopIndex(completedCount)
      }

      // Fetch member count and current user's fare
      const [membersRes, countRes] = await Promise.all([
        supabase
          .from('ride_members')
          .select('fare_share, savings_pct, user_id')
          .eq('group_id', groupId),
        supabase
          .from('ride_members')
          .select('*', { count: 'exact', head: true })
          .eq('group_id', groupId)
      ])

      const members = membersRes.data
      const count = countRes.count

      if (members) {
        setRiderCount(count ?? members.length)
        // Get requestId from URL search params
        const urlParams = new URLSearchParams(window.location.search);
        const requestId = urlParams.get('requestId');
        
        let myMember;
        if (requestId) {
          myMember = (members as any[]).find(m => m.request_id === requestId);
        } else {
          myMember = (members as any[]).find(m => m.user_id === user?.id);
        }

        if (myMember) {
          setFareShare(parseFloat(myMember.fare_share))
          setSavingsPct(parseFloat(myMember.savings_pct))
          setMyMemberStatus(myMember.status)
        }
      }
    } catch (err) {
      console.warn('Error fetching tracking data:', err)
    } finally {
      setLoading(false)
    }
  }, [groupId, supabase, markMatchExpired, isStaleClaimedFormingGroup])

  // Initial data load
  useEffect(() => {
    fetchFullData()
  }, [fetchFullData])

  useEffect(() => {
    if (!group || group.status !== 'forming' || group.driver_id || matchExpired) return

    const expiresAtMs = group.expires_at
      ? new Date(group.expires_at).getTime()
      : new Date(group.created_at).getTime() + MATCH_TIMEOUT_MS

    if (!Number.isFinite(expiresAtMs)) return

    const remainingMs = expiresAtMs - Date.now()
    if (remainingMs <= 0) {
      void markMatchExpired()
      return
    }

    const timer = setTimeout(() => {
      void markMatchExpired()
    }, remainingMs)

    return () => clearTimeout(timer)
  }, [group, matchExpired, markMatchExpired])

  useEffect(() => {
    if (!group || group.status !== 'forming' || !group.driver_id || matchExpired) return

    const anchorMs = getGroupFreshnessAnchorMs(group)
    if (!Number.isFinite(anchorMs)) return

    const remainingMs = CLAIM_CONFIRM_GRACE_MS - (Date.now() - anchorMs)
    if (remainingMs <= 0) {
      if (!staleClaimHandledRef.current) {
        staleClaimHandledRef.current = true
        toast.error('Driver confirmation took too long. Releasing your match...')
      }
      void markMatchExpired()
      return
    }

    const timer = setTimeout(() => {
      if (!staleClaimHandledRef.current) {
        staleClaimHandledRef.current = true
        toast.error('Driver confirmation took too long. Releasing your match...')
      }
      void markMatchExpired()
    }, remainingMs)

    return () => clearTimeout(timer)
  }, [group, matchExpired, markMatchExpired, CLAIM_CONFIRM_GRACE_MS, getGroupFreshnessAnchorMs])

  // Dedicated effect for handling ride completion redirects securely
  useEffect(() => {
    const isArrived = myMemberStatus === 'arrived' || myMemberStatus === 'completed'
    const isGroupComp = group?.status === 'completed'
    
    if (isArrived || isGroupComp) {
      const urlParams = new URLSearchParams(window.location.search);
      const requestId = urlParams.get('requestId');
      const targetUrl = `/rider/fare-summary/${groupId}${requestId ? `?requestId=${requestId}` : ''}`
      
      console.log('Redirecting to fare summary:', { 
        isArrived, 
        isGroupComp, 
        myMemberStatus, 
        groupStatus: group?.status,
        requestId 
      })
      
      router.push(targetUrl)
    }
  }, [group?.status, myMemberStatus, groupId, router])

  // Realtime subscription and polling for group status
  useEffect(() => {
    // Realtime subscription for status changes
    const channel = supabase
      .channel(`ride_status_${groupId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'ride_groups',
          filter: `id=eq.${groupId}`
        },
        async (payload: any) => {
          const newStatus = payload.new.status
          console.log('Realtime group status update:', newStatus)
          setGroup(prev => {
            if (!prev) return payload.new as RideGroup
            return { ...prev, status: newStatus }
          })
          if (newStatus !== 'completed') {
            await fetchFullData()
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'routes',
          filter: `group_id=eq.${groupId}`
        },
        async (payload: any) => {
          // Immediately update waypoints and stop index from realtime
          const newWaypoints = payload.new?.waypoints as Waypoint[] | undefined
          if (newWaypoints && Array.isArray(newWaypoints)) {
            setWaypoints(newWaypoints)
            const completedCount = newWaypoints.filter(w => w.completed).length
            setCurrentStopIndex(completedCount)
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'ride_members',
          filter: `group_id=eq.${groupId}`
        },
        async (payload: any) => {
          const updatedMember = payload.new
          const urlParams = new URLSearchParams(window.location.search)
          const isMe = updatedMember.user_id === user?.id || 
                       updatedMember.request_id === urlParams.get('requestId')
          
          if (isMe) {
            // Immediately update status — triggers redirect via the effect below
            setMyMemberStatus(updatedMember.status)
          }
        }
      )
      .subscribe()

    // Poll every 3 seconds for freshness
    const interval = setInterval(async () => {
      if (group?.status === 'completed') return
      await fetchFullData()
    }, 3000)

    return () => {
      clearInterval(interval)
      supabase.removeChannel(channel)
    }
  }, [groupId, group?.status, supabase, fetchFullData, user?.id])

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

  if (matchExpired || group?.status === 'cancelled') {
    return (
      <div className="min-h-screen bg-linear-to-br from-rose-50 via-white to-slate-50 flex flex-col font-sans">
        <div className="bg-white/80 backdrop-blur-sm border-b px-4 py-3 flex items-center sticky top-0 z-30">
          <button onClick={() => router.push('/rider/dashboard')} className="p-2 -ml-2 rounded-full hover:bg-slate-100 mr-2">
            <ArrowLeft className="w-5 h-5 text-slate-700" />
          </button>
          <h1 className="text-lg font-bold text-slate-900">No driver found</h1>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <div className="w-24 h-24 rounded-full bg-rose-100 flex items-center justify-center shadow-lg shadow-rose-100 mb-6">
            <Car className="w-10 h-10 text-rose-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">No driver matched in time</h2>
          <p className="text-slate-500 mb-8 max-w-sm">
            Your request expired because no driver accepted the ride within the matching window. You can try again or choose a different station.
          </p>

          <div className="w-full max-w-sm space-y-3">
            <Button className="w-full h-12 bg-teal-700 hover:bg-teal-800" onClick={() => router.push('/rider/request-ride')}>
              Try Again
            </Button>
            <Button variant="outline" className="w-full h-12" onClick={() => router.push('/rider/dashboard')}>
              Back to Dashboard
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // ─── WAITING FOR DRIVER SCREEN ───────────────────────────────────────
  if (!group || group.status === 'forming') {
    return (
      <div className="min-h-screen bg-linear-to-br from-blue-50 via-white to-indigo-50 flex flex-col font-sans">
        {/* Header */}
        <div className="bg-white/80 backdrop-blur-sm border-b px-4 py-3 flex items-center sticky top-0 z-30">
          <button onClick={() => router.push('/rider/dashboard')} className="p-2 -ml-2 rounded-full hover:bg-slate-100 mr-2">
            <ArrowLeft className="w-5 h-5 text-slate-700" />
          </button>
          <h1 className="text-lg font-bold bg-clip-text text-transparent bg-linear-to-r from-blue-600 to-indigo-600">
            Ride Requested
          </h1>
          <span className="ml-auto text-sm font-semibold text-amber-600">Finding driver...</span>
        </div>

        {/* Waiting Content */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <motion.div 
            className="relative mb-8"
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            {/* Pulsing rings */}
            <motion.div 
              className="absolute inset-0 rounded-full bg-teal-500/20"
              animate={{ scale: [1, 1.8, 1], opacity: [0.6, 0, 0.6] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              style={{ width: 120, height: 120, margin: '-10px' }}
            />
            <motion.div 
              className="absolute inset-0 rounded-full bg-teal-500/10"
              animate={{ scale: [1, 2.2, 1], opacity: [0.4, 0, 0.4] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
              style={{ width: 120, height: 120, margin: '-10px' }}
            />
            <div className="w-24 h-24 rounded-full bg-linear-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-200">
              <Car className="w-10 h-10 text-white" />
            </div>
          </motion.div>

          <motion.h2 
            className="text-2xl font-bold text-slate-800 mb-2"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            Looking for a driver...
          </motion.h2>
          <motion.p 
            className="text-slate-500 mb-8 max-w-xs"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            We&apos;re matching you with the best available driver near your station. This usually takes less than a minute.
          </motion.p>

          {/* Animated dots */}
          <div className="flex items-center gap-1.5 mb-10">
            {[0, 1, 2].map(i => (
              <motion.div
                key={i}
                className="w-2.5 h-2.5 rounded-full bg-teal-600"
                animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
                transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
              />
            ))}
          </div>

          {/* Info cards */}
          <div className="w-full max-w-sm space-y-3">
            <div className="bg-white rounded-xl p-4 border border-slate-200/60 shadow-sm flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-teal-50 flex items-center justify-center shrink-0">
                <Users className="w-5 h-5 text-teal-700" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-slate-800">Shared ride group</p>
                <p className="text-xs text-slate-500">{riderCount} rider{riderCount !== 1 ? 's' : ''} in your group</p>
              </div>
            </div>
            <div className="bg-white rounded-xl p-4 border border-slate-200/60 shadow-sm flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5 text-green-600" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-slate-800">Estimated wait</p>
                <p className="text-xs text-slate-500">Usually under 2 minutes</p>
              </div>
            </div>
          </div>

          <button 
            onClick={() => router.push('/rider/dashboard')}
            className="mt-8 text-sm text-red-500 hover:text-red-600 font-medium"
          >
            Cancel Request
          </button>
        </div>
      </div>
    )
  }

  // ─── FULL TRACKING UI (accepted / in_progress) ──────────────────────
  const statusLabel =
    group.status === 'accepted' ? 'On the way' :
    group.status === 'in_progress' ? 'In transit' : 'Tracking'

  const statusColor =
    group.status === 'accepted' ? 'text-green-600' :
    group.status === 'in_progress' ? 'text-teal-700' :
    'text-amber-600'

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3 flex items-center sticky top-0 z-30 shadow-sm">
        <button onClick={() => router.push('/rider/dashboard')} className="p-2 -ml-2 rounded-full hover:bg-slate-100 mr-2">
          <ArrowLeft className="w-5 h-5 text-slate-700" />
        </button>
        <h1 className="text-lg font-bold bg-clip-text text-transparent bg-linear-to-r from-blue-600 to-indigo-600">
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
                <div className="w-12 h-12 rounded-full bg-linear-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-lg font-bold shadow-md">
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

          {/* Fare and Info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-teal-50 rounded-xl p-3 border border-teal-100 flex flex-col items-center justify-center">
              <Clock className="w-5 h-5 text-teal-700 mb-1" />
              <p className="text-lg font-bold text-blue-900">~{group.duration_min ?? 15} min</p>
              <p className="text-xs text-teal-600 font-medium">ETA</p>
            </div>
            
            <div className="bg-indigo-50 rounded-xl p-3 border border-indigo-100 flex flex-col items-center justify-center">
              <span className="bg-indigo-600 text-[10px] text-white px-1.5 py-0.5 rounded-full font-bold absolute -top-2 -right-1 shadow-sm">
                ₹{fareShare?.toFixed(0)}
              </span>
              <p className="text-xl font-black text-indigo-900 italic">₹{fareShare?.toFixed(0)}</p>
              <p className="text-[10px] text-indigo-600 font-bold uppercase tracking-tight">Your Share</p>
              {savingsPct > 0 && (
                <p className="text-[9px] text-green-600 font-bold mt-0.5">Save {savingsPct.toFixed(0)}%</p>
              )}
            </div>

            <div className="bg-slate-50 rounded-xl p-3 text-center border border-slate-200">
              <Users className="w-5 h-5 text-slate-600 mx-auto mb-1" />
              <p className="text-lg font-bold text-slate-800">{riderCount}</p>
              <p className="text-xs text-slate-500">Co-riders</p>
            </div>

            <div className="bg-slate-50 rounded-xl p-3 text-center border border-slate-200">
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
                              ? 'bg-teal-600 border-teal-600 text-white'
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
