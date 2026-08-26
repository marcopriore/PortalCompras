/**
 * Seed one-shot do tenant "Apresentação POC" (PRD / demo).
 * NÃO é migration — ver .cursor/rules/prd-no-test-data.mdc
 *
 * Uso (raiz do projeto, .env.local com URL + SERVICE_ROLE do projeto alvo):
 *   npm run seed:poc
 *   node scripts/seed-poc-tenant.mjs --company-id=<uuid>
 *   node scripts/seed-poc-tenant.mjs --force
 *
 * Senha de todos os usuários: Valore@POC2026
 * Domínio: @apresentacao-poc.demo
 */

import { createClient } from "@supabase/supabase-js"
import { config } from "dotenv"
import { resolve } from "path"

config({ path: resolve(process.cwd(), ".env.local") })

const TENANT_NAME = "Apresentação POC"
const PASSWORD = "Valore@POC2026"
const EMAIL_DOMAIN = "apresentacao-poc.demo"

const CATEGORIES = [
  "TI & Informática",
  "MRO Industrial",
  "Escritório",
  "Facilities",
  "Logística",
  "Marketing",
  "Engenharia",
  "Saúde & EPI",
  "Alimentos",
  "Serviços Gerais",
]

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("")

const USER_PLAN = [
  { key: "admin", count: 1, roles: ["admin"], profileType: "buyer", prefix: "admin" },
  {
    key: "approver_requisition",
    count: 3,
    roles: ["approver_requisition"],
    profileType: "buyer",
    prefix: "aprreq",
  },
  {
    key: "approver_order",
    count: 5,
    roles: ["approver_order"],
    profileType: "buyer",
    prefix: "aprped",
  },
  { key: "manager", count: 2, roles: ["manager"], profileType: "buyer", prefix: "gestor" },
  { key: "buyer", count: 10, roles: ["buyer"], profileType: "buyer", prefix: "buyer" },
  {
    key: "requester",
    count: 40,
    roles: ["requester"],
    profileType: "requester",
    prefix: "req",
  },
]

const SYSTEM_GROUPS = [
  { code: "admin", name: "Administrador" },
  { code: "buyer", name: "Comprador" },
  { code: "manager", name: "Gestor de Compras" },
  { code: "approver_requisition", name: "Aprov. Requisição" },
  { code: "approver_order", name: "Aprov. Pedido" },
  { code: "requester", name: "Requisitante" },
]

const ADMIN_PERMISSIONS = [
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
  "catalog.buyer_review",
  "approval.requisition",
  "approval.order",
  "export.excel",
  "import.excel",
  "supplier.create",
  "supplier.edit",
  "item.create",
  "item.edit",
  "user.manage",
  "user.impersonate",
  "settings.manage",
  "portal.solicitante",
]

function parseArgs() {
  const args = process.argv.slice(2)
  let companyId = null
  let force = false
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--force") force = true
    if (args[i] === "--company-id" && args[i + 1]) companyId = args[++i]
    if (args[i]?.startsWith("--company-id=")) {
      companyId = args[i].slice("--company-id=".length)
    }
  }
  return { companyId, force }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
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

async function insertChunks(supabase, table, rows, chunkSize = 100) {
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize)
    const { error } = await supabase.from(table).insert(chunk)
    if (error) throw new Error(`${table}: ${error.message}`)
  }
}

async function ensureSystemGroups(supabase, companyId) {
  for (const g of SYSTEM_GROUPS) {
    const { data: group, error } = await supabase
      .from("permission_groups")
      .upsert(
        {
          company_id: companyId,
          code: g.code,
          name: g.name,
          description: `Grupo de sistema ${g.name}`,
          is_system: true,
          source_role: g.code,
        },
        { onConflict: "company_id,code" },
      )
      .select("id, code")
      .single()
    if (error) throw new Error(`permission_groups ${g.code}: ${error.message}`)

    if (g.code === "admin") {
      const rules = ADMIN_PERMISSIONS.map((permission_key) => ({
        company_id: companyId,
        group_id: group.id,
        permission_key,
        enabled: true,
      }))
      const { error: rErr } = await supabase
        .from("permission_group_rules")
        .upsert(rules, { onConflict: "group_id,permission_key" })
      if (rErr) throw new Error(`permission_group_rules: ${rErr.message}`)
    }
  }
}

