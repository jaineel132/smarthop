'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { MUMBAI_METRO_STATIONS } from '@/lib/stations'
import StepIndicator from '@/components/shared/StepIndicator'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { 
  Search, 
  MapPin, 
  Bell, 
  ArrowRight, 
  CheckCircle, 
  ShieldCheck, 
  Zap, 
  Clock, 
  Users,
  LogOut,
  Ticket,
  IndianRupee,
  Car,
  Bike
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

const RIDER_STEPS = [
  { id: 1, name: 'Home Station' },
  { id: 2, name: 'Notifications' },
  { id: 3, name: 'How it Works' },
]

const DRIVER_STEPS = [
  { id: 1, name: 'Home Station' },
  { id: 2, name: 'Vehicle Info' },
  { id: 3, name: 'Notifications' },
  { id: 4, name: 'How it Works' },
]

export default function OnboardingPage() {
  const router = useRouter()
  const supabase = createSupabaseBrowserClient()
  const [currentStep, setCurrentStep] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedStation, setSelectedStation] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<'rider' | 'driver' | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [userName, setUserName] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const [tutorialSlide, setTutorialSlide] = useState(0)
  const [vehicleType, setVehicleType] = useState<'auto' | 'car' | null>(null)
  const [vehicleNumber, setVehicleNumber] = useState('')

  const isDriver = userRole === 'driver'
  const STEPS = isDriver ? DRIVER_STEPS : RIDER_STEPS
  const totalSteps = STEPS.length
  const notifStep = isDriver ? 3 : 2
  const tutorialStep = isDriver ? 4 : 3

  const TUTORIAL_SLIDES = [
    {
      icon: <Ticket className="h-8 w-8 text-teal-700" />,
      title: 'Book Metro Ticket',
      description: 'Tap Book Ticket and get a QR code directly in the app.',
      color: 'bg-teal-100 text-teal-700',
    },
    {
      icon: <Bell className="h-8 w-8 text-amber-600" />,
      title: 'Get Notified Near Your Stop',
      description: 'Alert fires 500m before your arrival station so you can prep.',
      color: 'bg-amber-100 text-amber-600',
    },
    {
      icon: <Users className="h-8 w-8 text-green-600" />,
      title: 'Join a Shared Ride Group',
      description: 'AI groups nearby commuters together for the fastest ride home.',
      color: 'bg-green-100 text-green-600',
    },
    {
      icon: <IndianRupee className="h-8 w-8 text-purple-600" />,
      title: 'Pay Only Your Share',
      description: 'Fare split automatically with full transparency on pricing.',
      color: 'bg-purple-100 text-purple-600',
    },
  ]

  useEffect(() => {
    setMounted(true)
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/auth/login')
        return
      }
      setUserId(user.id)
      setUserEmail(user.email || null)
      setUserName(user.user_metadata?.full_name || user.user_metadata?.name || 'User')
      setUserRole(user.user_metadata?.role || 'rider')
    }
    checkUser()
  }, [supabase, router])
  
  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  const nextStep = () => setCurrentStep((prev) => Math.min(prev + 1, totalSteps))
  const prevStep = () => setCurrentStep((prev) => Math.max(prev - 1, 1))

  const filteredStations = MUMBAI_METRO_STATIONS.filter((s) =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  ).slice(0, 5)

  const handleCompleteOnboarding = async () => {
    if (!userId || !selectedStation) return
    if (isDriver && (!vehicleType || !vehicleNumber.trim())) {
      toast.error('Please enter your vehicle details')
      return
    }

    try {
      // Frontend station IDs are now the actual database UUIDs — use directly
      const station = MUMBAI_METRO_STATIONS.find(s => s.id === selectedStation)
      if (!station) throw new Error('Station not found in local list')

      const stationUUID = station.id

      // 2. Perform upsert with the real UUID + vehicle info for drivers
      const upsertData: any = {
        id: userId,
        email: userEmail,
        name: userName,
        home_station_id: stationUUID,
        onboarding_complete: true,
        role: userRole || 'rider',
      }

      if (isDriver) {
        upsertData.vehicle_type = vehicleType
        upsertData.vehicle_number = vehicleNumber.trim().toUpperCase()
      }

      const { error } = await supabase
        .from('users')
        .upsert(upsertData)

      if (error) throw error

      toast.success('Onboarding complete!')
      router.push(userRole === 'driver' ? '/driver/dashboard' : '/rider/dashboard')
    } catch (error: any) {
      toast.error('Failed to save onboarding data: ' + error.message)
    }
  }

  const handleRequestNotifications = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission()
      if (permission === 'granted') {
        toast.success('Notifications enabled!')
      } else {
        toast.info('Notifications were not enabled.')
      }
    }
    nextStep()
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 py-12 dark:bg-slate-950">
      <div className="w-full max-w-2xl space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-teal-700">Welcome to SmartHop</h1>
          <p className="mt-2 text-slate-600 dark:text-slate-400">Let's get you set up in just a few clicks.</p>
        </div>

        {mounted && (
          <div className="fixed top-4 right-4">
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-slate-500 hover:text-teal-700"
              onClick={handleSignOut}
            >
              <LogOut className="mr-2 h-4 w-4" /> Sign Out
            </Button>
          </div>
        )}

        <StepIndicator steps={STEPS} currentStep={currentStep} />

        <div className="relative overflow-hidden min-h-[400px]">
          <AnimatePresence mode="wait">
            {currentStep === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <Card>
                  <CardHeader>
                    <CardTitle>Select Your Primary Station</CardTitle>
                    <CardDescription>
                      Which metro station do you use most often? We'll use this to optimize your shared ride matches.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <Input
                        placeholder="Search stations..."
                        className="pl-10"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                    
                    <div className="grid gap-2">
                      {filteredStations.map((station) => (
                        <button
                          key={station.id}
                          onClick={() => setSelectedStation(station.id)}
                          className={cn(
                            "flex items-center justify-between rounded-lg border p-4 text-left transition-all hover:bg-slate-50",
                            selectedStation === station.id 
                              ? "border-teal-700 bg-teal-50 ring-1 ring-teal-700" 
                              : "border-slate-200"
                          )}
                        >
                          <div className="flex items-center space-x-3">
                            <MapPin className={cn("h-5 w-5", selectedStation === station.id ? "text-teal-700" : "text-slate-400")} />
                            <div>
                              <p className="font-medium">{station.name}</p>
                              <p className="text-xs text-slate-500">{station.line}</p>
                            </div>
                          </div>
                          {selectedStation === station.id && <CheckCircle className="h-5 w-5 text-teal-700" />}
                        </button>
                      ))}
                    </div>

                    <Button 
                      className="w-full bg-teal-700 hover:bg-blue-700" 
                      onClick={nextStep}
                      disabled={!selectedStation}
                    >
                      Next Step <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Step 2 for Drivers: Vehicle Info */}
            {isDriver && currentStep === 2 && (
              <motion.div
                key="step2-vehicle"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <Card>
                  <CardHeader>
                    <CardTitle>Your Vehicle Details</CardTitle>
                    <CardDescription>
                      Enter your vehicle type and registration number. This determines how many riders you can carry.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div>
                      <Label className="text-sm font-semibold text-slate-600 mb-3 block">Vehicle Type</Label>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          onClick={() => setVehicleType('auto')}
                          className={cn(
                            "flex flex-col items-center gap-2 rounded-xl border-2 p-5 transition-all",
                            vehicleType === 'auto'
                              ? "border-teal-700 bg-teal-50 ring-1 ring-teal-700"
                              : "border-slate-200 hover:bg-slate-50"
                          )}
                        >
                          <Bike className={cn("h-8 w-8", vehicleType === 'auto' ? 'text-teal-700' : 'text-slate-400')} />
                          <span className="font-semibold text-sm">Auto Rickshaw</span>
                          <span className="text-xs text-slate-500">Max 3 riders</span>
                        </button>
                        <button
                          onClick={() => setVehicleType('car')}
                          className={cn(
                            "flex flex-col items-center gap-2 rounded-xl border-2 p-5 transition-all",
                            vehicleType === 'car'
                              ? "border-teal-700 bg-teal-50 ring-1 ring-teal-700"
                              : "border-slate-200 hover:bg-slate-50"
                          )}
                        >
                          <Car className={cn("h-8 w-8", vehicleType === 'car' ? 'text-teal-700' : 'text-slate-400')} />
                          <span className="font-semibold text-sm">Car</span>
                          <span className="text-xs text-slate-500">Max 4 riders</span>
                        </button>
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="vehicle-number" className="text-sm font-semibold text-slate-600">Vehicle Number</Label>
                      <Input
                        id="vehicle-number"
                        placeholder="e.g. MH 02 AB 1234"
                        className="mt-2 uppercase"
                        value={vehicleNumber}
                        onChange={(e) => setVehicleNumber(e.target.value)}
                      />
                    </div>

                    <Button
                      className="w-full bg-teal-700 hover:bg-blue-700"
                      disabled={!vehicleType || !vehicleNumber.trim()}
                      onClick={nextStep}
                    >
                      Next Step <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Notifications step */}
            {currentStep === notifStep && (
              <motion.div
                key="step-notif"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <Card>
                  <CardHeader className="text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-teal-100 dark:bg-blue-900/20">
                      <Bell className="h-8 w-8 text-teal-700" />
                    </div>
                    <CardTitle>Stay Updated</CardTitle>
                    <CardDescription>
                      Enable notifications to get real-time updates on your ride matches, driver location, and metro delays.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Button className="w-full bg-teal-700 hover:bg-blue-700" onClick={handleRequestNotifications}>
                      Enable Notifications
                    </Button>
                    <Button variant="outline" className="w-full" onClick={nextStep}>
                      Maybe Later
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {currentStep === tutorialStep && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <Card>
                  <CardHeader>
                    <CardTitle>How SmartHop Works</CardTitle>
                    <CardDescription>Quick guide to get you moving.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={tutorialSlide}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="flex flex-col items-center text-center space-y-4 py-4"
                      >
                        <div className={cn("flex h-20 w-20 items-center justify-center rounded-full", TUTORIAL_SLIDES[tutorialSlide].color)}>
                          {React.cloneElement(TUTORIAL_SLIDES[tutorialSlide].icon as React.ReactElement<any>, { className: "h-10 w-10" })}
                        </div>
                        <h3 className="text-xl font-bold">{TUTORIAL_SLIDES[tutorialSlide].title}</h3>
                        <p className="text-slate-600 dark:text-slate-400">
                          {TUTORIAL_SLIDES[tutorialSlide].description}
                        </p>
                      </motion.div>
                    </AnimatePresence>

                    {/* Dot Indicators */}
                    <div className="flex justify-center space-x-2">
                      {TUTORIAL_SLIDES.map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setTutorialSlide(i)}
                          className={cn(
                            "h-2 w-2 rounded-full transition-all",
                            tutorialSlide === i ? "w-6 bg-teal-700" : "bg-slate-300"
                          )}
                        />
                      ))}
                    </div>

                    <div className="flex space-x-4 pt-4">
                      {tutorialSlide === 0 ? (
                        <Button variant="outline" className="flex-1" onClick={prevStep}>
                          Back to Start
                        </Button>
                      ) : (
                        <Button variant="outline" className="flex-1" onClick={() => setTutorialSlide(prev => prev - 1)}>
                          Previous
                        </Button>
                      )}
                      
                      {tutorialSlide < TUTORIAL_SLIDES.length - 1 ? (
                        <Button className="flex-1 bg-teal-700 hover:bg-blue-700" onClick={() => setTutorialSlide(prev => prev + 1)}>
                          Next
                        </Button>
                      ) : (
                        <Button className="flex-1 bg-teal-700 hover:bg-blue-700" onClick={handleCompleteOnboarding}>
                          Get Started
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
