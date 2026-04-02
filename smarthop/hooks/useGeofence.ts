'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { GeofenceService } from '@/lib/geofence'
import { sendNotification } from '@/lib/notifications'
import { MetroStation } from '@/types'

export function useGeofence(station: MetroStation | null, enabled: boolean) {
  const router = useRouter()
  const [isActive, setIsActive] = useState(false)

  useEffect(() => {
    if (!enabled || !station) {
      setIsActive(false)
      return
    }

    const geofence = new GeofenceService(station.lat, station.lng)
    
    geofence.start(() => {
      sendNotification(
        `Arriving at ${station.name}!`,
        'Book your last-mile ride now.',
        () => router.push(`/rider/request-ride?station=${station.id}`)
      )
    })
    
    setIsActive(true)

    return () => {
      geofence.stop()
      setIsActive(false)
    }
  }, [enabled, station, router])

  return { isActive }
}
