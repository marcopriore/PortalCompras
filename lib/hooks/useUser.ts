'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTenant } from '@/contexts/tenant-context'
import { useImpersonation } from '@/contexts/impersonation-context'

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
  const { isImpersonating, session: impersonationSession } = useImpersonation()
  const [userId, setUserId] = useState<string | null>(null)
  const [supplierId, setSupplierId] = useState<string | null>(null)
  const [profileCompanyId, setProfileCompanyId] = useState<string | null>(null)
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
      setProfileCompanyId(null)
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
      setProfileCompanyId(p?.company_id ?? null)
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
      const rolesFromArray = Array.isArray(p?.roles)
        ? p.roles.filter((r): r is string => typeof r === 'string' && r.length > 0)
        : []
      // roles DEFAULT '{}' no banco — se vazio, cair no role legado (ex.: admin na criação)
      setRoles(
        rolesFromArray.length > 0
          ? rolesFromArray
          : p?.role
            ? [p.role]
            : [],
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
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return

      // TOKEN_REFRESHED dispara ao focar a aba/janela — não recarregar perfil
      // (evita flash de "Carregando…" e re-renders em cascata).
      if (event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION") {
        return
      }

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

  const effectiveRoles = isImpersonating
    ? (impersonationSession?.impersonatedRoles ?? roles)
    : roles

  const effectiveProfileType = isImpersonating
    ? (impersonationSession?.impersonatedProfileType ?? profileType)
    : profileType

  const effectiveFullName = isImpersonating
    ? (impersonationSession?.impersonatedName ?? fullName)
    : fullName

  const effectiveIsSuperAdmin = isImpersonating ? false : isSuperAdmin

  const effectiveHasRole = useCallback(
    (r: string) => effectiveRoles.includes(r),
    [effectiveRoles],
  )

  return {
    userId,
    actorUserId: userId,
    impersonatedUserId: isImpersonating ? impersonationSession?.impersonatedUserId ?? null : null,
    supplierId,
    companyId: tenantCompanyId ?? profileCompanyId,
    companyName,
    profileType: effectiveProfileType,
    fullName: effectiveFullName,
    role: effectiveRoles[0] ?? role,
    roles: effectiveRoles,
    hasRole: effectiveHasRole,
    isSuperAdmin: effectiveIsSuperAdmin,
    isImpersonating,
    loading,
  }
}
