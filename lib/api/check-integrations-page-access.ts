import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { isTenantFeatureEnabled } from "@/lib/api/external/check-tenant-feature"
import {
  hasUserPermission,
  loadUserPermissionKeys,
} from "@/lib/permissions/resolve-user-permissions"

export type IntegrationsPageAccess =
  | {
      allowed: true
      userId: string
      companyId: string
    }
  | {
      allowed: false
      reason: "unauthenticated" | "forbidden" | "feature_disabled"
    }

export async function getIntegrationsPageAccess(): Promise<IntegrationsPageAccess> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { allowed: false, reason: "unauthenticated" }
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id, is_superadmin, profile_type")
    .eq("id", user.id)
    .single()

  if (!profile?.company_id) {
    return { allowed: false, reason: "forbidden" }
  }

  const profileType = (profile.profile_type as string | null) ?? "buyer"
  if (profileType === "supplier") {
    return { allowed: false, reason: "forbidden" }
  }

  let companyId = profile.company_id as string
  if (profile.is_superadmin) {
    const cookieStore = await cookies()
    const selectedCookie = cookieStore.get("selected_company_id")
    if (selectedCookie?.value) {
      companyId = decodeURIComponent(selectedCookie.value)
    }
  }

  if (!profile.is_superadmin) {
    const service = createServiceRoleClient()
    const keys = await loadUserPermissionKeys(service, user.id, companyId)
    if (!hasUserPermission(keys, "integration.monitor")) {
      return { allowed: false, reason: "forbidden" }
    }
  }

  const enabled = await isTenantFeatureEnabled(companyId, "api_integrations")
  if (!enabled) {
    return { allowed: false, reason: "feature_disabled" }
  }

  return { allowed: true, userId: user.id, companyId }
}
