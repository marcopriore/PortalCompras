/** Statuses that mean the buyer already ended the cotação. */
export function isTerminalQuotationStatus(
  status: string | null | undefined,
): boolean {
  return status === "completed" || status === "cancelled"
}

/**
 * What the autonomous negotiation tick must do when it sees the cotação status.
 * Closing/opening rounds without this check writes `analysis`/`waiting` over
 * a concluded or cancelled quotation and can invite suppliers again.
 */
export function negotiationActionForQuotationStatus(
  status: string | null | undefined,
): "continue" | "complete_run" | "cancel_run" {
  if (status === "cancelled") return "cancel_run"
  if (status === "completed") return "complete_run"
  return "continue"
}
