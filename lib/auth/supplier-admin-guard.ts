export const SUPPLIER_ADMIN_REQUIRED_MESSAGE =
  "Apenas o administrador do portal pode gerenciar usuários."

/** True when the actor may provision or reset other supplier-portal users. */
export function canManageSupplierPortalUsers(
  isSupplierAdmin: boolean | null | undefined,
): boolean {
  return Boolean(isSupplierAdmin)
}
