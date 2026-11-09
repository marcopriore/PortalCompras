import { describe, expect, it } from "vitest"
import { cancelOrphanCatalogRequisitionAfterPoCancel } from "@/lib/requisitions/cancel-catalog-after-po"

type Call = { table: string; op: string; payload?: unknown }

function createFakeSupabase(options: {
  requisition: Record<string, unknown> | null
  siblings?: Array<{ id: string }>
}) {
  const calls: Call[] = []
  const supabase = {
    calls,
    from(table: string) {
      const thenable = {
        select() {
          return thenable
        },
        eq() {
          return thenable
        },
        neq() {
          return thenable
        },
        limit() {
          return thenable
        },
        maybeSingle: async () => {
          calls.push({ table, op: "maybeSingle" })
          return { data: table === "requisitions" ? options.requisition : null }
        },
        update(payload: unknown) {
          calls.push({ table, op: "update", payload })
          return {
            eq() {
              return {
                eq: async () => ({ error: null }),
              }
            },
          }
        },
        then(
          onFulfilled?: (value: { data: Array<{ id: string }> }) => unknown,
          onRejected?: (reason: unknown) => unknown,
        ) {
          calls.push({ table, op: "list" })
          return Promise.resolve({
            data: table === "purchase_orders" ? (options.siblings ?? []) : [],
          }).then(onFulfilled, onRejected)
        },
      }
      return thenable
    },
  }
  return supabase
}

describe("cancelOrphanCatalogRequisitionAfterPoCancel", () => {
  it("cancela REQ de catálogo órfã após cancelar o PO", async () => {
    const supabase = createFakeSupabase({
      requisition: {
        id: "req-1",
        origin: "catalog",
        status: "awaiting_buyer",
        quotation_id: null,
      },
      siblings: [],
    })

    await cancelOrphanCatalogRequisitionAfterPoCancel(supabase as never, {
      companyId: "co-1",
      requisitionCode: "REQ-1",
      cancelledPurchaseOrderId: "po-1",
    })

    const update = supabase.calls.find((c) => c.op === "update")
    expect(update).toEqual({
      table: "requisitions",
      op: "update",
      payload: { status: "cancelled" },
    })
  })

  it("não mexe em REQ manual", async () => {
    const supabase = createFakeSupabase({
      requisition: {
        id: "req-2",
        origin: "manual",
        status: "approved",
        quotation_id: null,
      },
    })

    await cancelOrphanCatalogRequisitionAfterPoCancel(supabase as never, {
      companyId: "co-1",
      requisitionCode: "REQ-2",
      cancelledPurchaseOrderId: "po-2",
    })

    expect(supabase.calls.some((c) => c.op === "update")).toBe(false)
  })

  it("não cancela REQ de catálogo se ainda houver PO irmão ativo", async () => {
    const supabase = createFakeSupabase({
      requisition: {
        id: "req-3",
        origin: "catalog",
        status: "awaiting_buyer",
        quotation_id: null,
      },
      siblings: [{ id: "po-other" }],
    })

    await cancelOrphanCatalogRequisitionAfterPoCancel(supabase as never, {
      companyId: "co-1",
      requisitionCode: "REQ-3",
      cancelledPurchaseOrderId: "po-3",
    })

    expect(supabase.calls.some((c) => c.op === "update")).toBe(false)
  })
})
