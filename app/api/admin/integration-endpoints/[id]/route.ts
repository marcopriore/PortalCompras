import { NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { requireSuperAdminCompany } from "@/lib/api/require-superadmin-company"
import {
  maskEndpointAuthConfig,
  mergeEndpointAuthConfig,
} from "@/lib/integrations/endpoint-auth"
import {
  isOutboundIntegrationAction,
  type IntegrationEndpointAuthType,
} from "@/lib/integrations/types"

export const runtime = "nodejs"

type RouteParams = { params: Promise<{ id: string }> }

const AUTH_TYPES = new Set(["none", "bearer", "basic", "api_key_header"])

function mapEndpointRow(row: Record<string, unknown>) {
  const authType = String(row.auth_type) as IntegrationEndpointAuthType
  return {
    id: row.id,
    name: row.name,
    base_url: row.base_url,
    auth_type: authType,
    auth_config: maskEndpointAuthConfig(
      authType,
      (row.auth_config as Record<string, string>) ?? {},
    ),
    actions: row.actions,
    active: row.active,
    timeout_ms: row.timeout_ms,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const auth = await requireSuperAdminCompany(request)
    if ("error" in auth) return auth.error

    const { id } = await params
    const body = (await request.json()) as Record<string, unknown>
    const service = createServiceRoleClient()

    const { data: existing, error: loadError } = await service
      .from("integration_endpoints")
      .select("*")
      .eq("id", id)
      .eq("company_id", auth.companyId)
      .maybeSingle()

    if (loadError) {
      return NextResponse.json({ error: loadError.message }, { status: 500 })
    }
    if (!existing) {
      return NextResponse.json({ error: "Endpoint não encontrado." }, { status: 404 })
    }

    const current = existing as Record<string, unknown>
    const authType = (
      body.auth_type != null ? String(body.auth_type) : String(current.auth_type)
    ) as IntegrationEndpointAuthType

    if (!AUTH_TYPES.has(authType)) {
      return NextResponse.json({ error: "auth_type inválido." }, { status: 400 })
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (body.name != null) {
      const name = String(body.name).trim()
      if (!name) return NextResponse.json({ error: "name inválido." }, { status: 400 })
      updates.name = name
    }
    if (body.base_url != null) {
      const baseUrl = String(body.base_url).trim()
      if (!baseUrl) return NextResponse.json({ error: "base_url inválido." }, { status: 400 })
      updates.base_url = baseUrl
    }
    if (typeof body.active === "boolean") updates.active = body.active
    if (body.auth_type != null) updates.auth_type = authType

    if (Array.isArray(body.actions)) {
      const actions = body.actions.filter(
        (a): a is string => typeof a === "string" && isOutboundIntegrationAction(a),
      )
      if (actions.length === 0) {
        return NextResponse.json({ error: "actions inválidas." }, { status: 400 })
      }
      updates.actions = actions
    }

    if (body.timeout_ms != null) {
      const timeoutMs = Number(body.timeout_ms)
      if (!Number.isFinite(timeoutMs)) {
        return NextResponse.json({ error: "timeout_ms inválido." }, { status: 400 })
      }
      updates.timeout_ms = Math.min(Math.max(timeoutMs, 1000), 120000)
    }

    if (body.auth_config != null) {
      const rawCfg = body.auth_config as Record<string, unknown>
      const stringCfg: Record<string, string> = {}
      for (const [key, value] of Object.entries(rawCfg)) {
        stringCfg[key] = String(value ?? "")
      }
      updates.auth_config = mergeEndpointAuthConfig(
        authType,
        (current.auth_config as Record<string, string>) ?? {},
        stringCfg,
      )
    } else if (body.auth_type != null && authType === "none") {
      updates.auth_config = {}
    }

    const { data, error } = await service
      .from("integration_endpoints")
      .update(updates)
      .eq("id", id)
      .eq("company_id", auth.companyId)
      .select("*")
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ endpoint: mapEndpointRow(data as Record<string, unknown>) })
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const auth = await requireSuperAdminCompany(request)
    if ("error" in auth) return auth.error

    const { id } = await params
    const service = createServiceRoleClient()

    const { data, error } = await service
      .from("integration_endpoints")
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("company_id", auth.companyId)
      .select("id")
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    if (!data) {
      return NextResponse.json({ error: "Endpoint não encontrado." }, { status: 404 })
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
