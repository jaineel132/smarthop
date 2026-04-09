'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { ML_API } from '@/lib/ml-api'
import { MUMBAI_METRO_STATIONS } from '@/lib/stations'
import { RideGroup, DriverLocation, MetroStation, Waypoint } from '@/types'
import { toast } from 'sonner'
import { haversineDistance } from '@/lib/utils'
import { 
  Bell, 
  MapPin, 
  Power, 
  Route, 
  DollarSign, 
  Star, 
  User as UserIcon,
  LayoutDashboard,
  Wifi,
  WifiOff,
  LogOut
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import RideRequestCard from '@/components/driver/RideRequestCard'
import { AnimatePresence } from 'framer-motion'
import { requestPermission, sendNotification } from '@/lib/notifications'

const DashboardMap = dynamic(() => import('@/components/maps/DashboardMap'), { ssr: false })

const MATCH_TIMEOUT_MS = 3 * 60 * 1000

export default function DriverDashboard() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [isOnline, setIsOnline] = useState(false)
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null)
  const [dbStations, setDbStations] = useState<{id: string, name: string}[]>([])
  const [activeRequest, setActiveRequest] = useState<RideGroup | null>(null)
  const [stats, setStats] = useState({ rides: 0, earned: 0, rating: 4.8 })
  const [loading, setLoading] = useState(true)
  const [isAccepting, setIsAccepting] = useState(false)

  // Track declined rides in state with localStorage persistence
  const [declinedRideIds, setDeclinedRideIds] = useState<Set<string>>(new Set())
  // Keep a ref for current declined rides to use in callbacks without causing re-renders
  const declinedRidesRef = React.useRef<Set<string>>(new Set())

  const [supabase] = useState(() => createSupabaseBrowserClient())

  // Load declined rides from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('declined_rides')
      if (saved) {
        const decoded = new Set<string>(JSON.parse(saved) as string[])
        setDeclinedRideIds(decoded)
        declinedRidesRef.current = decoded
        console.log('[Driver Dashboard] Loaded', decoded.size, 'declined rides from storage')
      }
    } catch (err) {
      console.error('Failed to load declined rides:', err)
    }
  }, [])

  // Update both state and ref whenever declined rides change
  useEffect(() => {
    try {
      declinedRidesRef.current = declinedRideIds
      localStorage.setItem('declined_rides', JSON.stringify(Array.from(declinedRideIds)))
    } catch (err) {
      console.error('Failed to save declined rides:', err)
    }
  }, [declinedRideIds])

  // Clear declined rides when driver goes offline
  useEffect(() => {
    if (!isOnline) {
      setDeclinedRideIds(new Set())
      declinedRidesRef.current = new Set()
      localStorage.removeItem('declined_rides')
      console.log('[Driver Dashboard] Cleared declined rides (driver offline)')
    }
  }, [isOnline])

  const selectedStation = useMemo(() => {
    const dbStn = dbStations.find(db => db.id === selectedStationId)
    if (!dbStn) return null
    return MUMBAI_METRO_STATIONS.find(s => s.name === dbStn.name) || null
  }, [selectedStationId, dbStations])

  const isFreshFormingGroup = useCallback((group: RideGroup) => {
    const createdAtMs = group?.created_at ? new Date(group.created_at).getTime() : 0
    const expiresAtMs = group?.expires_at ? new Date(group.expires_at).getTime() : createdAtMs + MATCH_TIMEOUT_MS
    return Number.isFinite(expiresAtMs) && expiresAtMs > Date.now()
  }, [])

  const fetchDriverData = useCallback(async () => {
    if (!user) return

    try {
      // 1. Fetch online status and station
      const { data: locData } = await supabase
        .from('driver_locations')
        .select('*')
        .eq('driver_id', user.id)
        .single()

      if (locData) {
        setIsOnline(locData.is_online)
        setSelectedStationId(locData.current_station_id)
      }

      // Fetch DB stations mapping
      const { data: dbStns } = await supabase.from('metro_stations').select('id, name')
      if (dbStns) setDbStations(dbStns)

      // 2. Fetch today's stats
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const { count: ridesCount } = await supabase
        .from('ride_groups')
        .select('*', { count: 'exact', head: true })
        .eq('driver_id', user.id)
        .eq('status', 'completed')
        .gte('created_at', today.toISOString())

      // Fetch TODAY'S completed ride groups for this driver
      const { data: driverRideGroups } = await supabase
        .from('ride_groups')
        .select('id')
        .eq('driver_id', user.id)
        .eq('status', 'completed')
        .gte('created_at', today.toISOString())

      const driverGroupIds = driverRideGroups?.map((g: any) => g.id) || []

      // Fetch fare_transactions only for this driver's rides (include pending to show recent earnings)
      const { data: transactions } = driverGroupIds.length > 0 ? await supabase
        .from('fare_transactions')
        .select('amount')
        .in('group_id', driverGroupIds)
        .in('status', ['paid', 'pending']) : { data: [] }
      
      const earnedToday = transactions?.reduce((acc: number, curr: any) => acc + Number(curr.amount), 0) || 0

      console.log('[Dashboard Stats] Driver:', user.id, 'Rides today:', ridesCount, 'Groups:', driverGroupIds.length, 'Transactions:', transactions?.length, 'Earned:', earnedToday)

      const { data: userProfile } = await supabase
        .from('users')
        .select('driver_rating')
        .eq('id', user.id)
        .single()

      setStats({
        rides: ridesCount || 0,
        earned: earnedToday,
        rating: userProfile?.driver_rating || 4.8
      })
    } catch (error) {
      console.error('Error fetching driver data:', error)
    } finally {
      setLoading(false)
    }
  }, [user, supabase])
  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.replace('/auth/login')
        return
      }
      fetchDriverData()
    }
  }, [user, authLoading, fetchDriverData, router])

  // Subscribe to real-time stats updates when rides complete
  useEffect(() => {
    if (!user) return

    const rideGroupsChannel = supabase
      .channel(`driver_completed_rides_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'ride_groups',
          filter: `driver_id=eq.${user.id}`
        },
        (payload) => {
          console.log('[Driver Dashboard] ride_groups UPDATE event:', payload)
          // Refetch stats when a ride status changes (e.g., to completed)
          fetchDriverData()
        }
      )
      .subscribe()

    const fareTransactionsChannel = supabase
      .channel(`driver_fare_updates_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'fare_transactions'
        },
        (payload) => {
          console.log('[Driver Dashboard] fare_transactions INSERT event:', payload)
          // Refetch stats when new transaction is created
          fetchDriverData()
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'fare_transactions'
        },
        (payload) => {
          console.log('[Driver Dashboard] fare_transactions UPDATE event:', payload)
          // Refetch stats when transactions are marked as paid
          if (payload.new?.status === 'paid') {
            fetchDriverData()
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(rideGroupsChannel)
      supabase.removeChannel(fareTransactionsChannel)
    }
  }, [user, supabase, fetchDriverData])

  // Fetch existing forming groups when driver goes online or changes station
  const fetchFormingGroups = useCallback(async () => {
    if (!selectedStationId || !isOnline) return
    const recentIso = new Date(Date.now() - MATCH_TIMEOUT_MS).toISOString()

    const { data: formingGroups } = await supabase
      .from('ride_groups')
      .select('*')
      .eq('station_id', selectedStationId)
      .eq('status', 'forming')
      .is('driver_id', null)
      .gte('created_at', recentIso)
      .order('created_at', { ascending: false })
      .limit(10) // Fetch more to find one not declined

    if (formingGroups && formingGroups.length > 0) {
      // Find the first group that hasn't been declined
      const group = formingGroups.find((g: RideGroup) => !declinedRidesRef.current.has(g.id) && isFreshFormingGroup(g)) as RideGroup | undefined
      
      if (group) {
        setActiveRequest(group)
        
        // Trigger notification if this is a new group (not already notified)
        const now = Date.now()
        if (lastNotifiedGroupId.current !== group.id && (now - lastNotificationTime.current > 5000)) {
          console.log('[Driver Dashboard] Polling found new forming group:', group.id)
          lastNotifiedGroupId.current = group.id
          lastNotificationTime.current = now
          
          sendNotification(
            "New Ride Request!",
            `Cluster at your station. Fare: ₹${Number(group.fare_total ?? 0).toFixed(0)}`,
            () => {
              window.focus()
            }
          )
        }
      } else {
        // All available rides have been declined
        setActiveRequest(null)
      }
    }
  }, [selectedStationId, isOnline, supabase, isFreshFormingGroup])

  useEffect(() => {
    if (isOnline && selectedStationId) {
      fetchFormingGroups()
    }
  }, [isOnline, selectedStationId, fetchFormingGroups])

  useEffect(() => {
    requestPermission()
  }, [])

  const lastNotifiedGroupId = React.useRef<string | null>(null);
  const lastNotificationTime = React.useRef<number>(0);

  // Realtime subscription for NEW and UPDATED ride requests
  useEffect(() => {
    if (!user || !isOnline || !selectedStationId) {
      console.log('[Driver Dashboard] Subscription dependencies not ready:', { user: !!user, isOnline, selectedStationId })
      return
    }

    console.log('[Driver Dashboard] Starting Realtime subscription for station:', selectedStationId)

    const channel = supabase
      .channel(`ride_groups_${selectedStationId}`, { config: { broadcast: { self: true } } })
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ride_groups',
          filter: `station_id=eq.${selectedStationId}`
        },
        async (payload: any) => {
          console.log('[Driver Dashboard] New ride group INSERT event:', payload)
          const newGroup = payload.new as RideGroup
          
          // Skip if this ride has been declined
          if (declinedRidesRef.current.has(newGroup.id)) {
            console.log('[Driver Dashboard] Skipping declined ride:', newGroup.id)
            return
          }
          
          const isRecent = isFreshFormingGroup(newGroup)

          if (!newGroup.driver_id && newGroup.status === 'forming' && isRecent) {
            console.log('[Driver Dashboard] Matching unassigned forming group:', newGroup.id)
            setActiveRequest(newGroup)
            
            // Prevent spamming notifications
            const now = Date.now();
            if (lastNotifiedGroupId.current === newGroup.id && (now - lastNotificationTime.current < 5000)) {
              return;
            }

            lastNotifiedGroupId.current = newGroup.id;
            lastNotificationTime.current = now;

            sendNotification(
              "New Ride Request!",
              `Cluster at your station. Fare: ₹${Number(newGroup.fare_total ?? 0).toFixed(0)}`,
              () => {
                window.focus()
              }
            )
          } else if (!isRecent) {
            console.log('[Driver Dashboard] Ignoring stale ride group:', newGroup.id)
          }
        }
      )
      .subscribe((status) => {
        console.log('[Driver Dashboard] Realtime subscription status:', status)
        if (status === 'SUBSCRIBED') {
          console.log('[Driver Dashboard] ✓ Successfully subscribed to ride_groups changes')
        }
      })

    return () => {
      console.log('[Driver Dashboard] Cleaning up Realtime subscription')
      supabase.removeChannel(channel)
    }
  }, [user, isOnline, selectedStationId, supabase, isFreshFormingGroup])

  // Polling fallback in case Realtime misses events
  useEffect(() => {
    if (!isOnline || !selectedStationId) return

    console.log('[Driver Dashboard] Starting polling fallback every 3 seconds')
    const pollInterval = setInterval(() => {
      fetchFormingGroups()
    }, 3000)

    return () => {
      clearInterval(pollInterval)
    }
  }, [isOnline, selectedStationId, fetchFormingGroups])

  const toggleOnline = async (online: boolean) => {
    if (!user) return
    setIsOnline(online)

    const { error } = await supabase
      .from('driver_locations')
      .upsert({
        driver_id: user.id,
        is_online: online,
        updated_at: new Date().toISOString()
      }, { onConflict: 'driver_id' })

    if (error) {
      toast.error('Failed to update status')
      setIsOnline(!online)
    } else {
      toast.success(online ? "You are now online" : "You are now offline")
    }
  }

  const handleStationChange = async (stationId: string) => {
    if (!user) return
    setSelectedStationId(stationId)

    const { error } = await supabase
      .from('driver_locations')
      .update({ current_station_id: stationId })
      .eq('driver_id', user.id)

    if (error) {
      toast.error('Failed to update station')
    } else {
      const dbStn = dbStations.find(db => db.id === stationId)
      const staticStation = MUMBAI_METRO_STATIONS.find(s => s.name === dbStn?.name)
      toast.success(`Active at ${staticStation?.name || 'Selected Station'}`)
    }
  }

  const handleAccept = async () => {
    if (!activeRequest || !user || isAccepting) return
    if (!isFreshFormingGroup(activeRequest)) {
      toast.info('This request expired before it could be accepted.')
      setActiveRequest(null)
      return
    }
    setIsAccepting(true)

    try {
      let claimHeld = false
      const ACCEPT_STEP_TIMEOUT_MS = 8000

      const resetClaim = async () => {
        if (!claimHeld) return

        const { error: releaseError } = await supabase
          .from('ride_groups')
          .update({ driver_id: null, updated_at: new Date().toISOString() })
          .eq('id', activeRequest.id)
          .eq('driver_id', user.id)
          .eq('status', 'forming')

        if (releaseError) {
          console.error('Failed to release claimed group after accept failure:', releaseError)
        }
      }

      const withStepTimeout = async <T,>(label: string, run: () => Promise<T>, timeoutMs: number = ACCEPT_STEP_TIMEOUT_MS): Promise<T> => {
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs)
        })

        try {
          return await Promise.race([run(), timeoutPromise])
        } catch (err) {
          await resetClaim()
          claimHeld = false
          throw err
        }
      }

      toast.info('Step 1: Claiming ride group...')
      
      // 1. Claim the ride group (ensures only one driver gets it)
      const { data: claimedRows, error: claimError } = await supabase
        .from('ride_groups')
        .update({ driver_id: user.id, updated_at: new Date().toISOString() })
        .eq('id', activeRequest.id)
        .eq('status', 'forming')
        .is('driver_id', null)
        .select('id')

      if (claimError) throw new Error(`Claim failed: ${claimError.message}`)
      if (!claimedRows || claimedRows.length === 0) {
        throw new Error('This ride was already claimed by another driver.')
      }
      claimHeld = true
      
      // 2. Fetch driver's vehicle type
      const { data: driverProfile } = await supabase
        .from('users')
        .select('vehicle_type')
        .eq('id', user.id)
        .single()
      
      // 3. Get all confirmed riders in this group
      const members = await withStepTimeout('Fetching ride members', async () => {
        const { data, error: memErr } = await supabase
          .from('ride_members')
          .select('id, request_id, user_id, ride_requests(*)')
          .eq('group_id', activeRequest.id)

        if (memErr || !data) throw new Error(memErr?.message || 'Could not fetch ride members')
        return data
      })

      // 4. Build waypoints for ML optimization
      const stationDb = dbStations.find(s => s.id === activeRequest.station_id)
      const station = MUMBAI_METRO_STATIONS.find(s => s.name === stationDb?.name)
      const startLat = station?.lat || 19.076
      const startLng = station?.lng || 72.8777

      let waypoints: Waypoint[] = [
        {
          lat: startLat,
          lng: startLng,
          label: 'Pickup',
          user_id: 'pickup_station',
          address: station?.name || 'Pickup Station',
          completed: false
        },
        ...members.map((m: any) => {
          const r = m.ride_requests as any
          return {
            lat: r.dest_lat,
            lng: r.dest_lng,
            label: 'Drop Point',
            user_id: r.user_id || '',
            member_id: m.id,
            request_id: m.request_id,
            address: r.dest_address || 'Drop Point',
            completed: false
          }
        })
      ]

      if (waypoints.length === 0) {
        waypoints = [{ lat: 19.12, lng: 72.85, label: 'Destination', user_id: '', address: 'Destination', completed: false }]
      }

      // 5. Optimize Route with ML
      toast.info('Step 2: Optimizing Route...')
      
      let optimizedWaypoints = waypoints
      let totalDistance = activeRequest.distance_km || 5
      let totalDuration = activeRequest.duration_min || 15
      let optimizedOrder = waypoints.map((_, i) => i)

      const routeV2 = await ML_API.optimizeRouteV2(waypoints, startLat, startLng, 12000)
      if (routeV2.error || !routeV2.data) {
        // Route optimization is best-effort; fallback preserves acceptance flow.
        console.warn('ML v2 route optimization failed, using fallback order:', routeV2.error, routeV2.metadata)
      } else {
        optimizedWaypoints = routeV2.data.waypoints
        totalDistance = routeV2.data.total_distance_km
        totalDuration = routeV2.data.total_duration_min
        optimizedOrder = routeV2.data.optimized_order
      }

      // 6. Finalize in DB
      toast.info('Step 3: Finalizing details...')
      await withStepTimeout('Saving route details', async () => {
        const { error: routeInsertError } = await supabase
          .from('routes')
          .upsert({
            group_id: activeRequest.id,
            waypoints: optimizedWaypoints,
            total_distance_km: totalDistance,
            total_duration_min: Math.round(totalDuration),
            optimized_order: optimizedOrder,
          }, { onConflict: 'group_id' })

        if (routeInsertError) {
          console.error('Route upsert error:', routeInsertError)
          throw new Error(`Failed to save route: ${routeInsertError.message}`)
        }
      })

      await withStepTimeout('Updating group status', async () => {
        const { data: statusRows, error: statusErr } = await supabase
          .from('ride_groups')
          .update({ 
            status: 'accepted',
            distance_km: totalDistance,
            duration_min: Math.round(totalDuration),
            updated_at: new Date().toISOString(),
          })
          .eq('id', activeRequest.id)
          .eq('driver_id', user.id)
          .select('id')

        if (statusErr) throw new Error(`Failed to update group status: ${statusErr.message}`)
        if (!statusRows || statusRows.length === 0) {
          throw new Error('Group status update was not applied.')
        }
      })

      claimHeld = false

      await withStepTimeout('Recalculating fares', async () => {
        const { error: fareError } = await supabase.rpc('recalculate_group_fares', { p_group_id: activeRequest.id })
        if (fareError) throw new Error(`Fare recalculation failed: ${fareError.message}`)
      })

      toast.success('Ride Accepted! Redirecting...')
      
      setTimeout(() => {
        router.push(`/driver/route/${activeRequest.id}`)
      }, 800)

    } catch (error: any) {
      console.error('Acceptance error:', error)
      toast.error(`Acceptance failed: ${error.message || 'Unknown error'}`)
      setActiveRequest(null)
    } finally {
      setIsAccepting(false)
    }
  }

  const handleDecline = () => {
    if (activeRequest?.id) {
      const newDeclined = new Set(declinedRideIds)
      newDeclined.add(activeRequest.id)
      setDeclinedRideIds(newDeclined)
      console.log('[Driver Dashboard] Declined ride:', activeRequest.id, 'Total declined:', newDeclined.size)
    }
    setActiveRequest(null)
    toast.info('Request declined')
    
    // Refetch to get the next available ride
    setTimeout(() => {
      fetchFormingGroups()
    }, 300)
  }

  if (loading || authLoading) {
    return (
      <div className="p-4 space-y-6">
        <Skeleton className="h-12 w-full rounded-lg" />
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20 font-outfit">
      {/* Top Navbar */}
      <header className="bg-white border-b border-slate-200 px-4 py-4 sticky top-0 z-40">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 border border-slate-100">
              <AvatarImage src={user?.user_metadata?.avatar_url} />
              <AvatarFallback className="bg-teal-50 text-teal-700">
                <UserIcon className="h-5 w-5" />
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-sm font-bold text-slate-900 leading-none">SmartHop Driver</h1>
              <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-slate-300'}`} />
                {user?.user_metadata?.full_name || 'Driver'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost"
              size="sm"
              className="text-slate-500 hover:text-red-500 hover:bg-red-50 transition-colors"
              onClick={() => {
                supabase.auth.signOut().then(() => { 
                  router.push('/'); 
                  router.refresh(); 
                })
              }}
              title="Sign Out"
            >
              <LogOut size={18} className="mr-2" />
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="p-4 max-w-2xl mx-auto space-y-6">
        {/* Online Toggle */}
        <Card className="border-none shadow-sm overflow-hidden">
          <div className={`h-1.5 w-full ${isOnline ? 'bg-green-500' : 'bg-slate-300'}`} />
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="online-toggle" className="text-lg font-bold text-slate-900">
                  {isOnline ? 'Online' : 'Offline'}
                </Label>
                <div className="mt-4 flex gap-2">
                  <Button 
                    className={`flex-1 h-12 rounded-xl font-bold text-lg shadow-md transition-all duration-300 ${
                      isOnline 
                        ? 'bg-red-500 hover:bg-red-600 shadow-red-100' 
                        : 'bg-green-600 hover:bg-green-700 shadow-green-100'
                    }`}
                    onClick={() => toggleOnline(!isOnline)}
                  >
                    {isOnline ? (
                      <><WifiOff className="mr-2 h-5 w-5" /> Go Offline</>
                    ) : (
                      <><Wifi className="mr-2 h-5 w-5" /> Go Online</>
                    )}
                  </Button>

                  {isOnline && (
                    <Button
                      variant="outline"
                      className="h-12 w-12 rounded-xl border-slate-200 hover:bg-slate-50"
                      onClick={() => {
                        sendNotification("Test Notification", "If you see this, notifications are working!", () => window.focus());
                        toast.success("Test notification sent!");
                      }}
                      title="Test System Notification"
                    >
                      <Bell className="h-5 w-5 text-slate-500" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Station Selector */}
        {isOnline && (
          <Card className="border-none shadow-sm">
            <CardContent className="p-6 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-600">
                <MapPin className="h-4 w-4 text-teal-600" />
                Which metro station are you at?
              </div>
              <Select value={selectedStationId || ''} onValueChange={handleStationChange}>
                <SelectTrigger className="w-full bg-slate-50 border-slate-200">
                  <SelectValue placeholder="Select station" />
                </SelectTrigger>
                <SelectContent>
                  {MUMBAI_METRO_STATIONS.map((station) => {
                    const dbStation = dbStations.find(s => s.name === station.name)
                    return (
                      <SelectItem key={station.id} value={dbStation?.id || station.id}>
                        {station.name} ({station.line})
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        )}

        {/* Map Preview */}
        <div className="rounded-2xl overflow-hidden shadow-lg border border-slate-200">
          <DashboardMap centerStation={selectedStation} />
        </div>

        {/* Today Stats */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="border-none shadow-sm">
            <CardContent className="p-4 flex flex-col items-center justify-center text-center">
              <Route className="h-5 w-5 text-teal-600 mb-2" />
              <p className="text-xl font-bold text-slate-900">{stats.rides}</p>
              <p className="text-[10px] text-slate-500 uppercase font-bold">Rides</p>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm">
            <CardContent className="p-4 flex flex-col items-center justify-center text-center">
              <DollarSign className="h-5 w-5 text-green-500 mb-2" />
              <p className="text-xl font-bold text-slate-900">₹{stats.earned.toFixed(0)}</p>
              <p className="text-[10px] text-slate-500 uppercase font-bold">Earned</p>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm">
            <CardContent className="p-4 flex flex-col items-center justify-center text-center">
              <Star className="h-5 w-5 text-orange-400 mb-2" />
              <p className="text-xl font-bold text-slate-900">{stats.rating}</p>
              <p className="text-[10px] text-slate-500 uppercase font-bold">Rating</p>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Ride Request Card Overlay */}
      <AnimatePresence>
        {activeRequest && (
          <RideRequestCard
            group={activeRequest}
            onAccept={handleAccept}
            onDecline={() => setActiveRequest(null)}
            isAccepting={isAccepting}
          />
        )}
      </AnimatePresence>

      {/* Driver Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 py-3 px-8 flex justify-around items-center z-40 max-w-2xl mx-auto rounded-t-3xl shadow-[0_-5px_15px_-3px_rgba(0,0,0,0.05)]">
        <button className="text-teal-700 flex flex-col items-center gap-1">
          <LayoutDashboard className="h-6 w-6" />
          <span className="text-[10px] font-bold">Home</span>
        </button>
        <button 
          className="text-slate-400 flex flex-col items-center gap-1"
          onClick={() => toast.info('View all routes feature coming soon!')}
        >
          <Route className="h-6 w-6" />
          <span className="text-[10px] font-bold">Map</span>
        </button>
        <button 
          className="text-slate-400 flex flex-col items-center gap-1"
          onClick={() => router.push('/driver/earnings')}
        >
          <DollarSign className="h-6 w-6" />
          <span className="text-[10px] font-bold">Earnings</span>
        </button>
      </nav>
    </div>
  )
}
