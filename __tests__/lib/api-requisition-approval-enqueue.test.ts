import { describe, expect, it } from "vitest"
import { planRequisitionApprovalEnqueue } from "@/lib/api/external/approval-service"

describe("planRequisitionApprovalEnqueue", () => {
  it("não mexe na REQ quando o módulo de alçada está desligado", () => {
    expect(
      planRequisitionApprovalEnqueue({
        moduleEnabled: false,
        rpcError: null,
        approverId: "u1",
        approverName: "Gestor",
      }),
    ).toEqual({ action: "skip_module_off" })
  })

  it("não auto-aprova se a RPC de alçada falhar — REQ permanece pending", () => {
    expect(
      planRequisitionApprovalEnqueue({
        moduleEnabled: true,
        rpcError: "connection reset",
        approverId: null,
        approverName: null,
      }),
    ).toEqual({ action: "rpc_error", message: "connection reset" })
  })

  it("auto-aprova quando o módulo está ligado e não há aprovador para o CC", () => {
    expect(
      planRequisitionApprovalEnqueue({
        moduleEnabled: true,
        rpcError: null,
        approverId: null,
        approverName: null,
      }),
    ).toEqual({ action: "auto_approve" })
  })

  it("auto-aprova se o aprovador vier vazio", () => {
    expect(
      planRequisitionApprovalEnqueue({
        moduleEnabled: true,
        rpcError: null,
        approverId: "",
        approverName: "—",
      }),
    ).toEqual({ action: "auto_approve" })
  })

  it("enfileira quando há aprovador de CC", () => {
    expect(
      planRequisitionApprovalEnqueue({
        moduleEnabled: true,
        rpcError: null,
        approverId: "u-gestor",
        approverName: "Gestor CC",
      }),
    ).toEqual({
      action: "queue",
      approver_id: "u-gestor",
      approver_name: "Gestor CC",
    })
  })
})
