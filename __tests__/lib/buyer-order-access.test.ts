import { describe, expect, it } from "vitest"
import { canUseBuyerOrderApi } from "@/lib/auth/buyer-order-access"
import { canUserWrite } from "@/lib/permissions/resolve-user-permissions"
import type { PermissionKey } from "@/lib/hooks/usePermissions"

describe("canUseBuyerOrderApi", () => {
  it("allows buyer and superadmin", () => {
    expect(canUseBuyerOrderApi("buyer", false)).toBe(true)
    expect(canUseBuyerOrderApi("requester", true)).toBe(true)
    expect(canUseBuyerOrderApi("supplier", true)).toBe(true)
  })

  it("blocks requester and supplier", () => {
    expect(canUseBuyerOrderApi("requester", false)).toBe(false)
    expect(canUseBuyerOrderApi("supplier", false)).toBe(false)
    expect(canUseBuyerOrderApi(null, false)).toBe(false)
  })
})

describe("order.create for contract PO", () => {
  it("blocks view_only even when order.create is present", () => {
    const keys = new Set<PermissionKey>(["order.create", "view_only"])
    expect(canUserWrite(keys, "order.create")).toBe(false)
  })

  it("allows buyer with order.create", () => {
    const keys = new Set<PermissionKey>(["order.create"])
    expect(canUserWrite(keys, "order.create")).toBe(true)
  })

  it("blocks requester-like empty permission set", () => {
    expect(canUserWrite(new Set<PermissionKey>(), "order.create")).toBe(false)
  })
})
