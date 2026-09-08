/**
 * One-shot: alinha alçadas e fila pending do tenant Apresentação POC
 * aos usuários operacionais de smoke (docs/PRD-TEST-ACCESS.md).
 *
 *   node scripts/remap-poc-smoke-approvers.mjs
 *   node scripts/remap-poc-smoke-approvers.mjs --company-id=<uuid>
 *
 * Não é migration — ver prd-no-test-data.mdc.
 */

import { createClient } from "@supabase/supabase-js"
import { config } from "dotenv"
import { resolve } from "path"

config({ path: resolve(process.cwd(), ".env.local") })

const TENANT_NAME = "Apresentação POC"
const SMOKE = {
  requisition: "aprovreqpoc@valore.com.br",
  order: "aprovpedpoc@valore.com.br",
}

async function findAuthUserId(supabase, email) {
  const target = email.toLowerCase()
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 200,
    })
    if (error) throw error
    const hit = (data?.users ?? []).find(
      (u) => (u.email || "").toLowerCase() === target,
    )
    if (hit) return hit.id
    if ((data?.users?.length ?? 0) < 200) break
  }
  return null
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    console.error("Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY")
    process.exit(1)
  }

  const argCompany = process.argv
    .find((a) => a.startsWith("--company-id="))
    ?.slice("--company-id=".length)

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  let companyId = argCompany
  if (!companyId) {
    const { data: company, error } = await supabase
      .from("companies")
      .select("id, name")
      .ilike("name", TENANT_NAME)
      .maybeSingle()
    if (error || !company) {
      console.error(`Tenant "${TENANT_NAME}" não encontrado`)
      process.exit(1)
    }
    companyId = company.id
    console.log(`Tenant: ${company.name} (${companyId})`)
  }

  const reqUserId = await findAuthUserId(supabase, SMOKE.requisition)
  const orderUserId = await findAuthUserId(supabase, SMOKE.order)
  if (!reqUserId || !orderUserId) {
    console.error("Usuários smoke não encontrados no Auth", {
      requisition: Boolean(reqUserId),
      order: Boolean(orderUserId),
    })
    process.exit(1)
  }

  const { data: reqProfile } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("id", reqUserId)
    .single()
  const { data: orderProfile } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("id", orderUserId)
    .single()

  const reqName = reqProfile?.full_name || "Aprovador Requisição POC"
  const orderName = orderProfile?.full_name || "Aprovador Pedido POC"

  console.log(`REQ approver → ${reqName} (${reqUserId})`)
  console.log(`Order approver → ${orderName} (${orderUserId})`)

  const { data: levels, error: levelsErr } = await supabase
    .from("approval_levels")
    .select("id, flow")
    .eq("company_id", companyId)
  if (levelsErr) throw levelsErr

  for (const level of levels ?? []) {
    if (level.flow === "requisition") {
      const { error } = await supabase
        .from("approval_levels")
        .update({ approver_id: reqUserId, approver_name: reqName })
        .eq("id", level.id)
      if (error) throw error
    } else if (level.flow === "order" || level.flow === "catalog_order") {
      const { error } = await supabase
        .from("approval_levels")
        .update({ approver_id: orderUserId, approver_name: orderName })
        .eq("id", level.id)
      if (error) throw error
    }
  }
  console.log(`Alçadas atualizadas: ${(levels ?? []).length}`)

  const { data: pendingReqs, error: arErr } = await supabase
    .from("approval_requests")
    .select("id, flow")
    .eq("company_id", companyId)
    .eq("status", "pending")
  if (arErr) throw arErr

  let updatedAr = 0
  for (const ar of pendingReqs ?? []) {
    if (ar.flow === "requisition") {
      const { error } = await supabase
        .from("approval_requests")
        .update({ approver_id: reqUserId, approver_name: reqName })
        .eq("id", ar.id)
      if (error) throw error
      updatedAr++
    } else if (ar.flow === "order" || ar.flow === "catalog_order") {
      const { error } = await supabase
        .from("approval_requests")
        .update({ approver_id: orderUserId, approver_name: orderName })
        .eq("id", ar.id)
      if (error) throw error
      updatedAr++
    }
  }
  console.log(`ARs pending reatribuídas: ${updatedAr}`)
  console.log("OK — faça logout/login nos perfis aprovadores e recarregue /comprador/aprovacoes")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
