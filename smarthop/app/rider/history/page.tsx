'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { ArrowLeft, TrendingDown, Calendar, Users, MapPin, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Progress } from '@/components/ui/progress'
import { useAuth } from '@/hooks/useAuth'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

const supabase = createSupabaseBrowserClient()

interface RideHistoryItem {
  id: string
  group_id: string
  fare_share: number
  solo_fare: number
  savings_pct: number
  status: string
  group: {
    id: string
    cluster_id: string
    status: string
    fare_total: number
    distance_km: number
    duration_min: number
    created_at: string
  }
}

export default function RideHistoryPage() {
  const router = useRouter()
  const { user } = useAuth()

  const [rides, setRides] = useState<RideHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [totalSaved, setTotalSaved] = useState(0)

  useEffect(() => {
    const fetchRides = async () => {
      if (!user) return

      try {
        const { data, error } = await supabase
          .from('ride_members')
          .select(`
            id,
            group_id,
            fare_share,
            solo_fare,
            savings_pct,
            status,
            group:ride_groups (
              id,
              cluster_id,
              status,
              fare_total,
              distance_km,
              duration_min,
              created_at
            )
          `)
          .eq('user_id', user.id)
          .order('group_id', { ascending: false })

        if (error) {
          console.warn('Error fetching ride history:', error)
          return
        }

        if (data) {
          // Supabase returns the joined group as an object (single relation)
          const items: RideHistoryItem[] = data
            .filter((d: any) => d.group)
            .map((d: any) => ({
              ...d,
              group: Array.isArray(d.group) ? d.group[0] : d.group,
            }))

          setRides(items)

          const saved = items.reduce((sum, r) => sum + (r.solo_fare - r.fare_share), 0)
          setTotalSaved(Math.max(0, saved))
        }
      } catch (err) {
        console.warn('Error:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchRides()
  }, [user])

  // Build weekly spending data for last 4 weeks
  const buildWeeklyData = () => {
    const now = new Date()
    const weeks: { label: string; shared: number; solo: number }[] = []

    for (let w = 3; w >= 0; w--) {
      const weekStart = new Date(now)
      weekStart.setDate(now.getDate() - (w + 1) * 7)
      const weekEnd = new Date(now)
      weekEnd.setDate(now.getDate() - w * 7)

      const weekRides = rides.filter((r) => {
        const d = new Date(r.group?.created_at)
        return d >= weekStart && d < weekEnd
      })

      const shared = weekRides.reduce((s, r) => s + r.fare_share, 0)
      const solo = weekRides.reduce((s, r) => s + r.solo_fare, 0)

      const label = `Week ${4 - w}`
      weeks.push({ label, shared: Math.round(shared), solo: Math.round(solo) })
    }

    return weeks
  }

  const weeklyData = buildWeeklyData()

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24 font-sans">
      {/* Header */}
      <div className="bg-white border-b px-4 py-4 flex items-center sticky top-0 z-20 shadow-sm">
        <button onClick={() => router.push('/rider/dashboard')} className="p-2 -ml-2 rounded-full hover:bg-slate-100 mr-2">
          <ArrowLeft className="w-5 h-5 text-slate-700" />
        </button>
        <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
          Ride History
        </h1>
      </div>

      <div className="p-4 max-w-lg mx-auto space-y-4">
        {/* Total Saved Banner */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="bg-gradient-to-r from-green-500 to-emerald-600 border-0 shadow-lg shadow-green-200/50">
            <CardContent className="p-5 text-center text-white">
              <TrendingDown className="w-6 h-6 mx-auto mb-2 opacity-80" />
              <p className="text-sm font-medium text-green-100">Total Saved</p>
              <p className="text-3xl font-bold mt-1">{formatCurrency(totalSaved)}</p>
              <p className="text-xs text-green-200 mt-1">{rides.length} ride{rides.length !== 1 ? 's' : ''} taken</p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Rides List */}
        {rides.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="text-center py-12"
          >
            <div className="w-16 h-16 mx-auto bg-slate-100 rounded-full flex items-center justify-center mb-4">
              <MapPin className="w-8 h-8 text-slate-400" />
            </div>
            <p className="text-lg font-semibold text-slate-700 mb-1">No rides yet</p>
            <p className="text-sm text-slate-500 mb-6">Book your first shared ride!</p>
            <Button
              className="bg-teal-700 hover:bg-blue-700 rounded-xl px-6"
              onClick={() => router.push('/rider/request-ride')}
            >
              Book a Ride <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </motion.div>
        ) : (
          <Accordion type="single" collapsible className="space-y-3">
            {rides.map((ride, i) => {
              const date = new Date(ride.group?.created_at)
              const dateStr = date.toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })
              const savings = ride.solo_fare - ride.fare_share

              return (
                <motion.div
                  key={ride.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <AccordionItem value={ride.id} className="bg-white rounded-xl border shadow-sm overflow-hidden">
                    <AccordionTrigger className="px-4 py-3.5 hover:no-underline hover:bg-slate-50/50">
                      <div className="flex items-center gap-3 w-full text-left">
                        <div className="w-10 h-10 rounded-full bg-teal-50 flex items-center justify-center shrink-0">
                          <Calendar className="w-4 h-4 text-teal-700" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-800">{dateStr}</p>
                          <p className="text-xs text-slate-500">{ride.group?.distance_km?.toFixed(1)} km • {ride.group?.duration_min} min</p>
                        </div>
                        <div className="text-right shrink-0 mr-2">
                          <p className="text-sm font-bold text-slate-800">{formatCurrency(ride.fare_share)}</p>
                          {savings > 0 && (
                            <p className="text-xs font-medium text-green-600">-{ride.savings_pct?.toFixed(0)}%</p>
                          )}
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4 pt-0">
                      <div className="border-t pt-3 space-y-3">
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500">Solo fare</span>
                          <span className="text-slate-400 line-through">{formatCurrency(ride.solo_fare)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500">You saved</span>
                          <span className="font-semibold text-green-600">{formatCurrency(savings)}</span>
                        </div>

                        {/* XAI Breakdown */}
                        <div className="space-y-2 pt-1">
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span className="text-slate-500">Distance impact</span>
                              <span className="text-slate-400">60%</span>
                            </div>
                            <Progress value={60} className="h-1.5" />
                          </div>
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span className="text-slate-500">Sharing discount</span>
                              <span className="text-green-600">-{ride.savings_pct?.toFixed(0) ?? 35}%</span>
                            </div>
                            <Progress value={ride.savings_pct ?? 35} className="h-1.5 [&>div]:bg-green-500" />
                          </div>
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span className="text-slate-500">Time surge</span>
                              <span className="text-amber-600">5%</span>
                            </div>
                            <Progress value={5} className="h-1.5 [&>div]:bg-amber-500" />
                          </div>
                        </div>

                        <div className="flex items-center gap-1 text-xs text-slate-400 pt-1">
                          <Users className="w-3.5 h-3.5" />
                          <span>Group ride • {ride.group?.cluster_id}</span>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </motion.div>
              )
            })}
          </Accordion>
        )}

        {/* Weekly Spending Chart */}
        {rides.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Card className="shadow-sm border-slate-200/60">
              <CardContent className="p-4">
                <p className="text-sm font-semibold text-slate-700 mb-4">Weekly Spending (Last 4 Weeks)</p>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={weeklyData} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#94a3b8' }} />
                    <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} tickFormatter={(v) => `₹${v}`} />
                    <Tooltip
                      contentStyle={{
                        borderRadius: '12px',
                        border: '1px solid #e2e8f0',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                        fontSize: '13px',
                      }}
                      formatter={(value: any, name: any) => [
                        `₹${value}`,
                        name === 'shared' ? 'Shared Fare' : 'Solo (would be)',
                      ]}
                    />
                    <Legend formatter={(value: any) => (value === 'shared' ? 'Shared Fare' : 'Solo Fare')} />
                    <Bar dataKey="shared" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="solo" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>
    </div>
  )
}
