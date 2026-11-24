import type { SupabaseClient } from "@supabase/supabase-js"

export type SessionProfileType = "buyer" | "supplier" | "requester"

export type SessionUser = {
  userId: string
  email: string | null
  fullName: string | null
  profileCompanyId: string | null
  companyName: string | null
  supplierId: string | null
  profileType: SessionProfileType
  roles: string[]
  isSuperAdmin: boolean
}

type ProfileRow = {
  company_id?: string | null
  supplier_id?: string | null
  is_superadmin?: boolean | null
  role?: string | null
  roles?: string[] | null
  profile_type?: string | null
  full_name?: string | null
  companies?: { name: string } | { name: string }[] | null
}

function normalizeProfileType(raw: string | null | undefined): SessionProfileType {
  if (raw === "supplier") return "supplier"
  if (raw === "requester") return "requester"
  return "buyer"
}

function companyNameFromEmbed(
  companies: ProfileRow["companies"],
): string | null {
  if (Array.isArray(companies) && companies[0]?.name) {
    return String(companies[0].name)
  }
  if (companies && typeof companies === "object" && "name" in companies) {
    return String((companies as { name: string }).name)
  }
  return null
}

export function sessionUserFromProfile(
  userId: string,
  email: string | null,
  profile: ProfileRow | null,
): SessionUser {
  const rolesFromArray = Array.isArray(profile?.roles)
    ? profile.roles.filter((r): r is string => typeof r === "string" && r.length > 0)
    : []
  const roles =
    rolesFromArray.length > 0 ? rolesFromArray : profile?.role ? [profile.role] : []

  return {
    userId,
    email,
    fullName: profile?.full_name ?? null,
    profileCompanyId: profile?.company_id ?? null,
    companyName: companyNameFromEmbed(profile?.companies ?? null),
    supplierId: profile?.supplier_id ?? null,
    profileType: normalizeProfileType(profile?.profile_type),
    roles,
    isSuperAdmin: Boolean(profile?.is_superadmin),
  }
}

/** Carrega o usuário da sessão no servidor (layouts autenticados). */
export async function loadSessionUser(
  supabase: SupabaseClient,
): Promise<SessionUser | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "company_id, supplier_id, is_superadmin, role, roles, profile_type, full_name, companies(name)",
    )
    .eq("id", user.id)
    .single()

  return sessionUserFromProfile(user.id, user.email ?? null, profile as ProfileRow | null)
}
