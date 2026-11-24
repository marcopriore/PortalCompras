import { queryOptions } from "@tanstack/react-query"
import type { SupabaseClient } from "@supabase/supabase-js"
import { queryKeys } from "@/lib/queries/keys"

export type SupplierCounterOfferByItem = {
  target_unit_price: number
  rationale: string | null
}

export async function fetchSupplierNegotiationCounterOffers(
  supabase: SupabaseClient,
  supplierId: string,
  roundId: string,
): Promise<Record<string, SupplierCounterOfferByItem>> {
  const { data, error } = await supabase
    .from("negotiation_counter_offers")
    .select("quotation_item_id, target_unit_price, rationale, supplier_id")
    .eq("round_id", roundId)

  if (error) throw error

  const map: Record<string, SupplierCounterOfferByItem> = {}
  for (const row of data ?? []) {
    const rowSupplierId = row.supplier_id as string | null
    if (rowSupplierId != null && rowSupplierId !== supplierId) continue
    map[String(row.quotation_item_id)] = {
      target_unit_price: Number(row.target_unit_price),
      rationale: (row.rationale as string | null) ?? null,
    }
  }
  return map
}

export type SupabaseClientFactory = () => SupabaseClient

export function supplierNegotiationCounterOffersQueryOptions(
  companyId: string,
  supplierId: string,
  roundId: string,
  supabaseFactory: SupabaseClientFactory,
) {
  return queryOptions({
    queryKey: queryKeys.supplierNegotiationCounterOffers(
      companyId,
      supplierId,
      roundId,
    ),
    queryFn: () =>
      fetchSupplierNegotiationCounterOffers(
        supabaseFactory(),
        supplierId,
        roundId,
      ),
    enabled: Boolean(companyId && supplierId && roundId),
  })
}