import { describe, expect, it } from "vitest"
import {
  computeLineTotal,
  normalizePercentText,
  parsePercentInput,
  parsePriceInput,
  parseQuantityInput,
  validateQuantity,
} from "@/lib/validation/numeric-input"

describe("numeric-input", () => {
  it("limita quantidade por dígitos e valor máximo", () => {
    expect(parseQuantityInput("999999", 999_999, 6)).toBe(999_999)
    expect(parseQuantityInput("1000000", 999_999, 6)).toBeNull()
    expect(parseQuantityInput("1000000", 1_000_000, 7)).toBe(1_000_000)
    expect(validateQuantity(1_000_000, 1_000_000).ok).toBe(true)
    expect(validateQuantity(1_000_001, 1_000_000).ok).toBe(false)
  })

  it("valida casas decimais de preço", () => {
    expect(parsePriceInput("471.00005", 5)).toBe(471.00005)
    expect(parsePriceInput("471.000051", 5)).toBeNull()
  })

  it("normaliza percentual removendo zeros à esquerda", () => {
    expect(normalizePercentText("05.50", 2)).toBe("5.50")
    expect(parsePercentInput("05.50", 2)).toBe(5.5)
    expect(parsePercentInput("100.001", 2)).toBe(100)
  })

  it("calcula total da linha com POR (multiplica preço para SAP)", () => {
    expect(computeLineTotal(1, 0.00005, 10_000)).toBe(0.5)
    expect(computeLineTotal(5, 100, 1)).toBe(500)
    expect(computeLineTotal(2, 10, 100)).toBe(2000)
  })
})
