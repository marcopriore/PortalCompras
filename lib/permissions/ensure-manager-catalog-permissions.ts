import type { SupabaseClient } from "@supabase/supabase-js"

const MANAGER_CATALOG_KEYS = [
  "nav.catalog",
  "catalog.order",
] as const

/**
 * Garante que o grupo de sistema `manager` possa ver e pedir no catálogo.
 * Upsert com enabled=true (gestor também atua como requisitante no catálogo).
 */
export async function ensureManagerCatalogPermissions(
  supabase: SupabaseClient,
  companyId: string,
): Promise<void> {
  const { data: managerGroup } = await supabase
    .from("permission_groups")
    .select("id")
    .eq("company_id", companyId)
    .eq("code", "manager")
    .eq("is_system", true)
    .maybeSingle()

  if (!managerGroup?.id) return

  const rows = MANAGER_CATALOG_KEYS.map((key) => ({
    company_id: companyId,
    group_id: managerGroup.id as string,
    permission_key: key,
    enabled: true,
  }))

  await supabase.from("permission_group_rules").upsert(rows, {
    onConflict: "group_id,permission_key",
  })
}
