import { describe, it, expect } from "vitest"
import { normalizeCnpj, formatCnpj, looksLikeCnpjInput } from "@/lib/utils/cnpj"

describe("cnpj helpers for supplier login", () => {
  it("normalizes masked and plain CNPJ to same digits", () => {
    expect(normalizeCnpj("58.043.646/0001-36")).toBe("58043646000136")
    expect(normalizeCnpj("58043646000136")).toBe("58043646000136")
  })

  it("formatCnpj round-trips digits", () => {
    expect(formatCnpj("58043646000136")).toBe("58.043.646/0001-36")
    expect(normalizeCnpj(formatCnpj("58043646000136"))).toBe("58043646000136")
  })

  it("looksLikeCnpjInput detects masked CNPJ", () => {
    expect(looksLikeCnpjInput("58.043.646/0001-36")).toBe(true)
    expect(looksLikeCnpjInput("58043646000136")).toBe(true)
    expect(looksLikeCnpjInput("user@email.com")).toBe(false)
  })
})
