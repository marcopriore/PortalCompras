import { queryOptions } from "@tanstack/react-query"
import type { TenantFeatureConfig } from "@/lib/settings/tenant-feature-settings"
import {
  parseTenantFeatureConfig,
} from "@/lib/settings/tenant-feature-settings"
import { queryKeys } from "@/lib/queries/keys"

const DEFAULT_CONFIG: TenantFeatureConfig = parseTenantFeatureConfig({})

export async function fetchTenantFeatureConfig(): Promise<TenantFeatureConfig> {
  const res = await fetch("/api/tenant-feature-config", { cache: "no-store" })
  if (!res.ok) return DEFAULT_CONFIG
  const data = (await res.json()) as { config?: TenantFeatureConfig }
  return data.config ?? DEFAULT_CONFIG
}

export function tenantFeatureConfigQueryOptions(companyId: string) {
  return queryOptions({
    queryKey: queryKeys.tenantFeatureConfig(companyId),
    queryFn: () => fetchTenantFeatureConfig(),
    enabled: Boolean(companyId),
  })
}