import { describe, expect, it } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  replaceRequisitionItems,
  validateRequisitionItemWriteRows,
  type RequisitionItemWriteRow,
} from "@/lib/requisitions/replace-requisition-items"

const row = (
  overrides: Partial<RequisitionItemWriteRow> = {},
): RequisitionItemWriteRow => ({
  id: "aaaaaaaa-0000-0000-0000-000000000001",
  requisition_id: "req-1",
  company_id: "co-1",
  material_code: "M1",
  material_description: "Parafuso",
  quantity: 2,
  unit_of_measure: "UN",
  commodity_group: null,
  observations: null,
  site_code: "MATRIZ",
  ...overrides,
})

describe("validateRequisitionItemWriteRows", () => {
  it("rejects missing id before any write", () => {
    expect(validateRequisitionItemWriteRows([row({ id: "" })])).toMatch(/id ausente/i)
  })

  it("rejects missing site_code before any write", () => {
    expect(validateRequisitionItemWriteRows([row({ site_code: "  " })])).toMatch(
      /centro \/ filial/i,
    )
  })

  it("accepts complete rows", () => {
    expect(validateRequisitionItemWriteRows([row()])).toBeNull()
  })
})

function createMockDb(options: {
  snapshot?: Record<string, unknown>[]
  snapshotError?: { message: string }
  deleteError?: { message: string }
  insertErrors?: Array<{ message: string } | null>
}) {
  const insertErrors = options.insertErrors ?? []
  let insertCalls = 0
  const inserted: unknown[] = []

  const db = {
    from() {
      return {
        select() {
          return {
            eq() {
              if (options.snapshotError) {
                return Promise.resolve({ data: null, error: options.snapshotError })
              }
              return Promise.resolve({
                data: options.snapshot ?? [],
                error: null,
              })
            },
          }
        },
        delete() {
          return {
            eq() {
              return Promise.resolve({ error: options.deleteError ?? null })
            },
          }
        },
        insert(payload: unknown) {
          inserted.push(payload)
          const err = insertErrors[insertCalls] ?? null
          insertCalls += 1
          return Promise.resolve({ error: err })
        },
      }
    },
  }

  return {
    db: db as unknown as SupabaseClient,
    inserted,
    get insertCalls() {
      return insertCalls
    },
  }
}

describe("replaceRequisitionItems", () => {
  it("does not delete when site_code is missing", async () => {
    const mock = createMockDb({ snapshot: [row()] })
    const result = await replaceRequisitionItems(mock.db, "req-1", [
      row({ site_code: "" }),
    ])
    expect(result).toEqual({
      ok: false,
      error: "Selecione o centro / filial em todos os itens.",
    })
    expect(mock.insertCalls).toBe(0)
  })

  it("does not delete when item id is missing", async () => {
    const mock = createMockDb({ snapshot: [row()] })
    const result = await replaceRequisitionItems(mock.db, "req-1", [row({ id: "" })])
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/id ausente/i)
    expect(mock.insertCalls).toBe(0)
  })

  it("restores the previous lines when insert fails", async () => {
    const previous = { ...row(), material_description: "Linha original" }
    const mock = createMockDb({
      snapshot: [previous],
      insertErrors: [{ message: "violates foreign key constraint" }, null],
    })

    const result = await replaceRequisitionItems(mock.db, "req-1", [
      row({ site_code: "FILIAL-INEXISTENTE" }),
    ])

    expect(result).toEqual({
      ok: false,
      error: "violates foreign key constraint",
    })
    expect(mock.insertCalls).toBe(2)
    expect(mock.inserted[1]).toEqual([previous])
  })

  it("deletes all lines when the new payload is empty", async () => {
    const mock = createMockDb({
      snapshot: [row()],
      insertErrors: [],
    })

    const result = await replaceRequisitionItems(mock.db, "req-1", [])
    expect(result).toEqual({ ok: true })
    expect(mock.insertCalls).toBe(0)
  })

  it("replaces lines when insert succeeds", async () => {
    const next = row({ material_description: "Novo" })
    const mock = createMockDb({
      snapshot: [row()],
      insertErrors: [null],
    })

    const result = await replaceRequisitionItems(mock.db, "req-1", [next])
    expect(result).toEqual({ ok: true })
    expect(mock.insertCalls).toBe(1)
    expect(mock.inserted[0]).toEqual([next])
  })
})
