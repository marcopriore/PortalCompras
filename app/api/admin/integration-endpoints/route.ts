import { NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { requireSuperAdminCompany } from "@/lib/api/require-superadmin-company"
import {
  buildAuthConfigFromBody,
  maskEndpointAuthConfig,
} from "@/lib/integrations/endpoint-auth"
import {
  isOutboundIntegrationAction,
  OUTBOUND_INTEGRATION_ACTIONS,
  type IntegrationEndpointAuthType,
} from "@/lib/integrations/types"

export const runtime = "nodejs"

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

export async function GET(request: Request) {
  try {
    const auth = await requireSuperAdminCompany(request)
    if ("error" in auth) return auth.error

    const service = createServiceRoleClient()
    const { data, error } = await service
      .from("integration_endpoints")
      .select("*")
      .eq("company_id", auth.companyId)
      .order("created_at", { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      endpoints: (data ?? []).map((row) => mapEndpointRow(row as Record<string, unknown>)),
      availableActions: OUTBOUND_INTEGRATION_ACTIONS,
    })
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireSuperAdminCompany(request)
    if ("error" in auth) return auth.error

    const body = (await request.json()) as Record<string, unknown>
    const name = String(body.name ?? "").trim()
    const baseUrl = String(body.base_url ?? "").trim()
    const authType = String(body.auth_type ?? "none") as IntegrationEndpointAuthType

    if (!name) {
      return NextResponse.json({ error: "name é obrigatório." }, { status: 400 })
    }
    if (!baseUrl) {
      return NextResponse.json({ error: "base_url é obrigatório." }, { status: 400 })
    }
    if (!AUTH_TYPES.has(authType)) {
      return NextResponse.json({ error: "auth_type inválido." }, { status: 400 })
    }

    const actions = Array.isArray(body.actions)
      ? body.actions.filter((a): a is string => typeof a === "string" && isOutboundIntegrationAction(a))
      : []

    if (actions.length === 0) {
      return NextResponse.json(
        { error: "Selecione ao menos uma ação outbound." },
        { status: 400 },
      )
    }

    const authConfigResult = buildAuthConfigFromBody(authType, body.auth_config)
    if (typeof authConfigResult === "string") {
      return NextResponse.json({ error: authConfigResult }, { status: 400 })
    }

    const timeoutMs = Number(body.timeout_ms ?? 30000)
    const timeout = Number.isFinite(timeoutMs) ? Math.min(Math.max(timeoutMs, 1000), 120000) : 30000

    const service = createServiceRoleClient()
    const { data, error } = await service
      .from("integration_endpoints")
      .insert({
        company_id: auth.companyId,
        name,
        base_url: baseUrl,
        auth_type: authType,
        auth_config: authConfigResult,
        actions,
        active: body.active !== false,
        timeout_ms: timeout,
      })
      .select("*")
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(
      { endpoint: mapEndpointRow(data as Record<string, unknown>) },
      { status: 201 },
    )
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
