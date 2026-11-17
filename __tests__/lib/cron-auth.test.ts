import { describe, expect, it } from "vitest"
import { isCronAuthorized, type CronAuthEnv } from "@/lib/jobs/cron-auth"

function requestWith(headers: Record<string, string>): Request {
  return new Request("https://valore.example/api/cron/background-jobs", {
    method: "POST",
    headers,
  })
}

const hosted: CronAuthEnv = {
  cronSecret: "cron-secret",
  maintenanceSecret: "maint-secret",
  vercel: "1",
  nodeEnv: "production",
}

describe("isCronAuthorized", () => {
  it("accepts Authorization Bearer CRON_SECRET on Vercel", () => {
    expect(
      isCronAuthorized(requestWith({ authorization: "Bearer cron-secret" }), hosted),
    ).toBe(true)
  })

  it("accepts x-maintenance-key on Vercel", () => {
    expect(
      isCronAuthorized(requestWith({ "x-maintenance-key": "maint-secret" }), hosted),
    ).toBe(true)
  })

  it("rejects spoofed x-vercel-cron even when VERCEL=1", () => {
    expect(
      isCronAuthorized(requestWith({ "x-vercel-cron": "1" }), hosted),
    ).toBe(false)
  })

  it("rejects unauthenticated calls on Vercel when secrets are configured", () => {
    expect(isCronAuthorized(requestWith({}), hosted)).toBe(false)
  })

  it("rejects unauthenticated calls on Vercel even if secrets are missing", () => {
    expect(
      isCronAuthorized(requestWith({ "x-vercel-cron": "1" }), {
        vercel: "1",
        nodeEnv: "production",
      }),
    ).toBe(false)
  })

  it("rejects wrong secrets", () => {
    expect(
      isCronAuthorized(requestWith({ authorization: "Bearer other" }), hosted),
    ).toBe(false)
    expect(
      isCronAuthorized(requestWith({ "x-maintenance-key": "other" }), hosted),
    ).toBe(false)
  })

  it("allows local dev without secrets", () => {
    expect(
      isCronAuthorized(requestWith({}), {
        nodeEnv: "development",
      }),
    ).toBe(true)
  })

  it("rejects production without secrets or credentials", () => {
    expect(
      isCronAuthorized(requestWith({}), {
        nodeEnv: "production",
      }),
    ).toBe(false)
  })
})
