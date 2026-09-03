import { useCallback, useEffect, useMemo, useState } from "react"
import {
  getTenantSettingDefinition,
  type TenantSettingKey,
} from "@/lib/settings/tenant-settings-registry"

function defaultFor(key: TenantSettingKey): number {
  return getTenantSettingDefinition(key)?.defaultValue ?? 0
}

/** Dedup de fetches idênticos (Strict Mode / múltiplos hooks). */
const tenantSettingsInflight = new Map<
  string,
  Promise<Partial<Record<TenantSettingKey, number>>>
>()

function fetchTenantSettings(
  keysKey: string,
): Promise<Partial<Record<TenantSettingKey, number>>> {
  const cached = tenantSettingsInflight.get(keysKey)
  if (cached) return cached

  const promise = fetch(`/api/tenant-settings?keys=${encodeURIComponent(keysKey)}`)
    .then(async (res) => {
      if (!res.ok) return {}
      const data = (await res.json()) as {
        settings?: Partial<Record<TenantSettingKey, number>>
      }
      return data.settings ?? {}
    })
    .catch(() => ({}))
    .finally(() => {
      // libera após um tick para novos mounts pós-navegação ainda compartilharem
      setTimeout(() => tenantSettingsInflight.delete(keysKey), 1500)
    })

  tenantSettingsInflight.set(keysKey, promise)
  return promise
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

    void fetchTenantSettings(keysKey).then((next) => {
      if (cancelled) return
      setSettings(next)
      setLoading(false)
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
