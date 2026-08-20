/** Falhas transitórias (rede / ERP fora) — elegíveis a auto-retry com backoff. */

export const OUTBOUND_AUTO_RETRY_MAX_ATTEMPTS = 4

/** Espera após a N-ésima tentativa falha (1-based), antes da próxima. */
export const OUTBOUND_AUTO_RETRY_BACKOFF_MS = [
  60_000,
  5 * 60_000,
  15 * 60_000,
] as const

const TRANSIENT_HTTP_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504])

const NON_TRANSIENT_MESSAGE_HINTS = [
  "nenhum endpoint",
  "falha ao registrar despacho",
  "não foi possível montar o payload",
]

export function isTransientOutboundFailure(input: {
  responseStatus: number | null
  errorMessage?: string | null
}): boolean {
  if (input.responseStatus != null) {
    return TRANSIENT_HTTP_STATUSES.has(input.responseStatus)
  }

  const msg = (input.errorMessage ?? "").toLowerCase()
  if (NON_TRANSIENT_MESSAGE_HINTS.some((hint) => msg.includes(hint))) {
    return false
  }

  // Timeout, DNS, conexão recusada, abort — sem HTTP de negócio
  return true
}

/** Delay até a próxima tentativa automática, ou null se esgotou. */
export function outboundAutoRetryDelayMs(afterAttempt: number): number | null {
  if (!Number.isFinite(afterAttempt) || afterAttempt < 1) return null
  if (afterAttempt >= OUTBOUND_AUTO_RETRY_MAX_ATTEMPTS) return null
  return OUTBOUND_AUTO_RETRY_BACKOFF_MS[afterAttempt - 1] ?? null
}

export function isOutboundAutoRetryExhausted(attempts: number): boolean {
  return Number.isFinite(attempts) && attempts >= OUTBOUND_AUTO_RETRY_MAX_ATTEMPTS
}

export function isOutboundAutoRetryDue(input: {
  attempts: number
  createdAt: string | Date
  now?: number
}): boolean {
  const delay = outboundAutoRetryDelayMs(input.attempts)
  if (delay == null) return false
  const createdMs =
    input.createdAt instanceof Date
      ? input.createdAt.getTime()
      : new Date(input.createdAt).getTime()
  if (Number.isNaN(createdMs)) return false
  const now = input.now ?? Date.now()
  return now >= createdMs + delay
}
