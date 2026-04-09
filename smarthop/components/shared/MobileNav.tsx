'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Ticket, Car, Clock } from 'lucide-react'

const tabs = [
  { label: 'Home', icon: LayoutDashboard, href: '/rider/dashboard' },
  { label: 'Ticket', icon: Ticket, href: '/rider/metro-ticket' },
  { label: 'Ride', icon: Car, href: '/rider/request-ride' },
  { label: 'History', icon: Clock, href: '/rider/history' },
]

export default function MobileNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-white border-t border-slate-200 shadow-lg">
      <div className="flex items-center justify-around h-16 px-2">
        {tabs.map(({ label, icon: Icon, href }) => {
          const isActive = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors"
            >
              <Icon
                size={20}
                className={isActive ? 'text-teal-700' : 'text-slate-400'}
              />
              <span
                className={`text-[10px] font-medium ${
                  isActive ? 'text-teal-700' : 'text-slate-400'
                }`}
              >
                {label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
