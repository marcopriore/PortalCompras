import type { SupabaseClient } from "@supabase/supabase-js"
import {
  LEGACY_ROLE_GROUPS,
  PERMISSION_CATALOG,
} from "@/lib/permissions/catalog"

/**
 * Cria grupos de sistema no tenant novo.
 * Preferência: clonar de outro tenant que já tem grupos de sistema.
 * Fallback: shells LEGACY_ROLE_GROUPS + Admin com todo o catálogo (exceto view_only).
 */
export async function seedSystemPermissionGroups(
  supabase: SupabaseClient,
  companyId: string,
): Promise<void> {
  const { data: templateGroup } = await supabase
    .from("permission_groups")
    .select("company_id")
    .eq("is_system", true)
    .eq("code", "admin")
    .neq("company_id", companyId)
    .limit(1)
    .maybeSingle()

  const templateCompanyId =
    templateGroup && typeof templateGroup.company_id === "string"
      ? templateGroup.company_id
      : null

  if (templateCompanyId) {
    await cloneSystemPermissionGroups(supabase, templateCompanyId, companyId)
    return
  }

  await seedFallbackSystemPermissionGroups(supabase, companyId)
}

async function cloneSystemPermissionGroups(
  supabase: SupabaseClient,
  fromCompanyId: string,
  toCompanyId: string,
): Promise<void> {
  const { data: sourceGroups } = await supabase
    .from("permission_groups")
    .select("id, code, name, description, is_system, source_role")
    .eq("company_id", fromCompanyId)
    .eq("is_system", true)

  if (!sourceGroups?.length) {
    await seedFallbackSystemPermissionGroups(supabase, toCompanyId)
    return
  }

  const idMap = new Map<string, string>()

  for (const g of sourceGroups) {
    const { data: inserted, error } = await supabase
      .from("permission_groups")
      .upsert(
        {
          company_id: toCompanyId,
          code: g.code,
          name: g.name,
          description: g.description,
          is_system: true,
          source_role: g.source_role ?? g.code,
        },
        { onConflict: "company_id,code" },
      )
      .select("id")
      .single()

    if (error || !inserted?.id) continue
    idMap.set(g.id, inserted.id as string)
  }

  const sourceIds = [...idMap.keys()]
  if (sourceIds.length === 0) return

  const { data: sourceRules } = await supabase
    .from("permission_group_rules")
    .select("group_id, permission_key, enabled")
    .eq("company_id", fromCompanyId)
    .in("group_id", sourceIds)

  const ruleRows = (sourceRules ?? [])
    .map((r) => {
      const newGroupId = idMap.get(r.group_id)
      if (!newGroupId) return null
      return {
        company_id: toCompanyId,
        group_id: newGroupId,
        permission_key: r.permission_key,
        enabled: r.enabled !== false,
      }
    })
    .filter((r): r is NonNullable<typeof r> => r != null)

  if (ruleRows.length > 0) {
    await supabase.from("permission_group_rules").upsert(ruleRows, {
      onConflict: "group_id,permission_key",
    })
  }
}

async function seedFallbackSystemPermissionGroups(
  supabase: SupabaseClient,
  companyId: string,
): Promise<void> {
  for (const g of LEGACY_ROLE_GROUPS) {
    const { data: group, error } = await supabase
      .from("permission_groups")
      .upsert(
        {
          company_id: companyId,
          code: g.code,
          name: g.name,
          description: g.description,
          is_system: true,
          source_role: g.code,
        },
        { onConflict: "company_id,code" },
      )
      .select("id")
      .single()

    if (error || !group?.id) continue

    if (g.code === "admin") {
      const rules = PERMISSION_CATALOG.filter((p) => p.key !== "view_only").map(
        (p) => ({
          company_id: companyId,
          group_id: group.id as string,
          permission_key: p.key,
          enabled: true,
        }),
      )
      if (rules.length > 0) {
        await supabase.from("permission_group_rules").upsert(rules, {
          onConflict: "group_id,permission_key",
        })
      }
    }
  }
}

export async function assignPermissionGroupsByRoleCodes(
  supabase: SupabaseClient,
  companyId: string,
  userId: string,
  roleCodes: string[],
): Promise<void> {
  if (roleCodes.length === 0) return

  const { data: matchingGroups } = await supabase
    .from("permission_groups")
    .select("id, code")
    .eq("company_id", companyId)
    .in("code", roleCodes)

  if (!matchingGroups?.length) return

  await supabase.from("profile_permission_groups").upsert(
    matchingGroups.map((g) => ({
      company_id: companyId,
      user_id: userId,
      group_id: g.id,
    })),
    { onConflict: "company_id,user_id,group_id" },
  )
}
