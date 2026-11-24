import { queryOptions } from "@tanstack/react-query"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Contract } from "@/types/contracts"
import { queryKeys } from "@/lib/queries/keys"
import { enrichProfileNames } from "@/lib/queries/enrich-profile-names"

export type ContractListRow = Contract & { responsible_name?: string }

export async function fetchContractsList(
  supabase: SupabaseClient,
): Promise<ContractListRow[]> {
  const res = await fetch("/api/contracts", { cache: "no-store" })
  const data = (await res.json()) as { contracts?: Contract[]; error?: string }

  if (!res.ok) {
    throw new Error(data.error ?? "Erro ao carregar contratos")
  }

  const rows = data.contracts ?? []
  const ownerIds = [
    ...new Set(
      rows
        .map((c) => c.created_by)
        .filter((id): id is string => Boolean(id)),
    ),
  ]

  const nameById = await enrichProfileNames(supabase, ownerIds)

  return rows.map((c) => ({
    ...c,
    responsible_name: c.created_by ? nameById.get(c.created_by) ?? "" : "",
  }))
}

export function contractsListQueryOptions(
  supabase: SupabaseClient,
  companyId: string,
) {
  return queryOptions({
    queryKey: queryKeys.contractsList(companyId),
    queryFn: () => fetchContractsList(supabase),
  })
}