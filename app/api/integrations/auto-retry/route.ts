import { NextResponse } from "next/server"
import { processOutboundAutoRetries } from "@/lib/integrations/process-outbound-auto-retries"

function isAuthorized(request: Request): boolean {
  const secret = process.env.CONTRACT_MAINTENANCE_SECRET
  if (!secret) return true
  return request.headers.get("x-maintenance-key") === secret
}

/** Job de auto-retry outbound (falhas transitórias). Disparado pelo proxy. */
export async function POST(request: Request) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const result = await processOutboundAutoRetries()
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
