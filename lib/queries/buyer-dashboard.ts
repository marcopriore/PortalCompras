import { queryOptions } from "@tanstack/react-query"
import type { SupabaseClient } from "@supabase/supabase-js"
import { endOfMonth, startOfMonth, subMonths } from "date-fns"
import { formatMonthShortBR } from "@/lib/formato-data"
import { queryKeys } from "@/lib/queries/keys"

export type QuotationStatus = "draft" | "waiting" | "analysis" | "completed" | "cancelled"

export type BuyerDashboardRecentActivity = {
  id: string
  code: string
  title: string
  type: "Cotação" | "Pedido" | "Requisição" | "Contrato"
  status: string
  created_at: string
  href: string
}

export type BuyerDashboardStatusSlice = {
  name: string
  value: number
  color: string
}

export type BuyerDashboardSpendSlice = {
  name: string
  value: number
}

export type BuyerDashboardLeadTimeMonth = {
  month: string
  days: number
}

export type BuyerDashboardSavingBySupplier = {
  name: string
  saving: number
}

export type BuyerDashboardSavingByMonth = {
  month: string
  saving: number
}

export type BuyerDashboardDto = {
  quotationsPending: number
  quotationsByStatus: BuyerDashboardStatusSlice[]
  recentActivities: BuyerDashboardRecentActivity[]
  ordersInProgress: number
  avgLeadTime: number | null
  spendData: BuyerDashboardSpendSlice[]
  leadTimeChartData: BuyerDashboardLeadTimeMonth[]
  quotationsChange: number | null
  ordersChange: number | null
  leadTimeChange: number | null
  savingAcumulado: number | null
  savingChange: number | null
  savingHistorico: number | null
  savingPorFornecedor: BuyerDashboardSavingBySupplier[]
  savingPorMesDash: BuyerDashboardSavingByMonth[]
  coberturaPrecoAlvo: number | null
}

type OrderLeadRow = {
  created_at: string
  requisition_code: string | null
  quotation_id: string | null
}

type OrderWithReq = {
  created_at: string
  requisition_code: string | null
}

type SavingPoItemRow = {
  unit_price: number | null
  quantity: number | null
  quotation_item_id: string | null
}

type SavingHistoricoRow = SavingPoItemRow & {
  purchase_orders:
    | { created_at: string; supplier_name: string | null }
    | { created_at: string; supplier_name: string | null }[]
    | null
}

async function resolveOrdersWithReqCodes(
  supabase: SupabaseClient,
  companyId: string,
  orders: OrderLeadRow[],
): Promise<OrderWithReq[]> {
  const missingQuoteIds = [
    ...new Set(
      orders
        .filter((o) => !o.requisition_code?.trim() && o.quotation_id)
        .map((o) => o.quotation_id as string),
    ),
  ]
  const codeByQuotation = new Map<string, string>()
  if (missingQuoteIds.length > 0) {
    const { data } = await supabase
      .from("quotation_items")
      .select("quotation_id, source_requisition_code")
      .in("quotation_id", missingQuoteIds)
      .not("source_requisition_code", "is", null)
    for (const row of (data ?? []) as {
      quotation_id: string
      source_requisition_code: string
    }[]) {
      if (!codeByQuotation.has(row.quotation_id) && row.source_requisition_code?.trim()) {
        codeByQuotation.set(row.quotation_id, row.source_requisition_code.trim())
      }
    }
  }
  return orders.map((o) => ({
    created_at: o.created_at,
    requisition_code:
      o.requisition_code?.trim() ||
      (o.quotation_id ? (codeByQuotation.get(o.quotation_id) ?? null) : null),
  }))
}

function calcLeadTimeFromReqMap(
  orders: OrderWithReq[],
  reqMap: Map<string, string>,
): number | null {
  const deltas = orders
    .filter((o) => Boolean(o.requisition_code && reqMap.has(o.requisition_code)))
    .map((o) => {
      const reqDate = new Date(reqMap.get(o.requisition_code as string) as string)
      const poDate = new Date(o.created_at)
      return Math.max(
        0,
        Math.round((poDate.getTime() - reqDate.getTime()) / (1000 * 60 * 60 * 24)),
      )
    })
  if (!deltas.length) return null
  return Math.round(deltas.reduce((a, b) => a + b, 0) / deltas.length)
}

