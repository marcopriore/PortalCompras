import { describe, expect, it } from "vitest"
import {
  filterOutOwnRequisitions,
  isOwnRequisitionCreator,
  ownRequisitionBlockedMessage,
  OWN_REQUISITION_ORDER_BLOCKED_MESSAGE,
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

describe("filterOutOwnRequisitions", () => {
  const rows = [
    { id: "a", requester_id: "u1" },
    { id: "b", requester_id: "u2" },
    { id: "c", requester_id: null },
  ]

  it("removes requisitions created by the current user", () => {
    expect(filterOutOwnRequisitions("u1", rows).map((r) => r.id)).toEqual(["b", "c"])
  })

  it("keeps all rows when userId is missing", () => {
    expect(filterOutOwnRequisitions(null, rows)).toEqual(rows)
  })
})

describe("ownRequisitionBlockedMessage", () => {
  it("returns the base message without codes", () => {
    expect(ownRequisitionBlockedMessage()).toBe(OWN_REQUISITION_ORDER_BLOCKED_MESSAGE)
  })

  it("appends codes when present", () => {
    expect(ownRequisitionBlockedMessage(["REQ-1", "REQ-2"])).toBe(
      `${OWN_REQUISITION_ORDER_BLOCKED_MESSAGE} (REQ-1, REQ-2)`,
    )
  })
})
