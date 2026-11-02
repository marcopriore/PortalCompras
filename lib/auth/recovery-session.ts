/**
 * GoTrue recovery sessions include an AMR entry `{ method: "recovery" }`.
 * Password-reset completion must require that claim so a normal login
 * session cannot set a new password without the current one.
 */
export function accessTokenHasRecoveryAmr(
  accessToken: string | null | undefined,
): boolean {
  if (!accessToken) return false
  const payloadPart = accessToken.split(".")[1]
  if (!payloadPart) return false

  try {
    const json = Buffer.from(payloadPart, "base64url").toString("utf8")
    const payload = JSON.parse(json) as { amr?: unknown }
    if (!Array.isArray(payload.amr)) return false

    return payload.amr.some((entry) => {
      if (!entry || typeof entry !== "object") return false
      return (entry as { method?: unknown }).method === "recovery"
    })
  } catch {
    return false
  }
}
