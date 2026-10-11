import { describe, expect, it } from "vitest"
import {
  isSupplierPoStatusTransitionAllowed,
  SUPPLIER_PO_PROTECTED_COLUMNS,
} from "@/lib/purchase-orders/supplier-po-update-guard"

describe("isSupplierPoStatusTransitionAllowed", () => {
  it("allows accept and refuse from sent", () => {
    expect(isSupplierPoStatusTransitionAllowed("sent", "processing")).toBe(true)
    expect(isSupplierPoStatusTransitionAllowed("sent", "refused")).toBe(true)
  })

  it("allows same-status updates (delivery date)", () => {
    expect(isSupplierPoStatusTransitionAllowed("processing", "processing")).toBe(
      true,
    )
    expect(isSupplierPoStatusTransitionAllowed("completed", "completed")).toBe(
      true,
    )
  })

  it("blocks skipping buyer send or forcing terminal status", () => {
    expect(isSupplierPoStatusTransitionAllowed("draft", "processing")).toBe(
      false,
    )
    expect(
      isSupplierPoStatusTransitionAllowed("awaiting_approval", "processing"),
    ).toBe(false)
    expect(isSupplierPoStatusTransitionAllowed("sent", "completed")).toBe(false)
    expect(isSupplierPoStatusTransitionAllowed("sent", "cancelled")).toBe(false)
    expect(isSupplierPoStatusTransitionAllowed("processing", "completed")).toBe(
      false,
    )
  })
})

describe("SUPPLIER_PO_PROTECTED_COLUMNS", () => {
  it("includes identity and commercial header fields", () => {
    expect(SUPPLIER_PO_PROTECTED_COLUMNS).toEqual(
      expect.arrayContaining([
        "company_id",
        "supplier_id",
        "total_price",
        "external_code",
      ]),
    )
  })
})