async function assignGroups(supabase, companyId, userId, roleCodes) {
  const { data: groups } = await supabase
    .from("permission_groups")
    .select("id, code")
    .eq("company_id", companyId)
    .in("code", roleCodes)
  if (!groups?.length) return
  await supabase.from("profile_permission_groups").upsert(
    groups.map((g) => ({
      company_id: companyId,
      user_id: userId,
      group_id: g.id,
    })),
    { onConflict: "company_id,user_id,group_id" },
  )
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    console.error(
      "Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY em .env.local",
    )
    process.exit(1)
  }

  const { companyId: argCompanyId, force } = parseArgs()
  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  console.log("\n=== Seed Apresentação POC ===\n")

  // --- Resolve tenant ---
  let companyId = argCompanyId
  if (!companyId) {
    const { data: company, error } = await supabase
      .from("companies")
      .select("id, name, status")
      .ilike("name", TENANT_NAME)
      .maybeSingle()
    if (error || !company) {
      console.error(`Tenant "${TENANT_NAME}" não encontrado. Passe --company-id=UUID`)
      process.exit(1)
    }
    companyId = company.id
    console.log(`Tenant: ${company.name} (${companyId}) status=${company.status}`)
  } else {
    console.log(`Tenant (arg): ${companyId}`)
  }

  // --- Idempotency ---
  const { count: itemCount } = await supabase
    .from("items")
    .select("*", { count: "exact", head: true })
    .eq("company_id", companyId)
  if ((itemCount ?? 0) >= 50 && !force) {
    console.error(
      `Já existem ${itemCount} itens neste tenant. Use --force para ignorar o guard (não apaga dados).`,
    )
    process.exit(1)
  }

  // --- Features (ensure on) ---
  console.log("→ tenant_features")
  const featureKeys = [
    "quotations",
    "equalization",
    "orders",
    "requisitions",
    "suppliers",
    "items",
    "reports",
    "users",
    "logs",
    "settings",
    "approval_requisition",
    "approval_order",
    "ai_analytics",
    "ai_negotiation",
    "contracts",
    "contract_balance",
    "api_integrations",
    "purchase_catalog",
  ]
  await supabase.from("tenant_features").upsert(
    featureKeys.map((feature_key) => ({
      company_id: companyId,
      feature_key,
      enabled: true,
    })),
    { onConflict: "company_id,feature_key" },
  )

  console.log("→ permission_groups")
  await ensureSystemGroups(supabase, companyId)

  // --- Cost centers ---
  console.log("→ cost_centers (50)")
  const costCenterRows = Array.from({ length: 50 }, (_, i) => {
    const n = String(i + 1).padStart(2, "0")
    return {
      company_id: companyId,
      code: `CC-${n}`,
      description: `Centro de Custo ${n}`,
      active: true,
    }
  })
  await supabase
    .from("cost_centers")
    .upsert(costCenterRows, { onConflict: "company_id,code" })
  const { data: costCenters } = await supabase
    .from("cost_centers")
    .select("id, code")
    .eq("company_id", companyId)
    .order("code")
  if (!costCenters?.length) throw new Error("cost_centers vazios")

  // --- Payment conditions ---
  console.log("→ payment_conditions")
  const pcRows = [
    { code: "30D", description: "30 dias" },
    { code: "45D", description: "45 dias" },
    { code: "60D", description: "60 dias" },
    { code: "AVISTA", description: "À vista" },
    { code: "NT30", description: "Net 30" },
  ].map((p) => ({
    company_id: companyId,
    code: p.code,
    description: p.description,
    active: true,
  }))
  await supabase
    .from("payment_conditions")
    .upsert(pcRows, { onConflict: "company_id,code" })
  const { data: paymentConditions } = await supabase
    .from("payment_conditions")
    .select("id, code, description")
    .eq("company_id", companyId)

  // --- Items 260 ---
  console.log("→ items (260)")
  const itemRows = []
  for (const letter of LETTERS) {
    for (let n = 1; n <= 10; n++) {
      const nn = String(n).padStart(2, "0")
      const cat = pick(CATEGORIES, letter.charCodeAt(0) + n)
      itemRows.push({
        company_id: companyId,
        code: `${letter}${nn}`,
        short_description: `Item ${letter}${nn} — ${cat}`,
        long_description: `Material demo ${letter}${nn} categoria ${cat}`,
        unit_of_measure: n % 3 === 0 ? "KG" : n % 2 === 0 ? "CX" : "UN",
        commodity_group: cat,
        status: "active",
        source: "manual",
        target_price: 10 + n * 3.5,
        last_purchase_price: 9 + n * 3.2,
        average_price: 9.5 + n * 3.3,
      })
    }
  }
  await supabase.from("items").upsert(itemRows, { onConflict: "company_id,code" })
  const { data: items } = await supabase
    .from("items")
    .select("id, code, short_description, unit_of_measure, commodity_group, target_price")
    .eq("company_id", companyId)
    .order("code")
  if ((items?.length ?? 0) < 260) {
    console.warn(`Aviso: esperava 260 itens, veio ${items?.length}`)
  }

  // --- Suppliers 100 ---
  console.log("→ suppliers (100) + categories")
  const supplierRows = []
  let sIdx = 0
  for (const cat of CATEGORIES) {
    for (let n = 1; n <= 10; n++) {
      sIdx += 1
      const code = `FORN-${String(sIdx).padStart(3, "0")}`
      supplierRows.push({
        company_id: companyId,
        code,
        name: `Fornecedor ${cat.split(" ")[0]} ${n}`,
        cnpj: `${String(10_000_000_000_000 + sIdx).slice(0, 14)}`,
        email: `contato${sIdx}@fornecedor-poc.demo`,
        phone: `11 9${String(1000_0000 + sIdx).slice(0, 8)}`,
        category: cat,
        city: pick(["São Paulo", "Campinas", "Curitiba", "BH", "Porto Alegre"], sIdx),
        state: pick(["SP", "PR", "MG", "RS", "SC"], sIdx),
        status: "active",
      })
    }
  }
  await supabase.from("suppliers").upsert(supplierRows, { onConflict: "company_id,code" })
  const { data: suppliers } = await supabase
    .from("suppliers")
    .select("id, code, name, cnpj, category")
    .eq("company_id", companyId)
    .order("code")

  const scRows = (suppliers ?? []).map((s) => ({
    company_id: companyId,
    supplier_id: s.id,
    category: s.category || CATEGORIES[0],
  }))
  // second category for variety
  for (let i = 0; i < (suppliers?.length ?? 0); i += 7) {
    const s = suppliers[i]
    scRows.push({
      company_id: companyId,
      supplier_id: s.id,
      category: pick(CATEGORIES, i + 3),
    })
  }
  await supabase
    .from("supplier_categories")
    .upsert(scRows, { onConflict: "supplier_id,category" })

  // --- Users ---
  console.log("→ users (61 Auth + profiles)")
  const usersByRole = {
    admin: [],
    approver_requisition: [],
    approver_order: [],
    manager: [],
    buyer: [],
    requester: [],
  }

  for (const plan of USER_PLAN) {
    for (let i = 1; i <= plan.count; i++) {
      const nn = plan.count === 1 ? "" : String(i).padStart(2, "0")
      const emailLocal = nn ? `${plan.prefix}${nn}` : plan.prefix
      const email = `${emailLocal}@${EMAIL_DOMAIN}`
      const fullName =
        plan.count === 1
          ? `POC ${plan.key === "admin" ? "Administrador" : plan.prefix}`
          : `POC ${plan.prefix.toUpperCase()} ${nn}`

      let userId
      const { data: created, error: createErr } = await supabase.auth.admin.createUser({
        email,
        password: PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: fullName, company_id: companyId },
      })

      if (createErr) {
        const { data: byName } = await supabase
          .from("profiles")
          .select("id")
          .eq("company_id", companyId)
          .eq("full_name", fullName)
          .maybeSingle()
        if (byName?.id) {
          userId = byName.id
        } else {
          throw new Error(`Auth create ${email}: ${createErr.message}`)
        }
      } else {
        userId = created.user.id
        await sleep(200)
      }

      const cc = pick(costCenters, i + plan.key.length)
      const { error: profErr } = await supabase
        .from("profiles")
        .update({
          company_id: companyId,
          full_name: fullName,
          role: plan.roles[0],
          roles: plan.roles,
          profile_type: plan.profileType,
          status: "active",
          is_superadmin: false,
          cost_center_id: cc.id,
        })
        .eq("id", userId)
      if (profErr) throw new Error(`profile ${email}: ${profErr.message}`)

      await assignGroups(supabase, companyId, userId, plan.roles)
      usersByRole[plan.key].push({
        id: userId,
        email,
        fullName,
        costCenterCode: cc.code,
      })
      process.stdout.write(".")
    }
  }
  console.log("")

  const buyers = usersByRole.buyer
  const requesters = usersByRole.requester
  const admins = usersByRole.admin
  const aprReq = usersByRole.approver_requisition
  const aprPed = usersByRole.approver_order
  const managers = usersByRole.manager
  const createdBy = admins[0]?.id || buyers[0]?.id
  if (!createdBy) throw new Error("Sem usuário admin/buyer para created_by")

  // --- Approval levels (5) ---
  console.log("→ approval_levels (5)")
  await supabase.from("approval_levels").delete().eq("company_id", companyId)
  const approvalRows = [
    {
      company_id: companyId,
      flow: "requisition",
      cost_center: "CC-01",
      category: "*",
      level_order: 1,
      approver_id: aprReq[0].id,
      approver_name: aprReq[0].fullName,
      min_value: null,
      max_value: null,
    },
    {
      company_id: companyId,
      flow: "requisition",
      cost_center: "CC-02",
      category: "*",
      level_order: 1,
      approver_id: aprReq[1]?.id ?? aprReq[0].id,
      approver_name: aprReq[1]?.fullName ?? aprReq[0].fullName,
      min_value: null,
      max_value: null,
    },
    {
      company_id: companyId,
      flow: "requisition",
      cost_center: "*",
      category: "*",
      level_order: 2,
      approver_id: aprReq[2]?.id ?? aprReq[0].id,
      approver_name: aprReq[2]?.fullName ?? aprReq[0].fullName,
      min_value: null,
      max_value: null,
    },
    {
      company_id: companyId,
      flow: "order",
      cost_center: "*",
      category: CATEGORIES[0],
      level_order: 1,
      approver_id: aprPed[0].id,
      approver_name: aprPed[0].fullName,
      min_value: 0,
      max_value: 50000,
    },
    {
      company_id: companyId,
      flow: "order",
      cost_center: "*",
      category: "*",
      level_order: 1,
      approver_id: aprPed[1]?.id ?? aprPed[0].id,
      approver_name: aprPed[1]?.fullName ?? aprPed[0].fullName,
      min_value: 50000,
      max_value: null,
    },
  ]
  await insertChunks(supabase, "approval_levels", approvalRows, 50)

  // --- Requisitions 250 ---
  console.log("→ requisitions (250)")
  const reqStatuses = [
    "draft",
    "pending",
    "approved",
    "rejected",
    "in_quotation",
    "cancelled",
    "completed",
    "awaiting_buyer",
  ]
  const requisitionIds = []
  for (let i = 0; i < 250; i++) {
    const requester = pick(requesters, i)
    const status = pick(reqStatuses, i)
    const cc = pick(costCenters, i)
    const approver = pick(aprReq, i)
    const title = `REQ POC ${String(i + 1).padStart(3, "0")} — ${pick(CATEGORIES, i)}`
    const { data: req, error } = await supabase
      .from("requisitions")
      .insert({
        company_id: companyId,
        code: `REQ-POC-${String(i + 1).padStart(4, "0")}`,
        title,
        description: `Requisição demonstração ${i + 1}`,
        status,
        priority: i % 7 === 0 ? "urgent" : i % 11 === 0 ? "critical" : "normal",
        origin: "manual",
        requester_id: requester.id,
        requester_name: requester.fullName,
        cost_center: cc.code,
        needed_by: daysFromNow(7 + (i % 30)),
        approver_name:
          status === "approved" || status === "rejected" ? approver.fullName : null,
        approved_at:
          status === "approved" || status === "rejected" ? isoDaysAgo(i % 20) : null,
        rejection_reason: status === "rejected" ? "Fora do orçamento (demo)" : null,
        created_at: isoDaysAgo(40 - (i % 40)),
      })
      .select("id, code")
      .single()
    if (error) throw new Error(`requisition ${i}: ${error.message}`)
    requisitionIds.push(req)

    const nItems = randInt(1, 5)
    const ri = []
    for (let k = 0; k < nItems; k++) {
      const item = pick(items, i * 5 + k)
      ri.push({
        requisition_id: req.id,
        company_id: companyId,
        material_code: item.code,
        material_description: item.short_description,
        quantity: randInt(1, 20),
        unit_of_measure: item.unit_of_measure,
        commodity_group: item.commodity_group,
        estimated_price: Number(item.target_price ?? 10),
      })
    }
    const { error: riErr } = await supabase.from("requisition_items").insert(ri)
    if (riErr) throw new Error(`requisition_items ${i}: ${riErr.message}`)
    if (i % 25 === 0) process.stdout.write(`${i}…`)
  }
  console.log(" ok")

  // --- Quotations 100 ---
  console.log("→ quotations (100)")
  const cotStatuses = ["draft", "waiting", "analysis", "completed", "cancelled"]
  const quotationMeta = []

  for (let i = 0; i < 100; i++) {
    const status = pick(cotStatuses, i)
    const buyer = pick(buyers, i)
    const deadline = daysFromNow(5 + (i % 20))
    const { data: cot, error } = await supabase
      .from("quotations")
      .insert({
        company_id: companyId,
        description: `Cotação POC ${String(i + 1).padStart(3, "0")} — ${pick(CATEGORIES, i)}`,
        status,
        category: pick(CATEGORIES, i),
        created_by: buyer.id,
        response_deadline: deadline,
        payment_condition: pick(paymentConditions, i)?.description ?? "30 dias",
        created_at: isoDaysAgo(35 - (i % 35)),
      })
      .select("id, code, status")
      .single()
    if (error) throw new Error(`quotation ${i}: ${error.message}`)

    const nQi = randInt(3, 8)
    const qiRows = []
    for (let k = 0; k < nQi; k++) {
      const item = pick(items, i * 8 + k)
      const srcReq = pick(requisitionIds, i + k)
      qiRows.push({
        quotation_id: cot.id,
        company_id: companyId,
        material_code: item.code,
        material_description: item.short_description,
        quantity: randInt(2, 50),
        unit_of_measure: item.unit_of_measure,
        long_description: item.short_description,
        source_requisition_code: srcReq?.code ?? null,
        target_price: Number(item.target_price ?? 10),
      })
    }
    const { data: qItems, error: qiErr } = await supabase
      .from("quotation_items")
      .insert(qiRows)
      .select("id, material_code, quantity, unit_of_measure, material_description")
    if (qiErr) throw new Error(`quotation_items ${i}: ${qiErr.message}`)

    const nSup = randInt(3, 6)
    const chosenSup = []
    for (let k = 0; k < nSup; k++) {
      chosenSup.push(pick(suppliers, i * 6 + k * 3))
    }
    const uniqSup = [...new Map(chosenSup.map((s) => [s.id, s])).values()]
    const qsRows = uniqSup.map((s, pos) => ({
      quotation_id: cot.id,
      company_id: companyId,
      supplier_id: s.id,
      supplier_name: s.name,
      supplier_cnpj: s.cnpj,
      position: pos + 1,
    }))
    const { error: qsErr } = await supabase.from("quotation_suppliers").insert(qsRows)
    if (qsErr) throw new Error(`quotation_suppliers ${i}: ${qsErr.message}`)

    const nRounds = status === "draft" ? 1 : i % 4 === 0 ? 2 : 1
    const rounds = []
    for (let r = 1; r <= nRounds; r++) {
      const { data: round, error: rErr } = await supabase
        .from("quotation_rounds")
        .insert({
          quotation_id: cot.id,
          company_id: companyId,
          round_number: r,
          status: r === nRounds && status !== "completed" && status !== "cancelled" ? "active" : "closed",
          response_deadline: deadline,
          closed_at: r < nRounds || status === "completed" ? isoDaysAgo(2) : null,
        })
        .select("id, round_number")
        .single()
      if (rErr) throw new Error(`quotation_rounds ${i}.${r}: ${rErr.message}`)
      rounds.push(round)
    }

    const activeRound = rounds[rounds.length - 1]
    const proposals = []
    for (let p = 0; p < uniqSup.length; p++) {
      const s = uniqSup[p]
      let pStatus = "invited"
      if (status === "waiting") pStatus = p % 2 === 0 ? "submitted" : "invited"
      if (status === "analysis") pStatus = p === 0 ? "submitted" : p === 1 ? "submitted" : "invited"
      if (status === "completed") pStatus = p === 0 ? "selected" : "rejected"
      if (status === "cancelled") pStatus = "invited"

      const { data: prop, error: pErr } = await supabase
        .from("quotation_proposals")
        .insert({
          quotation_id: cot.id,
          company_id: companyId,
          round_id: activeRound.id,
          supplier_id: s.id,
          supplier_name: s.name,
          supplier_cnpj: s.cnpj,
          status: pStatus,
          payment_condition: pick(paymentConditions, p)?.description ?? "30 dias",
          delivery_days: 7 + p * 2,
        })
        .select("id, status, supplier_id, supplier_name, supplier_cnpj")
        .single()
      if (pErr) throw new Error(`proposal ${i}.${p}: ${pErr.message}`)
      proposals.push(prop)

      if (pStatus === "submitted" || pStatus === "selected" || pStatus === "rejected") {
        const piRows = (qItems ?? []).map((qi, idx) => ({
          proposal_id: prop.id,
          quotation_item_id: qi.id,
          round_id: activeRound.id,
          company_id: companyId,
          unit_price: 8 + idx * 1.7 + p * 0.5,
          tax_percent: 0,
          delivery_days: 5 + p,
          item_status:
            pStatus === "selected"
              ? "accepted"
              : pStatus === "rejected"
                ? "rejected"
                : idx % 5 === 0
                  ? "rejected"
                  : "accepted",
        }))
        const { error: piErr } = await supabase.from("proposal_items").insert(piRows)
        if (piErr) throw new Error(`proposal_items ${i}.${p}: ${piErr.message}`)
      }
    }

    quotationMeta.push({
      cot,
      qItems: qItems ?? [],
      proposals,
      activeRound,
      uniqSup,
      buyer,
    })
    if (i % 10 === 0) process.stdout.write(`${i}…`)
  }
  console.log(" ok")

  // --- Purchase orders 77 ---
  console.log("→ purchase_orders (77)")
  const poStatuses = [
    "draft",
    "sent",
    "processing",
    "completed",
    "refused",
    "cancelled",
    "error",
  ]
  let poCreated = 0
  for (let i = 0; i < 77; i++) {
    const meta = pick(
      quotationMeta.filter((m) => m.proposals.some((p) => p.status === "selected" || p.status === "submitted")),
      i,
    )
    const fallbackMeta = quotationMeta[i % quotationMeta.length]
    const use = meta ?? fallbackMeta
    const prop =
      use.proposals.find((p) => p.status === "selected") ||
      use.proposals.find((p) => p.status === "submitted") ||
      use.proposals[0]
    const supplier =
      use.uniqSup.find((s) => s.id === prop?.supplier_id) || use.uniqSup[0]
    const status = pick(poStatuses, i)
    const buyer = use.buyer || pick(buyers, i)

    const lineCount = Math.min(use.qItems.length, randInt(1, 5))
    const lines = use.qItems.slice(0, lineCount)
    let total = 0
    const unitPrices = lines.map((_, idx) => {
      const up = 10 + idx * 2.5 + (i % 7)
      total += up * (2 + (idx % 3))
      return up
    })

    const { data: po, error } = await supabase
      .from("purchase_orders")
      .insert({
        company_id: companyId,
        status,
        supplier_id: supplier?.id ?? null,
        supplier_name: supplier?.name ?? prop?.supplier_name ?? "Fornecedor POC",
        supplier_cnpj: supplier?.cnpj ?? prop?.supplier_cnpj ?? null,
        quotation_id: use.cot.id,
        proposal_id: prop?.id ?? null,
        quotation_code: use.cot.code,
        requisition_code: pick(requisitionIds, i)?.code ?? null,
        payment_condition: pick(paymentConditions, i)?.description ?? "30 dias",
        delivery_days: 10 + (i % 5),
        delivery_address: "Av. Demonstração, 1000 — São Paulo/SP",
        total_price: Math.round(total * 100) / 100,
        observations: `Pedido POC ${i + 1}`,
        created_by: buyer.id,
        estimated_delivery_date:
          status === "completed" || status === "processing" || status === "sent"
            ? daysFromNow(10 + (i % 15))
            : null,
        accepted_by_supplier: ["processing", "completed", "error"].includes(status),
        accepted_at: ["processing", "completed", "error"].includes(status)
          ? isoDaysAgo(i % 10)
          : null,
        cancellation_reason: status === "refused" ? "Recusa demo do fornecedor" : null,
        created_at: isoDaysAgo(25 - (i % 25)),
      })
      .select("id, code")
      .single()
    if (error) throw new Error(`PO ${i}: ${error.message}`)

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
      round_id: use.activeRound.id,
    }))
    const { error: poiErr } = await supabase.from("purchase_order_items").insert(poi)
    if (poiErr) throw new Error(`PO items ${i}: ${poiErr.message}`)
    poCreated += 1
    if (i % 10 === 0) process.stdout.write(`${i}…`)
  }
  console.log(` ok (${poCreated})`)

  // --- Contracts 10 ---
  console.log("→ contracts (10)")
  for (let i = 0; i < 10; i++) {
    const supplier = pick(suppliers, i * 9)
    const pc = pick(paymentConditions, i)
    const { data: codeRpc } = await supabase.rpc("generate_contract_code", {
      p_company_id: companyId,
    })
    const code =
      typeof codeRpc === "string" && codeRpc
        ? codeRpc
        : `CTR-POC-${String(i + 1).padStart(4, "0")}`

    const status = i < 6 ? "active" : i < 8 ? "draft" : "pending_acceptance"
    const { data: ctr, error } = await supabase
      .from("contracts")
      .insert({
        company_id: companyId,
        code,
        title: `Contrato POC ${i + 1} — ${pick(CATEGORIES, i)}`,
        type: pick(["fornecimento", "servico", "sla", "outro"], i),
        contract_kind: i % 2 === 0 ? "por_valor" : "por_quantidade",
        status,
        supplier_id: supplier.id,
        start_date: daysFromNow(-30),
        end_date: daysFromNow(180 + i * 10),
        value: 50000 + i * 12000,
        payment_condition_id: pc?.id ?? null,
        created_by: createdBy,
        notes: "Contrato demonstração POC",
        accepted_at: status === "active" ? isoDaysAgo(20) : null,
      })
      .select("id, code")
      .single()
    if (error) throw new Error(`contract ${i}: ${error.message}`)

    const ciRows = []
    for (let k = 0; k < 4; k++) {
      const item = pick(items, i * 10 + k)
      ciRows.push({
        contract_id: ctr.id,
        company_id: companyId,
        material_code: item.code,
        material_description: item.short_description,
        unit_of_measure: item.unit_of_measure,
        quantity_contracted: 100 + k * 20,
        unit_price: Number(item.target_price ?? 15),
        delivery_days: 10,
        notes: null,
        eliminated: false,
      })
    }
    const { error: ciErr } = await supabase.from("contract_items").insert(ciRows)
    if (ciErr) throw new Error(`contract_items ${i}: ${ciErr.message}`)
  }

  // --- Summary ---
  console.log("\n=== Seed concluído ===\n")
  console.log(`Company: ${companyId}`)
  console.log(`Senha padrão: ${PASSWORD}`)
  console.log("Logins (amostra):")
  console.log(`  Admin:     ${admins[0]?.email}`)
  console.log(`  Comprador: ${buyers[0]?.email}`)
  console.log(`  Requisit.: ${requesters[0]?.email}`)
  console.log(`  Apr. REQ:  ${aprReq[0]?.email}`)
  console.log(`  Apr. PED:  ${aprPed[0]?.email}`)
  console.log(`  Gestor:    ${managers[0]?.email}`)
  console.log("")
  console.log(
    `Volumes: itens=${items?.length} forn=${suppliers?.length} CC=${costCenters.length} users=61 REQ=250 COT=100 PO=${poCreated} CTR=10`,
  )
  console.log("")
}

main().catch((err) => {
  console.error("\nFalha no seed:", err.message || err)
  process.exit(1)
})
