import { describe, expect, it } from "vitest"
import type { PermissionKey } from "@/lib/hooks/usePermissions"
import { canManageSupplierPortalUsers } from "@/lib/auth/supplier-portal-admin"

function keys(...list: PermissionKey[]): Set<PermissionKey> {
  return new Set(list)
}

describe("canManageSupplierPortalUsers", () => {
  it("allows superadmin regardless of roles or keys", () => {
    expect(
      canManageSupplierPortalUsers({
        isSuperAdmin: true,
        role: "buyer",
        roles: ["buyer"],
        permissionKeys: keys(),
      }),
    ).toBe(true)
  })

  it("allows legacy admin role (same gate as the supplier modal)", () => {
    expect(
      canManageSupplierPortalUsers({
        isSuperAdmin: false,
        role: "admin",
        roles: ["admin", "buyer"],
        permissionKeys: keys(),
      }),
    ).toBe(true)
  })

  it("allows user.manage", () => {
    expect(
      canManageSupplierPortalUsers({
        isSuperAdmin: false,
        role: "buyer",
        roles: ["buyer"],
        permissionKeys: keys("user.manage"),
      }),
    ).toBe(true)
  })

  it("blocks requesters and buyers without admin or user.manage", () => {
    expect(
      canManageSupplierPortalUsers({
        isSuperAdmin: false,
        role: "buyer",
        roles: ["buyer"],
        permissionKeys: keys("nav.suppliers", "catalog.order"),
      }),
    ).toBe(false)
  })

  it("blocks view_only even when user.manage is present", () => {
    expect(
      canManageSupplierPortalUsers({
        isSuperAdmin: false,
        role: "buyer",
        roles: ["buyer"],
        permissionKeys: keys("user.manage", "view_only"),
      }),
    ).toBe(false)
  })
})