async function loadReqCreatedAtMap(
  supabase: SupabaseClient,
  companyId: string,
  codes: string[],
): Promise<Map<string, string>> {
  if (codes.length === 0) return new Map()
  const { data: reqs } = await supabase
    .from("requisitions")
    .select("code, created_at")
    .eq("company_id", companyId)
    .in("code", codes)
  return new Map(
    ((reqs ?? []) as { code: string; created_at: string }[]).map((r) => [r.code, r.created_at]),
  )
}

function calcSaving(
  items: SavingPoItemRow[],
  targetPriceMap: Map<string, number>,
): number | null {
  let total = 0
  let hasAny = false
  items.forEach((item) => {
    if (!item.quotation_item_id || !item.unit_price || !item.quantity) return
    const target = targetPriceMap.get(item.quotation_item_id)
    if (target == null) return
    total += (target - Number(item.unit_price)) * Number(item.quantity)
    hasAny = true
  })
  return hasAny ? total : null
}

export async function fetchBuyerDashboard(
  supabase: SupabaseClient,
  companyId: string,
): Promise<BuyerDashboardDto> {
  const empty: BuyerDashboardDto = {
    quotationsPending: 0,
    quotationsByStatus: [],
    recentActivities: [],
    ordersInProgress: 0,
    avgLeadTime: null,
    spendData: [],
    leadTimeChartData: [],
    quotationsChange: null,
    ordersChange: null,
    leadTimeChange: null,
    savingAcumulado: null,
    savingChange: null,
    savingHistorico: null,
    savingPorFornecedor: [],
    savingPorMesDash: [],
    coberturaPrecoAlvo: null,
  }

  const now = new Date()
  const currentMonthStart = startOfMonth(now).toISOString()
  const prevDate = subMonths(now, 1)
  const prevMonthStart = startOfMonth(prevDate).toISOString()
  const prevMonthEnd = endOfMonth(prevDate).toISOString()
  const sixMonthsAgo = subMonths(now, 6).toISOString()

  const [
    quotationsRes,
    recentQuotationsRes,
    recentOrdersRes,
    recentRequisitionsRes,
    recentContractsRes,
    ordersInProgressRes,
    ordersWithReqRes,
    quotationsPendingCurrentMonthRes,
    quotationsPendingPrevRes,
    ordersInProgressCurrentMonthRes,
    ordersInProgressPrevRes,
    leadCurrentWithReqRes,
    leadPrevWithReqRes,
    poItemsRes,
    quotationsForSpendRes,
    ltMonthlyRes,
    savingItemsCurrentRes,
    savingItemsPrevRes,
    savingHistoricoRes,
    itensCobertura,
  ] = await Promise.all([
    supabase.from("quotations").select("status").eq("company_id", companyId),
    supabase
      .from("quotations")
      .select("id, code, description, status, created_at")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("purchase_orders")
      .select("id, code, supplier_name, status, created_at")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("requisitions")
      .select("id, code, title, status, created_at")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("contracts")
      .select("id, code, title, status, created_at")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("purchase_orders")
      .select("*", { count: "exact", head: true })
      .eq("company_id", companyId)
      .in("status", ["sent", "processing"]),
    supabase
      .from("purchase_orders")
      .select("created_at, requisition_code, quotation_id")
      .eq("company_id", companyId)
      .in("status", ["sent", "processing", "completed", "draft"])
      .gte("created_at", currentMonthStart),
    supabase
      .from("quotations")
      .select("*", { count: "exact", head: true })
      .eq("company_id", companyId)
      .in("status", ["waiting", "analysis"])
      .gte("created_at", currentMonthStart),
    supabase
      .from("quotations")
      .select("*", { count: "exact", head: true })
      .eq("company_id", companyId)
      .in("status", ["waiting", "analysis"])
      .gte("created_at", prevMonthStart)
      .lte("created_at", prevMonthEnd),
    supabase
      .from("purchase_orders")
      .select("*", { count: "exact", head: true })
      .eq("company_id", companyId)
      .in("status", ["sent", "processing"])
      .gte("created_at", currentMonthStart),
    supabase
      .from("purchase_orders")
      .select("*", { count: "exact", head: true })
      .eq("company_id", companyId)
      .in("status", ["sent", "processing"])
      .gte("created_at", prevMonthStart)
      .lte("created_at", prevMonthEnd),
    supabase
      .from("purchase_orders")
      .select("created_at, requisition_code, quotation_id")
      .eq("company_id", companyId)
      .in("status", ["sent", "processing", "completed", "draft"])
      .gte("created_at", currentMonthStart),
    supabase
      .from("purchase_orders")
      .select("created_at, requisition_code, quotation_id")
      .eq("company_id", companyId)
      .in("status", ["sent", "processing", "completed", "draft"])
      .gte("created_at", prevMonthStart)
      .lte("created_at", prevMonthEnd),
    supabase
      .from("purchase_order_items")
      .select("total_price, purchase_orders!inner(company_id, status, quotation_id)")
      .eq("purchase_orders.company_id", companyId)
      .eq("purchase_orders.status", "completed"),
    supabase.from("quotations").select("id, category").eq("company_id", companyId),
    supabase
      .from("purchase_orders")
      .select("created_at, requisition_code, quotation_id")
      .eq("company_id", companyId)
      .in("status", ["sent", "processing", "completed", "draft"])
      .gte("created_at", sixMonthsAgo),
    supabase
      .from("purchase_order_items")
      .select(
        "unit_price, quantity, quotation_item_id, purchase_orders!inner(company_id, status, created_at)",
      )
      .eq("purchase_orders.company_id", companyId)
      .in("purchase_orders.status", ["sent", "processing", "completed"])
      .gte("purchase_orders.created_at", currentMonthStart)
      .not("quotation_item_id", "is", null),
    supabase
      .from("purchase_order_items")
      .select(
        "unit_price, quantity, quotation_item_id, purchase_orders!inner(company_id, status, created_at)",
      )
      .eq("purchase_orders.company_id", companyId)
      .in("purchase_orders.status", ["sent", "processing", "completed"])
      .gte("purchase_orders.created_at", prevMonthStart)
      .lte("purchase_orders.created_at", prevMonthEnd)
      .not("quotation_item_id", "is", null),
    supabase
      .from("purchase_order_items")
      .select(
        "unit_price, quantity, quotation_item_id, purchase_orders!inner(company_id, status, created_at, supplier_name)",
      )
      .eq("purchase_orders.company_id", companyId)
      .in("purchase_orders.status", ["sent", "processing", "completed"])
      .not("quotation_item_id", "is", null),
    supabase.from("items").select("id, target_price").eq("company_id", companyId).eq("status", "active"),
  ])

  let quotationsPending = 0
  let quotationsByStatus: BuyerDashboardStatusSlice[] = []

  if (quotationsRes.data) {
    const all = quotationsRes.data as { status: QuotationStatus }[]
    quotationsPending = all.filter((q) => q.status === "waiting" || q.status === "analysis").length

    const statusMap: Record<Exclude<QuotationStatus, "draft">, { name: string; color: string }> =
      {
        waiting: { name: "Pendentes", color: "var(--warning)" },
        analysis: { name: "Em Análise", color: "var(--accent)" },
        completed: { name: "Respondidas", color: "var(--primary)" },
        cancelled: { name: "Encerradas", color: "var(--muted-foreground)" },
      }

    quotationsByStatus = (Object.keys(statusMap) as (keyof typeof statusMap)[])
      .map((key) => ({
        name: statusMap[key].name,
        value: all.filter((q) => q.status === key).length,
        color: statusMap[key].color,
      }))
      .filter((s) => s.value > 0)
  }

  let recentActivities: BuyerDashboardRecentActivity[] = []
  if (
    recentQuotationsRes.data ||
    recentOrdersRes.data ||
    recentRequisitionsRes.data ||
    recentContractsRes.data
  ) {
    const activities: BuyerDashboardRecentActivity[] = [
      ...((recentQuotationsRes.data ?? []) as {
        id: string
        code: string
        description: string | null
        status: string
        created_at: string
      }[]).map((q) => ({
        id: q.id,
        code: q.code,
        title: q.description?.trim() || q.code,
        type: "Cotação" as const,
        status: q.status,
        created_at: q.created_at,
        href: `/comprador/cotacoes/${q.id}`,
      })),
      ...((recentOrdersRes.data ?? []) as {
        id: string
        code: string
        supplier_name: string | null
        status: string
        created_at: string
      }[]).map((o) => ({
        id: o.id,
        code: o.code,
        title: o.supplier_name?.trim() || o.code,
        type: "Pedido" as const,
        status: o.status,
        created_at: o.created_at,
        href: `/comprador/pedidos/${o.id}`,
      })),
      ...((recentRequisitionsRes.data ?? []) as {
        id: string
        code: string
        title: string | null
        status: string
        created_at: string
      }[]).map((r) => ({
        id: r.id,
        code: r.code,
        title: r.title?.trim() || r.code,
        type: "Requisição" as const,
        status: r.status,
        created_at: r.created_at,
        href: `/comprador/requisicoes/${r.id}`,
      })),
      ...((recentContractsRes.data ?? []) as {
        id: string
        code: string
        title: string | null
        status: string
        created_at: string
      }[]).map((c) => ({
        id: c.id,
        code: c.code,
        title: c.title?.trim() || c.code,
        type: "Contrato" as const,
        status: c.status,
        created_at: c.created_at,
        href: `/comprador/contratos/${c.id}`,
      })),
    ]
    activities.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )
    recentActivities = activities.slice(0, 8)
  }

  const ordersInProgress = ordersInProgressRes.count ?? 0

  const ordersWithReqRaw = (ordersWithReqRes.data as OrderLeadRow[] | null) ?? []
  const ordersWithReq = await resolveOrdersWithReqCodes(supabase, companyId, ordersWithReqRaw)
  const reqCodesAll = [...new Set(ordersWithReq.map((o) => o.requisition_code).filter(Boolean))] as string[]
  const reqMapAll = await loadReqCreatedAtMap(supabase, companyId, reqCodesAll)
  const avgLeadTime = calcLeadTimeFromReqMap(ordersWithReq, reqMapAll)

  const quotationsPendingCurrentMonth = quotationsPendingCurrentMonthRes.count ?? 0
  const quotationsPendingPrev = quotationsPendingPrevRes.count ?? 0
  const quotationsChange =
    quotationsPendingPrev > 0
      ? Math.round(
          ((quotationsPendingCurrentMonth - quotationsPendingPrev) / quotationsPendingPrev) *
            100,
        )
      : null

  const ordersInProgressCurrentMonth = ordersInProgressCurrentMonthRes.count ?? 0
  const ordersInProgressPrev = ordersInProgressPrevRes.count ?? 0
  const ordersChange =
    ordersInProgressPrev > 0
      ? Math.round(
          ((ordersInProgressCurrentMonth - ordersInProgressPrev) / ordersInProgressPrev) * 100,
        )
      : null

  const leadCurrentOrdersRaw = (leadCurrentWithReqRes.data as OrderLeadRow[] | null) ?? []
  const leadPrevOrdersRaw = (leadPrevWithReqRes.data as OrderLeadRow[] | null) ?? []
  const leadCurrentOrders = await resolveOrdersWithReqCodes(
    supabase,
    companyId,
    leadCurrentOrdersRaw,
  )
  const leadPrevOrders = await resolveOrdersWithReqCodes(supabase, companyId, leadPrevOrdersRaw)
  const reqCodesCurrent = [
    ...new Set(leadCurrentOrders.map((o) => o.requisition_code).filter(Boolean)),
  ] as string[]
  const reqCodesPrev = [
    ...new Set(leadPrevOrders.map((o) => o.requisition_code).filter(Boolean)),
  ] as string[]
  const allReqCodesForDelta = [...new Set([...reqCodesCurrent, ...reqCodesPrev])]
  const reqMapDelta = await loadReqCreatedAtMap(supabase, companyId, allReqCodesForDelta)
  const leadCurrent = calcLeadTimeFromReqMap(leadCurrentOrders, reqMapDelta)
  const leadPrev = calcLeadTimeFromReqMap(leadPrevOrders, reqMapDelta)
  const leadTimeChange =
    leadCurrent != null && leadPrev != null ? leadCurrent - leadPrev : null

  const quotationCategoryById = new Map<string, string>()
  ;((quotationsForSpendRes.data as { id: string; category: string | null }[] | null) ?? []).forEach(
    (q) => quotationCategoryById.set(q.id, q.category?.trim() || "Sem Categoria"),
  )

  const spendMap = new Map<string, number>()
  ;(
    (poItemsRes.data as {
      total_price: number | null
      purchase_orders: { quotation_id: string | null } | { quotation_id: string | null }[] | null
    }[] | null) ?? []
  ).forEach((row) => {
    const po = Array.isArray(row.purchase_orders) ? row.purchase_orders[0] : row.purchase_orders
    const quotationId = po?.quotation_id ?? null
    const category =
      (quotationId ? quotationCategoryById.get(quotationId) : null) ?? "Sem Categoria"
    const current = spendMap.get(category) ?? 0
    spendMap.set(category, current + Number(row.total_price ?? 0))
  })
  const spendData = Array.from(spendMap.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6)

  const monthBuckets: { key: string; month: string; values: number[] }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = subMonths(now, i)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    const month = formatMonthShortBR(d)
    monthBuckets.push({ key, month, values: [] })
  }
  const bucketByKey = new Map(monthBuckets.map((b) => [b.key, b]))
  const monthlyOrdersRaw = (ltMonthlyRes.data as OrderLeadRow[] | null) ?? []
  const monthlyOrders = await resolveOrdersWithReqCodes(supabase, companyId, monthlyOrdersRaw)
  const monthlyReqCodes = [
    ...new Set(monthlyOrders.map((o) => o.requisition_code).filter(Boolean)),
  ] as string[]
  const reqMapMonthly = await loadReqCreatedAtMap(supabase, companyId, monthlyReqCodes)
  monthlyOrders.forEach((po) => {
    const d = new Date(po.created_at)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    const bucket = bucketByKey.get(key)
    if (!bucket) return
    if (!po.requisition_code || !reqMapMonthly.has(po.requisition_code)) return
    const days = Math.max(
      0,
      Math.round(
        (new Date(po.created_at).getTime() -
          new Date(reqMapMonthly.get(po.requisition_code) as string).getTime()) /
          (1000 * 60 * 60 * 24),
      ),
    )
    bucket.values.push(days)
  })
  const hasLeadTimeData = monthBuckets.some((b) => b.values.length > 0)
  const leadTimeChartData = hasLeadTimeData
    ? monthBuckets.map((b) => ({
        month: b.month,
        days: b.values.length
          ? Math.round(b.values.reduce((acc, v) => acc + v, 0) / b.values.length)
          : 0,
      }))
    : []

  const savingItemsCurrent = (savingItemsCurrentRes.data ?? []) as SavingPoItemRow[]
  const savingItemsPrev = (savingItemsPrevRes.data ?? []) as SavingPoItemRow[]
  const allSavingItems = [...savingItemsCurrent, ...savingItemsPrev]

  const quotationItemIds = [
    ...new Set(
      allSavingItems.map((i) => i.quotation_item_id).filter((id): id is string => Boolean(id)),
    ),
  ]

  let targetPriceMap = new Map<string, number>()
  if (quotationItemIds.length > 0) {
    const { data: qtItems } = await supabase
      .from("quotation_items")
      .select("id, target_price")
      .in("id", quotationItemIds)
      .not("target_price", "is", null)

    targetPriceMap = new Map(
      ((qtItems ?? []) as { id: string; target_price: number }[]).map((i) => [
        i.id,
        Number(i.target_price),
      ]),
    )
  }

  const savingCurrent = calcSaving(savingItemsCurrent, targetPriceMap)
  const savingPrev = calcSaving(savingItemsPrev, targetPriceMap)
  const savingAcumulado = savingCurrent
  const savingChange =
    savingCurrent != null && savingPrev != null && savingPrev !== 0
      ? Math.round(((savingCurrent - savingPrev) / Math.abs(savingPrev)) * 100)
      : null

  const allHistItems = (savingHistoricoRes.data ?? []) as SavingHistoricoRow[]

  const histQtItemIds = [
    ...new Set(
      allHistItems.map((i) => i.quotation_item_id).filter((id): id is string => Boolean(id)),
    ),
  ]

  let histTargetMap = new Map<string, number>()
  if (histQtItemIds.length > 0) {
    const { data: histQtItems } = await supabase
      .from("quotation_items")
      .select("id, target_price")
      .in("id", histQtItemIds)
      .not("target_price", "is", null)

    histTargetMap = new Map(
      ((histQtItems ?? []) as { id: string; target_price: number }[]).map((i) => [
        i.id,
        Number(i.target_price),
      ]),
    )
  }

  let savingTotalHist = 0
  let hasSavingHist = false
  const fornecedorMap = new Map<string, number>()
  const mesMap = new Map<string, number>()

  allHistItems.forEach((item) => {
    if (!item.quotation_item_id || item.unit_price == null || item.quantity == null) return
    const target = histTargetMap.get(item.quotation_item_id)
    if (target == null) return

    const saving = (target - Number(item.unit_price)) * Number(item.quantity)
    savingTotalHist += saving
    hasSavingHist = true

    const po = Array.isArray(item.purchase_orders) ? item.purchase_orders[0] : item.purchase_orders

    const supplier = po?.supplier_name?.trim() || "Outros"
    fornecedorMap.set(supplier, (fornecedorMap.get(supplier) ?? 0) + saving)

    if (po?.created_at) {
      const d = new Date(po.created_at)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
      const bucket = bucketByKey.get(key)
      if (bucket) {
        mesMap.set(bucket.month, (mesMap.get(bucket.month) ?? 0) + saving)
      }
    }
  })

  const savingHistorico = hasSavingHist ? savingTotalHist : null

  const savingPorFornecedor = Array.from(fornecedorMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, saving]) => ({ name, saving }))

  const savingPorMesDash = monthBuckets.map((b) => ({
    month: b.month,
    saving: mesMap.get(b.month) ?? 0,
  }))

  const itensAtivos = (itensCobertura.data ?? []) as {
    id: string
    target_price: number | null
  }[]
  const totalAtivos = itensAtivos.length
  const comTarget = itensAtivos.filter(
    (i) => i.target_price != null && Number(i.target_price) > 0,
  ).length
  const coberturaPrecoAlvo =
    totalAtivos > 0 ? Math.round((comTarget / totalAtivos) * 100) : null

  return {
    ...empty,
    quotationsPending,
    quotationsByStatus,
    recentActivities,
    ordersInProgress,
    avgLeadTime,
    spendData,
    leadTimeChartData,
    quotationsChange,
    ordersChange,
    leadTimeChange,
    savingAcumulado,
    savingChange,
    savingHistorico,
    savingPorFornecedor,
    savingPorMesDash,
    coberturaPrecoAlvo,
  }
}

export type SupabaseClientFactory = () => SupabaseClient

export function buyerDashboardQueryOptions(
  companyId: string,
  supabaseFactory: SupabaseClientFactory,
) {
  return queryOptions({
    queryKey: queryKeys.dashboardBuyer(companyId),
    queryFn: () => fetchBuyerDashboard(supabaseFactory(), companyId),
    enabled: Boolean(companyId),
  })
}