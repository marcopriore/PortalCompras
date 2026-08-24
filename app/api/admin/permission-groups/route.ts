import { NextResponse } from "next/server"
import { requireTenantAdmin } from "@/lib/api/require-tenant-admin"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { isKnownPermissionKey } from "@/lib/permissions/catalog"

type GroupRow = {
  id: string
  code: string
  name: string
  description: string | null
  is_system: boolean
  source_role: string | null
}

/** GET — lista grupos do tenant (+ rules se ?withRules=1) */
export async function GET(request: Request) {
  try {
    const auth = await requireTenantAdmin()
    if ("error" in auth) return auth.error

    const { searchParams } = new URL(request.url)
    const withRules = searchParams.get("withRules") === "1"
    const groupId = searchParams.get("id")

    const supabase = createServiceRoleClient()

    if (groupId) {
      const { data: group, error } = await supabase
        .from("permission_groups")
        .select("id, code, name, description, is_system, source_role")
        .eq("company_id", auth.companyId)
        .eq("id", groupId)
        .maybeSingle()

      if (error || !group) {
        return NextResponse.json({ error: "Grupo não encontrado." }, { status: 404 })
      }

      const { data: rules } = await supabase
        .from("permission_group_rules")
        .select("permission_key, enabled")
        .eq("company_id", auth.companyId)
        .eq("group_id", groupId)

      const permissions: Record<string, boolean> = {}
      for (const row of rules ?? []) {
        if (row.enabled) permissions[row.permission_key] = true
      }

      return NextResponse.json({ group, permissions })
    }

    const { data: groups, error } = await supabase
      .from("permission_groups")
      .select("id, code, name, description, is_system, source_role")
      .eq("company_id", auth.companyId)
      .order("is_system", { ascending: false })
      .order("name", { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!withRules) {
      return NextResponse.json({ groups: (groups ?? []) as GroupRow[] })
    }

    const ids = ((groups ?? []) as GroupRow[]).map((g) => g.id)
    const { data: rules } = ids.length
      ? await supabase
          .from("permission_group_rules")
          .select("group_id, permission_key, enabled")
          .eq("company_id", auth.companyId)
          .in("group_id", ids)
          .eq("enabled", true)
      : { data: [] as { group_id: string; permission_key: string; enabled: boolean }[] }

    const rulesByGroup = new Map<string, string[]>()
    for (const row of rules ?? []) {
      const list = rulesByGroup.get(row.group_id) ?? []
      list.push(row.permission_key)
      rulesByGroup.set(row.group_id, list)
    }

    return NextResponse.json({
      groups: ((groups ?? []) as GroupRow[]).map((g) => ({
        ...g,
        permission_keys: rulesByGroup.get(g.id) ?? [],
      })),
    })
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor." }, { status: 500 })
  }
}

/** POST — criar grupo customizado */
export async function POST(request: Request) {
  try {
    const auth = await requireTenantAdmin()
    if ("error" in auth) return auth.error

    const body = (await request.json()) as {
      name?: string
      code?: string
      description?: string
      permissionKeys?: string[]
    }

    const name = body.name?.trim()
    if (!name) {
      return NextResponse.json({ error: "Nome obrigatório." }, { status: 400 })
    }

    const code =
      body.code?.trim().toLowerCase().replace(/\s+/g, "_") ||
      `custom_${Date.now().toString(36)}`

    const keys = (body.permissionKeys ?? []).filter(isKnownPermissionKey)
    const supabase = createServiceRoleClient()

    const { data: group, error } = await supabase
      .from("permission_groups")
      .insert({
        company_id: auth.companyId,
        code,
        name,
        description: body.description?.trim() || null,
        is_system: false,
        source_role: null,
      })
      .select("id, code, name, description, is_system, source_role")
      .single()

    if (error || !group) {
      return NextResponse.json(
        { error: error?.message ?? "Não foi possível criar o grupo." },
        { status: 500 },
      )
    }

    if (keys.length > 0) {
      await supabase.from("permission_group_rules").insert(
        keys.map((permission_key) => ({
          company_id: auth.companyId,
          group_id: group.id,
          permission_key,
          enabled: true,
        })),
      )
    }

    return NextResponse.json({ group })
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor." }, { status: 500 })
  }
}

/** PATCH — atualizar grupo e/ou rules */
export async function PATCH(request: Request) {
  try {
    const auth = await requireTenantAdmin()
    if ("error" in auth) return auth.error

    const body = (await request.json()) as {
      id?: string
      name?: string
      description?: string | null
      permissionKeys?: string[]
    }

    if (!body.id) {
      return NextResponse.json({ error: "id obrigatório." }, { status: 400 })
    }

    const supabase = createServiceRoleClient()
    const { data: existing } = await supabase
      .from("permission_groups")
      .select("id, is_system")
      .eq("company_id", auth.companyId)
      .eq("id", body.id)
      .maybeSingle()

    if (!existing) {
      return NextResponse.json({ error: "Grupo não encontrado." }, { status: 404 })
    }

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (typeof body.name === "string" && body.name.trim()) {
      patch.name = body.name.trim()
    }
    if (body.description !== undefined) {
      patch.description = body.description?.trim() || null
    }

    const { error: updErr } = await supabase
      .from("permission_groups")
      .update(patch)
      .eq("id", body.id)
      .eq("company_id", auth.companyId)

    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 })
    }

    if (Array.isArray(body.permissionKeys)) {
      const keys = body.permissionKeys.filter(isKnownPermissionKey)
      await supabase
        .from("permission_group_rules")
        .delete()
        .eq("company_id", auth.companyId)
        .eq("group_id", body.id)

      if (keys.length > 0) {
        await supabase.from("permission_group_rules").insert(
          keys.map((permission_key) => ({
            company_id: auth.companyId,
            group_id: body.id!,
            permission_key,
            enabled: true,
          })),
        )
      }
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor." }, { status: 500 })
  }
}

/** DELETE — remove grupo customizado (não sistema) */
export async function DELETE(request: Request) {
  try {
    const auth = await requireTenantAdmin()
    if ("error" in auth) return auth.error

    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")
    if (!id) {
      return NextResponse.json({ error: "id obrigatório." }, { status: 400 })
    }

    const supabase = createServiceRoleClient()
    const { data: existing } = await supabase
      .from("permission_groups")
      .select("id, is_system")
      .eq("company_id", auth.companyId)
      .eq("id", id)
      .maybeSingle()

    if (!existing) {
      return NextResponse.json({ error: "Grupo não encontrado." }, { status: 404 })
    }
    if (existing.is_system) {
      return NextResponse.json(
        { error: "Grupos de sistema não podem ser excluídos." },
        { status: 400 },
      )
    }

    const { error } = await supabase
      .from("permission_groups")
      .delete()
      .eq("id", id)
      .eq("company_id", auth.companyId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor." }, { status: 500 })
  }
}
