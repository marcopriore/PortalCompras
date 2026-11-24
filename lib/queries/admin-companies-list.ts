import { queryOptions } from "@tanstack/react-query"
import type { SupabaseClient } from "@supabase/supabase-js"
import { queryKeys } from "@/lib/queries/keys"
import type { SupabaseClientFactory } from "@/lib/queries/payment-conditions"

export type AdminCompanyRow = {
  id: string
  name: string
  cnpj: string | null
  status: string
  created_at: string
}

export type AdminCompaniesListDto = {
  companies: AdminCompanyRow[]
  totalProfiles: number
}

export async function fetchAdminCompaniesList(
  supabase: SupabaseClient,
): Promise<AdminCompaniesListDto> {
  const [{ data, error }, { count, error: usersError }] = await Promise.all([
    supabase
      .from("companies")
      .select("id, name, cnpj, status, created_at")
      .order("created_at", { ascending: false }),
    supabase.from("profiles").select("*", { count: "exact", head: true }),
  ])

  if (error) {
    throw error
  }
  if (usersError) {
    throw usersError
  }

  return {
    companies: (data ?? []) as AdminCompanyRow[],
    totalProfiles: count ?? 0,
  }
}

export function adminCompaniesListQueryOptions(
  supabaseFactory: SupabaseClientFactory,
) {
  return queryOptions({
    queryKey: queryKeys.adminCompaniesList(),
    queryFn: () => fetchAdminCompaniesList(supabaseFactory()),
  })
}

export type AdminCompanyOption = { id: string; name: string }

export async function fetchAdminCompanyOptions(
  supabase: SupabaseClient,
): Promise<AdminCompanyOption[]> {
  const { data, error } = await supabase
    .from("companies")
    .select("id, name")
    .order("name")

  if (error) {
    throw error
  }
  return (data ?? []) as AdminCompanyOption[]
}

export function adminCompanyOptionsQueryOptions(
  supabaseFactory: SupabaseClientFactory,
) {
  return queryOptions({
    queryKey: queryKeys.adminCompanyOptions(),
    queryFn: () => fetchAdminCompanyOptions(supabaseFactory()),
  })
}