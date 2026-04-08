import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { sendEmail } from "@/lib/email/send-email"
import type { NotifyWithEmailBody } from "@/lib/notify-with-email"

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

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: me, error: meErr } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", user.id)
      .single()
    const { data: recipient, error: recErr } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", params.userId)
      .single()

    if (
      meErr ||
      recErr ||
      !me?.company_id ||
      me.company_id !== recipient?.company_id ||
      me.company_id !== params.companyId
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const service = createServiceRoleClient()

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

    const prefMap = prefs as Record<string, boolean> | null
    const wantsEmail = prefMap?.[params.emailPrefKey] ?? false

    const to = params.toEmail?.trim()
    if (wantsEmail && to) {
      await sendEmail({
        to,
        subject: params.subject,
        html: params.html,
      })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("notify-with-email:", e)
    return NextResponse.json({ error: "Bad request" }, { status: 400 })
  }
}
