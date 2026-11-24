import { queryOptions } from "@tanstack/react-query"
import type { SupabaseClient } from "@supabase/supabase-js"
import { formatResponsibleName } from "@/lib/quotations/ownership"
import { queryKeys } from "@/lib/queries/keys"
import type { SupabaseClientFactory } from "@/lib/queries/payment-conditions"
import type { Contract, ContractAcceptance } from "@/types/contracts"

export type ContractDetailDto = {
  contract: Contract
  responsibleName: string
  acceptances: ContractAcceptance[]
}

export async function fetchContractDetail(
  id: string,
  supabase: SupabaseClient,
): Promise<ContractDetailDto | null> {
  const [contractRes, accRes] = await Promise.all([
    fetch(`/api/contracts/${id}`),
    fetch(`/api/contracts/${id}/acceptances`),
  ])

  const data = (await contractRes.json()) as {
    contract?: Contract
    error?: string
  }

  if (!contractRes.ok || !data.contract) {
    return null
  }

  const contract = data.contract

  let responsibleName = "—"
  if (contract.created_by) {
    const { data: ownerProfile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", contract.created_by)
      .maybeSingle()
    responsibleName = formatResponsibleName(
      (ownerProfile as { full_name?: string | null } | null)?.full_name,
    )
  }

  let acceptances: ContractAcceptance[] = []
  if (accRes.ok) {
    const accData = (await accRes.json()) as {
      acceptances?: ContractAcceptance[]
    }
    acceptances = Array.isArray(accData.acceptances) ? accData.acceptances : []
  }

  return { contract, responsibleName, acceptances }
}

export function contractDetailQueryOptions(
  companyId: string,
  id: string,
  supabaseFactory: SupabaseClientFactory,
) {
  return queryOptions({
    queryKey: queryKeys.contractDetail(companyId, id),
    queryFn: () => fetchContractDetail(id, supabaseFactory()),
    enabled: Boolean(companyId && id),
  })
}