import type { SupabaseClient } from "@supabase/supabase-js"

export const REPORT_PO_STATUSES = ["sent", "processing", "completed"] as const

export type ReportDateRange = {
  from: string
  to: string
  period: string | null
}

function startOfLocalDayIso(d: Date): string {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x.toISOString()
}

function endOfLocalDayIso(d: Date): string {
  const x = new Date(d)
  x.setHours(23, 59, 59, 999)
  return x.toISOString()
}

function monthKey(iso: string): string {
  const d = new Date(iso)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  return `${y}-${m}`
}

/** Expande period/from/to. Aceita period=30d|60d|90d|current_month ou from+to ISO. */
export function parseReportDateRange(
  searchParams: URLSearchParams,
): ReportDateRange | string {
  const period = searchParams.get("period")?.trim() || null
  const fromRaw = searchParams.get("from")?.trim() || null
  const toRaw = searchParams.get("to")?.trim() || null

  if (fromRaw || toRaw) {
    if (!fromRaw || !toRaw) {
      return "Informe from e to juntos (ISO 8601), ou use period."
    }
    if (Number.isNaN(Date.parse(fromRaw)) || Number.isNaN(Date.parse(toRaw))) {
      return "Parâmetros from/to inválidos. Use ISO 8601."
    }
    if (Date.parse(fromRaw) > Date.parse(toRaw)) {
      return "Parâmetro from deve ser anterior ou igual a to."
    }
    return { from: fromRaw, to: toRaw, period: null }
  }

  const now = new Date()
  if (!period || period === "30d") {
    const from = new Date(now)
    from.setDate(from.getDate() - 30)
    return { from: startOfLocalDayIso(from), to: endOfLocalDayIso(now), period: "30d" }
  }
  if (period === "60d") {
    const from = new Date(now)
    from.setDate(from.getDate() - 60)
    return { from: startOfLocalDayIso(from), to: endOfLocalDayIso(now), period: "60d" }
  }
  if (period === "90d") {
    const from = new Date(now)
    from.setDate(from.getDate() - 90)
    return { from: startOfLocalDayIso(from), to: endOfLocalDayIso(now), period: "90d" }
  }
  if (period === "current_month") {
    const from = new Date(now.getFullYear(), now.getMonth(), 1)
    return {
      from: startOfLocalDayIso(from),
      to: endOfLocalDayIso(now),
      period: "current_month",
    }
  }

  return "Parâmetro period inválido. Use 30d | 60d | 90d | current_month."
}

function previousRange(fromIso: string, toIso: string): { from: string; to: string } {
  const fromMs = Date.parse(fromIso)
  const toMs = Date.parse(toIso)
  const span = Math.max(toMs - fromMs, 0)
  const prevTo = new Date(fromMs - 1)
  const prevFrom = new Date(fromMs - 1 - span)
  return { from: prevFrom.toISOString(), to: prevTo.toISOString() }
}

type PoItemRow = {
  unit_price: number | null
  quantity: number | null
  total_price: number | null
  quotation_item_id: string | null
  purchase_orders:
    | {
        id: string
        created_at: string
        quotation_id: string | null
        supplier_id: string | null
        supplier_name: string | null
        code: string | null
      }
    | {
        id: string
        created_at: string
        quotation_id: string | null
        supplier_id: string | null
        supplier_name: string | null
        code: string | null
      }[]
    | null
}

function unwrapPo(row: PoItemRow) {
  return Array.isArray(row.purchase_orders) ? row.purchase_orders[0] : row.purchase_orders
}

async function loadPoItems(
  service: SupabaseClient,
  companyId: string,
  range: { from: string; to: string },
  supplierCode: string | null,
): Promise<
  | { ok: true; items: PoItemRow[] }
  | { ok: false; code: "NOT_FOUND"; message: string }
  | { ok: false; code: "INTERNAL_ERROR"; message: string }
> {
  let supplierId: string | null = null
  if (supplierCode) {
    const { data: supplier } = await service
      .from("suppliers")
      .select("id")
      .eq("company_id", companyId)
      .eq("code", supplierCode)
      .maybeSingle()
    if (!supplier) {
      return {
        ok: false,
        code: "NOT_FOUND",
        message: `Fornecedor não encontrado: ${supplierCode}`,
      }
    }
    supplierId = supplier.id as string
  }

  let query = service
    .from("purchase_order_items")
    .select(
      "unit_price, quantity, total_price, quotation_item_id, purchase_orders!inner(id, company_id, status, created_at, quotation_id, supplier_id, supplier_name, code)",
    )
    .eq("purchase_orders.company_id", companyId)
    .in("purchase_orders.status", [...REPORT_PO_STATUSES])
    .gte("purchase_orders.created_at", range.from)
    .lte("purchase_orders.created_at", range.to)

  if (supplierId) {
    query = query.eq("purchase_orders.supplier_id", supplierId)
  }

  const { data, error } = await query
  if (error) {
    return { ok: false, code: "INTERNAL_ERROR", message: error.message }
  }
  return { ok: true, items: (data ?? []) as PoItemRow[] }
}

