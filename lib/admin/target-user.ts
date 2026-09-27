/** Alvo de mutação de usuário deve ser do mesmo tenant e não superadmin. */
export function canManageTargetUser(
  target: { company_id?: string | null; is_superadmin?: boolean | null } | null,
  companyId: string,
): boolean {
  if (!target?.company_id || target.company_id !== companyId) return false
  if (target.is_superadmin) return false
  return true
}
