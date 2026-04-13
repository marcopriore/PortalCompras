 'use client'

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { FileText, ShoppingCart, TrendingDown, TrendingUp, Clock, Eye } from "lucide-react"
import { endOfMonth, format, startOfMonth, subMonths } from "date-fns"
import { ptBR } from "date-fns/locale"
import { createClient } from "@/lib/supabase/client"
import { useUser } from "@/lib/hooks/useUser"
import { MetricsCard } from "@/components/dashboard/metrics-card"
import {
  SpendAnalysisChart,
  QuotationStatusChart,
  LeadTimeChart,
} from "@/components/dashboard/dashboard-charts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from "recharts"
import { cn } from "@/lib/utils"

type QuotationStatus = "draft" | "waiting" | "analysis" | "completed" | "cancelled"

export default function CompradorDashboard() {
  const router = useRouter()
  const { companyId, loading: userLoading } = useUser()

  const [quotationsPending, setQuotationsPending] = useState<number>(0)
  const [quotationsByStatus, setQuotationsByStatus] = useState<
    { name: string; value: number; color: string }[]
  >([])
  const [recentQuotations, setRecentQuotations] = useState<
    { id: string; code: string; description: string; status: QuotationStatus; created_at: string }[]
  >([])
  const [dashLoading, setDashLoading] = useState(true)
  const [ordersInProgress, setOrdersInProgress] = useState<number | null>(null)
  const [avgLeadTime, setAvgLeadTime] = useState<number | null>(null)
  const [spendData, setSpendData] = useState<{ name: string; value: number }[]>([])
  const [leadTimeChartData, setLeadTimeChartData] = useState<{ month: string; days: number }[]>([])
  const [quotationsChange, setQuotationsChange] = useState<number>(0)
  const [ordersChange, setOrdersChange] = useState<number>(0)
  const [leadTimeChange, setLeadTimeChange] = useState<number>(0)
  const [savingAcumulado, setSavingAcumulado] = useState<number | null>(null)
  const [savingChange, setSavingChange] = useState<number | null>(null)
  const [savingHistorico, setSavingHistorico] = useState<number | null>(null)
  const [savingPorFornecedor, setSavingPorFornecedor] = useState<{ name: string; saving: number }[]>(
    [],
  )
  const [savingPorMesDash, setSavingPorMesDash] = useState<{ month: string; saving: number }[]>([])
  const [coberturaPrecoAlvo, setCoberturaPrecoAlvo] = useState<number | null>(null)

  type OrderWithReq = {
    created_at: string
    requisition_code: string | null
  }

  const calcLeadTimeFromReqMap = (
    orders: OrderWithReq[],
    reqMap: Map<string, string>,
  ): number | null => {
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

  useEffect(() => {
    if (userLoading || !companyId) return

    // Reset dados ao trocar de tenant
    setQuotationsPending(0)
    setQuotationsByStatus([])
    setRecentQuotations([])
    setOrdersInProgress(null)
    setAvgLeadTime(null)
    setSpendData([])
    setLeadTimeChartData([])
    setQuotationsChange(0)
    setOrdersChange(0)
    setLeadTimeChange(0)
    setSavingAcumulado(null)
    setSavingChange(null)
    setSavingHistorico(null)
    setSavingPorFornecedor([])
    setSavingPorMesDash([])
    setCoberturaPrecoAlvo(null)

    const fetchDashboard = async () => {
      setDashLoading(true)
      const supabase = createClient()
      const now = new Date()
      const currentMonthStart = startOfMonth(now).toISOString()
      const prevDate = subMonths(now, 1)
      const prevMonthStart = startOfMonth(prevDate).toISOString()
      const prevMonthEnd = endOfMonth(prevDate).toISOString()
      const sixMonthsAgo = subMonths(now, 6).toISOString()

      const [
        quotationsRes,
        recentRes,
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
          .limit(5),
        supabase
          .from("purchase_orders")
          .select("*", { count: "exact", head: true })
          .eq("company_id", companyId)
          .in("status", ["sent", "processing"]),
        supabase
          .from("purchase_orders")
          .select("created_at, requisition_code")
          .eq("company_id", companyId)
          .eq("status", "completed")
          .not("requisition_code", "is", null)
          .neq("requisition_code", "")
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
          .select("created_at, requisition_code")
          .eq("company_id", companyId)
          .eq("status", "completed")
          .not("requisition_code", "is", null)
          .neq("requisition_code", "")
          .gte("created_at", currentMonthStart),
        supabase
          .from("purchase_orders")
          .select("created_at, requisition_code")
          .eq("company_id", companyId)
          .eq("status", "completed")
          .not("requisition_code", "is", null)
          .neq("requisition_code", "")
          .gte("created_at", prevMonthStart)
          .lte("created_at", prevMonthEnd),
        supabase
          .from("purchase_order_items")
          .select("total_price, purchase_orders!inner(company_id, status, quotation_id)")
          .eq("purchase_orders.company_id", companyId)
          .eq("purchase_orders.status", "completed"),
        supabase
          .from("quotations")
          .select("id, category")
          .eq("company_id", companyId),
        supabase
          .from("purchase_orders")
          .select("created_at, requisition_code")
          .eq("company_id", companyId)
          .eq("status", "completed")
          .not("requisition_code", "is", null)
          .neq("requisition_code", "")
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

      if (quotationsRes.data) {
        const all = quotationsRes.data as { status: QuotationStatus }[]
        setQuotationsPending(
          all.filter((q) => q.status === "waiting" || q.status === "analysis").length,
        )

        const statusMap: Record<
          Exclude<QuotationStatus, "draft">,
          { name: string; color: string }
        > = {
          waiting: { name: "Pendentes", color: "var(--warning)" },
          analysis: { name: "Em Análise", color: "var(--accent)" },
          completed: { name: "Respondidas", color: "var(--primary)" },
          cancelled: { name: "Encerradas", color: "var(--muted-foreground)" },
        }

        const grouped = (Object.keys(statusMap) as (keyof typeof statusMap)[]).map(
          (key) => ({
            name: statusMap[key].name,
            value: all.filter((q) => q.status === key).length,
            color: statusMap[key].color,
          }),
        )

        setQuotationsByStatus(grouped.filter((s) => s.value > 0))
      }

      if (recentRes.data) {
        setRecentQuotations(
          (recentRes.data as any[]).map((q) => ({
            id: q.id,
            code: q.code,
            description: q.description,
            status: q.status as QuotationStatus,
            created_at: q.created_at,
          })),
        )
      }

      const ordersCount = ordersInProgressRes.count ?? 0
      setOrdersInProgress(ordersCount)

      const ordersWithReq = (ordersWithReqRes.data as OrderWithReq[] | null) ?? []
      const reqCodesAll = [...new Set(ordersWithReq.map((o) => o.requisition_code).filter(Boolean))]
      let reqMapAll = new Map<string, string>()
      if (reqCodesAll.length > 0) {
        const { data: reqsAll } = await supabase
          .from("requisitions")
          .select("code, created_at")
          .eq("company_id", companyId)
          .in("code", reqCodesAll as string[])
        reqMapAll = new Map(
          ((reqsAll ?? []) as { code: string; created_at: string }[]).map((r) => [
            r.code,
            r.created_at,
          ]),
        )
      }
      setAvgLeadTime(calcLeadTimeFromReqMap(ordersWithReq, reqMapAll))

      const quotationsPendingCurrentMonth = quotationsPendingCurrentMonthRes.count ?? 0
      const quotationsPendingPrev = quotationsPendingPrevRes.count ?? 0
      const qChange =
        quotationsPendingPrev > 0
          ? Math.round(
              ((quotationsPendingCurrentMonth - quotationsPendingPrev) / quotationsPendingPrev) * 100,
            )
          : 0
      setQuotationsChange(qChange)

      const ordersInProgressCurrentMonth = ordersInProgressCurrentMonthRes.count ?? 0
      const ordersInProgressPrev = ordersInProgressPrevRes.count ?? 0
      const oChange =
        ordersInProgressPrev > 0
          ? Math.round(
              ((ordersInProgressCurrentMonth - ordersInProgressPrev) / ordersInProgressPrev) * 100,
            )
          : 0
      setOrdersChange(oChange)

      const leadCurrentOrders = (leadCurrentWithReqRes.data as OrderWithReq[] | null) ?? []
      const leadPrevOrders = (leadPrevWithReqRes.data as OrderWithReq[] | null) ?? []
      const reqCodesCurrent = [
        ...new Set(leadCurrentOrders.map((o) => o.requisition_code).filter(Boolean)),
      ] as string[]
      const reqCodesPrev = [
        ...new Set(leadPrevOrders.map((o) => o.requisition_code).filter(Boolean)),
      ] as string[]
      const allReqCodesForDelta = [...new Set([...reqCodesCurrent, ...reqCodesPrev])]
      let reqMapDelta = new Map<string, string>()
      if (allReqCodesForDelta.length > 0) {
        const { data: reqsDelta } = await supabase
          .from("requisitions")
          .select("code, created_at")
          .eq("company_id", companyId)
          .in("code", allReqCodesForDelta)
        reqMapDelta = new Map(
          ((reqsDelta ?? []) as { code: string; created_at: string }[]).map((r) => [
            r.code,
            r.created_at,
          ]),
        )
      }
      const leadCurrent = calcLeadTimeFromReqMap(leadCurrentOrders, reqMapDelta)
      const leadPrev = calcLeadTimeFromReqMap(leadPrevOrders, reqMapDelta)
      setLeadTimeChange((leadCurrent ?? 0) - (leadPrev ?? 0))

      const quotationCategoryById = new Map<string, string>()
      ;(
        (quotationsForSpendRes.data as { id: string; category: string | null }[] | null) ?? []
      ).forEach((q) => quotationCategoryById.set(q.id, q.category?.trim() || "Sem Categoria"))

      const spendMap = new Map<string, number>()
      ;(
        (poItemsRes.data as {
          total_price: number | null
          purchase_orders:
            | { quotation_id: string | null }
            | { quotation_id: string | null }[]
            | null
        }[] | null) ?? []
      ).forEach((row) => {
        const po = Array.isArray(row.purchase_orders) ? row.purchase_orders[0] : row.purchase_orders
        const quotationId = po?.quotation_id ?? null
        const category =
          (quotationId ? quotationCategoryById.get(quotationId) : null) ?? "Sem Categoria"
        const current = spendMap.get(category) ?? 0
        spendMap.set(category, current + Number(row.total_price ?? 0))
      })
      setSpendData(
        Array.from(spendMap.entries())
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 6),
      )

      const monthBuckets: { key: string; month: string; values: number[] }[] = []
      for (let i = 5; i >= 0; i--) {
        const d = subMonths(now, i)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
        const month = format(d, "MMM", { locale: ptBR })
        const formattedMonth = month.charAt(0).toUpperCase() + month.slice(1).replace(".", "")
        monthBuckets.push({ key, month: formattedMonth, values: [] })
      }
      const bucketByKey = new Map(monthBuckets.map((b) => [b.key, b]))
      const monthlyOrders = (ltMonthlyRes.data as OrderWithReq[] | null) ?? []
      const monthlyReqCodes = [
        ...new Set(monthlyOrders.map((o) => o.requisition_code).filter(Boolean)),
      ] as string[]
      let reqMapMonthly = new Map<string, string>()
      if (monthlyReqCodes.length > 0) {
        const { data: reqsMonthly } = await supabase
          .from("requisitions")
          .select("code, created_at")
          .eq("company_id", companyId)
          .in("code", monthlyReqCodes)
        reqMapMonthly = new Map(
          ((reqsMonthly ?? []) as { code: string; created_at: string }[]).map((r) => [
            r.code,
            r.created_at,
          ]),
        )
      }
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
      setLeadTimeChartData(
        monthBuckets.map((b) => ({
          month: b.month,
          days: b.values.length
            ? Math.round(b.values.reduce((acc, v) => acc + v, 0) / b.values.length)
            : 0,
        })),
      )

      const allSavingItems = [
        ...((savingItemsCurrentRes.data ?? []) as {
          unit_price: number | null
          quantity: number | null
          quotation_item_id: string | null
        }[]),
        ...((savingItemsPrevRes.data ?? []) as {
          unit_price: number | null
          quantity: number | null
          quotation_item_id: string | null
        }[]),
      ]

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

      const calcSaving = (
        items: {
          unit_price: number | null
          quantity: number | null
          quotation_item_id: string | null
        }[],
      ): number | null => {
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

      const savingCurrent = calcSaving(
        (savingItemsCurrentRes.data ?? []) as {
          unit_price: number | null
          quantity: number | null
          quotation_item_id: string | null
        }[],
      )
      const savingPrev = calcSaving(
        (savingItemsPrevRes.data ?? []) as {
          unit_price: number | null
          quantity: number | null
          quotation_item_id: string | null
        }[],
      )

      setSavingAcumulado(savingCurrent)
      setSavingChange(
        savingCurrent != null && savingPrev != null && savingPrev !== 0
          ? Math.round(((savingCurrent - savingPrev) / Math.abs(savingPrev)) * 100)
          : null,
      )

      const allHistItems = (savingHistoricoRes.data ?? []) as {
        unit_price: number | null
        quantity: number | null
        quotation_item_id: string | null
        purchase_orders:
          | { created_at: string; supplier_name: string | null }
          | { created_at: string; supplier_name: string | null }[]
          | null
      }[]

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

      setSavingHistorico(hasSavingHist ? savingTotalHist : null)

      setSavingPorFornecedor(
        Array.from(fornecedorMap.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([name, saving]) => ({ name, saving })),
      )

      setSavingPorMesDash(
        monthBuckets.map((b) => ({
          month: b.month,
          saving: mesMap.get(b.month) ?? 0,
        })),
      )

      const itensAtivos = (itensCobertura.data ?? []) as {
        id: string
        target_price: number | null
      }[]
      const totalAtivos = itensAtivos.length
      const comTarget = itensAtivos.filter(
        (i) => i.target_price != null && Number(i.target_price) > 0,
      ).length
      setCoberturaPrecoAlvo(totalAtivos > 0 ? Math.round((comTarget / totalAtivos) * 100) : null)

      setDashLoading(false)
    }

    fetchDashboard()
  }, [companyId, userLoading])

  const mapStatusToBadge = (status: QuotationStatus) => {
    switch (status) {
      case "draft":
        return { label: "Rascunho", variant: "secondary" as const, className: "" }
      case "waiting":
        return {
          label: "Pendente",
          variant: "outline" as const,
          className: "bg-yellow-100 text-yellow-800",
        }
      case "analysis":
        return {
          label: "Em Análise",
          variant: "outline" as const,
          className: "bg-blue-100 text-blue-800",
        }
      case "completed":
        return {
          label: "Concluída",
          variant: "outline" as const,
          className: "bg-green-100 text-green-800",
        }
      case "cancelled":
      default:
        return { label: "Cancelada", variant: "destructive" as const, className: "" }
    }
  }

  if (userLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
        Carregando...
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Acompanhe suas métricas e atividades de compras
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricsCard
          title="Cotações Pendentes"
          value={quotationsPending}
          change={quotationsChange}
          icon={FileText}
        />
        <MetricsCard
          title="Pedidos em Andamento"
          value={ordersInProgress ?? "—"}
          change={ordersChange}
          icon={ShoppingCart}
        />
        <MetricsCard
          title="Saving Acumulado"
          value={
            savingAcumulado == null
              ? "—"
              : savingAcumulado.toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                })
          }
          change={savingChange ?? 0}
          changeLabel={
            savingAcumulado == null
              ? "Defina preços alvo nos itens"
              : savingAcumulado >= 0
                ? "Economia vs. preço alvo"
                : "Acima do preço alvo"
          }
          icon={TrendingDown}
        />
        <div className="space-y-1">
          <MetricsCard
            title="Tempo Fluxo Compras"
            value={avgLeadTime !== null ? `${avgLeadTime} dias` : "—"}
            change={leadTimeChange}
            changeLabel="vs mês anterior"
            icon={Clock}
          />
          <p className="text-xs text-muted-foreground">Da requisição até o pedido emitido</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SpendAnalysisChart data={spendData} />
        <QuotationStatusChart data={quotationsByStatus} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Atividades Recentes</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="rounded-lg border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Título</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentQuotations.map((q) => {
                      const statusConfig = mapStatusToBadge(q.status)
                      return (
                        <TableRow key={q.id}>
                          <TableCell className="font-medium">{q.code}</TableCell>
                          <TableCell>{q.description}</TableCell>
                          <TableCell>
                            <span className="text-muted-foreground">Cotação</span>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={statusConfig.variant}
                              className={statusConfig.className}
                            >
                              {statusConfig.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {q.created_at
                              ? format(new Date(q.created_at), "dd/MM/yyyy", {
                                  locale: ptBR,
                                })
                              : "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => router.push(`/comprador/cotacoes/${q.id}`)}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              Ver
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                    {recentQuotations.length === 0 && !dashLoading && (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="py-6 text-center text-sm text-muted-foreground"
                        >
                          Nenhuma cotação recente encontrada.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
        <LeadTimeChart data={leadTimeChartData} />
      </div>

      {/* ── Painel de ROI ─────────────────────────────────────── */}
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Painel de ROI</h2>
          <p className="text-sm text-muted-foreground">
            Economia gerada vs. preços alvo do catálogo
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card
            className={cn(
              "border-2",
              savingHistorico == null
                ? "border-border"
                : savingHistorico >= 0
                  ? "border-green-200 bg-green-50"
                  : "border-red-200 bg-red-50",
            )}
          >
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-2">
                <TrendingUp
                  className={cn(
                    "h-5 w-5 shrink-0",
                    savingHistorico == null
                      ? "text-muted-foreground"
                      : savingHistorico >= 0
                        ? "text-green-600"
                        : "text-red-600",
                  )}
                />
                <p className="text-sm text-muted-foreground">Saving Total Histórico</p>
              </div>
              <p
                className={cn(
                  "text-2xl font-bold",
                  savingHistorico == null
                    ? "text-muted-foreground"
                    : savingHistorico >= 0
                      ? "text-green-700"
                      : "text-red-700",
                )}
              >
                {dashLoading
                  ? "—"
                  : savingHistorico == null
                    ? "—"
                    : `${savingHistorico >= 0 ? "+" : ""}${savingHistorico.toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}`}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {savingHistorico == null
                  ? "Defina preços alvo nos itens"
                  : "Todos os pedidos vs. preço alvo"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground mb-2">Cobertura de Preço Alvo</p>
              <p className="text-2xl font-bold">
                {dashLoading || coberturaPrecoAlvo == null ? "—" : `${coberturaPrecoAlvo}%`}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Itens do catálogo com preço alvo definido
              </p>
              {coberturaPrecoAlvo != null && (
                <div className="mt-2 w-full bg-border rounded-full h-1.5">
                  <div
                    className={cn(
                      "h-1.5 rounded-full transition-all",
                      coberturaPrecoAlvo >= 80
                        ? "bg-green-500"
                        : coberturaPrecoAlvo >= 50
                          ? "bg-yellow-500"
                          : "bg-red-500",
                    )}
                    style={{ width: `${coberturaPrecoAlvo}%` }}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Saving por Fornecedor</CardTitle>
              <p className="text-sm text-muted-foreground">
                Top 5 fornecedores por economia gerada
              </p>
            </CardHeader>
            <CardContent>
              {savingPorFornecedor.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">
                  {dashLoading ? "Carregando..." : "Nenhum dado — defina preços alvo nos itens"}
                </div>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={savingPorFornecedor} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis
                        type="number"
                        className="text-xs"
                        tickFormatter={(value) =>
                          value >= 1000 ? `R$ ${(value / 1000).toFixed(0)}k` : `R$ ${value}`
                        }
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        className="text-xs"
                        width={100}
                        tickFormatter={(v: string) => (v.length > 14 ? `${v.slice(0, 14)}…` : v)}
                      />
                      <Tooltip
                        formatter={(value: number) =>
                          `${value >= 0 ? "+" : ""}${value.toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          })}`
                        }
                        contentStyle={{
                          backgroundColor: "var(--popover)",
                          border: "1px solid var(--border)",
                          borderRadius: "var(--radius)",
                        }}
                      />
                      <Bar dataKey="saving" name="Saving" radius={4}>
                        {savingPorFornecedor.map((entry, index) => (
                          <Cell
                            key={`cell-fornecedor-${index}`}
                            fill={entry.saving <= 0 ? "#16a34a" : "#dc2626"}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Saving por Mês</CardTitle>
              <p className="text-sm text-muted-foreground">
                Economia realizada nos últimos 6 meses
              </p>
            </CardHeader>
            <CardContent>
              {savingPorMesDash.every((d) => d.saving === 0) ? (
                <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">
                  {dashLoading ? "Carregando..." : "Nenhum dado — defina preços alvo nos itens"}
                </div>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={savingPorMesDash}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="month" className="text-xs" />
                      <YAxis
                        className="text-xs"
                        tickFormatter={(value) =>
                          value >= 1000 ? `R$ ${(value / 1000).toFixed(0)}k` : `R$ ${value}`
                        }
                      />
                      <ReferenceLine y={0} stroke="var(--border)" strokeWidth={1.5} />
                      <Tooltip
                        formatter={(value: number) =>
                          `${value >= 0 ? "+" : ""}${value.toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          })}`
                        }
                        contentStyle={{
                          backgroundColor: "var(--popover)",
                          border: "1px solid var(--border)",
                          borderRadius: "var(--radius)",
                        }}
                      />
                      <Bar dataKey="saving" name="Saving" radius={4}>
                        {savingPorMesDash.map((entry, index) => (
                          <Cell
                            key={`cell-mes-${index}`}
                            fill={entry.saving <= 0 ? "#16a34a" : "#dc2626"}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
