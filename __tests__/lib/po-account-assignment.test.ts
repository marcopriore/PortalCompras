import { describe, expect, it } from "vitest"
import {
  resolveSapDistributionFlags,
  validatePurchaseOrderItemAccountAssignments,
} from "@/lib/po-account-assignment"

describe("po-account-assignment", () => {
  it("sem rateio usa distribution vazio", () => {
    expect(
      resolveSapDistributionFlags([{ sequence: 1 }]),
    ).toEqual({
      account_assignment_distribution: "",
      partial_invoice_distribution: "",
    })
  })

  it("com rateio usa distribution 2", () => {
    expect(
      resolveSapDistributionFlags([{ sequence: 1 }, { sequence: 2 }]),
    ).toEqual({
      account_assignment_distribution: "2",
      partial_invoice_distribution: "2",
    })
  })

  it("valida soma 100% no rateio", () => {
    const result = validatePurchaseOrderItemAccountAssignments("K", [
      {
        sequence: 1,
        apportionment_percent: 60,
        currency: "BRL",
        ledger_account_code: "4010301001",
        business_area: "1001",
        controlling_area: "1000",
        cost_center_code: "100121206",
        internal_order_id: null,
        wbs_element: null,
        asset_number: null,
        profit_center: null,
      },
      {
        sequence: 2,
        apportionment_percent: 30,
        currency: "BRL",
        ledger_account_code: "4010301001",
        business_area: "1001",
        controlling_area: "1000",
        cost_center_code: "100121206",
        internal_order_id: null,
        wbs_element: null,
        asset_number: null,
        profit_center: null,
      },
    ])
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toContain("100%")
    }
  })
})
