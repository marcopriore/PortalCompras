/**
 * Helpers para chave/hashing de contract-matches.
 * Persistência em Map com TTL foi removida — cache cross-request no módulo
 * não é seguro em runtime serverless nem no client.
 */

export function hashContractMatchSelections(
  selections: Array<{
    quotationItemId: string
    supplierId: string
    materialCode: string
    quantity: number
  }>,
): string {
  const normalized = [...selections]
    .map(
      (s) =>
        `${s.quotationItemId}|${s.supplierId}|${s.materialCode}|${s.quantity}`,
    )
    .sort()
    .join(";")
  let hash = 0
  for (let i = 0; i < normalized.length; i += 1) {
    hash = (hash * 31 + normalized.charCodeAt(i)) | 0
  }
  return `${normalized.length}:${hash}`
}

export function buildContractMatchesCacheKey(
  companyId: string,
  quotationId: string,
  selectionsHash: string,
): string {
  return `${companyId}:${quotationId}:${selectionsHash}`
}

/** @deprecated Sem cache — sempre retorna null. */
export function getContractMatchesCached<T>(_key: string): T | null {
  return null
}

/** @deprecated Sem cache — no-op. */
export function setContractMatchesCache(_key: string, _payload: unknown): void {
  /* intentional no-op */
}