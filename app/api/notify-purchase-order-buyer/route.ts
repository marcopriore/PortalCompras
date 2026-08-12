import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { sendEmail } from "@/lib/email/send-email"
import {
  templateDeliveryUpdated,
  templateOrderAccepted,
  templateOrderRefused,
} from "@/lib/email/templates"
import { formatDateBR } from "@/lib/utils/date-helpers"

type NotifyEvent = "accepted" | "refused" | "delivery_updated"

async function resolveBuyerUserId(
  service: ReturnType<typeof createServiceRoleClient>,
  order: {
    created_by: string | null
    quotation_id: string | null
    company_id: string
  },
): Promise<string | null> {
  if (order.created_by) return order.created_by

  if (order.quotation_id) {
    const { data } = await service
      .from("quotations")
      .select("created_by")
      .eq("id", order.quotation_id)
      .maybeSingle()
    return data?.created_by ?? null
  }

  const { data: buyers } = await service
    .from("profiles")
    .select("id")
    .eq("company_id", order.company_id)
    .in("profile_type", ["buyer", "admin"])
    .limit(1)

  return buyers?.[0]?.id ?? null
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      orderId?: string
      event?: NotifyEvent
      estimatedDelivery?: string
      refuseReason?: string
      newDeliveryDate?: string
      deliveryReason?: string
    }

    const orderId = body.orderId
    const event = body.event
    if (!orderId || !event) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: caller } = await supabase
      .from("profiles")
      .select("profile_type, supplier_id")
      .eq("id", user.id)
      .single()

    if (caller?.profile_type !== "supplier" || !caller.supplier_id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const service = createServiceRoleClient()

    const { data: order, error: orderErr } = await service
      .from("purchase_orders")
      .select(
        "id, code, company_id, supplier_id, supplier_name, created_by, quotation_id",
      )
      .eq("id", orderId)
      .maybeSingle()

    if (orderErr || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }

    if (order.supplier_id !== caller.supplier_id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const buyerId = await resolveBuyerUserId(service, order)
    if (!buyerId) {
      return NextResponse.json({ ok: true, notified: false })
    }

    const { data: buyerProfile } = await service
      .from("profiles")
      .select("full_name")
      .eq("id", buyerId)
      .maybeSingle()

    const buyerName = buyerProfile?.full_name ?? "Comprador"
    const { data: authData } = await service.auth.admin.getUserById(buyerId)
    const buyerEmail = authData.user?.email ?? null

    let type = ""
    let title = ""
    let bodyText = ""
    let emailPrefKey = ""
    let subject = ""
    let html = ""

    if (event === "accepted") {
      const estimatedDelivery = body.estimatedDelivery?.trim()
      const estimatedLabel = estimatedDelivery
        ? formatDateBR(estimatedDelivery)
        : undefined
      type = "order.accepted"
      title = "Pedido aceito pelo fornecedor"
      bodyText = `${order.supplier_name} aceitou o ${order.code}`
      emailPrefKey = "order_accepted_email"
      const tpl = templateOrderAccepted({
        buyerName,
        supplierName: order.supplier_name,
        orderCode: order.code,
        estimatedDelivery: estimatedLabel,
      })
      subject = tpl.subject
      html = tpl.html
    } else if (event === "refused") {
      const reason = body.refuseReason?.trim() ?? ""
      type = "order.refused"
      title = "Pedido recusado pelo fornecedor"
      bodyText = `${order.supplier_name} recusou o ${order.code}. Motivo: ${reason || "Não informado"}`
      emailPrefKey = "order_refused_email"
      const tpl = templateOrderRefused({
        buyerName,
        supplierName: order.supplier_name,
        orderCode: order.code,
        reason,
      })
      subject = tpl.subject
      html = tpl.html
    } else if (event === "delivery_updated") {
      const newDate = body.newDeliveryDate?.trim()
      const reason = body.deliveryReason?.trim() ?? ""
      const newDateLabel = newDate ? formatDateBR(newDate) : "—"
      type = "order.delivery_updated"
      title = "Data de entrega atualizada"
      bodyText = `${order.supplier_name} atualizou a entrega do ${order.code} para ${newDateLabel}`
      emailPrefKey = "delivery_done_email"
      const tpl = templateDeliveryUpdated({
        buyerName,
        supplierName: order.supplier_name,
        orderCode: order.code,
        newDate: newDateLabel,
        reason,
      })
      subject = tpl.subject
      html = tpl.html
    } else {
      return NextResponse.json({ error: "Invalid event" }, { status: 400 })
    }

    const { error: insErr } = await service.from("notifications").insert({
      user_id: buyerId,
      company_id: order.company_id,
      type,
      title,
      body: bodyText,
      entity: "purchase_orders",
      entity_id: order.id,
    })
    if (insErr) {
      console.error("notify-purchase-order-buyer insert:", insErr)
    }

    const { data: prefs } = await service
      .from("notification_preferences")
      .select("*")
      .eq("user_id", buyerId)
      .eq("company_id", order.company_id)
      .maybeSingle()

    const wantsEmail =
      (prefs as Record<string, boolean> | null)?.[emailPrefKey] ?? false

    if (wantsEmail && buyerEmail) {
      await sendEmail({ to: buyerEmail, subject, html })
    }

    return NextResponse.json({ ok: true, notified: true })
  } catch (e) {
    console.error("notify-purchase-order-buyer:", e)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
