import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { createNotification } from "@/lib/notify"
import { sendEmail } from "@/lib/email/send-email"
import { templateContractSentForAcceptance } from "@/lib/email/templates"
import { requireApiWritePermission } from "@/lib/permissions/require-api-write"

async function getBuyerContext() {
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id, is_superadmin")
    .eq("id", user.id)
    .single()

  if (!profile?.company_id) {
    return { error: NextResponse.json({ error: "Company not found" }, { status: 404 }) }
  }

  const isSuperAdmin = Boolean(profile.is_superadmin)
  let companyId = profile.company_id as string

  if (isSuperAdmin) {
    const selectedCookie = cookieStore.get("selected_company_id")
    if (selectedCookie?.value) {
      companyId = decodeURIComponent(selectedCookie.value)
    }
  }

  return { supabase, companyId, userId: user.id, isSuperAdmin }
}

type RouteCtx = { params: Promise<{ id: string }> }

export async function POST(_request: Request, context: RouteCtx) {
  try {
    const ctx = await getBuyerContext()
    if ("error" in ctx) return ctx.error

    const forbidden = await requireApiWritePermission(
      ctx.supabase,
      ctx.userId,
      ctx.companyId,
      ctx.isSuperAdmin,
      "contract.edit",
    )
    if (forbidden) return forbidden

    const { id } = await context.params

    const { data: contract, error: contractErr } = await ctx.supabase
      .from("contracts")
      .select(
        "id, status, company_id, supplier_id, code, title, start_date, end_date",
      )
      .eq("id", id)
      .eq("company_id", ctx.companyId)
      .maybeSingle()

    if (contractErr) {
      return NextResponse.json({ error: contractErr.message }, { status: 500 })
    }
    if (!contract) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const st = contract.status as string
    if (st !== "draft" && st !== "active") {
      return NextResponse.json(
        { error: "Contrato não pode ser enviado para aceite neste status." },
        { status: 400 },
      )
    }

    const { data: term, error: termErr } = await ctx.supabase
      .from("supplier_terms")
      .select("id, version, version_date")
      .eq("company_id", ctx.companyId)
      .eq("active", true)
      .limit(1)
      .maybeSingle()

    if (termErr) {
      return NextResponse.json({ error: termErr.message }, { status: 500 })
    }
    if (!term) {
      return NextResponse.json(
        { error: "Não há termos de fornecimento ativos para a empresa." },
        { status: 400 },
      )
    }

    const { error: updateErr } = await ctx.supabase
      .from("contracts")
      .update({
        status: "pending_acceptance",
        sent_for_acceptance_at: new Date().toISOString(),
        refusal_reason: null,
      })
      .eq("id", id)
      .eq("company_id", ctx.companyId)

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    try {
      if (!contract.supplier_id) {
        console.error(
          "contract.sent_for_acceptance notify: contract has no supplier_id",
          contract.id,
        )
      } else {
        const service = createServiceRoleClient()

        const { data: supplierProfiles, error: profileErr } = await service
          .from("profiles")
          .select("id, company_id, full_name")
          .eq("supplier_id", contract.supplier_id)
          .eq("profile_type", "supplier")

        if (profileErr) {
          console.error(
            "contract.sent_for_acceptance notify: supplier profile query",
            profileErr,
          )
        }

        const { data: supplierRow } = await service
          .from("suppliers")
          .select("name")
          .eq("id", contract.supplier_id)
          .maybeSingle()

        const { data: buyerCompany } = await service
          .from("companies")
          .select("name")
          .eq("id", contract.company_id)
          .maybeSingle()

        if (!supplierProfiles?.length) {
          console.error(
            "contract.sent_for_acceptance notify: supplier profile not found",
            { contractId: contract.id, supplierId: contract.supplier_id },
          )
        } else if (!buyerCompany?.name) {
          console.error(
            "contract.sent_for_acceptance notify: buyer company not found",
            contract.company_id,
          )
        } else {
          const notifyCompanyId = contract.company_id as string

          for (const supplierProfile of supplierProfiles) {
            const supplierName =
              supplierRow?.name ?? supplierProfile.full_name ?? "Fornecedor"

            const inserted = await createNotification(
              {
                userId: supplierProfile.id,
                companyId: notifyCompanyId,
                type: "contract.sent_for_acceptance",
                title: "Contrato aguardando seu aceite",
                body: `${buyerCompany.name} enviou o contrato ${contract.code} para análise`,
                entity: "contract",
                entityId: contract.id,
              },
              service,
            )

            if (!inserted) {
              console.error(
                "contract.sent_for_acceptance notify: insert failed",
                supplierProfile.id,
              )
            }

            const { subject, html } = templateContractSentForAcceptance({
              supplierName,
              buyerCompanyName: buyerCompany.name,
              contractCode: contract.code ?? "",
              contractTitle: contract.title ?? "",
              startDate: contract.start_date ?? undefined,
              endDate: contract.end_date ?? undefined,
            })

            const { data: prefs } = await service
              .from("notification_preferences")
              .select("quotation_received_email")
              .eq("user_id", supplierProfile.id)
              .eq("company_id", notifyCompanyId)
              .maybeSingle()

            const wantsEmail =
              (prefs as { quotation_received_email?: boolean } | null)
                ?.quotation_received_email ?? false

            if (wantsEmail) {
              const { data: authData } = await service.auth.admin.getUserById(
                supplierProfile.id,
              )
              const toEmail = authData.user?.email
              if (toEmail) {
                await sendEmail({ to: toEmail, subject, html })
              }
            }
          }
        }
      }
    } catch (notifyErr) {
      console.error("contract.sent_for_acceptance notify:", notifyErr)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
