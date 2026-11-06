import { afterEach, describe, expect, it } from "vitest"
import { isContractMaintenanceAuthorized } from "@/lib/contracts/maintenance-auth"

const ORIGINAL_CRON = process.env.CRON_SECRET
const ORIGINAL_MAINTENANCE = process.env.CONTRACT_MAINTENANCE_SECRET
const ORIGINAL_VERCEL = process.env.VERCEL

function requestWith(headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/contracts/check-expiring", { headers })
}

describe("isContractMaintenanceAuthorized", () => {
  afterEach(() => {
    if (ORIGINAL_CRON === undefined) delete process.env.CRON_SECRET
    else process.env.CRON_SECRET = ORIGINAL_CRON
    if (ORIGINAL_MAINTENANCE === undefined) {
      delete process.env.CONTRACT_MAINTENANCE_SECRET
    } else {
      process.env.CONTRACT_MAINTENANCE_SECRET = ORIGINAL_MAINTENANCE
    }
    if (ORIGINAL_VERCEL === undefined) delete process.env.VERCEL
    else process.env.VERCEL = ORIGINAL_VERCEL
  })

  it("allows unauthenticated calls only when no secrets are configured", () => {
    delete process.env.CRON_SECRET
    delete process.env.CONTRACT_MAINTENANCE_SECRET
    expect(isContractMaintenanceAuthorized(requestWith())).toBe(true)
  })

  it("rejects a bare GET when CONTRACT_MAINTENANCE_SECRET is set", () => {
    delete process.env.CRON_SECRET
    process.env.CONTRACT_MAINTENANCE_SECRET = "job-secret"
    expect(isContractMaintenanceAuthorized(requestWith())).toBe(false)
  })

  it("accepts a matching x-maintenance-key", () => {
    delete process.env.CRON_SECRET
    process.env.CONTRACT_MAINTENANCE_SECRET = "job-secret"
    expect(
      isContractMaintenanceAuthorized(
        requestWith({ "x-maintenance-key": "job-secret" }),
      ),
    ).toBe(true)
  })

  it("rejects a wrong x-maintenance-key", () => {
    delete process.env.CRON_SECRET
    process.env.CONTRACT_MAINTENANCE_SECRET = "job-secret"
    expect(
      isContractMaintenanceAuthorized(
        requestWith({ "x-maintenance-key": "nope" }),
      ),
    ).toBe(false)
  })

  it("accepts Authorization Bearer CRON_SECRET", () => {
    process.env.CRON_SECRET = "cron-secret"
    delete process.env.CONTRACT_MAINTENANCE_SECRET
    expect(
      isContractMaintenanceAuthorized(
        requestWith({ authorization: "Bearer cron-secret" }),
      ),
    ).toBe(true)
  })

  it("does not treat x-vercel-cron as auth outside Vercel", () => {
    process.env.CRON_SECRET = "cron-secret"
    delete process.env.CONTRACT_MAINTENANCE_SECRET
    delete process.env.VERCEL
    expect(
      isContractMaintenanceAuthorized(requestWith({ "x-vercel-cron": "1" })),
    ).toBe(false)
  })
})
