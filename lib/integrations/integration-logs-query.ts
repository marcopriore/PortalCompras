import type { SupabaseClient } from "@supabase/supabase-js"
import {
  maskSensitivePayload,
  truncateText,
  type IntegrationLogsQuery,
  type InboundLogRow,
  type OutboundLogRow,
} from "@/lib/integrations/integration-logs-types"
import { isOutboundRetryEligible } from "@/lib/integrations/outbound-retry-eligibility"

function rangeFromPage(page: number, pageSize: number) {
  const from = (page - 1) * pageSize
  return { from, to: from + pageSize - 1 }
}

export async function fetchInboundLogs(
  service: SupabaseClient,
  companyId: string | null,
  query: IntegrationLogsQuery,
) {
  const { from, to } = rangeFromPage(query.page, query.pageSize)

  let dbQuery = service
    .from("api_request_logs")
    .select(
      "id, company_id, created_at, method, path, status_code, duration_ms, ip_address, api_key_id, api_keys(name)",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })

  if (companyId) {
    dbQuery = dbQuery.eq("company_id", companyId)
  }

  if (query.dateFrom) {
    dbQuery = dbQuery.gte("created_at", query.dateFrom)
  }
  if (query.dateTo) {
    dbQuery = dbQuery.lte("created_at", `${query.dateTo}T23:59:59.999Z`)
  }
  if (query.statusCode != null) {
    dbQuery = dbQuery.eq("status_code", query.statusCode)
  }
  if (query.search) {
    const term = `%${query.search}%`
    dbQuery = dbQuery.or(`path.ilike.${term},method.ilike.${term}`)
  }

  const { data, error, count } = await dbQuery.range(from, to)

  if (error) throw error

  const logs: InboundLogRow[] = (data ?? []).map((row) => {
    const r = row as Record<string, unknown>
    const keyEmbed = r.api_keys as { name: string } | { name: string }[] | null
    const keyName = Array.isArray(keyEmbed) ? keyEmbed[0]?.name : keyEmbed?.name
    return {
      id: String(r.id),
      direction: "inbound" as const,
      company_id: String(r.company_id),
      created_at: String(r.created_at),
      method: String(r.method),
      path: String(r.path),
      status_code: r.status_code != null ? Number(r.status_code) : null,
      duration_ms: r.duration_ms != null ? Number(r.duration_ms) : null,
      ip_address: r.ip_address != null ? String(r.ip_address) : null,
      api_key_id: r.api_key_id != null ? String(r.api_key_id) : null,
      api_key_name: keyName ?? null,
    }
  })

  return { logs, total: count ?? 0 }
}

