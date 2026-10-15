import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const MIGRATION = "supabase/migrations/087_requisition_items_rls.sql"

describe("requisition_items / attachments RLS (migration 087)", () => {
  const sql = readFileSync(resolve(process.cwd(), MIGRATION), "utf8")

  it("drops the unscoped FOR ALL policies from 073", () => {
    expect(sql).toContain(
      'DROP POLICY IF EXISTS "requisition_items: buyer gerencia tenant"',
    )
    expect(sql).toContain(
      'DROP POLICY IF EXISTS "requisition_attachments: buyer gerencia tenant"',
    )
  })

  it("restricts buyer write to profile_type buyer, not supplier", () => {
    expect(sql).toContain('CREATE POLICY "requisition_items: buyer gerencia tenant"')
    expect(sql).toContain(
      'CREATE POLICY "requisition_attachments: buyer gerencia tenant"',
    )
    const buyerClauses = sql.match(/p\.profile_type = 'buyer'/g) ?? []
    expect(buyerClauses.length).toBeGreaterThanOrEqual(4)
    expect(sql).not.toMatch(/p\.profile_type IN \('buyer',\s*'supplier'/)
  })

  it("lets requester mutate only own requisition rows, not supplier", () => {
    expect(sql).toContain('CREATE POLICY "requisition_items: requester own"')
    expect(sql).toContain('CREATE POLICY "requisition_attachments: requester own"')
    expect(sql).toMatch(/p\.profile_type = 'requester'/)
    expect(sql).toMatch(/r\.requester_id = auth\.uid\(\)/)
    expect(sql).not.toMatch(/p\.profile_type = 'supplier'/)
  })
})
