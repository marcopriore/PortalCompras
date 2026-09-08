import type { SupabaseClient } from "@supabase/supabase-js"
import { PERMISSION_CATALOG } from "@/lib/permissions/catalog"

/**
 * Garante que o grupo de sistema `admin` do tenant tenha todas as keys do catálogo
 * (exceto view_only). Só **insere** keys ausentes — não reativa rules desligadas.
 */
export async function ensureAdminGroupCatalogPermissions(
  supabase: SupabaseClient,
  companyId: string,
): Promise<void> {
  const { data: adminGroup } = await supabase
    .from("permission_groups")
    .select("id")
    .eq("company_id", companyId)
    .eq("code", "admin")
    .eq("is_system", true)
    .maybeSingle()

  if (!adminGroup?.id) return

  const { data: existing } = await supabase
    .from("permission_group_rules")
    .select("permission_key")
    .eq("company_id", companyId)
    .eq("group_id", adminGroup.id)

  const have = new Set(
    ((existing ?? []) as { permission_key: string }[]).map((r) => r.permission_key),
  )

  const missing = PERMISSION_CATALOG.filter(
    (p) => p.key !== "view_only" && !have.has(p.key),
  ).map((p) => ({
    company_id: companyId,
    group_id: adminGroup.id as string,
    permission_key: p.key,
    enabled: true,
  }))

  if (missing.length === 0) return

  await supabase.from("permission_group_rules").upsert(missing, {
    onConflict: "group_id,permission_key",
  })
}
