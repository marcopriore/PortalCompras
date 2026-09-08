/**
 * Seed one-shot: 1 cotação com 3 rodadas, 10 itens e 4 fornecedores,
 * cada um vencendo ≥1 item (pronto para testar split na equalização).
 *
 * NÃO é migration — ver .cursor/rules/prd-no-test-data.mdc
 *
 * Uso (raiz do projeto, .env.local com URL + SERVICE_ROLE):
 *   npm run seed:equalizacao-split
 *   node scripts/seed-equalizacao-split.mjs
 *   node scripts/seed-equalizacao-split.mjs --company-id=<uuid>
 *   node scripts/seed-equalizacao-split.mjs --force
 */

import { createClient } from "@supabase/supabase-js"
import { config } from "dotenv"
import { resolve } from "path"

config({ path: resolve(process.cwd(), ".env.local") })

const TENANT_NAME = "Apresentação POC"
const MARKER = "SEED EQUALIZAÇÃO SPLIT"
const N_ITEMS = 10
const N_SUPPLIERS = 4
const N_ROUNDS = 3

/** Índices de itens vencidos por fornecedor (cada um ≥1). */
const WIN_BY_SUPPLIER = [
  [0, 1, 2], // F1 — 3 itens
  [3, 4], // F2 — 2 itens
  [5, 6, 7], // F3 — 3 itens
  [8, 9], // F4 — 2 itens
]

function argValue(prefix) {
  const hit = process.argv.find((a) => a.startsWith(prefix))
  return hit ? hit.slice(prefix.length) : null
}

function hasFlag(flag) {
  return process.argv.includes(flag)
}

