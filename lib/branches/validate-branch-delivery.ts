import { formatBranchDeliveryAddress } from "@/lib/branches/format-branch-address"
import type { CompanyBranchAddressFields } from "@/lib/branches/types"

type BranchLookup = CompanyBranchAddressFields & { code?: string }

export function missingItemSiteCodeMessage(materialCode: string): string {
  return `Item ${materialCode} sem centro/filial. Atualize a cotação a partir da requisição.`
}

export function missingBranchDeliveryMessage(
  siteCode: string,
  branchCode?: string | null,
): string {
  return `Centro/filial sem endereço cadastrado (${branchCode ?? siteCode}). Atualize em Configurações.`
}

/** First site_code without a usable delivery address, or null if all are valid. */
export function findFirstMissingBranchDelivery(
  siteCodes: Iterable<string>,
  branchByCode: Map<string, BranchLookup>,
): string | null {
  for (const siteCode of siteCodes) {
    const branch = branchByCode.get(siteCode)
    if (!formatBranchDeliveryAddress(branch)) {
      return missingBranchDeliveryMessage(siteCode, branch?.code)
    }
  }
  return null
}
