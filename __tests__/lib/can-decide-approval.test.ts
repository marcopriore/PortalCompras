import { describe, expect, it } from "vitest"
import type { PermissionKey } from "@/lib/hooks/usePermissions"
import {
  canDecideApprovalRequest,
  isPortalApprovalFlow,
} from "@/lib/approvals/can-decide-approval"

function keys(...values: PermissionKey[]): Set<PermissionKey> {
  return new Set(values)
}

describe("isPortalApprovalFlow", () => {
  it("aceita os fluxos da alçada", () => {
    expect(isPortalApprovalFlow("requisition")).toBe(true)
    expect(isPortalApprovalFlow("order")).toBe(true)
    expect(isPortalApprovalFlow("catalog_order")).toBe(true)
  })

  it("rejeita valores desconhecidos", () => {
    expect(isPortalApprovalFlow("unknown")).toBe(false)
    expect(isPortalApprovalFlow("")).toBe(false)
  })
})

describe("canDecideApprovalRequest", () => {
  it("superadmin decide qualquer fluxo", () => {
    expect(
      canDecideApprovalRequest({
        actorUserId: "admin",
        isSuperAdmin: true,
        permissions: keys(),
        flow: "order",
        approverId: "other",
      }),
    ).toBe(true)
  })

  it("aprovador designado com a permissão do fluxo decide", () => {
    expect(
      canDecideApprovalRequest({
        actorUserId: "u1",
        isSuperAdmin: false,
        permissions: keys("approval.requisition"),
        flow: "requisition",
        approverId: "u1",
      }),
    ).toBe(true)
  })

  it("comprador comum não decide alçada de outro", () => {
    expect(
      canDecideApprovalRequest({
        actorUserId: "buyer",
        isSuperAdmin: false,
        permissions: keys("approval.order", "order.create"),
        flow: "order",
        approverId: "manager",
      }),
    ).toBe(false)
  })

  it("comprador sem permissão de alçada não decide nem a própria fila", () => {
    expect(
      canDecideApprovalRequest({
        actorUserId: "u1",
        isSuperAdmin: false,
        permissions: keys("nav.orders"),
        flow: "order",
        approverId: "u1",
      }),
    ).toBe(false)
  })

  it("approval.view_all decide se também tem a permissão do fluxo", () => {
    expect(
      canDecideApprovalRequest({
        actorUserId: "lead",
        isSuperAdmin: false,
        permissions: keys("approval.view_all", "approval.catalog_order"),
        flow: "catalog_order",
        approverId: "manager",
      }),
    ).toBe(true)
  })

  it("approval.view_all sozinho não decide outro fluxo", () => {
    expect(
      canDecideApprovalRequest({
        actorUserId: "lead",
        isSuperAdmin: false,
        permissions: keys("approval.view_all"),
        flow: "order",
        approverId: "manager",
      }),
    ).toBe(false)
  })

  it("view_only bloqueia mesmo o aprovador designado", () => {
    expect(
      canDecideApprovalRequest({
        actorUserId: "u1",
        isSuperAdmin: false,
        permissions: keys("approval.requisition", "view_only"),
        flow: "requisition",
        approverId: "u1",
      }),
    ).toBe(false)
  })

  it("AR sem aprovador só pode ser decidida por view_all / superadmin", () => {
    expect(
      canDecideApprovalRequest({
        actorUserId: "u1",
        isSuperAdmin: false,
        permissions: keys("approval.order"),
        flow: "order",
        approverId: null,
      }),
    ).toBe(false)

    expect(
      canDecideApprovalRequest({
        actorUserId: "lead",
        isSuperAdmin: false,
        permissions: keys("approval.order", "approval.view_all"),
        flow: "order",
        approverId: null,
      }),
    ).toBe(true)
  })
})
