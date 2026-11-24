import { queryOptions } from "@tanstack/react-query"
import type { CatalogCart } from "@/lib/catalog/types"
import { queryKeys } from "@/lib/queries/keys"

const emptyCart = (): CatalogCart => ({
  id: "",
  items: [],
  itemCount: 0,
  totalAmount: 0,
})

export async function fetchCatalogCart(): Promise<CatalogCart> {
  const res = await fetch("/api/catalog/cart", { cache: "no-store" })
  if (!res.ok) return emptyCart()
  const data = (await res.json()) as { cart: CatalogCart }
  return data.cart ?? emptyCart()
}

export function catalogCartQueryOptions(companyId: string) {
  return queryOptions({
    queryKey: [...queryKeys.catalogOffers(companyId), "cart"] as const,
    queryFn: fetchCatalogCart,
    enabled: Boolean(companyId),
  })
}