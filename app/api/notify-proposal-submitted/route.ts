import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { sendEmail } from "@/lib/email/send-email"
import { templateProposalSubmitted } from "@/lib/email/templates"

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      quotationId?: string
      quotationCode?: string
      roundNumber?: number
      supplierName?: string
      totalPrice?: number
    }

    if (!body.quotationId || !body.quotationCode || !body.supplierName) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const service = createServiceRoleClient()

    const { data: quotation } = await service
      .from("quotations")
      .select("id, company_id, created_by")
      .eq("id", body.quotationId)
      .single()

    if (!quotation?.company_id) {
      return NextResponse.json({ error: "Quotation not found" }, { status: 404 })
    }

    const buyerIds: string[] = []
    if (quotation.created_by) {
      buyerIds.push(quotation.created_by)
    } else {
      const { data: buyers } = await service
        .from("profiles")
        .select("id")
        .eq("company_id", quotation.company_id)
        .eq("profile_type", "buyer")
      buyers?.forEach((b) => buyerIds.push(b.id))
    }

    if (buyerIds.length === 0) {
      return NextResponse.json({ ok: true, notified: 0 })
    }

    const { data: buyerProfiles } = await service
      .from("profiles")
      .select("id, full_name")
      .in("id", buyerIds)

    let notified = 0
    for (const buyer of buyerProfiles ?? []) {
      const { error: insErr } = await service.from("notifications").insert({
        user_id: buyer.id,
        company_id: quotation.company_id,
        type: "proposal.submitted",
        title: "Nova proposta recebida",
        body: `${body.supplierName} enviou proposta para ${body.quotationCode}`,
        entity: "quotation",
        entity_id: body.quotationId,
      })
      if (insErr) {
        console.error("notify-proposal-submitted insert:", insErr)
      }

      const { data: prefs } = await service
        .from("notification_preferences")
        .select("quotation_received_email")
        .eq("user_id", buyer.id)
        .eq("company_id", quotation.company_id)
        .maybeSingle()

      const wantsEmail = (
        prefs as { quotation_received_email?: boolean } | null
      )?.quotation_received_email ?? false

      const { data: authData } = await service.auth.admin.getUserById(buyer.id)
      const buyerEmail = authData.user?.email ?? null

      if (wantsEmail && buyerEmail) {
        const { subject, html } = templateProposalSubmitted({
          buyerName: buyer.full_name ?? "Comprador",
          supplierName: body.supplierName,
          quotationCode: body.quotationCode,
          roundNumber: body.roundNumber ?? 1,
          totalPrice: body.totalPrice ?? 0,
        })
        await sendEmail({ to: buyerEmail, subject, html })
      }

      notified++
    }

    return NextResponse.json({ ok: true, notified })
  } catch (e) {
    console.error("notify-proposal-submitted:", e)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
