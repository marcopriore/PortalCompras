import { NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { advanceNegotiationRun } from "@/lib/negotiation/motor"
import { requireNegotiationApiContext } from "@/lib/negotiation/require-api-context"

export const runtime = "nodejs"

type RouteParams = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: RouteParams) {
  const ctx = await requireNegotiationApiContext()
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status })
  }

  const { id: runId } = await params
  let body: { forceApprove?: boolean } = {}
  try {
    body = (await request.json()) as { forceApprove?: boolean }
  } catch {
    body = {}
  }

  const service = createServiceRoleClient()
  const result = await advanceNegotiationRun(service, ctx.companyId, runId, {
    actorUserId: ctx.userId,
    forceApprove: Boolean(body.forceApprove),
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: 400 })
  }

  return NextResponse.json({ run: result.run, message: result.message })
}
