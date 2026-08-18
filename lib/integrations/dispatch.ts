import { createServiceRoleClient } from "@/lib/supabase/service-role"
import type {
  IntegrationEndpointRow,
  OutboundDispatchResult,
  OutboundIntegrationAction,
} from "@/lib/integrations/types"
import { parseExternalIdFromErpResponse } from "@/lib/integrations/external-id-response"
import { formatErpHttpFailure } from "@/lib/integrations/erp-errors"

type DispatchInput = {
  companyId: string
  action: OutboundIntegrationAction
  entity?: string
  entityId?: string
  entityCode?: string
  payload: Record<string, unknown>
}

function buildAuthHeaders(endpoint: IntegrationEndpointRow): HeadersInit {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  }

  const cfg = endpoint.auth_config ?? {}

  switch (endpoint.auth_type) {
    case "bearer":
      if (cfg.token) headers.Authorization = `Bearer ${cfg.token}`
      break
    case "basic":
      if (cfg.username && cfg.password) {
        const encoded = Buffer.from(`${cfg.username}:${cfg.password}`).toString(
          "base64",
        )
        headers.Authorization = `Basic ${encoded}`
      }
      break
    case "api_key_header":
      if (cfg.headerName && cfg.headerValue) {
        headers[cfg.headerName] = cfg.headerValue
      }
      break
    default:
      break
  }

  return headers
}

function actionToHttpMethod(action: OutboundIntegrationAction): "POST" | "PUT" | "DELETE" {
  if (action.endsWith(".delete")) return "DELETE"
  if (action.endsWith(".update")) return "PUT"
  return "POST"
}

/**
 * Dispara integração HTTP ativa para o ERP (não é webhook passivo).
 * Implementação completa na fase de pedidos/requisições outbound (passo 5).
 */
export async function dispatchOutboundIntegration(
  input: DispatchInput,
): Promise<OutboundDispatchResult> {
  const service = createServiceRoleClient()

  const { data: endpoints, error } = await service
    .from("integration_endpoints")
    .select(
      "id, company_id, name, base_url, auth_type, auth_config, actions, active, timeout_ms",
    )
    .eq("company_id", input.companyId)
    .eq("active", true)
    .contains("actions", [input.action])

  if (error || !endpoints?.length) {
    const errorMessage = "Nenhum endpoint de integração configurado para esta ação."
    const { error: logError } = await service.from("integration_delivery_logs").insert({
      company_id: input.companyId,
      endpoint_id: null,
      action: input.action,
      entity: input.entity ?? null,
      entity_id: input.entityId ?? null,
      entity_code: input.entityCode ?? null,
      request_payload: input.payload,
      response_status: null,
      response_body: null,
      success: false,
      error_message: errorMessage,
      attempts: 1,
    })
    if (logError) {
      console.error("[dispatch] integration_delivery_logs insert:", logError.message)
    }

    return {
      success: false,
      responseStatus: null,
      responseBody: null,
      errorMessage,
    }
  }

  const endpoint = endpoints[0] as IntegrationEndpointRow
  const method = actionToHttpMethod(input.action)
  const url = endpoint.base_url.replace(/\/$/, "")
  const controller = new AbortController()
  const timeout = windowOrDefaultTimeout(endpoint.timeout_ms)

  const timer = setTimeout(() => controller.abort(), timeout)

  let responseStatus: number | null = null
  let responseBody: string | null = null
  let success = false
  let errorMessage: string | null = null
  let externalCode: string | null = null

  try {
    const response = await fetch(url, {
      method,
      headers: buildAuthHeaders(endpoint),
      body: JSON.stringify({
        action: input.action,
        entity: input.entity ?? null,
        entity_id: input.entityId ?? null,
        entity_code: input.entityCode ?? null,
        data: input.payload,
      }),
      signal: controller.signal,
    })

    responseStatus = response.status
    responseBody = await response.text()
    success = response.ok

    if (!success) {
      errorMessage = formatErpHttpFailure(response.status, responseBody)
    } else {
      externalCode = parseExternalIdFromErpResponse(input.action, responseBody)
    }
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : "Falha ao chamar ERP"
  } finally {
    clearTimeout(timer)
  }

  const { error: logError } = await service.from("integration_delivery_logs").insert({
    company_id: input.companyId,
    endpoint_id: endpoint.id,
    action: input.action,
    entity: input.entity ?? null,
    entity_id: input.entityId ?? null,
    entity_code: input.entityCode ?? null,
    request_payload: input.payload,
    response_status: responseStatus,
    response_body: responseBody,
    success,
    error_message: errorMessage,
    attempts: 1,
  })
  if (logError) {
    console.error("[dispatch] integration_delivery_logs insert:", logError.message)
  }

  return {
    success,
    responseStatus,
    responseBody,
    errorMessage,
    externalCode,
  }
}

function windowOrDefaultTimeout(timeoutMs: number): number {
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1000) return 30000
  return Math.min(timeoutMs, 120000)
}
