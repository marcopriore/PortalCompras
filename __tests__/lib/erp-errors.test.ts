import { describe, it, expect } from "vitest"
import {
  buildErpErrorMessage,
  parseErpErrorMessage,
  statusForErpErrorKind,
  duplicateExternalCodeMessage,
  erpHttpErrorMessage,
  formatErpHttpFailure,
  getBuyerOrderErrorCopy,
  ERP_ERROR_KIND,
} from "@/lib/integrations/erp-errors"

describe("buildErpErrorMessage / parseErpErrorMessage", () => {
  it("round-trips correctly", () => {
    const raw = buildErpErrorMessage(ERP_ERROR_KIND.ERP_HTTP, "status 500")
    const parsed = parseErpErrorMessage(raw)
    expect(parsed.kind).toBe(ERP_ERROR_KIND.ERP_HTTP)
    expect(parsed.message).toBe("status 500")
  })

  it("parses null as null/null", () => {
    expect(parseErpErrorMessage(null)).toEqual({ kind: null, message: null })
  })

  it("parses empty string as null/null", () => {
    expect(parseErpErrorMessage("")).toEqual({ kind: null, message: null })
  })

  it("parses plain string (no prefix) as kind=null", () => {
    const parsed = parseErpErrorMessage("some error")
    expect(parsed.kind).toBeNull()
    expect(parsed.message).toBe("some error")
  })

  it("handles prefix with no newline", () => {
    const parsed = parseErpErrorMessage("erp_error_kind:erp_http")
    expect(parsed.kind).toBeNull()
  })

  it("handles invalid kind after prefix", () => {
    const parsed = parseErpErrorMessage("erp_error_kind:invalid_kind\ndetail")
    expect(parsed.kind).toBeNull()
  })
})

describe("statusForErpErrorKind", () => {
  it("ERP_HTTP returns error", () => {
    expect(statusForErpErrorKind(ERP_ERROR_KIND.ERP_HTTP)).toBe("error")
  })
  it("DUPLICATE_EXTERNAL_CODE returns integration_error", () => {
    expect(statusForErpErrorKind(ERP_ERROR_KIND.DUPLICATE_EXTERNAL_CODE)).toBe("integration_error")
  })
  it("PAYLOAD returns integration_error", () => {
    expect(statusForErpErrorKind(ERP_ERROR_KIND.PAYLOAD)).toBe("integration_error")
  })
  it("PERSIST returns integration_error", () => {
    expect(statusForErpErrorKind(ERP_ERROR_KIND.PERSIST)).toBe("integration_error")
  })
})

describe("duplicateExternalCodeMessage", () => {
  it("includes the external code in message", () => {
    const raw = duplicateExternalCodeMessage("PO-123")
    const parsed = parseErpErrorMessage(raw)
    expect(parsed.kind).toBe(ERP_ERROR_KIND.DUPLICATE_EXTERNAL_CODE)
    expect(parsed.message).toContain("PO-123")
  })
})

describe("erpHttpErrorMessage", () => {
  it("includes the HTTP status", () => {
    const raw = erpHttpErrorMessage(503)
    const parsed = parseErpErrorMessage(raw)
    expect(parsed.kind).toBe(ERP_ERROR_KIND.ERP_HTTP)
    expect(parsed.message).toContain("503")
  })
})

describe("formatErpHttpFailure", () => {
  it("extracts message from JSON body", () => {
    const body = JSON.stringify({ message: "Not Found" })
    expect(formatErpHttpFailure(404, body)).toBe("Not Found")
  })

  it("extracts error from JSON body", () => {
    const body = JSON.stringify({ error: "Bad Request" })
    expect(formatErpHttpFailure(400, body)).toBe("Bad Request")
  })

  it("falls back to default message when body is null", () => {
    expect(formatErpHttpFailure(500, null)).toContain("500")
  })

  it("uses plain text body when not JSON", () => {
    expect(formatErpHttpFailure(500, "plain error text")).toBe("plain error text")
  })

  it("ignores overly long plain text body", () => {
    const longText = "x".repeat(501)
    expect(formatErpHttpFailure(500, longText)).toContain("500")
  })
})

describe("getBuyerOrderErrorCopy", () => {
  it("error status allows buyer retry", () => {
    const copy = getBuyerOrderErrorCopy("error", null)
    expect(copy.allowBuyerRetry).toBe(true)
    expect(copy.title).toBe("Pedido reprovado pelo ERP")
  })

  it("integration_error status does not allow buyer retry", () => {
    const copy = getBuyerOrderErrorCopy("integration_error", null)
    expect(copy.allowBuyerRetry).toBe(false)
    expect(copy.title).toBe("Erro de Integração")
  })

  it("uses parsed message when available", () => {
    const raw = buildErpErrorMessage(ERP_ERROR_KIND.ERP_HTTP, "custom msg")
    const copy = getBuyerOrderErrorCopy("error", raw)
    expect(copy.body).toBe("custom msg")
  })
})
