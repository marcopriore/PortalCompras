import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { isTenantFeatureEnabled } from "@/lib/api/external/check-tenant-feature"

export async function requireSuperAdminCompany(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_superadmin")
    .eq("id", user.id)
    .single()

  if (!profile?.is_superadmin) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }

  const { searchParams } = new URL(request.url)
  const companyId = searchParams.get("company_id")?.trim()
  if (!companyId) {
    return { error: NextResponse.json({ error: "company_id é obrigatório." }, { status: 400 }) }
  }

  const enabled = await isTenantFeatureEnabled(companyId, "api_integrations")
  if (!enabled) {
    return {
      error: NextResponse.json(
        { error: "Módulo api_integrations não habilitado para este tenant." },
        { status: 403 },
      ),
    }
  }

  return { user, companyId }
}
