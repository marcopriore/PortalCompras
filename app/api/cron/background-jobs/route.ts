import { NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import {
  markScheduledJobRun,
  notifyExpiredContracts,
  notifyExpiringSoonContracts,
  notifyLowBalanceContracts,
  shouldRunScheduledJob,
} from "@/lib/contracts/contract-notification-helpers"
import { processNegotiationBackgroundTicks } from "@/lib/negotiation/background-tick"
import { processOutboundAutoRetries } from "@/lib/integrations/process-outbound-auto-retries"

const EXPIRING_JOB_KEY = "contract_expiring_soon"
const LOW_BALANCE_JOB_KEY = "contract_low_balance"
const EXPIRING_INTERVAL_HOURS = 24

function isAuthorized(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET
  const maintenanceSecret = process.env.CONTRACT_MAINTENANCE_SECRET

  const auth = request.headers.get("authorization")
  if (cronSecret && auth === `Bearer ${cronSecret}`) return true
  if (maintenanceSecret && request.headers.get("x-maintenance-key") === maintenanceSecret) {
    return true
  }

  // Vercel Cron (produção) — ver https://vercel.com/docs/cron-jobs
  if (request.headers.get("x-vercel-cron") === "1" && process.env.VERCEL === "1") {
    return true
  }

  if (!cronSecret && !maintenanceSecret) return true

  return false
}

async function runBackgroundJobs(): Promise<Record<string, unknown>> {
  const service = createServiceRoleClient()
  const result: Record<string, unknown> = {}

  try {
    await service.rpc("close_expired_rounds")
    result.closeExpiredRounds = "ok"
  } catch (e) {
    result.closeExpiredRounds = e instanceof Error ? e.message : "error"
  }

  try {
    await service.rpc("expire_overdue_contracts")
    result.expireOverdueContracts = "ok"
  } catch (e) {
    result.expireOverdueContracts = e instanceof Error ? e.message : "error"
  }

  result.negotiation = await processNegotiationBackgroundTicks()

  try {
    result.outboundAutoRetry = await processOutboundAutoRetries()
  } catch (e) {
    result.outboundAutoRetry = e instanceof Error ? e.message : "error"
  }

  try {
    const expiredNotified = await notifyExpiredContracts(service)
    result.expiredNotified = expiredNotified

    const runExpiring = await shouldRunScheduledJob(
      service,
      EXPIRING_JOB_KEY,
      EXPIRING_INTERVAL_HOURS,
    )
    if (runExpiring) {
      const expiring = await notifyExpiringSoonContracts(service)
      result.expiring = expiring
      await markScheduledJobRun(service, EXPIRING_JOB_KEY)
    } else {
      result.expiringSkipped = true
    }

    const runLowBalance = await shouldRunScheduledJob(
      service,
      LOW_BALANCE_JOB_KEY,
      EXPIRING_INTERVAL_HOURS,
    )
    if (runLowBalance) {
      const lowBalance = await notifyLowBalanceContracts(service)
      result.lowBalance = lowBalance
      await markScheduledJobRun(service, LOW_BALANCE_JOB_KEY)
    } else {
      result.lowBalanceSkipped = true
    }
  } catch (e) {
    result.contractMaintenance = e instanceof Error ? e.message : "error"
  }

  return result
}

/** Cron / job externo — negociação IA, rodadas vencidas, contratos, retry ERP. */
export async function GET(request: Request) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const result = await runBackgroundJobs()
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  return GET(request)
}
