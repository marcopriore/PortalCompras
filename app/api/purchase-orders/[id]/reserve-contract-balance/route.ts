import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { tenantHasContractBalance } from "@/lib/contracts/contract-balance-settings"

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

  return { supabase, companyId }
}

type RouteCtx = { params: Promise<{ id: string }> }

export async function POST(_request: Request, context: RouteCtx) {
  try {
    const ctx = await getBuyerContext()
    if ("error" in ctx) return ctx.error

    const contractBalanceEnabled = await tenantHasContractBalance(
      ctx.supabase,
      ctx.companyId,
    )
    if (!contractBalanceEnabled) {
      return NextResponse.json(
        { error: "Funcionalidade Consumo de Contrato não habilitada" },
        { status: 403 },
      )
    }

    const { id: orderId } = await context.params

    const { data: order, error: orderErr } = await ctx.supabase
      .from("purchase_orders")
      .select("id, company_id, contract_balance_applied")
      .eq("id", orderId)
      .eq("company_id", ctx.companyId)
      .maybeSingle()

    if (orderErr) {
      return NextResponse.json({ error: orderErr.message }, { status: 500 })
    }
    if (!order) {
      return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 })
    }

    if (order.contract_balance_applied) {
      return NextResponse.json({ ok: true, alreadyApplied: true })
    }

    const admin = createServiceRoleClient()

    const { error: reserveErr } = await admin.rpc("reserve_contract_balance", {
      p_order_id: orderId,
    })

    if (reserveErr) {
      return NextResponse.json(
        { error: reserveErr.message ?? "Falha ao reservar saldo do contrato" },
        { status: 400 },
      )
    }

    const { error: flagErr } = await admin
      .from("purchase_orders")
      .update({ contract_balance_applied: "reserved" })
      .eq("id", orderId)

    if (flagErr) {
      await admin.rpc("release_contract_balance", { p_order_id: orderId })
      return NextResponse.json({ error: flagErr.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
