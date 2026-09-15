import { beforeEach, describe, expect, it, vi } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"
import { loadCompanyBranchesByCode } from "@/lib/branches/branch-queries"
import { copyRequisitionAccountConfigToPurchaseOrderItem } from "@/lib/requisitions/account-config-bridge"
import {
  createDraftFromRequisition,
  rollbackDraftPurchaseOrdersAndRestoreRequisition,
  siteCodeMissingDeliveryAddressError,
} from "@/lib/purchase-orders/create-draft-from-requisition"

vi.mock("@/lib/branches/branch-queries", () => ({
  loadCompanyBranchesByCode: vi.fn(),
}))

vi.mock("@/lib/requisitions/account-config-bridge", () => ({
  copyRequisitionAccountConfigToPurchaseOrderItem: vi.fn(async () => ({
    ok: true as const,
  })),
}))

const loadBranches = vi.mocked(loadCompanyBranchesByCode)
const copyAccount = vi.mocked(copyRequisitionAccountConfigToPurchaseOrderItem)

type DbOp = {
  table: string
  op: "insert" | "delete" | "update" | "select"
  payload?: unknown
  filters: Record<string, unknown>
}

function createMockSupabase(options: {
  requisition?: Record<string, unknown> | null
  items?: Record<string, unknown>[]
  poInsertResults?: Array<{ data: unknown; error: unknown }>
  poItemsInsertResults?: Array<{ data: unknown; error: unknown }>
  remainingPosAfterDelete?: Array<{ id: string }>
}) {
  const ops: DbOp[] = []
  let poInsertCount = 0
  let poItemsInsertCount = 0

  const client = {
    from(table: string) {
      const filters: Record<string, unknown> = {}
      let pendingOp: DbOp["op"] | null = null
      let pendingPayload: unknown

      const commit = (result: { data: unknown; error: unknown }) => {
        if (pendingOp) {
          ops.push({
            table,
            op: pendingOp,
            payload: pendingPayload,
            filters: { ...filters },
          })
        }
        return Promise.resolve(result)
      }

      const query: Record<string, unknown> = {}
      const self = () => query

      Object.assign(query, {
        select: (cols?: string) => {
          if (!pendingOp) {
            pendingOp = "select"
            pendingPayload = cols
          }
          return query
        },
        eq: (col: string, val: unknown) => {
          filters[col] = val
          return query
        },
        neq: (col: string, val: unknown) => {
          filters[`neq:${col}`] = val
          return query
        },
        in: (col: string, val: unknown) => {
          filters[`in:${col}`] = val
          return query
        },
        order: () => query,
        limit: () => query,
        insert: (payload: unknown) => {
          pendingOp = "insert"
          pendingPayload = payload
          return query
        },
        update: (payload: unknown) => {
          pendingOp = "update"
          pendingPayload = payload
          return query
        },
        delete: () => {
          pendingOp = "delete"
          return query
        },
        single: () => {
          if (table === "requisitions") {
            return commit(
              options.requisition
                ? { data: options.requisition, error: null }
                : { data: null, error: { message: "not found" } },
            )
          }
          if (table === "purchase_orders" && pendingOp === "insert") {
            const result = options.poInsertResults?.[poInsertCount] ?? {
              data: {
                id: `po-${poInsertCount + 1}`,
                code: `PO-${poInsertCount + 1}`,
              },
              error: null,
            }
            poInsertCount += 1
            return commit(result)
          }
          return commit({ data: null, error: { message: "unexpected single" } })
        },
        then: (
          resolve: (v: { data: unknown; error: unknown }) => unknown,
          reject?: (e: unknown) => unknown,
        ) => {
          if (table === "requisition_items") {
            return commit({ data: options.items ?? [], error: null }).then(
              resolve,
              reject,
            )
          }
          if (table === "purchase_order_items" && pendingOp === "insert") {
            const result = options.poItemsInsertResults?.[poItemsInsertCount] ?? {
              data: [
                {
                  id: `poi-${poItemsInsertCount + 1}`,
                  requisition_item_id: "ri-1",
                },
              ],
              error: null,
            }
            poItemsInsertCount += 1
            return commit(result).then(resolve, reject)
          }
          if (table === "purchase_orders" && pendingOp === "select") {
            return commit({
              data: options.remainingPosAfterDelete ?? [],
              error: null,
            }).then(resolve, reject)
          }
          return commit({ data: null, error: null }).then(resolve, reject)
        },
      })

      return query
    },
  }

  return { client: client as unknown as SupabaseClient, ops }
}

const matriz = {
  id: "b1",
  code: "MATRIZ",
  name: "Matriz",
  address: "Rua A, 1",
  city: "POA",
  state: "RS",
  zip_code: "90000-000",
}

