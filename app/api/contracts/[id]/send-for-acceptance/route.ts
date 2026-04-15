import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

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
    .select("company_id")
    .eq("id", user.id)
    .single()

  if (!profile?.company_id) {
    return { error: NextResponse.json({ error: "Company not found" }, { status: 404 }) }
  }

  return { supabase, companyId: profile.company_id as string }
}

type RouteCtx = { params: Promise<{ id: string }> }

export async function POST(_request: Request, context: RouteCtx) {
  try {
    const ctx = await getBuyerContext()
    if ("error" in ctx) return ctx.error

    const { id } = await context.params

    const { data: contract, error: contractErr } = await ctx.supabase
      .from("contracts")
      .select("id, status, company_id")
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

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
