import { useCallback, useEffect, useMemo, useState } from "react"
import {
  getTenantSettingDefinition,
  type TenantSettingKey,
} from "@/lib/settings/tenant-settings-registry"

function defaultFor(key: TenantSettingKey): number {
  return getTenantSettingDefinition(key)?.defaultValue ?? 0
}

export function useTenantSettings(keys: TenantSettingKey[]) {
  const keysKey = useMemo(() => [...keys].sort().join(","), [keys])
  const [settings, setSettings] = useState<Partial<Record<TenantSettingKey, number>>>(
    {},
  )
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    void fetch(`/api/tenant-settings?keys=${encodeURIComponent(keysKey)}`)
      .then(async (res) => {
        if (!res.ok) return null
        return (await res.json()) as {
          settings?: Partial<Record<TenantSettingKey, number>>
        }
      })
      .then((data) => {
        if (cancelled) return
        setSettings(data?.settings ?? {})
      })
      .catch(() => {
        if (!cancelled) setSettings({})
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [keysKey])

  const get = useCallback(
    (key: TenantSettingKey): number => {
      const value = settings[key]
      if (value != null && !Number.isNaN(value)) return value
      return defaultFor(key)
    },
    [settings],
  )

  return { settings, loading, get }
}

export function useTenantSetting(key: TenantSettingKey): {
  value: number
  loading: boolean
} {
  const { get, loading } = useTenantSettings([key])
  return { value: get(key), loading }
}
