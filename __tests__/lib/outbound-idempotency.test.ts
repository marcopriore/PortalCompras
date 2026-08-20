import { describe, it, expect } from "vitest"
import {
  buildOutboundIdempotencyKey,
  isOutboundInFlightConflict,
  nextOutboundAttempt,
} from "@/lib/integrations/outbound-idempotency"

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

describe("nextOutboundAttempt", () => {
  it("starts at 1 when there is no prior attempt", () => {
    expect(nextOutboundAttempt(undefined)).toBe(1)
    expect(nextOutboundAttempt(null)).toBe(1)
    expect(nextOutboundAttempt(0)).toBe(1)
  })

  it("increments from the last attempt", () => {
    expect(nextOutboundAttempt(1)).toBe(2)
    expect(nextOutboundAttempt(3)).toBe(4)
  })

  it("falls back to 1 for invalid values", () => {
    expect(nextOutboundAttempt(Number.NaN)).toBe(1)
    expect(nextOutboundAttempt(-2)).toBe(1)
  })
})

describe("isOutboundInFlightConflict", () => {
  it("detects postgres unique_violation", () => {
    expect(isOutboundInFlightConflict({ code: "23505" })).toBe(true)
  })

  it("detects index name in message", () => {
    expect(
      isOutboundInFlightConflict({
        message: 'duplicate key value violates unique constraint "idx_integration_delivery_logs_inflight"',
      }),
    ).toBe(true)
  })

  it("returns false for other errors", () => {
    expect(isOutboundInFlightConflict(null)).toBe(false)
    expect(isOutboundInFlightConflict({ code: "42P01" })).toBe(false)
  })
})
