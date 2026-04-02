'use client'

import { useState, useEffect } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

interface DriverLocationState {
  lat: number | null
  lng: number | null
  lastUpdated: Date | null
}

export function useDriverLocation(driverId: string | null): DriverLocationState {
  const [location, setLocation] = useState<DriverLocationState>({
    lat: null,
    lng: null,
    lastUpdated: null,
  })

  useEffect(() => {
    if (!driverId) {
      setLocation({ lat: null, lng: null, lastUpdated: null })
      return
    }

    const supabase = createSupabaseBrowserClient()

    // Fetch initial location
    const fetchInitial = async () => {
      const { data } = await supabase
        .from('driver_locations')
        .select('lat, lng, updated_at')
        .eq('driver_id', driverId)
        .single()

      if (data) {
        setLocation({
          lat: data.lat,
          lng: data.lng,
          lastUpdated: new Date(data.updated_at),
        })
      }
    }
    fetchInitial()

    // Subscribe to realtime updates
    const channel = supabase
      .channel(`driver-location-${driverId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'driver_locations',
          filter: `driver_id=eq.${driverId}`,
        },
        (payload) => {
          const newData = payload.new as { lat: number; lng: number; updated_at: string }
          setLocation({
            lat: newData.lat,
            lng: newData.lng,
            lastUpdated: new Date(newData.updated_at),
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [driverId])

  return location
}
