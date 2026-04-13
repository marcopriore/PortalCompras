"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { format, subMonths } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "@/components/ui/use-toast"
import MultiSelectFilter from "@/components/ui/multi-select-filter"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
  ReferenceLine,
} from "recharts"
import {
  Download,
  FileText,
  TrendingUp,
  DollarSign,
  Package,
  Users,
  Calendar,
  Filter,
  Loader2,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useUser } from "@/lib/hooks/useUser"
import { cn } from "@/lib/utils"

const relatoriosDisponiveis = [
  {
    id: 1,
    titulo: "Análise de Gastos por Categoria",
    descricao: "Relatório detalhado de gastos segmentado por categoria de compras",
    icon: DollarSign,
  },
  {
    id: 2,
    titulo: "Performance de Fornecedores",
    descricao: "Avaliação de desempenho dos fornecedores com métricas de qualidade",
    icon: Users,
  },
  {
    id: 3,
    titulo: "Saving Acumulado",
    descricao: "Economia gerada através de negociações e processos de cotação",
    icon: TrendingUp,
  },
  {
    id: 4,
    titulo: "Lead Time de Compras",
    descricao: "Tempo médio do ciclo de compras da requisição à entrega",
    icon: Package,
  },
]

type Quotation = {
  id: string
  code: string | null
  description: string | null
  status: "draft" | "waiting" | "analysis" | "completed" | "cancelled"
  category: string | null
  created_at: string
}

