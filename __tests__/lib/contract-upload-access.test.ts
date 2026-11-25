import { describe, expect, it } from "vitest"
import { isContractUploadActor } from "@/lib/contracts/contract-upload-access"

describe("isContractUploadActor", () => {
  it("allows buyer and superadmin", () => {
    expect(isContractUploadActor({ profile_type: "buyer" })).toBe(true)
    expect(
      isContractUploadActor({ profile_type: "supplier", is_superadmin: true }),
    ).toBe(true)
  })

  it("blocks requester and supplier (SELECT-only / shared company_id)", () => {
    expect(isContractUploadActor({ profile_type: "requester" })).toBe(false)
    expect(isContractUploadActor({ profile_type: "supplier" })).toBe(false)
    expect(isContractUploadActor({ profile_type: null })).toBe(false)
  })
})
