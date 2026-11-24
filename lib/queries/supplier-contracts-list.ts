import { queryOptions } from "@tanstack/react-query"
import type { Contract } from "@/types/contracts"
import { queryKeys } from "@/lib/queries/keys"

export async function fetchSupplierContractsList(): Promise<Contract[]> {
  const res = await fetch("/api/contracts/supplier")
  const data = (await res.json()) as {
    contracts?: Contract[]
    error?: string
  }
  if (!res.ok) {
    throw new Error(data.error ?? "Não foi possível carregar contratos.")
  }
  return Array.isArray(data.contracts) ? data.contracts : []
}

export function supplierContractsListQueryOptions(
  companyId: string,
  supplierId: string,
) {
  return queryOptions({
    queryKey: queryKeys.supplierContractsList(companyId, supplierId),
    queryFn: fetchSupplierContractsList,
    enabled: Boolean(companyId && supplierId),
  })
}