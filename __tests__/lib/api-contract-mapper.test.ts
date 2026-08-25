import { describe, expect, it } from "vitest"
import {
  mapContractAcceptanceToApi,
  mapContractBalanceToApi,
  mapContractToApi,
} from "@/lib/api/external/mappers/contract"
import { isApiScope } from "@/lib/api/external/scopes"

describe("mapContractToApi", () => {
  it("calcula available_value no cabeçalho e nos itens", () => {
    const mapped = mapContractToApi(
      {
        id: "c1",
        code: "CTR-1",
        erp_code: "ERP-1",
        title: "Contrato teste",
        contract_kind: "por_quantidade",
        type: "fornecimento",
        status: "active",
        value: 1000,
        total_value: 1000,
        consumed_value: 200,
        reserved_value: 100,
        consumed_quantity: 0,
        reserved_quantity: 0,
        suppliers: { code: "FORN-1", name: "Fornecedor" },
        payment_conditions: { code: "30D", description: "30 dias" },
        created_at: "2026-01-01T00:00:00Z",
      },
      [
        {
          id: "i1",
          material_code: "MAT-1",
          material_description: "Item",
          unit_of_measure: "UN",
          quantity_contracted: 10,
          quantity_consumed: 2,
          reserved_quantity: 1,
          unit_price: 50,
          total_price: 500,
          consumed_value: 100,
          reserved_value: 50,
          delivery_days: 5,
          notes: null,
          eliminated: false,
        },
      ],
    )

    expect(mapped.available_value).toBe(700)
    expect(mapped.supplier_code).toBe("FORN-1")
    expect(mapped.items).toHaveLength(1)
    expect(mapped.items[0].available_quantity).toBe(7)
    expect(mapped.items[0].available_value).toBe(350)
  })

  it("mapContractBalanceToApi resume saldos", () => {
    const balance = mapContractBalanceToApi({
      id: "c1",
      code: "CTR-1",
      status: "active",
      contract_kind: "por_valor",
      value: 500,
      total_value: null,
      consumed_value: 0,
      reserved_value: 0,
      consumed_quantity: 0,
      reserved_quantity: 0,
      created_at: "2026-01-01T00:00:00Z",
    })
    expect(balance.available_value).toBe(500)
    expect(balance.code).toBe("CTR-1")
  })

  it("mapContractAcceptanceToApi normaliza action", () => {
    expect(
      mapContractAcceptanceToApi({
        id: "a1",
        action: "accepted",
        notes: null,
        term_version: "1",
        term_version_date: "2026-01-01",
        created_at: "2026-01-01T00:00:00Z",
        supplier_id: "s1",
      }).action,
    ).toBe("accepted")
  })
})

describe("API scopes contracts", () => {
  it("reconhece contracts:read", () => {
    expect(isApiScope("contracts:read")).toBe(true)
  })
})
