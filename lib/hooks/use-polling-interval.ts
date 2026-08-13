import { useTenantSetting } from "@/lib/hooks/use-tenant-settings"
import { getPollingIntervalMs } from "@/lib/settings/tenant-settings"

export function usePollingIntervalMs(): number {
  const { value: pollingSeconds } = useTenantSetting("polling_interval_seconds")
  return getPollingIntervalMs({ polling_interval_seconds: pollingSeconds })
}
