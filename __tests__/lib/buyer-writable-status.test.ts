import { describe, expect, it } from "vitest"
import {
  BUYER_CREATED_CONTRACT_STATUS,
  isBuyerWritableContractStatus,
} from "@/lib/contracts/buyer-writable-status"

describe("buyer-writable-status", () => {
  it("create always starts as draft", () => {
    expect(BUYER_CREATED_CONTRACT_STATUS).toBe("draft")
  })

  it("allows draft, expired and cancelled from the buyer PATCH API", () => {
    expect(isBuyerWritableContractStatus("draft")).toBe(true)
    expect(isBuyerWritableContractStatus("expired")).toBe(true)
    expect(isBuyerWritableContractStatus("cancelled")).toBe(true)
  })

  it("rejects active and pending_acceptance (dedicated accept/send endpoints)", () => {
    expect(isBuyerWritableContractStatus("active")).toBe(false)
    expect(isBuyerWritableContractStatus("pending_acceptance")).toBe(false)
  })
})
