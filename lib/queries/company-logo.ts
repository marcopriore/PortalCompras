import { queryOptions } from "@tanstack/react-query"
import type { SupabaseClient } from "@supabase/supabase-js"
import { queryKeys } from "@/lib/queries/keys"
import type { SupabaseClientFactory } from "@/lib/queries/payment-conditions"

export async function fetchCompanyLogoUrl(
  supabase: SupabaseClient,
  companyId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("companies")
    .select("logo_url")
    .eq("id", companyId)
    .maybeSingle()

  const url = typeof data?.logo_url === "string" ? data.logo_url.trim() : ""
  return url.length > 0 ? url : null
}

export function companyLogoQueryOptions(
  companyId: string,
  supabaseFactory: SupabaseClientFactory,
) {
  return queryOptions({
    queryKey: queryKeys.companyLogo(companyId),
    queryFn: () => fetchCompanyLogoUrl(supabaseFactory(), companyId),
    enabled: Boolean(companyId),
  })
}