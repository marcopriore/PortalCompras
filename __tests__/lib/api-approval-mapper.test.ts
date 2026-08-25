import { describe, expect, it } from "vitest"
import { mapApprovalToApi } from "@/lib/api/external/approval-service"
import { isApiScope } from "@/lib/api/external/scopes"

describe("mapApprovalToApi", () => {
  it("inclui contexto da entidade", () => {
    const mapped = mapApprovalToApi(
      {
        id: "a1",
        company_id: "c1",
        flow: "requisition",
        entity_id: "r1",
        approver_id: "u1",
        approver_name: "Aprovador",
        status: "pending",
        rejection_reason: null,
        decided_at: null,
        created_at: "2026-01-01T00:00:00Z",
      },
      {
        code: "REQ-1",
        external_code: "ERP-1",
        title: "Teste",
        status: "pending",
      },
    )
    expect(mapped.entity_code).toBe("REQ-1")
    expect(mapped.entity_external_code).toBe("ERP-1")
    expect(mapped.flow).toBe("requisition")
  })
})

describe("API scopes approvals", () => {
  it("reconhece approvals:read e approvals:write", () => {
    expect(isApiScope("approvals:read")).toBe(true)
    expect(isApiScope("approvals:write")).toBe(true)
  })
})
