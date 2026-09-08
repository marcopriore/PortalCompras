import { describe, expect, it } from "vitest"
import { isOwnRequisitionCreator } from "@/lib/requisitions/own-requisition-guard"

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
