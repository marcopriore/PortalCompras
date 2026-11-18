/**
 * Who may resolve Auth emails via POST /api/get-user-email.
 *
 * After activate-tenant, a supplier profile shares the buyer's company_id.
 * Profiles RLS then allows listing every tenant user; without this guard the
 * supplier can dump comprador/solicitante/admin emails via service role.
 */
export function canLookupUserEmail(params: {
  callerProfileType: string | null | undefined
  callerCompanyId: string | null | undefined
  targetCompanyId: string | null | undefined
}): boolean {
  const callerCompanyId = params.callerCompanyId?.trim() ?? ""
  const targetCompanyId = params.targetCompanyId?.trim() ?? ""
  if (!callerCompanyId || callerCompanyId !== targetCompanyId) return false
  if (params.callerProfileType === "supplier") return false
  return true
}
