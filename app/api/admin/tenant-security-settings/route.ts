import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import {
  PASSWORD_POLICY_REGISTRY,
  passwordPolicyToRules,
} from "@/lib/settings/password-policy-registry"
import {
  buildDefaultPasswordPolicy,
  loadPasswordPolicy,
  serializePasswordPolicyValue,
  validatePasswordPolicyPatch,
} from "@/lib/settings/password-policy"
import { isPasswordPolicyKey } from "@/lib/settings/password-policy-registry"

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

    const policy = await loadPasswordPolicy(service, companyId)
    const defaults = buildDefaultPasswordPolicy()

    const definitions = PASSWORD_POLICY_REGISTRY.map((def) => {
      let value: number | boolean
      switch (def.key) {
        case "password_min_length":
          value = policy.minLength
          break
        case "password_require_uppercase":
          value = policy.requireUppercase
          break
        case "password_require_lowercase":
          value = policy.requireLowercase
          break
        case "password_require_digit":
          value = policy.requireDigit
          break
        case "password_require_special":
          value = policy.requireSpecial
          break
        case "password_expiry_days":
          value = policy.expiryDays
          break
        case "password_history_count":
          value = policy.historyCount
          break
        default:
          value = def.defaultValue as number | boolean
      }
      return { ...def, value }
    })

    return NextResponse.json({
      companyId,
      policy,
      rules: passwordPolicyToRules(policy),
      definitions,
      defaults,
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

    const rows: Array<{ company_id: string; key: string; value: string }> = []
    const saved: Record<string, number | boolean> = {}

    for (const [key, value] of Object.entries(patch)) {
      if (!isPasswordPolicyKey(key)) {
        return NextResponse.json(
          { error: `Configuração não permitida: ${key}` },
          { status: 400 },
        )
      }
      const validated = validatePasswordPolicyPatch(key, value)
      if (!validated.ok) {
        return NextResponse.json({ error: validated.error }, { status: 400 })
      }
      rows.push({
        company_id: companyId,
        key,
        value: serializePasswordPolicyValue(key, validated.parsed),
      })
      saved[key] = validated.parsed
    }

    if (rows.length === 0) {
      return NextResponse.json({ error: "Nenhuma configuração enviada" }, { status: 400 })
    }

    const service = createServiceRoleClient()
    const { error: upsertError } = await service
      .from("company_settings")
      .upsert(rows, { onConflict: "company_id,key" })

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 })
    }

    await service.from("audit_logs").insert({
      company_id: companyId,
      user_id: auth.user.id,
      user_name: auth.profile.full_name,
      event_type: "tenant.updated",
      entity: "password_policy",
      entity_id: companyId,
      description: "Política de senhas do tenant atualizada pelo superadmin",
      metadata: { settings: saved },
    })

    const policy = await loadPasswordPolicy(service, companyId)

    return NextResponse.json({
      success: true,
      policy,
      rules: passwordPolicyToRules(policy),
      saved,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
