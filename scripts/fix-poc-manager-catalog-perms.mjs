/**
 * One-shot: alinha catálogo do grupo manager na Apresentação POC.
 * Remove view_only; garante catalog.view + catalog.order + nav.catalog.
 *
 *   node scripts/fix-poc-manager-catalog-perms.mjs
 */
import { createClient } from "@supabase/supabase-js"
import { config } from "dotenv"
import { resolve } from "path"

config({ path: resolve(process.cwd(), ".env.local"), quiet: true })

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error("Missing env")
  process.exit(1)
}

const sb = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const { data: company } = await sb
  .from("companies")
  .select("id, name")
  .eq("name", "Apresentação POC")
  .maybeSingle()

if (!company?.id) {
  console.error("Tenant Apresentação POC não encontrado")
  process.exit(1)
}

const { data: manager } = await sb
  .from("permission_groups")
  .select("id, name")
  .eq("company_id", company.id)
  .eq("code", "manager")
  .eq("is_system", true)
  .maybeSingle()

if (!manager?.id) {
  console.error("Grupo manager não encontrado")
  process.exit(1)
}

const enableKeys = ["nav.catalog", "catalog.view", "catalog.order"]

const { error: upsertErr } = await sb.from("permission_group_rules").upsert(
  enableKeys.map((permission_key) => ({
    company_id: company.id,
    group_id: manager.id,
    permission_key,
    enabled: true,
  })),
  { onConflict: "group_id,permission_key" },
)

if (upsertErr) {
  console.error("upsert failed", upsertErr.message)
  process.exit(1)
}

const { error: delErr } = await sb
  .from("permission_group_rules")
  .delete()
  .eq("company_id", company.id)
  .eq("group_id", manager.id)
  .eq("permission_key", "view_only")

if (delErr) {
  console.error("delete view_only failed", delErr.message)
  process.exit(1)
}

const { data: check } = await sb
  .from("permission_group_rules")
  .select("permission_key, enabled")
  .eq("group_id", manager.id)
  .in("permission_key", [...enableKeys, "view_only"])

console.log(`OK ${company.name} / ${manager.name}`)
console.log(check)
