export type NewRoundEmailRequest = {
  quotationId: string
  roundNumber: number
  supplierUserIds: string[]
}

export type NewRoundRecipient = {
  userId: string
  supplierId: string
}

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

/** Rejects the old open-relay payload (`to` + `html`) and requires quotation context. */
export function parseNewRoundEmailRequest(
  body: unknown,
): { ok: true; value: NewRoundEmailRequest } | { ok: false; error: string } {
  if (!isRecord(body)) {
    return { ok: false, error: "Invalid payload" }
  }

  if (typeof body.to === "string" || typeof body.html === "string") {
    return { ok: false, error: "Invalid payload" }
  }

  const quotationId =
    typeof body.quotationId === "string" ? body.quotationId.trim() : ""
  const roundNumber = body.roundNumber
  const supplierUserIds = body.supplierUserIds

  if (!quotationId) {
    return { ok: false, error: "quotationId is required" }
  }
  if (
    typeof roundNumber !== "number" ||
    !Number.isInteger(roundNumber) ||
    roundNumber < 1
  ) {
    return { ok: false, error: "roundNumber is required" }
  }
  if (!Array.isArray(supplierUserIds)) {
    return { ok: false, error: "supplierUserIds is required" }
  }

  const ids = [
    ...new Set(
      supplierUserIds.filter(
        (id): id is string => typeof id === "string" && id.trim().length > 0,
      ),
    ),
  ].slice(0, 100)

  return {
    ok: true,
    value: { quotationId, roundNumber, supplierUserIds: ids },
  }
}

/**
 * Only supplier portal users whose supplier_id is invited on the quotation
 * may receive the canned new-round email.
 */
export function selectNewRoundRecipients(
  requestedUserIds: string[],
  invitedSupplierIds: string[],
  profiles: Array<{
    id: string
    supplier_id: string | null
    profile_type: string | null
  }>,
): NewRoundRecipient[] {
  const requested = new Set(requestedUserIds)
  const invited = new Set(invitedSupplierIds.filter(Boolean))
  const out: NewRoundRecipient[] = []

  for (const profile of profiles) {
    if (!requested.has(profile.id)) continue
    if (profile.profile_type !== "supplier") continue
    if (!profile.supplier_id || !invited.has(profile.supplier_id)) continue
    out.push({ userId: profile.id, supplierId: profile.supplier_id })
  }

  return out
}
