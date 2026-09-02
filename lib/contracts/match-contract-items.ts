import {
  contractItemAvailableQuantity,
  contractItemAvailableValue,
  isContractEligibleForPurchaseOrder,
} from "@/lib/contracts/contract-balance-helpers"
import type { Contract, ContractItem, ContractKind } from "@/types/contracts"

export type QuotationItemMatchInput = {
  quotationItemId: string
  materialCode: string
  quantity: number
  supplierId: string
}

export type ContractMatchCandidate = {
  contractId: string
  contractCode: string
  contractTitle: string
  contractKind: ContractKind
  supplierId: string
  contractItemId: string
  materialCode: string
  materialDescription: string
  unitPrice: number
  availableQuantity: number
  availableValue: number
  lineNumber: number
  matchScore: number
  matchReason: "quotation_item_id" | "material_code"
}

export type EqualizacaoContractLink = {
  contractId: string
  contractItemId: string
  contractCode: string
  contractKind: ContractKind
  unitPrice: number
  lineNumber: number
}

function normalizeMaterialCode(code: string): string {
  return code.trim().toLowerCase()
}

function contractItemLineNumber(
  items: ContractItem[],
  contractItemId: string,
): number {
  const active = items
    .filter((i) => !i.eliminated)
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
  const idx = active.findIndex((i) => i.id === contractItemId)
  return idx >= 0 ? idx + 1 : 0
}

function hasAvailableBalance(
  contract: Contract,
  item: ContractItem,
  requestedQty: number,
): boolean {
  if (item.eliminated) return false
  if (contract.contract_kind === "por_quantidade") {
    return contractItemAvailableQuantity(item) >= requestedQty
  }
  const lineValue = requestedQty * item.unit_price
  return contractItemAvailableValue(item) >= lineValue
}

export function findContractMatchesForQuotationItem(
  quotationId: string,
  input: QuotationItemMatchInput,
  contracts: Contract[],
): ContractMatchCandidate[] {
  const candidates: ContractMatchCandidate[] = []
  const normalizedCode = normalizeMaterialCode(input.materialCode)

  for (const contract of contracts) {
    if (contract.supplier_id !== input.supplierId) continue
    if (!isContractEligibleForPurchaseOrder(contract)) continue

    const items = contract.items ?? []
    for (const item of items) {
      if (item.eliminated) continue

      let matchReason: ContractMatchCandidate["matchReason"] | null = null
      let matchScore = 0

      if (
        item.quotation_item_id &&
        item.quotation_item_id === input.quotationItemId
      ) {
        matchReason = "quotation_item_id"
        matchScore = 100
      } else if (
        normalizedCode &&
        normalizeMaterialCode(item.material_code) === normalizedCode
      ) {
        matchReason = "material_code"
        matchScore = 50
      }

      if (!matchReason) continue
      if (!hasAvailableBalance(contract, item, input.quantity)) continue

      if (contract.quotation_id === quotationId) {
        matchScore += 20
      }

      candidates.push({
        contractId: contract.id,
        contractCode: contract.code,
        contractTitle: contract.title,
        contractKind: contract.contract_kind,
        supplierId: contract.supplier_id,
        contractItemId: item.id,
        materialCode: item.material_code,
        materialDescription: item.material_description,
        unitPrice: item.unit_price,
        availableQuantity: contractItemAvailableQuantity(item),
        availableValue: contractItemAvailableValue(item),
        lineNumber: contractItemLineNumber(items, item.id),
        matchScore,
        matchReason,
      })
    }
  }

  return candidates.sort((a, b) => {
    if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore
    return a.contractCode.localeCompare(b.contractCode)
  })
}

export function findContractMatchesForQuotationItems(
  quotationId: string,
  inputs: QuotationItemMatchInput[],
  contracts: Contract[],
): Map<string, ContractMatchCandidate[]> {
  const activeContracts = contracts.filter((c) => c.status === "active")
  const result = new Map<string, ContractMatchCandidate[]>()
  for (const input of inputs) {
    result.set(
      input.quotationItemId,
      findContractMatchesForQuotationItem(quotationId, input, activeContracts),
    )
  }
  return result
}

export function pickBestContractMatch(
  candidates: ContractMatchCandidate[],
): ContractMatchCandidate | null {
  return candidates[0] ?? null
}

export function contractLinkFromMatch(
  match: ContractMatchCandidate,
): EqualizacaoContractLink {
  return {
    contractId: match.contractId,
    contractItemId: match.contractItemId,
    contractCode: match.contractCode,
    contractKind: match.contractKind,
    unitPrice: match.unitPrice,
    lineNumber: match.lineNumber,
  }
}

/** v1: um pedido não pode misturar mais de um contrato nas linhas vinculadas. */
export function validateSingleContractPerOrder(
  contractIds: Array<string | null | undefined>,
): string | null {
  const linked = new Set(
    contractIds.filter((id): id is string => Boolean(id)),
  )
  if (linked.size > 1) {
    return "Um pedido não pode vincular itens de contratos diferentes (v1)"
  }
  return null
}

/** Assinatura estável para evitar refetch quando só a referência do array muda. */
export function contractMatchSelectionsSignature(
  selections: QuotationItemMatchInput[],
): string {
  if (selections.length === 0) return ""
  return selections
    .map(
      (s) =>
        `${s.quotationItemId}\0${s.supplierId}\0${s.materialCode}\0${s.quantity}`,
    )
    .sort()
    .join("\n")
}
