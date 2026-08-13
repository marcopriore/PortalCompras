import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { loadTenantSetting } from "@/lib/settings/tenant-settings"
import { getTenantSettingDefinition } from "@/lib/settings/tenant-settings-registry"

const SETTING_CACHE_MS = 5 * 60 * 1000

const cooldownCache = new Map<string, { cooldownMs: number; expiresAt: number }>()

function defaultCooldownMs(): number {
  const def = getTenantSettingDefinition("background_tasks_cooldown_minutes")
  return (def?.defaultValue ?? 15) * 60 * 1000
}

export async function getBackgroundTasksCooldownMs(
  companyId: string,
): Promise<number> {
  const cached = cooldownCache.get(companyId)
  if (cached && Date.now() < cached.expiresAt) {
    return cached.cooldownMs
  }

  try {
    const service = createServiceRoleClient()
    const minutes = await loadTenantSetting(
      service,
      companyId,
      "background_tasks_cooldown_minutes",
    )
    const cooldownMs = minutes * 60 * 1000
    cooldownCache.set(companyId, {
      cooldownMs,
      expiresAt: Date.now() + SETTING_CACHE_MS,
    })
    return cooldownMs
  } catch {
    return defaultCooldownMs()
  }
}
