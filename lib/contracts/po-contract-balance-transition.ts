/**
 * Espelha `trg_po_contract_balance_on_status_change` (migrations 082 + 085).
 * Usado para travar o comportamento em testes — o banco é a fonte de execução.
 */
export type ContractBalanceApplied = "reserved" | "consumed" | null

export type ContractBalanceAction =
  | "none"
  | "release"
  | "consume"
  | "reserve"
  | "unconsume"

const RESERVED_SOURCE_STATUSES = [
  "draft",
  "awaiting_approval",
  "sent",
  "error",
  "integration_error",
] as const

const RELEASE_OR_CANCEL_STATUSES = ["refused", "cancelled"] as const
const CONSUME_TARGET_STATUSES = ["processing", "completed"] as const

function includesStatus(
  list: readonly string[],
  status: string,
): boolean {
  return list.includes(status)
}

export function nextPoContractBalanceTransition(input: {
  oldStatus: string
  newStatus: string
  oldApplied: ContractBalanceApplied
  /** NEW.contract_balance_applied no UPDATE (em geral igual a oldApplied). */
  newApplied?: ContractBalanceApplied
}): { action: ContractBalanceAction; applied: ContractBalanceApplied } {
  const { oldStatus, newStatus, oldApplied } = input
  const newApplied = input.newApplied === undefined ? oldApplied : input.newApplied

  if (oldStatus === newStatus) {
    return { action: "none", applied: oldApplied }
  }

  if (
    includesStatus(RESERVED_SOURCE_STATUSES, oldStatus) &&
    includesStatus(RELEASE_OR_CANCEL_STATUSES, newStatus) &&
    oldApplied === "reserved"
  ) {
    return { action: "release", applied: null }
  }

  if (
    includesStatus(RESERVED_SOURCE_STATUSES, oldStatus) &&
    includesStatus(CONSUME_TARGET_STATUSES, newStatus) &&
    oldApplied === "reserved"
  ) {
    return { action: "consume", applied: "consumed" }
  }

  if (oldStatus === "refused" && newStatus === "sent" && newApplied === null) {
    return { action: "reserve", applied: "reserved" }
  }

  if (
    includesStatus(RELEASE_OR_CANCEL_STATUSES, newStatus) &&
    oldApplied === "consumed"
  ) {
    return { action: "unconsume", applied: null }
  }

  return { action: "none", applied: oldApplied }
}

/** Efeito em quantity_consumed de um item após unconsume de uma linha do PO. */
export function quantityConsumedAfterUnconsume(
  quantityConsumed: number,
  poLineQuantity: number,
): number {
  return Math.max(0, quantityConsumed - poLineQuantity)
}
