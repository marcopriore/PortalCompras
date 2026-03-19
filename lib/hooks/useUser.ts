'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export function useUser() {
  const [userId, setUserId] = useState<string | null>(null)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [role, setRole] = useState<string | null>(null)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    supabase.auth.getUser().then(async ({ data }) => {
      const user = data.user
      if (!user) {
        setLoading(false)
        return
      }

      setUserId(user.id)

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id, is_superadmin, role')
        .eq('id', user.id)
        .single()
      const superFlag = Boolean((profile as any)?.is_superadmin)
      setIsSuperAdmin(superFlag)
      // Se superadmin, verificar cookie de tenant selecionado
      let effectiveCompanyId: string | null = profile?.company_id ?? null
      if (profile?.is_superadmin && typeof document !== 'undefined') {
        const cookieValue = document.cookie
          .split('; ')
          .find((row) => row.startsWith('selected_company_id='))
          ?.split('=')[1]
        if (cookieValue) {
          try {
            effectiveCompanyId = decodeURIComponent(cookieValue)
          } catch {
            effectiveCompanyId = cookieValue
          }
        }
      }
      setCompanyId(effectiveCompanyId)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleFocus = () => {
      const cookieValue = document.cookie
        .split('; ')
        .find((row) => row.startsWith('selected_company_id='))
        ?.split('=')[1]

      const decoded = cookieValue ? decodeURIComponent(cookieValue) : null

      setCompanyId((prev) => (decoded !== null ? decoded : prev))
    }

    window.addEventListener('focus', handleFocus)
    return () => {
      window.removeEventListener('focus', handleFocus)
    }
  }, [])

  return { userId, companyId, role, isSuperAdmin, loading }
}

