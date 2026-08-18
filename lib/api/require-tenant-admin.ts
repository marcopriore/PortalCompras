import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { isTenantFeatureEnabled } from "@/lib/api/external/check-tenant-feature"

export async function requireTenantAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, company_id, role, roles, is_superadmin")
    .eq("id", user.id)
    .single()

  if (!profile?.company_id) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }

  const roles = (profile.roles as string[] | null) ?? []
  const isAdmin = profile.role === "admin" || roles.includes("admin")

  if (!isAdmin) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }

  let companyId = profile.company_id as string
  if (profile.is_superadmin) {
    const cookieStore = await cookies()
    const selectedCookie = cookieStore.get("selected_company_id")
    if (selectedCookie?.value) {
      companyId = decodeURIComponent(selectedCookie.value)
    }
  }

  return { supabase, user, profile, companyId }
}

export async function requireIntegrationsAdmin() {
  const auth = await requireTenantAdmin()
  if ("error" in auth) return auth

  const enabled = await isTenantFeatureEnabled(auth.companyId, "api_integrations")
  if (!enabled) {
    return {
      error: NextResponse.json(
        { error: "Módulo de integrações não habilitado para este tenant." },
        { status: 403 },
      ),
    }
  }

  return auth
}
