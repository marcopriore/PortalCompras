import { createServiceRoleClient } from "@/lib/supabase/service-role"
import type { FeatureKey } from "@/lib/hooks/usePermissions"

export async function isTenantFeatureEnabled(
  companyId: string,
  featureKey: FeatureKey,
): Promise<boolean> {
  const service = createServiceRoleClient()
  const { data } = await service
    .from("tenant_features")
    .select("enabled")
    .eq("company_id", companyId)
    .eq("feature_key", featureKey)
    .maybeSingle()

  return Boolean(data?.enabled)
}
