import { queryOptions } from "@tanstack/react-query"
import type { SupabaseClient } from "@supabase/supabase-js"
import { queryKeys } from "@/lib/queries/keys"
import type { FeatureKey } from "@/lib/hooks/usePermissions"
import type { SupabaseClientFactory } from "@/lib/queries/payment-conditions"

export type TenantFeatureFlagsMap = Partial<Record<FeatureKey, boolean>>

export async function fetchTenantFeatureFlags(
  supabase: SupabaseClient,
  companyId: string,
  keys: FeatureKey[],
): Promise<TenantFeatureFlagsMap> {
  const next: TenantFeatureFlagsMap = {}
  for (const key of keys) {
    next[key] = false
  }

  const { data, error } = await supabase
    .from("tenant_features")
    .select("feature_key, enabled")
    .eq("company_id", companyId)
    .in("feature_key", keys)

  if (!error) {
    for (const row of (data ?? []) as { feature_key: FeatureKey; enabled: boolean }[]) {
      if (row.feature_key) {
        next[row.feature_key] = Boolean(row.enabled)
      }
    }
  }

  return next
}

export function tenantFeatureFlagsQueryOptions(
  companyId: string,
  keys: FeatureKey[],
  supabaseFactory: SupabaseClientFactory,
) {
  const keysKey = [...keys].sort().join(",")
  return queryOptions({
    queryKey: queryKeys.tenantFeatureFlags(companyId, keysKey),
    queryFn: () => fetchTenantFeatureFlags(supabaseFactory(), companyId, keys),
    enabled: Boolean(companyId),
  })
}