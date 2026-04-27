import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import {
  contractAcceptanceFromRow,
  contractFromRow,
  type ContractAcceptance,
} from "@/types/contracts"

const CONTRACT_SELECT = `
  *,
  suppliers!inner(name, code),
  companies(name),
  payment_conditions(code, description),
  contract_items(*)
`

async function getSupplierAuth() {
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

  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("supplier_id, profile_type")
    .eq("id", user.id)
    .single()

  if (profileErr || !profile?.supplier_id) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }
  if (profile.profile_type !== "supplier") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }

  return { supplierId: profile.supplier_id as string }
}

type RouteCtx = { params: Promise<{ id: string }> }

export async function GET(_request: Request, context: RouteCtx) {
  try {
    const ctx = await getSupplierAuth()
    if ("error" in ctx) return ctx.error

    const { id } = await context.params
    const service = createServiceRoleClient()

    const { data: row, error: contractErr } = await service
      .from("contracts")
      .select(CONTRACT_SELECT)
      .eq("id", id)
      .eq("supplier_id", ctx.supplierId)
      .maybeSingle()

    if (contractErr) {
      return NextResponse.json({ error: contractErr.message }, { status: 500 })
    }
    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    if (row.supplier_id !== ctx.supplierId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const contract = contractFromRow(row)
    const companyId = contract.company_id

    let companyName = contract.buyer_company_name?.trim() ?? ""
    if (!companyName) {
      const { data: co } = await service
        .from("companies")
        .select("name")
        .eq("id", companyId)
        .maybeSingle()
      companyName = co?.name ? String(co.name) : ""
    }

    const { data: accRows, error: accErr } = await service
      .from("contract_acceptances")
      .select("*")
      .eq("contract_id", id)
      .order("created_at", { ascending: false })

    if (accErr) {
      return NextResponse.json({ error: accErr.message }, { status: 500 })
    }

    const acceptances: ContractAcceptance[] = (accRows ?? []).map((r) =>
      contractAcceptanceFromRow(r),
    )

    const { data: term, error: termErr } = await service
      .from("supplier_terms")
      .select("title, content, version, version_date")
      .eq("company_id", companyId)
      .eq("active", true)
      .limit(1)
      .maybeSingle()

    if (termErr) {
      return NextResponse.json({ error: termErr.message }, { status: 500 })
    }

    const supplierTerms = term
      ? {
          title: String(term.title ?? ""),
          content: String(term.content ?? ""),
          version: String(term.version ?? ""),
          version_date:
            term.version_date != null
              ? typeof term.version_date === "string"
                ? term.version_date.slice(0, 10)
                : String(term.version_date).slice(0, 10)
              : "",
        }
      : null

    return NextResponse.json({
      contract,
      acceptances,
      supplierTerms,
      companyName,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
