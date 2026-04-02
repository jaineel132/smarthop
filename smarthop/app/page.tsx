'use client'

import React from 'react'
import dynamic from 'next/dynamic'
import { HeroSection } from '@/components/shared/HeroSection'
import { HowItWorks } from '@/components/shared/HowItWorks'
import { Footer } from '@/components/shared/Footer'
import { motion } from 'framer-motion'

// CSR only component for Leaflet
const StaticMetroMap = dynamic(() => import('@/components/maps/StaticMetroMap'), { 
  ssr: false,
  loading: () => <div className="h-[300px] md:h-[420px] w-full rounded-xl bg-slate-100 animate-pulse flex items-center justify-center text-slate-400">Loading Map...</div>
})

export default function LandingPage() {
  return (
    <main className="flex min-h-screen flex-col overflow-x-hidden">
      {/* 1. HERO SECTION */}
      <HeroSection />

      {/* 2. STATS STRIP */}
      <section className="bg-blue-900 py-12 text-white overflow-hidden shadow-2xl relative">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-400 via-white to-blue-400 opacity-20" />
        <div className="container mx-auto px-4">
          <div className="flex flex-wrap items-center justify-around gap-8 md:gap-12 text-center">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="flex flex-col"
            >
              <span className="text-4xl md:text-5xl font-black text-white tracking-tight">12,400+</span>
              <span className="text-sm font-bold uppercase tracking-widest text-blue-300">Shared Rides</span>
            </motion.div>
            
            <div className="hidden md:block h-12 w-px bg-blue-700/50" />

            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="flex flex-col"
            >
              <span className="text-4xl md:text-5xl font-black text-white tracking-tight">38%</span>
              <span className="text-sm font-bold uppercase tracking-widest text-blue-300">Avg. Savings</span>
            </motion.div>

            <div className="hidden md:block h-12 w-px bg-blue-700/50" />

            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="flex flex-col"
            >
              <span className="text-4xl md:text-5xl font-black text-white tracking-tight">3</span>
              <span className="text-sm font-bold uppercase tracking-widest text-blue-300">Metro Lines</span>
            </motion.div>
          </div>
        </div>
      </section>

      {/* 3. HOW IT WORKS */}
      <HowItWorks id="how-it-works" />

      {/* 4. METRO MAP PREVIEW */}
      <section className="bg-white py-16 md:py-24 dark:bg-slate-950">
        <div className="container mx-auto px-4">
          <div className="mb-12 text-center space-y-4">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
              Covering Mumbai Metro Lines 1, 2A & 7
            </h2>
            <p className="mx-auto max-w-[600px] text-slate-500 dark:text-slate-400">
              Check all supported stations and lines directly on our interactive map.
            </p>
          </div>
          
          <StaticMetroMap />
        </div>
      </section>

      {/* 5. FOOTER */}
      <Footer />
    </main>
  )
}
