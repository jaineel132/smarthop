'use client'

import React, { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { CheckCircle2, Star, ArrowRight, MapPin, Clock, Users, Route } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useAuth } from '@/hooks/useAuth'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'
import FareBreakdownAccordion from '@/components/rider/FareBreakdownAccordion'
import { FarePrediction } from '@/types'

const supabase = createSupabaseBrowserClient()

export default function FareSummaryPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = use(params)
  const router = useRouter()
  const { user } = useAuth()

  const [fareShare, setFareShare] = useState(0)
  const [soloFare, setSoloFare] = useState(0)
  const [savingsPct, setSavingsPct] = useState(0)
  const [fareTotal, setFareTotal] = useState(0)
  const [distanceKm, setDistanceKm] = useState(0)
  const [durationMin, setDurationMin] = useState(0)
  const [coRiders, setCoRiders] = useState(0)
  const [driverId, setDriverId] = useState<string | null>(null)
  const [driverName, setDriverName] = useState('Driver')
  const [rating, setRating] = useState(0)
  const [ratingSubmitted, setRatingSubmitted] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return

      try {
        // Fetch group
        const { data: group } = await supabase
          .from('ride_groups')
          .select('*')
          .eq('id', groupId)
          .single()

        if (group) {
          setFareTotal(group.fare_total)
          setDistanceKm(group.distance_km)
          setDurationMin(group.duration_min)
          setDriverId(group.driver_id)

          if (group.driver_id) {
            const { data: driver } = await supabase
              .from('users')
              .select('name')
              .eq('id', group.driver_id)
              .single()
            if (driver) setDriverName(driver.name)
          }
        }

        // Fetch member data for current user
        const { data: member } = await supabase
          .from('ride_members')
          .select('fare_share, solo_fare, savings_pct')
          .eq('group_id', groupId)
          .eq('user_id', user.id)
          .single()

        if (member) {
          setFareShare(member.fare_share)
          setSoloFare(member.solo_fare)
          setSavingsPct(member.savings_pct)
        }

        // Count co-riders
        const { count } = await supabase
          .from('ride_members')
          .select('*', { count: 'exact', head: true })
          .eq('group_id', groupId)

        setCoRiders((count ?? 1) - 1)
      } catch (err) {
        console.warn('Error fetching fare summary:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [groupId, user])

  const handleRating = async (stars: number) => {
    setRating(stars)
    if (!driverId) return

    try {
      // Fetch current rating and calculate new average
      const { data: driver } = await supabase
        .from('users')
        .select('driver_rating')
        .eq('id', driverId)
        .single()

      const currentRating = driver?.driver_rating ?? 5.0
      const newRating = Math.round(((currentRating + stars) / 2) * 100) / 100

      await supabase
        .from('users')
        .update({ driver_rating: newRating })
        .eq('id', driverId)

      setRatingSubmitted(true)
      toast.success('Thanks for rating!')
    } catch {
      toast.error('Failed to submit rating')
    }
  }

  // Build fare prediction object for the breakdown accordion
  const farePrediction: FarePrediction = {
    shared_fare: fareShare,
    solo_fare: soloFare,
    savings_pct: savingsPct,
    explanation: {
      distance_impact_pct: 60,
      sharing_discount_pct: savingsPct || 35,
      time_surge_pct: 5,
      human_readable: `Your fare of ${formatCurrency(fareShare)} is shared among ${coRiders + 1} riders over ${distanceKm.toFixed(1)}km.`,
    },
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-green-200 border-t-green-600 rounded-full animate-spin" />
      </div>
    )
  }

  const savingsAmount = soloFare - fareShare

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-slate-50 pb-24 font-sans">
      {/* Animated Checkmark */}
      <div className="pt-12 pb-6 text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: [0, 1.2, 1] }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="inline-block"
        >
          <div className="w-20 h-20 mx-auto rounded-full bg-green-500 flex items-center justify-center shadow-lg shadow-green-200">
            <CheckCircle2 className="w-10 h-10 text-white" />
          </div>
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-2xl font-bold text-slate-800 mt-4"
        >
          Ride Complete!
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-slate-500 mt-1"
        >
          Thanks for riding with SmartHop
        </motion.p>
      </div>

      <div className="px-5 max-w-lg mx-auto space-y-4">
        {/* Fare Card */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Card className="shadow-lg border-green-200/60 overflow-hidden">
            <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-5 text-center text-white">
              <p className="text-green-100 text-sm font-medium">Your Share</p>
              <p className="text-4xl font-bold mt-1">{formatCurrency(fareShare)}</p>
            </div>
            <CardContent className="p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Group total</span>
                <span className="font-semibold text-slate-700">{formatCurrency(fareTotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Solo fare would be</span>
                <span className="font-semibold text-slate-400 line-through">{formatCurrency(soloFare)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">You saved</span>
                <span className="font-bold text-green-600">{formatCurrency(savingsAmount)}</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Savings Badge */}
        {savingsPct > 0 && (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.6 }}
            className="bg-green-50 border border-green-200 rounded-xl p-3 text-center"
          >
            <span className="text-green-700 font-bold text-lg">{savingsPct.toFixed(0)}% cheaper than solo!</span>
          </motion.div>
        )}

        {/* XAI Breakdown */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}>
          <FareBreakdownAccordion fareResult={farePrediction} />
        </motion.div>

        {/* Trip Summary */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }}>
          <Card className="shadow-sm border-slate-200/60">
            <CardContent className="p-4">
              <p className="text-xs text-slate-500 uppercase font-semibold tracking-wider mb-3">Trip Summary</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2">
                  <Route className="w-4 h-4 text-slate-400" />
                  <div>
                    <p className="text-sm font-semibold text-slate-700">{distanceKm.toFixed(1)} km</p>
                    <p className="text-xs text-slate-400">Distance</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-400" />
                  <div>
                    <p className="text-sm font-semibold text-slate-700">{durationMin} min</p>
                    <p className="text-xs text-slate-400">Duration</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-slate-400" />
                  <div>
                    <p className="text-sm font-semibold text-slate-700">{coRiders} co-riders</p>
                    <p className="text-xs text-slate-400">Shared with</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  <div>
                    <p className="text-sm font-semibold text-slate-700">{driverName}</p>
                    <p className="text-xs text-slate-400">Driver</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Rate Driver */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 }}>
          <Card className="shadow-sm border-slate-200/60">
            <CardContent className="p-5 text-center">
              <p className="text-sm font-semibold text-slate-700 mb-3">Rate your driver</p>
              <div className="flex justify-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => !ratingSubmitted && handleRating(star)}
                    disabled={ratingSubmitted}
                    className="transition-all hover:scale-110 active:scale-95 disabled:opacity-60"
                  >
                    <Star
                      className={`w-9 h-9 ${
                        star <= rating
                          ? 'text-amber-400 fill-amber-400'
                          : 'text-slate-300'
                      }`}
                    />
                  </button>
                ))}
              </div>
              {ratingSubmitted && (
                <p className="text-xs text-green-600 mt-2 font-medium">Thanks for your feedback!</p>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* CTA Buttons */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.0 }}
          className="space-y-3 pt-2"
        >
          <Button
            className="w-full h-13 text-base rounded-xl shadow-lg bg-blue-600 hover:bg-blue-700"
            onClick={() => router.push('/rider/request-ride')}
          >
            Book Return Ride <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
          <Button
            variant="outline"
            className="w-full h-12 text-base rounded-xl"
            onClick={() => router.push('/rider/dashboard')}
          >
            Back to Dashboard
          </Button>
        </motion.div>
      </div>
    </div>
  )
}