export async function fetchOutboundLogs(
  service: SupabaseClient,
  companyId: string | null,
  query: IntegrationLogsQuery,
) {
  const { from, to } = rangeFromPage(query.page, query.pageSize)

  let dbQuery = service
    .from("integration_delivery_logs")
    .select(
      "id, company_id, created_at, action, entity, entity_id, entity_code, success, response_status, error_message, attempts, request_payload, response_body, endpoint_id",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })

  if (companyId) {
    dbQuery = dbQuery.eq("company_id", companyId)
  }

  if (query.dateFrom) {
    dbQuery = dbQuery.gte("created_at", query.dateFrom)
  }
  if (query.dateTo) {
    dbQuery = dbQuery.lte("created_at", `${query.dateTo}T23:59:59.999Z`)
  }
  if (query.successOnly === true) {
    dbQuery = dbQuery.eq("success", true)
  } else if (query.successOnly === false) {
    dbQuery = dbQuery.eq("success", false)
  }
  if (query.statusCode != null) {
    dbQuery = dbQuery.eq("response_status", query.statusCode)
  }
  if (query.search) {
    const term = `%${query.search}%`
    dbQuery = dbQuery.or(
      `action.ilike.${term},entity_code.ilike.${term},entity.ilike.${term}`,
    )
  }

  const { data, error, count } = await dbQuery.range(from, to)

  if (error) throw error

  const endpointIds = [
    ...new Set(
      (data ?? [])
        .map((row) => (row as { endpoint_id?: string | null }).endpoint_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ]

  const endpointNameById = new Map<string, string>()
  if (endpointIds.length > 0) {
    const { data: endpoints } = await service
      .from("integration_endpoints")
      .select("id, name")
      .in("id", endpointIds)
    for (const ep of endpoints ?? []) {
      endpointNameById.set(String(ep.id), String(ep.name))
    }
  }

  const logs: OutboundLogRow[] = (data ?? []).map((row) => {
    const r = row as Record<string, unknown>
    const endpointId = r.endpoint_id != null ? String(r.endpoint_id) : null
    const endpointName = endpointId ? endpointNameById.get(endpointId) ?? null : null

    const payload =
      r.request_payload != null
        ? (maskSensitivePayload(r.request_payload) as Record<string, unknown>)
        : null

    return {
      id: String(r.id),
      direction: "outbound" as const,
      company_id: String(r.company_id),
      created_at: String(r.created_at),
      action: String(r.action),
      entity: r.entity != null ? String(r.entity) : null,
      entity_id: r.entity_id != null ? String(r.entity_id) : null,
      entity_code: r.entity_code != null ? String(r.entity_code) : null,
      success: Boolean(r.success),
      response_status: r.response_status != null ? Number(r.response_status) : null,
      error_message: r.error_message != null ? String(r.error_message) : null,
      attempts: Number(r.attempts ?? 1),
      endpoint_name: endpointName ?? null,
      request_payload: payload,
      response_body: truncateText(
        r.response_body != null ? String(r.response_body) : null,
      ),
      entity_status: null,
      entity_external_code: null,
      retry_eligible: false,
    }
  })

  const purchaseOrderIds = [
    ...new Set(
      logs
        .filter((log) => log.entity === "purchase_orders" && log.entity_id)
        .map((log) => log.entity_id as string),
    ),
  ]

  const requisitionIds = [
    ...new Set(
      logs
        .filter((log) => log.entity === "requisitions" && log.entity_id)
        .map((log) => log.entity_id as string),
    ),
  ]

  const purchaseOrderStatusById = new Map<string, string>()
  if (purchaseOrderIds.length > 0) {
    let poQuery = service
      .from("purchase_orders")
      .select("id, status")
      .in("id", purchaseOrderIds)

    if (companyId) {
      poQuery = poQuery.eq("company_id", companyId)
    }

    const { data: purchaseOrders, error: poError } = await poQuery
    if (poError) throw poError

    for (const po of purchaseOrders ?? []) {
      purchaseOrderStatusById.set(String(po.id), String(po.status))
    }
  }

  const requisitionMetaById = new Map<string, { status: string; external_code: string | null }>()
  if (requisitionIds.length > 0) {
    let reqQuery = service
      .from("requisitions")
      .select("id, status, external_code")
      .in("id", requisitionIds)

    if (companyId) {
      reqQuery = reqQuery.eq("company_id", companyId)
    }

    const { data: requisitions, error: reqError } = await reqQuery
    if (reqError) throw reqError

    for (const req of requisitions ?? []) {
      requisitionMetaById.set(String(req.id), {
        status: String(req.status),
        external_code: req.external_code != null ? String(req.external_code) : null,
      })
    }
  }

  for (const log of logs) {
    if (log.entity === "purchase_orders" && log.entity_id) {
      log.entity_status = purchaseOrderStatusById.get(log.entity_id) ?? null
    }
    if (log.entity === "requisitions" && log.entity_id) {
      const meta = requisitionMetaById.get(log.entity_id)
      log.entity_status = meta?.status ?? null
      log.entity_external_code = meta?.external_code ?? null
    }
    log.retry_eligible = isOutboundRetryEligible({
      action: log.action,
      entity: log.entity,
      entity_id: log.entity_id,
      success: log.success,
      entity_status: log.entity_status,
      entity_external_code: log.entity_external_code,
    })
  }

  return { logs, total: count ?? 0 }
}

export async function fetchInboundLogDetail(
  service: SupabaseClient,
  companyId: string | null,
  logId: string,
) {
  let query = service
    .from("api_request_logs")
    .select(
      "id, company_id, created_at, method, path, status_code, duration_ms, ip_address, api_key_id, api_keys(name, key_prefix)",
    )
    .eq("id", logId)

  if (companyId) query = query.eq("company_id", companyId)

  const { data, error } = await query.maybeSingle()
  if (error) throw error
  return data
}

export async function fetchOutboundLogDetail(
  service: SupabaseClient,
  companyId: string | null,
  logId: string,
) {
  let query = service
    .from("integration_delivery_logs")
    .select(
      "id, company_id, created_at, action, entity, entity_id, entity_code, success, response_status, error_message, attempts, request_payload, response_body, endpoint_id",
    )
    .eq("id", logId)

  if (companyId) query = query.eq("company_id", companyId)

  const { data, error } = await query.maybeSingle()
  if (error) throw error
  if (!data) return null

  const r = data as Record<string, unknown>
  let endpointName: string | null = null
  let endpointUrl: string | null = null
  if (r.endpoint_id) {
    const { data: endpoint } = await service
      .from("integration_endpoints")
      .select("name, base_url")
      .eq("id", String(r.endpoint_id))
      .maybeSingle()
    endpointName = endpoint?.name != null ? String(endpoint.name) : null
    endpointUrl = endpoint?.base_url != null ? String(endpoint.base_url) : null
  }

  return {
    ...r,
    endpoint_name: endpointName,
    endpoint_url: endpointUrl,
    request_payload: maskSensitivePayload(r.request_payload),
    response_body: truncateText(
      r.response_body != null ? String(r.response_body) : null,
      8000,
    ),
  }
}
