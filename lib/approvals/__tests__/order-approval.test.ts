import { describe, expect, it } from "vitest"
import { matchOrderApprovalLevel } from "@/lib/approvals/order-approval"

describe("matchOrderApprovalLevel", () => {
  const levels = [
    {
      id: "a",
      approver_id: "u1",
      approver_name: "Baixo",
      min_value: 0,
      max_value: 1000,
      created_at: "2026-01-01T00:00:00Z",
    },
    {
      id: "b",
      approver_id: "u2",
      approver_name: "Alto",
      min_value: 1000,
      max_value: null,
      created_at: "2026-01-02T00:00:00Z",
    },
  ]

  it("casa faixa inferior", () => {
    expect(matchOrderApprovalLevel(levels, 500)?.approver_id).toBe("u1")
  })

  it("casa faixa sem teto e prefere min maior em overlap", () => {
    expect(matchOrderApprovalLevel(levels, 1000)?.approver_id).toBe("u2")
    expect(matchOrderApprovalLevel(levels, 50_000)?.approver_id).toBe("u2")
  })

  it("sem match quando fora de todas as faixas", () => {
    expect(
      matchOrderApprovalLevel(
        [
          {
            id: "c",
            approver_id: "u3",
            approver_name: "X",
            min_value: 100,
            max_value: 200,
            created_at: null,
          },
        ],
        50,
      ),
    ).toBeNull()
  })
})
