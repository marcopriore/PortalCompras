import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { contractItemFromRow, type ContractItem } from "@/types/contracts"

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
    .select("company_id")
    .eq("id", user.id)
    .single()

  if (!profile?.company_id) {
    return { error: NextResponse.json({ error: "Company not found" }, { status: 404 }) }
  }

  return { supabase, companyId: profile.company_id as string }
}

type ItemInput = {
  material_code: string
  material_description: string
  unit_of_measure?: string
  quantity_contracted: number
  unit_price: number
  delivery_days?: number | null
  notes?: string
  quotation_item_id?: string
}

export async function POST(request: Request) {
  try {
    const ctx = await getAuthedContext()
    if ("error" in ctx) return ctx.error

    const body = (await request.json()) as {
      contract_id?: string
      items?: ItemInput[]
    }

    const contractId = body.contract_id
    const items = body.items

    if (typeof contractId !== "string" || !contractId) {
      return NextResponse.json({ error: "Invalid contract_id" }, { status: 400 })
    }
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Invalid items" }, { status: 400 })
    }

    const { data: contractRow, error: contractErr } = await ctx.supabase
      .from("contracts")
      .select("id")
      .eq("id", contractId)
      .eq("company_id", ctx.companyId)
      .maybeSingle()

    if (contractErr) {
      return NextResponse.json({ error: contractErr.message }, { status: 500 })
    }
    if (!contractRow) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 })
    }

    const rows: Record<string, unknown>[] = []
    for (const item of items) {
      if (
        typeof item.material_code !== "string" ||
        typeof item.material_description !== "string" ||
        typeof item.quantity_contracted !== "number" ||
        typeof item.unit_price !== "number" ||
        Number.isNaN(item.quantity_contracted) ||
        Number.isNaN(item.unit_price) ||
        item.quantity_contracted <= 0 ||
        item.unit_price < 0
      ) {
        return NextResponse.json({ error: "Invalid item payload" }, { status: 400 })
      }
      rows.push({
        contract_id: contractId,
        company_id: ctx.companyId,
        material_code: item.material_code,
        material_description: item.material_description,
        unit_of_measure: item.unit_of_measure ?? null,
        quantity_contracted: item.quantity_contracted,
        unit_price: item.unit_price,
        delivery_days: item.delivery_days ?? null,
        notes: item.notes ?? null,
        quotation_item_id: item.quotation_item_id ?? null,
      })
    }

    const { data: inserted, error: insertErr } = await ctx.supabase
      .from("contract_items")
      .insert(rows)
      .select("*")

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 })
    }

    const mapped: ContractItem[] = (inserted ?? []).map((row) =>
      contractItemFromRow(row),
    )

    return NextResponse.json({ items: mapped })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const ctx = await getAuthedContext()
    if ("error" in ctx) return ctx.error

    const id = new URL(request.url).searchParams.get("id")
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 })
    }

    const body = (await request.json()) as {
      eliminated?: boolean
      eliminated_reason?: string
    }

    if (typeof body.eliminated !== "boolean") {
      return NextResponse.json({ error: "Invalid eliminated" }, { status: 400 })
    }

    const eliminated_at = body.eliminated ? new Date().toISOString() : null
    const eliminated_reason = body.eliminated
      ? body.eliminated_reason != null
        ? String(body.eliminated_reason)
        : null
      : null

    const { data, error } = await ctx.supabase
      .from("contract_items")
      .update({
        eliminated: body.eliminated,
        eliminated_at,
        eliminated_reason,
      })
      .eq("id", id)
      .eq("company_id", ctx.companyId)
      .select("id")

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    if (!data?.length) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const ctx = await getAuthedContext()
    if ("error" in ctx) return ctx.error

    const id = new URL(request.url).searchParams.get("id")
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 })
    }

    const { data: deleted, error } = await ctx.supabase
      .from("contract_items")
      .delete()
      .eq("id", id)
      .eq("company_id", ctx.companyId)
      .select("id")

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    if (!deleted?.length) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
