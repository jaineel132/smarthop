'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { useParams, useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { RideGroup, Waypoint, RideMember } from '@/types'
import { toast } from 'sonner'
import { 
  Navigation, 
  MapPin, 
  CheckCircle2, 
  AlertTriangle, 
  Phone, 
  Users,
  ChevronRight,
  ArrowLeft,
  Circle
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'

const RouteMap = dynamic(() => import('@/components/maps/RouteMap'), { ssr: false })

export default function RouteNavigationPage() {
  const { groupId } = useParams()
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [group, setGroup] = useState<RideGroup | null>(null)
  const [waypoints, setWaypoints] = useState<Waypoint[]>([])
  const [members, setMembers] = useState<RideMember[]>([])
  const [driverPos, setDriverPos] = useState<[number, number] | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentWaypointIndex, setCurrentWaypointIndex] = useState(0)

  const [supabase] = useState(() => createSupabaseBrowserClient())

  const fetchRouteData = useCallback(async () => {
    if (!groupId) return

    try {
      const { data: groupData } = await supabase
        .from('ride_groups')
        .select('*')
        .eq('id', groupId)
        .single()
      
      setGroup(groupData)

      // Try to fetch optimized route from routes table
      let routeData = null
      const { data: fetchedRoute } = await supabase
        .from('routes')
        .select('*')
        .eq('group_id', groupId)
        .maybeSingle()
      
      if (fetchedRoute?.waypoints) {
        setWaypoints(fetchedRoute.waypoints)
        const firstIncompleteIdx = fetchedRoute.waypoints.findIndex((wp: Waypoint) => !wp.completed)
        setCurrentWaypointIndex(firstIncompleteIdx === -1 ? fetchedRoute.waypoints.length - 1 : firstIncompleteIdx)
      } else {
        // Fallback: build waypoints from ride_members if routes table is empty
        console.log('[RouteNav] No optimized route found, building fallback waypoints...')
        
        const { data: membersData } = await supabase
          .from('ride_members')
          .select('*, ride_requests(*)')
          .eq('group_id', groupId)
        
        if (membersData && membersData.length > 0) {
          const startWaypoint: Waypoint = {
            lat: groupData?.center_lat || 19.076,
            lng: groupData?.center_lng || 72.8777,
            label: 'Pickup',
            user_id: 'pickup_station',
            address: 'Pickup Station',
            completed: false
          }

          const dropWaypoints: Waypoint[] = membersData.map((m: any) => ({
            lat: m.ride_requests?.dest_lat || 19.12,
            lng: m.ride_requests?.dest_lng || 72.85,
            label: 'Drop Point',
            user_id: m.user_id,
            member_id: m.id,
            request_id: m.request_id,
            address: m.ride_requests?.dest_address || 'Drop Point',
            completed: false
          }))

          setWaypoints([startWaypoint, ...dropWaypoints])
          setCurrentWaypointIndex(0)
        }
      }

      const { data: membersData } = await supabase
        .from('ride_members')
        .select('*, users(name)')
        .eq('group_id', groupId)
      
      setMembers(membersData || [])
    } catch (error) {
      console.error('Error fetching route data:', error)
      toast.error('Failed to load route details')
    } finally {
      setLoading(false)
    }
  }, [groupId, supabase])

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.replace('/auth/login')
        return
      }
      fetchRouteData()
    }
  }, [user, authLoading, fetchRouteData, router])

  // GPS Tracking Logic
  useEffect(() => {
    if (!user || !group) return

    let lastPos: [number, number] | null = null
    const watchId = navigator.geolocation.watchPosition(
      async (position) => {
        const { latitude: lat, longitude: lng } = position.coords
        setDriverPos([lat, lng])

        // UPSERT driver location throttled to change in position > 10m
        // For simplicity here, we'll just check if it's been a while or moved a bit
        // In a real app we'd use a distance formula (Haversine)
        if (!lastPos || Math.abs(lastPos[0] - lat) > 0.0001 || Math.abs(lastPos[1] - lng) > 0.0001) {
          await supabase
            .from('driver_locations')
            .upsert({
              driver_id: user.id,
              lat,
              lng,
              updated_at: new Date().toISOString()
            }, { onConflict: 'driver_id' })
          
          lastPos = [lat, lng]
        }
      },
      (error) => console.error('GPS Error:', error),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    )

    return () => navigator.geolocation.clearWatch(watchId)
  }, [user, group, supabase])

  const handleArrivedAtStop = async () => {
    if (!waypoints[currentWaypointIndex]) return

    const updatedWaypoints = [...waypoints]
    updatedWaypoints[currentWaypointIndex].completed = true
    setWaypoints(updatedWaypoints)

    try {
      // Update routes table
      const { error: routeError } = await supabase
        .from('routes')
        .update({ waypoints: updatedWaypoints })
        .eq('group_id', groupId)

      if (routeError) throw routeError

      // Update specific member status to 'arrived' — skip for pickup station
      const currentStop = updatedWaypoints[currentWaypointIndex]
      if (currentStop.member_id) {
        // Use precise member_id from waypoint
        await supabase
          .from('ride_members')
          .update({ status: 'arrived' })
          .eq('id', currentStop.member_id)
      } else if (currentStop.user_id && currentStop.user_id !== 'pickup_station') {
        // Fallback for legacy routes
        await supabase
          .from('ride_members')
          .update({ status: 'arrived' })
          .eq('group_id', groupId)
          .eq('user_id', currentStop.user_id)
      }

      toast.success(`Stop ${currentWaypointIndex + 1} complete!`)

      if (currentWaypointIndex < updatedWaypoints.length - 1) {
        setCurrentWaypointIndex(prev => prev + 1)
      } else {
        toast.info('Final stop reached! You can now complete the ride.')
      }
    } catch (err) {
      console.error('Update error:', err)
      toast.error('Failed to update stop status')
    }
  }

  const handleCompleteRide = async () => {
    if (!groupId || !user) return

    try {
      // 1. Update ride group
      const { error: groupError } = await supabase
        .from('ride_groups')
        .update({ status: 'completed' })
        .eq('id', groupId)

      if (groupError) throw groupError

      // 2. Update ride_members status to completed
      await supabase
        .from('ride_members')
        .update({ status: 'completed' })
        .eq('group_id', groupId)

      // 3. Update fare transactions to paid and set paid_at
      const { error: fareError } = await supabase
        .from('fare_transactions')
        .update({ 
          status: 'paid', 
          paid_at: new Date().toISOString() 
        })
        .eq('group_id', groupId)
      
      if (fareError) console.warn('Fare update warning:', fareError)

      toast.success('Ride Completed Successfully!')
      router.push('/driver/earnings')
    } catch (err) {
      console.error('Completion error:', err)
      toast.error('Failed to complete ride records')
    }
  }

  const handleSOS = () => {
    toast.error('SOS Alert Sent to SmartHop Control Center [MOCK]', {
      duration: 5000,
      description: 'The local police and emergency services have been notified of your location.'
    })
  }

  if (loading || authLoading) {
    return (
      <div className="h-screen flex flex-col">
        <Skeleton className="flex-1 w-full" />
        <Skeleton className="h-[40%] w-full rounded-t-3xl" />
      </div>
    )
  }

  const currentStop = waypoints[currentWaypointIndex]
  const isLastStop = currentWaypointIndex === waypoints.length - 1 && currentStop?.completed
  const allStopsCompleted = waypoints.length > 0 && waypoints.every(wp => wp.completed)

  return (
    <div className="h-screen flex flex-col bg-slate-50 relative overflow-hidden font-outfit">
      {/* Map Section (60%) */}
      <div className="flex-[3] relative z-0">
        <RouteMap 
          waypoints={waypoints} 
          driverPos={driverPos} 
          currentWaypointIndex={currentWaypointIndex}
        />
        
        {/* Navigation Floating Header */}
        <div className="absolute top-4 left-4 right-4 z-[1000] pointer-events-none">
          <div className="flex items-center gap-2">
            <Button 
              variant="secondary" 
              size="icon" 
              className="bg-white/90 backdrop-blur-sm pointer-events-auto shadow-md"
              onClick={() => router.push('/driver/dashboard')}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <Card className="bg-teal-700 text-white border-none shadow-lg py-2 px-4 pointer-events-auto flex-1">
              <div className="flex items-center gap-3">
                <Navigation className="h-5 w-5 animate-pulse" />
                <div>
                  <p className="text-[10px] uppercase font-bold opacity-80 leading-none mb-1">Heading to</p>
                  <p className="text-sm font-bold truncate leading-none">
                    {allStopsCompleted ? 'Ride Complete!' : currentStop?.address}
                  </p>
                </div>
              </div>
            </Card>
            <Card className="bg-white border-none shadow-lg py-2 px-4 pointer-events-auto">
              <div className="text-right">
                <p className="text-[10px] uppercase font-bold text-slate-500 leading-none mb-1">Total Fare</p>
                <p className="text-lg font-bold text-teal-700 leading-none">₹{group?.fare_total ? Number(group.fare_total).toFixed(0) : '0'}</p>
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Control Panel (40%) */}
      <div className="flex-[2] bg-white rounded-t-[32px] shadow-[0_-10px_30px_-15px_rgba(0,0,0,0.15)] z-10 px-6 py-6 overflow-y-auto">
        <div className="w-12 h-1 bg-slate-200 rounded-full mx-auto mb-6" />
        
        {!allStopsCompleted ? (
          <div className="space-y-6">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  Stop {currentWaypointIndex + 1} of {waypoints.length}
                  <Badge variant="secondary" className="bg-teal-50 text-blue-700">
                    Drop Off
                  </Badge>
                </h2>
                <p className="text-sm text-slate-500 font-medium">{currentStop?.label}</p>
              </div>
              <Button size="icon" variant="outline" className="rounded-full border-slate-200">
                <Phone className="h-4 w-4 text-slate-400" />
              </Button>
            </div>

            <Card className="bg-slate-50 border-none">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="bg-white p-2 rounded-lg shadow-sm">
                  <MapPin className="h-5 w-5 text-teal-700" />
                </div>
                <p className="text-sm font-bold text-slate-800 leading-snug">
                  {currentStop?.address}
                </p>
              </CardContent>
            </Card>

            <Button 
              className="w-full h-14 bg-teal-700 hover:bg-teal-800 text-lg font-bold shadow-md"
              onClick={handleArrivedAtStop}
            >
              <CheckCircle2 className="mr-2 h-6 w-6" />
              {currentStop?.user_id === 'pickup_station' 
                ? 'Confirm Boarding' 
                : `Drop ${members.find((m: any) => m.user_id === currentStop?.user_id)?.users?.name?.split(' ')[0] || `Passenger ${currentWaypointIndex}`}`
              }
            </Button>
          </div>
        ) : (
          <div className="space-y-6 text-center py-4">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-2">
              <CheckCircle2 className="h-10 w-10 text-green-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900">All Stops Complete!</h2>
              <p className="text-slate-500">All passengers have been dropped off at their destinations.</p>
            </div>
            
            <Button 
              className="w-full h-14 bg-green-600 hover:bg-green-700 text-lg font-bold shadow-md mt-4"
              onClick={handleCompleteRide}
            >
              Complete Ride
            </Button>
          </div>
        )}

        {/* Passenger Summary */}
        <div className="mt-8 space-y-3">
          <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest flex items-center gap-2">
            <Users className="h-3 w-3" />
            Passenger List
          </p>
          <div className="space-y-2">
            {members.map((member: any, idx) => {
              const wp = waypoints.find(w => w.user_id === member.user_id)
              return (
                <div key={member.id} className="flex items-center justify-between p-3 border border-slate-100 rounded-xl bg-white shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600">
                      {(member.users?.name || 'P').charAt(0)}
                    </div>
                    <span className="text-sm font-bold text-slate-700">{member.users?.name}</span>
                  </div>
                  {wp?.completed ? (
                    <Badge variant="outline" className="bg-slate-50 text-slate-400 border-none flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Dropped
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-teal-50 text-teal-700 border-none flex items-center gap-1">
                      <Circle className="h-2 w-2 fill-current" />
                      In vehicle
                    </Badge>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Fixed SOS Button */}
      <Button 
        variant="destructive"
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-2xl z-[1001]"
        onClick={handleSOS}
      >
        <AlertTriangle className="h-7 w-7" />
      </Button>
    </div>
  )
}
