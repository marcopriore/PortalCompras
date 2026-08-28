import { timingSafeEqual } from "crypto"
import { NextResponse } from "next/server"
import { z } from "zod"
import { createNotification } from "@/lib/notify"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { buildSupportWebhookNotification } from "@/lib/axisdesk/webhook"

export const runtime = "nodejs"

const webhookSchema = z.object({
  evento: z.enum(["status_alterado", "comentario"]),
  chamado_id: z.string().min(1),
  tenant_id_externo: z.string().min(1),
  solicitante_id_externo: z.string().min(1),
  timestamp: z.string().min(1),
  status_novo: z.string().optional(),
  mensagem: z.string().optional(),
  motivo: z.string().optional(),
  autor: z.string().optional(),
})

function verifyWebhookSecret(received: string | null): boolean {
  const expected = process.env.AXISDESK_WEBHOOK_SECRET?.trim()
  if (!received || !expected) return false

  const receivedBuf = Buffer.from(received)
  const expectedBuf = Buffer.from(expected)
  if (receivedBuf.length !== expectedBuf.length) return false

  return timingSafeEqual(receivedBuf, expectedBuf)
}

export async function POST(request: Request) {
  try {
    const secret = request.headers.get("x-axisdesk-secret")
    if (!verifyWebhookSecret(secret)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    let json: unknown
    try {
      json = await request.json()
    } catch {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
    }

    const parsed = webhookSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
    }

    const event = parsed.data
    const service = createServiceRoleClient()

    const { data: profile } = await service
      .from("profiles")
      .select("company_id, profile_type, status")
      .eq("id", event.solicitante_id_externo)
      .maybeSingle()

    if (
      !profile?.company_id ||
      profile.status !== "active" ||
      profile.company_id !== event.tenant_id_externo
    ) {
      console.error("support webhook: recipient profile not found or mismatch", {
        solicitante_id_externo: event.solicitante_id_externo,
        tenant_id_externo: event.tenant_id_externo,
      })
      return NextResponse.json({ ok: true })
    }

    const notification = buildSupportWebhookNotification(event)

    const inserted = await createNotification(
      {
        userId: event.solicitante_id_externo,
        companyId: event.tenant_id_externo,
        type: notification.type,
        title: notification.title,
        body: notification.body,
        entity: "support_ticket",
        entityId: event.chamado_id,
      },
      service,
    )

    if (!inserted) {
      console.error("support webhook: createNotification failed", {
        chamado_id: event.chamado_id,
        user_id: event.solicitante_id_externo,
      })
      return NextResponse.json({ error: "Internal error" }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("support webhook:", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
