import type { ContractStatus } from "@/types/contracts"

/** Create always starts as draft — active only via supplier accept. */
export const BUYER_CREATED_CONTRACT_STATUS: ContractStatus = "draft"

const BUYER_PATCHABLE_CONTRACT_STATUSES = new Set<ContractStatus>([
  "draft",
  "expired",
  "cancelled",
])

/**
 * Statuses the buyer PATCH API may set.
 * `active` is only via `/api/contracts/[id]/accept`.
 * `pending_acceptance` is only via `/api/contracts/[id]/send-for-acceptance`.
 */
export function isBuyerWritableContractStatus(
  status: string,
): status is "draft" | "expired" | "cancelled" {
  return BUYER_PATCHABLE_CONTRACT_STATUSES.has(status as ContractStatus)
}
