'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type ProfileRow = {
  company_id?: string | null
  is_superadmin?: boolean
  role?: string | null
  roles?: string[] | null
}

export function useUser() {
  const [userId, setUserId] = useState<string | null>(null)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [roles, setRoles] = useState<string[]>([])
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
        .select('company_id, is_superadmin, role, roles')
        .eq('id', user.id)
        .single()
      const p = profile as ProfileRow | null
      const superFlag = Boolean(p?.is_superadmin)
      setIsSuperAdmin(superFlag)
      const rolesArray = Array.isArray(p?.roles)
        ? p.roles
        : p?.role
          ? [p.role]
          : []
      setRoles(rolesArray)
      // Se superadmin, verificar cookie de tenant selecionado
      let effectiveCompanyId: string | null = p?.company_id ?? null
      if (p?.is_superadmin && typeof document !== 'undefined') {
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

  const role = roles[0] ?? ''
  const hasRole = useCallback((r: string) => roles.includes(r), [roles])

  return {
    userId,
    companyId,
    role,
    roles,
    hasRole,
    isSuperAdmin,
    loading,
  }
}

