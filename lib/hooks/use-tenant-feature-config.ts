import { useCallback, useEffect, useMemo, useState } from "react"
import type { TenantFeatureConfig } from "@/lib/settings/tenant-feature-settings"
import { parseTenantFeatureConfig } from "@/lib/settings/tenant-feature-settings"

const DEFAULT_CONFIG: TenantFeatureConfig = parseTenantFeatureConfig({})

export function useTenantFeatureConfig() {
  const [config, setConfig] = useState<TenantFeatureConfig>(DEFAULT_CONFIG)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    void fetch("/api/tenant-feature-config")
      .then(async (res) => {
        if (!res.ok) return null
        return (await res.json()) as { config?: TenantFeatureConfig }
      })
      .then((data) => {
        if (cancelled) return
        if (data?.config) setConfig(data.config)
      })
      .catch(() => {
        if (!cancelled) setConfig(DEFAULT_CONFIG)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

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
    }),
    [config, loading, get],
  )
}

/** @deprecated Use useTenantFeatureConfig */
export const useImplantationConfig = useTenantFeatureConfig
