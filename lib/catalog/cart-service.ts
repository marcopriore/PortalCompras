import type { SupabaseClient } from "@supabase/supabase-js"
import {
  contractItemAvailableQuantity,
  contractItemAvailableValue,
  isContractEligibleForPurchaseOrder,
} from "@/lib/contracts/contract-balance-helpers"
import { mapCartRowsToItems } from "@/lib/catalog/checkout"
import type { CatalogCart, CatalogCartItem } from "@/lib/catalog/types"
import type { ContractKind } from "@/types/contracts"

export type CartItemRow = {
  id: string
  contract_id: string
  contract_item_id: string
  supplier_id: string
  material_code: string
  material_description: string
  unit_of_measure: string | null
  unit_price: number
  contract_kind: ContractKind
  quantity: number
}

export type ResolvedCartOfferLine = {
  contractItemId: string
  contractId: string
  supplierId: string
  materialCode: string
  materialDescription: string
  unitOfMeasure: string | null
  unitPrice: number
  contractKind: ContractKind
  contractItem: Parameters<
    typeof import("@/lib/catalog/validate-cart-line").validateCatalogLineQuantity
  >[1]
}

function unwrapJoin<T>(value: T | T[] | null): T | null {
  if (value == null) return null
  return Array.isArray(value) ? value[0] ?? null : value
}

export async function fetchCatalogCart(
  db: SupabaseClient,
  companyId: string,
  userId: string,
): Promise<CatalogCart> {
  const { data: cart } = await db
    .from("catalog_carts")
    .select("id")
    .eq("company_id", companyId)
    .eq("user_id", userId)
    .maybeSingle()

  if (!cart?.id) {
    return { id: "", items: [], itemCount: 0, totalAmount: 0 }
  }

  const { data: items } = await db
    .from("catalog_cart_items")
    .select("*")
    .eq("cart_id", cart.id)
    .order("created_at")

  const mapped = mapCartRowsToItems((items ?? []) as CartItemRow[])
  const totalAmount = mapped.reduce((s, i) => s + i.lineTotal, 0)

  return {
    id: cart.id as string,
    items: mapped,
    itemCount: mapped.length,
    totalAmount,
  }
}

export async function getOrCreateCartId(
  db: SupabaseClient,
  companyId: string,
  userId: string,
): Promise<string | null> {
  const { data: existing } = await db
    .from("catalog_carts")
    .select("id")
    .eq("company_id", companyId)
    .eq("user_id", userId)
    .maybeSingle()

  if (existing?.id) return existing.id as string

  const { data: created, error } = await db
    .from("catalog_carts")
    .insert({ company_id: companyId, user_id: userId })
    .select("id")
    .single()

  if (error || !created) return null
  return created.id as string
}

/** Busca uma linha de contrato para o carrinho — sem varrer todo o catálogo. */
export async function resolveCartOfferLine(
  db: SupabaseClient,
  companyId: string,
  contractItemId: string,
): Promise<ResolvedCartOfferLine | null> {
  const { data: row } = await db
    .from("contract_items")
    .select(
      `
      id,
      material_code,
      material_description,
      unit_of_measure,
      unit_price,
      quantity_contracted,
      quantity_consumed,
      reserved_quantity,
      total_price,
      consumed_value,
      reserved_value,
      eliminated,
      contracts!inner(
        id,
        company_id,
        status,
        contract_kind,
        supplier_id,
        start_date,
        end_date
      )
    `,
    )
    .eq("id", contractItemId)
    .eq("contracts.company_id", companyId)
    .maybeSingle()

  if (!row) return null

  const contract = unwrapJoin(
    (row as { contracts: unknown }).contracts as
      | {
          id: string
          company_id: string
          status: string
          contract_kind: ContractKind
          supplier_id: string
          start_date: string | null
          end_date: string | null
        }
      | Array<{
          id: string
          company_id: string
          status: string
          contract_kind: ContractKind
          supplier_id: string
          start_date: string | null
          end_date: string | null
        }>
      | null,
  )

  if (!contract) return null

  const item = row as {
    id: string
    material_code: string
    material_description: string
    unit_of_measure: string | null
    unit_price: number
    quantity_contracted: number
    quantity_consumed: number
    reserved_quantity: number
    total_price: number
    consumed_value: number
    reserved_value: number
    eliminated: boolean
  }

  if (item.eliminated || !item.material_code?.trim()) return null

  if (
    !isContractEligibleForPurchaseOrder({
      status: contract.status as "active",
      start_date: contract.start_date ?? "",
      end_date: contract.end_date ?? "",
    })
  ) {
    return null
  }

  const { data: catalogItem } = await db
    .from("items")
    .select("status")
    .eq("company_id", companyId)
    .eq("code", item.material_code)
    .maybeSingle()

  if ((catalogItem as { status?: string } | null)?.status !== "active") return null

  const kind = contract.contract_kind
  if (kind === "por_quantidade" && contractItemAvailableQuantity(item) <= 0) return null
  if (kind === "por_valor" && contractItemAvailableValue(item) <= 0) return null

  return {
    contractItemId: item.id,
    contractId: contract.id,
    supplierId: contract.supplier_id,
    materialCode: item.material_code,
    materialDescription: item.material_description,
    unitOfMeasure: item.unit_of_measure,
    unitPrice: item.unit_price ?? 0,
    contractKind: kind,
    contractItem: item,
  }
}

export function recalcCartTotals(items: CatalogCartItem[]): CatalogCart {
  const totalAmount = items.reduce((s, i) => s + i.lineTotal, 0)
  return {
    id: "",
    items,
    itemCount: items.length,
    totalAmount,
  }
}

export function mergeCartItem(
  cart: CatalogCart,
  item: CatalogCartItem,
): CatalogCart {
  const existingIdx = cart.items.findIndex((i) => i.contractItemId === item.contractItemId)
  let items: CatalogCartItem[]
  if (existingIdx >= 0) {
    items = cart.items.map((i, idx) =>
      idx === existingIdx
        ? {
            ...i,
            quantity: item.quantity,
            lineTotal: item.quantity * i.unitPrice,
          }
        : i,
    )
  } else {
    items = [...cart.items, item]
  }
  return {
    ...cart,
    items,
    itemCount: items.length,
    totalAmount: items.reduce((s, i) => s + i.lineTotal, 0),
  }
}

export function updateLocalCartQuantity(
  cart: CatalogCart,
  itemId: string,
  quantity: number,
): CatalogCart {
  const items = cart.items.map((i) =>
    i.id === itemId
      ? { ...i, quantity, lineTotal: quantity * i.unitPrice }
      : i,
  )
  return {
    ...cart,
    items,
    totalAmount: items.reduce((s, i) => s + i.lineTotal, 0),
  }
}

export function removeLocalCartItem(cart: CatalogCart, itemId: string): CatalogCart {
  const items = cart.items.filter((i) => i.id !== itemId)
  return {
    ...cart,
    items,
    itemCount: items.length,
    totalAmount: items.reduce((s, i) => s + i.lineTotal, 0),
  }
}
