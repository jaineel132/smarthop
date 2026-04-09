'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { GeofenceService } from '@/lib/geofence'
import { sendNotification } from '@/lib/notifications'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { MetroStation } from '@/types'

type GeofenceOptions = {
  source?: string
  ticketId?: string | null
  userId?: string | null
}

export function useGeofence(station: MetroStation | null, enabled: boolean, options: GeofenceOptions = {}) {
  const router = useRouter()
  const [isActive, setIsActive] = useState(false)
  const [supabase] = useState(() => createSupabaseBrowserClient())

  const logEvent = async (eventType: string, details: Record<string, unknown> = {}) => {
    if (!station) return

    try {
      await supabase.from('handoff_events').insert({
        event_type: eventType,
        user_id: options.userId ?? null,
        ticket_id: options.ticketId ?? null,
        station_id: station.id,
        details: {
          source: options.source || 'metro-alert',
          ...details,
        },
      })
    } catch (error) {
      console.warn('Failed to log handoff event:', eventType, error)
    }
  }

  useEffect(() => {
    if (!enabled || !station) {
      setIsActive(false)
      return
    }

    const geofence = new GeofenceService(station.lat, station.lng)
    const source = options.source || 'metro-alert'
    const ticketParam = options.ticketId ? `&ticket=${options.ticketId}` : ''
    const requestRideUrl = `/rider/request-ride?station=${station.id}&source=${source}${ticketParam}`
    
    geofence.start(() => {
      void logEvent('geofence_triggered', {
        radius_meters: 500,
      })

      const shown = sendNotification(
        `Arriving at ${station.name}!`,
        'Book your last-mile ride now.',
        () => router.push(requestRideUrl)
      )

      if (!shown) {
        void logEvent('notification_fallback', {
          reason: 'permission_denied_or_unsupported',
        })
        toast.info(`Arrival alert for ${station.name}. Opening last-mile booking.`)
        router.push(requestRideUrl)
      } else {
        void logEvent('notification_shown', {
          title: `Arriving at ${station.name}!`,
        })
      }
    })
    
    setIsActive(true)

    return () => {
      geofence.stop()
      setIsActive(false)
    }
  }, [enabled, station, router, options.source, options.ticketId, options.userId, supabase])

  return { isActive }
}
