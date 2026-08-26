/**
 * Seed one-shot: processos no portal do fornecedor Axis Strategy.
 * CNPJ 58.043.646/0001-36 · contato@axisstrategy.com.br
 * NÃO é migration — ver .cursor/rules/prd-no-test-data.mdc
 *
 * Uso:
 *   npm run seed:supplier-axis
 *   node scripts/seed-supplier-axis.mjs
 *   node scripts/seed-supplier-axis.mjs --company-id=<uuid>
 *   node scripts/seed-supplier-axis.mjs --force   # recria cotações AXIS-* mesmo se já houver
 */

import { createClient } from "@supabase/supabase-js"
import { config } from "dotenv"
import { resolve } from "path"

config({ path: resolve(process.cwd(), ".env.local") })

const CNPJ = "58043646000136"
const CNPJ_FMT = "58.043.646/0001-36"
const EMAIL = "contato@axisstrategy.com.br"
const PASSWORD = "Valore@Axis2026"
const SUPPLIER_CODE = "AXIS-001"
const SUPPLIER_NAME = "Axis Strategy"

const CATEGORIES = [
  "TI & Informática",
  "MRO Industrial",
  "Escritório",
  "Facilities",
  "Logística",
]

function argValue(prefix) {
  const hit = process.argv.find((a) => a.startsWith(prefix))
  return hit ? hit.slice(prefix.length) : null
}

function hasFlag(flag) {
  return process.argv.includes(flag)
}

function pick(arr, i) {
  return arr[i % arr.length]
}

function randInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1))
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

  // --- Resolve / create supplier + company ---
  console.log("→ Localizar fornecedor Axis…")
  let { data: existingSuppliers } = await supabase
    .from("suppliers")
    .select("id, company_id, code, name, cnpj, email, status, companies(id, name)")
    .or(`cnpj.eq.${CNPJ},cnpj.eq.${CNPJ_FMT}`)

  let companyId = companyIdArg
  let supplier = existingSuppliers?.[0] ?? null

  if (!companyId) {
    companyId = supplier?.company_id ?? null
  }
  if (!companyId) {
    const { data: poc } = await supabase
      .from("companies")
      .select("id, name")
      .eq("name", "Apresentação POC")
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
  console.log(`   Tenant: ${company?.name} (${companyId})`)

  if (!supplier || supplier.company_id !== companyId) {
    const match = (existingSuppliers ?? []).find((s) => s.company_id === companyId)
    if (match) {
      supplier = match
    } else {
      const { data: upserted, error } = await supabase
        .from("suppliers")
        .upsert(
          {
            company_id: companyId,
            code: SUPPLIER_CODE,
            name: SUPPLIER_NAME,
            cnpj: CNPJ,
            email: EMAIL,
            phone: "11 4000-5800",
            category: "TI & Informática",
            city: "São Paulo",
            state: "SP",
            status: "active",
          },
          { onConflict: "company_id,code" },
        )
        .select("id, company_id, code, name, cnpj, email, status")
        .single()
      if (error) {
        // fallback: find by code
        const { data: byCode } = await supabase
          .from("suppliers")
          .select("id, company_id, code, name, cnpj, email, status")
          .eq("company_id", companyId)
          .eq("code", SUPPLIER_CODE)
          .maybeSingle()
        if (!byCode) throw new Error(`supplier upsert: ${error.message}`)
        supplier = byCode
        await supabase
          .from("suppliers")
          .update({
            name: SUPPLIER_NAME,
            cnpj: CNPJ,
            email: EMAIL,
            phone: "11 4000-5800",
            city: "São Paulo",
            state: "SP",
            status: "active",
          })
          .eq("id", byCode.id)
      } else {
        supplier = upserted
      }
    }
  } else {
    await supabase
      .from("suppliers")
      .update({
        name: SUPPLIER_NAME,
        cnpj: CNPJ,
        email: EMAIL,
        status: "active",
        city: supplier.city ?? "São Paulo",
        state: supplier.state ?? "SP",
        phone: supplier.phone ?? "11 4000-5800",
      })
      .eq("id", supplier.id)
  }

  console.log(`   Supplier id=${supplier.id} code=${supplier.code}`)

  // --- Auth user + profile ---
  console.log("→ Usuário portal…")
  let userId = null
  const { data: listed } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  const found = (listed?.users ?? []).find(
    (u) => u.email?.toLowerCase() === EMAIL.toLowerCase(),
  )
  if (found) {
    userId = found.id
    console.log(`   Auth existente: ${userId}`)
  } else {
    const { data: created, error: cErr } = await supabase.auth.admin.createUser({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: "Marco Priore" },
    })
    if (cErr) throw new Error(`createUser: ${cErr.message}`)
    userId = created.user.id
    console.log(`   Auth criado: ${userId} (senha ${PASSWORD})`)
  }

  const { error: profErr } = await supabase.from("profiles").upsert(
    {
      id: userId,
      company_id: companyId,
      supplier_id: supplier.id,
      full_name: "Marco Priore",
      profile_type: "supplier",
      role: "supplier",
      roles: ["supplier"],
      status: "active",
      is_supplier_admin: true,
      login_cnpj: CNPJ,
    },
    { onConflict: "id" },
  )
  if (profErr) {
    const { error: updErr } = await supabase
      .from("profiles")
      .update({
        company_id: companyId,
        supplier_id: supplier.id,
        full_name: "Marco Priore",
        profile_type: "supplier",
        role: "supplier",
        roles: ["supplier"],
        status: "active",
        is_supplier_admin: true,
        login_cnpj: CNPJ,
      })
      .eq("id", userId)
    if (updErr) throw new Error(`profile: ${updErr.message}`)
  }
  console.log("   Profile vinculado (supplier admin + login_cnpj)")

  // Guard: already seeded?
  const { count: axisCotCount } = await supabase
    .from("quotations")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .ilike("description", "AXIS portal%")

  if ((axisCotCount ?? 0) > 0 && !force) {
    console.log(
      `⚠ Já existem ${axisCotCount} cotações AXIS portal neste tenant. Use --force para recriar.`,
    )
    console.log("✓ Usuário/fornecedor ok. Login: CNPJ ou e-mail acima.")
    return
  }

  if (force && (axisCotCount ?? 0) > 0) {
    console.log("→ --force: removendo cotações AXIS portal anteriores…")
    const { data: oldCots } = await supabase
      .from("quotations")
      .select("id")
      .eq("company_id", companyId)
      .ilike("description", "AXIS portal%")
    const oldIds = (oldCots ?? []).map((c) => c.id)
    if (oldIds.length > 0) {
      await supabase.from("purchase_order_items").delete().in(
        "purchase_order_id",
        (
          await supabase
            .from("purchase_orders")
            .select("id")
            .in("quotation_id", oldIds)
        ).data?.map((p) => p.id) ?? [],
      )
      await supabase.from("purchase_orders").delete().in("quotation_id", oldIds)
      await supabase.from("proposal_items").delete().in(
        "proposal_id",
        (
          await supabase
            .from("quotation_proposals")
            .select("id")
            .in("quotation_id", oldIds)
        ).data?.map((p) => p.id) ?? [],
      )
      await supabase.from("quotation_proposals").delete().in("quotation_id", oldIds)
      await supabase.from("quotation_rounds").delete().in("quotation_id", oldIds)
      await supabase.from("quotation_suppliers").delete().in("quotation_id", oldIds)
      await supabase.from("quotation_items").delete().in("quotation_id", oldIds)
      await supabase.from("quotations").delete().in("id", oldIds)
    }
  }

  // Masters
  const { data: items } = await supabase
    .from("items")
    .select("id, code, short_description, unit_of_measure, target_price")
    .eq("company_id", companyId)
    .limit(40)
  const { data: paymentConditions } = await supabase
    .from("payment_conditions")
    .select("id, description")
    .eq("company_id", companyId)
    .eq("active", true)
  const { data: buyers } = await supabase
    .from("profiles")
    .select("id")
    .eq("company_id", companyId)
    .eq("profile_type", "buyer")
    .limit(10)

  if (!items?.length) {
    console.error("Tenant sem itens. Rode seed:poc ou cadastre itens antes.")
    process.exit(1)
  }
  const buyerId = buyers?.[0]?.id ?? userId

  // --- Quotations (18) with Axis invited ---
  console.log("→ Cotações (18) + propostas + itens…")
  const cotStatuses = [
    "waiting",
    "waiting",
    "waiting",
    "waiting",
    "waiting",
    "waiting",
    "analysis",
    "analysis",
    "analysis",
    "analysis",
    "completed",
    "completed",
    "completed",
    "completed",
    "cancelled",
    "cancelled",
    "waiting",
    "analysis",
  ]
  const proposalStatusesByCot = {
    waiting: ["invited", "invited", "submitted", "invited", "submitted", "invited"],
    analysis: ["submitted", "submitted", "submitted", "submitted"],
    completed: ["selected", "selected", "rejected", "rejected"],
    cancelled: ["invited", "invited"],
  }

  const quotationMeta = []

  for (let i = 0; i < cotStatuses.length; i++) {
    const status = cotStatuses[i]
    const deadline = daysFromNow(3 + (i % 14))
    const { data: cot, error } = await supabase
      .from("quotations")
      .insert({
        company_id: companyId,
        description: `AXIS portal ${String(i + 1).padStart(2, "0")} — ${pick(CATEGORIES, i)}`,
        status,
        category: pick(CATEGORIES, i),
        created_by: buyerId,
        response_deadline: deadline,
        payment_condition: pick(paymentConditions ?? [{ description: "30 dias" }], i)
          .description,
        created_at: isoDaysAgo(20 - (i % 20)),
      })
      .select("id, code, status")
      .single()
    if (error) throw new Error(`quotation ${i}: ${error.message}`)

    const nQi = randInt(3, 6)
    const qiRows = []
    for (let k = 0; k < nQi; k++) {
      const item = pick(items, i * 3 + k)
      qiRows.push({
        quotation_id: cot.id,
        company_id: companyId,
        material_code: item.code,
        material_description: item.short_description,
        quantity: randInt(2, 40),
        unit_of_measure: item.unit_of_measure,
        long_description: item.short_description,
        target_price: Number(item.target_price ?? 10),
      })
    }
    const { data: qItems, error: qiErr } = await supabase
      .from("quotation_items")
      .insert(qiRows)
      .select("id, material_code, quantity, unit_of_measure, material_description")
    if (qiErr) throw new Error(`quotation_items ${i}: ${qiErr.message}`)

    const { error: qsErr } = await supabase.from("quotation_suppliers").insert({
      quotation_id: cot.id,
      company_id: companyId,
      supplier_id: supplier.id,
      supplier_name: SUPPLIER_NAME,
      supplier_cnpj: CNPJ,
      position: 1,
    })
    if (qsErr) throw new Error(`quotation_suppliers ${i}: ${qsErr.message}`)

    const { data: round, error: rErr } = await supabase
      .from("quotation_rounds")
      .insert({
        quotation_id: cot.id,
        company_id: companyId,
        round_number: 1,
        status:
          status === "completed" || status === "cancelled" ? "closed" : "active",
        response_deadline: deadline,
        closed_at:
          status === "completed" || status === "cancelled" ? isoDaysAgo(1) : null,
      })
      .select("id, round_number")
      .single()
    if (rErr) throw new Error(`round ${i}: ${rErr.message}`)

    const pStatusList = proposalStatusesByCot[status] ?? ["invited"]
    const pStatus = pStatusList[i % pStatusList.length]

    const { data: prop, error: pErr } = await supabase
      .from("quotation_proposals")
      .insert({
        quotation_id: cot.id,
        company_id: companyId,
        round_id: round.id,
        supplier_id: supplier.id,
        supplier_name: SUPPLIER_NAME,
        supplier_cnpj: CNPJ,
        status: pStatus,
        payment_condition: pick(paymentConditions ?? [{ description: "30 dias" }], i)
          .description,
        delivery_days: 7 + (i % 5),
      })
      .select("id, status")
      .single()
    if (pErr) throw new Error(`proposal ${i}: ${pErr.message}`)

    if (pStatus === "submitted" || pStatus === "selected" || pStatus === "rejected") {
      const piRows = (qItems ?? []).map((qi, idx) => ({
        proposal_id: prop.id,
        quotation_item_id: qi.id,
        round_id: round.id,
        company_id: companyId,
        unit_price: 9 + idx * 1.5 + (i % 4),
        tax_percent: 0,
        delivery_days: 5 + (i % 3),
        item_status: pStatus === "rejected" ? "rejected" : "accepted",
      }))
      const { error: piErr } = await supabase.from("proposal_items").insert(piRows)
      if (piErr) throw new Error(`proposal_items ${i}: ${piErr.message}`)
    }

    quotationMeta.push({ cot, qItems, round, prop, pStatus })
  }
  console.log(`   ${quotationMeta.length} cotações criadas`)

  // --- Purchase orders (12) ---
  console.log("→ Pedidos (12)…")
  const poStatuses = [
    "sent",
    "sent",
    "processing",
    "processing",
    "completed",
    "completed",
    "completed",
    "refused",
    "cancelled",
    "error",
    "sent",
    "processing",
  ]
  let poCreated = 0
  for (let i = 0; i < poStatuses.length; i++) {
    const meta = quotationMeta[i % quotationMeta.length]
    const status = poStatuses[i]
    const lines = (meta.qItems ?? []).slice(0, Math.min(3, meta.qItems?.length ?? 0))
    let total = 0
    const unitPrices = lines.map((_, idx) => {
      const up = 12 + idx * 2 + (i % 5)
      total += up * (2 + (idx % 3))
      return up
    })

    const { data: po, error } = await supabase
      .from("purchase_orders")
      .insert({
        company_id: companyId,
        status,
        supplier_id: supplier.id,
        supplier_name: SUPPLIER_NAME,
        supplier_cnpj: CNPJ,
        quotation_id: meta.cot.id,
        proposal_id: meta.prop.id,
        quotation_code: meta.cot.code,
        payment_condition: "30 dias",
        delivery_days: 10 + (i % 5),
        delivery_address: "Av. Paulista, 1000 — São Paulo/SP",
        total_price: Math.round(total * 100) / 100,
        observations: `Pedido Axis seed ${i + 1}`,
        created_by: buyerId,
        estimated_delivery_date:
          status === "completed" || status === "processing" || status === "sent"
            ? daysFromNow(8 + (i % 10))
            : null,
        accepted_by_supplier: ["processing", "completed", "error"].includes(status),
        accepted_at: ["processing", "completed", "error"].includes(status)
          ? isoDaysAgo(i % 8)
          : null,
        cancellation_reason: status === "refused" ? "Recusa demo Axis" : null,
        created_at: isoDaysAgo(15 - (i % 15)),
      })
      .select("id")
      .single()
    if (error) throw new Error(`PO ${i}: ${error.message}`)

    if (lines.length > 0) {
      const poi = lines.map((qi, idx) => ({
        purchase_order_id: po.id,
        company_id: companyId,
        material_code: qi.material_code,
        material_description: qi.material_description,
        quantity: 2 + (idx % 3),
        unit_of_measure: qi.unit_of_measure,
        unit_price: unitPrices[idx],
        tax_percent: 0,
        delivery_days: 7 + idx,
        quotation_item_id: qi.id,
        round_id: meta.round.id,
      }))
      const { error: poiErr } = await supabase.from("purchase_order_items").insert(poi)
      if (poiErr) throw new Error(`PO items ${i}: ${poiErr.message}`)
    }
    poCreated += 1
  }
  console.log(`   ${poCreated} pedidos criados`)

  // --- Contract sample ---
  console.log("→ Contrato (1 active)…")
  const { data: codeRpc } = await supabase.rpc("generate_contract_code", {
    p_company_id: companyId,
  })
  const ctrCode =
    typeof codeRpc === "string" && codeRpc
      ? codeRpc
      : `CTR-AXIS-${Date.now().toString().slice(-4)}`
  const { error: ctrErr } = await supabase.from("contracts").insert({
    company_id: companyId,
    supplier_id: supplier.id,
    code: ctrCode,
    title: "Contrato demo Axis Strategy",
    type: "fornecimento",
    status: "active",
    start_date: daysFromNow(-30),
    end_date: daysFromNow(335),
    value: 150000,
    notes: "Seed portal fornecedor Axis",
    created_by: buyerId,
  })
  if (ctrErr) console.warn(`   contrato: ${ctrErr.message}`)
  else console.log(`   ${ctrCode}`)

  console.log("\n✓ Seed Axis concluído")
  console.log(`  Login: ${EMAIL} ou CNPJ ${CNPJ_FMT}`)
  console.log(`  Senha (se usuário novo): ${PASSWORD}`)
  console.log(`  Tenant: ${company?.name}`)
  console.log("  Abra /fornecedor/cotacoes e /fornecedor/pedidos")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
