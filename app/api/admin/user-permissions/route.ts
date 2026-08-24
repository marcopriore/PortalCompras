import { NextResponse } from "next/server"
import { requireTenantAdmin } from "@/lib/api/require-tenant-admin"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { isKnownPermissionKey } from "@/lib/permissions/catalog"
import { IMPERSONATION_PERMISSION } from "@/lib/impersonation/constants"

/** GET ?userId= — grupos + rules diretas + efetivo */
export async function GET(request: Request) {
  try {
    const auth = await requireTenantAdmin()
    if ("error" in auth) return auth.error

    const userId = new URL(request.url).searchParams.get("userId")
    if (!userId) {
      return NextResponse.json({ error: "userId obrigatório." }, { status: 400 })
    }

    const supabase = createServiceRoleClient()
    const { data: target } = await supabase
      .from("profiles")
      .select("id, is_superadmin")
      .eq("id", userId)
      .eq("company_id", auth.companyId)
      .maybeSingle()

    if (!target) {
      return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 })
    }

    const [groupsRes, directRes] = await Promise.all([
      supabase
        .from("profile_permission_groups")
        .select("group_id, permission_groups(id, code, name, is_system)")
        .eq("company_id", auth.companyId)
        .eq("user_id", userId),
      supabase
        .from("profile_permissions")
        .select("permission_key, enabled")
        .eq("company_id", auth.companyId)
        .eq("user_id", userId)
        .eq("enabled", true),
    ])

    const groups = (groupsRes.data ?? []).map((row) => {
      const g = Array.isArray(row.permission_groups)
        ? row.permission_groups[0]
        : row.permission_groups
      return {
        id: (g as { id: string } | null)?.id ?? (row.group_id as string),
        code: (g as { code?: string } | null)?.code ?? "",
        name: (g as { name?: string } | null)?.name ?? "",
        is_system: Boolean((g as { is_system?: boolean } | null)?.is_system),
      }
    })

    const groupIds = groups.map((g) => g.id).filter(Boolean)
    const { data: groupRules } = groupIds.length
      ? await supabase
          .from("permission_group_rules")
          .select("permission_key")
          .eq("company_id", auth.companyId)
          .in("group_id", groupIds)
          .eq("enabled", true)
      : { data: [] as { permission_key: string }[] }

    const directKeys = (directRes.data ?? []).map((r) => r.permission_key)
    const fromGroups = new Set((groupRules ?? []).map((r) => r.permission_key))
    const effective = new Set<string>([...fromGroups, ...directKeys])

    return NextResponse.json({
      groupIds: groups.map((g) => g.id),
      groups,
      directPermissionKeys: directKeys,
      effectivePermissionKeys: [...effective],
      canImpersonate: effective.has(IMPERSONATION_PERMISSION),
      isSuperAdmin: Boolean(target.is_superadmin),
    })
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor." }, { status: 500 })
  }
}

/** PUT — substitui grupos e rules diretas do usuário */
export async function PUT(request: Request) {
  try {
    const auth = await requireTenantAdmin()
    if ("error" in auth) return auth.error

    const body = (await request.json()) as {
      userId?: string
      groupIds?: string[]
      directPermissionKeys?: string[]
    }

    if (!body.userId || !Array.isArray(body.groupIds) || !Array.isArray(body.directPermissionKeys)) {
      return NextResponse.json({ error: "Parâmetros inválidos." }, { status: 400 })
    }

    const supabase = createServiceRoleClient()
    const { data: target } = await supabase
      .from("profiles")
      .select("id, is_superadmin")
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

    const groupIds = [...new Set(body.groupIds.filter(Boolean))]
    if (groupIds.length > 0) {
      const { data: validGroups } = await supabase
        .from("permission_groups")
        .select("id")
        .eq("company_id", auth.companyId)
        .in("id", groupIds)
      const valid = new Set((validGroups ?? []).map((g) => g.id))
      if (groupIds.some((id) => !valid.has(id))) {
        return NextResponse.json({ error: "Grupo inválido." }, { status: 400 })
      }
    }

    const directKeys = [
      ...new Set(body.directPermissionKeys.filter(isKnownPermissionKey)),
    ]

    await supabase
      .from("profile_permission_groups")
      .delete()
      .eq("company_id", auth.companyId)
      .eq("user_id", body.userId)

    if (groupIds.length > 0) {
      const { error } = await supabase.from("profile_permission_groups").insert(
        groupIds.map((group_id) => ({
          company_id: auth.companyId,
          user_id: body.userId!,
          group_id,
        })),
      )
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
    }

    // Substitui rules diretas: desliga todas conhecidas e liga as selecionadas
    const { data: existingDirect } = await supabase
      .from("profile_permissions")
      .select("permission_key")
      .eq("company_id", auth.companyId)
      .eq("user_id", body.userId)

    const existingKeys = new Set((existingDirect ?? []).map((r) => r.permission_key))
    const toDisable = [...existingKeys].filter((k) => !directKeys.includes(k))
    const now = new Date().toISOString()

    if (toDisable.length > 0) {
      await supabase
        .from("profile_permissions")
        .update({ enabled: false, updated_at: now })
        .eq("company_id", auth.companyId)
        .eq("user_id", body.userId)
        .in("permission_key", toDisable)
    }

    if (directKeys.length > 0) {
      const { error } = await supabase.from("profile_permissions").upsert(
        directKeys.map((permission_key) => ({
          company_id: auth.companyId,
          user_id: body.userId!,
          permission_key,
          enabled: true,
          updated_at: now,
        })),
        { onConflict: "company_id,user_id,permission_key" },
      )
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor." }, { status: 500 })
  }
}
