import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

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

export async function GET(request: Request) {
  try {
    const ctx = await getAuthedContext()
    if ("error" in ctx) return ctx.error

    const { searchParams } = new URL(request.url)
    const supplierId = searchParams.get("supplier_id")
    const includeAvailable = searchParams.get("available") === "true"

    if (!supplierId) {
      return NextResponse.json({ error: "Missing supplier_id" }, { status: 400 })
    }

    const { data: linkedRows, error: linkedError } = await ctx.supabase
      .from("supplier_categories")
      .select("category")
      .eq("supplier_id", supplierId)
      .eq("company_id", ctx.companyId)

    if (linkedError) {
      return NextResponse.json({ error: linkedError.message }, { status: 500 })
    }

    const categories = (linkedRows ?? [])
      .map((row) => row.category as string)
      .filter(Boolean)

    if (!includeAvailable) {
      return NextResponse.json({ categories })
    }

    const { data: itemRows, error: availableError } = await ctx.supabase
      .from("items")
      .select("commodity_group")
      .eq("company_id", ctx.companyId)
      .not("commodity_group", "is", null)

    if (availableError) {
      return NextResponse.json({ error: availableError.message }, { status: 500 })
    }

    const available = Array.from(
      new Set(
        (itemRows ?? [])
          .map((row) => (row.commodity_group as string | null)?.trim())
          .filter((category): category is string => Boolean(category)),
      ),
    ).sort((a, b) => a.localeCompare(b, "pt-BR"))

    return NextResponse.json({ categories, available })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await getAuthedContext()
    if ("error" in ctx) return ctx.error

    const body = (await request.json()) as { supplier_id?: string; category?: string }
    if (!body.supplier_id || !body.category?.trim()) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
    }

    const { error } = await ctx.supabase.from("supplier_categories").insert({
      company_id: ctx.companyId,
      supplier_id: body.supplier_id,
      category: body.category.trim(),
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
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

    const body = (await request.json()) as { supplier_id?: string; category?: string }
    if (!body.supplier_id || !body.category?.trim()) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
    }

    const { error } = await ctx.supabase
      .from("supplier_categories")
      .delete()
      .eq("supplier_id", body.supplier_id)
      .eq("category", body.category.trim())
      .eq("company_id", ctx.companyId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
