import { describe, expect, it } from "vitest"
import {
  catalogItemAvailableQuantity,
  validateCatalogLineQuantity,
} from "@/lib/catalog/validate-cart-line"
import { mapCartRowsToItems } from "@/lib/catalog/checkout"
import { groupCatalogLinesBySupplier } from "@/lib/catalog/create-catalog-purchase-orders"
import type { ContractItem } from "@/types/contracts"

const baseItem: Pick<
  ContractItem,
  | "quantity_contracted"
  | "quantity_consumed"
  | "reserved_quantity"
  | "eliminated"
  | "total_price"
  | "consumed_value"
  | "reserved_value"
  | "unit_price"
> = {
  quantity_contracted: 100,
  quantity_consumed: 20,
  reserved_quantity: 10,
  eliminated: false,
  total_price: 5000,
  consumed_value: 1000,
  reserved_value: 500,
  unit_price: 50,
}

describe("validateCatalogLineQuantity", () => {
  it("rejects non-positive quantity", () => {
    expect(validateCatalogLineQuantity("por_quantidade", baseItem, 0)).toMatch(
      /maior que zero/i,
    )
  })

  it("allows quantity within saldo por_quantidade", () => {
    expect(validateCatalogLineQuantity("por_quantidade", baseItem, 70)).toBeNull()
  })

  it("blocks quantity above available por_quantidade", () => {
    // available = 100 - 20 - 10 = 70
    expect(validateCatalogLineQuantity("por_quantidade", baseItem, 71)).toMatch(
      /saldo insuficiente/i,
    )
  })

  it("blocks line total above available value for por_valor", () => {
    // available value = 5000 - 1000 - 500 = 3500 → max qty at 50 = 70
    expect(validateCatalogLineQuantity("por_valor", baseItem, 71)).toMatch(
      /saldo insuficiente/i,
    )
  })

  it("allows line within available value for por_valor", () => {
    expect(validateCatalogLineQuantity("por_valor", baseItem, 70)).toBeNull()
  })
})

describe("catalogItemAvailableQuantity", () => {
  it("returns remaining qty for por_quantidade", () => {
    expect(catalogItemAvailableQuantity("por_quantidade", baseItem)).toBe(70)
  })

  it("returns floor of value/unit for por_valor", () => {
    expect(catalogItemAvailableQuantity("por_valor", baseItem)).toBe(70)
  })
})

describe("mapCartRowsToItems", () => {
  it("maps rows and computes lineTotal", () => {
    const items = mapCartRowsToItems([
      {
        id: "1",
        contract_id: "c1",
        contract_item_id: "ci1",
        supplier_id: "s1",
        material_code: "M1",
        material_description: "Item",
        unit_of_measure: "UN",
        unit_price: 10,
        contract_kind: "por_quantidade",
        quantity: 3,
      },
    ])
    expect(items).toHaveLength(1)
    expect(items[0].lineTotal).toBe(30)
    expect(items[0].contractItemId).toBe("ci1")
  })
})

describe("groupCatalogLinesBySupplier", () => {
  it("groups lines by supplier_id", () => {
    const groups = groupCatalogLinesBySupplier([
      {
        id: "1",
        contract_id: "c1",
        contract_item_id: "ci1",
        supplier_id: "s1",
        material_code: "A",
        material_description: "A",
        unit_of_measure: "UN",
        unit_price: 1,
        contract_kind: "por_valor",
        quantity: 1,
      },
      {
        id: "2",
        contract_id: "c2",
        contract_item_id: "ci2",
        supplier_id: "s2",
        material_code: "B",
        material_description: "B",
        unit_of_measure: "UN",
        unit_price: 2,
        contract_kind: "por_valor",
        quantity: 1,
      },
      {
        id: "3",
        contract_id: "c1",
        contract_item_id: "ci3",
        supplier_id: "s1",
        material_code: "C",
        material_description: "C",
        unit_of_measure: "UN",
        unit_price: 3,
        contract_kind: "por_valor",
        quantity: 2,
      },
    ])
    expect(groups.size).toBe(2)
    expect(groups.get("s1")).toHaveLength(2)
    expect(groups.get("s2")).toHaveLength(1)
  })
})
