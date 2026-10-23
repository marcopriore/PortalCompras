import { describe, expect, it } from "vitest"
import {
  isActivePurchaseOrderStatus,
  isOpenQuotationStatus,
} from "@/lib/purchase-orders/create-draft-from-requisition"

describe("isOpenQuotationStatus", () => {
  it("blocks Gerar Pedido while the RFQ is still open", () => {
    expect(isOpenQuotationStatus("draft")).toBe(true)
    expect(isOpenQuotationStatus("waiting")).toBe(true)
    expect(isOpenQuotationStatus("analysis")).toBe(true)
  })

  it("allows Gerar Pedido after the quotation is finished or cancelled", () => {
    expect(isOpenQuotationStatus("completed")).toBe(false)
    expect(isOpenQuotationStatus("cancelled")).toBe(false)
    expect(isOpenQuotationStatus(null)).toBe(false)
    expect(isOpenQuotationStatus(undefined)).toBe(false)
  })
})

describe("isActivePurchaseOrderStatus", () => {
  it("treats any non-cancelled PO as blocking a second Gerar Pedido", () => {
    expect(isActivePurchaseOrderStatus("draft")).toBe(true)
    expect(isActivePurchaseOrderStatus("awaiting_approval")).toBe(true)
    expect(isActivePurchaseOrderStatus("sent")).toBe(true)
    expect(isActivePurchaseOrderStatus("processing")).toBe(true)
    expect(isActivePurchaseOrderStatus("completed")).toBe(true)
    expect(isActivePurchaseOrderStatus("refused")).toBe(true)
  })

  it("allows a new draft after the previous PO was cancelled", () => {
    expect(isActivePurchaseOrderStatus("cancelled")).toBe(false)
    expect(isActivePurchaseOrderStatus(null)).toBe(false)
    expect(isActivePurchaseOrderStatus(undefined)).toBe(false)
  })
})
