'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { ArrowRight, CarFront } from 'lucide-react'

export function HeroSection() {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2
      }
    }
  }

  const itemVariants = {
    hidden: { y: 30, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { duration: 0.5 }
    }
  }

  return (
    <section className="relative w-full overflow-hidden bg-gradient-to-br from-blue-900 to-blue-700 py-12 md:py-20 lg:py-32">
      {/* Subtle Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-white/20 to-transparent" />
      </div>

      <div className="container relative mx-auto px-4 md:px-6">
        <motion.div 
          className="flex flex-col items-center text-center space-y-8"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <motion.div variants={itemVariants} className="space-y-4 max-w-3xl">
            <h1 className="text-3xl font-bold tracking-tighter text-white sm:text-4xl md:text-5xl lg:text-6xl">
              Smart Last-Mile Rides from Mumbai Metro
            </h1>
            <p className="mx-auto max-w-[700px] text-blue-100 md:text-xl/relaxed lg:text-2xl/relaxed">
              Share an auto-rickshaw with commuters heading your way. Save up to 40% on your daily commute.
            </p>
          </motion.div>

          <motion.div variants={itemVariants} className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
            <Button 
              asChild 
              size="lg" 
              className="bg-white text-blue-900 hover:bg-slate-100 h-12 px-8 text-lg font-semibold group"
            >
              <Link href="/auth/signup">
                Book a Ride <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>
            <Button 
              asChild 
              variant="outline" 
              size="lg" 
              className="border-white text-white hover:bg-white/10 h-12 px-8 text-lg font-semibold"
            >
              <Link href="/auth/signup?role=driver">
                Drive with Us <CarFront className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          </motion.div>

          <motion.div 
            variants={itemVariants}
            className="pt-8 flex items-center justify-center space-x-2 text-blue-200 text-sm"
          >
            <div className="flex -space-x-2 overflow-hidden">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="inline-block h-8 w-8 rounded-full ring-2 ring-blue-800 bg-slate-200" />
              ))}
            </div>
            <p>Joined by 12,000+ Mumbai commuters</p>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}
