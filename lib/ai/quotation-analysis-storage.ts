export type QuotationAnalysisCachePayload = {
  analysis: unknown
  generatedAt: string
  quotationCode: string | null
  cachedAt: string
}

export function quotationAnalysisCacheKey(
  quotationId: string,
  roundId: string | null,
): string {
  return `valore:ai-quotation-analysis:${quotationId}:${roundId ?? "latest"}`
}

export function loadStoredQuotationAnalysis(
  storage: Pick<Storage, "getItem">,
  quotationId: string,
  roundId: string | null,
): QuotationAnalysisCachePayload | null {
  try {
    const raw = storage.getItem(quotationAnalysisCacheKey(quotationId, roundId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as QuotationAnalysisCachePayload
    if (!parsed.analysis || !parsed.generatedAt || !parsed.cachedAt) return null
    return parsed
  } catch {
    return null
  }
}

/** Cooldown entre novas análises — não invalida o resultado exibido. */
export function quotationAnalysisCooldownSeconds(
  cachedAt: string,
  cooldownSeconds: number,
  nowMs = Date.now(),
): number {
  const cachedAtMs = new Date(cachedAt).getTime()
  if (!cachedAtMs || Number.isNaN(cachedAtMs)) return 0
  return Math.max(
    0,
    cooldownSeconds - Math.floor((nowMs - cachedAtMs) / 1000),
  )
}

export function saveQuotationAnalysisCache(
  storage: Pick<Storage, "setItem">,
  quotationId: string,
  roundId: string | null,
  payload: Omit<QuotationAnalysisCachePayload, "cachedAt">,
): void {
  const data: QuotationAnalysisCachePayload = {
    ...payload,
    cachedAt: new Date().toISOString(),
  }
  storage.setItem(
    quotationAnalysisCacheKey(quotationId, roundId),
    JSON.stringify(data),
  )
}
