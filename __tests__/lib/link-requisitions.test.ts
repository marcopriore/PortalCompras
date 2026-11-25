import { describe, expect, it } from "vitest"
import { collectSourceRequisitionCodes } from "@/lib/quotations/link-requisitions"

describe("collectSourceRequisitionCodes", () => {
  it("returns every imported REQ code, not a single URL id", () => {
    expect(
      collectSourceRequisitionCodes([
        { requisition_code: "REQ-A" },
        { requisition_code: "REQ-B" },
        { requisition_code: "REQ-A" },
      ]),
    ).toEqual(["REQ-A", "REQ-B"])
  })

  it("prefers source_requisition_code when both are present", () => {
    expect(
      collectSourceRequisitionCodes([
        { source_requisition_code: "REQ-1", requisition_code: "ignored" },
      ]),
    ).toEqual(["REQ-1"])
  })

  it("ignores blank codes and trims whitespace", () => {
    expect(
      collectSourceRequisitionCodes([
        { requisition_code: "  REQ-C  " },
        { requisition_code: "" },
        { source_requisition_code: null },
        { requisition_code: "   " },
      ]),
    ).toEqual(["REQ-C"])
  })

  it("returns empty when lines have no requisition origin", () => {
    expect(
      collectSourceRequisitionCodes([
        { requisition_code: null },
        { source_requisition_code: undefined },
      ]),
    ).toEqual([])
  })
})
