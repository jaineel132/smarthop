'use client'

import { motion } from 'framer-motion'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StepIndicatorProps {
  steps: { id: number; name: string }[]
  currentStep: number
}

export default function StepIndicator({ steps, currentStep }: StepIndicatorProps) {
  return (
    <nav aria-label="Progress" className="mb-8">
      <ol role="list" className="flex items-center justify-center space-x-4">
        {steps.map((step, stepIdx) => (
          <li key={step.name} className="relative">
            {step.id < currentStep ? (
              <div className="flex items-center">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600">
                  <Check className="h-6 w-6 text-white" aria-hidden="true" />
                </span>
                {stepIdx !== steps.length - 1 && (
                  <div className="ml-4 h-0.5 w-8 bg-blue-600 sm:w-16" />
                )}
              </div>
            ) : step.id === currentStep ? (
              <div className="flex items-center" aria-current="step">
                <span className="relative flex h-10 w-10 items-center justify-center rounded-full border-2 border-blue-600 bg-white">
                  <motion.span
                    layoutId="active-step-ring"
                    className="absolute inset-0 rounded-full border-2 border-blue-600"
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1.2, opacity: 0 }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                  />
                  <span className="text-blue-600 font-semibold">{step.id}</span>
                </span>
                {stepIdx !== steps.length - 1 && (
                  <div className="ml-4 h-0.5 w-8 bg-gray-200 sm:w-16" />
                )}
              </div>
            ) : (
              <div className="flex items-center">
                <span className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-gray-200 bg-white">
                  <span className="text-gray-500">{step.id}</span>
                </span>
                {stepIdx !== steps.length - 1 && (
                  <div className="ml-4 h-0.5 w-8 bg-gray-200 sm:w-16" />
                )}
              </div>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}