const filial = {
  id: "b2",
  code: "FILIAL",
  name: "Filial",
  address: "Rua B, 2",
  city: "SP",
  state: "SP",
  zip_code: "01000-000",
}

describe("siteCodeMissingDeliveryAddressError", () => {
  it("returns null when branch has a name", () => {
    expect(
      siteCodeMissingDeliveryAddressError("FILIAL", {
        code: "FILIAL",
        name: "Filial SP",
        address: null,
        city: null,
        state: null,
        zip_code: null,
      }),
    ).toBeNull()
  })

  it("returns error when branch is missing", () => {
    expect(siteCodeMissingDeliveryAddressError("FILIAL", undefined)).toMatch(
      /FILIAL/,
    )
  })
})

describe("rollbackDraftPurchaseOrdersAndRestoreRequisition", () => {
  it("deletes created drafts and restores approved when no other PO remains", async () => {
    const { client, ops } = createMockSupabase({ remainingPosAfterDelete: [] })
    await rollbackDraftPurchaseOrdersAndRestoreRequisition(client, {
      companyId: "co1",
      requisitionCode: "REQ-1",
      previousStatus: "approved",
      createdIds: ["po-1", "po-2"],
    })

    const deleted = ops.find((op) => op.table === "purchase_orders" && op.op === "delete")
    expect(deleted?.filters["in:id"]).toEqual(["po-1", "po-2"])

    const restored = ops.find((op) => op.table === "requisitions" && op.op === "update")
    expect(restored?.payload).toEqual({ status: "approved" })
    expect(restored?.filters.code).toBe("REQ-1")
  })

  it("does not restore status when another active PO remains", async () => {
    const { client, ops } = createMockSupabase({
      remainingPosAfterDelete: [{ id: "other" }],
    })
    await rollbackDraftPurchaseOrdersAndRestoreRequisition(client, {
      companyId: "co1",
      requisitionCode: "REQ-1",
      previousStatus: "approved",
      createdIds: ["po-1"],
    })

    expect(ops.some((op) => op.table === "requisitions" && op.op === "update")).toBe(
      false,
    )
  })
})

describe("createDraftFromRequisition", () => {
  beforeEach(() => {
    loadBranches.mockReset()
    copyAccount.mockReset()
    copyAccount.mockResolvedValue({ ok: true })
  })

  it("does not insert any PO when a later site_code has no delivery address", async () => {
    loadBranches.mockResolvedValue(new Map([["MATRIZ", matriz]]))
    const { client, ops } = createMockSupabase({
      requisition: {
        id: "r1",
        code: "REQ-1",
        title: "Teste",
        status: "approved",
        requester_id: "other",
      },
      items: [
        {
          id: "ri-1",
          material_code: "A",
          material_description: "A",
          quantity: 1,
          unit_of_measure: "UN",
          site_code: "MATRIZ",
        },
        {
          id: "ri-2",
          material_code: "B",
          material_description: "B",
          quantity: 1,
          unit_of_measure: "UN",
          site_code: "FILIAL",
        },
      ],
    })

    const result = await createDraftFromRequisition(client, {
      companyId: "co1",
      userId: "buyer",
      requisitionId: "r1",
    })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/FILIAL/)
    expect(ops.some((op) => op.table === "purchase_orders" && op.op === "insert")).toBe(
      false,
    )
  })

  it("rolls back the first PO and restores REQ when the second site fails to insert items", async () => {
    loadBranches.mockResolvedValue(
      new Map([
        ["MATRIZ", matriz],
        ["FILIAL", filial],
      ]),
    )
    const { client, ops } = createMockSupabase({
      requisition: {
        id: "r1",
        code: "REQ-1",
        title: "Teste",
        status: "approved",
        requester_id: "other",
      },
      items: [
        {
          id: "ri-1",
          material_code: "A",
          material_description: "A",
          quantity: 1,
          unit_of_measure: "UN",
          site_code: "MATRIZ",
        },
        {
          id: "ri-2",
          material_code: "B",
          material_description: "B",
          quantity: 1,
          unit_of_measure: "UN",
          site_code: "FILIAL",
        },
      ],
      poItemsInsertResults: [
        { data: [{ id: "poi-1", requisition_item_id: "ri-1" }], error: null },
        { data: null, error: { message: "falha nos itens" } },
      ],
      remainingPosAfterDelete: [],
    })

    const result = await createDraftFromRequisition(client, {
      companyId: "co1",
      userId: "buyer",
      requisitionId: "r1",
    })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe("falha nos itens")

    const deleted = ops.find((op) => op.table === "purchase_orders" && op.op === "delete")
    expect(deleted?.filters["in:id"]).toEqual(["po-1", "po-2"])

    const restored = ops.find((op) => op.table === "requisitions" && op.op === "update")
    expect(restored?.payload).toEqual({ status: "approved" })
  })
})
