import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const sql = readFileSync(
  resolve(__dirname, "../../supabase/migrations/085_supplier_quotation_portal_rls.sql"),
  "utf8",
)

describe("085 supplier quotation portal RLS", () => {
  it("restores supplier read of invited quotation items", () => {
    expect(sql).toContain("Supplier reads quotation_items of invited quotations")
    expect(sql).toContain("quotation_suppliers")
  })

  it("allows supplier write only on invited/submitted proposals", () => {
    expect(sql).toContain("Supplier inserts own quotation_proposals")
    expect(sql).toContain("Supplier updates own quotation_proposals")
    expect(sql).toContain("status IN ('invited', 'submitted')")
    expect(sql).not.toMatch(/status IN \([^)]*selected/)
  })

  it("scopes proposal_items to the supplier's own proposal", () => {
    expect(sql).toContain("Supplier reads own proposal_items")
    expect(sql).toContain("Supplier inserts own proposal_items")
    expect(sql).toContain("Supplier updates own proposal_items")
    expect(sql).toContain("get_my_supplier_id()")
  })

  it("restores supplier read of own cadastro and categories", () => {
    expect(sql).toContain("Supplier reads own supplier row")
    expect(sql).toContain("Supplier reads own supplier_categories")
  })
})
