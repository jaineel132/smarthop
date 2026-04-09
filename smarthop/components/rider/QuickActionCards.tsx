'use client'

import { Card } from '@/components/ui/card'
import { Ticket, Car, Clock } from 'lucide-react'
import { useRouter } from 'next/navigation'

export function QuickActionCards() {
  const router = useRouter()

  const actions = [
    {
      title: 'Book Metro Ticket',
      subtitle: 'Get QR ticket',
      icon: Ticket,
      href: '/rider/metro-ticket',
      color: 'bg-teal-100 text-teal-700'
    },
    {
      title: 'Request Ride',
      subtitle: 'Share last-mile auto',
      icon: Car,
      href: '/rider/request-ride',
      color: 'bg-orange-100 text-orange-600'
    },
    {
      title: 'My Rides',
      subtitle: 'History & savings',
      icon: Clock,
      href: '/rider/history',
      color: 'bg-purple-100 text-purple-600'
    }
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 px-4">
      {actions.map((action) => (
        <Card 
          key={action.title}
          className="p-4 cursor-pointer hover:shadow-md hover:border-teal-300 transition-all active:scale-95 border-slate-200"
          onClick={() => router.push(action.href)}
        >
          <div className="flex flex-col gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${action.color}`}>
              <action.icon size={20} />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900">{action.title}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{action.subtitle}</p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}
