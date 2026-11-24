"use client"

import { useCallback, useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useTenant } from "@/contexts/tenant-context"
import { useImpersonation } from "@/contexts/impersonation-context"
import { useSessionUserInitial } from "@/contexts/session-user-context"
import {
  sessionUserFromProfile,
  type SessionProfileType,
  type SessionUser,
} from "@/lib/auth/session-user"

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

function toState(user: SessionUser | null) {
  return {
    userId: user?.userId ?? null,
    supplierId: user?.supplierId ?? null,
    profileCompanyId: user?.profileCompanyId ?? null,
    companyName: user?.companyName ?? null,
    profileType: (user?.profileType ?? null) as SessionProfileType | null,
    fullName: user?.fullName ?? null,
    roles: user?.roles ?? [],
    isSuperAdmin: user?.isSuperAdmin ?? false,
  }
}

/**
 * Identidade do usuário.
 * Preferência: payload do layout (SessionUserProvider).
 * Exceção documentada: sync Auth via onAuthStateChange quando sessão muda
 * (login/logout) — inevitável no client.
 */
export function useUser() {
  const initial = useSessionUserInitial()
  const { companyId: tenantCompanyId } = useTenant()
  const { isImpersonating, session: impersonationSession } = useImpersonation()

  const seeded = toState(initial)
  const [userId, setUserId] = useState<string | null>(seeded.userId)
  const [supplierId, setSupplierId] = useState<string | null>(seeded.supplierId)
  const [profileCompanyId, setProfileCompanyId] = useState<string | null>(
    seeded.profileCompanyId,
  )
  const [companyName, setCompanyName] = useState<string | null>(seeded.companyName)
  const [profileType, setProfileType] = useState<SessionProfileType | null>(
    seeded.profileType,
  )
  const [fullName, setFullName] = useState<string | null>(seeded.fullName)
  const [roles, setRoles] = useState<string[]>(seeded.roles)
  const [isSuperAdmin, setIsSuperAdmin] = useState(seeded.isSuperAdmin)
  const [loading, setLoading] = useState(!initial)

  /* eslint-disable react-hooks/set-state-in-effect -- sync SessionUser do layout quando initial muda */
  useEffect(() => {
    if (initial) {
      const next = toState(initial)
      setUserId(next.userId)
      setSupplierId(next.supplierId)
      setProfileCompanyId(next.profileCompanyId)
      setCompanyName(next.companyName)
      setProfileType(next.profileType)
      setFullName(next.fullName)
      setRoles(next.roles)
      setIsSuperAdmin(next.isSuperAdmin)
      setLoading(false)
    }
  }, [initial])
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    const supabase = createClient()
    let cancelled = false

    const applyUser = (user: SessionUser | null) => {
      const next = toState(user)
      setUserId(next.userId)
      setSupplierId(next.supplierId)
      setProfileCompanyId(next.profileCompanyId)
      setCompanyName(next.companyName)
      setProfileType(next.profileType)
      setFullName(next.fullName)
      setRoles(next.roles)
      setIsSuperAdmin(next.isSuperAdmin)
      setLoading(false)
    }

    const loadProfile = async (uid: string) => {
      const { data: profile } = await supabase
        .from("profiles")
        .select(
          "company_id, supplier_id, is_superadmin, role, roles, profile_type, full_name, companies(name)",
        )
        .eq("id", uid)
        .single()

      if (cancelled) return
      applyUser(
        sessionUserFromProfile(uid, null, profile as ProfileRow | null),
      )
    }

    // Se o layout já entregou o usuário, só escuta mudanças de auth (sem getSession inicial).
    if (!initial) {
      void (async () => {
        try {
          const {
            data: { session },
          } = await supabase.auth.getSession()
          if (cancelled) return
          const user = session?.user
          if (!user) {
            applyUser(null)
            return
          }
          setUserId(user.id)
          await loadProfile(user.id)
        } catch {
          if (!cancelled) applyUser(null)
        }
      })()
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return
      if (event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION") return

      const user = session?.user
      if (!user) {
        applyUser(null)
        return
      }
      setUserId(user.id)
      void loadProfile(user.id)
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [initial])

  const role = roles[0] ?? ""

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
    impersonatedUserId: isImpersonating
      ? (impersonationSession?.impersonatedUserId ?? null)
      : null,
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
