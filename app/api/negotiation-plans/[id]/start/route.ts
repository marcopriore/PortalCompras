import { NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { startNegotiationRun } from "@/lib/negotiation/motor"
import { requireNegotiationApiContext } from "@/lib/negotiation/require-api-context"

export const runtime = "nodejs"

type RouteParams = { params: Promise<{ id: string }> }

export async function POST(_request: Request, { params }: RouteParams) {
  const ctx = await requireNegotiationApiContext()
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status })
  }

  const { id: planId } = await params
  const service = createServiceRoleClient()
  const result = await startNegotiationRun(service, ctx.companyId, planId, ctx.userId)

  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: 400 })
  }

  return NextResponse.json({ run: result.run, message: result.message })
}
