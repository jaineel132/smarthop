'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { User, Car, CheckCircle2, Eye, EyeOff, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const signupSchema = z.object({
  fullName: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

type SignupFormValues = z.infer<typeof signupSchema>

export default function SignupPage() {
  const router = useRouter()
  const supabase = createSupabaseBrowserClient()
  const [role, setRole] = useState<'rider' | 'driver'>('rider')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
  })

  const onSubmit = async (values: SignupFormValues) => {
    setIsLoading(true)
    try {
      const { data, error } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          data: {
            full_name: values.fullName,
            role: role,
          },
        },
      })

      if (error) throw error

      if (data.user) {
        // Attempt to insert into public.users, but don't block if RLS fails 
        // (as the Database Trigger or Auth Callback will handle it robustly)
        try {
          await supabase.from('users').insert({
            id: data.user.id,
            email: values.email,
            name: values.fullName,
            role: role,
            onboarding_complete: false,
          })
        } catch (e) {
          console.warn('Initial profile insert failed (likely RLS), redirection will continue:', e)
        }

        toast.success('Account created successfully!')
        router.push('/onboarding')
      }
    } catch (error: any) {
      toast.error(error.message || 'An error occurred during signup')
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      if (error) throw error
    } catch (error: any) {
      toast.error(error.message)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12 dark:bg-slate-950">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md space-y-8"
      >
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-teal-700">SmartHop</h1>
          <p className="mt-2 text-slate-600 dark:text-slate-400">Mumbai Metro Last-Mile Rides</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Card
            onClick={() => setRole('rider')}
            className={`cursor-pointer transition-all ${
              role === 'rider'
                ? 'border-teal-700 bg-teal-50 dark:bg-blue-900/20'
                : 'hover:border-slate-300'
            }`}
          >
            <CardContent className="relative flex flex-col items-center justify-center p-6 text-center">
              {role === 'rider' && (
                <Badge className="absolute right-2 top-2 bg-teal-700 p-0 text-white">
                  <CheckCircle2 className="h-4 w-4" />
                </Badge>
              )}
              <User className={`h-8 w-8 ${role === 'rider' ? 'text-teal-700' : 'text-slate-400'}`} />
              <span className="mt-2 block font-medium">I am a Rider</span>
              <span className="text-xs text-slate-500">Book shared rides from metro</span>
            </CardContent>
          </Card>

          <Card
            onClick={() => setRole('driver')}
            className={`cursor-pointer transition-all ${
              role === 'driver'
                ? 'border-teal-700 bg-teal-50 dark:bg-blue-900/20'
                : 'hover:border-slate-300'
            }`}
          >
            <CardContent className="relative flex flex-col items-center justify-center p-6 text-center">
              {role === 'driver' && (
                <Badge className="absolute right-2 top-2 bg-teal-700 p-0 text-white">
                  <CheckCircle2 className="h-4 w-4" />
                </Badge>
              )}
              <Car className={`h-8 w-8 ${role === 'driver' ? 'text-teal-700' : 'text-slate-400'}`} />
              <span className="mt-2 block font-medium">I am a Driver</span>
              <span className="text-xs text-slate-500">Earn driving shared rides</span>
            </CardContent>
          </Card>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input
              id="fullName"
              placeholder="John Doe"
              {...register('fullName')}
              className={errors.fullName ? 'border-red-500' : ''}
            />
            {errors.fullName && <p className="text-xs text-red-500">{errors.fullName.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="john@example.com"
              {...register('email')}
              className={errors.email ? 'border-red-500' : ''}
            />
            {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                {...register('password')}
                className={errors.password ? 'border-red-500' : ''}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.password && <p className="text-xs text-red-500">{errors.password.message}</p>}
          </div>

          <Button type="submit" className="w-full bg-teal-700 hover:bg-blue-700" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating account...
              </>
            ) : (
              'Create Account'
            )}
          </Button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-slate-300" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-slate-50 px-2 text-slate-500 dark:bg-slate-950">or</span>
          </div>
        </div>

        <Button
          variant="outline"
          type="button"
          className="w-full"
          onClick={handleGoogleLogin}
          disabled={isLoading}
        >
          <svg className="mr-2 h-4 w-4" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512">
            <path fill="currentColor" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"></path>
          </svg>
          Sign up with Google
        </Button>

        <p className="text-center text-sm text-slate-600 dark:text-slate-400">
          Already have an account?{' '}
          <Link href="/auth/login" className="font-semibold text-teal-700 hover:text-blue-700">
            Log in
          </Link>
        </p>
      </motion.div>
    </div>
  )
}
