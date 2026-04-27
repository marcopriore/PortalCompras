import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import {
  contractAcceptanceFromRow,
  type ContractAcceptance,
} from "@/types/contracts"

async function getAuthedContext() {
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

  return { supabase, companyId, isSuperAdmin }
}

type RouteCtx = { params: Promise<{ id: string }> }

export async function GET(_request: Request, context: RouteCtx) {
  try {
    const ctx = await getAuthedContext()
    if ("error" in ctx) return ctx.error

    const { id } = await context.params

    const { data: contract, error: contractErr } = await ctx.supabase
      .from("contracts")
      .select("id")
      .eq("id", id)
      .eq("company_id", ctx.companyId)
      .maybeSingle()

    if (contractErr) {
      return NextResponse.json({ error: contractErr.message }, { status: 500 })
    }
    if (!contract) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const { data: rows, error } = await ctx.supabase
      .from("contract_acceptances")
      .select("*")
      .eq("contract_id", id)
      .order("created_at", { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const acceptances: ContractAcceptance[] = (rows ?? []).map((row) =>
      contractAcceptanceFromRow(row),
    )

    return NextResponse.json({ acceptances })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
