import { queryOptions } from "@tanstack/react-query"
import type { ContractMatchCandidate } from "@/lib/contracts/match-contract-items"
import type { EqualizacaoContractLink } from "@/lib/contracts/match-contract-items"
import { queryKeys } from "@/lib/queries/keys"

export type EqualizacaoContractMatchSelection = {
  quotationItemId: string
  supplierId: string
  materialCode: string
  quantity: number
}

export type EqualizacaoContractMatchApiItem = {
  quotationItemId: string
  candidates: ContractMatchCandidate[]
  suggested: EqualizacaoContractLink | null
}

function selectionsCacheKey(
  selections: EqualizacaoContractMatchSelection[],
): string {
  return selections
    .map((s) => `${s.quotationItemId}:${s.supplierId}`)
    .sort()
    .join("|")
}

export async function fetchEqualizacaoContractMatchesDialog(
  quotationId: string,
  selections: EqualizacaoContractMatchSelection[],
): Promise<EqualizacaoContractMatchApiItem[]> {
  const res = await fetch(`/api/quotations/${quotationId}/contract-matches`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ selections }),
  })
  const data = (await res.json()) as {
    items?: EqualizacaoContractMatchApiItem[]
    error?: string
  }
  if (!res.ok) {
    throw new Error(data.error ?? "Não foi possível buscar contratos")
  }
  return data.items ?? []
}

export function equalizacaoContractMatchesDialogQueryOptions(
  quotationId: string,
  selections: EqualizacaoContractMatchSelection[],
  open: boolean,
) {
  const selectionsKey = selectionsCacheKey(selections)
  return queryOptions({
    queryKey: queryKeys.equalizacaoContractMatchesDialog(
      quotationId,
      selectionsKey,
    ),
    queryFn: () =>
      fetchEqualizacaoContractMatchesDialog(quotationId, selections),
    enabled: open && Boolean(quotationId) && selections.length > 0,
  })
}