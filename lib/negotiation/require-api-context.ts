import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { isTenantFeatureEnabled } from "@/lib/api/external/check-tenant-feature"

export type NegotiationApiContext =
  | { ok: true; userId: string; companyId: string }
  | { ok: false; status: number; error: string }

export async function requireNegotiationApiContext(): Promise<NegotiationApiContext> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, status: 401, error: "Unauthorized" }
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id, profile_type, is_superadmin")
    .eq("id", user.id)
    .single()

  if (!profile || profile.profile_type !== "buyer") {
    return { ok: false, status: 403, error: "Forbidden" }
  }

  let companyId = profile.company_id as string | null
  if (profile.is_superadmin) {
    const cookieStore = await cookies()
    const selected = cookieStore.get("selected_company_id")?.value
    if (selected) companyId = decodeURIComponent(selected)
  }

  if (!companyId) {
    return { ok: false, status: 404, error: "Company not found" }
  }

  const [negotiation, autonomous] = await Promise.all([
    isTenantFeatureEnabled(companyId, "ai_negotiation"),
    isTenantFeatureEnabled(companyId, "ai_negotiation_autonomous"),
  ])

  if (!negotiation || !autonomous) {
    return {
      ok: false,
      status: 403,
      error: "Negociação assistida por IA não habilitada para este tenant.",
    }
  }

  return { ok: true, userId: user.id, companyId }
}
