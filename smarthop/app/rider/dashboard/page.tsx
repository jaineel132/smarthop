'use client'

import React, { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { ML_API } from '@/lib/ml-api'
import { getStationById } from '@/lib/stations'
import { MetroStation } from '@/types'
import { Bell, MapPin, Car, LogOut } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { QuickActionCards } from '@/components/rider/QuickActionCards'
import MobileNav from '@/components/shared/MobileNav'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const DashboardMap = dynamic(() => import('@/components/maps/DashboardMap'), { ssr: false })

export default function RiderDashboard() {
  const { user } = useAuth()
  const supabase = createSupabaseBrowserClient()
  const router = useRouter()
  
  const [loading, setLoading] = useState(true)
  const [homeStation, setHomeStation] = useState<MetroStation | null>(null)
  const [userName, setUserName] = useState<string>('Rider')
  const [activeRideGroup, setActiveRideGroup] = useState<string | null>(null)
  const [recentRides, setRecentRides] = useState<any[]>([])

  useEffect(() => {
    async function loadDashboardData() {
      if (!user) return

      try {
        setLoading(true)

        // 1. Fetch home station
        const { data: userData } = await supabase
          .from('users')
          .select('home_station_id, full_name')
          .eq('id', user.id)
          .single()

        if (userData?.home_station_id) {
          const station = getStationById(userData.home_station_id)
          if (station) setHomeStation(station)
        }
        if (userData?.full_name) {
          setUserName(userData.full_name)
        } else if (user.user_metadata?.full_name) {
          setUserName(user.user_metadata.full_name)
        }

        // 2. Check active ride (include 'forming' so riders see the waiting screen)
        const { data: rideData } = await supabase
          .from('ride_members')
          .select('group_id, ride_groups!inner(status)')
          .eq('user_id', user.id)
          .in('ride_groups.status', ['forming', 'accepted', 'in_progress'])
          .limit(1)

        if (rideData && rideData.length > 0) {
          setActiveRideGroup(rideData[0].group_id)
        }

        // 3. Fetch recent rides (use ride_groups.created_at since ride_members has no timestamp)
        const { data: recentData } = await supabase
          .from('ride_members')
          .select('id, fare_share, ride_groups!inner(status, created_at, distance_km)')
          .eq('user_id', user.id)
          .eq('ride_groups.status', 'completed')
          .order('ride_groups(created_at)', { ascending: false })
          .limit(5)

        if (recentData) {
          setRecentRides(recentData)
        }

        // 4. Check ML Health
        const mlHealthy = await ML_API.checkMLHealth()
        if (!mlHealthy) {
          toast.warning("SmartHop AI service is temporarily offline. Matching may be slower.")
        }
      } catch (error) {
        console.error("Dashboard data load error:", error)
        toast.error("Failed to load dashboard data.")
      } finally {
        setLoading(false)
      }
    }

    loadDashboardData()
  }, [user, supabase])

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 18) return 'Good afternoon'
    return 'Good evening'
  }

  const name = userName || 'Rider'

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 pb-20 md:pb-0">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 w-full bg-white border-b shadow-sm px-4 py-3 flex items-center justify-between">
        <div className="text-xl font-bold text-teal-700">SmartHop</div>
        <div className="flex-1 text-center font-medium text-slate-800">
          {getGreeting()}, {name}
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
          <Avatar className="w-8 h-8 ring-2 ring-teal-100">
            <AvatarFallback className="bg-teal-700 text-white text-xs">
              {name.charAt(0)}
            </AvatarFallback>
          </Avatar>
        </div>
      </header>

      {/* Metro Status Strip */}
      <div className="w-full overflow-x-auto no-scrollbar border-b bg-white">
        <div className="flex items-center gap-2 px-4 py-3 min-w-max">
          <Badge className="bg-green-100 text-green-700 hover:bg-green-100 shrink-0 border-transparent shadow-none">
            <div className="w-2 h-2 rounded-full bg-green-500 mr-2 animate-pulse" />
            Line 1 Running
          </Badge>
          <Badge className="bg-green-100 text-green-700 hover:bg-green-100 shrink-0 border-transparent shadow-none">
            <div className="w-2 h-2 rounded-full bg-green-500 mr-2 animate-pulse" />
            Line 2A Running
          </Badge>
          <Badge className="bg-green-100 text-green-700 hover:bg-green-100 shrink-0 border-transparent shadow-none">
            <div className="w-2 h-2 rounded-full bg-green-500 mr-2 animate-pulse" />
            Line 7 Running
          </Badge>
        </div>
      </div>

      <main className="flex-1 space-y-6 pt-4 pb-8 max-w-5xl mx-auto w-full">
        {/* Active Ride Banner */}
        {activeRideGroup && !loading && (
          <div className="px-4">
            <div className="bg-teal-700 text-white rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-md">
              <div className="flex items-center gap-3">
                <div className="bg-teal-600 p-2 rounded-full">
                  <MapPin size={20} className="text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">You have an active ride in progress</h3>
                  <p className="text-teal-100 text-sm">Your driver is on the way or you are in transit.</p>
                </div>
              </div>
              <Button asChild variant="secondary" className="w-full sm:w-auto font-medium shadow-none">
                <Link href={`/rider/tracking/${activeRideGroup}`}>Track Now</Link>
              </Button>
            </div>
          </div>
        )}

        {/* Dashboard Map */}
        <div className="px-4">
          {loading ? (
            <Skeleton className="w-full h-[260px] md:h-[340px] rounded-xl" />
          ) : (
            <DashboardMap centerStation={homeStation} />
          )}
        </div>

        {/* Quick Action Cards */}
        <QuickActionCards />

        {/* Recent Rides */}
        <div className="px-4">
          <div className="flex items-center justify-between mb-3 px-1">
            <h2 className="text-lg font-bold text-slate-800">Recent Rides</h2>
          </div>
          
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="w-full h-20 rounded-xl" />
              <Skeleton className="w-full h-20 rounded-xl" />
            </div>
          ) : recentRides.length > 0 ? (
            <div className="space-y-3">
              {recentRides.map((ride: any, idx: number) => {
                const rideGroup = ride.ride_groups
                const createdAt = rideGroup?.created_at
                return (
                  <div key={idx} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex justify-between items-center">
                     <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {createdAt ? new Date(createdAt).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric'}) : 'Recent Ride'}
                      </p>
                      <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                        <Car size={12}/> Shared Auto • ₹{ride.fare_share || '—'}
                      </p>
                    </div>
                    <Badge variant="secondary" className="bg-green-50 text-green-700 hover:bg-green-50">
                      Completed
                    </Badge>
                  </div>
                )
              })}
            </div>
          ) : (
             <div className="bg-white border rounded-xl p-8 text-center flex flex-col items-center">
              <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-3">
                <Car size={24} className="text-slate-400" />
              </div>
              <h3 className="font-semibold text-slate-800">No rides yet</h3>
              <p className="text-sm text-slate-500 mt-1 max-w-[200px]">
                Book your first shared ride and start saving!
              </p>
            </div>
          )}
        </div>
      </main>

      <MobileNav />
    </div>
  )
}
