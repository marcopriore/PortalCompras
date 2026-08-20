import type { NextRequest, NextResponse } from "next/server"

const AUTO_RETRY_COOKIE = "valore_proxy_outbound_auto_retry"

/** Cooldown curto: backoff mínimo do auto-retry é 1 min. */
export const OUTBOUND_AUTO_RETRY_PROXY_COOLDOWN_MS = 45_000

let lastAutoRetryAt = 0

export function shouldRunOutboundAutoRetry(
  request: NextRequest,
  cooldownMs: number = OUTBOUND_AUTO_RETRY_PROXY_COOLDOWN_MS,
): boolean {
  const now = Date.now()

  if (now - lastAutoRetryAt < cooldownMs) {
    return false
  }

  const cookieValue = request.cookies.get(AUTO_RETRY_COOKIE)?.value
  if (cookieValue) {
    const cookieTs = Number(cookieValue)
    if (!Number.isNaN(cookieTs) && now - cookieTs < cooldownMs) {
      return false
    }
  }

  return true
}

export function markOutboundAutoRetryRun(
  response: NextResponse,
  cooldownMs: number = OUTBOUND_AUTO_RETRY_PROXY_COOLDOWN_MS,
): void {
  const now = Date.now()
  lastAutoRetryAt = now
  response.cookies.set(AUTO_RETRY_COOKIE, String(now), {
    path: "/",
    maxAge: Math.ceil(cooldownMs / 1000),
    sameSite: "lax",
    httpOnly: true,
  })
}
