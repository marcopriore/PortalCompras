import { describe, expect, it } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  buildQuotationItemInsertRows,
  quotationItemsNeedDefaultSiteCode,
  replaceQuotationItems,
  resolveQuotationItemSiteCode,
} from "@/lib/quotations/quotation-items-persist"

describe("resolveQuotationItemSiteCode", () => {
  it("keeps an existing site_code", () => {
    expect(resolveQuotationItemSiteCode("FILIAL-01", "MATRIZ")).toBe("FILIAL-01")
  })

  it("falls back to default when missing or blank", () => {
    expect(resolveQuotationItemSiteCode(null, "MATRIZ")).toBe("MATRIZ")
    expect(resolveQuotationItemSiteCode(undefined, "MATRIZ")).toBe("MATRIZ")
    expect(resolveQuotationItemSiteCode("  ", "MATRIZ")).toBe("MATRIZ")
  })
})

describe("quotationItemsNeedDefaultSiteCode", () => {
  it("is false when every item already has a site_code", () => {
    expect(
      quotationItemsNeedDefaultSiteCode([
        { site_code: "MATRIZ" },
        { site_code: "FILIAL-01" },
      ]),
    ).toBe(false)
  })

  it("is true when any catalog line is missing site_code", () => {
    expect(
      quotationItemsNeedDefaultSiteCode([
        { site_code: "MATRIZ" },
        { site_code: null },
      ]),
    ).toBe(true)
  })
})

describe("buildQuotationItemInsertRows", () => {
  it("never emits null site_code and preserves branch from the source item", () => {
    const rows = buildQuotationItemInsertRows(
      "co-1",
      "q-1",
      [
        {
          material_code: "M1",
          material_description: "Parafuso",
          unit_of_measure: "UN",
          quantity: 2,
          site_code: "FILIAL-01",
        },
        {
          material_code: "M2",
          material_description: "Porca",
          unit_of_measure: "UN",
          quantity: 1,
        },
      ],
      "MATRIZ",
    )

    expect(rows).toHaveLength(2)
    expect(rows[0].site_code).toBe("FILIAL-01")
    expect(rows[1].site_code).toBe("MATRIZ")
    expect(rows.every((row) => typeof row.site_code === "string" && row.site_code.length > 0)).toBe(
      true,
    )
  })
})

const catalogLine = {
  material_code: "M2",
  material_description: "Porca",
  unit_of_measure: "UN",
  quantity: 1,
  site_code: null as string | null,
}

describe("replaceQuotationItems", () => {
  it("does not delete existing lines when MATRIZ is missing and a line has no site_code", async () => {
    let deleted = false
    const db = {
      from(table: string) {
        if (table === "company_branches") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: async () => ({ data: null, error: null }),
                }),
              }),
            }),
          }
        }
        return {
          delete: () => {
            deleted = true
            return {
              eq: () => ({
                eq: async () => ({ error: null }),
              }),
            }
          },
        }
      },
    } as unknown as SupabaseClient

    const result = await replaceQuotationItems(db, {
      companyId: "co-1",
      quotationId: "q-1",
      items: [catalogLine],
    })

    expect(result.ok).toBe(false)
    expect(deleted).toBe(false)
  })

  it("restores the snapshot when insert fails after delete", async () => {
    const restored: unknown[] = []
    const snapshot = [
      {
        id: "old-1",
        quotation_id: "q-1",
        company_id: "co-1",
        material_code: "M1",
        material_description: "Parafuso",
        site_code: "MATRIZ",
      },
    ]

    const db = {
      from(table: string) {
        if (table === "company_branches") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: async () => ({ data: { code: "MATRIZ" }, error: null }),
                }),
              }),
            }),
          }
        }
        return {
          select: () => ({
            eq: () => ({
              eq: async () => ({ data: snapshot, error: null }),
            }),
          }),
          delete: () => ({
            eq: () => ({
              eq: async () => ({ error: null }),
            }),
          }),
          insert: async (rows: unknown) => {
            restored.push(rows)
            if (restored.length === 1) {
              return { error: { message: "null value in column site_code" } }
            }
            return { error: null }
          },
        }
      },
    } as unknown as SupabaseClient

    const result = await replaceQuotationItems(db, {
      companyId: "co-1",
      quotationId: "q-1",
      items: [catalogLine],
    })

    expect(result.ok).toBe(false)
    expect(restored).toHaveLength(2)
    expect(restored[1]).toEqual(snapshot)
  })
})
