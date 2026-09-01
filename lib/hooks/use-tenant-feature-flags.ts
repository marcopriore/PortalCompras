"use client"

import * as React from "react"
import { createClient } from "@/lib/supabase/client"
import { useUser } from "@/lib/hooks/useUser"
import type { FeatureKey } from "@/lib/hooks/usePermissions"

const AI_NEGOTIATION_FEATURE_KEYS: FeatureKey[] = [
  "ai_negotiation",
  "ai_negotiation_autonomous",
]

export function useTenantFeatureFlags(keys: FeatureKey[]) {
  const { companyId, loading: userLoading } = useUser()
  const [loading, setLoading] = React.useState(true)
  const [flags, setFlags] = React.useState<Partial<Record<FeatureKey, boolean>>>({})

  const keysKey = keys.join(",")

  React.useEffect(() => {
    let alive = true

    const load = async () => {
      if (userLoading) return
      if (!companyId) {
        if (alive) {
          setFlags({})
          setLoading(false)
        }
        return
      }

      setLoading(true)
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from("tenant_features")
          .select("feature_key, enabled")
          .eq("company_id", companyId)
          .in("feature_key", keys)

        if (!alive) return

        const next: Partial<Record<FeatureKey, boolean>> = {}
        for (const key of keys) {
          next[key] = false
        }
        if (!error) {
          for (const row of (data ?? []) as { feature_key: FeatureKey; enabled: boolean }[]) {
            if (row.feature_key) {
              next[row.feature_key] = Boolean(row.enabled)
            }
          }
        }
        setFlags(next)
      } finally {
        if (alive) setLoading(false)
      }
    }

    void load()
    return () => {
      alive = false
    }
  }, [companyId, userLoading, keysKey])

  const has = React.useCallback(
    (key: FeatureKey) => Boolean(flags[key]),
    [flags],
  )

  return { loading: userLoading || loading, flags, has }
}

/** Gate de UI: respeita tenant_features (não bypass de superadmin). */
export function useAiNegotiationUiAccess() {
  const { loading, has } = useTenantFeatureFlags(AI_NEGOTIATION_FEATURE_KEYS)

  return {
    loading,
    showConsultiveAi: has("ai_negotiation"),
    showAutonomousAi: has("ai_negotiation") && has("ai_negotiation_autonomous"),
  }
}
