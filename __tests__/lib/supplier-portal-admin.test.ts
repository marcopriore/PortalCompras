import { describe, expect, it } from "vitest"
import {
  buyerMayManageSupplierPortalUsers,
  normalizeProfileRoles,
} from "@/lib/auth/supplier-portal-admin"

describe("normalizeProfileRoles", () => {
  it("prefers roles[] and falls back to role", () => {
    expect(normalizeProfileRoles("buyer", ["admin", "buyer"])).toEqual([
      "admin",
      "buyer",
    ])
    expect(normalizeProfileRoles("admin", [])).toEqual(["admin"])
    expect(normalizeProfileRoles(null, null)).toEqual([])
  })
})

describe("buyerMayManageSupplierPortalUsers", () => {
  it("allows superadmin of any profile type", () => {
    expect(
      buyerMayManageSupplierPortalUsers({
        profileType: "requester",
        isSuperAdmin: true,
        roles: [],
        permissionKeys: [],
      }),
    ).toBe(true)
  })

  it("rejects requester and supplier even with admin role", () => {
    expect(
      buyerMayManageSupplierPortalUsers({
        profileType: "requester",
        isSuperAdmin: false,
        roles: ["admin"],
        permissionKeys: ["user.manage"],
      }),
    ).toBe(false)
    expect(
      buyerMayManageSupplierPortalUsers({
        profileType: "supplier",
        isSuperAdmin: false,
        roles: ["admin"],
        permissionKeys: ["user.manage"],
      }),
    ).toBe(false)
  })

  it("allows buyer admin role and user.manage, rejects view_only and plain buyer", () => {
    expect(
      buyerMayManageSupplierPortalUsers({
        profileType: "buyer",
        isSuperAdmin: false,
        roles: ["admin"],
        permissionKeys: [],
      }),
    ).toBe(true)
    expect(
      buyerMayManageSupplierPortalUsers({
        profileType: "buyer",
        isSuperAdmin: false,
        roles: ["buyer"],
        permissionKeys: ["user.manage"],
      }),
    ).toBe(true)
    expect(
      buyerMayManageSupplierPortalUsers({
        profileType: "buyer",
        isSuperAdmin: false,
        roles: ["admin"],
        permissionKeys: ["user.manage", "view_only"],
      }),
    ).toBe(false)
    expect(
      buyerMayManageSupplierPortalUsers({
        profileType: "buyer",
        isSuperAdmin: false,
        roles: ["buyer"],
        permissionKeys: ["nav.suppliers"],
      }),
    ).toBe(false)
  })
})
