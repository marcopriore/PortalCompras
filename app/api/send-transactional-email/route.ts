import { NextResponse } from "next/server"
import { getBuyerContext } from "@/lib/auth/buyer-context"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { sendEmail } from "@/lib/email/send-email"
import { templateNewRound } from "@/lib/email/templates"
import { formatDateBR } from "@/lib/formato-data"
import {
  parseNewRoundEmailRequest,
  selectNewRoundRecipients,
} from "@/lib/email/new-round-email"

/**
 * Notifies invited suppliers about a new quotation round.
 * Does not accept arbitrary to/subject/html (open relay).
 */
export async function POST(request: Request) {
  try {
    const ctx = await getBuyerContext()
    if ("error" in ctx) return ctx.error

    const parsed = parseNewRoundEmailRequest(await request.json())
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }

    const { quotationId, roundNumber, supplierUserIds } = parsed.value
    if (supplierUserIds.length === 0) {
      return NextResponse.json({ ok: true, sent: 0 })
    }

    const service = createServiceRoleClient()

    const { data: quotation } = await service
      .from("quotations")
      .select("id, code, company_id")
      .eq("id", quotationId)
      .eq("company_id", ctx.companyId)
      .maybeSingle()

    if (!quotation?.code) {
      return NextResponse.json({ error: "Quotation not found" }, { status: 404 })
    }

    const { data: round } = await service
      .from("quotation_rounds")
      .select("id, round_number, response_deadline")
      .eq("quotation_id", quotation.id)
      .eq("company_id", ctx.companyId)
      .eq("round_number", roundNumber)
      .maybeSingle()

    if (!round) {
      return NextResponse.json({ error: "Round not found" }, { status: 404 })
    }

    const { data: proposals } = await service
      .from("quotation_proposals")
      .select("supplier_id, supplier_name")
      .eq("quotation_id", quotation.id)
      .eq("company_id", ctx.companyId)
      .eq("round_id", round.id)

    const invitedSupplierIds = [
      ...new Set(
        ((proposals ?? []) as { supplier_id: string | null }[])
          .map((row) => row.supplier_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ]

    const { data: profiles } = await service
      .from("profiles")
      .select("id, supplier_id, profile_type")
      .in("id", supplierUserIds)
      .eq("profile_type", "supplier")

    const recipients = selectNewRoundRecipients(
      supplierUserIds,
      invitedSupplierIds,
      (profiles ?? []) as Array<{
        id: string
        supplier_id: string | null
        profile_type: string | null
      }>,
    )

    const nameBySupplierId = new Map<string, string>()
    for (const row of (proposals ?? []) as {
      supplier_id: string | null
      supplier_name: string | null
    }[]) {
      if (row.supplier_id && row.supplier_name) {
        nameBySupplierId.set(row.supplier_id, row.supplier_name)
      }
    }

    const deadlineRaw =
      typeof round.response_deadline === "string"
        ? round.response_deadline.slice(0, 10)
        : ""
    const deadlineLabel = formatDateBR(deadlineRaw)
    const deadline =
      deadlineLabel && deadlineLabel !== "—" ? deadlineLabel : undefined

    let sent = 0
    for (const recipient of recipients) {
      const { data: authData } = await service.auth.admin.getUserById(
        recipient.userId,
      )
      const email = authData?.user?.email
      if (!email) continue

      const { subject, html } = templateNewRound({
        supplierName: nameBySupplierId.get(recipient.supplierId) ?? "Fornecedor",
        quotationCode: quotation.code,
        roundNumber,
        deadline,
      })
      const ok = await sendEmail({ to: email, subject, html })
      if (ok) sent += 1
    }

    return NextResponse.json({ ok: true, sent })
  } catch (e) {
    console.error("send-transactional-email:", e)
    return NextResponse.json({ error: "Bad request" }, { status: 400 })
  }
}
