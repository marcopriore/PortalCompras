import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { sendEmail } from "@/lib/email/send-email"
import { templateProposalSubmitted } from "@/lib/email/templates"
import {
  isAuthorizedProposalSubmittedNotifier,
  proposalSubmittedNotifyFields,
} from "@/lib/notifications/proposal-submitted-access"

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      quotationId?: string
    }

    if (!body.quotationId) {
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

    const { data: quotation } = await service
      .from("quotations")
      .select("id, company_id, created_by, code")
      .eq("id", body.quotationId)
      .single()

    if (!quotation?.company_id) {
      return NextResponse.json({ error: "Quotation not found" }, { status: 404 })
    }

    const supplierIds = new Set<string>([caller.supplier_id])
    const { data: memberships, error: membershipErr } = await service
      .from("supplier_portal_memberships")
      .select("supplier_id")
      .eq("user_id", user.id)
      .eq("company_id", quotation.company_id)
      .eq("status", "active")

    if (!membershipErr) {
      for (const row of memberships ?? []) {
        if (row.supplier_id) supplierIds.add(row.supplier_id)
      }
    }

    const { data: proposal } = await service
      .from("quotation_proposals")
      .select("id, supplier_id, supplier_name, total_price, status, round_id")
      .eq("quotation_id", quotation.id)
      .in("supplier_id", [...supplierIds])
      .eq("status", "submitted")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (
      !proposal ||
      !isAuthorizedProposalSubmittedNotifier(
        {
          profileType: caller.profile_type,
          supplierIds: [...supplierIds],
        },
        proposal,
      )
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    let roundNumber: number | null = null
    if (proposal.round_id) {
      const { data: round } = await service
        .from("quotation_rounds")
        .select("round_number")
        .eq("id", proposal.round_id)
        .maybeSingle()
      roundNumber = typeof round?.round_number === "number" ? round.round_number : null
    }

    const fields = proposalSubmittedNotifyFields({
      quotationCode: quotation.code,
      supplierName: proposal.supplier_name,
      roundNumber,
      totalPrice:
        typeof proposal.total_price === "number"
          ? proposal.total_price
          : proposal.total_price != null
            ? Number(proposal.total_price)
            : null,
    })

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
        body: `${fields.supplierName} enviou proposta para ${fields.quotationCode}`,
        entity: "quotation",
        entity_id: quotation.id,
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
          supplierName: fields.supplierName,
          quotationCode: fields.quotationCode,
          roundNumber: fields.roundNumber,
          totalPrice: fields.totalPrice,
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
