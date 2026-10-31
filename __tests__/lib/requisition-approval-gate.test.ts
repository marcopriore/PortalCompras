import { describe, expect, it } from "vitest"
import {
  clientMayChangeRequisitionStatus,
  requisitionRequiresManualApproval,
} from "@/lib/requisitions/approval-gate"

describe("requisitionRequiresManualApproval", () => {
  it("é false quando o módulo está desligado mesmo com alçada", () => {
    expect(requisitionRequiresManualApproval(false, true)).toBe(false)
  })

  it("é false quando o módulo está ligado mas não há aprovador para o CC", () => {
    expect(requisitionRequiresManualApproval(true, false)).toBe(false)
  })

  it("é true só com módulo e aprovador", () => {
    expect(requisitionRequiresManualApproval(true, true)).toBe(true)
  })
})

describe("clientMayChangeRequisitionStatus", () => {
  it("service role pode qualquer transição (API de alçada / ERP)", () => {
    expect(
      clientMayChangeRequisitionStatus({
        oldStatus: "pending",
        newStatus: "approved",
        isServiceRole: true,
        requiresManualApproval: true,
      }),
    ).toBe(true)
  })

  it("cliente não aprova REQ pending quando a alçada se aplica", () => {
    expect(
      clientMayChangeRequisitionStatus({
        oldStatus: "pending",
        newStatus: "approved",
        isServiceRole: false,
        requiresManualApproval: true,
      }),
    ).toBe(false)
  })

  it("cliente não pula a alçada indo para in_quotation / awaiting_buyer", () => {
    expect(
      clientMayChangeRequisitionStatus({
        oldStatus: "pending",
        newStatus: "in_quotation",
        isServiceRole: false,
        requiresManualApproval: true,
      }),
    ).toBe(false)
    expect(
      clientMayChangeRequisitionStatus({
        oldStatus: "pending",
        newStatus: "awaiting_buyer",
        isServiceRole: false,
        requiresManualApproval: true,
      }),
    ).toBe(false)
  })

  it("auto-aprovação no cliente continua válida sem alçada", () => {
    expect(
      clientMayChangeRequisitionStatus({
        oldStatus: "pending",
        newStatus: "approved",
        isServiceRole: false,
        requiresManualApproval: false,
      }),
    ).toBe(true)
  })

  it("resubmit rejected → pending e cancelamento pending → cancelled seguem permitidos", () => {
    expect(
      clientMayChangeRequisitionStatus({
        oldStatus: "rejected",
        newStatus: "pending",
        isServiceRole: false,
        requiresManualApproval: true,
      }),
    ).toBe(true)
    expect(
      clientMayChangeRequisitionStatus({
        oldStatus: "pending",
        newStatus: "cancelled",
        isServiceRole: false,
        requiresManualApproval: true,
      }),
    ).toBe(true)
  })

  it("não restringe REQ já aprovada (cotação / pedido / cancelar cotação)", () => {
    expect(
      clientMayChangeRequisitionStatus({
        oldStatus: "in_quotation",
        newStatus: "approved",
        isServiceRole: false,
        requiresManualApproval: true,
      }),
    ).toBe(true)
  })
})
