import { describe, it, expect } from "vitest"
import {
  OUTBOUND_INTEGRATION_ACTIONS,
  isOutboundIntegrationAction,
} from "@/lib/integrations/types"

describe("isOutboundIntegrationAction", () => {
  it("returns true for all defined actions", () => {
    for (const action of OUTBOUND_INTEGRATION_ACTIONS) {
      expect(isOutboundIntegrationAction(action)).toBe(true)
    }
  })

  it("returns false for unknown action", () => {
    expect(isOutboundIntegrationAction("unknown.action")).toBe(false)
  })

  it("returns false for empty string", () => {
    expect(isOutboundIntegrationAction("")).toBe(false)
  })

  it("includes purchase_order and contract actions", () => {
    expect(OUTBOUND_INTEGRATION_ACTIONS).toContain("purchase_order.create")
    expect(OUTBOUND_INTEGRATION_ACTIONS).toContain("purchase_order.update")
    expect(OUTBOUND_INTEGRATION_ACTIONS).toContain("purchase_order.delete")
    expect(OUTBOUND_INTEGRATION_ACTIONS).toContain("contract.create")
  })
})
