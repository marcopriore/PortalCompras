import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { truncateText } from "@/lib/integrations/integration-logs-types"

export const AXISDESK_INTEGRATION_NAME = "AxisDesk"

export const AXISDESK_OUTBOUND_ACTIONS = {
  TICKET_CREATE: "axisdesk.ticket.create",
  TICKET_ACTION: "axisdesk.ticket.action",
} as const

const AXISDESK_ENDPOINT_ACTIONS = Object.values(AXISDESK_OUTBOUND_ACTIONS)

const endpointIdByCompany = new Map<string, string>()

function getAxisDeskBaseUrl(): string {
  const raw = process.env.AXISDESK_BASE_URL?.trim()
  if (raw && raw.length > 0) return raw.replace(/\/$/, "")
  return "https://suporte.axisstrategy.com.br"
}

function sanitizePayload(value: unknown): Record<string, unknown> | null {
  if (value == null) return null
  if (typeof value !== "object") return { value: String(value) }

  if (Array.isArray(value)) {
    return { items: value.length }
  }

  const input = value as Record<string, unknown>
  const out: Record<string, unknown> = {}

  for (const [key, val] of Object.entries(input)) {
    if (key === "anexos" && Array.isArray(val)) {
      out.anexos = val.map((item) => {
        if (!item || typeof item !== "object") return item
        const anexo = item as Record<string, unknown>
        return {
          nome_arquivo: anexo.nome_arquivo ?? null,
          tipo_mime: anexo.tipo_mime ?? null,
          conteudo_base64: anexo.conteudo_base64 ? "[base64 omitido]" : null,
        }
      })
      continue
    }

    if (key === "conteudo_base64") {
      out[key] = "[base64 omitido]"
      continue
    }

    out[key] = val
  }

  return out
}

async function resolveAxisDeskEndpointId(companyId: string): Promise<string | null> {
  const cached = endpointIdByCompany.get(companyId)
  if (cached) return cached

  const service = createServiceRoleClient()
  const baseUrl = getAxisDeskBaseUrl()

  const { data: existing } = await service
    .from("integration_endpoints")
    .select("id")
    .eq("company_id", companyId)
    .eq("name", AXISDESK_INTEGRATION_NAME)
    .maybeSingle()

  if (existing?.id) {
    endpointIdByCompany.set(companyId, existing.id)
    return existing.id
  }

  const { data: created, error } = await service
    .from("integration_endpoints")
    .upsert(
      {
        company_id: companyId,
        name: AXISDESK_INTEGRATION_NAME,
        base_url: baseUrl,
        auth_type: "api_key_header",
        auth_config: {
          headerName: "x-api-key",
          headerValue: "(AXISDESK_API_KEY)",
        },
        actions: AXISDESK_ENDPOINT_ACTIONS,
        active: true,
        timeout_ms: 30000,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "company_id,name" },
    )
    .select("id")
    .single()

  if (error || !created?.id) {
    console.error("[axisdesk] integration_endpoints upsert:", error?.message)
    return null
  }

  endpointIdByCompany.set(companyId, created.id)
  return created.id
}

export async function logAxisDeskOutbound(input: {
  companyId: string
  action: string
  method: string
  path: string
  durationMs: number
  responseStatus: number | null
  success: boolean
  errorMessage?: string | null
  entity?: string
  entityId?: string
  entityCode?: string
  requestPayload?: unknown
  responseBody?: unknown
}): Promise<void> {
  try {
    const service = createServiceRoleClient()
    const endpointId = await resolveAxisDeskEndpointId(input.companyId)

    const payload = sanitizePayload(input.requestPayload)
    const requestPayload: Record<string, unknown> = {
      provider: AXISDESK_INTEGRATION_NAME,
      method: input.method,
      path: input.path,
      duration_ms: input.durationMs,
      ...(payload ?? {}),
    }

    let responseBody: string | null = null
    if (input.responseBody != null) {
      const raw =
        typeof input.responseBody === "string"
          ? input.responseBody
          : JSON.stringify(input.responseBody)
      responseBody = truncateText(raw, 4000)
    }

    const { error } = await service.from("integration_delivery_logs").insert({
      company_id: input.companyId,
      endpoint_id: endpointId,
      action: input.action,
      entity: input.entity ?? "support_ticket",
      entity_id: input.entityId ?? null,
      entity_code: input.entityCode ?? null,
      request_payload: requestPayload,
      response_status: input.responseStatus,
      response_body: responseBody,
      success: input.success,
      error_message: input.errorMessage ?? null,
      attempts: 1,
    })

    if (error) {
      console.error("[axisdesk] integration_delivery_logs insert:", error.message)
    }
  } catch (err) {
    console.error("[axisdesk] logAxisDeskOutbound:", err)
  }
}

export async function logAxisDeskInbound(input: {
  companyId: string
  method: string
  path: string
  statusCode: number
  durationMs: number
  ipAddress?: string | null
  evento?: string | null
}): Promise<void> {
  try {
    const service = createServiceRoleClient()
    const path =
      input.evento && input.evento.trim().length > 0
        ? `${input.path}?evento=${encodeURIComponent(input.evento)}`
        : input.path

    const { error } = await service.from("api_request_logs").insert({
      company_id: input.companyId,
      api_key_id: null,
      method: input.method,
      path,
      status_code: input.statusCode,
      duration_ms: input.durationMs,
      ip_address: input.ipAddress ?? null,
    })

    if (error) {
      console.error("[axisdesk] api_request_logs insert:", error.message)
    }
  } catch (err) {
    console.error("[axisdesk] logAxisDeskInbound:", err)
  }
}
