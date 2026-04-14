import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get("company_id")
    if (!companyId) {
      return NextResponse.json({ error: "Missing company_id" }, { status: 400 })
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id, profile_type")
      .eq("id", user.id)
      .single()

    const isSupplier = profile?.profile_type === "supplier"
    const sameCompany = profile?.company_id === companyId
    if (!isSupplier && !sameCompany) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const service = createServiceRoleClient()
    const { data: term } = await service
      .from("supplier_terms")
      .select("id, title, content, version, version_date")
      .eq("company_id", companyId)
      .eq("active", true)
      .maybeSingle()

    return NextResponse.json({ term: term ?? null })
  } catch (e) {
    console.error("supplier-terms GET:", e)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      companyId?: string
      title?: string
      content?: string
      version?: string
      version_date?: string
    }

    if (!body.companyId || !body.content || !body.version || !body.version_date) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id, is_superadmin, roles")
      .eq("id", user.id)
      .single()

    const roles = (profile?.roles as string[] | null) ?? []
    const isAdmin = Boolean(profile?.is_superadmin || roles.includes("admin"))
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    if (!profile?.is_superadmin && profile?.company_id !== body.companyId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const service = createServiceRoleClient()

    await service
      .from("supplier_terms")
      .update({ active: false })
      .eq("company_id", body.companyId)
      .eq("active", true)

    const { data: term, error } = await service
      .from("supplier_terms")
      .insert({
        company_id: body.companyId,
        title: body.title?.trim() || "Termos e Condições de Fornecimento",
        content: body.content.trim(),
        version: body.version.trim(),
        version_date: body.version_date,
        active: true,
      })
      .select("id, title, content, version, version_date")
      .single()

    if (error) throw error

    return NextResponse.json({ term })
  } catch (e) {
    console.error("supplier-terms POST:", e)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
