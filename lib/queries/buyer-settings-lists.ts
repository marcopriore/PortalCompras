import { queryOptions } from "@tanstack/react-query"
import type { SupabaseClient } from "@supabase/supabase-js"
import { queryKeys } from "@/lib/queries/keys"
import type { SupabaseClientFactory } from "@/lib/queries/payment-conditions"
import type { CompanyBranch } from "@/lib/branches/types"
import type { CostCenter } from "@/components/comprador/cost-centers-settings"
import type { Category } from "@/components/comprador/categories-settings"

export async function fetchCostCentersSettingsList(
  supabase: SupabaseClient,
  companyId: string,
): Promise<CostCenter[]> {
  const { data, error } = await supabase
    .from("cost_centers")
    .select("id, company_id, code, description, active, created_at")
    .eq("company_id", companyId)
    .order("code", { ascending: true })

  if (error) {
    throw error
  }
  return (data ?? []) as CostCenter[]
}

export function costCentersSettingsListQueryOptions(
  companyId: string,
  supabaseFactory: SupabaseClientFactory,
  enabled: boolean,
) {
  return queryOptions({
    queryKey: queryKeys.costCentersSettingsList(companyId),
    queryFn: () => fetchCostCentersSettingsList(supabaseFactory(), companyId),
    enabled: enabled && Boolean(companyId),
  })
}

export async function fetchCompanyBranchesSettingsList(
  supabase: SupabaseClient,
  companyId: string,
): Promise<CompanyBranch[]> {
  const { data, error } = await supabase
    .from("company_branches")
    .select(
      "id, company_id, code, name, address, city, state, zip_code, active, created_at",
    )
    .eq("company_id", companyId)
    .order("code", { ascending: true })

  if (error) {
    throw error
  }
  return (data ?? []) as CompanyBranch[]
}

export function companyBranchesSettingsListQueryOptions(
  companyId: string,
  supabaseFactory: SupabaseClientFactory,
  enabled: boolean,
) {
  return queryOptions({
    queryKey: queryKeys.companyBranchesSettingsList(companyId),
    queryFn: () =>
      fetchCompanyBranchesSettingsList(supabaseFactory(), companyId),
    enabled: enabled && Boolean(companyId),
  })
}

export async function fetchCategoriesSettingsList(
  supabase: SupabaseClient,
  companyId: string,
): Promise<Category[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("id, company_id, code, name, active, created_at")
    .eq("company_id", companyId)
    .order("name", { ascending: true })

  if (error) {
    throw error
  }
  return (data ?? []) as Category[]
}

export function categoriesSettingsListQueryOptions(
  companyId: string,
  supabaseFactory: SupabaseClientFactory,
  enabled: boolean,
) {
  return queryOptions({
    queryKey: queryKeys.categoriesSettingsList(companyId),
    queryFn: () => fetchCategoriesSettingsList(supabaseFactory(), companyId),
    enabled: enabled && Boolean(companyId),
  })
}