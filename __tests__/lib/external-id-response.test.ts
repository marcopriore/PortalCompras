import { describe, it, expect } from "vitest"
import {
  parseExternalIdFromErpResponse,
  ERP_RESPONSE_EXTERNAL_ID_KEYS,
} from "@/lib/integrations/external-id-response"

describe("parseExternalIdFromErpResponse", () => {
  it("extracts external_purchase_order_id for purchase_order.create", () => {
    const body = JSON.stringify({ external_purchase_order_id: "PO-123" })
    expect(parseExternalIdFromErpResponse("purchase_order.create", body)).toBe("PO-123")
  })

  it("falls back to external_code when primary key missing", () => {
    const body = JSON.stringify({ external_code: "FALLBACK-1" })
    expect(parseExternalIdFromErpResponse("purchase_order.create", body)).toBe("FALLBACK-1")
  })

  it("prefers primary key over external_code", () => {
    const body = JSON.stringify({
      external_purchase_order_id: "PRIMARY",
      external_code: "FALLBACK",
    })
    expect(parseExternalIdFromErpResponse("purchase_order.create", body)).toBe("PRIMARY")
  })

  it("extracts external_contract_id for contract.create", () => {
    const body = JSON.stringify({ external_contract_id: "CT-99" })
    expect(parseExternalIdFromErpResponse("contract.create", body)).toBe("CT-99")
  })

  it("returns null for invalid JSON", () => {
    expect(parseExternalIdFromErpResponse("purchase_order.create", "not json")).toBeNull()
  })

  it("returns null for empty body", () => {
    expect(parseExternalIdFromErpResponse("purchase_order.create", "")).toBeNull()
  })

  it("returns null when no matching key exists", () => {
    const body = JSON.stringify({ unrelated: "data" })
    expect(parseExternalIdFromErpResponse("purchase_order.create", body)).toBeNull()
  })

  it("trims whitespace from values", () => {
    const body = JSON.stringify({ external_purchase_order_id: "  PO-456  " })
    expect(parseExternalIdFromErpResponse("purchase_order.create", body)).toBe("PO-456")
  })

  it("ignores empty string values", () => {
    const body = JSON.stringify({ external_purchase_order_id: "   ", external_code: "OK" })
    expect(parseExternalIdFromErpResponse("purchase_order.create", body)).toBe("OK")
  })

  it("uses external_code as default for unknown actions", () => {
    const body = JSON.stringify({ external_code: "X" })
    expect(parseExternalIdFromErpResponse("some.unknown" as any, body)).toBe("X")
  })

  it("has keys defined for all documented actions", () => {
    expect(ERP_RESPONSE_EXTERNAL_ID_KEYS["purchase_order.create"]).toBeDefined()
    expect(ERP_RESPONSE_EXTERNAL_ID_KEYS["purchase_order.update"]).toBeDefined()
    expect(ERP_RESPONSE_EXTERNAL_ID_KEYS["contract.create"]).toBeDefined()
  })
})
