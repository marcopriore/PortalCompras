import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { resolveTenantCompanyId } from "@/lib/api/resolve-tenant-company-id"
import { isTenantSettingKey, type TenantSettingKey } from "@/lib/settings/tenant-settings-registry"
import { loadTenantSettings } from "@/lib/settings/tenant-settings"

export async function GET(request: Request) {
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

    const { searchParams } = new URL(request.url)
    const keysParam = searchParams.get("keys")
    const keys = keysParam
      ? keysParam
          .split(",")
          .map((k) => k.trim())
          .filter((k): k is TenantSettingKey => isTenantSettingKey(k))
      : undefined

    const service = createServiceRoleClient()
    const settings = await loadTenantSettings(service, resolved.companyId, keys)

    const filtered = keys
      ? keys.reduce(
          (acc, key) => {
            acc[key] = settings[key]
            return acc
          },
          {} as Partial<Record<TenantSettingKey, number>>,
        )
      : settings

    return NextResponse.json({
      companyId: resolved.companyId,
      settings: filtered,
      pollingIntervalMs: settings.polling_interval_seconds * 1000,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
