import { describe, it, expect } from "vitest"
import { buildOutboundIdempotencyKey } from "@/lib/integrations/outbound-idempotency"

describe("buildOutboundIdempotencyKey", () => {
  it("returns a 64-char hex sha256 hash", () => {
    const key = buildOutboundIdempotencyKey({
      companyId: "c1",
      action: "purchase_order.create",
      entityId: "e1",
    })
    expect(key).toMatch(/^[0-9a-f]{64}$/)
  })

  it("is deterministic — same input produces same output", () => {
    const input = { companyId: "c1", action: "purchase_order.create" as const, entityId: "e1" }
    expect(buildOutboundIdempotencyKey(input)).toBe(buildOutboundIdempotencyKey(input))
  })

  it("differs when companyId changes", () => {
    const a = buildOutboundIdempotencyKey({ companyId: "c1", action: "purchase_order.create", entityId: "e1" })
    const b = buildOutboundIdempotencyKey({ companyId: "c2", action: "purchase_order.create", entityId: "e1" })
    expect(a).not.toBe(b)
  })

  it("differs when action changes", () => {
    const a = buildOutboundIdempotencyKey({ companyId: "c1", action: "purchase_order.create", entityId: "e1" })
    const b = buildOutboundIdempotencyKey({ companyId: "c1", action: "purchase_order.update", entityId: "e1" })
    expect(a).not.toBe(b)
  })

  it("differs when entityId changes", () => {
    const a = buildOutboundIdempotencyKey({ companyId: "c1", action: "purchase_order.create", entityId: "e1" })
    const b = buildOutboundIdempotencyKey({ companyId: "c1", action: "purchase_order.create", entityId: "e2" })
    expect(a).not.toBe(b)
  })

  it("uses 'none' when entityId is null", () => {
    const a = buildOutboundIdempotencyKey({ companyId: "c1", action: "purchase_order.create", entityId: null })
    const b = buildOutboundIdempotencyKey({ companyId: "c1", action: "purchase_order.create" })
    expect(a).toBe(b)
  })
})
