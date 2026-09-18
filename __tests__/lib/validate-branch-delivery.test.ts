import { describe, expect, it } from "vitest"
import {
  findFirstMissingBranchDelivery,
  missingBranchDeliveryMessage,
  missingItemSiteCodeMessage,
} from "@/lib/branches/validate-branch-delivery"
import type { CompanyBranchAddressFields } from "@/lib/branches/types"

function branch(
  overrides: Partial<CompanyBranchAddressFields> & { code?: string } = {},
): CompanyBranchAddressFields & { code: string } {
  return {
    code: overrides.code ?? "MATRIZ",
    name: overrides.name ?? "Matriz",
    address: overrides.address ?? "Rua A, 1",
    city: overrides.city ?? "Porto Alegre",
    state: overrides.state ?? "RS",
    zip_code: overrides.zip_code ?? "90000-000",
  }
}

describe("findFirstMissingBranchDelivery", () => {
  it("returns null when every site_code has a delivery address", () => {
    const map = new Map<string, CompanyBranchAddressFields>([
      ["MATRIZ", branch()],
      ["FILIAL-01", branch({ code: "FILIAL-01", name: "Filial 01" })],
    ])
    expect(findFirstMissingBranchDelivery(["MATRIZ", "FILIAL-01"], map)).toBeNull()
  })

  it("reports a site_code that is not in the branch map", () => {
    const map = new Map<string, CompanyBranchAddressFields>([["MATRIZ", branch()]])
    expect(findFirstMissingBranchDelivery(["MATRIZ", "FILIAL-SP"], map)).toBe(
      missingBranchDeliveryMessage("FILIAL-SP"),
    )
  })

  it("reports a branch with no name and no address parts", () => {
    const map = new Map<string, CompanyBranchAddressFields>([
      [
        "VAZIA",
        branch({
          code: "VAZIA",
          name: "",
          address: "",
          city: "",
          state: "",
          zip_code: "",
        }),
      ],
    ])
    expect(findFirstMissingBranchDelivery(["VAZIA"], map)).toBe(
      missingBranchDeliveryMessage("VAZIA", "VAZIA"),
    )
  })
})

describe("missingItemSiteCodeMessage", () => {
  it("includes the material code", () => {
    expect(missingItemSiteCodeMessage("PARAF-M8")).toMatch(/PARAF-M8/)
  })
})
