import { NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { cancelNegotiationRun } from "@/lib/negotiation/motor"
import { requireNegotiationApiContext } from "@/lib/negotiation/require-api-context"

export const runtime = "nodejs"

type RouteParams = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: RouteParams) {
  const ctx = await requireNegotiationApiContext()
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status })
  }

  const { id: runId } = await params
  let body: { reason?: string } = {}
  try {
    body = (await request.json()) as { reason?: string }
  } catch {
    body = {}
  }

  const service = createServiceRoleClient()
  const result = await cancelNegotiationRun(
    service,
    ctx.companyId,
    runId,
    ctx.userId,
    body.reason,
  )

  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: 400 })
  }

  return NextResponse.json({ run: result.run, message: "Evento de negociação encerrado." })
}
