import { describe, expect, it } from "vitest"
import {
  buildContractMatchesCacheKey,
  getContractMatchesCached,
  hashContractMatchSelections,
  setContractMatchesCache,
} from "@/lib/contracts/contract-matches-cache"

describe("contract-matches-cache", () => {
  it("hash estável para mesma seleção em ordem diferente", () => {
    const a = [
      { quotationItemId: "i1", supplierId: "s1", materialCode: "A", quantity: 2 },
      { quotationItemId: "i2", supplierId: "s2", materialCode: "B", quantity: 1 },
    ]
    const b = [...a].reverse()
    expect(hashContractMatchSelections(a)).toBe(hashContractMatchSelections(b))
  })

  it("cache retorna payload dentro do TTL", () => {
    const key = buildContractMatchesCacheKey("co", "q", "hash1")
    setContractMatchesCache(key, { items: [{ id: "x" }] })
    const hit = getContractMatchesCached<{ items: { id: string }[] }>(key)
    expect(hit?.items[0]?.id).toBe("x")
  })
})
