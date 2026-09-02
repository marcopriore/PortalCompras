type CacheEntry = {
  expiresAt: number
  payload: unknown
}

const TTL_MS = 60_000
const MAX_ENTRIES = 200

const store = new Map<string, CacheEntry>()

function pruneIfNeeded(): void {
  if (store.size <= MAX_ENTRIES) return
  const now = Date.now()
  for (const [key, entry] of store) {
    if (entry.expiresAt <= now) store.delete(key)
  }
  while (store.size > MAX_ENTRIES) {
    const first = store.keys().next().value
    if (!first) break
    store.delete(first)
  }
}

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

export function getContractMatchesCached<T>(key: string): T | null {
  const entry = store.get(key)
  if (!entry) return null
  if (entry.expiresAt <= Date.now()) {
    store.delete(key)
    return null
  }
  return entry.payload as T
}

export function setContractMatchesCache(key: string, payload: unknown): void {
  pruneIfNeeded()
  store.set(key, { expiresAt: Date.now() + TTL_MS, payload })
}
