import { describe, expect, it } from "vitest"
import {
  rollbackDraftPurchaseOrders,
  type DraftPurchaseOrderRollbackClient,
} from "@/lib/purchase-orders/rollback-draft-purchase-orders"

function mockClient(calls: string[]): DraftPurchaseOrderRollbackClient {
  return {
    rpc: async (fn, args) => {
      calls.push(`rpc:${fn}:${args.p_order_id}`)
    },
    from: (table) => ({
      delete: () => ({
        eq: async (column, value) => {
          calls.push(`delete:${table}:${column}:${value}`)
        },
      }),
    }),
  }
}

describe("rollbackDraftPurchaseOrders", () => {
  it("releases contract balance then deletes each order in order", async () => {
    const calls: string[] = []
    await rollbackDraftPurchaseOrders(mockClient(calls), ["po-a", "po-b"])
    expect(calls).toEqual([
      "rpc:release_contract_balance:po-a",
      "delete:purchase_orders:id:po-a",
      "rpc:release_contract_balance:po-b",
      "delete:purchase_orders:id:po-b",
    ])
  })

  it("still deletes the PO when release_contract_balance throws", async () => {
    const calls: string[] = []
    const db: DraftPurchaseOrderRollbackClient = {
      rpc: async () => {
        calls.push("rpc")
        throw new Error("rpc down")
      },
      from: (table) => ({
        delete: () => ({
          eq: async (column, value) => {
            calls.push(`delete:${table}:${column}:${value}`)
          },
        }),
      }),
    }
    await rollbackDraftPurchaseOrders(db, ["po-1"])
    expect(calls).toEqual(["rpc", "delete:purchase_orders:id:po-1"])
  })

  it("is a no-op for an empty list", async () => {
    const calls: string[] = []
    await rollbackDraftPurchaseOrders(mockClient(calls), [])
    expect(calls).toEqual([])
  })
})
