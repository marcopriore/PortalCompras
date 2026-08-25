import { describe, expect, it } from "vitest"
import { parseReportDateRange } from "@/lib/api/external/report-service"
import { isApiScope } from "@/lib/api/external/scopes"

describe("parseReportDateRange", () => {
  it("default 30d quando sem params", () => {
    const parsed = parseReportDateRange(new URLSearchParams())
    expect(typeof parsed).toBe("object")
    if (typeof parsed === "string") return
    expect(parsed.period).toBe("30d")
    expect(Date.parse(parsed.from)).toBeLessThan(Date.parse(parsed.to))
  })

  it("aceita from/to ISO", () => {
    const parsed = parseReportDateRange(
      new URLSearchParams({
        from: "2026-01-01T00:00:00.000Z",
        to: "2026-01-31T23:59:59.999Z",
      }),
    )
    expect(parsed).toEqual({
      from: "2026-01-01T00:00:00.000Z",
      to: "2026-01-31T23:59:59.999Z",
      period: null,
    })
  })

  it("rejeita from sem to", () => {
    expect(
      parseReportDateRange(new URLSearchParams({ from: "2026-01-01T00:00:00.000Z" })),
    ).toBe("Informe from e to juntos (ISO 8601), ou use period.")
  })

  it("rejeita period inválido", () => {
    expect(parseReportDateRange(new URLSearchParams({ period: "7d" }))).toBe(
      "Parâmetro period inválido. Use 30d | 60d | 90d | current_month.",
    )
  })
})

describe("API scopes reports", () => {
  it("reconhece reports:read", () => {
    expect(isApiScope("reports:read")).toBe(true)
  })
})
