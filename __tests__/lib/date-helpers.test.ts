import { describe, it, expect } from "vitest"
import {
  formatDateBR,
  formatDateTimeBR,
  isExpiredDate,
  isUrgentDate,
} from "@/lib/utils/date-helpers"

describe("formatDateBR", () => {
  it("formata data YYYY-MM-DD para DD/MM/AAAA sem shift de timezone", () => {
    expect(formatDateBR("2026-03-15")).toBe("15/03/2026")
  })
  it("retorna string vazia para null", () => {
    expect(formatDateBR(null)).toBe("")
  })
  it("retorna string vazia para undefined", () => {
    expect(formatDateBR(undefined)).toBe("")
  })
  it("retorna string vazia para string vazia", () => {
    expect(formatDateBR("")).toBe("")
  })
})

describe("formatDateTimeBR", () => {
  it("formata ISO com data e hora", () => {
    const result = formatDateTimeBR("2026-03-15T14:30:00.000Z", true)
    expect(result).toMatch(/15\/03\/2026/)
  })
  it("sem includeTime retorna só data", () => {
    const result = formatDateTimeBR("2026-03-15T14:30:00.000Z")
    expect(result).toMatch(/15\/03\/2026/)
  })
})

describe("isExpiredDate", () => {
  it("data passada é expirada", () => {
    expect(isExpiredDate("2020-01-01")).toBe(true)
  })
  it("data futura não é expirada", () => {
    expect(isExpiredDate("2099-12-31")).toBe(false)
  })
  it("null não é expirado", () => {
    expect(isExpiredDate(null)).toBe(false)
  })
})

describe("isUrgentDate", () => {
  it("data dentro de 2 dias é urgente", () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const str = tomorrow.toISOString().split("T")[0]
    expect(isUrgentDate(str)).toBe(true)
  })
  it("data além de 2 dias não é urgente", () => {
    expect(isUrgentDate("2099-12-31")).toBe(false)
  })
  it("null não é urgente", () => {
    expect(isUrgentDate(null)).toBe(false)
  })
})
