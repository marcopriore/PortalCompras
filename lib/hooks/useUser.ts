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

    supabase.auth.getUser().then(async ({ data }) => {
      const user = data.user
      if (!user) {
        setUserId(null)
        setSupplierId(null)
        setCompanyName(null)
        setProfileType(null)
        setFullName(null)
        setRoles([])
        setIsSuperAdmin(false)
        setLoading(false)
        return
      }

      setUserId(user.id)

      const { data: profile } = await supabase
        .from('profiles')
        .select(
          'company_id, supplier_id, is_superadmin, role, roles, profile_type, full_name, companies(name)',
        )
        .eq('id', user.id)
        .single()
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
      const superFlag = Boolean(p?.is_superadmin)
      setIsSuperAdmin(superFlag)
      const rolesArray = Array.isArray(p?.roles)
        ? p.roles
        : p?.role
          ? [p.role]
          : []
      setRoles(rolesArray)
      setLoading(false)
    })
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
