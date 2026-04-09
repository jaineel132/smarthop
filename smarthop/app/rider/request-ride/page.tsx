'use client'

import React, { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { ArrowLeft, MapPin, Navigation, Loader2, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useAuth } from '@/hooks/useAuth'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { MUMBAI_METRO_STATIONS } from '@/lib/stations'
import { ML_API } from '@/lib/ml-api'
import { haversineDistance, formatCurrency, getCurrentHour, getCurrentDayOfWeek, getDemandLevel } from '@/lib/utils'
import { MetroStation, ClusterGroup, FarePrediction } from '@/types'

import GroupPreviewCard from '@/components/rider/GroupPreviewCard'
import FareBreakdownAccordion from '@/components/rider/FareBreakdownAccordion'

const RideRequestMap = dynamic(() => import('@/components/maps/RideRequestMap'), { ssr: false })



const LOADING_MESSAGES = [
  "Looking for nearby riders...",
  "Analyzing metro routes...",
  "Calculating shared fare logic...",
  "Running ML routing algorithms...",
  "Securing your savings...",
]

const MATCH_TIMEOUT_MS = 3 * 60 * 1000

function isFreshMatch(createdAt?: string | null, expiresAt?: string | null) {
  if (expiresAt) {
    return new Date(expiresAt).getTime() > Date.now()
  }

  if (!createdAt) return true

  return Date.now() - new Date(createdAt).getTime() < MATCH_TIMEOUT_MS
}

function RequestRideContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const [supabase] = useState(() => createSupabaseBrowserClient())

  const mlVersion = 'v2'
  const source = searchParams.get('source')
  const ticketParam = searchParams.get('ticket')
  const isMetroAlertFlow = source === 'metro-alert'

  const [step, setStep] = useState(1)
  const [pickupStationId, setPickupStationId] = useState('')
  const [destLat, setDestLat] = useState<number | null>(null)
  const [destLng, setDestLng] = useState<number | null>(null)
  const [destAddress, setDestAddress] = useState('')

  const [clusterResult, setClusterResult] = useState<ClusterGroup | null>(null)
  const [fareResult, setFareResult] = useState<FarePrediction | null>(null)
  const [rideRequestId, setRideRequestId] = useState<string | null>(null)
  const [rideRequestCreatedAt, setRideRequestCreatedAt] = useState<string | null>(null)
  const [groupId, setGroupId] = useState<string | null>(null)
  const [isMLDown, setIsMLDown] = useState(false)
  const [isConfirming, setIsConfirming] = useState(false)
  const [memberNames, setMemberNames] = useState<string[]>([])
  const [dbStationId, setDbStationId] = useState<string | null>(null)

  const [loadingMsgIndex, setLoadingMsgIndex] = useState(0)
  const refreshInFlightRef = React.useRef(false)
  const lastRidersFingerprintRef = React.useRef<string>('')
  const handoffOpenedLoggedRef = React.useRef<string | null>(null)

  const pickupStation = MUMBAI_METRO_STATIONS.find(s => s.id === pickupStationId) || null

  useEffect(() => {
    const stationParam = searchParams.get('station')
    if (stationParam) {
      const found = MUMBAI_METRO_STATIONS.find(s => s.id === stationParam)
      if (found) setPickupStationId(stationParam)
    }
  }, [searchParams])

  useEffect(() => {
    if (isMetroAlertFlow && pickupStationId) {
      setStep(2)
    }
  }, [isMetroAlertFlow, pickupStationId])

  useEffect(() => {
    if (!isMetroAlertFlow || !pickupStationId || !user) return

    const dedupeKey = `${pickupStationId}:${ticketParam || 'none'}`
    if (handoffOpenedLoggedRef.current === dedupeKey) return
    handoffOpenedLoggedRef.current = dedupeKey

    void supabase.from('handoff_events').insert({
      event_type: 'last_mile_opened',
      user_id: user.id,
      ticket_id: ticketParam || null,
      station_id: pickupStationId,
      details: {
        source: 'metro-alert',
        prefilled_pickup: true,
      },
    })
  }, [isMetroAlertFlow, pickupStationId, ticketParam, user, supabase])

  const handleDestinationSet = (lat: number, lng: number, address: string) => {
    setDestLat(lat)
    setDestLng(lng)
    setDestAddress(address)
  }

  const pickupStationLocked = isMetroAlertFlow && !!pickupStation

  // Step 3: ML Clustering Initiation
  const runClustering = async () => {
    if (!pickupStation || destLat === null || destLng === null || !user) return

    setStep(3)
    setLoadingMsgIndex(0)
    setIsMLDown(false)

    const interval = setInterval(() => {
      setLoadingMsgIndex(prev => (prev + 1) % LOADING_MESSAGES.length)
    }, 1500)

    // Helper for timeout
    const fetchWithTimeout = (promise: Promise<any>, ms: number = 8000) => {
      return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms))
      ])
    }

    try {
      // Frontend station IDs are now synced with database UUIDs — no lookup needed
      const stationUUID = pickupStation.id
      setDbStationId(stationUUID)

      const hour = getCurrentHour()
      const day = getCurrentDayOfWeek()
      const demand = getDemandLevel(hour, day)

      const { data: rideReq, error: rideErr } = await fetchWithTimeout(
        supabase
          .from('ride_requests')
          .insert({
            user_id: user.id,
            pickup_station_id: stationUUID,
            dest_lat: destLat,
            dest_lng: destLng,
            dest_address: destAddress,
            hour,
            day_of_week: day,
            demand_level: demand,
            status: 'pending',
          })
          .select()
      )

      if (!rideErr && rideReq && rideReq.length > 0) {
        setRideRequestId(rideReq[0].id)
        setRideRequestCreatedAt(rideReq[0].created_at ?? new Date().toISOString())
      } else if (rideErr) {
        console.error('Supabase ride_request insert failed:', rideErr)
        toast.error("Failed to register ride request, but proceeding with simulation.")
      }

      await new Promise(resolve => setTimeout(resolve, 1500))

    } catch (err) {
      console.warn('Clustering flow error or timeout:', err)
      setIsMLDown(true)
      setDbStationId(prev => prev || 'offline_fallback')
    } finally {
      clearInterval(interval)
      setStep(4)
    }
  }

  // Live Waiting Room via Supabase Realtime
  useEffect(() => {
    if (step !== 4 || !user || !dbStationId || !pickupStation || !destLat || !destLng) return

    const fetchWithTimeout = (promise: Promise<any>, ms: number = 8000) => {
      return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms))
      ])
    }

    const refreshCluster = async () => {
      if (refreshInFlightRef.current) return
      refreshInFlightRef.current = true
      try {
        let pendingRequests: any[] = [];
        let confirmedRiders: any[] = [];
        
        if (dbStationId && dbStationId !== 'offline_fallback') {
          // 1. Get riders who are still pending at this station
          const { data } = await fetchWithTimeout(
            supabase
              .from('ride_requests')
              .select('user_id, dest_lat, dest_lng, created_at')
              .eq('pickup_station_id', dbStationId)
              .eq('status', 'pending')
          ).catch(() => ({ data: [] }))
          
          if (data) pendingRequests = data.filter((request: any) => isFreshMatch(request.created_at, request.expires_at));

          // 2. ALSO get riders who already confirmed into a 'forming' group at this station
          //    This prevents confirmed riders from vanishing from the cluster count.
          const { data: formingGroups } = await supabase
            .from('ride_groups')
            .select('id')
            .eq('station_id', dbStationId)
            .eq('status', 'forming')
            .order('created_at', { ascending: false })
            .limit(3)

          if (formingGroups && formingGroups.length > 0) {
            const groupIds = formingGroups.map((g: any) => g.id)
            const { data: members } = await supabase
              .from('ride_members')
              .select('user_id, ride_requests(dest_lat, dest_lng, created_at)')
              .in('group_id', groupIds)
              .eq('status', 'confirmed')

            if (members) {
              confirmedRiders = members.map((m: any) => {
                const req = m.ride_requests as any
                return {
                  user_id: m.user_id,
                  pickup_lat: pickupStation.lat,
                  pickup_lng: pickupStation.lng,
                  drop_lat: req?.dest_lat || pickupStation.lat,
                  drop_lng: req?.dest_lng || pickupStation.lng,
                  created_at: req?.created_at,
                }
              })
            }
          }
        }

        // Merge pending + confirmed riders, dedup by user_id
        const seenIds = new Set<string>()
        let allRiders: any[] = []
        
        for (const r of [...pendingRequests, ...confirmedRiders]) {
          if (!seenIds.has(r.user_id)) {
            seenIds.add(r.user_id)
            allRiders.push({
              user_id: r.user_id,
              pickup_lat: pickupStation.lat,
              pickup_lng: pickupStation.lng,
              drop_lat: r.dest_lat ?? r.drop_lat,
              drop_lng: r.dest_lng ?? r.drop_lng,
              created_at: r.created_at,
              expires_at: r.expires_at,
            })
          }
        }

        // Always include the current user
        if (!seenIds.has(user.id)) {
          allRiders.push({
            user_id: user.id,
            pickup_lat: pickupStation.lat,
            pickup_lng: pickupStation.lng,
            drop_lat: destLat,
            drop_lng: destLng,
            created_at: rideRequestCreatedAt,
          })
        }

        const ridersFingerprint = allRiders
          .map((r: any) => `${r.user_id}:${Math.round((r.drop_lat ?? 0) * 10000)}:${Math.round((r.drop_lng ?? 0) * 10000)}`)
          .sort()
          .join('|')

        // Skip heavy ML calls when the rider set has not changed.
        if (lastRidersFingerprintRef.current === ridersFingerprint) {
          return
        }
        lastRidersFingerprintRef.current = ridersFingerprint

        console.log('--- DEBUG CLUSTER ---')
        console.log('Pending requests:', pendingRequests.length, 'Confirmed in groups:', confirmedRiders.length)
        console.log('All unique riders sent to ML:', allRiders.length, allRiders)

        let clusters: any[] | null = null
        let myCluster: any = null

        {
          const clusterResponse = await ML_API.clusterRidersV2(allRiders, 12000)
          if (clusterResponse.error || !clusterResponse.data) {
            console.error('ML v2 cluster failed:', clusterResponse.error, clusterResponse.metadata)
            setIsMLDown(true)
            throw new Error(`ML cluster unavailable: ${clusterResponse.error?.message || 'Unknown error'}`)
          }
          clusters = clusterResponse.data
          setIsMLDown(false)
        }

        console.log('ML API Response clusters:', clusters)
        
        if (clusters && Array.isArray(clusters)) {
          myCluster = clusters.find((c: any) => c.rider_ids?.includes(user.id)) || null
          if (!myCluster && clusters.length > 0) myCluster = clusters[0]
        }

        if (!myCluster) {
          throw new Error('Failed to assign rider to cluster in v2 mode')
        }

        console.log('My Assigned Cluster:', myCluster)
        setClusterResult(myCluster)

        if (myCluster?.rider_ids) {
          const { data: _users, error: uErr } = await supabase
            .from('users')
            .select('id, name')
            .in('id', myCluster.rider_ids)
          
          if (uErr) console.warn('User names fetch error:', uErr)
          
          if (_users) {
            const names = _users
              .filter((u: any) => u.id !== user.id)
              .map((u: any) => u.name || 'Anonymous Rider')
            setMemberNames(names)
            console.log('AUTO-MATCH: Found names for cluster:', names)
          }
        }

        const hour = getCurrentHour()
        const day = getCurrentDayOfWeek()
        const demand = getDemandLevel(hour, day)
        const distanceMeters = haversineDistance(pickupStation.lat, pickupStation.lng, destLat, destLng)
        const distanceKm = distanceMeters / 1000
        
        let fareRaw: any = null

        {
          const fareResponse = await ML_API.predictFareV2(distanceKm, myCluster.cluster_size || 1, hour, day, demand, 12000)
          if (fareResponse.error || !fareResponse.data) {
            console.error('ML v2 fare failed:', fareResponse.error, fareResponse.metadata)
            throw new Error(`ML fare prediction unavailable: ${fareResponse.error?.message || 'Unknown error'}`)
          }
          fareRaw = {
            shared_fare: fareResponse.data.adjusted_fare.shared_fare,
            solo_fare: fareResponse.data.adjusted_fare.solo_fare,
            savings_pct: fareResponse.data.adjusted_fare.discount_pct,
            distance_impact_pct: fareResponse.data.explanation.factors.distance_impact_pct,
            time_surge_pct: fareResponse.data.explanation.factors.demand_surge_pct,
          }
        }

        // Set final fare from v2 contract only.
        if (fareRaw?.shared_fare && fareRaw?.solo_fare && fareRaw.shared_fare <= fareRaw.solo_fare) {
          const mlShared = Math.round(fareRaw.shared_fare)
          const mlSavings = Math.round((1 - mlShared / fareRaw.solo_fare) * 100)
          setFareResult({
            shared_fare: mlShared,
            solo_fare: fareRaw.solo_fare,
            savings_pct: mlSavings,
            explanation: {
              distance_impact_pct: fareRaw.distance_impact_pct ?? 60,
              sharing_discount_pct: mlSavings,
              time_surge_pct: fareRaw.time_surge_pct ?? 10,
              human_readable: `Your fare of ₹${mlShared} is based on your ${distanceKm.toFixed(1)}km trip, shared among ${myCluster.cluster_size} riders. You save ${mlSavings}% vs solo (₹${Math.round(fareRaw.solo_fare)})!`,
            },
          })
        } else {
          throw new Error('ML returned invalid fare prediction (shared > solo or missing fields)')
        }
      } catch (err) {
        console.error('Error in live waiting room lookup:', err)
      } finally {
        refreshInFlightRef.current = false
      }
    }

    // Debounce to prevent overlapping ML requests
    let lastRefreshTime = 0
    let pendingRefresh: NodeJS.Timeout | null = null

    const debouncedRefresh = () => {
      const now = Date.now()
      const timeSinceLastRefresh = now - lastRefreshTime
      
      if (timeSinceLastRefresh < 2000) {
        // Too soon, schedule for later
        if (pendingRefresh) clearTimeout(pendingRefresh)
        pendingRefresh = setTimeout(() => {
          lastRefreshTime = Date.now()
          refreshCluster()
        }, 2000 - timeSinceLastRefresh)
      } else {
        // Safe to refresh now
        lastRefreshTime = now
        refreshCluster()
      }
    }

    // Initial load
    debouncedRefresh()

    // Poll every 12 seconds as a safety net (realtime may miss events)
    const pollInterval = setInterval(() => {
      debouncedRefresh()
    }, 12000)

    // Real-time subscription (instant updates when another rider joins)
    let channel: any = null;
    if (dbStationId !== 'offline_fallback') {
      channel = supabase
        .channel(`waiting_room_${dbStationId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'ride_requests', filter: `pickup_station_id=eq.${dbStationId}` },
          () => {
            debouncedRefresh()
          }
        )
        .subscribe()
    }

    return () => {
      clearInterval(pollInterval)
      if (pendingRefresh) clearTimeout(pendingRefresh)
      if (channel) supabase.removeChannel(channel)
    }
  }, [step, user, dbStationId, pickupStation, destLat, destLng])

  const confirmInitiated = React.useRef(false)
  // Step 5: Confirm

  const handleConfirm = async () => {
    if (!clusterResult || !fareResult || !user || confirmInitiated.current) return

    if (rideRequestCreatedAt && !isFreshMatch(rideRequestCreatedAt, null)) {
      toast.error('Matching window expired. Please request again.')
      if (rideRequestId) {
        await supabase
          .from('ride_requests')
          .update({ status: 'expired' })
          .eq('id', rideRequestId)
      }
      setStep(1)
      return
    }

    confirmInitiated.current = true
    setIsConfirming(true)
    try {
      const confirmTimeoutMs = 15000
      const rpcArgs = {
        p_rider_id: user.id,
        p_ride_request_id: rideRequestId,
        p_ml_version: mlVersion,
        p_cluster_id: clusterResult.cluster_id,
        p_fare_amount: fareResult.shared_fare || 0, // Pass the shared fare
      }

      const confirmPromise = supabase.rpc('confirm_ride', rpcArgs)
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Confirmation timed out')), confirmTimeoutMs)
      })

      let finalGroupId: string | null = null
      let rpcErr: any = null

      try {
        const response = await Promise.race([
          confirmPromise,
          timeoutPromise,
        ]) as any
        finalGroupId = response?.data ?? null
        rpcErr = response?.error ?? null
      } catch (primaryErr: any) {
        throw primaryErr
      }

      if (rpcErr) throw rpcErr
      if (!finalGroupId) throw new Error('confirm_ride returned no group id')

      // Create fare_transaction record and update ride_members fare_share
      if (fareResult?.shared_fare && user.id) {
        const { error: fareErr } = await supabase
          .from('fare_transactions')
          .insert({
            group_id: finalGroupId,
            user_id: user.id,
            amount: fareResult.shared_fare,
            status: 'pending'
          })
        if (fareErr) console.warn('Fare transaction creation warning:', fareErr)

        // Update ride_members with correct fare_share
        const { error: memberErr } = await supabase
          .from('ride_members')
          .update({
            fare_share: fareResult.shared_fare,
            solo_fare: fareResult.solo_fare,
            savings_pct: fareResult.savings_pct
          })
          .eq('group_id', finalGroupId)
          .eq('user_id', user.id)
        if (memberErr) console.warn('Ride member update warning:', memberErr)
      }

      // Mark this user's ride request as matched (RPC already does this, but being explicit)
      if (rideRequestId) {
        await supabase
          .from('ride_requests')
          .update({ status: 'matched' })
          .eq('id', rideRequestId)
      }

      if (rideRequestId) {
        void supabase.from('handoff_events').insert({
          event_type: 'last_mile_confirmed',
          user_id: user.id,
          ticket_id: ticketParam || null,
          ride_request_id: rideRequestId,
          station_id: pickupStationId,
          details: {
            source: source || 'manual',
            cluster_id: clusterResult.cluster_id,
            fare: fareResult.shared_fare,
          },
        })
      }

      toast.success('🎉 Ride confirmed!')
      router.push(`/rider/tracking/${finalGroupId}?requestId=${rideRequestId}`)
    } catch (err: any) {
      console.warn('Confirmation error:', err)
      toast.error('Failed to confirm ride. Please try again.')
    } finally {
      setIsConfirming(false)
      confirmInitiated.current = false
    }
  }

  // Auto-confirm REMOVED — caused race conditions where one rider confirming
  // would mark their request as 'matched', shrinking the cluster for others.
  // Riders now manually click "Join this Group" which directly confirms.

  const progressPct = (step / 5) * 100

  return (
    <div className="min-h-screen bg-slate-50 pb-24 font-sans">
      {/* Header */}
      <div className="bg-white border-b px-4 py-4 flex items-center sticky top-0 z-20 shadow-sm">
        <button
          onClick={() => (step > 1 && step < 5 ? setStep(step - 1) : router.back())}
          className="p-2 -ml-2 rounded-full hover:bg-slate-100 mr-2"
        >
          <ArrowLeft className="w-5 h-5 text-slate-700" />
        </button>
        <h1 className="text-xl font-bold bg-clip-text text-transparent bg-linear-to-r from-blue-600 to-indigo-600">
          Request Ride
        </h1>
        <span className="ml-auto text-sm text-slate-400 font-medium">Step {step}/5</span>
      </div>

      {/* Progress Bar */}
      <div className="h-1 bg-slate-200">
        <motion.div
          className="h-full bg-linear-to-r from-blue-500 to-indigo-500"
          animate={{ width: `${progressPct}%` }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        />
      </div>

      {/* ML Down Banner */}
      {isMLDown && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 text-center">
          <p className="text-sm text-amber-700 font-medium">
            ⚡ ML service down — using offline estimates
          </p>
        </div>
      )}

      <div className="p-4 max-w-lg mx-auto">
        <AnimatePresence mode="wait">
          {/* STEP 1: Pick Pickup Station */}
          {step === 1 && (
            <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <Card className="shadow-md border-slate-200/60 mb-6">
                <div className="bg-slate-50 border-b p-4 pb-3">
                  <div className="flex items-center text-slate-500 mb-1">
                    <MapPin className="w-4 h-4 mr-2" />
                    <span className="text-sm font-medium uppercase tracking-wider">Pickup Station</span>
                  </div>
                </div>
                <CardContent className="p-5">
                  {pickupStationLocked && pickupStation ? (
                    <div className="rounded-xl border border-teal-100 bg-teal-50 p-4">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-teal-700">Pickup locked from metro alert</p>
                      <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-teal-700 p-2">
                          <MapPin className="h-4 w-4 text-white" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">{pickupStation.name}</p>
                          <p className="text-xs text-teal-700">{pickupStation.line}</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <select
                      className="w-full rounded-xl border bg-slate-50 p-3 outline-none transition-all focus:ring-2 focus:ring-blue-500 focus:border-teal-600"
                      value={pickupStationId}
                      onChange={(e) => setPickupStationId(e.target.value)}
                    >
                      <option value="">Select pickup station...</option>
                      {MUMBAI_METRO_STATIONS.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.line})
                        </option>
                      ))}
                    </select>
                  )}

                  {pickupStation && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-4">
                      <div className="bg-teal-50 rounded-xl p-3 flex items-center space-x-3 border border-teal-100">
                        <div className="bg-teal-700 p-2 rounded-lg">
                          <MapPin className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <p className="font-semibold text-blue-900">{pickupStation.name}</p>
                          <p className="text-xs text-teal-700">{pickupStation.line}</p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </CardContent>
              </Card>

              <Button
                className="w-full text-lg h-14 rounded-xl shadow-lg bg-teal-700 hover:bg-blue-700"
                disabled={!pickupStationId}
                onClick={() => setStep(2)}
              >
                {pickupStationLocked ? 'Continue to Last-Mile Booking' : 'Continue'}
              </Button>
            </motion.div>
          )}

          {/* STEP 2: Pick Destination */}
          {step === 2 && pickupStation && (
            <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <Card className="shadow-md border-slate-200/60 mb-4">
                <div className="bg-slate-50 border-b p-4 pb-3">
                  <div className="flex items-center text-slate-500 mb-1">
                    <Navigation className="w-4 h-4 mr-2" />
                    <span className="text-sm font-medium uppercase tracking-wider">Where are you going?</span>
                  </div>
                </div>
                <CardContent className="p-4">
                  <RideRequestMap
                    pickupStation={pickupStation}
                    destLat={destLat}
                    destLng={destLng}
                    onDestinationSet={handleDestinationSet}
                  />

                  {destAddress && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3">
                      <div className="bg-red-50 rounded-xl p-3 border border-red-100">
                        <p className="text-xs text-red-500 uppercase font-semibold mb-1">Destination</p>
                        <p className="text-sm font-medium text-red-900 line-clamp-2">{destAddress}</p>
                      </div>
                    </motion.div>
                  )}
                </CardContent>
              </Card>

              <Button
                className="w-full text-lg h-14 rounded-xl shadow-lg bg-teal-700 hover:bg-blue-700"
                disabled={!destLat || !destLng}
                onClick={runClustering}
              >
                Continue
              </Button>
            </motion.div>
          )}

          {/* STEP 3: Loading */}
          {step === 3 && (
            <motion.div key="step3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center py-20">
              <div className="relative">
                <div className="w-20 h-20 rounded-full border-4 border-teal-100 flex items-center justify-center">
                  <Loader2 className="w-10 h-10 text-teal-700 animate-spin" />
                </div>
                <div className="absolute -inset-3 rounded-full border-2 border-blue-200 animate-ping opacity-20" />
              </div>
              <AnimatePresence mode="wait">
                <motion.p
                  key={loadingMsgIndex}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mt-8 text-lg font-semibold text-slate-700"
                >
                  {LOADING_MESSAGES[loadingMsgIndex]}
                </motion.p>
              </AnimatePresence>
              <p className="text-sm text-slate-400 mt-2">This usually takes a few seconds</p>
            </motion.div>
          )}

          {/* STEP 4: Group Preview */}
          {step === 4 && clusterResult && fareResult && pickupStation && (
            <motion.div key="step4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
              <GroupPreviewCard
                clusterResult={clusterResult}
                fareResult={fareResult}
                station={pickupStation}
                memberNames={memberNames}
              />

              <FareBreakdownAccordion fareResult={fareResult} />

              <Button
                className="w-full text-lg h-14 rounded-xl shadow-lg bg-green-600 hover:bg-green-700"
                disabled={isConfirming}
                onClick={handleConfirm}
              >
                {isConfirming ? (
                  <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Confirming...</>
                ) : (
                  'Join & Confirm Ride'
                )}
              </Button>

              <button
                className="w-full text-center text-sm text-teal-700 hover:text-blue-800 font-medium py-2"
                onClick={runClustering}
              >
                Find a different group
              </button>
            </motion.div>
          )}

          {/* STEP 5: Confirm */}
          {step === 5 && clusterResult && fareResult && pickupStation && (
            <motion.div key="step5" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6">
              <Card className="shadow-lg border-green-200/60 overflow-hidden">
                <div className="bg-linear-to-r from-green-500 to-emerald-600 p-6 text-white text-center">
                  <CheckCircle2 className="w-12 h-12 mx-auto mb-3 opacity-90" />
                  <h2 className="text-2xl font-bold">Confirm Your Ride</h2>
                  <p className="text-green-100 mt-1 text-sm">Review and lock in your shared ride</p>
                </div>
                <CardContent className="p-5 space-y-4">
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-slate-500">Pickup</span>
                    <span className="font-semibold text-slate-800">{pickupStation.name}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-slate-500">Destination</span>
                    <span className="font-semibold text-slate-800 text-right max-w-50 truncate">{destAddress}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-slate-500">Group size</span>
                    <span className="font-semibold text-slate-800">{clusterResult.cluster_size} riders</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-slate-500">Your fare</span>
                    <span className="text-xl font-bold text-green-700">{formatCurrency(fareResult.shared_fare)}</span>
                  </div>
                </CardContent>
              </Card>

              <Button
                className="w-full text-lg h-14 rounded-xl shadow-lg bg-green-600 hover:bg-green-700"
                disabled={isConfirming}
                onClick={handleConfirm}
              >
                {isConfirming ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" /> Confirming...
                  </span>
                ) : (
                  'Confirm & Join Ride'
                )}
              </Button>

              <button
                className="w-full text-center text-sm text-slate-500 hover:text-slate-700 font-medium py-2"
                onClick={() => setStep(4)}
              >
                ← Back to group preview
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

export default function RequestRidePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-teal-700 animate-spin" />
      </div>
    }>
      <RequestRideContent />
    </Suspense>
  )
}
