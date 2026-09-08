/**
 * One-shot: sincroniza keys do catálogo no grupo sistema `admin` do tenant.
 * Só **insere** keys ausentes (não reativa rules desligadas).
 *
 *   npm run sync:admin-permissions
 *   node scripts/sync-admin-group-permissions.mjs --company-id=<uuid>
 */

import { createClient } from "@supabase/supabase-js"
import { config } from "dotenv"
import { resolve } from "path"

config({ path: resolve(process.cwd(), ".env.local") })

/** Espelho do PERMISSION_CATALOG (exceto view_only) — manter alinhado ao catalog.ts */
const CATALOG_KEYS = [
  "nav.dashboard",
  "nav.requisitions",
  "nav.quotations",
  "nav.orders",
  "nav.contracts",
  "nav.items",
  "nav.suppliers",
  "nav.reports",
  "nav.catalog",
  "dashboard.metrics",
  "dashboard.spend_category",
  "dashboard.quotation_status",
  "dashboard.recent_activity",
  "dashboard.lead_time",
  "dashboard.roi",
  "reports.saving",
  "reports.spend",
  "reports.orders",
  "reports.quotations",
  "reports.export.spend_category",
  "reports.export.supplier_performance",
  "reports.export.saving",
  "reports.export.process_time",
  "quotation.create",
  "quotation.edit",
  "quotation.cancel",
  "quotation.equalize.view",
  "quotation.equalize.select",
  "quotation.view_all",
  "quotation.delegate",
  "order.create",
  "order.edit",
  "order.edit_own",
  "order.view_all",
  "order.delegate",
  "contract.view",
  "contract.create",
  "contract.edit",
  "requisition.create.buyer",
  "requisition.create.requester",
  "requisition.approve",
  "requisition.view_all",
  "catalog.order",
  "approval.requisition",
  "approval.order",
  "approval.catalog_order",
  "approval.view_all",
  "export.excel",
  "import.excel",
  "erp.sync",
  "integration.monitor",
  "supplier.create",
  "supplier.edit",
  "item.create",
  "item.edit",
  "user.manage",
  "user.impersonate",
  "settings.manage",
  "portal.solicitante",
]

function argValue(prefix) {
  const hit = process.argv.find((a) => a.startsWith(prefix))
  return hit ? hit.slice(prefix.length) : null
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error("Faltam NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY no .env.local")
    process.exit(1)
  }

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  let companyId = argValue("--company-id=")
  if (!companyId) {
    const { data: poc } = await supabase
      .from("companies")
      .select("id, name")
      .eq("name", "Apresentação POC")
      .maybeSingle()
    companyId = poc?.id ?? null
  }
  if (!companyId) {
    console.error("Informe --company-id=<uuid>")
    process.exit(1)
  }

  const { data: company } = await supabase
    .from("companies")
    .select("id, name")
    .eq("id", companyId)
    .single()

  console.log(`→ Tenant: ${company?.name} (${companyId})`)

  const { data: adminGroup } = await supabase
    .from("permission_groups")
    .select("id, name")
    .eq("company_id", companyId)
    .eq("code", "admin")
    .eq("is_system", true)
    .maybeSingle()

  if (!adminGroup?.id) {
    console.error("Grupo sistema admin não encontrado neste tenant.")
    process.exit(1)
  }

  const { data: existing } = await supabase
    .from("permission_group_rules")
    .select("permission_key")
    .eq("company_id", companyId)
    .eq("group_id", adminGroup.id)

  const have = new Set((existing ?? []).map((r) => r.permission_key))
  const missing = CATALOG_KEYS.filter((k) => !have.has(k))

  if (missing.length === 0) {
    console.log("✓ Grupo Administrador já está sincronizado com o catálogo.")
  } else {
    const rows = missing.map((permission_key) => ({
      company_id: companyId,
      group_id: adminGroup.id,
      permission_key,
      enabled: true,
    }))
    const { error } = await supabase.from("permission_group_rules").upsert(rows, {
      onConflict: "group_id,permission_key",
    })
    if (error) throw new Error(error.message)
    console.log(`✓ Inseridas ${missing.length} permissions em ${adminGroup.name}:`)
    for (const k of missing) console.log(`  - ${k}`)
  }

  // Garante vínculo do usuário adminpoc / admin do tenant ao grupo admin
  const { data: adminProfiles } = await supabase
    .from("profiles")
    .select("id, full_name, role, roles")
    .eq("company_id", companyId)
    .eq("is_superadmin", false)

  const candidates = (adminProfiles ?? []).filter((p) => {
    const roles = Array.isArray(p.roles) ? p.roles : []
    return (
      p.role === "admin" ||
      roles.includes("admin") ||
      String(p.full_name ?? "")
        .toLowerCase()
        .includes("administrador")
    )
  })

  for (const p of candidates) {
    const { error } = await supabase.from("profile_permission_groups").upsert(
      {
        company_id: companyId,
        user_id: p.id,
        group_id: adminGroup.id,
      },
      { onConflict: "company_id,user_id,group_id" },
    )
    if (error) {
      console.warn(`  ! vínculo ${p.full_name}: ${error.message}`)
      continue
    }
    console.log(`✓ Usuário vinculado ao grupo admin: ${p.full_name} (${p.id})`)

    // Alinha roles legado com o grupo Administrador
    const roles = Array.isArray(p.roles) ? [...p.roles] : []
    if (!roles.includes("admin")) roles.unshift("admin")
    const { error: roleErr } = await supabase
      .from("profiles")
      .update({
        roles,
        role: "admin",
        profile_type: "buyer",
      })
      .eq("id", p.id)
      .eq("company_id", companyId)
    if (roleErr) {
      console.warn(`  ! roles ${p.full_name}: ${roleErr.message}`)
    } else {
      console.log(`  → roles atualizado para incluir admin`)
    }
  }
}

main().catch((err) => {
  console.error("Falha:", err.message || err)
  process.exit(1)
})
