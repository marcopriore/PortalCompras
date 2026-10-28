import { describe, expect, it } from "vitest"
import {
  isOwnRequisitionCreator,
  isRequisitionAvailableForQuotation,
} from "@/lib/requisitions/own-requisition-guard"

describe("isOwnRequisitionCreator", () => {
  it("returns true when user is the requester", () => {
    expect(isOwnRequisitionCreator("u1", "u1")).toBe(true)
  })

  it("returns false when requester differs or is missing", () => {
    expect(isOwnRequisitionCreator("u1", "u2")).toBe(false)
    expect(isOwnRequisitionCreator("u1", null)).toBe(false)
    expect(isOwnRequisitionCreator(null, "u1")).toBe(false)
  })
})

describe("isRequisitionAvailableForQuotation", () => {
  it("allows approved REQ without quotation for another buyer", () => {
    expect(
      isRequisitionAvailableForQuotation(
        { status: "approved", quotation_id: null, requester_id: "u2" },
        "u1",
      ),
    ).toBe(true)
  })

  it("blocks the requester (SoD)", () => {
    expect(
      isRequisitionAvailableForQuotation(
        { status: "approved", quotation_id: null, requester_id: "u1" },
        "u1",
      ),
    ).toBe(false)
  })

  it("blocks REQ already in a quotation or past approved", () => {
    expect(
      isRequisitionAvailableForQuotation(
        { status: "approved", quotation_id: "q1", requester_id: "u2" },
        "u1",
      ),
    ).toBe(false)
    expect(
      isRequisitionAvailableForQuotation(
        { status: "awaiting_buyer", quotation_id: null, requester_id: "u2" },
        "u1",
      ),
    ).toBe(false)
    expect(
      isRequisitionAvailableForQuotation(
        { status: "completed", quotation_id: null, requester_id: "u2" },
        "u1",
      ),
    ).toBe(false)
    expect(
      isRequisitionAvailableForQuotation(
        { status: "in_quotation", quotation_id: null, requester_id: "u2" },
        "u1",
      ),
    ).toBe(false)
  })
})
