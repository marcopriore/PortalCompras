export const INTEGRATION_LOG_PAGE_SIZE = 25

export type IntegrationLogDirection = "inbound" | "outbound"

export type InboundLogRow = {
  id: string
  direction: "inbound"
  company_id: string
  created_at: string
  method: string
  path: string
  status_code: number | null
  duration_ms: number | null
  ip_address: string | null
  api_key_id: string | null
  api_key_name: string | null
}

export type OutboundLogRow = {
  id: string
  direction: "outbound"
  company_id: string
  created_at: string
  action: string
  entity: string | null
  entity_id: string | null
  entity_code: string | null
  success: boolean
  response_status: number | null
  error_message: string | null
  attempts: number
  endpoint_name: string | null
  request_payload: Record<string, unknown> | null
  response_body: string | null
  /** Status atual da entidade vinculada (ex.: purchase_orders.status), quando aplicável. */
  entity_status: string | null
  /** Se o monitor deve exibir o botão Reenviar para este log. */
  retry_eligible: boolean
}

export type IntegrationLogListItem = InboundLogRow | OutboundLogRow

export type IntegrationLogsQuery = {
  direction: IntegrationLogDirection
  page: number
  pageSize: number
  dateFrom: string | null
  dateTo: string | null
  search: string | null
  successOnly: boolean | null
  statusCode: number | null
}

export function parseIntegrationLogsQuery(
  searchParams: URLSearchParams,
): IntegrationLogsQuery | string {
  const directionRaw = searchParams.get("direction") ?? "inbound"
  const direction = directionRaw === "outbound" ? "outbound" : "inbound"

  const pageRaw = Number(searchParams.get("page") ?? "1")
  const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.floor(pageRaw) : 1

  const pageSizeRaw = Number(searchParams.get("page_size") ?? String(INTEGRATION_LOG_PAGE_SIZE))
  const pageSize =
    Number.isFinite(pageSizeRaw) && pageSizeRaw >= 1
      ? Math.min(Math.floor(pageSizeRaw), 100)
      : INTEGRATION_LOG_PAGE_SIZE

  const dateFrom = searchParams.get("date_from")?.trim() || null
  const dateTo = searchParams.get("date_to")?.trim() || null
  const search = searchParams.get("search")?.trim() || null

  if (dateFrom && Number.isNaN(Date.parse(dateFrom))) {
    return "date_from inválido."
  }
  if (dateTo && Number.isNaN(Date.parse(dateTo))) {
    return "date_to inválido."
  }

  const successParam = searchParams.get("success")
  const successOnly =
    successParam === "true" ? true : successParam === "false" ? false : null

  const statusCodeRaw = searchParams.get("status_code")
  const statusCode =
    statusCodeRaw != null && statusCodeRaw !== "" ? Number(statusCodeRaw) : null
  if (statusCode != null && !Number.isFinite(statusCode)) {
    return "status_code inválido."
  }

  return {
    direction,
    page,
    pageSize,
    dateFrom,
    dateTo,
    search,
    successOnly,
    statusCode,
  }
}

const SENSITIVE_KEYS = /password|token|secret|authorization|api_key|key_hash|auth_config/i

export function maskSensitivePayload(value: unknown): unknown {
  if (value == null) return value
  if (Array.isArray(value)) {
    return value.map(maskSensitivePayload)
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.test(key)) {
        out[key] = "***"
      } else {
        out[key] = maskSensitivePayload(val)
      }
    }
    return out
  }
  return value
}

export function truncateText(text: string | null, max = 4000): string | null {
  if (text == null) return null
  if (text.length <= max) return text
  return `${text.slice(0, max)}\n… [truncado]`
}
