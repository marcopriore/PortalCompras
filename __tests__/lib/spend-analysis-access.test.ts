import { describe, expect, it } from "vitest"
import { isSpendAnalysisCallerAllowed } from "@/lib/ai/spend-analysis-access"

describe("isSpendAnalysisCallerAllowed", () => {
  it("allows buyer", () => {
    expect(
      isSpendAnalysisCallerAllowed({ profileType: "buyer", isSuperAdmin: false }),
    ).toBe(true)
  })

  it("allows superadmin even if profile_type is not buyer", () => {
    expect(
      isSpendAnalysisCallerAllowed({
        profileType: "buyer",
        isSuperAdmin: true,
      }),
    ).toBe(true)
    expect(
      isSpendAnalysisCallerAllowed({
        profileType: null,
        isSuperAdmin: true,
      }),
    ).toBe(true)
  })

  it("blocks supplier (same company_id as the buyer tenant)", () => {
    expect(
      isSpendAnalysisCallerAllowed({
        profileType: "supplier",
        isSuperAdmin: false,
      }),
    ).toBe(false)
  })

  it("blocks requester", () => {
    expect(
      isSpendAnalysisCallerAllowed({
        profileType: "requester",
        isSuperAdmin: false,
      }),
    ).toBe(false)
  })
})
