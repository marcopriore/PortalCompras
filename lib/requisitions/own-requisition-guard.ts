import type { SupabaseClient } from "@supabase/supabase-js"

export const OWN_REQUISITION_ORDER_BLOCKED_MESSAGE =
  "Criador da Requisição não pode criar pedido/cotação"

/** True when the current user is the requester (criador) of the requisition. */
export function isOwnRequisitionCreator(
  userId: string | null | undefined,
  requesterId: string | null | undefined,
): boolean {
  if (!userId || !requesterId) return false
  return userId === requesterId
}

export type OwnRequisitionOrderGuardResult =
  | { blocked: false }
  | { blocked: true; ownCodes: string[]; queryFailed: boolean }

function uniqueRequisitionCodes(requisitionCodes: string[]): string[] {
  return [
    ...new Set(
      requisitionCodes
        .map((code) => code.trim())
        .filter((code) => code.length > 0),
    ),
  ]
}

/**
 * Returns requisition codes (among the given list) whose requester_id is the user.
 * Used in equalização where lines carry source_requisition_code.
 * Throws if the lookup fails — callers must fail closed, never treat an
 * error as "not the creator".
 */
export async function findOwnRequisitionCodes(
  supabase: SupabaseClient,
  companyId: string,
  userId: string,
  requisitionCodes: string[],
): Promise<string[]> {
  const codes = uniqueRequisitionCodes(requisitionCodes)
  if (codes.length === 0) return []

  const { data, error } = await supabase
    .from("requisitions")
    .select("code, requester_id")
    .eq("company_id", companyId)
    .eq("requester_id", userId)
    .in("code", codes)

  if (error) {
    throw new Error(
      error.message || "Não foi possível verificar o criador da requisição.",
    )
  }

  return ((data ?? []) as { code: string }[])
    .map((row) => row.code)
    .filter(Boolean)
}

/**
 * Fail-closed SoD check before creating a PO/contract from quotation lines.
 * Query errors block the action (treat as own REQ) so a lookup failure cannot
 * let the requester generate the order.
 */
export async function evaluateOwnRequisitionOrderGuard(
  supabase: SupabaseClient,
  companyId: string,
  userId: string,
  requisitionCodes: string[],
): Promise<OwnRequisitionOrderGuardResult> {
  const codes = uniqueRequisitionCodes(requisitionCodes)
  if (codes.length === 0) return { blocked: false }

  try {
    const ownCodes = await findOwnRequisitionCodes(
      supabase,
      companyId,
      userId,
      codes,
    )
    if (ownCodes.length === 0) return { blocked: false }
    return { blocked: true, ownCodes, queryFailed: false }
  } catch {
    return { blocked: true, ownCodes: codes, queryFailed: true }
  }
}

export function formatOwnRequisitionBlockedMessage(codes: string[]): string {
  if (codes.length === 0) return OWN_REQUISITION_ORDER_BLOCKED_MESSAGE
  return `${OWN_REQUISITION_ORDER_BLOCKED_MESSAGE} (${codes.join(", ")})`
}
