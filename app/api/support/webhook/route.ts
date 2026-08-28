import { timingSafeEqual } from "crypto"
import { NextResponse } from "next/server"
import { z } from "zod"
import { logAxisDeskInbound } from "@/lib/axisdesk/integration-logs"
import { createNotification } from "@/lib/notify"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { buildSupportWebhookNotification, resolveWebhookRecipient } from "@/lib/axisdesk/webhook"

export const runtime = "nodejs"

const WEBHOOK_PATH = "/api/support/webhook"

const webhookSchema = z.discriminatedUnion("evento", [
  z.object({
    evento: z.literal("teste"),
    chamado_id: z.string().optional(),
    tenant_id_externo: z.string().optional(),
    solicitante_id_externo: z.string().optional(),
    timestamp: z.string().optional(),
    status_novo: z.string().optional(),
    mensagem: z.string().optional(),
    motivo: z.string().optional(),
    autor: z.string().optional(),
  }),
  z.object({
    evento: z.enum(["status_alterado", "comentario"]),
    chamado_id: z.string().min(1),
    tenant_id_externo: z.string().min(1),
    solicitante_id_externo: z.string().min(1),
    timestamp: z.string().min(1),
    status_novo: z.string().optional(),
    mensagem: z.string().optional(),
    motivo: z.string().optional(),
    autor: z.string().optional(),
  }),
])

function verifyWebhookSecret(received: string | null): boolean {
  const expected = process.env.AXISDESK_WEBHOOK_SECRET?.trim()
  if (!received || !expected) return false

  const receivedBuf = Buffer.from(received)
  const expectedBuf = Buffer.from(expected)
  if (receivedBuf.length !== expectedBuf.length) return false

  return timingSafeEqual(receivedBuf, expectedBuf)
}

function getClientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) return forwarded.split(",")[0]?.trim() ?? null
  return request.headers.get("x-real-ip")
}

export async function POST(request: Request) {
  const startedAt = Date.now()
  let statusCode = 500
  let evento: string | null = null
  let tenantIdExterno: string | null = null

  try {
    const secret = request.headers.get("x-axisdesk-secret")
    if (!verifyWebhookSecret(secret)) {
      statusCode = 401
      return NextResponse.json({ error: "Unauthorized" }, { status: statusCode })
    }

    let json: unknown
    try {
      json = await request.json()
    } catch {
      statusCode = 400
      return NextResponse.json({ error: "Invalid payload" }, { status: statusCode })
    }

    const parsed = webhookSchema.safeParse(json)
    if (!parsed.success) {
      statusCode = 400
      return NextResponse.json({ error: "Invalid payload" }, { status: statusCode })
    }

    const event = parsed.data
    evento = event.evento
    tenantIdExterno = event.tenant_id_externo?.trim() || null

    console.log(`webhook recebido: evento=${event.evento}`)

    if (event.evento === "teste") {
      statusCode = 200
      return NextResponse.json({ ok: true, recebido: "teste" })
    }

    const service = createServiceRoleClient()

    const recipient = await resolveWebhookRecipient(
      service,
      event.solicitante_id_externo,
      event.tenant_id_externo,
    )

    if (!recipient.ok) {
      console.error("support webhook: recipient profile not found or mismatch", {
        reason: recipient.reason,
        ...recipient.logContext,
      })
      statusCode = 422
      return NextResponse.json(
        {
          error: "Recipient not found",
          code: recipient.reason,
        },
        { status: statusCode },
      )
    }

    const notification = buildSupportWebhookNotification(event)

    const inserted = await createNotification(
      {
        userId: recipient.userId,
        companyId: recipient.companyId,
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
      statusCode = 500
      return NextResponse.json({ error: "Internal error" }, { status: statusCode })
    }

    statusCode = 200
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("support webhook:", error)
    statusCode = 500
    return NextResponse.json({ error: "Internal error" }, { status: statusCode })
  } finally {
    if (tenantIdExterno) {
      await logAxisDeskInbound({
        companyId: tenantIdExterno,
        method: "POST",
        path: WEBHOOK_PATH,
        statusCode,
        durationMs: Date.now() - startedAt,
        ipAddress: getClientIp(request),
        evento,
      })
    }
  }
}
