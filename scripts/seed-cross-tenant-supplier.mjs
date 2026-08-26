/**
 * Seed one-shot: mesmo fornecedor (mesmo CNPJ) em 2+ tenants.
 * Para validar /admin/fornecedores (agregação cross-tenant).
 * NÃO é migration — ver .cursor/rules/prd-no-test-data.mdc
 *
 * Uso (raiz, .env.local com URL + SERVICE_ROLE):
 *   npm run seed:cross-supplier
 *   node scripts/seed-cross-tenant-supplier.mjs
 *   node scripts/seed-cross-tenant-supplier.mjs --company-ids=<uuid1>,<uuid2>
 *   node scripts/seed-cross-tenant-supplier.mjs --limit=3
 */

import { createClient } from "@supabase/supabase-js"
import { config } from "dotenv"
import { resolve } from "path"

config({ path: resolve(process.cwd(), ".env.local") })

const SHARED = {
  code: "CROSS-001",
  name: "Fornecedor Cross-Tenant Demo",
  /** CNPJ fixo (14 dígitos) — chave de agregação no admin */
  cnpj: "11222333000181",
  email: "contato@cross-tenant.demo",
  phone: "11 98888-0001",
  city: "São Paulo",
  state: "SP",
  status: "active",
  category: "Serviços Gerais",
}

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

  const idsArg = argValue("--company-ids=")
  const limit = Math.max(2, Number(argValue("--limit=") || "2") || 2)

  let companies = []

  if (idsArg) {
    const ids = idsArg
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
    if (ids.length < 2) {
      console.error("Informe pelo menos 2 UUIDs em --company-ids=")
      process.exit(1)
    }
    const { data, error } = await supabase
      .from("companies")
      .select("id, name, status")
      .in("id", ids)
    if (error) throw new Error(error.message)
    companies = data ?? []
    if (companies.length < 2) {
      console.error("Menos de 2 tenants encontrados para os IDs informados.")
      process.exit(1)
    }
  } else {
    const { data, error } = await supabase
      .from("companies")
      .select("id, name, status")
      .eq("status", "active")
      .order("name", { ascending: true })
      .limit(Math.max(limit, 10))
    if (error) throw new Error(error.message)
    companies = (data ?? []).slice(0, limit)
    if (companies.length < 2) {
      console.error(
        `Precisa de pelo menos 2 tenants active (encontrou ${companies.length}). Crie outro tenant ou use --company-ids=.`,
      )
      process.exit(1)
    }
  }

  console.log(
    `→ Upsert "${SHARED.name}" (CNPJ ${SHARED.cnpj}) em ${companies.length} tenant(s):`,
  )
  for (const c of companies) {
    console.log(`   - ${c.name} (${c.id})`)
  }

  const rows = companies.map((c) => ({
    company_id: c.id,
    code: SHARED.code,
    name: SHARED.name,
    cnpj: SHARED.cnpj,
    email: SHARED.email,
    phone: SHARED.phone,
    city: SHARED.city,
    state: SHARED.state,
    status: SHARED.status,
    category: SHARED.category,
  }))

  const { error: upsertErr } = await supabase
    .from("suppliers")
    .upsert(rows, { onConflict: "company_id,code" })
  if (upsertErr) throw new Error(`suppliers upsert: ${upsertErr.message}`)

  const { data: saved, error: readErr } = await supabase
    .from("suppliers")
    .select("id, company_id, code, name, cnpj, companies(name)")
    .eq("cnpj", SHARED.cnpj)
    .eq("code", SHARED.code)
  if (readErr) throw new Error(readErr.message)

  console.log("✓ Fornecedores gravados:")
  for (const s of saved ?? []) {
    const tenantName = Array.isArray(s.companies)
      ? s.companies[0]?.name
      : s.companies?.name
    console.log(`   ${tenantName ?? s.company_id} → supplier_id=${s.id}`)
  }

  console.log(
    "\nAbra /admin/fornecedores e busque por \"Cross-Tenant\" ou CNPJ 11.222.333/0001-81.",
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
