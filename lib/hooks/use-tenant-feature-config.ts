import { useCallback, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import type { TenantFeatureConfig } from "@/lib/settings/tenant-feature-settings"
import { parseTenantFeatureConfig } from "@/lib/settings/tenant-feature-settings"
import { tenantFeatureConfigQueryOptions } from "@/lib/queries/tenant-feature-config-fetch"
import { useUser } from "@/lib/hooks/useUser"

const DEFAULT_CONFIG: TenantFeatureConfig = parseTenantFeatureConfig({})

export function useTenantFeatureConfig() {
  const { companyId, loading: userLoading } = useUser()

  const query = useQuery({
    ...tenantFeatureConfigQueryOptions(companyId ?? ""),
    enabled: !userLoading && Boolean(companyId),
  })

  const config = query.data ?? DEFAULT_CONFIG
  const loading = userLoading || query.isLoading

  const get = useCallback(
    <K extends keyof TenantFeatureConfig>(key: K): TenantFeatureConfig[K] =>
      config[key],
    [config],
  )

  return useMemo(
    () => ({
      config,
      loading,
      get,
      accountAssignmentEnabled: config.accountAssignmentEnabled,
      porEnabled: config.porEnabled,
      erpIntegrationEnabled: config.erpIntegrationEnabled,
      erpVendor: config.erpVendor,
      catalogPostCheckoutMode: config.catalogPostCheckoutMode,
    }),
    [config, loading, get],
  )
}

/** @deprecated Use useTenantFeatureConfig */
export const useImplantationConfig = useTenantFeatureConfig