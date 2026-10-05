import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { sendEmail } from "@/lib/email/send-email"
import type { NotifyWithEmailBody } from "@/lib/notify-with-email"
import {
  canNotifyRecipient,
  isAllowedNotifyEmailPrefKey,
  wantsNotifyEmail,
} from "@/lib/notify-with-email-guard"

export async function POST(request: Request) {
  try {
    const params = (await request.json()) as NotifyWithEmailBody
    if (
      !params.userId ||
      !params.companyId ||
      !params.type ||
      !params.title ||
      !params.subject ||
      !params.html ||
      !params.emailPrefKey
    ) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
    }

    if (!isAllowedNotifyEmailPrefKey(params.emailPrefKey)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: callerProfile } = await supabase
      .from("profiles")
      .select("company_id, profile_type, supplier_id, is_superadmin")
      .eq("id", user.id)
      .single()

    if (
      !callerProfile ||
      (!callerProfile.company_id &&
        callerProfile.profile_type !== "supplier" &&
        !callerProfile.is_superadmin)
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const service = createServiceRoleClient()

    const { data: recipient, error: recErr } = await service
      .from("profiles")
      .select("company_id")
      .eq("id", params.userId)
      .single()

    if (
      recErr ||
      !recipient?.company_id ||
      recipient.company_id !== params.companyId
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const entity = params.entity ?? ""
    let purchaseOrder: { company_id: string; supplier_id: string | null } | null =
      null
    if (
      params.entityId &&
      (entity === "purchase_orders" || entity === "purchase_order")
    ) {
      const { data: po } = await service
        .from("purchase_orders")
        .select("id, company_id, supplier_id")
        .eq("id", params.entityId)
        .maybeSingle()
      purchaseOrder = po
        ? { company_id: po.company_id, supplier_id: po.supplier_id }
        : null
    }

    const allowed = canNotifyRecipient({
      caller: callerProfile,
      companyId: params.companyId,
      entity: params.entity,
      entityId: params.entityId,
      purchaseOrder,
    })
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { error: insErr } = await service.from("notifications").insert({
      user_id: params.userId,
      company_id: params.companyId,
      type: params.type,
      title: params.title,
      body: params.body ?? null,
      entity: params.entity ?? null,
      entity_id: params.entityId ?? null,
    })
    if (insErr) {
      console.error("notify-with-email insert notification:", insErr)
    }

    const { data: prefs } = await service
      .from("notification_preferences")
      .select("*")
      .eq("user_id", params.userId)
      .eq("company_id", params.companyId)
      .maybeSingle()

    if (wantsNotifyEmail(prefs as Record<string, boolean> | null, params.emailPrefKey)) {
      const { data: authData } = await service.auth.admin.getUserById(params.userId)
      const to = authData.user?.email?.trim()
      if (to) {
        await sendEmail({
          to,
          subject: params.subject,
          html: params.html,
        })
      }
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("notify-with-email:", e)
    return NextResponse.json({ error: "Bad request" }, { status: 400 })
  }
}
