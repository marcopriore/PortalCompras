import { queryOptions } from "@tanstack/react-query"
import type { SupabaseClient } from "@supabase/supabase-js"
import { queryKeys } from "@/lib/queries/keys"

export type PaymentConditionRow = {
  id: string
  code: string
  description: string
}

export async function fetchPaymentConditions(
  supabase: SupabaseClient,
  companyId: string,
): Promise<PaymentConditionRow[]> {
  const { data, error } = await supabase
    .from("payment_conditions")
    .select("id, code, description")
    .eq("company_id", companyId)
    .eq("active", true)
    .order("code")

  if (error) {
    throw error
  }

  return (data ?? []) as PaymentConditionRow[]
}

export type SupabaseClientFactory = () => SupabaseClient

export function paymentConditionsQueryOptions(
  companyId: string,
  supabaseFactory: SupabaseClientFactory,
) {
  return queryOptions({
    queryKey: queryKeys.paymentConditions(companyId),
    queryFn: () => fetchPaymentConditions(supabaseFactory(), companyId),
    enabled: Boolean(companyId),
  })
}