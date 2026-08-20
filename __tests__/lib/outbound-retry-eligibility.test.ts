import { describe, it, expect } from "vitest"
import {
  isOutboundRetryEligible,
  isPurchaseOrderOutboundLog,
  isContractOutboundLog,
} from "@/lib/integrations/outbound-retry-eligibility"

const poLog = (overrides: Partial<Parameters<typeof isOutboundRetryEligible>[0]> = {}) => ({
  action: "purchase_order.create",
  entity: "purchase_orders",
  entity_id: "po-1",
  success: false,
  ...overrides,
})

const contractLog = (overrides: Partial<Parameters<typeof isOutboundRetryEligible>[0]> = {}) => ({
  action: "contract.create",
  entity: "contracts",
  entity_id: "ct-1",
  success: false,
  ...overrides,
})

describe("isPurchaseOrderOutboundLog", () => {
  it("true for PO create", () => {
    expect(isPurchaseOrderOutboundLog(poLog())).toBe(true)
  })
  it("true for PO update", () => {
    expect(isPurchaseOrderOutboundLog(poLog({ action: "purchase_order.update" }))).toBe(true)
  })
  it("true for PO delete", () => {
    expect(isPurchaseOrderOutboundLog(poLog({ action: "purchase_order.delete" }))).toBe(true)
  })
  it("false for contract action", () => {
    expect(isPurchaseOrderOutboundLog(contractLog())).toBe(false)
  })
  it("false when entity_id is null", () => {
    expect(isPurchaseOrderOutboundLog(poLog({ entity_id: null }))).toBe(false)
  })
})

describe("isContractOutboundLog", () => {
  it("true for contract.create", () => {
    expect(isContractOutboundLog(contractLog())).toBe(true)
  })
  it("false for PO action", () => {
    expect(isContractOutboundLog(poLog())).toBe(false)
  })
  it("false when entity_id is null", () => {
    expect(isContractOutboundLog(contractLog({ entity_id: null }))).toBe(false)
  })
})

describe("isOutboundRetryEligible", () => {
  describe("purchase_order.create", () => {
    it("eligible when HTTP failed", () => {
      expect(isOutboundRetryEligible(poLog({ success: false }))).toBe(true)
    })
    it("not eligible when completed", () => {
      expect(isOutboundRetryEligible(poLog({ success: true, entity_status: "completed" }))).toBe(false)
    })
    it("eligible when processing (ERP OK but Valore pending)", () => {
      expect(isOutboundRetryEligible(poLog({ success: true, entity_status: "processing" }))).toBe(true)
    })
    it("eligible when integration_error", () => {
      expect(isOutboundRetryEligible(poLog({ success: true, entity_status: "integration_error" }))).toBe(true)
    })
    it("eligible when error (ERP rejected)", () => {
      expect(isOutboundRetryEligible(poLog({ success: true, entity_status: "error" }))).toBe(true)
    })
    it("not eligible when entity_status is null and success", () => {
      expect(isOutboundRetryEligible(poLog({ success: true, entity_status: null }))).toBe(false)
    })
  })

  describe("purchase_order.update", () => {
    it("eligible when HTTP failed", () => {
      expect(isOutboundRetryEligible(poLog({ action: "purchase_order.update", success: false }))).toBe(true)
    })
    it("eligible when processing", () => {
      expect(isOutboundRetryEligible(poLog({ action: "purchase_order.update", success: true, entity_status: "processing" }))).toBe(true)
    })
  })

  describe("purchase_order.delete", () => {
    it("eligible when HTTP failed", () => {
      expect(isOutboundRetryEligible(poLog({ action: "purchase_order.delete", success: false }))).toBe(true)
    })
    it("not eligible when cancelled (already done)", () => {
      expect(isOutboundRetryEligible(poLog({ action: "purchase_order.delete", success: true, entity_status: "cancelled" }))).toBe(false)
    })
    it("eligible when not cancelled", () => {
      expect(isOutboundRetryEligible(poLog({ action: "purchase_order.delete", success: true, entity_status: "completed" }))).toBe(true)
    })
  })

  describe("contract.create", () => {
    it("eligible when HTTP failed", () => {
      expect(isOutboundRetryEligible(contractLog({ success: false }))).toBe(true)
    })
    it("eligible when no external code returned", () => {
      expect(isOutboundRetryEligible(contractLog({ success: true, entity_external_code: null }))).toBe(true)
    })
    it("not eligible when external code present", () => {
      expect(isOutboundRetryEligible(contractLog({ success: true, entity_external_code: "ERP-CT-1" }))).toBe(false)
    })
    it("eligible when external code is whitespace only", () => {
      expect(isOutboundRetryEligible(contractLog({ success: true, entity_external_code: "  " }))).toBe(true)
    })
  })

  describe("in-flight dispatch", () => {
    it("returns false while Em andamento", () => {
      expect(
        isOutboundRetryEligible(poLog({ success: false, error_message: "Em andamento" })),
      ).toBe(false)
    })
  })

  describe("unknown action", () => {
    it("returns false", () => {
      expect(isOutboundRetryEligible({
        action: "unknown.action",
        entity: "other",
        entity_id: "x",
        success: false,
      })).toBe(false)
    })
  })
})
