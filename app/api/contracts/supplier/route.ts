import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { contractFromRow } from "@/types/contracts"

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

export async function GET() {
  try {
    const ctx = await getSupplierAuth()
    if ("error" in ctx) return ctx.error

    const service = createServiceRoleClient()

    const { data: rows, error } = await service
      .from("contracts")
      .select(CONTRACT_SELECT)
      .eq("supplier_id", ctx.supplierId)
      .in("status", ["pending_acceptance", "active", "expired"])
      .order("created_at", { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const contracts = (rows ?? []).map((row) => contractFromRow(row))

    return NextResponse.json({ contracts })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
