import { queryOptions } from "@tanstack/react-query"
import type { SupabaseClient } from "@supabase/supabase-js"
import { loadContractPoLinkPromptEnabled } from "@/lib/contracts/contract-balance-settings"
import { queryKeys } from "@/lib/queries/keys"
import type { SupabaseClientFactory } from "@/lib/queries/payment-conditions"

export function contractPoLinkPromptQueryOptions(
  companyId: string,
  supabaseFactory: SupabaseClientFactory,
) {
  return queryOptions({
    queryKey: queryKeys.contractPoLinkPrompt(companyId),
    queryFn: () => loadContractPoLinkPromptEnabled(supabaseFactory(), companyId),
    enabled: Boolean(companyId),
  })
}