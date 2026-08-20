import { describe, it, expect } from "vitest"
import {
  isTransientOutboundFailure,
  outboundAutoRetryDelayMs,
  isOutboundAutoRetryExhausted,
  isOutboundAutoRetryDue,
  OUTBOUND_AUTO_RETRY_MAX_ATTEMPTS,
} from "@/lib/integrations/outbound-auto-retry"

describe("isTransientOutboundFailure", () => {
  it("null status is transient (rede/timeout)", () => {
    expect(isTransientOutboundFailure({ responseStatus: null })).toBe(true)
    expect(
      isTransientOutboundFailure({
        responseStatus: null,
        errorMessage: "The operation was aborted",
      }),
    ).toBe(true)
  })

  it("config/payload sem HTTP não é transient", () => {
    expect(
      isTransientOutboundFailure({
        responseStatus: null,
        errorMessage: "Nenhum endpoint de integração configurado para esta ação.",
      }),
    ).toBe(false)
  })

  it("5xx and 429/408 are transient", () => {
    for (const status of [408, 425, 429, 500, 502, 503, 504]) {
      expect(isTransientOutboundFailure({ responseStatus: status })).toBe(true)
    }
  })

  it("4xx de negócio não é transient", () => {
    for (const status of [400, 401, 403, 404, 409, 422]) {
      expect(isTransientOutboundFailure({ responseStatus: status })).toBe(false)
    }
  })
})

describe("outboundAutoRetryDelayMs / exhausted", () => {
  it("backoff after attempts 1..3", () => {
    expect(outboundAutoRetryDelayMs(1)).toBe(60_000)
    expect(outboundAutoRetryDelayMs(2)).toBe(5 * 60_000)
    expect(outboundAutoRetryDelayMs(3)).toBe(15 * 60_000)
  })

  it("null when exhausted", () => {
    expect(outboundAutoRetryDelayMs(OUTBOUND_AUTO_RETRY_MAX_ATTEMPTS)).toBeNull()
    expect(outboundAutoRetryDelayMs(OUTBOUND_AUTO_RETRY_MAX_ATTEMPTS + 1)).toBeNull()
  })

  it("isOutboundAutoRetryExhausted at max", () => {
    expect(isOutboundAutoRetryExhausted(3)).toBe(false)
    expect(isOutboundAutoRetryExhausted(4)).toBe(true)
  })
})

describe("isOutboundAutoRetryDue", () => {
  it("false before backoff elapses", () => {
    const createdAt = new Date(Date.now() - 30_000).toISOString()
    expect(isOutboundAutoRetryDue({ attempts: 1, createdAt })).toBe(false)
  })

  it("true after backoff elapses", () => {
    const createdAt = new Date(Date.now() - 61_000).toISOString()
    expect(isOutboundAutoRetryDue({ attempts: 1, createdAt })).toBe(true)
  })

  it("false when attempts exhausted", () => {
    const createdAt = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    expect(
      isOutboundAutoRetryDue({
        attempts: OUTBOUND_AUTO_RETRY_MAX_ATTEMPTS,
        createdAt,
      }),
    ).toBe(false)
  })
})
