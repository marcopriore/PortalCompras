import { NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { notifyExpiringSoonContracts } from "@/lib/contracts/contract-notification-helpers"
import { isContractMaintenanceAuthorized } from "@/lib/contracts/maintenance-auth"

/** Job — verificação de contratos vencendo. Exige CRON_SECRET ou x-maintenance-key. */
export async function GET(request: Request) {
  try {
    if (!isContractMaintenanceAuthorized(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const service = createServiceRoleClient()
    const { checked, notified } = await notifyExpiringSoonContracts(service)
    return NextResponse.json({ checked, notified })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
