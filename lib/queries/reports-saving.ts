import { queryOptions } from "@tanstack/react-query"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  formatDateBR,
  formatMonthShortBR,
} from "@/lib/formato-data"
import { queryKeys } from "@/lib/queries/keys"
import type { ReportsPeriodRange } from "@/lib/queries/reports-bundle"

export type ReportsSavingBundle = {
  savingTotal: number | null
  savingPorMes: { month: string; saving: number }[]
  savingPorCategoria: { name: string; value: number }[]
}

export async function fetchReportsSavingBundle(
  supabase: SupabaseClient,
  companyId: string,
  periodoRange: ReportsPeriodRange,
  fornecedorFilter: string[],
  categoria: string[],
): Promise<ReportsSavingBundle> {
  const range = { from: periodoRange.from, to: periodoRange.to }
  let query = supabase
    .from("purchase_order_items")
    .select(
      "unit_price, quantity, quotation_item_id, purchase_orders!inner(company_id, status, created_at, quotation_id, supplier_name)",
    )
    .eq("purchase_orders.company_id", companyId)
    .in("purchase_orders.status", ["sent", "processing", "completed"])
    .not("quotation_item_id", "is", null)

  if (fornecedorFilter.length > 0) {
    query = query.in("purchase_orders.supplier_name", fornecedorFilter)
  }

  query = query
    .gte("purchase_orders.created_at", range.from)
    .lte("purchase_orders.created_at", range.to)

  const { data: poItems } = await query

  const items = (poItems ?? []) as {
    unit_price: number | null
    quantity: number | null
    quotation_item_id: string | null
    purchase_orders:
      | { created_at: string; quotation_id: string | null; supplier_name: string | null }
      | { created_at: string; quotation_id: string | null; supplier_name: string | null }[]
      | null
  }[]

  const qtItemIds = [
    ...new Set(
      items
        .map((i) => i.quotation_item_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ]

  if (qtItemIds.length === 0) {
    return {
      savingTotal: null,
      savingPorMes: [],
      savingPorCategoria: [],
    }
  }

  const { data: qtItems } = await supabase
    .from("quotation_items")
    .select("id, target_price, quotation_id")
    .in("id", qtItemIds)
    .not("target_price", "is", null)

  const targetMap = new Map(
    ((qtItems ?? []) as { id: string; target_price: number; quotation_id: string }[]).map(
      (i) => [i.id, { target: Number(i.target_price), quotationId: i.quotation_id }],
    ),
  )

  const quotationIds = [
    ...new Set(
      Array.from(targetMap.values())
        .map((v) => v.quotationId)
        .filter((id): id is string => Boolean(id)),
    ),
  ]
  let categoryMap = new Map<string, string>()
  if (quotationIds.length > 0) {
    const { data: qts } = await supabase
      .from("quotations")
      .select("id, category")
      .in("id", quotationIds)
    categoryMap = new Map(
      ((qts ?? []) as { id: string; category: string | null }[]).map((q) => [
        q.id,
        q.category?.trim() || "Sem Categoria",
      ]),
    )
  }

  let total = 0
  let hasAny = false
  const monthMap = new Map<string, number>()
  const catMap = new Map<string, number>()

  items.forEach((item) => {
    if (!item.quotation_item_id || item.unit_price == null || item.quantity == null) {
      return
    }
    const info = targetMap.get(item.quotation_item_id)
    if (!info) return

    const po = Array.isArray(item.purchase_orders)
      ? item.purchase_orders[0]
      : item.purchase_orders

    const category = categoryMap.get(info.quotationId) ?? "Sem Categoria"
    if (categoria.length > 0 && !categoria.includes(category)) return

    const saving =
      (info.target - Number(item.unit_price)) * Number(item.quantity)
    total += saving
    hasAny = true

    if (po?.created_at) {
      const month = `${formatMonthShortBR(po.created_at)}/${formatDateBR(po.created_at).slice(-2)}`
      monthMap.set(month, (monthMap.get(month) ?? 0) + saving)
    }

    catMap.set(category, (catMap.get(category) ?? 0) + saving)
  })

  return {
    savingTotal: hasAny ? total : null,
    savingPorMes: Array.from(monthMap.entries()).map(([month, saving]) => ({
      month,
      saving,
    })),
    savingPorCategoria: Array.from(catMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, value]) => ({ name, value })),
  }
}

export function reportsSavingBundleQueryOptions(
  supabase: SupabaseClient,
  companyId: string,
  periodoRange: ReportsPeriodRange,
  fornecedorFilter: string[],
  categoria: string[],
) {
  return queryOptions({
    queryKey: queryKeys.reportsSaving(
      companyId,
      periodoRange.from,
      periodoRange.to,
      [...fornecedorFilter].sort().join(","),
      [...categoria].sort().join(","),
    ),
    queryFn: () =>
      fetchReportsSavingBundle(
        supabase,
        companyId,
        periodoRange,
        fornecedorFilter,
        categoria,
      ),
    enabled: Boolean(companyId),
  })
}