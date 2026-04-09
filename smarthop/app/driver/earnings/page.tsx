'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts'
import { 
  TrendingUp, 
  ArrowLeft, 
  DollarSign, 
  Calendar, 
  Briefcase, 
  Star,
  Info,
  ChevronRight,
  LayoutDashboard,
  Route,
  Zap
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { format, subDays, startOfDay, isSameDay } from 'date-fns'

export default function EarningsPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<{
    transactions: any[],
    groups: any[],
    rating: number
  }>({ transactions: [], groups: [], rating: 4.8 })

  const [supabase] = useState(() => createSupabaseBrowserClient())

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.replace('/auth/login')
      return
    }

    const fetchEarnings = async () => {
      try {
        // Fetch all groups driven by this user
        const { data: groups } = await supabase
          .from('ride_groups')
          .select('*, ride_members(user_id)')
          .eq('driver_id', user.id)
          .order('created_at', { ascending: false })

        const groupIds = groups?.map((g: any) => g.id) || []
        
        // Fetch all transactions for these groups (include pending status to show recent rides)
        const { data: transactions } = groupIds.length > 0 ? await supabase
          .from('fare_transactions')
          .select('*')
          .in('group_id', groupIds)
          .in('status', ['paid', 'pending']) // Include pending to show newly completed rides
          .order('created_at', { ascending: false }) : { data: [] }

        const { data: userProfile } = await supabase
          .from('users')
          .select('driver_rating')
          .eq('id', user.id)
          .single()

        setData({
          transactions: transactions || [],
          groups: groups || [],
          rating: userProfile?.driver_rating || 4.8
        })
      } catch (err) {
        console.error('Error fetching earnings data:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchEarnings()

    // Subscribe to real-time updates on ride_groups
    const groupsChannel = supabase
      .channel(`driver_ride_groups_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ride_groups',
          filter: `driver_id=eq.${user.id}`
        },
        (payload: any) => {
          console.log('[Earnings] ride_groups update:', payload)
          fetchEarnings() // Refetch when driver's groups change
        }
      )
      .subscribe()

    // Subscribe to real-time updates on fare_transactions
    const transactionsChannel = supabase
      .channel(`driver_fare_transactions_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'fare_transactions'
        },
        (payload: any) => {
          console.log('[Earnings] New fare_transaction:', payload)
          fetchEarnings() // Refetch when new transaction is created
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(groupsChannel)
      supabase.removeChannel(transactionsChannel)
    }
  }, [user, authLoading, supabase])

  // Calculation Utilities
  const stats = useMemo(() => {
    const today = startOfDay(new Date())
    const last7Days = subDays(today, 7)

    const todayAmount = data.transactions
      .filter(t => isSameDay(new Date(t.paid_at), new Date()))
      .reduce((sum, t) => sum + Number(t.amount), 0)

    const weekAmount = data.transactions
      .filter(t => new Date(t.paid_at) >= last7Days)
      .reduce((sum, t) => sum + Number(t.amount), 0)

    const ridesToday = data.groups
      .filter(g => isSameDay(new Date(g.created_at), new Date())).length

    return { todayAmount, weekAmount, ridesToday }
  }, [data])

  // Chart Data Preparation
  const hourlyData = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, i) => ({
      hour: `${i}:00`,
      amount: 0
    }))
    
    data.transactions
      .filter(t => isSameDay(new Date(t.paid_at), new Date()))
      .forEach(t => {
        const h = new Date(t.paid_at).getHours()
        hours[h].amount += Number(t.amount)
      })

    return hours
  }, [data])

  const weeklyData = useMemo(() => {
    const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    const days = Array.from({ length: 7 }, (_, i) => {
      const date = subDays(new Date(), 6 - i)
      return {
        name: labels[new Date(date).getDay() === 0 ? 6 : new Date(date).getDay() - 1], // Map Sunday to 6
        amount: 0,
        date
      }
    })

    data.transactions.forEach(t => {
      const tDate = new Date(t.paid_at)
      const dayIdx = days.findIndex(d => isSameDay(d.date, tDate))
      if (dayIdx !== -1) {
        days[dayIdx].amount += Number(t.amount)
      }
    })

    return days
  }, [data])

  // Heatmap Mock Data
  const heatmapData = useMemo(() => {
    const hours = Array.from({ length: 24 })
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    
    // Return intensity mock (0-1)
    const getIntensity = (dayIdx: number, hour: number) => {
      const isWeekend = dayIdx >= 5
      if (isWeekend) {
        if (hour >= 11 && hour <= 15) return 0.7
        if (hour >= 18 && hour <= 22) return 0.8
        return 0.3
      } else {
        if (hour >= 8 && hour <= 10) return 1.0 // Peak morning
        if (hour >= 17 && hour <= 20) return 0.9 // Peak evening
        return 0.2
      }
    }

    return { days, hours, getIntensity }
  }, [])

  if (loading || authLoading) {
    return (
      <div className="p-4 space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24 font-outfit">
      {/* Header */}
      <header className="bg-white px-4 py-6 border-b border-slate-200">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => router.push('/driver/dashboard')}
              className="rounded-full"
            >
              <ArrowLeft className="h-6 w-6" />
            </Button>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Earnings</h1>
          </div>
          <Badge className="bg-green-100 text-green-700 hover:bg-green-100 px-3 py-1 text-xs">
            LIVE UPDATES
          </Badge>
        </div>
      </header>

      <main className="p-4 max-w-2xl mx-auto space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="bg-teal-700 text-white border-none shadow-blue-200 shadow-lg">
            <CardContent className="p-6">
              <DollarSign className="h-5 w-5 opacity-80 mb-2" />
              <p className="text-3xl font-black">₹{stats.todayAmount.toFixed(0)}</p>
              <p className="text-xs font-bold opacity-80 mt-1">Today's Earnings</p>
            </CardContent>
          </Card>
          <Card className="bg-white border-none shadow-sm">
            <CardContent className="p-6">
              <TrendingUp className="h-5 w-5 text-green-500 mb-2" />
              <p className="text-3xl font-black text-slate-900">₹{stats.weekAmount.toFixed(0)}</p>
              <p className="text-xs font-bold text-slate-400 mt-1">This Week</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Card className="bg-white border-none shadow-sm">
            <CardContent className="p-6">
              <Briefcase className="h-5 w-5 text-teal-600 mb-2" />
              <p className="text-3xl font-black text-slate-900">{stats.ridesToday}</p>
              <p className="text-xs font-bold text-slate-400 mt-1">Rides Today</p>
            </CardContent>
          </Card>
          <Card className="bg-white border-none shadow-sm">
            <CardContent className="p-6">
              <Star className="h-5 w-5 text-orange-400 mb-2" />
              <p className="text-3xl font-black text-slate-900">{data.rating}</p>
              <p className="text-xs font-bold text-slate-400 mt-1">Avg Rating</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts Section */}
        <Tabs defaultValue="today" className="w-full">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Performance</h3>
            <TabsList className="bg-slate-200">
              <TabsTrigger value="today" className="text-xs">Today</TabsTrigger>
              <TabsTrigger value="week" className="text-xs">Week</TabsTrigger>
            </TabsList>
          </div>
          
          <Card className="border-none shadow-sm overflow-hidden">
            <CardContent className="p-6">
              <TabsContent value="today" className="m-0">
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%" debounce={50} id="today-chart">
                    <LineChart data={hourlyData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{fontSize: 10}} />
                      <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10}} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                        formatter={(value) => [`₹${value}`, 'Earnings']}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="amount" 
                        stroke="#2563eb" 
                        strokeWidth={4} 
                        dot={{ r: 4, fill: '#2563eb' }}
                        activeDot={{ r: 6, stroke: '#fff', strokeWidth: 2 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </TabsContent>
              <TabsContent value="week" className="m-0">
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%" debounce={50} id="weekly-chart">
                    <BarChart data={weeklyData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10}} />
                      <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10}} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                        cursor={{fill: '#f8fafc'}}
                        formatter={(value) => [`₹${value}`, 'Earnings']}
                      />
                      <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                        {weeklyData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={index === 6 ? '#2563eb' : '#94a3b8'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </TabsContent>
            </CardContent>
          </Card>
        </Tabs>

        {/* Peak Hours Grid (Heatmap) */}
        <Card className="border-none shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-orange-500 fill-orange-500" />
              <CardTitle className="text-lg">Peak Hours Insight</CardTitle>
            </div>
            <CardDescription>Optimize your schedule by driving during high-demand periods.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex text-[8px] font-bold text-slate-400">
                <div className="w-8 shrink-0" />
                {Array.from({length: 12}).map((_, i) => (
                  <div key={i} className="flex-1 text-center">{i === 0 ? '12a' : i === 6 ? '6a' : ''}</div>
                ))}
                {Array.from({length: 12}).map((_, i) => (
                  <div key={i} className="flex-1 text-center">{i === 0 ? '12p' : i === 6 ? '6p' : ''}</div>
                ))}
              </div>
              
              <div className="space-y-1">
                {heatmapData.days.map((day, dIdx) => (
                  <div key={day} className="flex items-center gap-1">
                    <div className="w-8 text-[10px] font-bold text-slate-500">{day}</div>
                    <div className="flex-1 flex gap-0.5 h-3">
                      {Array.from({length: 24}).map((_, hIdx) => {
                        const intensity = heatmapData.getIntensity(dIdx, hIdx)
                        return (
                          <div 
                            key={hIdx}
                            className="flex-1 rounded-[2px]"
                            style={{ 
                              backgroundColor: `rgba(37, 99, 235, ${intensity})`,
                              filter: intensity < 0.1 ? 'grayscale(1)' : 'none'
                            }}
                          />
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-4 text-[10px] font-bold text-slate-400 justify-center pt-2">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-teal-50 rounded-[2px]" /> Low
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-teal-500 rounded-[2px]" /> Med
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-blue-800 rounded-[2px]" /> Peak
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Ride History */}
        <div className="space-y-4">
          <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Recent Rides</h3>
          <div className="space-y-3">
            {data.groups.slice(0, 10).map((group) => {
              const date = new Date(group.created_at)
              return (
                <Card key={group.id} className="border-none shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center">
                        <Route className="h-5 w-5 text-slate-500" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">{format(date, 'MMM dd, HH:mm')}</p>
                        <p className="text-xs text-slate-500">{group.ride_members?.length || 0} Passengers • {group.distance_km} km</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-slate-900">₹{Number(group.fare_total).toFixed(0)}</p>
                      <Badge variant="ghost" className="text-[10px] p-0 font-bold text-green-600">COMPLETED</Badge>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
          {data.groups.length > 10 && (
            <Button variant="ghost" className="w-full text-slate-400 font-bold py-8">
              VIEW ALL HISTORY
            </Button>
          )}
        </div>
      </main>

      {/* Driver Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 py-3 px-8 flex justify-around items-center z-40 max-w-2xl mx-auto rounded-t-3xl shadow-[0_-5px_15px_-3px_rgba(0,0,0,0.05)]">
        <button 
          className="text-slate-400 flex flex-col items-center gap-1"
          onClick={() => router.push('/driver/dashboard')}
        >
          <LayoutDashboard className="h-6 w-6" />
          <span className="text-[10px] font-bold">Home</span>
        </button>
        <button 
          className="text-slate-400 flex flex-col items-center gap-1"
          onClick={() => router.push('/driver/dashboard')}
        >
          <Route className="h-6 w-6" />
          <span className="text-[10px] font-bold">Map</span>
        </button>
        <button className="text-teal-700 flex flex-col items-center gap-1">
          <DollarSign className="h-6 w-6" />
          <span className="text-[10px] font-bold">Earnings</span>
        </button>
      </nav>
    </div>
  )
}
