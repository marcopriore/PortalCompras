/**
 * APIs that criam/reservam pedido com service role (ex.: PO a partir de contrato).
 * Solicitante e fornecedor não podem usar — o catálogo tem caminho próprio (`catalog.order`).
 */
export function canUseBuyerOrderApi(
  profileType: string | null | undefined,
  isSuperAdmin: boolean,
): boolean {
  if (isSuperAdmin) return true
  return profileType === "buyer"
}
