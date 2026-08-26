import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import {
  formatTenantDeleteBlockers,
  getTenantDeleteEligibility,
} from "@/lib/admin/tenant-delete-eligibility"

export const runtime = "nodejs"

type RouteParams = {
  params: Promise<{ id: string }>
}

async function requireSuperAdmin() {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_superadmin, full_name")
    .eq("id", user.id)
    .single()

  if (!profile?.is_superadmin) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }

  return {
    user,
    userName:
      (profile as { full_name?: string | null }).full_name ?? user.email ?? null,
  }
}

/** GET — elegibilidade para exclusão definitiva (tenant vazio). */
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const auth = await requireSuperAdmin()
    if ("error" in auth) return auth.error

    const { id } = await params
    const companyId = decodeURIComponent(id).trim()
    if (!companyId) {
      return NextResponse.json({ error: "id obrigatório" }, { status: 400 })
    }

    const service = createServiceRoleClient()
    const { data: company } = await service
      .from("companies")
      .select("id")
      .eq("id", companyId)
      .maybeSingle()

    if (!company) {
      return NextResponse.json({ error: "Tenant não encontrado." }, { status: 404 })
    }

    const eligibility = await getTenantDeleteEligibility(service, companyId)
    return NextResponse.json({ data: eligibility })
  } catch (err) {
    console.error("[admin/tenants GET]", err)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}

/**
 * DELETE — exclusão definitiva só se não houver dados de negócio.
 * Remove usuários Auth do tenant e em seguida a company (CASCADE do seed).
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const auth = await requireSuperAdmin()
    if ("error" in auth) return auth.error

    const { id } = await params
    const companyId = decodeURIComponent(id).trim()
    if (!companyId) {
      return NextResponse.json({ error: "id obrigatório" }, { status: 400 })
    }

    const body = (await request.json().catch(() => ({}))) as {
      confirmName?: string
    }

    const service = createServiceRoleClient()
    const { data: company } = await service
      .from("companies")
      .select("id, name")
      .eq("id", companyId)
      .maybeSingle()

    if (!company) {
      return NextResponse.json({ error: "Tenant não encontrado." }, { status: 404 })
    }

    const companyName = String(company.name ?? "")
    const confirmName =
      typeof body.confirmName === "string" ? body.confirmName.trim() : ""

    if (!confirmName || confirmName !== companyName) {
      return NextResponse.json(
        {
          error:
            "Confirmação inválida. Digite o nome exato do tenant para excluir.",
        },
        { status: 400 },
      )
    }

    const eligibility = await getTenantDeleteEligibility(service, companyId)
    if (!eligibility.eligible) {
      return NextResponse.json(
        {
          error: formatTenantDeleteBlockers(eligibility.blockers),
          blockers: eligibility.blockers,
        },
        { status: 409 },
      )
    }

    const { data: profiles } = await service
      .from("profiles")
      .select("id")
      .eq("company_id", companyId)

    const authAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    for (const p of profiles ?? []) {
      const { error: delUserErr } = await authAdmin.auth.admin.deleteUser(p.id)
      if (delUserErr) {
        console.error("[admin/tenants DELETE] auth user", p.id, delUserErr.message)
        return NextResponse.json(
          {
            error: `Falha ao remover usuário do Auth: ${delUserErr.message}`,
          },
          { status: 500 },
        )
      }
    }

    // Limpa residual de profiles (caso Auth não tenha cascateado)
    await service.from("profiles").delete().eq("company_id", companyId)

    const { error: companyErr } = await service
      .from("companies")
      .delete()
      .eq("id", companyId)

    if (companyErr) {
      console.error("[admin/tenants DELETE] company", companyErr.message)
      return NextResponse.json(
        { error: `Falha ao excluir tenant: ${companyErr.message}` },
        { status: 500 },
      )
    }

    try {
      await service.from("audit_logs").insert({
        company_id: null,
        user_id: auth.user.id,
        user_name: auth.userName,
        event_type: "tenant.deleted",
        entity: "companies",
        entity_id: companyId,
        description: `Tenant "${companyName}" excluído definitivamente (vazio)`,
        metadata: {
          name: companyName,
          profile_count: eligibility.profileCount,
        },
      })
    } catch {
      // auditoria não bloqueia
    }

    return NextResponse.json({
      success: true,
      deleted_id: companyId,
      name: companyName,
    })
  } catch (err) {
    console.error("[admin/tenants DELETE]", err)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
