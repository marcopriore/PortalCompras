import { queryOptions } from "@tanstack/react-query"
import type { TenantSettingKey } from "@/lib/settings/tenant-settings-registry"
import { queryKeys } from "@/lib/queries/keys"

export async function fetchTenantSettingsBatch(
  keysKey: string,
): Promise<Partial<Record<TenantSettingKey, number>>> {
  const res = await fetch(
    `/api/tenant-settings?keys=${encodeURIComponent(keysKey)}`,
    { cache: "no-store" },
  )
  if (!res.ok) return {}
  const data = (await res.json()) as {
    settings?: Partial<Record<TenantSettingKey, number>>
  }
  return data.settings ?? {}
}

export function tenantSettingsQueryOptions(companyId: string, keysKey: string) {
  return queryOptions({
    queryKey: queryKeys.tenantSettings(companyId, keysKey),
    queryFn: () => fetchTenantSettingsBatch(keysKey),
    enabled: Boolean(companyId && keysKey),
  })
}