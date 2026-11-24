import { queryOptions } from "@tanstack/react-query"
import type { SupabaseClient } from "@supabase/supabase-js"
import { subMonths } from "date-fns"
import {
  formatDateBR,
  formatMonthShortBR,
} from "@/lib/formato-data"
import { queryKeys } from "@/lib/queries/keys"

export type ReportsQuotation = {
  id: string
  code: string | null
  description: string | null
  status: "draft" | "waiting" | "analysis" | "completed" | "cancelled"
  category: string | null
  created_at: string
}

type PurchaseOrderStatus =
  | "draft"
  | "processing"
  | "sent"
  | "completed"
  | "cancelled"
  | "error"
  | "refused"

const AVATAR_COLORS = [
  "#4f46e5",
  "#0891b2",
  "#059669",
  "#d97706",
  "#dc2626",
  "#7c3aed",
  "#db2777",
  "#0284c7",
]

export type ReportsPeriodRange = {
  from: string
  to: string
}

export type ReportsDashboardBundle = {
  quotations: ReportsQuotation[]
  completedOrdersCount: number
  leadTimeTarget: number
  avgLeadTime: number | null
  leadTimeProcessoMensal: { month: string; media: number | null; meta: number }[]
  leadTimeFornecedorMedio: number | null
  leadTimeFornecedorPorFornecedor: { name: string; media: number }[]
  pedidosPorStatus: { name: string; value: number; color: string }[]
  topSuppliersByOrders: { name: string; value: number }[]
  spendPorCategoria: { name: string; value: number }[]
  spendPorMes: { month: string; total: number }[]
  coberturaPrecoAlvo: number | null
}

export function reportsBundleQueryKey(
  companyId: string,
  periodoRange: ReportsPeriodRange,
  fornecedorFilter: string[],
) {
  return [
    ...queryKeys.reportsBundle(companyId),
    periodoRange.from,
    periodoRange.to,
    [...fornecedorFilter].sort().join(","),
  ] as const
}

