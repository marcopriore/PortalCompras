import { queryOptions } from "@tanstack/react-query"
import type { SupabaseClient } from "@supabase/supabase-js"
import { queryKeys } from "@/lib/queries/keys"
import type { SupabaseClientFactory } from "@/lib/queries/payment-conditions"

export type AdminAuditLogRow = {
  id: string
  company_id: string | null
  user_name: string | null
  event_type: string
  entity: string | null
  entity_id: string | null
  description: string
  metadata: Record<string, unknown> | null
  created_at: string
  companies?: { name: string } | null
}

export type AdminAuditLogsFilters = {
  search: string
  userFilter: string
  tenantFilter: string
  eventTypeFilter: string
  dateFrom: string
  dateTo: string
}

export function adminAuditLogsFiltersKey(filters: AdminAuditLogsFilters): string {
  return [
    filters.search,
    filters.userFilter,
    filters.tenantFilter,
    filters.eventTypeFilter,
    filters.dateFrom,
    filters.dateTo,
  ].join("\u0001")
}

export async function fetchAdminAuditLogs(
  supabase: SupabaseClient,
  filters: AdminAuditLogsFilters,
  page: number,
  pageSize: number,
): Promise<{ logs: AdminAuditLogRow[]; totalCount: number }> {
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = supabase
    .from("audit_logs")
    .select("*, companies(name)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to)

  if (filters.tenantFilter) {
    query = query.eq("company_id", filters.tenantFilter)
  }
  if (filters.eventTypeFilter) {
    query = query.eq("event_type", filters.eventTypeFilter)
  }
  if (filters.dateFrom) {
    query = query.gte("created_at", `${filters.dateFrom}T00:00:00.000Z`)
  }
  if (filters.dateTo) {
    query = query.lte("created_at", `${filters.dateTo}T23:59:59.999Z`)
  }
  if (filters.userFilter.trim()) {
    query = query.ilike("user_name", `%${filters.userFilter.trim()}%`)
  }
  if (filters.search.trim()) {
    query = query.ilike("description", `%${filters.search.trim()}%`)
  }

  const { data, count, error } = await query
  if (error) {
    throw error
  }

  return {
    logs: (data ?? []) as AdminAuditLogRow[],
    totalCount: count ?? 0,
  }
}

export function adminAuditLogsQueryOptions(
  filters: AdminAuditLogsFilters,
  page: number,
  pageSize: number,
  supabaseFactory: SupabaseClientFactory,
) {
  const filtersKey = adminAuditLogsFiltersKey(filters)
  return queryOptions({
    queryKey: queryKeys.adminAuditLogs(filtersKey, page),
    queryFn: () => fetchAdminAuditLogs(supabaseFactory(), filters, page, pageSize),
  })
}