async function loadCategoryMaps(
  service: SupabaseClient,
  companyId: string,
  quotationIds: string[],
) {
  const categoryByQuotation = new Map<string, string>()
  if (quotationIds.length === 0) return categoryByQuotation

  const { data } = await service
    .from("quotations")
    .select("id, category")
    .eq("company_id", companyId)
    .in("id", quotationIds)

  for (const q of data ?? []) {
    categoryByQuotation.set(
      q.id as string,
      ((q.category as string | null)?.trim() || "Sem Categoria"),
    )
  }
  return categoryByQuotation
}

export async function buildSavingReport(
  service: SupabaseClient,
  companyId: string,
  range: ReportDateRange,
  options: { category?: string | null; supplierCode?: string | null } = {},
) {
  const loaded = await loadPoItems(service, companyId, range, options.supplierCode ?? null)
  if (!loaded.ok) {
    if (loaded.code === "NOT_FOUND") {
      return { ok: false as const, code: "NOT_FOUND" as const, message: loaded.message }
    }
    return { ok: false as const, message: loaded.message }
  }

  const items = loaded.items.filter((i) => i.quotation_item_id)
  const qtItemIds = [
    ...new Set(items.map((i) => i.quotation_item_id).filter((id): id is string => Boolean(id))),
  ]

  if (qtItemIds.length === 0) {
    return {
      ok: true as const,
      report: {
        from: range.from,
        to: range.to,
        period: range.period,
        statuses: [...REPORT_PO_STATUSES],
        currency: "BRL",
        sign_convention: "positive_means_economy",
        formula: "(target_price - unit_price) * quantity",
        summary: {
          saving_total: 0,
          line_count: 0,
          order_count: 0,
        },
        by_month: [] as { month: string; saving: number }[],
        by_category: [] as { category: string; saving: number }[],
      },
    }
  }

  const { data: qtItems, error: qtError } = await service
    .from("quotation_items")
    .select("id, target_price, quotation_id")
    .in("id", qtItemIds)
    .not("target_price", "is", null)

  if (qtError) {
    return { ok: false as const, message: qtError.message }
  }

  const targetMap = new Map(
    ((qtItems ?? []) as { id: string; target_price: number; quotation_id: string }[]).map(
      (i) => [i.id, { target: Number(i.target_price), quotationId: i.quotation_id }],
    ),
  )

  const quotationIds = [
    ...new Set(Array.from(targetMap.values()).map((v) => v.quotationId).filter(Boolean)),
  ]
  const categoryMap = await loadCategoryMaps(service, companyId, quotationIds)
  const categoryFilter = options.category?.trim() || null

  let savingTotal = 0
  let lineCount = 0
  const orderIds = new Set<string>()
  const monthMap = new Map<string, number>()
  const catMap = new Map<string, number>()

  for (const item of items) {
    if (!item.quotation_item_id || item.unit_price == null || item.quantity == null) continue
    const info = targetMap.get(item.quotation_item_id)
    if (!info) continue
    const po = unwrapPo(item)
    if (!po) continue

    const category = categoryMap.get(info.quotationId) ?? "Sem Categoria"
    if (categoryFilter && category !== categoryFilter) continue

    const saving = (info.target - Number(item.unit_price)) * Number(item.quantity)
    savingTotal += saving
    lineCount += 1
    orderIds.add(po.id)
    monthMap.set(monthKey(po.created_at), (monthMap.get(monthKey(po.created_at)) ?? 0) + saving)
    catMap.set(category, (catMap.get(category) ?? 0) + saving)
  }

  return {
    ok: true as const,
    report: {
      from: range.from,
      to: range.to,
      period: range.period,
      statuses: [...REPORT_PO_STATUSES],
      currency: "BRL",
      sign_convention: "positive_means_economy",
      formula: "(target_price - unit_price) * quantity",
      summary: {
        saving_total: Math.round(savingTotal * 100) / 100,
        line_count: lineCount,
        order_count: orderIds.size,
      },
      by_month: Array.from(monthMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, saving]) => ({ month, saving: Math.round(saving * 100) / 100 })),
      by_category: Array.from(catMap.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([category, saving]) => ({
          category,
          saving: Math.round(saving * 100) / 100,
        })),
    },
  }
}

