import { describe, expect, it } from "vitest"
import {
  contractLinkFromMatch,
  contractMatchSelectionsSignature,
  findContractMatchesForQuotationItem,
  pickBestContractMatch,
  validateSingleContractPerOrder,
} from "@/lib/contracts/match-contract-items"
import type { Contract, ContractItem } from "@/types/contracts"

function makeItem(
  overrides: Partial<ContractItem> & { id: string },
): ContractItem {
  return {
    id: overrides.id,
    contract_id: overrides.contract_id ?? "c1",
    company_id: "co1",
    material_code: overrides.material_code ?? "MAT-1",
    material_description: overrides.material_description ?? "Item",
    unit_of_measure: "UN",
    quantity_contracted: overrides.quantity_contracted ?? 100,
    quantity_consumed: overrides.quantity_consumed ?? 0,
    reserved_quantity: overrides.reserved_quantity ?? 0,
    unit_price: overrides.unit_price ?? 10,
    total_price: overrides.total_price ?? 1000,
    consumed_value: overrides.consumed_value ?? 0,
    reserved_value: overrides.reserved_value ?? 0,
    delivery_days: null,
    notes: null,
    quotation_item_id: overrides.quotation_item_id ?? null,
    created_at: overrides.created_at ?? "2026-01-01T00:00:00Z",
    eliminated: overrides.eliminated ?? false,
    eliminated_at: null,
    eliminated_reason: null,
  }
}

function makeContract(
  overrides: Partial<Contract> & { id: string; items?: ContractItem[] },
): Contract {
  return {
    id: overrides.id,
    company_id: "co1",
    supplier_id: overrides.supplier_id ?? "s1",
    supplier_name: "Fornecedor",
    supplier_code: "F1",
    code: overrides.code ?? "CTR-001",
    title: overrides.title ?? "Contrato",
    contract_kind: overrides.contract_kind ?? "por_quantidade",
    status: overrides.status ?? "active",
    start_date: "2026-01-01",
    end_date: "2026-12-31",
    value: null,
    total_value: 10000,
    consumed_value: 0,
    consumed_quantity: 0,
    reserved_value: 0,
    reserved_quantity: 0,
    payment_condition_id: null,
    payment_condition_code: null,
    payment_condition_description: null,
    contract_terms: null,
    erp_code: null,
    catalog_available: overrides.catalog_available ?? false,
    quotation_id: overrides.quotation_id ?? null,
    file_url: null,
    notes: null,
    created_by: null,
    created_at: "",
    updated_at: "",
    sent_for_acceptance_at: null,
    accepted_at: null,
    accepted_by_supplier: null,
    refusal_reason: null,
    items: overrides.items,
  }
}

describe("findContractMatchesForQuotationItem", () => {
  it("prioriza match por quotation_item_id", () => {
    const contracts = [
      makeContract({
        id: "c1",
        code: "CTR-A",
        items: [
          makeItem({ id: "ci1", material_code: "MAT-1", quotation_item_id: "qi1" }),
        ],
      }),
      makeContract({
        id: "c2",
        code: "CTR-B",
        items: [makeItem({ id: "ci2", material_code: "MAT-1" })],
      }),
    ]

    const matches = findContractMatchesForQuotationItem(
      "q1",
      {
        quotationItemId: "qi1",
        materialCode: "MAT-1",
        quantity: 5,
        supplierId: "s1",
      },
      contracts,
    )

    expect(matches[0]?.contractId).toBe("c1")
    expect(matches[0]?.matchReason).toBe("quotation_item_id")
  })

  it("encontra por material_code quando não há quotation_item_id", () => {
    const contracts = [
      makeContract({
        id: "c1",
        items: [makeItem({ id: "ci1", material_code: "ABC-99" })],
      }),
    ]

    const matches = findContractMatchesForQuotationItem(
      "q1",
      {
        quotationItemId: "qi9",
        materialCode: "abc-99",
        quantity: 1,
        supplierId: "s1",
      },
      contracts,
    )

    expect(matches).toHaveLength(1)
    expect(matches[0]?.matchReason).toBe("material_code")
  })

  it("ignora item sem saldo", () => {
    const contracts = [
      makeContract({
        id: "c1",
        items: [
          makeItem({
            id: "ci1",
            material_code: "MAT-1",
            quantity_contracted: 10,
            quantity_consumed: 10,
          }),
        ],
      }),
    ]

    const matches = findContractMatchesForQuotationItem(
      "q1",
      {
        quotationItemId: "qi1",
        materialCode: "MAT-1",
        quantity: 1,
        supplierId: "s1",
      },
      contracts,
    )

    expect(matches).toHaveLength(0)
  })
})

describe("pickBestContractMatch", () => {
  it("retorna o primeiro candidato ordenado", () => {
    const match = pickBestContractMatch([
      {
        contractId: "c1",
        contractCode: "CTR",
        contractTitle: "T",
        contractKind: "por_quantidade",
        supplierId: "s1",
        contractItemId: "ci1",
        materialCode: "M",
        materialDescription: "D",
        unitPrice: 1,
        availableQuantity: 10,
        availableValue: 100,
        lineNumber: 1,
        matchScore: 100,
        matchReason: "quotation_item_id",
      },
    ])
    expect(contractLinkFromMatch(match!).contractItemId).toBe("ci1")
  })
})

describe("validateSingleContractPerOrder", () => {
  it("rejeita múltiplos contratos no mesmo pedido", () => {
    expect(validateSingleContractPerOrder(["c1", "c2", null])).toMatch(
      /contratos diferentes/,
    )
  })

  it("aceita um contrato ou nenhum", () => {
    expect(validateSingleContractPerOrder(["c1", "c1", null])).toBeNull()
    expect(validateSingleContractPerOrder([null, null])).toBeNull()
  })
})

describe("contractMatchSelectionsSignature", () => {
  it("é estável para mesma seleção em ordem diferente", () => {
    const a = [
      {
        quotationItemId: "q1",
        supplierId: "s1",
        materialCode: "A",
        quantity: 2,
      },
      {
        quotationItemId: "q2",
        supplierId: "s2",
        materialCode: "B",
        quantity: 1,
      },
    ]
    const b = [...a].reverse()
    expect(contractMatchSelectionsSignature(a)).toBe(
      contractMatchSelectionsSignature(b),
    )
  })
})
