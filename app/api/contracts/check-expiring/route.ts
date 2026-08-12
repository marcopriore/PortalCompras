import { NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { notifyExpiringSoonContracts } from "@/lib/contracts/contract-notification-helpers"

/** Disparo manual da verificação de contratos vencendo em 30 dias. */
export async function GET() {
  try {
    const service = createServiceRoleClient()
    const { checked, notified } = await notifyExpiringSoonContracts(service)
    return NextResponse.json({ checked, notified })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
