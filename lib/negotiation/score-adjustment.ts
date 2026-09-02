/**
 * Ajusta a pressão de saving conforme score do fornecedor (motor autônomo, sem LLM).
 * Score alto → alvo mais brando; score baixo → alvo mais agressivo.
 */
export function effectiveSavingPctForSupplier(
  baseSavingPct: number,
  supplierScore: number | null | undefined,
): number {
  if (supplierScore == null || !Number.isFinite(supplierScore)) {
    return baseSavingPct
  }
  const delta = (50 - supplierScore) / 50
  const multiplier = 1 + delta * 0.4
  return Math.min(50, Math.max(5, baseSavingPct * multiplier))
}

export function formatSupplierScoreNote(score: number | null | undefined): string {
  if (score == null || !Number.isFinite(score)) return ""
  return ` Score fornecedor: ${Math.round(score)}/100.`
}
