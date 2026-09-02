import type { CompanyBranchAddressFields } from "@/lib/branches/types"

/** Formata endereço de entrega para cabeçalho do pedido. */
export function formatBranchDeliveryAddress(
  branch: CompanyBranchAddressFields | null | undefined,
): string {
  if (!branch) return ""

  const parts: string[] = []
  if (branch.address?.trim()) parts.push(branch.address.trim())

  const cityState = [branch.city?.trim(), branch.state?.trim()].filter(Boolean).join(" - ")
  if (cityState) parts.push(cityState)

  if (branch.zip_code?.trim()) {
    parts.push(`CEP ${branch.zip_code.trim()}`)
  }

  if (parts.length > 0) return parts.join(", ")

  return branch.name?.trim() || ""
}
