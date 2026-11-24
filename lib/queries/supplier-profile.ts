import { queryOptions } from "@tanstack/react-query"
import type { SupabaseClient } from "@supabase/supabase-js"
import { queryKeys } from "@/lib/queries/keys"

export type SupplierProfileRow = {
  id: string
  code: string
  name: string
  cnpj: string | null
  email: string | null
  phone: string | null
  category: string | null
  city: string | null
  state: string | null
  status: string | null
  created_at: string | null
}

export type SupplierProfileDto = {
  supplier: SupplierProfileRow | null
  categories: string[]
}

export async function fetchSupplierProfile(
  supabase: SupabaseClient,
  supplierId: string,
): Promise<SupplierProfileDto> {
  const [supRes, catRes] = await Promise.all([
    supabase
      .from("suppliers")
      .select(
        "id, code, name, cnpj, email, phone, category, city, state, status, created_at",
      )
      .eq("id", supplierId)
      .maybeSingle(),
    supabase
      .from("supplier_categories")
      .select("category")
      .eq("supplier_id", supplierId),
  ])

  if (supRes.error) throw supRes.error
  if (catRes.error) throw catRes.error

  const categories = ((catRes.data ?? []) as { category: string }[])
    .map((c) => c.category)
    .filter(Boolean)

  return {
    supplier: (supRes.data as SupplierProfileRow | null) ?? null,
    categories,
  }
}

export type SupabaseClientFactory = () => SupabaseClient

export function supplierProfileQueryOptions(
  companyId: string,
  supplierId: string,
  supabaseFactory: SupabaseClientFactory,
) {
  return queryOptions({
    queryKey: queryKeys.supplierProfile(companyId, supplierId),
    queryFn: () => fetchSupplierProfile(supabaseFactory(), supplierId),
    enabled: Boolean(companyId && supplierId),
  })
}