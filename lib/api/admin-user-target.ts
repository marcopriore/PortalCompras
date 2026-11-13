export type AdminUserTarget = {
  company_id: string | null
  is_superadmin: boolean | null
}

export type AdminUserTargetResult =
  | { ok: true }
  | { ok: false; status: 403 | 404; error: string }

/**
 * Tenant admin may only act on users of the active tenant.
 * Only a superadmin may reset another superadmin.
 */
export function assertAdminUserTarget(params: {
  actorCompanyId: string
  actorIsSuperAdmin: boolean
  target: AdminUserTarget | null
}): AdminUserTargetResult {
  if (!params.target) {
    return { ok: false, status: 404, error: "Usuário não encontrado" }
  }
  if (
    !params.target.company_id ||
    params.target.company_id !== params.actorCompanyId
  ) {
    return { ok: false, status: 403, error: "Forbidden" }
  }
  if (params.target.is_superadmin && !params.actorIsSuperAdmin) {
    return { ok: false, status: 403, error: "Forbidden" }
  }
  return { ok: true }
}
