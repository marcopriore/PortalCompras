import { queryOptions } from "@tanstack/react-query"
import type { SupabaseClient } from "@supabase/supabase-js"
import { queryKeys } from "@/lib/queries/keys"
import type { SupabaseClientFactory } from "@/lib/queries/payment-conditions"

export type AdminTenantProfile = {
  id: string
  full_name: string | null
  role: string | null
  roles: string[] | null
  profile_type: string | null
  status: string | null
  created_at: string
}

export type AdminTenantCompany = {
  id: string
  name: string
  cnpj: string | null
  status: string
  created_at: string
  [key: string]: unknown
}

export type AdminTenantDetailDto = {
  tenant: AdminTenantCompany | null
  profiles: AdminTenantProfile[]
  deleteEligible: boolean
}

export async function fetchAdminTenantDetail(
  tenantId: string,
  supabase: SupabaseClient,
): Promise<AdminTenantDetailDto> {
  const [tenantRes, profilesRes] = await Promise.all([
    supabase.from("companies").select("*").eq("id", tenantId).single(),
    supabase
      .from("profiles")
      .select("id, full_name, role, roles, profile_type, status, created_at")
      .eq("company_id", tenantId)
      .order("created_at", { ascending: false }),
  ])

  let deleteEligible = false
  try {
    const eligRes = await fetch(`/api/admin/tenants/${encodeURIComponent(tenantId)}`, {
      cache: "no-store",
    })
    if (eligRes.ok) {
      const payload = (await eligRes.json()) as {
        data?: { eligible?: boolean }
      }
      deleteEligible = Boolean(payload.data?.eligible)
    }
  } catch {
    deleteEligible = false
  }

  return {
    tenant: (tenantRes.data as AdminTenantCompany | null) ?? null,
    profiles: (profilesRes.data ?? []) as AdminTenantProfile[],
    deleteEligible,
  }
}

export function adminTenantDetailQueryOptions(
  tenantId: string,
  supabaseFactory: SupabaseClientFactory,
) {
  return queryOptions({
    queryKey: queryKeys.adminTenantDetail(tenantId),
    queryFn: () => fetchAdminTenantDetail(tenantId, supabaseFactory()),
    enabled: Boolean(tenantId),
  })
}

export type AdminTenantMetrics = {
  quotations: number
  suppliers: number
  items: number
  purchaseOrders: number
  requisitions: number
}

export async function fetchAdminTenantMetrics(
  supabase: SupabaseClient,
  tenantId: string,
  periodStart: Date | null,
  periodEnd: Date,
): Promise<AdminTenantMetrics> {
  let quotationsQuery = supabase
    .from("quotations")
    .select("*", { count: "exact", head: true })
    .eq("company_id", tenantId)

  let suppliersQuery = supabase
    .from("suppliers")
    .select("*", { count: "exact", head: true })
    .eq("company_id", tenantId)

  let itemsQuery = supabase
    .from("items")
    .select("*", { count: "exact", head: true })
    .eq("company_id", tenantId)

  let purchaseOrdersQuery = supabase
    .from("purchase_orders")
    .select("id", { count: "exact", head: true })
    .eq("company_id", tenantId)
    .neq("status", "draft")

  let requisitionsQuery = supabase
    .from("requisitions")
    .select("id", { count: "exact", head: true })
    .eq("company_id", tenantId)

  if (periodStart) {
    const isoStart = periodStart.toISOString()
    const isoEnd = periodEnd.toISOString()
    quotationsQuery = quotationsQuery
      .gte("created_at", isoStart)
      .lte("created_at", isoEnd)
    purchaseOrdersQuery = purchaseOrdersQuery
      .gte("created_at", isoStart)
      .lte("created_at", isoEnd)
    requisitionsQuery = requisitionsQuery
      .gte("created_at", isoStart)
      .lte("created_at", isoEnd)
    suppliersQuery = suppliersQuery
      .gte("created_at", isoStart)
      .lte("created_at", isoEnd)
    itemsQuery = itemsQuery
      .gte("created_at", isoStart)
      .lte("created_at", isoEnd)
  }

  const [quotationsRes, suppliersRes, itemsRes, purchaseOrdersRes, requisitionsRes] =
    await Promise.all([
      quotationsQuery,
      suppliersQuery,
      itemsQuery,
      purchaseOrdersQuery,
      requisitionsQuery,
    ])

  return {
    quotations: quotationsRes.count ?? 0,
    suppliers: suppliersRes.count ?? 0,
    items: itemsRes.count ?? 0,
    purchaseOrders: purchaseOrdersRes.count ?? 0,
    requisitions: requisitionsRes.count ?? 0,
  }
}

export function adminTenantMetricsQueryOptions(
  tenantId: string,
  periodKey: string,
  periodStart: Date | null,
  periodEnd: Date,
  supabaseFactory: SupabaseClientFactory,
) {
  return queryOptions({
    queryKey: queryKeys.adminTenantMetrics(tenantId, periodKey),
    queryFn: () =>
      fetchAdminTenantMetrics(supabaseFactory(), tenantId, periodStart, periodEnd),
    enabled: Boolean(tenantId),
  })
}

export async function fetchAdminTenantFeatures(
  supabase: SupabaseClient,
  tenantId: string,
  featureKeys: string[],
): Promise<Record<string, boolean>> {
  const state: Record<string, boolean> = {}
  for (const key of featureKeys) {
    state[key] = false
  }

  const { data: featuresRes } = await supabase
    .from("tenant_features")
    .select("*")
    .eq("company_id", tenantId)

  for (const row of featuresRes ?? []) {
    const r = row as { feature_key?: string; enabled?: boolean }
    if (!r.feature_key) continue
    if (state[r.feature_key] == null) continue
    state[r.feature_key] = Boolean(r.enabled)
  }

  return state
}

export function adminTenantFeaturesQueryOptions(
  tenantId: string,
  featureKeys: string[],
  supabaseFactory: SupabaseClientFactory,
  enabled: boolean,
) {
  return queryOptions({
    queryKey: queryKeys.adminTenantFeatures(tenantId),
    queryFn: () => fetchAdminTenantFeatures(supabaseFactory(), tenantId, featureKeys),
    enabled: Boolean(tenantId) && enabled,
  })
}