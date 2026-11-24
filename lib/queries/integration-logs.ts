import { queryOptions } from "@tanstack/react-query"
import type {
  InboundLogRow,
  IntegrationLogDirection,
  OutboundLogRow,
} from "@/lib/integrations/integration-logs-types"
import { queryKeys } from "@/lib/queries/keys"

export type IntegrationLogsFilters = {
  direction: IntegrationLogDirection
  search: string
  dateFrom: string
  dateTo: string
  successFilter: string
  tenantFilter: string
}

export type IntegrationLogsResponse = {
  direction: IntegrationLogDirection
  page: number
  page_size: number
  total: number
  total_pages: number
  logs: Array<(InboundLogRow | OutboundLogRow) & { company_name?: string | null }>
  enabled_outbound_actions?: string[]
}

export function integrationLogsFiltersKey(
  mode: string,
  filters: IntegrationLogsFilters,
): string {
  return [
    mode,
    filters.direction,
    filters.search,
    filters.dateFrom,
    filters.dateTo,
    filters.successFilter,
    filters.tenantFilter,
  ].join("\u0001")
}

export async function fetchIntegrationLogs(
  mode: "comprador" | "admin",
  filters: IntegrationLogsFilters,
  page: number,
): Promise<IntegrationLogsResponse> {
  const apiBase =
    mode === "admin" ? "/api/admin/integration-logs" : "/api/comprador/integration-logs"

  const params = new URLSearchParams()
  params.set("direction", filters.direction)
  params.set("page", String(page))
  if (filters.search.trim()) params.set("search", filters.search.trim())
  if (filters.dateFrom) params.set("date_from", filters.dateFrom)
  if (filters.dateTo) params.set("date_to", filters.dateTo)
  if (filters.direction === "outbound" && filters.successFilter !== "all") {
    params.set("success", filters.successFilter)
  }
  if (mode === "admin" && filters.tenantFilter !== "all") {
    params.set("company_id", filters.tenantFilter)
  }

  const res = await fetch(`${apiBase}?${params.toString()}`)
  if (!res.ok) {
    const errJson = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(errJson.error ?? `fetch failed (${res.status})`)
  }
  return (await res.json()) as IntegrationLogsResponse
}

export async function fetchIntegrationLogDetail(
  mode: "comprador" | "admin",
  direction: IntegrationLogDirection,
  logId: string,
  tenantFilter: string,
): Promise<Record<string, unknown> | null> {
  const apiBase =
    mode === "admin" ? "/api/admin/integration-logs" : "/api/comprador/integration-logs"

  const params = new URLSearchParams()
  params.set("direction", direction)
  params.set("id", logId)
  if (mode === "admin" && tenantFilter !== "all") {
    params.set("company_id", tenantFilter)
  }

  const res = await fetch(`${apiBase}?${params.toString()}`)
  const json = (await res.json()) as { log?: Record<string, unknown> }
  return json.log ?? null
}

export function integrationLogsQueryOptions(
  mode: "comprador" | "admin",
  filters: IntegrationLogsFilters,
  page: number,
) {
  const filtersKey = integrationLogsFiltersKey(mode, filters)
  return queryOptions({
    queryKey: queryKeys.integrationLogs(mode, filtersKey, page),
    queryFn: () => fetchIntegrationLogs(mode, filters, page),
  })
}