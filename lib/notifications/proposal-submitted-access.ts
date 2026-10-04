export type ProposalSubmittedCaller = {
  profileType: string | null | undefined
  supplierIds: Array<string | null | undefined>
}

export type ProposalSubmittedRow = {
  supplier_id: string | null
  status: string | null
} | null

/**
 * Only the invited supplier that actually submitted a proposal may notify
 * the buyer. Client-supplied names/codes are not part of this check.
 */
export function isAuthorizedProposalSubmittedNotifier(
  caller: ProposalSubmittedCaller,
  proposal: ProposalSubmittedRow,
): boolean {
  if (caller.profileType !== "supplier") return false
  if (!proposal?.supplier_id || proposal.status !== "submitted") return false

  const allowed = new Set(
    caller.supplierIds
      .map((id) => id?.trim())
      .filter((id): id is string => Boolean(id)),
  )
  return allowed.has(proposal.supplier_id)
}

export function proposalSubmittedNotifyFields(input: {
  quotationCode: string | null | undefined
  supplierName: string | null | undefined
  roundNumber: number | null | undefined
  totalPrice: number | null | undefined
}): {
  quotationCode: string
  supplierName: string
  roundNumber: number
  totalPrice: number
} {
  return {
    quotationCode: input.quotationCode?.trim() || "Cotação",
    supplierName: input.supplierName?.trim() || "Fornecedor",
    roundNumber:
      typeof input.roundNumber === "number" &&
      Number.isFinite(input.roundNumber) &&
      input.roundNumber > 0
        ? input.roundNumber
        : 1,
    totalPrice:
      typeof input.totalPrice === "number" && Number.isFinite(input.totalPrice)
        ? input.totalPrice
        : 0,
  }
}
