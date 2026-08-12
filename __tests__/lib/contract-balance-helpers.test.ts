import { describe, expect, it } from "vitest"
import {
  contractAvailableValue,
  contractItemAvailableQuantity,
  buildContractItemLineNumberMap,
  isContractEligibleForPurchaseOrder,
} from "@/lib/contracts/contract-balance-helpers"
import type { Contract, ContractItem } from "@/types/contracts"

const baseContract: Contract = {
  id: "c1",
  company_id: "co1",
  supplier_id: "s1",
  supplier_name: "Fornecedor",
  supplier_code: "F1",
  code: "CTR-2026-0001",
  title: "Teste",
  contract_kind: "por_valor",
  status: "active",
  start_date: "2026-01-01",
  end_date: "2026-12-31",
  value: 10000,
  total_value: 8000,
  consumed_value: 2000,
  consumed_quantity: 0,
  reserved_value: 1000,
  reserved_quantity: 0,
  payment_condition_id: null,
  payment_condition_code: null,
  payment_condition_description: null,
  contract_terms: null,
  erp_code: null,
  quotation_id: null,
  file_url: null,
  notes: null,
  created_by: null,
  created_at: "",
  updated_at: "",
  sent_for_acceptance_at: null,
  accepted_at: null,
  accepted_by_supplier: null,
  refusal_reason: null,
}

const baseItem: ContractItem = {
  id: "i1",
  contract_id: "c1",
  company_id: "co1",
  material_code: "MAT-1",
  material_description: "Item",
  unit_of_measure: "UN",
  quantity_contracted: 100,
  quantity_consumed: 20,
  reserved_quantity: 10,
  unit_price: 50,
  total_price: 5000,
  consumed_value: 1000,
  reserved_value: 500,
  delivery_days: 5,
  notes: null,
  quotation_item_id: null,
  created_at: "",
  eliminated: false,
  eliminated_at: null,
  eliminated_reason: null,
}

describe("contract-balance-helpers", () => {
  it("calcula saldo disponível do contrato", () => {
    expect(contractAvailableValue(baseContract)).toBe(7000)
  })

  it("calcula quantidade disponível por item", () => {
    expect(contractItemAvailableQuantity(baseItem)).toBe(70)
  })

  it("valida elegibilidade por vigência", () => {
    expect(
      isContractEligibleForPurchaseOrder(baseContract, new Date("2026-06-01")),
    ).toBe(true)
  })

  it("numera itens do contrato em sequência", () => {
    const map = buildContractItemLineNumberMap([
      {
        id: "b",
        contract_id: "c1",
        created_at: "2026-02-01T00:00:00Z",
      },
      {
        id: "a",
        contract_id: "c1",
        created_at: "2026-01-01T00:00:00Z",
      },
    ])
    expect(map.get("a")).toBe(1)
    expect(map.get("b")).toBe(2)
  })
})
