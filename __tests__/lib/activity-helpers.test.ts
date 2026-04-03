import { describe, it, expect } from "vitest"
import type { OrderActivityRow, ProposalActivityRow } from "@/lib/utils/activity-helpers"
import {
  mapProposalRowsToActivityItems,
  mapOrderRowsToActivityItems,
  mergeActivityByUpdatedAt,
} from "@/lib/utils/activity-helpers"

describe("mapProposalRowsToActivityItems", () => {
  it("mapeia proposal submitted corretamente", () => {
    const rows: ProposalActivityRow[] = [
      {
        status: "submitted",
        updated_at: "2026-03-01T10:00:00Z",
        quotation_id: "q1",
        quotations: { code: "COT-2026-0001" },
      },
    ]
    const items = mapProposalRowsToActivityItems(rows)
    expect(items[0].type).toBe("proposal")
    expect(items[0].code).toBe("COT-2026-0001")
    expect(items[0].label).toMatch(/enviada/i)
  })

  it("mapeia proposal selected com label correto", () => {
    const rows: ProposalActivityRow[] = [
      {
        status: "selected",
        updated_at: "2026-03-01T10:00:00Z",
        quotation_id: "q1",
        quotations: { code: "COT-2026-0002" },
      },
    ]
    const items = mapProposalRowsToActivityItems(rows)
    expect(items[0].label).toMatch(/selecionada|vencedor/i)
  })
})

describe("mapOrderRowsToActivityItems", () => {
  it("mapeia pedido sent como Pedido recebido", () => {
    const rows: OrderActivityRow[] = [
      {
        id: "o1",
        code: "PED-2026-0001",
        status: "sent",
        updated_at: "2026-03-01T10:00:00Z",
      },
    ]
    const items = mapOrderRowsToActivityItems(rows)
    expect(items[0].type).toBe("order")
    expect(items[0].code).toBe("PED-2026-0001")
    expect(items[0].label).toMatch(/recebido/i)
  })

  it("mapeia pedido processing como Pedido aceito", () => {
    const rows: OrderActivityRow[] = [
      {
        id: "o1",
        code: "PED-2026-0001",
        status: "processing",
        updated_at: "2026-03-01T10:00:00Z",
      },
    ]
    const items = mapOrderRowsToActivityItems(rows)
    expect(items[0].label).toMatch(/aceito/i)
  })
})

describe("mergeActivityByUpdatedAt", () => {
  it("ordena itens por updated_at DESC", () => {
    const proposals = mapProposalRowsToActivityItems([
      {
        status: "submitted",
        updated_at: "2026-03-01T10:00:00Z",
        quotation_id: "q1",
        quotations: { code: "COT-001" },
      },
    ])
    const orders = mapOrderRowsToActivityItems([
      {
        id: "o1",
        code: "PED-001",
        status: "sent",
        updated_at: "2026-03-02T10:00:00Z",
      },
    ])
    const merged = mergeActivityByUpdatedAt(proposals, orders)
    expect(merged[0].updated_at).toBe("2026-03-02T10:00:00Z")
    expect(merged[1].updated_at).toBe("2026-03-01T10:00:00Z")
  })

  it("dashboard: slice(0, 8) após merge limita a 8 itens", () => {
    const rows: OrderActivityRow[] = Array.from({ length: 10 }, (_, i) => ({
      id: `o${i}`,
      code: `PED-${i}`,
      status: "sent",
      updated_at: `2026-03-${String(20 - i).padStart(2, "0")}T10:00:00Z`,
    }))
    const orders = mapOrderRowsToActivityItems(rows)
    const merged = mergeActivityByUpdatedAt([], orders)
    const limited = merged.slice(0, 8)
    expect(merged.length).toBe(10)
    expect(limited.length).toBe(8)
  })
})
