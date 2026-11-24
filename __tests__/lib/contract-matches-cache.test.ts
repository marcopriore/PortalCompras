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

  it("get/set não persistem payload (cache desativado)", () => {
    const key = buildContractMatchesCacheKey("co", "q", "hash1")
    setContractMatchesCache(key, { items: [{ id: "x" }] })
    expect(getContractMatchesCached(key)).toBeNull()
  })
})