async function aggregateSpend(
  service: SupabaseClient,
  companyId: string,
  range: { from: string; to: string },
  options: { category?: string | null; supplierCode?: string | null },
) {
  const loaded = await loadPoItems(service, companyId, range, options.supplierCode ?? null)
  if (!loaded.ok) {
    if (loaded.code === "NOT_FOUND") {
      return { ok: false as const, code: "NOT_FOUND" as const, message: loaded.message }
    }
    return { ok: false as const, message: loaded.message }
  }

  const quotationIds = [
    ...new Set(
      loaded.items
        .map((i) => unwrapPo(i)?.quotation_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ]
  const categoryMap = await loadCategoryMaps(service, companyId, quotationIds)
  const categoryFilter = options.category?.trim() || null

  let spendTotal = 0
  const monthMap = new Map<string, number>()
  const catMap = new Map<string, number>()
  const supplierMap = new Map<
    string,
    { supplier_id: string | null; supplier_name: string | null; spend: number; orders: Set<string> }
  >()

  for (const item of loaded.items) {
    const po = unwrapPo(item)
    if (!po) continue
    const category =
      (po.quotation_id ? categoryMap.get(po.quotation_id) : null) ?? "Sem Categoria"
    if (categoryFilter && category !== categoryFilter) continue

    const lineSpend = Number(item.total_price ?? 0)
    spendTotal += lineSpend
    monthMap.set(monthKey(po.created_at), (monthMap.get(monthKey(po.created_at)) ?? 0) + lineSpend)
    catMap.set(category, (catMap.get(category) ?? 0) + lineSpend)

    const key = po.supplier_id ?? po.supplier_name ?? "unknown"
    const bucket = supplierMap.get(key) ?? {
      supplier_id: po.supplier_id,
      supplier_name: po.supplier_name,
      spend: 0,
      orders: new Set<string>(),
    }
    bucket.spend += lineSpend
    bucket.orders.add(po.id)
    supplierMap.set(key, bucket)
  }

  return {
    ok: true as const,
    spendTotal,
    by_month: Array.from(monthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, spend]) => ({ month, spend: Math.round(spend * 100) / 100 })),
    by_category: Array.from(catMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([category, spend]) => ({
        category,
        spend: Math.round(spend * 100) / 100,
        pct_of_total: spendTotal > 0 ? Math.round((spend / spendTotal) * 10000) / 10000 : 0,
      })),
    by_supplier: Array.from(supplierMap.values())
      .sort((a, b) => b.spend - a.spend)
      .map((s) => ({
        supplier_id: s.supplier_id,
        supplier_name: s.supplier_name,
        orders: s.orders.size,
        spend: Math.round(s.spend * 100) / 100,
        pct_of_total: spendTotal > 0 ? Math.round((s.spend / spendTotal) * 10000) / 10000 : 0,
        avg_ticket:
          s.orders.size > 0 ? Math.round((s.spend / s.orders.size) * 100) / 100 : 0,
      })),
  }
}

export async function buildSpendReport(
  service: SupabaseClient,
  companyId: string,
  range: ReportDateRange,
  options: {
    category?: string | null
    supplierCode?: string | null
    includePrevious?: boolean
  } = {},
) {
  const current = await aggregateSpend(service, companyId, range, options)
  if (!current.ok) {
    if ("code" in current) return current
    return { ok: false as const, message: current.message }
  }

  let previousSpendTotal: number | null = null
  let variationPct: number | null = null
  let previousByCategory: {
    category: string
    spend: number
    previous_spend: number
    variation_pct: number | null
    pct_of_total: number
  }[] | null = null

  if (options.includePrevious) {
    const prev = previousRange(range.from, range.to)
    const previous = await aggregateSpend(service, companyId, prev, options)
    if (!previous.ok) {
      if ("code" in previous) return previous
      return { ok: false as const, message: previous.message }
    }
    previousSpendTotal = Math.round(previous.spendTotal * 100) / 100
    variationPct =
      previousSpendTotal > 0
        ? Math.round(
            ((current.spendTotal - previousSpendTotal) / previousSpendTotal) * 10000,
          ) / 10000
        : null

    const prevCat = new Map(previous.by_category.map((c) => [c.category, c.spend]))
    previousByCategory = current.by_category.map((c) => {
      const prevSpend = prevCat.get(c.category) ?? 0
      return {
        category: c.category,
        spend: c.spend,
        previous_spend: prevSpend,
        variation_pct:
          prevSpend > 0
            ? Math.round(((c.spend - prevSpend) / prevSpend) * 10000) / 10000
            : null,
        pct_of_total: c.pct_of_total,
      }
    })
  }

  return {
    ok: true as const,
    report: {
      from: range.from,
      to: range.to,
      period: range.period,
      statuses: [...REPORT_PO_STATUSES],
      currency: "BRL",
      summary: {
        spend_total: Math.round(current.spendTotal * 100) / 100,
        previous_spend_total: previousSpendTotal,
        variation_pct: variationPct,
      },
      by_month: current.by_month,
      by_category: previousByCategory ?? current.by_category,
      by_supplier: current.by_supplier,
    },
  }
}
