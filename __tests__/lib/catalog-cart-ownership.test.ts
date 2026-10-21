import { describe, expect, it } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"
import { loadOwnedCartLine } from "@/lib/catalog/cart-service"

type EqFilter = { column: string; value: string }

function createFakeCatalogDb(options: {
  callerCartId: string | null
  ownedLine: Record<string, unknown> | null
}): { db: SupabaseClient; itemFilters: EqFilter[] } {
  const itemFilters: EqFilter[] = []

  const db = {
    from(table: string) {
      const filters: EqFilter[] = []
      const query = {
        select() {
          return query
        },
        eq(column: string, value: string) {
          filters.push({ column, value })
          if (table === "catalog_cart_items") {
            itemFilters.push({ column, value })
          }
          return query
        },
        async maybeSingle() {
          if (table === "catalog_carts") {
            if (!options.callerCartId) return { data: null }
            return { data: { id: options.callerCartId } }
          }
          const cartIdFilter = filters.find((f) => f.column === "cart_id")
          if (!cartIdFilter || cartIdFilter.value !== options.callerCartId) {
            return { data: null }
          }
          return { data: options.ownedLine }
        },
      }
      return query
    },
  }

  return { db: db as unknown as SupabaseClient, itemFilters }
}

describe("loadOwnedCartLine", () => {
  it("returns the line only when it belongs to the caller's cart", async () => {
    const line = {
      id: "item-a",
      cart_id: "cart-a",
      company_id: "co-1",
      contract_item_id: "ci-1",
      contract_id: "c-1",
      supplier_id: "s-1",
      material_code: "M1",
      material_description: "Parafuso",
      unit_of_measure: "UN",
      unit_price: 10,
      contract_kind: "por_quantidade",
      quantity: 2,
    }
    const { db, itemFilters } = createFakeCatalogDb({
      callerCartId: "cart-a",
      ownedLine: line,
    })

    const owned = await loadOwnedCartLine(db, {
      companyId: "co-1",
      userId: "user-a",
      itemId: "item-a",
    })

    expect(owned?.cartId).toBe("cart-a")
    expect(owned?.line.id).toBe("item-a")
    expect(itemFilters).toEqual(
      expect.arrayContaining([
        { column: "id", value: "item-a" },
        { column: "cart_id", value: "cart-a" },
        { column: "company_id", value: "co-1" },
      ]),
    )
  })

  it("does not load another user's cart line even in the same tenant", async () => {
    const { db, itemFilters } = createFakeCatalogDb({
      callerCartId: "cart-a",
      ownedLine: null,
    })

    const owned = await loadOwnedCartLine(db, {
      companyId: "co-1",
      userId: "user-a",
      itemId: "item-b",
    })

    expect(owned).toBeNull()
    expect(itemFilters).toEqual(
      expect.arrayContaining([{ column: "cart_id", value: "cart-a" }]),
    )
  })

  it("returns null when the caller has no cart", async () => {
    const { db, itemFilters } = createFakeCatalogDb({
      callerCartId: null,
      ownedLine: { id: "item-b" },
    })

    const owned = await loadOwnedCartLine(db, {
      companyId: "co-1",
      userId: "user-a",
      itemId: "item-b",
    })

    expect(owned).toBeNull()
    expect(itemFilters).toEqual([])
  })
})