function daysFromNow(offset) {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function isoDaysAgo(offset) {
  const d = new Date()
  d.setDate(d.getDate() - offset)
  return d.toISOString()
}

function winnerSupplierIndex(itemIndex) {
  for (let s = 0; s < WIN_BY_SUPPLIER.length; s++) {
    if (WIN_BY_SUPPLIER[s].includes(itemIndex)) return s
  }
  return 0
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

  const force = hasFlag("--force")
  const companyIdArg = argValue("--company-id=")

  // --- Tenant ---
  let companyId = companyIdArg
  if (!companyId) {
    const { data: poc } = await supabase
      .from("companies")
      .select("id, name")
      .eq("name", TENANT_NAME)
      .maybeSingle()
    companyId = poc?.id ?? null
  }
  if (!companyId) {
    const { data: anyActive } = await supabase
      .from("companies")
      .select("id, name")
      .eq("status", "active")
      .order("name")
      .limit(1)
      .maybeSingle()
    companyId = anyActive?.id ?? null
  }
  if (!companyId) {
    console.error("Nenhum tenant encontrado. Use --company-id=<uuid>.")
    process.exit(1)
  }

  const { data: company } = await supabase
    .from("companies")
    .select("id, name")
    .eq("id", companyId)
    .single()
  console.log(`→ Tenant: ${company?.name} (${companyId})`)

  // --- Limpar seed anterior ---
  const { data: oldCots } = await supabase
    .from("quotations")
    .select("id, code")
    .eq("company_id", companyId)
    .ilike("description", `%${MARKER}%`)

  if ((oldCots ?? []).length > 0) {
    if (!force) {
      console.log(
        `Já existe cotação de seed (${oldCots.map((c) => c.code).join(", ")}). Use --force para recriar.`,
      )
      process.exit(0)
    }
    const oldIds = oldCots.map((c) => c.id)
    console.log(`→ Removendo seed anterior (${oldIds.length})…`)
    const { data: oldProps } = await supabase
      .from("quotation_proposals")
      .select("id")
      .in("quotation_id", oldIds)
    const propIds = (oldProps ?? []).map((p) => p.id)
    if (propIds.length > 0) {
      await supabase.from("proposal_items").delete().in("proposal_id", propIds)
    }
    await supabase.from("quotation_proposals").delete().in("quotation_id", oldIds)
    await supabase.from("quotation_rounds").delete().in("quotation_id", oldIds)
    await supabase.from("quotation_suppliers").delete().eq("quotation_id", oldIds[0])
    for (const id of oldIds) {
      await supabase.from("quotation_suppliers").delete().eq("quotation_id", id)
      await supabase.from("quotation_items").delete().eq("quotation_id", id)
    }
    await supabase.from("quotations").delete().in("id", oldIds)
  }

  // --- Dependências existentes ---
  const [
    { data: buyers },
    { data: items },
    { data: suppliers },
    { data: paymentConditions },
    { data: branches },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, roles, role")
      .eq("company_id", companyId)
      .eq("profile_type", "buyer")
      .limit(20),
    supabase
      .from("items")
      .select("id, code, short_description, unit_of_measure, target_price")
      .eq("company_id", companyId)
      .eq("status", "active")
      .order("code")
      .limit(50),
    supabase
      .from("suppliers")
      .select("id, code, name, cnpj")
      .eq("company_id", companyId)
      .eq("status", "active")
      .order("name")
      .limit(20),
    supabase
      .from("payment_conditions")
      .select("id, code, description")
      .eq("company_id", companyId)
      .eq("active", true)
      .order("code")
      .limit(10),
    supabase
      .from("company_branches")
      .select("code, name")
      .eq("company_id", companyId)
      .eq("active", true)
      .order("code")
      .limit(5),
  ])

  const buyer =
    (buyers ?? []).find((p) => {
      const roles = Array.isArray(p.roles) ? p.roles : []
      return roles.includes("admin") || p.role === "admin"
    }) ??
    (buyers ?? [])[0]

  if (!buyer) {
    throw new Error("Nenhum comprador no tenant. Rode o seed POC ou crie um usuário buyer.")
  }
  if ((items ?? []).length < N_ITEMS) {
    throw new Error(
      `Precisa de pelo menos ${N_ITEMS} itens ativos (encontrou ${(items ?? []).length}).`,
    )
  }
  if ((suppliers ?? []).length < N_SUPPLIERS) {
    throw new Error(
      `Precisa de pelo menos ${N_SUPPLIERS} fornecedores ativos (encontrou ${(suppliers ?? []).length}).`,
    )
  }

  const chosenSuppliers = (suppliers ?? []).slice(0, N_SUPPLIERS)
  const chosenItems = (items ?? []).slice(0, N_ITEMS)
  const siteCode = branches?.[0]?.code ?? "MATRIZ"
  const paymentLabel =
    paymentConditions?.[0]?.description ?? paymentConditions?.[0]?.code ?? "30 dias"
  const deadline = daysFromNow(10)

  console.log(`→ Comprador: ${buyer.full_name ?? buyer.id}`)
  console.log(`→ Fornecedores: ${chosenSuppliers.map((s) => s.code).join(", ")}`)
  console.log(`→ Centro/Filial (site_code): ${siteCode}`)

  // --- Cotação ---
  console.log("→ Criando cotação…")
  const { data: cot, error: cotErr } = await supabase
    .from("quotations")
    .insert({
      company_id: companyId,
      description: `${MARKER} — 3 rodadas / 10 itens / 4 forn. (split)`,
      status: "analysis",
      category: "MRO Industrial",
      created_by: buyer.id,
      response_deadline: deadline,
      payment_condition: paymentLabel,
      created_at: isoDaysAgo(14),
    })
    .select("id, code")
    .single()
  if (cotErr) throw new Error(`quotations: ${cotErr.message}`)

  const qiRows = chosenItems.map((item, idx) => ({
    quotation_id: cot.id,
    company_id: companyId,
    material_code: item.code,
    material_description: item.short_description,
    quantity: 5 + idx * 2,
    unit_of_measure: item.unit_of_measure ?? "UN",
    long_description: item.short_description,
    target_price: Number(item.target_price ?? 20 + idx),
    site_code: siteCode,
  }))

  const { data: qItems, error: qiErr } = await supabase
    .from("quotation_items")
    .insert(qiRows)
    .select("id, material_code, quantity, material_description")
  if (qiErr) throw new Error(`quotation_items: ${qiErr.message}`)

  const qsRows = chosenSuppliers.map((s, pos) => ({
    quotation_id: cot.id,
    company_id: companyId,
    supplier_id: s.id,
    supplier_name: s.name,
    supplier_cnpj: s.cnpj,
    position: pos + 1,
  }))
  const { error: qsErr } = await supabase.from("quotation_suppliers").insert(qsRows)
  if (qsErr) throw new Error(`quotation_suppliers: ${qsErr.message}`)

  // --- Rodadas ---
  const rounds = []
  for (let r = 1; r <= N_ROUNDS; r++) {
    const isLast = r === N_ROUNDS
    const { data: round, error: rErr } = await supabase
      .from("quotation_rounds")
      .insert({
        quotation_id: cot.id,
        company_id: companyId,
        round_number: r,
        status: isLast ? "active" : "closed",
        response_deadline: isLast ? deadline : daysFromNow(-7 + r),
        closed_at: isLast ? null : isoDaysAgo(10 - r * 2),
        created_at: isoDaysAgo(12 - r * 2),
      })
      .select("id, round_number, status")
      .single()
    if (rErr) throw new Error(`quotation_rounds ${r}: ${rErr.message}`)
    rounds.push(round)
  }

  // --- Propostas por rodada ---
  for (const round of rounds) {
    const isFinal = round.round_number === N_ROUNDS
    const roundFactor = 1.25 - (round.round_number - 1) * 0.08 // preços caem a cada rodada

    for (let s = 0; s < chosenSuppliers.length; s++) {
      const supplier = chosenSuppliers[s]
      const { data: prop, error: pErr } = await supabase
        .from("quotation_proposals")
        .insert({
          quotation_id: cot.id,
          company_id: companyId,
          round_id: round.id,
          supplier_id: supplier.id,
          supplier_name: supplier.name,
          supplier_cnpj: supplier.cnpj,
          status: "submitted",
          payment_condition: paymentLabel,
          delivery_days: 7 + s * 2,
        })
        .select("id")
        .single()
      if (pErr) throw new Error(`proposal R${round.round_number} S${s}: ${pErr.message}`)

      const piRows = (qItems ?? []).map((qi, itemIdx) => {
        const winner = winnerSupplierIndex(itemIdx)
        const isWinner = isFinal && winner === s
        // Vencedor: preço-alvo ~ target; perdedores: +15–40%
        const base = 18 + itemIdx * 2.5
        const unitPrice = Number(
          (
            base *
            roundFactor *
            (isWinner ? 0.92 + s * 0.01 : 1.12 + Math.abs(s - winner) * 0.08)
          ).toFixed(2),
        )
        return {
          proposal_id: prop.id,
          quotation_item_id: qi.id,
          round_id: round.id,
          company_id: companyId,
          unit_price: unitPrice,
          tax_percent: 0,
          delivery_days: 5 + s,
          item_status: isWinner ? "accepted" : isFinal ? "rejected" : "accepted",
        }
      })

      const { error: piErr } = await supabase.from("proposal_items").insert(piRows)
      if (piErr) throw new Error(`proposal_items R${round.round_number} S${s}: ${piErr.message}`)
    }
  }

  // --- Resumo ---
  console.log("\n=== Seed equalização/split concluído ===\n")
  console.log(`Cotação:  ${cot.code}`)
  console.log(`ID:       ${cot.id}`)
  console.log(`Status:   analysis (3 rodadas; última active)`)
  console.log(`URL:      /comprador/cotacoes/${cot.id}/equalizacao`)
  console.log("")
  console.log("Vencedores (rodada 3):")
  for (let s = 0; s < chosenSuppliers.length; s++) {
    const won = WIN_BY_SUPPLIER[s]
      .map((i) => qItems[i]?.material_code ?? `#${i}`)
      .join(", ")
    console.log(`  ${chosenSuppliers[s].code} — ${chosenSuppliers[s].name}: ${won}`)
  }
  console.log("")
  console.log("Na equalização: seleções já marcadas (accepted). Use Criar Pedido(s) para testar o split.")
  console.log("")
}

main().catch((err) => {
  console.error("\nFalha no seed:", err.message || err)
  process.exit(1)
})
