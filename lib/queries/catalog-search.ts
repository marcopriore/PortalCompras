import { queryOptions } from "@tanstack/react-query"
import type { SupabaseClient } from "@supabase/supabase-js"
import { queryKeys } from "@/lib/queries/keys"
import type { SupabaseClientFactory } from "@/lib/queries/payment-conditions"

export type CatalogItemSearchRow = {
  code: string
  description: string
  unit_of_measure: string
  long_description?: string | null
  id?: string
  target_price?: number | null
}

export type CatalogSupplierSearchRow = {
  id: string
  name: string
  cnpj: string | null
  code: string | null
  category: string | null
}

type ItemSearchOpts = {
  limit?: number
  withTargetPrice?: boolean
}

export async function fetchCatalogItemSearch(
  supabase: SupabaseClient,
  companyId: string,
  term: string,
  opts: ItemSearchOpts = {},
): Promise<CatalogItemSearchRow[]> {
  const trimmed = term.trim()
  if (trimmed.length < 2) return []

  const limit = opts.limit ?? 20
  const ilike = `%${trimmed}%`
  const select = opts.withTargetPrice
    ? "id, code, short_description, unit_of_measure, target_price"
    : "id, code, short_description, unit_of_measure, long_description"

  const { data, error } = await supabase
    .from("items")
    .select(select)
    .eq("company_id", companyId)
    .eq("status", "active")
    .or(`code.ilike.${ilike},short_description.ilike.${ilike}`)
    .limit(limit)

  if (error) {
    throw error
  }

  return (data ?? []).map(
    (i: {
      id?: string
      code: string
      short_description: string
      unit_of_measure: string | null
      long_description?: string | null
      target_price?: number | null
    }) => ({
      id: i.id,
      code: i.code,
      description: i.short_description,
      unit_of_measure: i.unit_of_measure ?? "",
      long_description: i.long_description ?? null,
      target_price: i.target_price ?? null,
    }),
  )
}

export async function fetchCatalogSupplierSearch(
  supabase: SupabaseClient,
  companyId: string,
  term: string,
): Promise<CatalogSupplierSearchRow[]> {
  const trimmed = term.trim()
  if (trimmed.length < 2) return []

  const ilike = `%${trimmed}%`
  const { data, error } = await supabase
    .from("suppliers")
    .select("id, name, cnpj, code, category")
    .eq("company_id", companyId)
    .eq("status", "active")
    .or(`name.ilike.${ilike},cnpj.ilike.${ilike}`)
    .limit(20)

  if (error) {
    throw error
  }

  return (data ?? []) as CatalogSupplierSearchRow[]
}

export function catalogItemSearchQueryOptions(
  companyId: string,
  debouncedTerm: string,
  variant: "quotation" | "contract",
  supabaseFactory: SupabaseClientFactory,
) {
  const enabled = Boolean(companyId) && debouncedTerm.trim().length >= 2
  return queryOptions({
    queryKey: queryKeys.catalogItemSearch(companyId, debouncedTerm.trim(), variant),
    queryFn: () =>
      fetchCatalogItemSearch(supabaseFactory(), companyId, debouncedTerm, {
        limit: variant === "contract" ? 10 : 20,
        withTargetPrice: variant === "contract",
      }),
    enabled,
  })
}

export function catalogSupplierSearchQueryOptions(
  companyId: string,
  debouncedTerm: string,
  supabaseFactory: SupabaseClientFactory,
) {
  const enabled = Boolean(companyId) && debouncedTerm.trim().length >= 2
  return queryOptions({
    queryKey: queryKeys.catalogSupplierSearch(companyId, debouncedTerm.trim()),
    queryFn: () => fetchCatalogSupplierSearch(supabaseFactory(), companyId, debouncedTerm),
    enabled,
  })
}