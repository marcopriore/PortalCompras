import type { SessionUser } from "@/lib/auth/session-user"

/** Escopo conservador no SSR: superadmin vê all; demais só userId (client refetch se view_all). */
export function resolveListPrefetchScope(sessionUser: SessionUser): "all" | string {
  return sessionUser.isSuperAdmin ? "all" : sessionUser.userId
}

export function resolvePrefetchCompanyId(
  sessionUser: SessionUser,
  selectedCompanyIdCookie: string | undefined,
): string | null {
  return (
    selectedCompanyIdCookie?.trim() ||
    sessionUser.profileCompanyId?.trim() ||
    null
  )
}