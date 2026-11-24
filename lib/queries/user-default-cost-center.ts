import { queryOptions } from "@tanstack/react-query"
import type { SupabaseClient } from "@supabase/supabase-js"
import { queryKeys } from "@/lib/queries/keys"
import type { SupabaseClientFactory } from "@/lib/queries/payment-conditions"

export async function fetchUserDefaultCostCenterCode(
  supabase: SupabaseClient,
  userId: string,
): Promise<string> {
  const { data } = await supabase
    .from("profiles")
    .select("cost_center_id, cost_centers(code)")
    .eq("id", userId)
    .maybeSingle()

  if (!data) return ""
  const rel = data.cost_centers as
    | { code?: string }
    | { code?: string }[]
    | null
  if (Array.isArray(rel)) return rel[0]?.code ?? ""
  return rel?.code ?? ""
}

export function userDefaultCostCenterQueryOptions(
  userId: string,
  supabaseFactory: SupabaseClientFactory,
) {
  return queryOptions({
    queryKey: queryKeys.userDefaultCostCenter(userId),
    queryFn: () => fetchUserDefaultCostCenterCode(supabaseFactory(), userId),
    enabled: Boolean(userId),
  })
}