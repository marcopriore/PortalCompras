import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const migration = readFileSync(
  resolve(
    __dirname,
    "../../supabase/migrations/085_restrict_security_definer_rpcs.sql",
  ),
  "utf8",
)

const compact = migration.replace(/\s+/g, " ")

describe("085 restrict SECURITY DEFINER RPCs", () => {
  it("rejects anonymous catalog access instead of treating uid null as allow", () => {
    expect(compact).toMatch(/IF auth\.uid\(\) IS NULL THEN RAISE EXCEPTION/)
    expect(compact).not.toMatch(/IF auth\.uid\(\) IS NULL THEN RETURN/)
  })

  it("allows service_role and only buyer/requester of the tenant", () => {
    expect(migration).toContain("IF auth.role() = 'service_role' THEN")
    expect(migration).toContain("p.profile_type IN ('buyer', 'requester')")
  })

  it("revokes PUBLIC/anon execute on catalog and contract-balance RPCs", () => {
    const functions = [
      "public.assert_catalog_company_access(uuid)",
      "public.get_catalog_offers_page(uuid, text, text[], uuid[], integer, integer, text)",
      "public.get_catalog_offer_facets(uuid, text, text[], uuid[], text)",
      "public.reserve_contract_balance(uuid)",
      "public.release_contract_balance(uuid)",
      "public.consume_contract_balance(uuid)",
    ]

    for (const fn of functions) {
      expect(compact).toContain(
        `REVOKE ALL ON FUNCTION ${fn} FROM PUBLIC, anon, authenticated`,
      )
    }
  })

  it("grants contract-balance RPCs only to service_role", () => {
    expect(compact).toContain(
      "GRANT EXECUTE ON FUNCTION public.reserve_contract_balance(uuid) TO service_role",
    )
    expect(compact).toContain(
      "GRANT EXECUTE ON FUNCTION public.release_contract_balance(uuid) TO service_role",
    )
    expect(compact).toContain(
      "GRANT EXECUTE ON FUNCTION public.consume_contract_balance(uuid) TO service_role",
    )
    expect(compact).not.toMatch(
      /GRANT EXECUTE ON FUNCTION public\.release_contract_balance\(uuid\) TO authenticated/,
    )
  })
})
