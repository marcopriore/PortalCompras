import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const MIGRATION = "085_protect_profile_privileged_columns.sql"

/** Campos que a sessão authenticated não pode alterar no próprio perfil. */
const PROFILE_PRIVILEGED_COLUMNS = [
  "company_id",
  "is_superadmin",
  "role",
  "roles",
  "profile_type",
  "supplier_id",
  "is_supplier_admin",
  "status",
  "cost_center_id",
  "login_cnpj",
] as const

describe("protect profile privileged columns", () => {
  const sql = readFileSync(
    resolve(__dirname, "../../supabase/migrations", MIGRATION),
    "utf8",
  )

  it("blocks authenticated sessions from changing identity and privilege columns", () => {
    expect(sql).toContain("IF auth.uid() IS NULL THEN")
    expect(sql).toContain("trg_protect_profile_privileged_columns")
    expect(sql).toContain("BEFORE UPDATE ON public.profiles")

    for (const column of PROFILE_PRIVILEGED_COLUMNS) {
      expect(sql).toContain(`NEW.${column} IS DISTINCT FROM OLD.${column}`)
    }
  })

  it("does not restrict cosmetic self-updates used by Configurações", () => {
    for (const allowed of ["full_name", "avatar_url", "job_title", "department", "phone"]) {
      expect(sql).not.toContain(`NEW.${allowed} IS DISTINCT FROM OLD.${allowed}`)
    }
  })
})
