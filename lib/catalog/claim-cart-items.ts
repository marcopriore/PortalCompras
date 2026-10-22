import type { SupabaseClient } from "@supabase/supabase-js"
import type { CatalogCartLineRow } from "@/lib/catalog/create-catalog-purchase-orders"

const CART_ITEM_COLUMNS =
  "id, cart_id, company_id, contract_id, contract_item_id, supplier_id, material_code, material_description, unit_of_measure, unit_price, contract_kind, quantity, created_at, updated_at"

export type ClaimedCatalogCartItem = CatalogCartLineRow & {
  cart_id: string
  company_id: string
  created_at?: string
  updated_at?: string
}

/**
 * Atomically takes ownership of cart lines via DELETE … RETURNING.
 * A concurrent checkout on the same cart gets zero rows and must abort.
 */
export async function claimCatalogCartItems(
  db: SupabaseClient,
  cartId: string,
): Promise<
  | { ok: true; items: ClaimedCatalogCartItem[] }
  | { ok: false; error: string }
> {
  const { data, error } = await db
    .from("catalog_cart_items")
    .delete()
    .eq("cart_id", cartId)
    .select(CART_ITEM_COLUMNS)

  if (error) {
    return { ok: false, error: error.message }
  }

  return { ok: true, items: (data ?? []) as ClaimedCatalogCartItem[] }
}

export async function restoreCatalogCartItems(
  db: SupabaseClient,
  items: ClaimedCatalogCartItem[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (items.length === 0) return { ok: true }

  const { error } = await db.from("catalog_cart_items").insert(items)
  if (error) {
    return { ok: false, error: error.message }
  }
  return { ok: true }
}

export function toCatalogCheckoutLines(
  items: ClaimedCatalogCartItem[],
): CatalogCartLineRow[] {
  return items.map((item) => ({
    id: item.id,
    contract_id: item.contract_id,
    contract_item_id: item.contract_item_id,
    supplier_id: item.supplier_id,
    material_code: item.material_code,
    material_description: item.material_description,
    unit_of_measure: item.unit_of_measure,
    unit_price: item.unit_price,
    contract_kind: item.contract_kind,
    quantity: item.quantity,
  }))
}
