import { describe, expect, it } from "vitest"
import {
  isTerminalQuotationStatus,
  negotiationActionForQuotationStatus,
} from "@/lib/quotations/quotation-status"

describe("isTerminalQuotationStatus", () => {
  it("trata completed e cancelled como encerradas", () => {
    expect(isTerminalQuotationStatus("completed")).toBe(true)
    expect(isTerminalQuotationStatus("cancelled")).toBe(true)
  })

  it("não bloqueia cotações em andamento", () => {
    expect(isTerminalQuotationStatus("waiting")).toBe(false)
    expect(isTerminalQuotationStatus("analysis")).toBe(false)
    expect(isTerminalQuotationStatus("draft")).toBe(false)
    expect(isTerminalQuotationStatus(null)).toBe(false)
    expect(isTerminalQuotationStatus(undefined)).toBe(false)
  })
})

describe("negotiationActionForQuotationStatus", () => {
  it("encerra o evento quando o comprador cancela a cotação", () => {
    expect(negotiationActionForQuotationStatus("cancelled")).toBe("cancel_run")
  })

  it("conclui o evento quando a cotação já foi finalizada", () => {
    expect(negotiationActionForQuotationStatus("completed")).toBe("complete_run")
  })

  it("segue o motor em status operacionais", () => {
    expect(negotiationActionForQuotationStatus("waiting")).toBe("continue")
    expect(negotiationActionForQuotationStatus("analysis")).toBe("continue")
    expect(negotiationActionForQuotationStatus("draft")).toBe("continue")
  })
})
