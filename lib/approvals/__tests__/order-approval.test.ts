import { describe, expect, it } from "vitest"
import {
  matchOrderApprovalLevel,
  planOrderConfirmStatus,
} from "@/lib/approvals/order-approval"

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

describe("planOrderConfirmStatus", () => {
  const levels = [
    {
      id: "a",
      approver_id: "u1",
      approver_name: "Alçada",
      min_value: 0,
      max_value: null,
      created_at: "2026-01-01T00:00:00Z",
    },
  ]

  it("falha fechada se não conseguir ler o módulo — não envia ao fornecedor", () => {
    const plan = planOrderConfirmStatus({
      moduleLookupFailed: true,
      moduleEnabled: false,
      levelsLookupFailed: false,
      levels,
      totalPrice: 100,
    })
    expect(plan.ok).toBe(false)
  })

  it("falha fechada se o módulo está ligado mas as alçadas não carregam", () => {
    const plan = planOrderConfirmStatus({
      moduleLookupFailed: false,
      moduleEnabled: true,
      levelsLookupFailed: true,
      levels: [],
      totalPrice: 100,
    })
    expect(plan.ok).toBe(false)
  })

  it("envia ao fornecedor quando o módulo está desligado", () => {
    expect(
      planOrderConfirmStatus({
        moduleLookupFailed: false,
        moduleEnabled: false,
        levelsLookupFailed: false,
        levels,
        totalPrice: 100,
      }),
    ).toEqual({ ok: true, nextStatus: "sent", reason: "module_off" })
  })

  it("envia à alçada quando o módulo está ligado e há faixa", () => {
    const plan = planOrderConfirmStatus({
      moduleLookupFailed: false,
      moduleEnabled: true,
      levelsLookupFailed: false,
      levels,
      totalPrice: 500,
    })
    expect(plan).toEqual({
      ok: true,
      nextStatus: "awaiting_approval",
      match: {
        level_id: "a",
        approver_id: "u1",
        approver_name: "Alçada",
      },
    })
  })

  it("não usa flag async ausente como módulo desligado se a leitura do módulo falhou", () => {
    // Replica o bug: hasFeature() false por loading/erro não pode virar sent.
    const fromStaleUiFlag = planOrderConfirmStatus({
      moduleLookupFailed: true,
      moduleEnabled: false,
      levelsLookupFailed: false,
      levels,
      totalPrice: 500,
    })
    expect(fromStaleUiFlag.ok).toBe(false)
    if (fromStaleUiFlag.ok === false) {
      expect(fromStaleUiFlag.error).toMatch(/alçada/i)
    }
  })
})
