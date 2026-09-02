import type { SupabaseClient } from "@supabase/supabase-js"
import type { CompanyBranchAddressFields } from "@/lib/branches/types"

export type CompanyBranchRow = CompanyBranchAddressFields & {
  id: string
  code: string
  name: string
}

const BRANCH_SELECT = "id, code, name, address, city, state, zip_code"

/** Mapa site_code (company_branches.code) → filial. */
export async function loadCompanyBranchesByCode(
  db: SupabaseClient,
  companyId: string,
): Promise<Map<string, CompanyBranchRow>> {
  const { data } = await db
    .from("company_branches")
    .select(BRANCH_SELECT)
    .eq("company_id", companyId)

  const map = new Map<string, CompanyBranchRow>()
  for (const row of (data ?? []) as CompanyBranchRow[]) {
    map.set(row.code, row)
  }
  return map
}

export async function loadDefaultSiteCode(
  db: SupabaseClient,
  companyId: string,
): Promise<string | null> {
  const { data } = await db
    .from("company_branches")
    .select("code")
    .eq("company_id", companyId)
    .eq("code", "MATRIZ")
    .maybeSingle()

  return (data?.code as string | undefined) ?? null
}
