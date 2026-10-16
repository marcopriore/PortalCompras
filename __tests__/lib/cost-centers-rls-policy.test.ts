import { readFileSync } from "fs"
import { resolve } from "path"
import { describe, expect, it } from "vitest"

const sql = readFileSync(
  resolve(
    __dirname,
    "../../supabase/migrations/085_cost_centers_buyer_write_rls.sql",
  ),
  "utf8",
)

describe("cost_centers RLS 085", () => {
  it("grava cadastro só com profile_type buyer", () => {
    expect(sql).toContain('CREATE POLICY "company_manage_cost_centers"')
    expect(sql).toMatch(/p\.profile_type = 'buyer'/)
    expect(sql).toMatch(/FOR ALL/)
  })

  it("mantém SELECT do requisitante para o picklist", () => {
    expect(sql).toContain('CREATE POLICY "cost_centers: requester le tenant"')
    expect(sql).toMatch(/p\.profile_type = 'requester'/)
    expect(sql).toMatch(/FOR SELECT/)
  })

  it("não concede escrita a supplier/requester via company_id solto", () => {
    const writeBlock = sql.slice(
      sql.indexOf('CREATE POLICY "company_manage_cost_centers"'),
      sql.indexOf('CREATE POLICY "cost_centers: requester le tenant"'),
    )
    expect(writeBlock).toContain("p.profile_type = 'buyer'")
    expect(writeBlock).not.toContain("profile_type IN")
    expect(writeBlock).not.toContain("supplier")
  })
})
