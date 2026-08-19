import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { createNotification } from "@/lib/notify"
import { sendEmail } from "@/lib/email/send-email"
import {
  templateContractAccepted,
  templateContractRefused,
} from "@/lib/email/templates"
import { integrateContractWithErp } from "@/lib/integrations/integrate-contract-with-erp"

async function getAuthedSupabase() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {}
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }

  return { supabase, userId: user.id }
}

type RouteCtx = { params: Promise<{ id: string }> }

export async function POST(request: Request, context: RouteCtx) {
  try {
    const ctx = await getAuthedSupabase()
    if ("error" in ctx) return ctx.error

    const body = (await request.json()) as {
      action?: string
      notes?: string
    }

    if (body.action !== "accepted" && body.action !== "refused") {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }

    const { data: profile, error: profileErr } = await ctx.supabase
      .from("profiles")
      .select("supplier_id, profile_type")
      .eq("id", ctx.userId)
      .single()

    if (profileErr || !profile?.supplier_id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    if (profile.profile_type !== "supplier") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { id: contractId } = await context.params

    const service = createServiceRoleClient()

    const { data: contract, error: contractErr } = await service
      .from("contracts")
      .select(
        "id, company_id, supplier_id, status, code, title, created_by",
      )
      .eq("id", contractId)
      .maybeSingle()

    if (contractErr) {
      return NextResponse.json({ error: contractErr.message }, { status: 500 })
    }
    if (!contract) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    if (contract.status !== "pending_acceptance") {
      return NextResponse.json(
        { error: "Contrato não está aguardando aceite." },
        { status: 400 },
      )
    }

    if (contract.supplier_id !== profile.supplier_id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const companyId = contract.company_id as string
    const supplierId = contract.supplier_id as string

    const { data: term, error: termErr } = await service
      .from("supplier_terms")
      .select("id, version, version_date")
      .eq("company_id", companyId)
      .eq("active", true)
      .limit(1)
      .maybeSingle()

    if (termErr) {
      return NextResponse.json({ error: termErr.message }, { status: 500 })
    }
    if (!term) {
      return NextResponse.json(
        { error: "Termos não encontrados." },
        { status: 400 },
      )
    }

    const forwarded =
      request.headers.get("x-forwarded-for") ??
      request.headers.get("x-real-ip") ??
      ""
    const ip =
      forwarded.split(",")[0]?.trim() || (forwarded ? forwarded : "unknown")

    const notes =
      typeof body.notes === "string" ? body.notes.trim() || null : null

    const termVersionDate =
      term.version_date != null
        ? typeof term.version_date === "string"
          ? term.version_date.slice(0, 10)
          : String(term.version_date).slice(0, 10)
        : null

    const { error: insertErr } = await service.from("contract_acceptances").insert({
      contract_id: contractId,
      company_id: companyId,
      supplier_id: supplierId,
      action: body.action,
      notes,
      term_version: String(term.version ?? ""),
      term_version_date: termVersionDate,
      ip_address: ip === "unknown" ? null : ip,
      user_id: ctx.userId,
    })

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 })
    }

    if (body.action === "accepted") {
      const { error: updErr } = await service
        .from("contracts")
        .update({
          status: "active",
          accepted_at: new Date().toISOString(),
          accepted_by_supplier: ctx.userId,
        })
        .eq("id", contractId)

      if (updErr) {
        return NextResponse.json({ error: updErr.message }, { status: 500 })
      }

      try {
        const integration = await integrateContractWithErp(companyId, contractId)
        if (!integration.success && !integration.skipped) {
          console.error(
            "[contract accept] ERP integration failed:",
            integration.errorMessage,
          )
        }
      } catch (integrationErr) {
        console.error("[contract accept] ERP integration:", integrationErr)
      }
    } else {
      const { error: updErr } = await service
        .from("contracts")
        .update({
          status: "draft",
          refusal_reason: notes,
        })
        .eq("id", contractId)

      if (updErr) {
        return NextResponse.json({ error: updErr.message }, { status: 500 })
      }
    }

    try {
      const recipientMap = new Map<
        string,
        { id: string; full_name: string | null }
      >()

      const { data: tenantProfiles, error: tenantErr } = await service
        .from("profiles")
        .select("id, full_name, profile_type, roles")
        .eq("company_id", companyId)
        .eq("status", "active")

      if (tenantErr) {
        console.error("contract accept/refuse notify: tenant profiles", tenantErr)
      }

      for (const profile of tenantProfiles ?? []) {
        const roles = Array.isArray(profile.roles) ? profile.roles : []
        const isBuyerSide =
          profile.profile_type === "buyer" || roles.includes("admin")
        if (isBuyerSide) {
          recipientMap.set(profile.id, {
            id: profile.id,
            full_name: profile.full_name,
          })
        }
      }

      if (contract.created_by) {
        const { data: creator } = await service
          .from("profiles")
          .select("id, full_name")
          .eq("id", contract.created_by)
          .maybeSingle()
        if (creator?.id) {
          recipientMap.set(creator.id, {
            id: creator.id,
            full_name: creator.full_name,
          })
        }
      }

      const recipients = Array.from(recipientMap.values()).slice(0, 10)

      if (recipients.length === 0) {
        console.error(
          "contract accept/refuse notify: no recipients found",
          { contractId, companyId, createdBy: contract.created_by },
        )
      }

      const { data: supplierRow } = await service
        .from("suppliers")
        .select("name")
        .eq("id", supplierId)
        .maybeSingle()

      const supplierName = supplierRow?.name ?? "Fornecedor"
      const contractCode = contract.code ?? ""
      const contractTitle = contract.title ?? ""

      for (const buyer of recipients) {
        if (body.action === "accepted") {
          const inserted = await createNotification(
            {
              userId: buyer.id,
              companyId: companyId,
              type: "contract.accepted",
              title: "Contrato aceito pelo fornecedor",
              body: `${supplierName} aceitou o contrato ${contractCode}`,
              entity: "contract",
              entityId: contractId,
            },
            service,
          )

          if (!inserted) {
            console.error(
              "contract.accepted notify: insert failed",
              buyer.id,
            )
          }

          const { subject, html } = templateContractAccepted({
            buyerName: buyer.full_name ?? "Comprador",
            supplierName,
            contractCode,
            contractTitle,
          })

          const { data: prefs } = await service
            .from("notification_preferences")
            .select("order_accepted_email")
            .eq("user_id", buyer.id)
            .eq("company_id", companyId)
            .maybeSingle()

          const wantsEmail =
            (prefs as { order_accepted_email?: boolean } | null)
              ?.order_accepted_email ?? false

          if (wantsEmail) {
            const { data: authData } = await service.auth.admin.getUserById(
              buyer.id,
            )
            const toEmail = authData.user?.email
            if (toEmail) {
              await sendEmail({ to: toEmail, subject, html })
            }
          }
        } else {
          const refusalBody = notes
            ? `${supplierName} recusou o contrato ${contractCode}: ${notes}`
            : `${supplierName} recusou o contrato ${contractCode}`

          const inserted = await createNotification(
            {
              userId: buyer.id,
              companyId: companyId,
              type: "contract.refused",
              title: "Contrato recusado pelo fornecedor",
              body: refusalBody,
              entity: "contract",
              entityId: contractId,
            },
            service,
          )

          if (!inserted) {
            console.error(
              "contract.refused notify: insert failed",
              buyer.id,
            )
          }

          const { subject, html } = templateContractRefused({
            buyerName: buyer.full_name ?? "Comprador",
            supplierName,
            contractCode,
            contractTitle,
            reason: notes ?? undefined,
          })

          const { data: prefs } = await service
            .from("notification_preferences")
            .select("order_refused_email")
            .eq("user_id", buyer.id)
            .eq("company_id", companyId)
            .maybeSingle()

          const wantsEmail =
            (prefs as { order_refused_email?: boolean } | null)
              ?.order_refused_email ?? false

          if (wantsEmail) {
            const { data: authData } = await service.auth.admin.getUserById(
              buyer.id,
            )
            const toEmail = authData.user?.email
            if (toEmail) {
              await sendEmail({ to: toEmail, subject, html })
            }
          }
        }
      }
    } catch (notifyErr) {
      console.error("contract.accept/refuse notify:", notifyErr)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
