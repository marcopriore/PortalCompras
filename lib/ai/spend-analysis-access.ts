/**
 * Análise de Spend (dashboard comprador) usa service role e lê pedidos,
 * itens e cotações do tenant. Perfis de fornecedor compartilham
 * `company_id` com o comprador — não podem chamar esta API.
 */
export function isSpendAnalysisCallerAllowed(input: {
  profileType: string | null | undefined
  isSuperAdmin?: boolean | null
}): boolean {
  if (input.isSuperAdmin) return true
  return input.profileType === "buyer"
}
