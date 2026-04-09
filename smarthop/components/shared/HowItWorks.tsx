'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { Ticket, Bell, Users, IndianRupee } from 'lucide-react'

const STEPS = [
  {
    icon: <Ticket className="h-10 w-10 text-teal-700" />,
    title: 'Book Metro Ticket',
    description: 'Purchase your metro ticket and get your QR code instantly in the SmartHop app.'
  },
  {
    icon: <Bell className="h-10 w-10 text-teal-700" />,
    title: 'Get Notified',
    description: 'We alert you 500m before your arrival station so you can prepare for your last-mile ride.'
  },
  {
    icon: <Users className="h-10 w-10 text-teal-700" />,
    title: 'Join a Group',
    description: 'Our AI groups you with fellow commuters heading to the same residential cluster.'
  },
  {
    icon: <IndianRupee className="h-10 w-10 text-teal-700" />,
    title: 'Pay Your Share',
    description: 'Fair, transparent pricing where you only pay for your portion of the shared auto-rickshaw.'
  }
]

export function HowItWorks({ id }: { id?: string }) {
  return (
    <section id={id} className="bg-white py-16 md:py-24 dark:bg-slate-950">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16 space-y-4">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
            How SmartHop Works
          </h2>
          <p className="mx-auto max-w-[600px] text-slate-500 dark:text-slate-400">
            Simplifying your Mumbai Metro commute in four easy steps.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1, duration: 0.5 }}
              className="group relative flex flex-col items-center text-center p-8 rounded-2xl bg-teal-50/50 border border-teal-100 hover:border-blue-200 hover:bg-white hover:shadow-xl transition-all dark:bg-slate-900/50 dark:border-slate-800 dark:hover:bg-slate-900"
            >
              <div className="mb-6 rounded-2xl bg-white p-4 shadow-sm group-hover:scale-110 transition-transform dark:bg-slate-800">
                {step.icon}
              </div>
              <div className="text-xs font-bold text-teal-700 mb-2 uppercase tracking-wider">
                Step {idx + 1}
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3 dark:text-white">
                {step.title}
              </h3>
              <p className="text-slate-500 text-sm leading-relaxed dark:text-slate-400">
                {step.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
