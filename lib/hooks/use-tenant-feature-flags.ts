"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { useUser } from "@/lib/hooks/useUser"
import type { FeatureKey } from "@/lib/hooks/usePermissions"
import { tenantFeatureFlagsQueryOptions } from "@/lib/queries/tenant-feature-flags"

const AI_NEGOTIATION_FEATURE_KEYS: FeatureKey[] = [
  "ai_negotiation",
  "ai_negotiation_autonomous",
]

export function useTenantFeatureFlags(keys: FeatureKey[]) {
  const { companyId, loading: userLoading } = useUser()
  const supabase = createClient()

  const query = useQuery({
    ...tenantFeatureFlagsQueryOptions(companyId ?? "", keys, () => supabase),
    enabled: !userLoading && Boolean(companyId),
  })

  const flags = query.data ?? {}

  const has = React.useCallback(
    (key: FeatureKey) => Boolean(flags[key]),
    [flags],
  )

  return { loading: userLoading || query.isLoading, flags, has }
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