export async function fetchReportsDashboardBundle(
  supabase: SupabaseClient,
  companyId: string,
  periodoRange: ReportsPeriodRange,
  fornecedorFilter: string[],
): Promise<ReportsDashboardBundle> {
  const [
    quotationsRes,
    completedOrdersCountRes,
    ordersByStatusRes,
    ordersBySupplierRes,
    ltSettingRes,
    spendItemsRes,
    quotationsForSpendRes,
    monthlySpendOrdersRes,
    itensCobertura,
    processoOrdersRes,
    fornecedorLeadTimeRes,
  ] = await Promise.all([
    supabase
      .from("quotations")
      .select("id, code, description, status, category, created_at")
      .eq("company_id", companyId)
      .gte("created_at", periodoRange.from)
      .lte("created_at", periodoRange.to)
      .order("created_at", { ascending: false }),
    supabase
      .from("purchase_orders")
      .select("*", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("status", "completed")
      .gte("created_at", periodoRange.from)
      .lte("created_at", periodoRange.to),
    supabase
      .from("purchase_orders")
      .select("status")
      .eq("company_id", companyId)
      .gte("created_at", periodoRange.from)
      .lte("created_at", periodoRange.to),
    supabase
      .from("purchase_orders")
      .select("supplier_name")
      .eq("company_id", companyId)
      .gte("created_at", periodoRange.from)
      .lte("created_at", periodoRange.to)
      .not("supplier_name", "is", null)
      .neq("supplier_name", ""),
    supabase
      .from("company_settings")
      .select("value")
      .eq("company_id", companyId)
      .eq("key", "lead_time_target_days")
      .single(),
    supabase
      .from("purchase_order_items")
      .select(
        "total_price, purchase_orders!inner(company_id, status, quotation_id, created_at, supplier_name)",
      )
      .eq("purchase_orders.company_id", companyId)
      .eq("purchase_orders.status", "completed")
      .gte("purchase_orders.created_at", periodoRange.from)
      .lte("purchase_orders.created_at", periodoRange.to),
    supabase
      .from("quotations")
      .select("id, category")
      .eq("company_id", companyId),
    supabase
      .from("purchase_orders")
      .select("created_at, total_price, supplier_name")
      .eq("company_id", companyId)
      .eq("status", "completed")
      .gte("created_at", periodoRange.from)
      .lte("created_at", periodoRange.to)
      .not("total_price", "is", null),
    supabase
      .from("items")
      .select("id, target_price")
      .eq("company_id", companyId)
      .eq("status", "active"),
    supabase
      .from("purchase_orders")
      .select("created_at, requisition_code, supplier_name")
      .eq("company_id", companyId)
      .in("status", ["sent", "processing", "completed"])
      .not("requisition_code", "is", null)
      .neq("requisition_code", "")
      .gte("created_at", periodoRange.from)
      .lte("created_at", periodoRange.to),
    supabase
      .from("purchase_order_items")
      .select(
        "delivery_days, purchase_orders!inner(company_id, status, supplier_name, created_at)",
      )
      .eq("purchase_orders.company_id", companyId)
      .in("purchase_orders.status", ["sent", "processing", "completed"])
      .not("delivery_days", "is", null)
      .gt("delivery_days", 0)
      .gte("purchase_orders.created_at", periodoRange.from)
      .lte("purchase_orders.created_at", periodoRange.to),
  ])

  const quotations = (quotationsRes.data as ReportsQuotation[]) ?? []

  const parsedTarget = ltSettingRes.data?.value
    ? Number.parseInt(String(ltSettingRes.data.value), 10)
    : 10
  const safeTarget =
    Number.isFinite(parsedTarget) && parsedTarget > 0 ? parsedTarget : 10

  const completedOrdersCount = completedOrdersCountRes.count ?? 0

  const statusLabels: Record<string, string> = {
    draft: "Rascunho",
    processing: "Em Processamento",
    sent: "Enviado",
    completed: "Concluído",
    cancelled: "Cancelado",
    error: "Erro",
    refused: "Recusado",
  }
  const pedidosPorStatus = Object.entries(
    (
      ((ordersByStatusRes.data as { status: PurchaseOrderStatus }[] | null) ??
        []) as { status: PurchaseOrderStatus }[]
    ).reduce(
      (acc, o) => {
        const label = statusLabels[o.status] ?? o.status
        acc[label] = (acc[label] ?? 0) + 1
        return acc
      },
      {} as Record<string, number>,
    ),
  )
    .map(([name, value], idx) => ({
      name,
      value,
      color: AVATAR_COLORS[idx % AVATAR_COLORS.length],
    }))
    .sort((a, b) => b.value - a.value)

  const topSuppliersByOrders = Object.entries(
    (
      ((ordersBySupplierRes.data as { supplier_name: string }[] | null) ??
        []) as { supplier_name: string }[]
    ).reduce(
      (acc, o) => {
        acc[o.supplier_name] = (acc[o.supplier_name] ?? 0) + 1
        return acc
      },
      {} as Record<string, number>,
    ),
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, value]) => ({ name, value }))

  const quotationCategoryMap = new Map(
    (
      (quotationsForSpendRes.data as {
        id: string
        category: string | null
      }[] | null) ?? []
    ).map((q) => [q.id, q.category ?? "Sem Categoria"]),
  )
  const spendPorCategoria = Object.entries(
    (
      (
        (spendItemsRes.data as {
          total_price: number | null
          purchase_orders:
            | { quotation_id: string | null; supplier_name: string | null }
            | { quotation_id: string | null; supplier_name: string | null }[]
            | null
        }[] | null) ?? []
      ).reduce((acc, item) => {
        const po = Array.isArray(item.purchase_orders)
          ? item.purchase_orders[0]
          : item.purchase_orders
        const supplierName = po?.supplier_name?.trim() ?? ""
        if (
          fornecedorFilter.length > 0 &&
          !fornecedorFilter.includes(supplierName)
        ) {
          return acc
        }
        const quotationId = po?.quotation_id ?? null
        const category = quotationId
          ? (quotationCategoryMap.get(quotationId) ?? "Sem Categoria")
          : "Sem Categoria"
        acc[category] = (acc[category] ?? 0) + Number(item.total_price ?? 0)
        return acc
      }, {} as Record<string, number>)
    ),
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, value]) => ({ name, value }))

  const spendMonthMap = (
    (monthlySpendOrdersRes.data as {
      created_at: string
      total_price: number | null
      supplier_name: string | null
    }[] | null) ?? []
  )
    .filter((po) => {
      if (fornecedorFilter.length === 0) return true
      const sn = po.supplier_name?.trim() ?? ""
      return fornecedorFilter.includes(sn)
    })
    .reduce(
      (acc, po) => {
        const month = `${formatMonthShortBR(po.created_at)}/${formatDateBR(po.created_at).slice(-2)}`
        acc[month] = (acc[month] ?? 0) + Number(po.total_price ?? 0)
        return acc
      },
      {} as Record<string, number>,
    )
  const spendPorMes = Object.entries(spendMonthMap).map(([month, total]) => ({
    month,
    total,
  }))

  const itensAtivos = ((itensCobertura.data ?? []) as {
    id: string
    target_price: number | null
  }[])
  const totalAtivos = itensAtivos.length
  const comTarget = itensAtivos.filter(
    (i) => i.target_price != null && Number(i.target_price) > 0,
  ).length
  const coberturaPrecoAlvo =
    totalAtivos > 0 ? Math.round((comTarget / totalAtivos) * 100) : null

  const processoOrders = (
    (processoOrdersRes.data ?? []) as {
      created_at: string
      requisition_code: string | null
      supplier_name: string | null
    }[]
  ).filter((o) => {
    if (fornecedorFilter.length === 0) return true
    const sn = o.supplier_name?.trim() ?? ""
    return fornecedorFilter.includes(sn)
  })

  const processoReqCodes = [
    ...new Set(processoOrders.map((o) => o.requisition_code).filter(Boolean)),
  ] as string[]

  let processoReqMap = new Map<string, string>()
  if (processoReqCodes.length > 0) {
    const { data: processoReqs } = await supabase
      .from("requisitions")
      .select("code, created_at")
      .eq("company_id", companyId)
      .in("code", processoReqCodes)
    processoReqMap = new Map(
      ((processoReqs ?? []) as { code: string; created_at: string }[]).map(
        (r) => [r.code, r.created_at],
      ),
    )
  }

  const processoBuckets: { key: string; month: string; values: number[] }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = subMonths(new Date(), i)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    const m = formatMonthShortBR(d)
    processoBuckets.push({
      key,
      month: m,
      values: [],
    })
  }
  const processoBucketByKey = new Map(processoBuckets.map((b) => [b.key, b]))

  const processoDiasPedido: number[] = []
  processoOrders.forEach((po) => {
    if (!po.requisition_code || !processoReqMap.has(po.requisition_code)) return
    const reqDate = new Date(processoReqMap.get(po.requisition_code) as string)
    const poDate = new Date(po.created_at)
    const days = Math.max(
      0,
      Math.round((poDate.getTime() - reqDate.getTime()) / (1000 * 60 * 60 * 24)),
    )
    processoDiasPedido.push(days)
    const d = new Date(po.created_at)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    const bucket = processoBucketByKey.get(key)
    if (bucket) bucket.values.push(days)
  })

  const avgLeadTime =
    processoDiasPedido.length > 0
      ? Math.round(
          processoDiasPedido.reduce((a, v) => a + v, 0) / processoDiasPedido.length,
        )
      : null

  const leadTimeProcessoMensal = processoBuckets.map((b) => ({
    month: b.month,
    media: b.values.length
      ? Math.round(b.values.reduce((a, v) => a + v, 0) / b.values.length)
      : null,
    meta: safeTarget,
  }))

  const fornecedorItems = (
    (fornecedorLeadTimeRes.data ?? []) as {
      delivery_days: number | null
      purchase_orders:
        | { supplier_name: string | null; created_at: string }
        | { supplier_name: string | null; created_at: string }[]
        | null
    }[]
  ).filter((item) => {
    if (fornecedorFilter.length === 0) return true
    const po = Array.isArray(item.purchase_orders)
      ? item.purchase_orders[0]
      : item.purchase_orders
    const sn = po?.supplier_name?.trim() ?? ""
    return fornecedorFilter.includes(sn)
  })

  const fornecedorDaysMap = new Map<string, number[]>()
  const allDays: number[] = []

  fornecedorItems.forEach((item) => {
    if (!item.delivery_days || item.delivery_days <= 0) return
    const po = Array.isArray(item.purchase_orders)
      ? item.purchase_orders[0]
      : item.purchase_orders
    const supplier = po?.supplier_name?.trim() || "Outros"
    if (!fornecedorDaysMap.has(supplier)) fornecedorDaysMap.set(supplier, [])
    fornecedorDaysMap.get(supplier)!.push(item.delivery_days)
    allDays.push(item.delivery_days)
  })

  const leadTimeFornecedorMedio =
    allDays.length > 0
      ? Math.round(allDays.reduce((a, b) => a + b, 0) / allDays.length)
      : null

  const leadTimeFornecedorPorFornecedor = Array.from(fornecedorDaysMap.entries())
    .map(([name, days]) => ({
      name,
      media: Math.round(days.reduce((a, b) => a + b, 0) / days.length),
    }))
    .sort((a, b) => a.media - b.media)
    .slice(0, 8)

  return {
    quotations,
    completedOrdersCount,
    leadTimeTarget: safeTarget,
    avgLeadTime,
    leadTimeProcessoMensal,
    leadTimeFornecedorMedio,
    leadTimeFornecedorPorFornecedor,
    pedidosPorStatus,
    topSuppliersByOrders,
    spendPorCategoria,
    spendPorMes,
    coberturaPrecoAlvo,
  }
}

export function reportsDashboardBundleQueryOptions(
  supabase: SupabaseClient,
  companyId: string,
  periodoRange: ReportsPeriodRange,
  fornecedorFilter: string[],
) {
  return queryOptions({
    queryKey: reportsBundleQueryKey(companyId, periodoRange, fornecedorFilter),
    queryFn: () =>
      fetchReportsDashboardBundle(
        supabase,
        companyId,
        periodoRange,
        fornecedorFilter,
      ),
    enabled: Boolean(companyId),
  })
}