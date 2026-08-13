import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import {
  getSuperadminTenantSettingKeys,
  isTenantSettingKey,
  TENANT_SETTING_GROUPS,
  TENANT_SETTINGS_REGISTRY,
  type TenantSettingGroup,
} from "@/lib/settings/tenant-settings-registry"
import {
  loadTenantSettings,
  serializeTenantSettingValue,
  validateTenantSettingValue,
} from "@/lib/settings/tenant-settings"

async function requireSuperAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, is_superadmin")
    .eq("id", user.id)
    .single()

  if (!profile?.is_superadmin) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }

  return { user, profile }
}

export async function GET(request: Request) {
  try {
    const auth = await requireSuperAdmin()
    if ("error" in auth) return auth.error

    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get("companyId")
    if (!companyId) {
      return NextResponse.json({ error: "Missing companyId" }, { status: 400 })
    }

    const service = createServiceRoleClient()

    const { data: company } = await service
      .from("companies")
      .select("id")
      .eq("id", companyId)
      .maybeSingle()

    if (!company) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 })
    }

    const { data: features } = await service
      .from("tenant_features")
      .select("feature_key, enabled")
      .eq("company_id", companyId)

    const enabledFeatures = new Set(
      (features ?? [])
        .filter((f) => f.enabled)
        .map((f) => String(f.feature_key)),
    )

    const settings = await loadTenantSettings(service, companyId)

    const definitions = TENANT_SETTINGS_REGISTRY.filter((def) => {
      if (!def.requiresFeature) return true
      return enabledFeatures.has(def.requiresFeature)
    })

    const grouped = Object.keys(TENANT_SETTING_GROUPS).reduce(
      (acc, group) => {
        acc[group as TenantSettingGroup] = definitions
          .filter((d) => d.group === group)
          .map((d) => ({
            ...d,
            value: settings[d.key],
          }))
        return acc
      },
      {} as Record<
        TenantSettingGroup,
        Array<(typeof definitions)[number] & { value: number }>
      >,
    )

    return NextResponse.json({
      companyId,
      settings,
      definitions,
      grouped,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireSuperAdmin()
    if ("error" in auth) return auth.error

    const body = (await request.json()) as {
      companyId?: string
      settings?: Record<string, unknown>
    }

    const companyId = body.companyId
    const patch = body.settings

    if (!companyId || !patch || typeof patch !== "object") {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
    }

    const allowedKeys = new Set(getSuperadminTenantSettingKeys())
    const rows: Array<{ company_id: string; key: string; value: string }> = []
    const saved: Record<string, number> = {}

    for (const [key, value] of Object.entries(patch)) {
      if (!isTenantSettingKey(key) || !allowedKeys.has(key)) {
        return NextResponse.json(
          { error: `Configuração não permitida: ${key}` },
          { status: 400 },
        )
      }
      if (!isTenantSettingKey(key)) continue

      const validated = validateTenantSettingValue(key, value)
      if (!validated.ok) {
        return NextResponse.json({ error: validated.error }, { status: 400 })
      }

      rows.push({
        company_id: companyId,
        key,
        value: serializeTenantSettingValue(validated.parsed),
      })
      saved[key] = validated.parsed
    }

    if (rows.length === 0) {
      return NextResponse.json({ error: "Nenhuma configuração enviada" }, { status: 400 })
    }

    const service = createServiceRoleClient()

    const { error: upsertError } = await service.from("company_settings").upsert(
      rows,
      { onConflict: "company_id,key" },
    )

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 })
    }

    await service.from("audit_logs").insert({
      company_id: companyId,
      user_id: auth.user.id,
      user_name: auth.profile.full_name,
      event_type: "tenant.updated",
      entity: "company_settings",
      entity_id: companyId,
      description: "Configurações do tenant atualizadas pelo superadmin",
      metadata: { settings: saved },
    })

    const settings = await loadTenantSettings(service, companyId)

    return NextResponse.json({ success: true, settings, saved })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
