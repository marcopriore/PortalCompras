import { describe, expect, it } from "vitest"
import {
  canLeavePurchaseOrderAwaitingApproval,
  isClientWritableApprovalRequestStatus,
} from "@/lib/approvals/po-awaiting-approval-gate"

describe("canLeavePurchaseOrderAwaitingApproval", () => {
  it("bloqueia awaiting_approval → sent sem AR aprovado (bypass RLS do comprador)", () => {
    expect(
      canLeavePurchaseOrderAwaitingApproval({
        nextStatus: "sent",
        hasApprovedOrderAr: false,
        hasPendingOrderAr: true,
      }),
    ).toBe(false)
  })

  it("bloqueia awaiting_approval → sent sem nenhum AR", () => {
    expect(
      canLeavePurchaseOrderAwaitingApproval({
        nextStatus: "sent",
        hasApprovedOrderAr: false,
        hasPendingOrderAr: false,
      }),
    ).toBe(false)
  })

  it("bloqueia awaiting_approval → processing/completed sem aprovação", () => {
    for (const nextStatus of ["processing", "completed"]) {
      expect(
        canLeavePurchaseOrderAwaitingApproval({
          nextStatus,
          hasApprovedOrderAr: false,
          hasPendingOrderAr: true,
        }),
      ).toBe(false)
    }
  })

  it("bloqueia envio se ainda houver AR pendente mesmo com um aprovado antigo", () => {
    expect(
      canLeavePurchaseOrderAwaitingApproval({
        nextStatus: "sent",
        hasApprovedOrderAr: true,
        hasPendingOrderAr: true,
      }),
    ).toBe(false)
  })

  it("libera awaiting_approval → sent após AR aprovado e sem pendente", () => {
    expect(
      canLeavePurchaseOrderAwaitingApproval({
        nextStatus: "sent",
        hasApprovedOrderAr: true,
        hasPendingOrderAr: false,
      }),
    ).toBe(true)
  })

  it("permite cancelar o pedido pendente de aprovação", () => {
    expect(
      canLeavePurchaseOrderAwaitingApproval({
        nextStatus: "cancelled",
        hasApprovedOrderAr: false,
        hasPendingOrderAr: true,
      }),
    ).toBe(true)
  })

  it("permite devolver a rascunho na reprovação da alçada de pedido", () => {
    expect(
      canLeavePurchaseOrderAwaitingApproval({
        nextStatus: "draft",
        hasApprovedOrderAr: false,
        hasPendingOrderAr: true,
      }),
    ).toBe(true)
  })

  it("não interfere em update que mantém awaiting_approval", () => {
    expect(
      canLeavePurchaseOrderAwaitingApproval({
        nextStatus: "awaiting_approval",
        hasApprovedOrderAr: false,
        hasPendingOrderAr: true,
      }),
    ).toBe(true)
  })
})

describe("isClientWritableApprovalRequestStatus", () => {
  it("só permite o cliente gravar AR como pending (não forged approved)", () => {
    expect(isClientWritableApprovalRequestStatus("pending")).toBe(true)
    expect(isClientWritableApprovalRequestStatus("approved")).toBe(false)
    expect(isClientWritableApprovalRequestStatus("rejected")).toBe(false)
  })
})
