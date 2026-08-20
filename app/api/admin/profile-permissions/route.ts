import { NextResponse } from "next/server"
import { requireTenantAdmin } from "@/lib/api/require-tenant-admin"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { IMPERSONATION_PERMISSION } from "@/lib/impersonation/constants"

/** GET ?userId= — permissões individuais do usuário */
export async function GET(request: Request) {
  try {
    const auth = await requireTenantAdmin()
    if ("error" in auth) return auth.error

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("userId")
    if (!userId) {
      return NextResponse.json({ error: "userId obrigatório." }, { status: 400 })
    }

    const supabase = createServiceRoleClient()
    const { data: target } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .eq("company_id", auth.companyId)
      .maybeSingle()

    if (!target) {
      return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 })
    }

    const { data } = await supabase
      .from("profile_permissions")
      .select("permission_key, enabled")
      .eq("company_id", auth.companyId)
      .eq("user_id", userId)

    const permissions: Record<string, boolean> = {}
    for (const row of data ?? []) {
      permissions[row.permission_key] = Boolean(row.enabled)
    }

    return NextResponse.json({
      permissions,
      canImpersonate: Boolean(permissions[IMPERSONATION_PERMISSION]),
    })
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor." }, { status: 500 })
  }
}

/** PATCH — atualizar permissão individual (ex.: user.impersonate) */
export async function PATCH(request: Request) {
  try {
    const auth = await requireTenantAdmin()
    if ("error" in auth) return auth.error

    const body = (await request.json()) as {
      userId?: string
      permissionKey?: string
      enabled?: boolean
    }

    if (!body.userId || !body.permissionKey || typeof body.enabled !== "boolean") {
      return NextResponse.json({ error: "Parâmetros inválidos." }, { status: 400 })
    }

    if (body.permissionKey !== IMPERSONATION_PERMISSION) {
      return NextResponse.json({ error: "Permissão não suportada." }, { status: 400 })
    }

    const supabase = createServiceRoleClient()
    const { data: target } = await supabase
      .from("profiles")
      .select("id, full_name, is_superadmin")
      .eq("id", body.userId)
      .eq("company_id", auth.companyId)
      .maybeSingle()

    if (!target) {
      return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 })
    }

    if (target.is_superadmin) {
      return NextResponse.json(
        { error: "Superadmin já possui acesso total." },
        { status: 400 },
      )
    }

    const { error } = await supabase.from("profile_permissions").upsert(
      {
        company_id: auth.companyId,
        user_id: body.userId,
        permission_key: body.permissionKey,
        enabled: body.enabled,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "company_id,user_id,permission_key" },
    )

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor." }, { status: 500 })
  }
}
