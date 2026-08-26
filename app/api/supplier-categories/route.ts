import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

export const runtime = "nodejs"

async function resolveBuyerCompany(userId: string) {
  const supabase = await createClient()
  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id, is_superadmin, profile_type")
    .eq("id", userId)
    .single()

  if (!profile || profile.profile_type !== "buyer") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }

  let companyId = profile.company_id as string | null
  if (profile.is_superadmin) {
    const cookieStore = await cookies()
    const selected = cookieStore.get("selected_company_id")?.value
    if (selected) companyId = decodeURIComponent(selected)
  }
  if (!companyId) {
    return { error: NextResponse.json({ error: "Company not found" }, { status: 404 }) }
  }

  return { companyId, userId }
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const ctx = await resolveBuyerCompany(user.id)
    if ("error" in ctx) return ctx.error

    const { searchParams } = new URL(request.url)
    const supplierId = searchParams.get("supplier_id")
    const includeAvailable = searchParams.get("available") === "true"

    if (!supplierId) {
      return NextResponse.json({ error: "Missing supplier_id" }, { status: 400 })
    }

    const service = createServiceRoleClient()

    const { data: linkedRows, error: linkedError } = await service
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

    const { data: masterRows, error: availableError } = await service
      .from("categories")
      .select("name")
      .eq("company_id", ctx.companyId)
      .eq("active", true)
      .order("name", { ascending: true })

    if (availableError) {
      return NextResponse.json({ error: availableError.message }, { status: 500 })
    }

    const available = Array.from(
      new Set(
        (masterRows ?? [])
          .map((row) => (row.name as string | null)?.trim())
          .filter((category): category is string => Boolean(category)),
      ),
    )

    return NextResponse.json({ categories, available })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const ctx = await resolveBuyerCompany(user.id)
    if ("error" in ctx) return ctx.error

    const body = (await request.json()) as { supplier_id?: string; category?: string }
    if (!body.supplier_id || !body.category?.trim()) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
    }

    const category = body.category.trim()
    const service = createServiceRoleClient()

    const { data: master } = await service
      .from("categories")
      .select("id")
      .eq("company_id", ctx.companyId)
      .eq("active", true)
      .eq("name", category)
      .maybeSingle()

    if (!master) {
      return NextResponse.json(
        {
          error:
            "Categoria não cadastrada. Cadastre em Configurações → Categorias.",
        },
        { status: 400 },
      )
    }

    const { error } = await service.from("supplier_categories").insert({
      company_id: ctx.companyId,
      supplier_id: body.supplier_id,
      category,
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
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const ctx = await resolveBuyerCompany(user.id)
    if ("error" in ctx) return ctx.error

    const body = (await request.json()) as { supplier_id?: string; category?: string }
    if (!body.supplier_id || !body.category?.trim()) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
    }

    const service = createServiceRoleClient()
    const { error } = await service
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