type QuotationSupplierRow = {
  quotation_id: string
  supplier_name: string | null
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

function getStatusLabel(status: Quotation["status"]): string {
  if (status === "draft") return "Rascunho"
  if (status === "waiting") return "Pendente"
  if (status === "analysis") return "Em Análise"
  if (status === "completed") return "Concluída"
  return "Cancelada"
}

function getStatusColor(status: Quotation["status"]): string {
  const map: Record<Quotation["status"], string> = {
    draft: "var(--color-chart-1)",
    waiting: "var(--color-chart-2)",
    analysis: "var(--color-chart-3)",
    completed: "var(--color-chart-4)",
    cancelled: "var(--color-chart-5)",
  }
  return map[status]
}

function getMonthsBack(periodo: string): number {
  if (periodo === "1m") return 1
  if (periodo === "3m") return 3
  if (periodo === "6m") return 6
  if (periodo === "12m") return 12
  return 6
}

export default function RelatoriosPage() {
  const [periodo, setPeriodo] = useState("6m")
  const [categoria, setCategoria] = useState<string[]>([])
  const [fornecedorFilter, setFornecedorFilter] = useState<string[]>([])
  const [coberturaPrecoAlvo, setCoberturaPrecoAlvo] = useState<number | null>(null)

  const { companyId, loading: userLoading } = useUser()
  const [quotations, setQuotations] = useState<Quotation[]>([])
  const [dashLoading, setDashLoading] = useState(true)
  const [completedOrdersCount, setCompletedOrdersCount] = useState<number | null>(null)
  const [avgLeadTime, setAvgLeadTime] = useState<number | null>(null)
  const [leadTimeMonthlyData, setLeadTimeMonthlyData] = useState<
    { month: string; media: number | null; meta: number }[]
  >([])
  const [pedidosPorStatus, setPedidosPorStatus] = useState<
    { name: string; value: number; color: string }[]
  >([])
  const [topSuppliersByOrders, setTopSuppliersByOrders] = useState<{ name: string; value: number }[]>(
    [],
  )
  const [leadTimeTarget, setLeadTimeTarget] = useState<number>(10)
  const [editingTarget, setEditingTarget] = useState<number | null>(null)
  const [spendPorCategoria, setSpendPorCategoria] = useState<{ name: string; value: number }[]>([])
  const [spendPorMes, setSpendPorMes] = useState<{ month: string; total: number }[]>([])

  const [categoryDateFrom, setCategoryDateFrom] = useState("")
  const [categoryDateTo, setCategoryDateTo] = useState("")
  const [supplierDateFrom, setSupplierDateFrom] = useState("")
  const [supplierDateTo, setSupplierDateTo] = useState("")
  const [savingDateFrom, setSavingDateFrom] = useState("")
  const [savingDateTo, setSavingDateTo] = useState("")
  const [leadtimeDateFrom, setLeadtimeDateFrom] = useState("")
  const [leadtimeDateTo, setLeadtimeDateTo] = useState("")

  const [categoryLoading, setCategoryLoading] = useState(false)
  const [supplierLoading, setSupplierLoading] = useState(false)
  const [savingTotal, setSavingTotal] = useState<number | null>(null)
  const [savingPorMes, setSavingPorMes] = useState<{ month: string; saving: number }[]>([])
  const [savingPorCategoria, setSavingPorCategoria] = useState<{ name: string; value: number }[]>([])
  const [savingLoading, setSavingLoading] = useState(false)

  const periodStartIso = useMemo(() => {
    const months = getMonthsBack(periodo)
    const start = new Date()
    start.setMonth(start.getMonth() - months)
    return start.toISOString()
  }, [periodo])

  useEffect(() => {
    if (userLoading || !companyId) return

    const fetchRealData = async () => {
      setDashLoading(true)
      const supabase = createClient()

      const [
        quotationsRes,
        completedOrdersCountRes,
        ltOrdersRes,
        ltMonthlyRes,
        ordersByStatusRes,
        ordersBySupplierRes,
        ltSettingRes,
        spendItemsRes,
        quotationsForSpendRes,
        monthlySpendOrdersRes,
        itensCobertura,
      ] = await Promise.all([
        supabase
          .from("quotations")
          .select("id, code, description, status, category, created_at")
          .eq("company_id", companyId)
          .gte("created_at", periodStartIso)
          .order("created_at", { ascending: false }),
        supabase
          .from("purchase_orders")
          .select("*", { count: "exact", head: true })
          .eq("company_id", companyId)
          .eq("status", "completed")
          .gte("created_at", periodStartIso),
        supabase
          .from("purchase_orders")
          .select("created_at, estimated_delivery_date")
          .eq("company_id", companyId)
          .eq("status", "completed")
          .not("estimated_delivery_date", "is", null)
          .gte("created_at", periodStartIso),
        supabase
          .from("purchase_orders")
          .select("created_at, estimated_delivery_date")
          .eq("company_id", companyId)
          .eq("status", "completed")
          .not("estimated_delivery_date", "is", null)
          .gte("created_at", subMonths(new Date(), 6).toISOString()),
        supabase
          .from("purchase_orders")
          .select("status")
          .eq("company_id", companyId)
          .gte("created_at", periodStartIso),
        supabase
          .from("purchase_orders")
          .select("supplier_name")
          .eq("company_id", companyId)
          .gte("created_at", periodStartIso)
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
          .gte("purchase_orders.created_at", periodStartIso),
        supabase
          .from("quotations")
          .select("id, category")
          .eq("company_id", companyId),
        supabase
          .from("purchase_orders")
          .select("created_at, total_price, supplier_name")
          .eq("company_id", companyId)
          .eq("status", "completed")
          .gte("created_at", periodStartIso)
          .not("total_price", "is", null),
        supabase
          .from("items")
          .select("id, target_price")
          .eq("company_id", companyId)
          .eq("status", "active"),
      ])

      setQuotations((quotationsRes.data as Quotation[]) ?? [])

      const completedCount = completedOrdersCountRes.count ?? 0
      setCompletedOrdersCount(completedCount)

      const ltOrders =
        (ltOrdersRes.data as { created_at: string; estimated_delivery_date: string }[] | null) ?? []
      const avgLt =
        ltOrders.length > 0
          ? Math.round(
              ltOrders.reduce((acc, po) => {
                const days = Math.max(
                  0,
                  Math.round(
                    (new Date(po.estimated_delivery_date).getTime() -
                      new Date(po.created_at).getTime()) /
                      (1000 * 60 * 60 * 24),
                  ),
                )
                return acc + days
              }, 0) / ltOrders.length,
            )
          : null
      setAvgLeadTime(avgLt)

      const now = new Date()
      const buckets: { key: string; month: string; values: number[] }[] = []
      for (let i = 5; i >= 0; i--) {
        const d = subMonths(now, i)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
        const m = format(d, "MMM", { locale: ptBR }).replace(".", "")
        buckets.push({ key, month: m.charAt(0).toUpperCase() + m.slice(1), values: [] })
      }
      const byKey = new Map(buckets.map((b) => [b.key, b]))
      ;(
        (ltMonthlyRes.data as {
          created_at: string
          estimated_delivery_date: string
        }[] | null) ?? []
      ).forEach((po) => {
        const d = new Date(po.created_at)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
        const b = byKey.get(key)
        if (!b) return
        const days = Math.max(
          0,
          Math.round(
            (new Date(po.estimated_delivery_date).getTime() - new Date(po.created_at).getTime()) /
              (1000 * 60 * 60 * 24),
          ),
        )
        b.values.push(days)
      })
      const parsedTarget = ltSettingRes.data?.value
        ? Number.parseInt(String(ltSettingRes.data.value), 10)
        : 10
      const safeTarget = Number.isFinite(parsedTarget) && parsedTarget > 0 ? parsedTarget : 10
      setLeadTimeTarget(safeTarget)
      setEditingTarget(null)

      setLeadTimeMonthlyData(
        buckets.map((b) => ({
          month: b.month,
          media: b.values.length
            ? Math.round(b.values.reduce((acc, v) => acc + v, 0) / b.values.length)
            : null,
          meta: safeTarget,
        })),
      )

      const statusLabels: Record<string, string> = {
        draft: "Rascunho",
        processing: "Em Processamento",
        sent: "Enviado",
        completed: "Concluído",
        cancelled: "Cancelado",
        error: "Erro",
        refused: "Recusado",
      }
      const pedidosStatus = Object.entries(
        (
          ((ordersByStatusRes.data as { status: PurchaseOrderStatus }[] | null) ?? []).reduce(
            (acc, o) => {
              const label = statusLabels[o.status] ?? o.status
              acc[label] = (acc[label] ?? 0) + 1
              return acc
            },
            {} as Record<string, number>,
          )
        ),
      )
        .map(([name, value], idx) => ({
          name,
          value,
          color: AVATAR_COLORS[idx % AVATAR_COLORS.length],
        }))
        .sort((a, b) => b.value - a.value)
      setPedidosPorStatus(pedidosStatus)

      const topByOrders = Object.entries(
        (
          ((ordersBySupplierRes.data as { supplier_name: string }[] | null) ?? []).reduce(
            (acc, o) => {
              acc[o.supplier_name] = (acc[o.supplier_name] ?? 0) + 1
              return acc
            },
            {} as Record<string, number>,
          )
        ),
      )
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, value]) => ({ name, value }))
      setTopSuppliersByOrders(topByOrders)

      const quotationCategoryMap = new Map(
        (
          (quotationsForSpendRes.data as { id: string; category: string | null }[] | null) ?? []
        ).map((q) => [q.id, q.category ?? "Sem Categoria"]),
      )
      const spendCat = Object.entries(
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
            if (fornecedorFilter.length > 0 && !fornecedorFilter.includes(supplierName)) {
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
      setSpendPorCategoria(spendCat)

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
        .reduce((acc, po) => {
          const month = format(new Date(po.created_at), "MMM/yy", { locale: ptBR })
          acc[month] = (acc[month] ?? 0) + Number(po.total_price ?? 0)
          return acc
        }, {} as Record<string, number>)
      setSpendPorMes(
        Object.entries(spendMonthMap).map(([month, total]) => ({ month, total })),
      )

      const itensAtivos = ((itensCobertura.data ?? []) as {
        id: string
        target_price: number | null
      }[])
      const totalAtivos = itensAtivos.length
      const comTarget = itensAtivos.filter(
        (i) => i.target_price != null && Number(i.target_price) > 0,
      ).length
      setCoberturaPrecoAlvo(
        totalAtivos > 0 ? Math.round((comTarget / totalAtivos) * 100) : null,
      )

      setDashLoading(false)
    }

    fetchRealData()
  }, [companyId, periodStartIso, userLoading, fornecedorFilter])

  const monthsInPeriod = getMonthsBack(periodo)
  const ordersPerMonth =
    completedOrdersCount != null && monthsInPeriod > 0
      ? (completedOrdersCount / monthsInPeriod).toFixed(1)
      : null

  const categoryOptions = useMemo(() => {
    const cats = [
      ...new Set(
        quotations
          .map((q) => q.category)
          .filter((c): c is string => Boolean(c && c.trim()))
          .map((c) => c.trim()),
      ),
    ].sort((a, b) => a.localeCompare(b))
    return cats
  }, [quotations])

  const quotationsFiltered = useMemo(() => {
    if (categoria.length === 0) return quotations
    return quotations.filter((q) => {
      const cat = q.category?.trim() || "Sem Categoria"
      return categoria.includes(cat)
    })
  }, [quotations, categoria])

  const fornecedorOptions = useMemo(() => {
    const names = new Set<string>()
    topSuppliersByOrders.forEach((s) => names.add(s.name))
    return Array.from(names).sort()
  }, [topSuppliersByOrders])

  const topSuppliersByOrdersFiltered = useMemo(() => {
    if (fornecedorFilter.length === 0) return topSuppliersByOrders
    return topSuppliersByOrders.filter((s) => fornecedorFilter.includes(s.name))
  }, [topSuppliersByOrders, fornecedorFilter])

  const spendPorMesFiltrado = useMemo(() => {
    return spendPorMes
  }, [spendPorMes])

  const spendPorCategoriaFiltrada = useMemo(() => {
    return spendPorCategoria
  }, [spendPorCategoria])

  const statusDonutData = useMemo(() => {
    const counts: Record<Quotation["status"], number> = {
      draft: 0,
      waiting: 0,
      analysis: 0,
      completed: 0,
      cancelled: 0,
    }
    quotationsFiltered.forEach((q) => {
      counts[q.status] += 1
    })
    return (Object.keys(counts) as Quotation["status"][]).map((key) => ({
      name: getStatusLabel(key),
      value: counts[key],
      color: getStatusColor(key),
    }))
  }, [quotationsFiltered])

  const monthlyEvolution = useMemo(() => {
    const monthsBack = Math.min(getMonthsBack(periodo), 12)
    const now = new Date()
    const buckets: { key: string; label: string; total: number }[] = []
    for (let i = monthsBack - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
      const monthLabel = d
        .toLocaleDateString("pt-BR", { month: "short" })
        .replace(".", "")
      const label = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)
      buckets.push({ key, label, total: 0 })
    }
    const index = new Map(buckets.map((b) => [b.key, b]))
    quotationsFiltered.forEach((q) => {
      const d = new Date(q.created_at)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
      const bucket = index.get(key)
      if (bucket) bucket.total += 1
    })
    return buckets.map((b) => ({ mes: b.label, total: b.total }))
  }, [quotationsFiltered, periodo])

  const totalQuotations = quotationsFiltered.length

  const downloadExcel = async (workbook: any, filename: string) => {
    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const getTodayDDMMYYYY = () => {
    const now = new Date()
    const dd = String(now.getDate()).padStart(2, "0")
    const mm = String(now.getMonth() + 1).padStart(2, "0")
    const yyyy = String(now.getFullYear())
    return `${dd}${mm}${yyyy}`
  }

  const getIsoRange = (dateFrom?: string, dateTo?: string) => {
    const from = dateFrom?.trim() ? new Date(`${dateFrom}T00:00:00.000Z`).toISOString() : null
    const to = dateTo?.trim() ? new Date(`${dateTo}T23:59:59.999Z`).toISOString() : null
    if (!from && !to) return null
    return { from, to }
  }

  const fetchSavingData = useCallback(async () => {
    if (!companyId) return
    setSavingLoading(true)
    try {
      const supabase = createClient()

      const range = getIsoRange(savingDateFrom, savingDateTo)
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

      if (range?.from) query = query.gte("purchase_orders.created_at", range.from)
      if (range?.to) query = query.lte("purchase_orders.created_at", range.to)

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
        ...new Set(items.map((i) => i.quotation_item_id).filter((id): id is string => Boolean(id))),
      ]

      if (qtItemIds.length === 0) {
        setSavingTotal(null)
        setSavingPorMes([])
        setSavingPorCategoria([])
        return
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
        if (!item.quotation_item_id || item.unit_price == null || item.quantity == null) return
        const info = targetMap.get(item.quotation_item_id)
        if (!info) return

        const po = Array.isArray(item.purchase_orders)
          ? item.purchase_orders[0]
          : item.purchase_orders

        const category = categoryMap.get(info.quotationId) ?? "Sem Categoria"
        if (categoria.length > 0 && !categoria.includes(category)) return

        const saving = (info.target - Number(item.unit_price)) * Number(item.quantity)
        total += saving
        hasAny = true

        if (po?.created_at) {
          const month = format(new Date(po.created_at), "MMM/yy", { locale: ptBR })
          monthMap.set(month, (monthMap.get(month) ?? 0) + saving)
        }

        catMap.set(category, (catMap.get(category) ?? 0) + saving)
      })

      setSavingTotal(hasAny ? total : null)
      setSavingPorMes(Array.from(monthMap.entries()).map(([month, saving]) => ({ month, saving })))
      setSavingPorCategoria(
        Array.from(catMap.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 6)
          .map(([name, value]) => ({ name, value })),
      )
    } finally {
      setSavingLoading(false)
    }
  }, [companyId, savingDateFrom, savingDateTo, categoria, fornecedorFilter])

  useEffect(() => {
    if (userLoading || !companyId) return
    void fetchSavingData()
  }, [companyId, userLoading, fetchSavingData])

  const showUnavailableData = (message: string) => {
    try {
      toast({ title: "Relatório indisponível", description: message })
    } catch {
      window.alert(message)
    }
  }

  const handleExportCategory = async (dateFrom?: string, dateTo?: string) => {
    if (!companyId) return
    setCategoryLoading(true)
    try {
      const supabase = createClient()
      let query = supabase
        .from("quotations")
        .select("id, category, created_at")
        .eq("company_id", companyId)

      const range = getIsoRange(dateFrom, dateTo)
      if (range?.from) query = query.gte("created_at", range.from)
      if (range?.to) query = query.lte("created_at", range.to)

      const res = await query
      const rows = (res.data as { id: string; category: string | null }[]) ?? []

      const total = rows.length
      const map = new Map<string, number>()
      rows.forEach((r) => {
        const label = r.category?.trim() ? r.category : "Sem Categoria"
        map.set(label, (map.get(label) ?? 0) + 1)
      })

      const sorted = Array.from(map.entries())
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count)

      const ExcelJS = (await import("exceljs")).default
      const workbook = new ExcelJS.Workbook()
      const ws = workbook.addWorksheet("Categorias")
      ws.columns = [
        { header: "Categoria", key: "categoria", width: 30 },
        { header: "Total de Cotações", key: "total", width: 20 },
        { header: "% do Total", key: "percent", width: 15 },
      ]

      const headerFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F46E5" } }
      const headerFont = { color: { argb: "FFFFFFFF" }, bold: true }
      const headerRow = ws.getRow(1)
      headerRow.eachCell((cell: any) => {
        cell.fill = headerFill
        cell.font = headerFont
        cell.alignment = { horizontal: "center", vertical: "middle" }
      })

      sorted.forEach((item) => {
        const percent = total > 0 ? item.count / total : 0
        ws.addRow({ categoria: item.category, total: item.count, percent })
      })

      ws.getColumn("percent").numFmt = "0.00%"

      const totalRow = ws.addRow({
        categoria: "TOTAL",
        total,
        percent: total > 0 ? 1 : 0,
      })
      totalRow.eachCell((cell: any) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8E8E8" } }
        cell.font = { bold: true }
      })
      totalRow.getCell("percent").numFmt = "0.00%"

      const filename = `relatorio_categorias_${getTodayDDMMYYYY()}.xlsx`
      await downloadExcel(workbook, filename)
    } finally {
      setCategoryLoading(false)
    }
  }

  const handleExportSuppliers = async (dateFrom?: string, dateTo?: string) => {
    if (!companyId) return
    setSupplierLoading(true)
    try {
      const supabase = createClient()
      const range = getIsoRange(dateFrom, dateTo)

      let query = supabase
        .from("quotation_suppliers")
        .select("quotation_id, supplier_name, quotations!inner(created_at)")
        .eq("company_id", companyId)

      if (range?.from) query = query.gte("quotations.created_at", range.from)
      if (range?.to) query = query.lte("quotations.created_at", range.to)

      const res = await query
      const rows =
        ((res.data as unknown) as { quotation_id: string; supplier_name: string | null }[]) ?? []

      const map = new Map<string, Set<string>>()
      rows.forEach((r) => {
        const name = r.supplier_name?.trim() || "—"
        if (!map.has(name)) map.set(name, new Set())
        map.get(name)!.add(r.quotation_id)
      })

      const sorted = Array.from(map.entries())
        .map(([name, set]) => ({ name, count: set.size }))
        .sort((a, b) => b.count - a.count)

      const ExcelJS = (await import("exceljs")).default
      const workbook = new ExcelJS.Workbook()
      const ws = workbook.addWorksheet("Fornecedores")
      ws.columns = [
        { header: "Fornecedor", key: "fornecedor", width: 40 },
        { header: "Cotações Participadas", key: "count", width: 22 },
        { header: "Ranking", key: "ranking", width: 15 },
      ]

      const headerFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F46E5" } }
      const headerFont = { color: { argb: "FFFFFFFF" }, bold: true }
      const headerRow = ws.getRow(1)
      headerRow.eachCell((cell: any) => {
        cell.fill = headerFill
        cell.font = headerFont
        cell.alignment = { horizontal: "center", vertical: "middle" }
      })

      sorted.forEach((item, idx) => {
        ws.addRow({
          fornecedor: item.name,
          count: item.count,
          ranking: `${idx + 1}º`,
        })
      })

      const filename = `relatorio_fornecedores_${getTodayDDMMYYYY()}.xlsx`
      await downloadExcel(workbook, filename)
    } finally {
      setSupplierLoading(false)
    }
  }

  const handleExportSaving = async () => {
    if (!companyId) return
    setSavingLoading(true)
    try {
      const supabase = createClient()
      const range = getIsoRange(savingDateFrom, savingDateTo)

      let query = supabase
        .from("purchase_order_items")
        .select(
          "unit_price, quantity, material_code, material_description, quotation_item_id, purchase_orders!inner(code, status, created_at, supplier_name, quotation_id, company_id)",
        )
        .eq("purchase_orders.company_id", companyId)
        .in("purchase_orders.status", ["sent", "processing", "completed"])
        .not("quotation_item_id", "is", null)

      if (range?.from) query = query.gte("purchase_orders.created_at", range.from)
      if (range?.to) query = query.lte("purchase_orders.created_at", range.to)

      const { data: poItems } = await query
      const items = (poItems ?? []) as {
        unit_price: number | null
        quantity: number | null
        material_code: string | null
        material_description: string | null
        quotation_item_id: string | null
        purchase_orders:
          | {
              code: string
              created_at: string
              supplier_name: string | null
              quotation_id: string | null
            }
          | {
              code: string
              created_at: string
              supplier_name: string | null
              quotation_id: string | null
            }[]
          | null
      }[]

      const qtItemIds = [
        ...new Set(items.map((i) => i.quotation_item_id).filter((id): id is string => Boolean(id))),
      ]

      if (qtItemIds.length === 0) {
        showUnavailableData("Nenhum item com preço alvo definido encontrado no período.")
        return
      }

      const { data: qtItems } = await supabase
        .from("quotation_items")
        .select("id, target_price")
        .in("id", qtItemIds)
        .not("target_price", "is", null)

      const targetMap = new Map(
        ((qtItems ?? []) as { id: string; target_price: number }[]).map((i) => [
          i.id,
          Number(i.target_price),
        ]),
      )

      const ExcelJS = (await import("exceljs")).default
      const workbook = new ExcelJS.Workbook()
      const ws = workbook.addWorksheet("Saving Realizado")
      ws.columns = [
        { header: "Pedido", key: "pedido", width: 18 },
        { header: "Data", key: "data", width: 14 },
        { header: "Fornecedor", key: "fornecedor", width: 30 },
        { header: "Código", key: "codigo", width: 14 },
        { header: "Descrição", key: "descricao", width: 35 },
        { header: "Qtd", key: "qtd", width: 8 },
        { header: "Preço Alvo", key: "alvo", width: 14 },
        { header: "Preço Pago", key: "pago", width: 14 },
        { header: "Saving Unit.", key: "savingUnit", width: 14 },
        { header: "Saving Total", key: "savingTotal", width: 16 },
      ]

      const headerFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F46E5" } } as any
      const headerFont = { color: { argb: "FFFFFFFF" }, bold: true }
      ws.getRow(1).eachCell((cell: any) => {
        cell.fill = headerFill
        cell.font = headerFont
        cell.alignment = { horizontal: "center", vertical: "middle" }
      })

      let grandTotal = 0
      items.forEach((item) => {
        if (!item.quotation_item_id || item.unit_price == null || item.quantity == null) return
        const target = targetMap.get(item.quotation_item_id)
        if (target == null) return

        const po = Array.isArray(item.purchase_orders) ? item.purchase_orders[0] : item.purchase_orders

        const savingUnit = target - Number(item.unit_price)
        const savingTotalItem = savingUnit * Number(item.quantity)
        grandTotal += savingTotalItem

        const row = ws.addRow({
          pedido: po?.code ?? "—",
          data: po?.created_at ? new Date(po.created_at).toLocaleDateString("pt-BR") : "—",
          fornecedor: po?.supplier_name ?? "—",
          codigo: item.material_code ?? "—",
          descricao: item.material_description ?? "—",
          qtd: item.quantity,
          alvo: target,
          pago: item.unit_price,
          savingUnit,
          savingTotal: savingTotalItem,
        })

        const isPositive = savingTotalItem >= 0
        row.getCell("savingTotal").fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: isPositive ? "FFD1FAE5" : "FFFEE2E2" },
        } as any
        ;["alvo", "pago", "savingUnit", "savingTotal"].forEach((key) => {
          row.getCell(key).numFmt = '"R$" #,##0.00'
        })
      })

      const totalRow = ws.addRow({
        pedido: "TOTAL",
        qtd: "",
        savingTotal: grandTotal,
      })
      totalRow.eachCell({ includeEmpty: true }, (cell: any) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8E8E8" } } as any
        cell.font = { bold: true }
      })
      totalRow.getCell("savingTotal").numFmt = '"R$" #,##0.00'

      await downloadExcel(workbook, `relatorio_saving_${getTodayDDMMYYYY()}.xlsx`)
    } finally {
      setSavingLoading(false)
    }
  }

  const handleExportLeadTime = () => {
    showUnavailableData(
      "O relatório de Lead Time exportará dados reais assim que houver pedidos concluídos com data de entrega estimada.",
    )
  }

  const handleSaveTarget = async () => {
    if (!companyId || editingTarget === null || editingTarget === leadTimeTarget) return
    const supabase = createClient()
    await supabase
      .from("company_settings")
      .upsert(
        {
          company_id: companyId,
          key: "lead_time_target_days",
          value: String(editingTarget),
        },
        { onConflict: "company_id,key" },
      )
    setLeadTimeTarget(editingTarget)
    setLeadTimeMonthlyData((prev) => prev.map((row) => ({ ...row, meta: editingTarget })))
    setEditingTarget(null)
  }

  if (userLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
        Carregando...
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Relatórios</h1>
          <p className="text-muted-foreground">Painel de indicadores de compras</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4">
        <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-sm font-medium text-muted-foreground">Filtros:</span>
        <Select value={periodo} onValueChange={setPeriodo}>
          <SelectTrigger className="w-36">
            <Calendar className="mr-2 h-4 w-4" />
            <SelectValue placeholder="Período" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1m">Último mês</SelectItem>
            <SelectItem value="3m">Últimos 3 meses</SelectItem>
            <SelectItem value="6m">Últimos 6 meses</SelectItem>
            <SelectItem value="12m">Último ano</SelectItem>
          </SelectContent>
        </Select>
        <MultiSelectFilter
          label="Categoria"
          options={categoryOptions.map((c) => ({ value: c, label: c }))}
          selected={categoria}
          onChange={setCategoria}
          width="w-40"
        />
        <MultiSelectFilter
          label="Fornecedor"
          options={fornecedorOptions.map((f) => ({ value: f, label: f }))}
          selected={fornecedorFilter}
          onChange={setFornecedorFilter}
          width="w-44"
        />
        {(categoria.length > 0 || fornecedorFilter.length > 0) && (
          <button
            type="button"
            onClick={() => {
              setCategoria([])
              setFornecedorFilter([])
            }}
            className="text-xs text-muted-foreground hover:text-foreground underline"
          >
            Limpar filtros
          </button>
        )}
      </div>

      <Tabs defaultValue="dashboards" className="w-full">
        <TabsList>
          <TabsTrigger value="dashboards">Dashboards</TabsTrigger>
          <TabsTrigger value="exportar">Exportar Relatórios</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboards" className="mt-6 space-y-10">
          <section className="space-y-4">
            <div className="flex items-center gap-2 border-b border-border pb-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              <h2 className="text-base font-semibold">Saving</h2>
              <span className="text-xs text-muted-foreground">Economia gerada vs. preço alvo</span>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Card
                className={cn(
                  "border-2",
                  savingTotal == null
                    ? "border-border"
                    : savingTotal <= 0
                      ? "border-green-200 bg-green-50"
                      : "border-red-200 bg-red-50",
                )}
              >
                <CardContent className="pt-5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Saving Total
                  </p>
                  <p
                    className={cn(
                      "text-2xl font-bold mt-1",
                      savingTotal == null
                        ? "text-muted-foreground"
                        : savingTotal <= 0
                          ? "text-green-700"
                          : "text-red-700",
                    )}
                  >
                    {savingLoading
                      ? "..."
                      : savingTotal == null
                        ? "—"
                        : savingTotal.toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          })}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {savingTotal == null
                      ? "Defina preços alvo"
                      : savingTotal <= 0
                        ? "Economia vs. preço alvo"
                        : "Acima do preço alvo"}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Saving por Cotação
                  </p>
                  <p className="text-2xl font-bold mt-1">
                    {savingLoading || savingTotal == null || totalQuotations === 0
                      ? "—"
                      : (savingTotal / totalQuotations).toLocaleString("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        })}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Média por cotação no período</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Cobertura Preço Alvo
                  </p>
                  <p className="text-2xl font-bold mt-1">
                    {dashLoading || coberturaPrecoAlvo == null ? "—" : `${coberturaPrecoAlvo}%`}
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
                  <p className="text-xs text-muted-foreground mt-1">
                    Itens ativos com preço alvo definido
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Saving por Mês</CardTitle>
                  <CardDescription>Economia realizada no período</CardDescription>
                </CardHeader>
                <CardContent>
                  {savingPorMes.length === 0 ? (
                    <div className="h-56 flex items-center justify-center text-sm text-muted-foreground">
                      {savingLoading ? "Carregando..." : "Sem dados — defina preços alvo"}
                    </div>
                  ) : (
                    <div className="h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={savingPorMes}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                          <XAxis dataKey="month" className="text-xs" />
                          <YAxis
                            className="text-xs"
                            tickFormatter={(v) =>
                              v >= 1000 ? `R$${(v / 1000).toFixed(0)}k` : `R$${v}`
                            }
                          />
                          <ReferenceLine y={0} stroke="var(--border)" strokeWidth={1.5} />
                          <Tooltip
                            formatter={(v: number) =>
                              v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                            }
                            contentStyle={{
                              backgroundColor: "var(--popover)",
                              border: "1px solid var(--border)",
                              borderRadius: "var(--radius)",
                            }}
                          />
                          <Bar dataKey="saving" name="Saving" radius={4}>
                            {savingPorMes.map((entry, i) => (
                              <Cell
                                key={`saving-mes-${i}`}
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
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Saving por Categoria</CardTitle>
                  <CardDescription>Economia acumulada por categoria</CardDescription>
                </CardHeader>
                <CardContent>
                  {savingPorCategoria.length === 0 ? (
                    <div className="h-56 flex items-center justify-center text-sm text-muted-foreground">
                      {savingLoading ? "Carregando..." : "Sem dados — defina preços alvo"}
                    </div>
                  ) : (
                    <div className="h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={savingPorCategoria} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                          <XAxis
                            type="number"
                            className="text-xs"
                            tickFormatter={(v) =>
                              v >= 1000 ? `R$${(v / 1000).toFixed(0)}k` : `R$${v}`
                            }
                          />
                          <YAxis type="category" dataKey="name" className="text-xs" width={100} />
                          <ReferenceLine x={0} stroke="var(--border)" strokeWidth={1.5} />
                          <Tooltip
                            formatter={(v: number) =>
                              v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                            }
                            contentStyle={{
                              backgroundColor: "var(--popover)",
                              border: "1px solid var(--border)",
                              borderRadius: "var(--radius)",
                            }}
                          />
                          <Bar dataKey="value" name="Saving" radius={4}>
                            {savingPorCategoria.map((entry, i) => (
                              <Cell
                                key={`saving-cat-${i}`}
                                fill={entry.value <= 0 ? "#16a34a" : "#dc2626"}
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
          </section>

          <section className="space-y-4">
            <div className="flex items-center gap-2 border-b border-border pb-2">
              <DollarSign className="h-5 w-5 text-primary" />
              <h2 className="text-base font-semibold">Spend</h2>
              <span className="text-xs text-muted-foreground">Volume financeiro de compras</span>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Card>
                <CardContent className="pt-5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Spend Total
                  </p>
                  <p className="text-2xl font-bold mt-1">
                    {dashLoading
                      ? "—"
                      : spendPorMesFiltrado.reduce((a, b) => a + b.total, 0).toLocaleString("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        })}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Pedidos concluídos no período</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Ticket Médio por Pedido
                  </p>
                  <p className="text-2xl font-bold mt-1">
                    {dashLoading || completedOrdersCount == null || completedOrdersCount === 0
                      ? "—"
                      : (
                          spendPorMesFiltrado.reduce((a, b) => a + b.total, 0) / completedOrdersCount
                        ).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Valor médio por pedido concluído</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Volume de Spend por Mês</CardTitle>
                  <CardDescription>Valor em R$ de pedidos concluídos</CardDescription>
                </CardHeader>
                <CardContent>
                  {spendPorMesFiltrado.length === 0 ? (
                    <div className="h-56 flex items-center justify-center text-sm text-muted-foreground">
                      Nenhum dado disponível
                    </div>
                  ) : (
                    <div className="h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={spendPorMesFiltrado}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                          <XAxis dataKey="month" className="text-xs" />
                          <YAxis
                            className="text-xs"
                            tickFormatter={(v) =>
                              v >= 1000 ? `R$${(v / 1000).toFixed(0)}k` : `R$${v}`
                            }
                          />
                          <Tooltip
                            formatter={(v: number) =>
                              v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                            }
                            contentStyle={{
                              backgroundColor: "var(--popover)",
                              border: "1px solid var(--border)",
                              borderRadius: "var(--radius)",
                            }}
                          />
                          <Bar dataKey="total" fill="var(--color-chart-1)" radius={4} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Spend por Categoria</CardTitle>
                  <CardDescription>Distribuição do gasto por categoria</CardDescription>
                </CardHeader>
                <CardContent>
                  {spendPorCategoriaFiltrada.length === 0 ? (
                    <div className="h-56 flex items-center justify-center text-sm text-muted-foreground">
                      Nenhum dado disponível
                    </div>
                  ) : (
                    <div className="h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={spendPorCategoriaFiltrada} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                          <XAxis
                            type="number"
                            className="text-xs"
                            tickFormatter={(v) =>
                              v >= 1000 ? `R$${(v / 1000).toFixed(0)}k` : `R$${v}`
                            }
                          />
                          <YAxis type="category" dataKey="name" className="text-xs" width={100} />
                          <Tooltip
                            formatter={(v: number) =>
                              v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                            }
                            contentStyle={{
                              backgroundColor: "var(--popover)",
                              border: "1px solid var(--border)",
                              borderRadius: "var(--radius)",
                            }}
                          />
                          <Bar dataKey="value" fill="var(--color-chart-2)" radius={4} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex items-center gap-2 border-b border-border pb-2">
              <Package className="h-5 w-5 text-primary" />
              <h2 className="text-base font-semibold">Pedidos</h2>
              <span className="text-xs text-muted-foreground">Desempenho operacional</span>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Card>
                <CardContent className="pt-5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Pedidos Realizados
                  </p>
                  <p className="text-2xl font-bold mt-1">
                    {dashLoading ? "—" : (completedOrdersCount ?? "—")}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {ordersPerMonth ? `${ordersPerMonth} pedidos/mês` : "No período selecionado"}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Lead Time Médio
                  </p>
                  <p className="text-2xl font-bold mt-1">
                    {dashLoading ? "—" : avgLeadTime != null ? `${avgLeadTime} dias` : "—"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Da requisição ao pedido emitido
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Lead Time vs Meta</CardTitle>
                  <CardDescription>
                    <span>Tempo médio em dias · </span>
                    <span>Meta: </span>
                    <input
                      type="number"
                      min={1}
                      max={365}
                      value={editingTarget ?? leadTimeTarget}
                      onChange={(e) => setEditingTarget(Number(e.target.value))}
                      onBlur={() => void handleSaveTarget()}
                      className="w-12 border rounded px-1 py-0.5 text-xs text-foreground inline-block"
                    />
                    <span> dias</span>
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {!leadTimeMonthlyData.some((d) => d.media !== null) ? (
                    <div className="h-56 flex items-center justify-center text-sm text-muted-foreground">
                      Nenhum dado disponível
                    </div>
                  ) : (
                    <div className="h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={leadTimeMonthlyData}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                          <XAxis dataKey="month" className="text-xs" />
                          <YAxis className="text-xs" domain={[0, 15]} />
                          <Tooltip
                            formatter={(v: number) => `${v} dias`}
                            contentStyle={{
                              backgroundColor: "var(--popover)",
                              border: "1px solid var(--border)",
                              borderRadius: "var(--radius)",
                            }}
                          />
                          <Legend />
                          <Line
                            type="monotone"
                            dataKey="media"
                            name="Lead Time"
                            stroke="var(--color-chart-1)"
                            strokeWidth={2}
                            dot={{ fill: "var(--color-chart-1)" }}
                          />
                          <Line
                            type="monotone"
                            dataKey="meta"
                            name="Meta"
                            stroke="var(--color-destructive)"
                            strokeWidth={2}
                            strokeDasharray="5 5"
                            dot={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Pedidos por Status</CardTitle>
                  <CardDescription>Distribuição por status no período</CardDescription>
                </CardHeader>
                <CardContent className="p-4">
                  {pedidosPorStatus.length === 0 ? (
                    <div className="h-56 flex items-center justify-center text-sm text-muted-foreground">
                      Nenhum dado disponível
                    </div>
                  ) : (
                    <div
                      className="grid w-full items-center gap-2 h-56"
                      style={{ gridTemplateColumns: "minmax(0,1fr) 11rem" }}
                    >
                      <div className="h-full min-w-0">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={pedidosPorStatus}
                              cx="50%"
                              cy="50%"
                              innerRadius="55%"
                              outerRadius="90%"
                              paddingAngle={2}
                              dataKey="value"
                            >
                              {pedidosPorStatus.map((entry, i) => (
                                <Cell key={`po-pie-${i}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip
                              formatter={(v: number) => `${v} pedidos`}
                              contentStyle={{
                                backgroundColor: "var(--popover)",
                                border: "1px solid var(--border)",
                                borderRadius: "var(--radius)",
                              }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        {pedidosPorStatus.map((entry) => {
                          const total = pedidosPorStatus.reduce((a, d) => a + d.value, 0)
                          const pct = total > 0 ? Math.round((entry.value / total) * 100) : 0
                          return (
                            <div
                              key={entry.name}
                              className="flex items-center gap-1.5 text-xs whitespace-nowrap"
                            >
                              <div
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: entry.color }}
                              />
                              <span className="text-muted-foreground">{entry.name}</span>
                              <span className="font-medium">{entry.value}</span>
                              <span className="text-muted-foreground">({pct}%)</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex items-center gap-2 border-b border-border pb-2">
              <FileText className="h-5 w-5 text-primary" />
              <h2 className="text-base font-semibold">Cotações & Fornecedores</h2>
              <span className="text-xs text-muted-foreground">Atividade e participação</span>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Card>
                <CardContent className="pt-5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Total de Cotações
                  </p>
                  <p className="text-2xl font-bold mt-1">{dashLoading ? "—" : totalQuotations}</p>
                  <p className="text-xs text-muted-foreground mt-1">No período selecionado</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Taxa de Conclusão
                  </p>
                  <p className="text-2xl font-bold mt-1">
                    {dashLoading || totalQuotations === 0
                      ? "—"
                      : `${Math.round(
                          ((statusDonutData.find((s) => s.name === "Concluída")?.value ?? 0) /
                            totalQuotations) *
                            100,
                        )}%`}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Cotações concluídas vs. total
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Evolução de Cotações por Mês</CardTitle>
                  <CardDescription>Total de cotações criadas</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={monthlyEvolution}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="mes" className="text-xs" />
                        <YAxis className="text-xs" />
                        <Tooltip
                          formatter={(v: number) => `${v} cotações`}
                          contentStyle={{
                            backgroundColor: "var(--popover)",
                            border: "1px solid var(--border)",
                            borderRadius: "var(--radius)",
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="total"
                          name="Cotações"
                          stroke="var(--color-chart-1)"
                          strokeWidth={2}
                          dot={{ fill: "var(--color-chart-1)" }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Top 5 Fornecedores por Pedidos</CardTitle>
                  <CardDescription>Fornecedores com mais pedidos emitidos</CardDescription>
                </CardHeader>
                <CardContent>
                  {topSuppliersByOrdersFiltered.length === 0 ? (
                    <div className="h-56 flex items-center justify-center text-sm text-muted-foreground">
                      Nenhum dado disponível
                    </div>
                  ) : (
                    <div className="h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={topSuppliersByOrdersFiltered} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                          <XAxis type="number" className="text-xs" />
                          <YAxis
                            type="category"
                            dataKey="name"
                            className="text-xs"
                            width={110}
                            tickFormatter={(v: string) =>
                              v.length > 14 ? `${v.slice(0, 14)}…` : v
                            }
                          />
                          <Tooltip
                            formatter={(v: number) => `${v} pedidos`}
                            contentStyle={{
                              backgroundColor: "var(--popover)",
                              border: "1px solid var(--border)",
                              borderRadius: "var(--radius)",
                            }}
                          />
                          <Bar dataKey="value" fill="var(--color-chart-1)" radius={4} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </section>
        </TabsContent>

        <TabsContent value="exportar" className="mt-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {relatoriosDisponiveis.map((relatorio) => (
              <Card key={relatorio.id}>
                <CardHeader>
                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <relatorio.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-base">{relatorio.titulo}</CardTitle>
                      <CardDescription>{relatorio.descricao}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col gap-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col gap-2">
                        <Label htmlFor={`inicio-${relatorio.id}`}>Data Início</Label>
                        <Input
                          type="date"
                          id={`inicio-${relatorio.id}`}
                          value={
                            relatorio.id === 1
                              ? categoryDateFrom
                              : relatorio.id === 2
                                ? supplierDateFrom
                                : relatorio.id === 3
                                  ? savingDateFrom
                                  : leadtimeDateFrom
                          }
                          onChange={(e) => {
                            const v = e.target.value
                            if (relatorio.id === 1) setCategoryDateFrom(v)
                            else if (relatorio.id === 2) setSupplierDateFrom(v)
                            else if (relatorio.id === 3) setSavingDateFrom(v)
                            else setLeadtimeDateFrom(v)
                          }}
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor={`fim-${relatorio.id}`}>Data Fim</Label>
                        <Input
                          type="date"
                          id={`fim-${relatorio.id}`}
                          value={
                            relatorio.id === 1
                              ? categoryDateTo
                              : relatorio.id === 2
                                ? supplierDateTo
                                : relatorio.id === 3
                                  ? savingDateTo
                                  : leadtimeDateTo
                          }
                          onChange={(e) => {
                            const v = e.target.value
                            if (relatorio.id === 1) setCategoryDateTo(v)
                            else if (relatorio.id === 2) setSupplierDateTo(v)
                            else if (relatorio.id === 3) setSavingDateTo(v)
                            else setLeadtimeDateTo(v)
                          }}
                        />
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      className="w-full"
                      type="button"
                      disabled={
                        (relatorio.id === 1 && categoryLoading) ||
                        (relatorio.id === 2 && supplierLoading) ||
                        (relatorio.id === 3 && savingLoading)
                      }
                      onClick={() => {
                        if (relatorio.id === 1) return handleExportCategory(categoryDateFrom, categoryDateTo)
                        if (relatorio.id === 2) return handleExportSuppliers(supplierDateFrom, supplierDateTo)
                        if (relatorio.id === 3) return handleExportSaving()
                        return handleExportLeadTime()
                      }}
                    >
                      {(relatorio.id === 1 && categoryLoading) ||
                      (relatorio.id === 2 && supplierLoading) ||
                      (relatorio.id === 3 && savingLoading) ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Gerando...
                        </>
                      ) : (
                        <>
                          <Download className="mr-2 h-4 w-4" />
                          Excel
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
