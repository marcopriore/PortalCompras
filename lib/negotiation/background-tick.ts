import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { isTenantFeatureEnabled } from "@/lib/api/external/check-tenant-feature"
import { advanceNegotiationRun } from "@/lib/negotiation/motor"

const TICKABLE_RUN_STATUSES = [
  "pending",
  "running",
  "waiting_deadline",
  "analyzing",
  "opening_round",
  "awaiting_approval",
] as const

export type NegotiationBackgroundTickResult = {
  scanned: number
  ticked: number
  advanced: number
  skipped: number
  errors: number
}

/**
 * Avança execuções de negociação autônoma em background (proxy / job).
 * Idempotente quando não há ação pendente.
 */
export async function processNegotiationBackgroundTicks(): Promise<NegotiationBackgroundTickResult> {
  const db = createServiceRoleClient()
  const result: NegotiationBackgroundTickResult = {
    scanned: 0,
    ticked: 0,
    advanced: 0,
    skipped: 0,
    errors: 0,
  }

  const { data: runs, error } = await db
    .from("quotation_negotiation_runs")
    .select("id, company_id")
    .in("status", [...TICKABLE_RUN_STATUSES])
    .order("last_tick_at", { ascending: true, nullsFirst: true })
    .limit(40)

  if (error || !runs?.length) {
    return result
  }

  result.scanned = runs.length
  const featureCache = new Map<string, boolean>()

  for (const row of runs) {
    const companyId = String(row.company_id)
    const runId = String(row.id)

    let featureOk = featureCache.get(companyId)
    if (featureOk == null) {
      const [autonomous, negotiation] = await Promise.all([
        isTenantFeatureEnabled(companyId, "ai_negotiation_autonomous"),
        isTenantFeatureEnabled(companyId, "ai_negotiation"),
      ])
      featureOk = autonomous && negotiation
      featureCache.set(companyId, featureOk)
    }

    if (!featureOk) {
      result.skipped += 1
      continue
    }

    result.ticked += 1
    try {
      const tick = await advanceNegotiationRun(db, companyId, runId, {})
      if (!tick.ok) {
        result.errors += 1
        continue
      }
      if (tick.message !== "Nenhuma ação necessária.") {
        result.advanced += 1
      }
    } catch {
      result.errors += 1
    }
  }

  return result
}
