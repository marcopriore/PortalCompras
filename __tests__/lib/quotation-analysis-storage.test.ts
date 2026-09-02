import { describe, expect, it } from "vitest"
import {
  loadStoredQuotationAnalysis,
  quotationAnalysisCooldownSeconds,
  saveQuotationAnalysisCache,
} from "@/lib/ai/quotation-analysis-storage"

function mockStorage(): Storage {
  const map = new Map<string, string>()
  return {
    get length() {
      return map.size
    },
    clear: () => map.clear(),
    getItem: (key) => map.get(key) ?? null,
    key: (index) => [...map.keys()][index] ?? null,
    removeItem: (key) => {
      map.delete(key)
    },
    setItem: (key, value) => {
      map.set(key, value)
    },
  }
}

describe("quotation-analysis-storage", () => {
  it("persiste analise apos cooldown expirar", () => {
    const storage = mockStorage()
    const cachedAt = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    storage.setItem(
      "valore:ai-quotation-analysis:q1:latest",
      JSON.stringify({
        analysis: { resumo_executivo: "ok", recomendacoes: [], contrapropostas: [], alertas: [] },
        generatedAt: "2026-09-02T10:00:00.000Z",
        quotationCode: "COT-1",
        cachedAt,
      }),
    )

    const loaded = loadStoredQuotationAnalysis(storage, "q1", null)
    expect(loaded?.analysis).toBeTruthy()
    expect(quotationAnalysisCooldownSeconds(cachedAt, 30 * 60)).toBe(0)
  })

  it("cooldown positivo dentro da janela", () => {
    const cachedAt = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    const remaining = quotationAnalysisCooldownSeconds(cachedAt, 30 * 60)
    expect(remaining).toBeGreaterThan(0)
    expect(remaining).toBeLessThanOrEqual(25 * 60)
  })

  it("save substitui analise anterior", () => {
    const storage = mockStorage()
    saveQuotationAnalysisCache(storage, "q1", "r1", {
      analysis: { a: 1 },
      generatedAt: "t1",
      quotationCode: "C1",
    })
    saveQuotationAnalysisCache(storage, "q1", "r1", {
      analysis: { a: 2 },
      generatedAt: "t2",
      quotationCode: "C1",
    })
    const loaded = loadStoredQuotationAnalysis(storage, "q1", "r1")
    expect(loaded?.generatedAt).toBe("t2")
  })
})
