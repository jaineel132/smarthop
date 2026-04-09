'use client'

import { useEffect, useState, useRef } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { User, Session } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [role, setRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [supabase] = useState(() => createSupabaseBrowserClient())
  const router = useRouter()
  const fetchingRole = useRef(false)

  useEffect(() => {
    let isMounted = true

    const fetchRole = async (userId: string) => {
      // Debounce: skip if already fetching
      if (fetchingRole.current) return
      fetchingRole.current = true

      try {
        const { data: userData } = await supabase
          .from('users')
          .select('role')
          .eq('id', userId)
          .single()

        if (isMounted) {
          setRole(userData?.role || null)
        }
      } catch (err) {
        // Silently handle lock errors or network issues
        console.warn('Role fetch error (non-fatal):', err)
      } finally {
        fetchingRole.current = false
        if (isMounted) setLoading(false)
      }
    }

    const handleSession = (session: Session | null) => {
      if (!isMounted) return

      if (session?.user) {
        setUser(session.user)
        setLoading(true)

        // Defer role fetch until after auth callback completes to avoid lock contention.
        setTimeout(() => {
          if (isMounted) {
            void fetchRole(session.user.id)
          }
        }, 0)
      } else {
        setUser(null)
        setRole(null)
        setLoading(false)
      }
    }

    void supabase.auth.getSession().then(({ data }) => {
      handleSession(data.session)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      handleSession(session)

      if (event === 'SIGNED_OUT' && isMounted) {
        router.push('/auth/login')
      }
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [router, supabase])

  const signOut = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  return { user, role, loading, signOut }
}
