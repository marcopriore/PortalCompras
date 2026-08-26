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

  return { companyId }
}

/** GET /api/categories?active=1 — lista categorias do tenant (para picklists). */
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
    const activeOnly = searchParams.get("active") !== "0"

    const service = createServiceRoleClient()
    let query = service
      .from("categories")
      .select("id, code, name, active")
      .eq("company_id", ctx.companyId)
      .order("name", { ascending: true })

    if (activeOnly) {
      query = query.eq("active", true)
    }

    const { data, error } = await query
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: { categories: data ?? [] } })
  } catch (err) {
    console.error("[categories]", err)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
