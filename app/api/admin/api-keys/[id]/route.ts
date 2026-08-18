import { NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { requireSuperAdminCompany } from "@/lib/api/require-superadmin-company"

export const runtime = "nodejs"

type RouteParams = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const auth = await requireSuperAdminCompany(request)
    if ("error" in auth) return auth.error

    const { id } = await params
    const body = (await request.json()) as { active?: boolean; name?: string }

    const updates: Record<string, unknown> = {}
    if (typeof body.active === "boolean") updates.active = body.active
    if (body.name != null) {
      const name = String(body.name).trim()
      if (!name) {
        return NextResponse.json({ error: "name inválido." }, { status: 400 })
      }
      updates.name = name
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Nada para atualizar." }, { status: 400 })
    }

    const service = createServiceRoleClient()
    const { data, error } = await service
      .from("api_keys")
      .update(updates)
      .eq("id", id)
      .eq("company_id", auth.companyId)
      .select("id, name, key_prefix, scopes, active, expires_at, last_used_at, created_at")
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    if (!data) {
      return NextResponse.json({ error: "Chave não encontrada." }, { status: 404 })
    }

    return NextResponse.json({ key: data })
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const auth = await requireSuperAdminCompany(request)
    if ("error" in auth) return auth.error

    const { id } = await params
    const service = createServiceRoleClient()

    const { data, error } = await service
      .from("api_keys")
      .update({ active: false })
      .eq("id", id)
      .eq("company_id", auth.companyId)
      .select("id")
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    if (!data) {
      return NextResponse.json({ error: "Chave não encontrada." }, { status: 404 })
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
