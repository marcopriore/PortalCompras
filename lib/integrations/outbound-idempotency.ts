import { createHash } from "crypto"
import type { OutboundIntegrationAction } from "@/lib/integrations/types"

/**
 * Chave estável por tenant + ação + entidade.
 * Reenvios do monitor reutilizam a mesma chave para o ERP deduplicar.
 */
export function buildOutboundIdempotencyKey(input: {
  companyId: string
  action: OutboundIntegrationAction
  entityId?: string | null
}): string {
  const raw = `${input.companyId}:${input.action}:${input.entityId ?? "none"}`
  return createHash("sha256").update(raw).digest("hex")
}
