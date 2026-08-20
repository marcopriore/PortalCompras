import { createHash } from "crypto"
import type { OutboundIntegrationAction } from "@/lib/integrations/types"

/** Marcador de log pendente — usado na trava de concorrência (migration 046). */
export const OUTBOUND_DISPATCH_IN_PROGRESS = "Em andamento"

/** Após este tempo, um log "Em andamento" é considerado órfão e liberado. */
export const OUTBOUND_IN_FLIGHT_STALE_MS = 180_000

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

/** Próximo número de tentativa a partir do maior `attempts` já registrado. */
export function nextOutboundAttempt(priorAttempts: number | null | undefined): number {
  const n = Number(priorAttempts ?? 0)
  if (!Number.isFinite(n) || n < 0) return 1
  return Math.floor(n) + 1
}

export function isOutboundInFlightConflict(error: {
  code?: string
  message?: string
} | null): boolean {
  if (!error) return false
  if (error.code === "23505") return true
  const msg = (error.message ?? "").toLowerCase()
  return msg.includes("idx_integration_delivery_logs_inflight") || msg.includes("duplicate key")
}
