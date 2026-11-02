import { describe, expect, it } from "vitest"
import { accessTokenHasRecoveryAmr } from "@/lib/auth/recovery-session"

function jwtWithPayload(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString(
    "base64url",
  )
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url")
  return `${header}.${body}.sig`
}

describe("accessTokenHasRecoveryAmr", () => {
  it("accepts a GoTrue recovery session AMR", () => {
    const token = jwtWithPayload({
      sub: "user-1",
      aal: "aal1",
      amr: [
        { method: "otp", timestamp: 1 },
        { method: "recovery", timestamp: 2 },
      ],
    })
    expect(accessTokenHasRecoveryAmr(token)).toBe(true)
  })

  it("rejects a normal password login session", () => {
    const token = jwtWithPayload({
      sub: "user-1",
      aal: "aal1",
      amr: [{ method: "password", timestamp: 1 }],
    })
    expect(accessTokenHasRecoveryAmr(token)).toBe(false)
  })

  it("rejects missing/malformed tokens", () => {
    expect(accessTokenHasRecoveryAmr(null)).toBe(false)
    expect(accessTokenHasRecoveryAmr("")).toBe(false)
    expect(accessTokenHasRecoveryAmr("not-a-jwt")).toBe(false)
    expect(accessTokenHasRecoveryAmr("a.%%% .c")).toBe(false)
    expect(accessTokenHasRecoveryAmr(jwtWithPayload({ sub: "user-1" }))).toBe(false)
  })
})
