import type { SupabaseClient } from "@supabase/supabase-js"

export const OWN_REQUISITION_ORDER_BLOCKED_MESSAGE =
  "Criador da Requisição não pode criar pedido/cotação"

export const REQUISITION_NOT_AVAILABLE_FOR_QUOTATION_MESSAGE =
  "A requisição não está aprovada ou já possui pedido/cotação."

/** True when the current user is the requester (criador) of the requisition. */
export function isOwnRequisitionCreator(
  userId: string | null | undefined,
  requesterId: string | null | undefined,
): boolean {
  if (!userId || !requesterId) return false
  return userId === requesterId
}

/**
 * Only an approved REQ without quotation/PO cycle may be linked to a new RFQ.
 * Also enforces SoD: the requester cannot open the quotation for their own REQ.
 */
export function isRequisitionAvailableForQuotation(
  row: {
    status?: string | null
    quotation_id?: string | null
    requester_id?: string | null
  },
  userId?: string | null,
): boolean {
  if (isOwnRequisitionCreator(userId, row.requester_id)) return false
  if (row.quotation_id) return false
  return row.status === "approved"
}

/**
 * Returns requisition codes (among the given list) whose requester_id is the user.
 * Used in equalização where lines carry source_requisition_code.
 */
export async function findOwnRequisitionCodes(
  supabase: SupabaseClient,
  companyId: string,
  userId: string,
  requisitionCodes: string[],
): Promise<string[]> {
  const codes = [
    ...new Set(
      requisitionCodes
        .map((code) => code.trim())
        .filter((code) => code.length > 0),
    ),
  ]
  if (codes.length === 0) return []

  const { data, error } = await supabase
    .from("requisitions")
    .select("code, requester_id")
    .eq("company_id", companyId)
    .eq("requester_id", userId)
    .in("code", codes)

  if (error) return []

  return ((data ?? []) as { code: string }[])
    .map((row) => row.code)
    .filter(Boolean)
}
