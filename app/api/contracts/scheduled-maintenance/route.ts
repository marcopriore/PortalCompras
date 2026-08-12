import { NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import {
  markScheduledJobRun,
  notifyExpiredContracts,
  notifyExpiringSoonContracts,
  shouldRunScheduledJob,
} from "@/lib/contracts/contract-notification-helpers"

const EXPIRING_JOB_KEY = "contract_expiring_soon"
const EXPIRING_INTERVAL_HOURS = 24

function isAuthorized(request: Request): boolean {
  const secret = process.env.CONTRACT_MAINTENANCE_SECRET
  if (!secret) return true
  return request.headers.get("x-maintenance-key") === secret
}

export async function POST(request: Request) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const service = createServiceRoleClient()

    const expiredNotified = await notifyExpiredContracts(service)

    let expiringChecked = 0
    let expiringNotified = 0
    const runExpiring = await shouldRunScheduledJob(
      service,
      EXPIRING_JOB_KEY,
      EXPIRING_INTERVAL_HOURS,
    )

    if (runExpiring) {
      const result = await notifyExpiringSoonContracts(service)
      expiringChecked = result.checked
      expiringNotified = result.notified
      await markScheduledJobRun(service, EXPIRING_JOB_KEY)
    }

    return NextResponse.json({
      expiredNotified,
      expiringChecked,
      expiringNotified,
      expiringSkipped: !runExpiring,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
