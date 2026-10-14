import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const MIGRATION = "supabase/migrations/086_company_branches_rls.sql"

/** Espelha a migration 086: quem pode ler vs gravar company_branches via JWT. */
export const COMPANY_BRANCHES_READ_PROFILE_TYPES = ["buyer", "requester"] as const
export const COMPANY_BRANCHES_WRITE_PROFILE_TYPES = ["buyer"] as const

describe("company_branches RLS (migration 086)", () => {
  const sql = readFileSync(resolve(process.cwd(), MIGRATION), "utf8")

  it("drops the unscoped FOR ALL policy from 078", () => {
    expect(sql).toContain('DROP POLICY IF EXISTS "company_manage_branches"')
  })

  it("allows buyer and requester to read, not supplier", () => {
    expect(sql).toMatch(/p\.profile_type IN \('buyer', 'requester'\)/)
    expect(COMPANY_BRANCHES_READ_PROFILE_TYPES).toEqual(["buyer", "requester"])
    expect(COMPANY_BRANCHES_READ_PROFILE_TYPES).not.toContain("supplier")
  })

  it("restricts insert/update/delete to buyer (not supplier or requester)", () => {
    expect(sql).toContain('CREATE POLICY "company_branches: buyer write"')
    expect(sql).toContain('CREATE POLICY "company_branches: buyer update"')
    expect(sql).toContain('CREATE POLICY "company_branches: buyer delete"')
    expect(sql).toMatch(/FOR INSERT/)
    expect(sql).toMatch(/FOR UPDATE/)
    expect(sql).toMatch(/FOR DELETE/)
    const writeClauses = sql.match(/p\.profile_type = 'buyer'/g) ?? []
    expect(writeClauses.length).toBeGreaterThanOrEqual(3)
    expect(COMPANY_BRANCHES_WRITE_PROFILE_TYPES).toEqual(["buyer"])
    expect(COMPANY_BRANCHES_WRITE_PROFILE_TYPES).not.toContain("supplier")
    expect(COMPANY_BRANCHES_WRITE_PROFILE_TYPES).not.toContain("requester")
  })
})
