import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const MIGRATION = "supabase/migrations/088_account_assignments_rls.sql"

describe("account assignments RLS (migration 088)", () => {
  const sql = readFileSync(resolve(process.cwd(), MIGRATION), "utf8")

  it("drops the unscoped tenant FOR ALL policies from 066/068/070", () => {
    expect(sql).toContain(
      'DROP POLICY IF EXISTS "po_item_account_assignments: tenant insert"',
    )
    expect(sql).toContain(
      'DROP POLICY IF EXISTS "po_item_account_assignments: tenant update"',
    )
    expect(sql).toContain(
      'DROP POLICY IF EXISTS "po_item_account_assignments: tenant delete"',
    )
    expect(sql).toContain(
      'DROP POLICY IF EXISTS "req_item_account_assignments: tenant insert"',
    )
    expect(sql).toContain(
      'DROP POLICY IF EXISTS "req_item_account_assignments: tenant delete"',
    )
  })

  it("restricts PO assignment writes to profile_type buyer", () => {
    expect(sql).toContain(
      'CREATE POLICY "po_item_account_assignments: buyer gerencia tenant"',
    )
    const poStart = sql.indexOf(
      'CREATE POLICY "po_item_account_assignments: buyer gerencia tenant"',
    )
    const reqStart = sql.indexOf(
      'CREATE POLICY "req_item_account_assignments: buyer gerencia tenant"',
    )
    const poBlock = sql.slice(poStart, reqStart)
    expect(poBlock).toContain("p.profile_type = 'buyer'")
    expect(poBlock).toMatch(/FOR ALL/)
    expect(poBlock).not.toContain("profile_type IN")
    expect(poBlock).not.toContain("supplier")
  })

  it("keeps supplier SELECT on PO assignments (066)", () => {
    expect(sql).not.toContain(
      'DROP POLICY IF EXISTS "po_item_account_assignments: supplier select"',
    )
  })

  it("lets requester mutate only own REQ assignment rows", () => {
    expect(sql).toContain(
      'CREATE POLICY "req_item_account_assignments: requester own"',
    )
    expect(sql).toMatch(/p\.profile_type = 'requester'/)
    expect(sql).toMatch(/r\.requester_id = auth\.uid\(\)/)
    expect(sql).not.toMatch(/p\.profile_type = 'supplier'/)
  })
})
