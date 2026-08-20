import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { clearImpersonationCookies } from '@/lib/impersonation/server'

export async function POST() {
  const supabase = await createClient()

  await clearImpersonationCookies()
  await supabase.auth.signOut()

  const redirectUrl = new URL('/login', process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000')

  return NextResponse.redirect(redirectUrl, {
    headers: {
      'Cache-Control': 'no-store',
    },
  })
}

