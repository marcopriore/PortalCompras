import { describe, expect, it } from "vitest"
import { canLookupUserEmail } from "@/lib/email/can-lookup-user-email"

const tenant = "company-1"

describe("canLookupUserEmail", () => {
  it("allows a buyer to resolve emails in the same tenant", () => {
    expect(
      canLookupUserEmail({
        callerProfileType: "buyer",
        callerCompanyId: tenant,
        targetCompanyId: tenant,
      }),
    ).toBe(true)
  })

  it("allows a requester in the same tenant", () => {
    expect(
      canLookupUserEmail({
        callerProfileType: "requester",
        callerCompanyId: tenant,
        targetCompanyId: tenant,
      }),
    ).toBe(true)
  })

  it("blocks a supplier even when company_id matches after activate-tenant", () => {
    expect(
      canLookupUserEmail({
        callerProfileType: "supplier",
        callerCompanyId: tenant,
        targetCompanyId: tenant,
      }),
    ).toBe(false)
  })

  it("blocks cross-tenant lookups", () => {
    expect(
      canLookupUserEmail({
        callerProfileType: "buyer",
        callerCompanyId: tenant,
        targetCompanyId: "company-2",
      }),
    ).toBe(false)
  })

  it("blocks missing company ids", () => {
    expect(
      canLookupUserEmail({
        callerProfileType: "buyer",
        callerCompanyId: null,
        targetCompanyId: tenant,
      }),
    ).toBe(false)
  })
})
