import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import {
  hasUserPermission,
  loadUserPermissionKeys,
} from "@/lib/permissions/resolve-user-permissions"

export async function resolveApprovalsAccess(userId: string): Promise<
  | { companyId: string; userId: string; canViewAll: boolean }
  | { error: NextResponse }
> {
  const supabase = await createClient()
  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id, is_superadmin, profile_type")
    .eq("id", userId)
    .single()

  if (!profile || profile.profile_type !== "buyer") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }

  let companyId = profile.company_id as string | null
  if (profile.is_superadmin) {
    const cookieStore = await cookies()
    const selected = cookieStore.get("selected_company_id")?.value
    if (selected) companyId = decodeURIComponent(selected)
  }
  if (!companyId) {
    return { error: NextResponse.json({ error: "Company not found" }, { status: 404 }) }
  }

  if (profile.is_superadmin) {
    return { companyId, userId, canViewAll: true }
  }

  const service = createServiceRoleClient()
  const keys = await loadUserPermissionKeys(service, userId, companyId)
  const canViewAll = hasUserPermission(keys, "approval.view_all")

  return { companyId, userId, canViewAll }
}
