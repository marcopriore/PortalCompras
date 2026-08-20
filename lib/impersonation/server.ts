import { cookies } from "next/headers"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import {
  IMPERSONATED_USER_COOKIE,
  IMPERSONATION_PERMISSION,
  type ImpersonationSession,
} from "@/lib/impersonation/constants"

const COOKIE_MAX_AGE = 60 * 60 * 24 // 24h

export function impersonationCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  }
}

export async function getImpersonatedUserIdFromCookies(): Promise<string | null> {
  const cookieStore = await cookies()
  const value = cookieStore.get(IMPERSONATED_USER_COOKIE)?.value
  return value ? decodeURIComponent(value) : null
}

export async function clearImpersonationCookies(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(IMPERSONATED_USER_COOKIE)
}

export async function setImpersonationCookie(userId: string): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(
    IMPERSONATED_USER_COOKIE,
    encodeURIComponent(userId),
    impersonationCookieOptions(),
  )
}

export async function canUserImpersonate(
  actorUserId: string,
  companyId: string,
  isSuperAdmin: boolean,
): Promise<boolean> {
  if (isSuperAdmin) return true

  const supabase = createServiceRoleClient()
  const { data } = await supabase
    .from("profile_permissions")
    .select("enabled")
    .eq("company_id", companyId)
    .eq("user_id", actorUserId)
    .eq("permission_key", IMPERSONATION_PERMISSION)
    .maybeSingle()

  return Boolean(data?.enabled)
}

function resolveProfileType(
  profileType: string | null,
  roles: string[],
): "buyer" | "requester" | "supplier" {
  if (profileType === "supplier") return "supplier"
  if (profileType === "requester" || roles.includes("requester")) return "requester"
  return "buyer"
}

export async function loadImpersonationSession(
  actorUserId: string,
  companyId: string,
): Promise<ImpersonationSession | null> {
  const impersonatedUserId = await getImpersonatedUserIdFromCookies()
  if (!impersonatedUserId) return null

  const supabase = createServiceRoleClient()
  const { data: target } = await supabase
    .from("profiles")
    .select("id, company_id, full_name, roles, role, profile_type, status, is_superadmin")
    .eq("id", impersonatedUserId)
    .maybeSingle()

  if (!target || target.company_id !== companyId || target.status !== "active") {
    await clearImpersonationCookies()
    return null
  }

  if (target.is_superadmin) {
    await clearImpersonationCookies()
    return null
  }

  if (target.profile_type === "supplier") {
    await clearImpersonationCookies()
    return null
  }

  if (impersonatedUserId === actorUserId) {
    await clearImpersonationCookies()
    return null
  }

  const roles = Array.isArray(target.roles)
    ? target.roles
    : target.role
      ? [target.role]
      : []

  if (target.role === "supplier" || roles.includes("supplier")) {
    await clearImpersonationCookies()
    return null
  }

  return {
    actorUserId,
    impersonatedUserId,
    impersonatedName: target.full_name ?? null,
    impersonatedRoles: roles,
    impersonatedProfileType: resolveProfileType(target.profile_type, roles),
  }
}

export function getImpersonationRedirectPath(
  profileType: "buyer" | "requester" | "supplier",
): string {
  if (profileType === "requester") return "/solicitante"
  return "/comprador"
}
