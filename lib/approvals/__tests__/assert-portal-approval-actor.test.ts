import { describe, expect, it } from "vitest"
import type { PermissionKey } from "@/lib/hooks/usePermissions"
import {
  approvalPermissionForFlow,
  canPortalUserDecideApproval,
} from "@/lib/approvals/assert-portal-approval-actor"

function keys(...list: PermissionKey[]): Set<PermissionKey> {
  return new Set(list)
}

describe("approvalPermissionForFlow", () => {
  it("maps known flows", () => {
    expect(approvalPermissionForFlow("requisition")).toBe("approval.requisition")
    expect(approvalPermissionForFlow("order")).toBe("approval.order")
    expect(approvalPermissionForFlow("catalog_order")).toBe(
      "approval.catalog_order",
    )
  })

  it("rejects unknown flow", () => {
    expect(approvalPermissionForFlow("unknown")).toBeNull()
  })
})

describe("canPortalUserDecideApproval", () => {
  const assigned = {
    userId: "approver-1",
    approverId: "approver-1",
    flow: "requisition",
    permissions: keys("approval.requisition"),
    isSuperAdmin: false,
  }

  it("allows the assigned approver with the flow permission", () => {
    expect(canPortalUserDecideApproval(assigned)).toEqual({ ok: true })
  })

  it("allows approval.view_all with the flow permission on someone else's request", () => {
    expect(
      canPortalUserDecideApproval({
        ...assigned,
        userId: "admin-1",
        permissions: keys("approval.requisition", "approval.view_all"),
      }),
    ).toEqual({ ok: true })
  })

  it("allows superadmin without checking assignment", () => {
    expect(
      canPortalUserDecideApproval({
        isSuperAdmin: true,
        userId: "sa",
        approverId: "someone-else",
        flow: "order",
        permissions: keys(),
      }),
    ).toEqual({ ok: true })
  })

  it("blocks another buyer even if they have the flow permission", () => {
    const result = canPortalUserDecideApproval({
      ...assigned,
      userId: "other-buyer",
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toMatch(/atribuída a outro usuário/i)
    }
  })

  it("blocks a buyer without the flow permission even when assigned", () => {
    const result = canPortalUserDecideApproval({
      ...assigned,
      permissions: keys(),
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toMatch(/não tem permissão/i)
    }
  })

  it("blocks view_only even when assigned and permitted", () => {
    const result = canPortalUserDecideApproval({
      ...assigned,
      permissions: keys("approval.requisition", "view_only"),
    })
    expect(result.ok).toBe(false)
  })

  it("blocks approval.view_all without the matching flow permission", () => {
    const result = canPortalUserDecideApproval({
      ...assigned,
      userId: "viewer",
      permissions: keys("approval.view_all"),
    })
    expect(result.ok).toBe(false)
  })

  it("blocks unassigned request unless view_all", () => {
    const result = canPortalUserDecideApproval({
      ...assigned,
      approverId: null,
    })
    expect(result.ok).toBe(false)
  })
})
