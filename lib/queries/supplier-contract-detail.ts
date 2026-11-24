import { queryOptions } from "@tanstack/react-query"
import type {
  Contract,
  ContractAcceptance,
} from "@/types/contracts"
import { queryKeys } from "@/lib/queries/keys"

export type SupplierContractTerms = {
  title: string
  content: string
  version: string
  version_date: string
}

export type SupplierContractDetailDto = {
  contract: Contract | null
  acceptances: ContractAcceptance[]
  supplierTerms: SupplierContractTerms | null
  companyName: string
  notFound: boolean
}

export async function fetchSupplierContractDetail(
  contractId: string,
): Promise<SupplierContractDetailDto> {
  const res = await fetch(`/api/contracts/${contractId}/supplier-view`)
  const data = (await res.json()) as {
    contract?: Contract
    acceptances?: ContractAcceptance[]
    supplierTerms?: SupplierContractTerms | null
    companyName?: string
    error?: string
  }

  if (res.status === 404) {
    return {
      contract: null,
      acceptances: [],
      supplierTerms: null,
      companyName: "",
      notFound: true,
    }
  }

  if (!res.ok || !data.contract) {
    throw new Error(data.error ?? "Não foi possível carregar o contrato.")
  }

  return {
    contract: data.contract,
    acceptances: Array.isArray(data.acceptances) ? data.acceptances : [],
    supplierTerms: data.supplierTerms ?? null,
    companyName: data.companyName?.trim() ?? "",
    notFound: false,
  }
}

export function supplierContractDetailQueryOptions(
  companyId: string,
  supplierId: string,
  contractId: string,
) {
  return queryOptions({
    queryKey: queryKeys.supplierContractDetail(
      companyId,
      supplierId,
      contractId,
    ),
    queryFn: () => fetchSupplierContractDetail(contractId),
    enabled: Boolean(companyId && supplierId && contractId),
  })
}