'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTenant } from '@/contexts/tenant-context'

type ProfileRow = {
  company_id?: string | null
  supplier_id?: string | null
  is_superadmin?: boolean
  role?: string | null
  roles?: string[] | null
  profile_type?: string | null
  full_name?: string | null
  companies?: { name: string } | { name: string }[] | null
}

export function useUser() {
  const { companyId: tenantCompanyId } = useTenant()
  const [userId, setUserId] = useState<string | null>(null)
  const [supplierId, setSupplierId] = useState<string | null>(null)
  const [companyName, setCompanyName] = useState<string | null>(null)
  const [profileType, setProfileType] = useState<'buyer' | 'supplier' | 'requester' | null>(null)
  const [fullName, setFullName] = useState<string | null>(null)
  const [roles, setRoles] = useState<string[]>([])
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    let cancelled = false

    const clearUser = () => {
      setUserId(null)
      setSupplierId(null)
      setCompanyName(null)
      setProfileType(null)
      setFullName(null)
      setRoles([])
      setIsSuperAdmin(false)
    }

    const loadProfile = async (userId: string) => {
      const { data: profile } = await supabase
        .from('profiles')
        .select(
          'company_id, supplier_id, is_superadmin, role, roles, profile_type, full_name, companies(name)',
        )
        .eq('id', userId)
        .single()

      if (cancelled) return

      const p = profile as ProfileRow | null
      const rawType = p?.profile_type ?? 'buyer'
      const pt =
        rawType === 'supplier'
          ? 'supplier'
          : rawType === 'requester'
            ? 'requester'
            : 'buyer'
      setProfileType(pt)
      setSupplierId(p?.supplier_id ?? null)
      setFullName(p?.full_name ?? null)
      const co = p?.companies
      let embeddedName: string | null = null
      if (Array.isArray(co) && co[0]?.name) {
        embeddedName = String(co[0].name)
      } else if (co && typeof co === 'object' && 'name' in co) {
        embeddedName = String((co as { name: string }).name)
      }
      setCompanyName(embeddedName)
      setIsSuperAdmin(Boolean(p?.is_superadmin))
      setRoles(
        Array.isArray(p?.roles) ? p.roles : p?.role ? [p.role] : [],
      )
      setLoading(false)
    }

    const syncFromSession = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()
        const user = session?.user

        if (cancelled) return

        if (!user) {
          clearUser()
          setLoading(false)
          return
        }

        setUserId(user.id)
        await loadProfile(user.id)
      } catch {
        if (!cancelled) {
          clearUser()
          setLoading(false)
        }
      }
    }

    void syncFromSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return

      const user = session?.user
      if (!user) {
        clearUser()
        setLoading(false)
        return
      }

      setUserId(user.id)
      void loadProfile(user.id)
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  const role = roles[0] ?? ''
  const hasRole = useCallback((r: string) => roles.includes(r), [roles])

  return {
    userId,
    supplierId,
    companyId: tenantCompanyId,
    companyName,
    profileType,
    fullName,
    role,
    roles,
    hasRole,
    isSuperAdmin,
    loading,
  }
}
