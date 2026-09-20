import { describe, expect, it } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"
import { replaceRequisitionItems } from "@/lib/api/external/requisition-service"
import { mapRequisitionToApi } from "@/lib/api/external/mappers/requisition"
import {
  applySiteCodesToRequisitionItems,
  parseRequisitionWriteInput,
  requisitionItemsToRows,
  type RequisitionItemWriteInput,
} from "@/lib/api/external/validators/requisition-write"

const baseItem = (
  overrides: Partial<RequisitionItemWriteInput> = {},
): RequisitionItemWriteInput => ({
  material_code: "MAT-001",
  material_description: "Parafuso",
  quantity: 10,
  unit_of_measure: "UN",
  estimated_price: 1.5,
  commodity_group: null,
  observations: null,
  site_code: null,
  ...overrides,
})

describe("parseRequisitionWriteInput", () => {
  it("aceita site_code opcional no item", () => {
    const parsed = parseRequisitionWriteInput({
      external_code: "ERP-1",
      title: "Materiais",
      items: [
        {
          material_description: "Parafuso",
          quantity: 2,
          site_code: "FIL-01",
        },
      ],
    })
    expect(parsed).not.toBeTypeOf("string")
    if (typeof parsed === "string") return
    expect(parsed.items[0].site_code).toBe("FIL-01")
  })

  it("mantém site_code nulo quando omitido (default na persistência)", () => {
    const parsed = parseRequisitionWriteInput({
      external_code: "ERP-1",
      title: "Materiais",
      items: [{ material_description: "Parafuso", quantity: 2 }],
    })
    expect(parsed).not.toBeTypeOf("string")
    if (typeof parsed === "string") return
    expect(parsed.items[0].site_code).toBeNull()
  })
})

describe("applySiteCodesToRequisitionItems", () => {
  it("preenche MATRIZ quando o ERP omite site_code", () => {
    const resolved = applySiteCodesToRequisitionItems(
      [baseItem()],
      "MATRIZ",
      new Set(["MATRIZ", "FIL-01"]),
    )
    expect(resolved).not.toBeTypeOf("string")
    if (typeof resolved === "string") return
    expect(resolved[0].site_code).toBe("MATRIZ")
  })

  it("preserva site_code enviado se existir no cadastro", () => {
    const resolved = applySiteCodesToRequisitionItems(
      [baseItem({ site_code: "FIL-01" })],
      "MATRIZ",
      new Set(["MATRIZ", "FIL-01"]),
    )
    expect(resolved).not.toBeTypeOf("string")
    if (typeof resolved === "string") return
    expect(resolved[0].site_code).toBe("FIL-01")
  })

  it("rejeita site_code fora do cadastro", () => {
    const resolved = applySiteCodesToRequisitionItems(
      [baseItem({ site_code: "ZZZ" })],
      "MATRIZ",
      new Set(["MATRIZ"]),
    )
    expect(resolved).toMatch(/não existe/)
  })

  it("falha se não houver filial cadastrada", () => {
    expect(
      applySiteCodesToRequisitionItems([baseItem()], null, new Set()),
    ).toMatch(/MATRIZ/)
  })
})

describe("requisitionItemsToRows", () => {
  it("grava site_code na linha (NOT NULL após migration 079)", () => {
    const rows = requisitionItemsToRows("co1", "req1", [
      baseItem({ site_code: "MATRIZ" }),
    ])
    expect(rows[0].site_code).toBe("MATRIZ")
  })
})

describe("mapRequisitionToApi", () => {
  it("expõe site_code do item", () => {
    const mapped = mapRequisitionToApi(
      {
        id: "r1",
        code: "REQ-0001",
        external_code: "ERP-1",
        title: "Materiais",
        created_at: "2026-09-01T00:00:00Z",
      },
      [
        {
          id: "i1",
          material_code: "MAT-001",
          material_description: "Parafuso",
          quantity: 2,
          unit_of_measure: "UN",
          estimated_price: 1,
          commodity_group: null,
          observations: null,
          site_code: "MATRIZ",
        },
      ],
    )
    expect(mapped.items[0].site_code).toBe("MATRIZ")
  })
})

describe("replaceRequisitionItems", () => {
  function createFakeDb(opts: { existingIds: string[]; insertError?: string }) {
    const ops: string[] = []
    let deletedIds: string[] | null = null

    const client = {
      ops,
      getDeletedIds: () => deletedIds,
      from() {
        return {
          select() {
            return {
              eq: async () => {
                ops.push("select")
                return {
                  data: opts.existingIds.map((id) => ({ id })),
                  error: null,
                }
              },
            }
          },
          insert: async () => {
            ops.push("insert")
            return {
              error: opts.insertError ? { message: opts.insertError } : null,
            }
          },
          delete() {
            return {
              in: async (_col: string, ids: string[]) => {
                ops.push("delete")
                deletedIds = ids
                return { error: null }
              },
            }
          },
        }
      },
    }

    return client
  }

  it("não apaga linhas antigas se o INSERT falhar (site_code NOT NULL)", async () => {
    const db = createFakeDb({
      existingIds: ["old-1", "old-2"],
      insertError: 'null value in column "site_code" violates not-null constraint',
    })

    const result = await replaceRequisitionItems(
      db as unknown as SupabaseClient,
      "req-1",
      requisitionItemsToRows("co1", "req-1", [baseItem()]),
    )

    expect(result.ok).toBe(false)
    expect(db.ops).toEqual(["select", "insert"])
    expect(db.getDeletedIds()).toBeNull()
  })

  it("só apaga os ids antigos depois do INSERT ok", async () => {
    const db = createFakeDb({ existingIds: ["old-1"] })

    const result = await replaceRequisitionItems(
      db as unknown as SupabaseClient,
      "req-1",
      requisitionItemsToRows("co1", "req-1", [baseItem({ site_code: "MATRIZ" })]),
    )

    expect(result).toEqual({ ok: true })
    expect(db.ops).toEqual(["select", "insert", "delete"])
    expect(db.getDeletedIds()).toEqual(["old-1"])
  })
})
