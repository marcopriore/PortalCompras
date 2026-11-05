import { describe, expect, it } from "vitest"
import {
  nextPoContractBalanceTransition,
  quantityConsumedAfterUnconsume,
} from "@/lib/contracts/po-contract-balance-transition"
import { contractItemAvailableQuantity } from "@/lib/contracts/contract-balance-helpers"
import type { ContractItem } from "@/types/contracts"

const item = (over: Partial<ContractItem> = {}): ContractItem => ({
  id: "i1",
  contract_id: "c1",
  company_id: "co1",
  material_code: "MAT-1",
  material_description: "Item",
  unit_of_measure: "UN",
  quantity_contracted: 100,
  quantity_consumed: 0,
  reserved_quantity: 0,
  unit_price: 50,
  total_price: 5000,
  consumed_value: 0,
  reserved_value: 0,
  delivery_days: 5,
  notes: null,
  quotation_item_id: null,
  created_at: "",
  eliminated: false,
  eliminated_at: null,
  eliminated_reason: null,
  site_code: null,
  ...over,
})

describe("nextPoContractBalanceTransition", () => {
  it("libera reserva ao cancelar rascunho/enviado", () => {
    expect(
      nextPoContractBalanceTransition({
        oldStatus: "sent",
        newStatus: "cancelled",
        oldApplied: "reserved",
      }),
    ).toEqual({ action: "release", applied: null })
  })

  it("consome ao aceitar (processing) ou integrar (completed)", () => {
    expect(
      nextPoContractBalanceTransition({
        oldStatus: "sent",
        newStatus: "processing",
        oldApplied: "reserved",
      }),
    ).toEqual({ action: "consume", applied: "consumed" })
    expect(
      nextPoContractBalanceTransition({
        oldStatus: "sent",
        newStatus: "completed",
        oldApplied: "reserved",
      }),
    ).toEqual({ action: "consume", applied: "consumed" })
  })

  it("não consome de novo se o PO já estava consumed (processing → completed)", () => {
    expect(
      nextPoContractBalanceTransition({
        oldStatus: "processing",
        newStatus: "completed",
        oldApplied: "consumed",
      }),
    ).toEqual({ action: "none", applied: "consumed" })
  })

  it("devolve saldo consumido ao cancelar pedido aceito/integrado", () => {
    expect(
      nextPoContractBalanceTransition({
        oldStatus: "completed",
        newStatus: "cancelled",
        oldApplied: "consumed",
      }),
    ).toEqual({ action: "unconsume", applied: null })
    expect(
      nextPoContractBalanceTransition({
        oldStatus: "processing",
        newStatus: "cancelled",
        oldApplied: "consumed",
      }),
    ).toEqual({ action: "unconsume", applied: null })
    expect(
      nextPoContractBalanceTransition({
        oldStatus: "integration_error",
        newStatus: "cancelled",
        oldApplied: "consumed",
      }),
    ).toEqual({ action: "unconsume", applied: null })
  })

  it("não trata cancelamento consumed como release (evita zerar reserva de outros POs)", () => {
    expect(
      nextPoContractBalanceTransition({
        oldStatus: "completed",
        newStatus: "cancelled",
        oldApplied: "consumed",
      }).action,
    ).toBe("unconsume")
  })

  it("re-reserva ao reenviar pedido recusado", () => {
    expect(
      nextPoContractBalanceTransition({
        oldStatus: "refused",
        newStatus: "sent",
        oldApplied: null,
      }),
    ).toEqual({ action: "reserve", applied: "reserved" })
  })
})

describe("quantityConsumedAfterUnconsume", () => {
  it("restaura saldo disponível do item após cancelar PO consumido", () => {
    const before = item({
      quantity_consumed: 40,
      reserved_quantity: 5,
    })
    const afterQty = quantityConsumedAfterUnconsume(before.quantity_consumed, 15)
    expect(afterQty).toBe(25)
    expect(
      contractItemAvailableQuantity({
        ...before,
        quantity_consumed: afterQty,
      }),
    ).toBe(70)
  })

  it("não deixa quantity_consumed negativo", () => {
    expect(quantityConsumedAfterUnconsume(10, 15)).toBe(0)
  })
})
