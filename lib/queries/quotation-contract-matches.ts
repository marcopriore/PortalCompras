import { queryOptions } from "@tanstack/react-query"
import { contractMatchCellKey } from "@/components/comprador/contract-match-cell-indicator"
import type { ContractMatchCandidate } from "@/lib/contracts/match-contract-items"
import { queryKeys } from "@/lib/queries/keys"

export type ContractMatchSelectionInput = {
  quotationItemId: string
  supplierId: string
  materialCode: string
  quantity: number
}

export type ContractMatchMapRecord = Record<string, ContractMatchCandidate>

function selectionsCacheKey(selections: ContractMatchSelectionInput[]): string {
  return selections
    .map((s) => `${s.quotationItemId}:${s.supplierId}`)
    .sort()
    .join("|")
}

export async function fetchQuotationContractMatches(
  quotationId: string,
  selections: ContractMatchSelectionInput[],
): Promise<ContractMatchMapRecord> {
  const res = await fetch(`/api/quotations/${quotationId}/contract-matches`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ selections }),
  })
  const data = (await res.json()) as {
    items?: Array<{
      quotationItemId: string
      supplierId: string
      candidates?: ContractMatchCandidate[]
    }>
  }
  if (!res.ok) {
    return {}
  }

  const record: ContractMatchMapRecord = {}
  for (const row of data.items ?? []) {
    const best = row.candidates?.[0]
    if (!best) continue
    record[contractMatchCellKey(row.quotationItemId, row.supplierId)] = best
  }
  return record
}

export function quotationContractMatchesQueryOptions(
  quotationId: string,
  loadGeneration: number,
  selections: ContractMatchSelectionInput[],
) {
  const selectionsKey = selectionsCacheKey(selections)
  return queryOptions({
    queryKey: queryKeys.quotationContractMatches(
      quotationId,
      loadGeneration,
      selectionsKey,
    ),
    queryFn: () => fetchQuotationContractMatches(quotationId, selections),
    enabled: Boolean(quotationId) && selections.length > 0,
  })
}