'use client'

import { ClusterGroup, FarePrediction, MetroStation } from '@/types'
import { formatCurrency } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Users, Clock, Navigation } from 'lucide-react'

interface GroupPreviewCardProps {
  clusterResult: ClusterGroup
  fareResult: FarePrediction
  station: MetroStation
  memberNames?: string[]
}

export default function GroupPreviewCard({ clusterResult, fareResult, station, memberNames }: GroupPreviewCardProps) {
  const otherRiders = clusterResult.cluster_size - 1
  const displayAvatars = Math.min(otherRiders, 3)
  const overflow = otherRiders - displayAvatars

  const initials = memberNames && memberNames.length > 0
    ? memberNames.map(n => n.substring(0, 2).toUpperCase())
    : ['AK', 'RS', 'PM', 'DG', 'VN']

  return (
    <Card className="shadow-lg border-slate-200/60 overflow-hidden">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-white">
            <Users className="w-5 h-5" />
            <span className="font-semibold">Your Ride Group</span>
          </div>
          <Badge className="bg-white/20 text-white border-white/30 hover:bg-white/30">
            {clusterResult.cluster_size} riders
          </Badge>
        </div>
      </div>

      <CardContent className="p-5 space-y-5">
        {/* Avatar Row */}
        <div className="flex items-center space-x-3">
          <div className="flex -space-x-2">
            {/* Current user */}
            <Avatar className="w-10 h-10 border-2 border-white ring-2 ring-teal-100">
              <AvatarFallback className="bg-teal-700 text-white text-sm font-bold">You</AvatarFallback>
            </Avatar>
            {/* Other riders */}
            {Array.from({ length: displayAvatars }).map((_, i) => (
              <Avatar key={i} className="w-10 h-10 border-2 border-white ring-2 ring-slate-100">
                <AvatarFallback className="bg-slate-200 text-slate-600 text-sm font-bold">
                  {initials[i]}
                </AvatarFallback>
              </Avatar>
            ))}
            {overflow > 0 && (
              <Avatar className="w-10 h-10 border-2 border-white ring-2 ring-slate-100">
                <AvatarFallback className="bg-slate-100 text-slate-500 text-sm font-bold">
                  +{overflow}
                </AvatarFallback>
              </Avatar>
            )}
          </div>
          <p className="text-sm text-slate-600 font-medium">
            You + {otherRiders} {otherRiders === 1 ? 'other' : 'others'} heading your way
          </p>
        </div>

        {/* Fare Display */}
        <div className="bg-slate-50 rounded-2xl p-4 flex items-end justify-between">
          <div>
            <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Shared Fare</p>
            <p className="text-3xl font-bold text-slate-900 tracking-tight">
              {formatCurrency(fareResult.shared_fare)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-slate-400 line-through">{formatCurrency(fareResult.solo_fare)}</p>
            <Badge className="bg-green-100 text-green-700 border-green-200 mt-1">
              {fareResult.savings_pct.toFixed(0)}% saved
            </Badge>
          </div>
        </div>

        {/* Rider Names */}
        {memberNames && memberNames.length > 0 && (
          <div className="bg-slate-50 rounded-2xl p-4 mt-4">
            <p className="text-xs text-slate-500 uppercase font-semibold mb-2">Matched With</p>
            <div className="flex flex-wrap gap-2">
              {memberNames.map((name, i) => (
                <Badge key={i} className="bg-teal-100 text-blue-800 border-blue-200 hover:bg-teal-200">
                  {name}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Info Chips */}
        <div className="flex gap-3">
          <div className="flex-1 bg-teal-50 rounded-xl p-3 flex items-center space-x-2">
            <Clock className="w-4 h-4 text-teal-700" />
            <span className="text-sm font-medium text-blue-800">~3 min wait</span>
          </div>
          <div className="flex-1 bg-indigo-50 rounded-xl p-3 flex items-center space-x-2">
            <Navigation className="w-4 h-4 text-indigo-600" />
            <span className="text-sm font-medium text-indigo-800">~15 min ride</span>
          </div>
        </div>

        {/* Station */}
        <p className="text-xs text-center text-slate-400">
          Pickup from <span className="font-semibold text-slate-600">{station.name}</span>
        </p>
      </CardContent>
    </Card>
  )
}
