import { describe, expect, it } from "vitest"
import {
  claimCatalogCartItems,
  restoreCatalogCartItems,
  toCatalogCheckoutLines,
  type ClaimedCatalogCartItem,
} from "@/lib/catalog/claim-cart-items"
import type { SupabaseClient } from "@supabase/supabase-js"

const sampleItem = (overrides: Partial<ClaimedCatalogCartItem> = {}): ClaimedCatalogCartItem => ({
  id: "line-1",
  cart_id: "cart-1",
  company_id: "co-1",
  contract_id: "ct-1",
  contract_item_id: "ci-1",
  supplier_id: "sup-1",
  material_code: "M1",
  material_description: "Parafuso",
  unit_of_measure: "UN",
  unit_price: 10,
  contract_kind: "por_quantidade",
  quantity: 2,
  ...overrides,
})

function createMemoryCartDb(initial: ClaimedCatalogCartItem[]) {
  const store = { items: [...initial] }

  const db = {
    from(table: string) {
      if (table !== "catalog_cart_items") {
        throw new Error(`unexpected table ${table}`)
      }
      return {
        delete() {
          return {
            eq(column: string, value: string) {
              return {
                select(_columns?: string) {
                  if (column !== "cart_id") {
                    throw new Error(`unexpected eq column ${column}`)
                  }
                  const claimed = store.items.filter((row) => row.cart_id === value)
                  store.items = store.items.filter((row) => row.cart_id !== value)
                  return Promise.resolve({ data: claimed, error: null })
                },
              }
            },
          }
        },
        insert(rows: ClaimedCatalogCartItem[]) {
          store.items.push(...rows)
          return Promise.resolve({ error: null })
        },
      }
    },
  }

  return { store, db: db as unknown as SupabaseClient }
}

describe("claimCatalogCartItems", () => {
  it("returns lines and removes them from the cart", async () => {
    const item = sampleItem()
    const { store, db } = createMemoryCartDb([item])

    const claimed = await claimCatalogCartItems(db, "cart-1")
    expect(claimed.ok).toBe(true)
    if (!claimed.ok) return
    expect(claimed.items).toEqual([item])
    expect(store.items).toEqual([])
  })

  it("second claim on the same cart gets nothing (double checkout)", async () => {
    const { db } = createMemoryCartDb([sampleItem()])

    const first = await claimCatalogCartItems(db, "cart-1")
    const second = await claimCatalogCartItems(db, "cart-1")

    expect(first.ok).toBe(true)
    if (first.ok) expect(first.items).toHaveLength(1)
    expect(second.ok).toBe(true)
    if (second.ok) expect(second.items).toEqual([])
  })
})

describe("restoreCatalogCartItems", () => {
  it("puts claimed lines back so a failed checkout can retry", async () => {
    const item = sampleItem()
    const { store, db } = createMemoryCartDb([item])

    const claimed = await claimCatalogCartItems(db, "cart-1")
    expect(store.items).toEqual([])
    if (!claimed.ok) return

    const restored = await restoreCatalogCartItems(db, claimed.items)
    expect(restored).toEqual({ ok: true })
    expect(store.items).toEqual([item])
  })
})

describe("toCatalogCheckoutLines", () => {
  it("drops cart metadata used only for restore", () => {
    const lines = toCatalogCheckoutLines([sampleItem()])
    expect(lines).toEqual([
      {
        id: "line-1",
        contract_id: "ct-1",
        contract_item_id: "ci-1",
        supplier_id: "sup-1",
        material_code: "M1",
        material_description: "Parafuso",
        unit_of_measure: "UN",
        unit_price: 10,
        contract_kind: "por_quantidade",
        quantity: 2,
      },
    ])
  })
})
