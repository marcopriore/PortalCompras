import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { resolveTenantCompanyId } from "@/lib/api/resolve-tenant-company-id"
import { passwordPolicyToRules } from "@/lib/settings/password-policy-registry"
import { loadPasswordPolicy } from "@/lib/settings/password-policy"

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const resolved = await resolveTenantCompanyId(supabase, user.id)
    if ("error" in resolved) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status })
    }

    const service = createServiceRoleClient()
    const policy = await loadPasswordPolicy(service, resolved.companyId)

    return NextResponse.json({
      companyId: resolved.companyId,
      policy,
      rules: passwordPolicyToRules(policy),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
