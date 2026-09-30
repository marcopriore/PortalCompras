import { describe, expect, it } from "vitest"
import { canManageSupplierPortalUsers } from "@/lib/auth/supplier-admin-guard"

describe("canManageSupplierPortalUsers", () => {
  it("allows only the supplier portal administrator", () => {
    expect(canManageSupplierPortalUsers(true)).toBe(true)
    expect(canManageSupplierPortalUsers(false)).toBe(false)
    expect(canManageSupplierPortalUsers(null)).toBe(false)
    expect(canManageSupplierPortalUsers(undefined)).toBe(false)
  })
})
