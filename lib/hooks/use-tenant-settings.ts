import { useCallback, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { useTenant } from "@/contexts/tenant-context"
import {
  getTenantSettingDefinition,
  type TenantSettingKey,
} from "@/lib/settings/tenant-settings-registry"
import { tenantSettingsQueryOptions } from "@/lib/queries/tenant-settings-fetch"

function defaultFor(key: TenantSettingKey): number {
  return getTenantSettingDefinition(key)?.defaultValue ?? 0
}

export function useTenantSettings(keys: TenantSettingKey[]) {
  const { companyId } = useTenant()
  const keysKey = useMemo(() => [...keys].sort().join(","), [keys])

  const query = useQuery({
    ...tenantSettingsQueryOptions(companyId ?? "", keysKey),
    enabled: Boolean(companyId),
  })

  const settings = query.data ?? {}

  const get = useCallback(
    (key: TenantSettingKey): number => {
      const value = settings[key]
      if (value != null && !Number.isNaN(value)) return value
      return defaultFor(key)
    },
    [settings],
  )

  return { settings, loading: query.isLoading, get }
}

export function useTenantSetting(key: TenantSettingKey): {
  value: number
  loading: boolean
} {
  const { get, loading } = useTenantSettings([key])
  return { value: get(key), loading }
}