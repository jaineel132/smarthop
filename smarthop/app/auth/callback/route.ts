import { createSupabaseServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createSupabaseServerClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        // Check if user exists in public.users
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('role, onboarding_complete')
          .eq('id', user.id)
          .single()

        if (userError && userError.code === 'PGRST116') {
          // User doesn't exist, insert new row
          const { error: insertError } = await supabase
            .from('users')
            .insert({
              id: user.id,
              email: user.email,
              name: user.user_metadata.full_name || user.user_metadata.name || 'User',
              role: 'rider', // Default role for OAuth users initially
              onboarding_complete: false
            })
          
          if (!insertError) {
            return NextResponse.redirect(`${origin}/onboarding`)
          }
        } else if (userData) {
          if (!userData.onboarding_complete) {
            return NextResponse.redirect(`${origin}/onboarding`)
          }
          const dashboard = userData.role === 'admin' ? '/admin/overview' : `/${userData.role}/dashboard`
          return NextResponse.redirect(`${origin}${dashboard}`)
        }
      }
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth/login?error=auth-callback-error`)
}
