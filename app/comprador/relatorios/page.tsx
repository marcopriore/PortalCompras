"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { format, subMonths } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
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
    titulo: "Spend por Categoria",
    descricao:
      "Valor total gasto por categoria, comparativo com período anterior e % do spend total",
    icon: DollarSign,
  },
  {
    id: 2,
    titulo: "Performance de Fornecedores",
    descricao:
      "Scorecard completo: volume comprado, pedidos, lead time e cobertura por fornecedor",
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
    titulo: "Tempo do Processo de Compras",
    descricao: "Eficiência do time: dias entre requisição e pedido, por comprador e por categoria",
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

export default function RelatoriosPage() {
  const [periodo, setPeriodo] = useState("mes_atual")
  const [customDateFrom, setCustomDateFrom] = useState("")
  const [customDateTo, setCustomDateTo] = useState("")
  const [customDateError, setCustomDateError] = useState("")
  const [categoria, setCategoria] = useState<string[]>([])
  const [fornecedorFilter, setFornecedorFilter] = useState<string[]>([])
  const [coberturaPrecoAlvo, setCoberturaPrecoAlvo] = useState<number | null>(null)

  const { companyId, loading: userLoading } = useUser()
  const [quotations, setQuotations] = useState<Quotation[]>([])
  const [dashLoading, setDashLoading] = useState(true)
  const [completedOrdersCount, setCompletedOrdersCount] = useState<number | null>(null)
  const [avgLeadTime, setAvgLeadTime] = useState<number | null>(null)
  const [leadTimeProcessoMensal, setLeadTimeProcessoMensal] = useState<
    { month: string; media: number | null; meta: number }[]
  >([])
  const [leadTimeFornecedorMedio, setLeadTimeFornecedorMedio] = useState<number | null>(null)
  const [leadTimeFornecedorPorFornecedor, setLeadTimeFornecedorPorFornecedor] = useState<
    { name: string; media: number }[]
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

  const [categoryLoading, setCategoryLoading] = useState(false)
  const [supplierLoading, setSupplierLoading] = useState(false)
  const [savingTotal, setSavingTotal] = useState<number | null>(null)
  const [savingPorMes, setSavingPorMes] = useState<{ month: string; saving: number }[]>([])
  const [savingPorCategoria, setSavingPorCategoria] = useState<{ name: string; value: number }[]>([])
  const [savingLoading, setSavingLoading] = useState(false)

  const periodoRange = useMemo(() => {
    const now = new Date()

    if (periodo === "mes_atual") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1)
      return {
        from: start.toISOString(),
        to: now.toISOString(),
      }
    }
    if (periodo === "30d") {
      const start = new Date(now)
      start.setDate(start.getDate() - 30)
      return { from: start.toISOString(), to: now.toISOString() }
    }
    if (periodo === "60d") {
      const start = new Date(now)
      start.setDate(start.getDate() - 60)
      return { from: start.toISOString(), to: now.toISOString() }
    }
    if (periodo === "90d") {
      const start = new Date(now)
      start.setDate(start.getDate() - 90)
      return { from: start.toISOString(), to: now.toISOString() }
    }
    if (periodo === "personalizado" && customDateFrom && customDateTo) {
      return {
        from: new Date(`${customDateFrom}T00:00:00.000Z`).toISOString(),
        to: new Date(`${customDateTo}T23:59:59.999Z`).toISOString(),
      }
    }
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    return { from: start.toISOString(), to: now.toISOString() }
  }, [periodo, customDateFrom, customDateTo])

  /** Compat: início do intervalo (equivalente ao antigo periodStartIso) */
  const periodStartIso = periodoRange.from

  useEffect(() => {
    if (userLoading || !companyId) return

    const fetchRealData = async () => {
      setDashLoading(true)
      const supabase = createClient()

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

      setQuotations((quotationsRes.data as Quotation[]) ?? [])

      const parsedTarget = ltSettingRes.data?.value
        ? Number.parseInt(String(ltSettingRes.data.value), 10)
        : 10
      const safeTarget = Number.isFinite(parsedTarget) && parsedTarget > 0 ? parsedTarget : 10
      setLeadTimeTarget(safeTarget)
      setEditingTarget(null)

      const completedCount = completedOrdersCountRes.count ?? 0
      setCompletedOrdersCount(completedCount)

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

      const processoOrders = ((processoOrdersRes.data ?? []) as {
        created_at: string
        requisition_code: string | null
        supplier_name: string | null
      }[]).filter((o) => {
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
          ((processoReqs ?? []) as { code: string; created_at: string }[]).map((r) => [
            r.code,
            r.created_at,
          ]),
        )
      }

      const processoBuckets: { key: string; month: string; values: number[] }[] = []
      for (let i = 5; i >= 0; i--) {
        const d = subMonths(new Date(), i)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
        const m = format(d, "MMM", { locale: ptBR }).replace(".", "")
        processoBuckets.push({
          key,
          month: m.charAt(0).toUpperCase() + m.slice(1),
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

      setAvgLeadTime(
        processoDiasPedido.length > 0
          ? Math.round(
              processoDiasPedido.reduce((a, v) => a + v, 0) / processoDiasPedido.length,
            )
          : null,
      )

      setLeadTimeProcessoMensal(
        processoBuckets.map((b) => ({
          month: b.month,
          media: b.values.length
            ? Math.round(b.values.reduce((a, v) => a + v, 0) / b.values.length)
            : null,
          meta: safeTarget,
        })),
      )

      const fornecedorItems = ((fornecedorLeadTimeRes.data ?? []) as {
        delivery_days: number | null
        purchase_orders:
          | { supplier_name: string | null; created_at: string }
          | { supplier_name: string | null; created_at: string }[]
          | null
      }[]).filter((item) => {
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

      const mediaGeralForn =
        allDays.length > 0
          ? Math.round(allDays.reduce((a, b) => a + b, 0) / allDays.length)
          : null
      setLeadTimeFornecedorMedio(mediaGeralForn)

      setLeadTimeFornecedorPorFornecedor(
        Array.from(fornecedorDaysMap.entries())
          .map(([name, days]) => ({
            name,
            media: Math.round(days.reduce((a, b) => a + b, 0) / days.length),
          }))
          .sort((a, b) => a.media - b.media)
          .slice(0, 8),
      )

      setDashLoading(false)
    }

    fetchRealData()
  }, [companyId, periodoRange, userLoading, fornecedorFilter])

  const diasNoPeriodo = useMemo(() => {
    const diff = new Date(periodoRange.to).getTime() - new Date(periodoRange.from).getTime()
    return Math.max(1, Math.round(diff / (1000 * 60 * 60 * 24)))
  }, [periodoRange])

  const ordersPerMonth =
    completedOrdersCount != null && diasNoPeriodo > 0
      ? ((completedOrdersCount / diasNoPeriodo) * 30).toFixed(1)
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
    const monthsBack = 6
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
  }, [quotationsFiltered])

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

  const fetchSavingData = useCallback(async () => {
    if (!companyId) return
    setSavingLoading(true)
    try {
      const supabase = createClient()

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

      query = query.gte("purchase_orders.created_at", range.from).lte("purchase_orders.created_at", range.to)

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
  }, [companyId, periodoRange, categoria, fornecedorFilter])

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

  const handleExportSpend = async () => {
    if (!companyId) return
    setCategoryLoading(true)
    try {
      const supabase = createClient()
      const range = { from: periodoRange.from, to: periodoRange.to }

      let queryAtual = supabase
        .from("purchase_order_items")
        .select(
          "total_price, purchase_orders!inner(company_id, status, created_at, quotation_id)",
        )
        .eq("purchase_orders.company_id", companyId)
        .in("purchase_orders.status", ["sent", "processing", "completed"])

      queryAtual = queryAtual
        .gte("purchase_orders.created_at", range.from)
        .lte("purchase_orders.created_at", range.to)

      const msRange = new Date(range.to).getTime() - new Date(range.from).getTime()
      const prevFrom = new Date(new Date(range.from).getTime() - msRange).toISOString()
      const prevTo = range.from

      let queryAnterior = supabase
        .from("purchase_order_items")
        .select(
          "total_price, purchase_orders!inner(company_id, status, created_at, quotation_id)",
        )
        .eq("purchase_orders.company_id", companyId)
        .in("purchase_orders.status", ["sent", "processing", "completed"])

      queryAnterior = queryAnterior
        .gte("purchase_orders.created_at", prevFrom)
        .lte("purchase_orders.created_at", prevTo)

      const [{ data: itemsAtual }, { data: itemsAnterior }, { data: quotations }] =
        await Promise.all([
          queryAtual,
          queryAnterior,
          supabase.from("quotations").select("id, category").eq("company_id", companyId),
        ])

      const catMap = new Map(
        ((quotations ?? []) as { id: string; category: string | null }[]).map((q) => [
          q.id,
          q.category?.trim() || "Sem Categoria",
        ]),
      )

      const buildSpendMap = (items: any[]) => {
        const map = new Map<string, number>()
        items.forEach((item: any) => {
          const po = Array.isArray(item.purchase_orders)
            ? item.purchase_orders[0]
            : item.purchase_orders
          const cat = catMap.get(po?.quotation_id ?? "") ?? "Sem Categoria"
          map.set(cat, (map.get(cat) ?? 0) + Number(item.total_price ?? 0))
        })
        return map
      }

      const spendAtual = buildSpendMap(itemsAtual ?? [])
      const spendAnterior = buildSpendMap(itemsAnterior ?? [])
      const totalAtual = Array.from(spendAtual.values()).reduce((a, b) => a + b, 0)

      const sorted = Array.from(spendAtual.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([cat, valor]) => ({
          categoria: cat,
          valorAtual: valor,
          valorAnterior: spendAnterior.get(cat) ?? 0,
          percentTotal: totalAtual > 0 ? valor / totalAtual : 0,
          variacao:
            (spendAnterior.get(cat) ?? 0) > 0
              ? (valor - (spendAnterior.get(cat) ?? 0)) / (spendAnterior.get(cat) ?? 0)
              : null,
        }))

      const ExcelJS = (await import("exceljs")).default
      const wb = new ExcelJS.Workbook()
      const ws = wb.addWorksheet("Spend por Categoria")
      ws.views = [{ showGridLines: false }]

      const headerFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F46E5" } } as any
      const headerFont = { color: { argb: "FFFFFFFF" }, bold: true }
      const border = {
        top: { style: "thin" as const, color: { argb: "FFDDDDDD" } },
        bottom: { style: "thin" as const, color: { argb: "FFDDDDDD" } },
        left: { style: "thin" as const, color: { argb: "FFDDDDDD" } },
        right: { style: "thin" as const, color: { argb: "FFDDDDDD" } },
      }

      ws.columns = [
        { header: "Categoria", key: "categoria", width: 28 },
        { header: "Spend Atual (R$)", key: "valorAtual", width: 18 },
        { header: "Spend Anterior (R$)", key: "valorAnterior", width: 20 },
        { header: "Variação %", key: "variacao", width: 14 },
        { header: "% do Total", key: "percentTotal", width: 14 },
      ]

      ws.getRow(1).eachCell((cell: any) => {
        cell.fill = headerFill
        cell.font = headerFont
        cell.alignment = { horizontal: "center", vertical: "middle" }
        cell.border = border
      })

      sorted.forEach((row) => {
        const r = ws.addRow({
          categoria: row.categoria,
          valorAtual: row.valorAtual,
          valorAnterior: row.valorAnterior,
          variacao: row.variacao,
          percentTotal: row.percentTotal,
        })
        r.getCell("valorAtual").numFmt = '"R$" #,##0.00'
        r.getCell("valorAnterior").numFmt = '"R$" #,##0.00'
        r.getCell("variacao").numFmt = "+0.00%;-0.00%;0.00%"
        r.getCell("percentTotal").numFmt = "0.00%"
        r.eachCell({ includeEmpty: true }, (cell: any) => {
          cell.border = border
        })

        if (row.variacao != null) {
          r.getCell("variacao").fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: row.variacao <= 0 ? "FFD1FAE5" : "FFFEE2E2" },
          } as any
        }
      })

      const totalRow = ws.addRow({
        categoria: "TOTAL",
        valorAtual: totalAtual,
        valorAnterior: Array.from(spendAnterior.values()).reduce((a, b) => a + b, 0),
        variacao: null,
        percentTotal: 1,
      })
      totalRow.eachCell({ includeEmpty: true }, (cell: any) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8E8E8" } } as any
        cell.font = { bold: true }
        cell.border = border
      })
      totalRow.getCell("valorAtual").numFmt = '"R$" #,##0.00'
      totalRow.getCell("valorAnterior").numFmt = '"R$" #,##0.00'
      totalRow.getCell("percentTotal").numFmt = "0.00%"

      await downloadExcel(wb, `spend_categoria_${getTodayDDMMYYYY()}.xlsx`)
    } finally {
      setCategoryLoading(false)
    }
  }

  const handleExportSuppliers = async () => {
    if (!companyId) return
    setSupplierLoading(true)
    try {
      const supabase = createClient()
      const range = { from: periodoRange.from, to: periodoRange.to }

      let query = supabase
        .from("purchase_orders")
        .select("id, supplier_name, supplier_id, total_price, status, created_at, proposal_id")
        .eq("company_id", companyId)
        .in("status", ["sent", "processing", "completed"])
        .not("supplier_name", "is", null)

      query = query.gte("created_at", range.from).lte("created_at", range.to)

      const { data: orders } = await query
      const orderList = (orders ?? []) as {
        id: string
        supplier_name: string
        supplier_id: string | null
        total_price: number | null
        status: string
        created_at: string
        proposal_id: string | null
      }[]

      const orderIds = orderList.map((o) => o.id)

      const itemsByOrder = new Map<
        string,
        { delivery_days: number | null; quantity: number; unit_price: number }[]
      >()
      if (orderIds.length > 0) {
        const { data: orderItems } = await supabase
          .from("purchase_order_items")
          .select("purchase_order_id, delivery_days, quantity, unit_price")
          .in("purchase_order_id", orderIds)
        ;((orderItems ?? []) as {
          purchase_order_id: string
          delivery_days: number | null
          quantity: number | null
          unit_price: number | null
        }[]).forEach((item) => {
          if (!itemsByOrder.has(item.purchase_order_id)) {
            itemsByOrder.set(item.purchase_order_id, [])
          }
          itemsByOrder.get(item.purchase_order_id)!.push({
            delivery_days: item.delivery_days,
            quantity: Number(item.quantity ?? 0),
            unit_price: Number(item.unit_price ?? 0),
          })
        })
      }

      const supplierMap = new Map<
        string,
        { totalPedidos: number; totalSpend: number; leadTimeDays: number[]; totalItens: number }
      >()

      orderList.forEach((po) => {
        const name = po.supplier_name?.trim() || "—"
        if (!supplierMap.has(name)) {
          supplierMap.set(name, { totalPedidos: 0, totalSpend: 0, leadTimeDays: [], totalItens: 0 })
        }
        const s = supplierMap.get(name)!
        s.totalPedidos++
        s.totalSpend += Number(po.total_price ?? 0)

        const items = itemsByOrder.get(po.id) ?? []
        items.forEach((item) => {
          s.totalItens++
          if (item.delivery_days != null && item.delivery_days > 0) {
            s.leadTimeDays.push(item.delivery_days)
          }
        })
      })

      const totalSpendGeral = Array.from(supplierMap.values()).reduce((a, s) => a + s.totalSpend, 0)

      const sorted = Array.from(supplierMap.entries())
        .map(([name, s]) => ({
          fornecedor: name,
          pedidos: s.totalPedidos,
          spend: s.totalSpend,
          percentSpend: totalSpendGeral > 0 ? s.totalSpend / totalSpendGeral : 0,
          ticketMedio: s.totalPedidos > 0 ? s.totalSpend / s.totalPedidos : 0,
          leadTimeMedio:
            s.leadTimeDays.length > 0
              ? Math.round(s.leadTimeDays.reduce((a, b) => a + b, 0) / s.leadTimeDays.length)
              : null,
          totalItens: s.totalItens,
        }))
        .sort((a, b) => b.spend - a.spend)

      const ExcelJS = (await import("exceljs")).default
      const wb = new ExcelJS.Workbook()
      const ws = wb.addWorksheet("Performance Fornecedores")
      ws.views = [{ showGridLines: false }]

      const headerFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F46E5" } } as any
      const headerFont = { color: { argb: "FFFFFFFF" }, bold: true }
      const border = {
        top: { style: "thin" as const, color: { argb: "FFDDDDDD" } },
        bottom: { style: "thin" as const, color: { argb: "FFDDDDDD" } },
        left: { style: "thin" as const, color: { argb: "FFDDDDDD" } },
        right: { style: "thin" as const, color: { argb: "FFDDDDDD" } },
      }

      ws.columns = [
        { header: "Fornecedor", key: "fornecedor", width: 32 },
        { header: "Pedidos", key: "pedidos", width: 10 },
        { header: "Spend Total (R$)", key: "spend", width: 18 },
        { header: "% do Spend", key: "percentSpend", width: 14 },
        { header: "Ticket Médio (R$)", key: "ticketMedio", width: 18 },
        { header: "Lead Time Médio (dias)", key: "leadTimeMedio", width: 22 },
        { header: "Total de Itens", key: "totalItens", width: 15 },
      ]

      ws.getRow(1).eachCell((cell: any) => {
        cell.fill = headerFill
        cell.font = headerFont
        cell.alignment = { horizontal: "center", vertical: "middle" }
        cell.border = border
      })

      sorted.forEach((row) => {
        const r = ws.addRow({
          fornecedor: row.fornecedor,
          pedidos: row.pedidos,
          spend: row.spend,
          percentSpend: row.percentSpend,
          ticketMedio: row.ticketMedio,
          leadTimeMedio: row.leadTimeMedio,
          totalItens: row.totalItens,
        })
        r.getCell("spend").numFmt = '"R$" #,##0.00'
        r.getCell("percentSpend").numFmt = "0.00%"
        r.getCell("ticketMedio").numFmt = '"R$" #,##0.00'
        r.eachCell({ includeEmpty: true }, (cell: any) => {
          cell.border = border
        })
      })

      const totalRow = ws.addRow({
        fornecedor: "TOTAL",
        pedidos: sorted.reduce((a, s) => a + s.pedidos, 0),
        spend: totalSpendGeral,
        percentSpend: 1,
        ticketMedio: null,
        leadTimeMedio: null,
        totalItens: sorted.reduce((a, s) => a + s.totalItens, 0),
      })
      totalRow.eachCell({ includeEmpty: true }, (cell: any) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8E8E8" } } as any
        cell.font = { bold: true }
        cell.border = border
      })
      totalRow.getCell("spend").numFmt = '"R$" #,##0.00'
      totalRow.getCell("percentSpend").numFmt = "0.00%"

      await downloadExcel(wb, `performance_fornecedores_${getTodayDDMMYYYY()}.xlsx`)
    } finally {
      setSupplierLoading(false)
    }
  }

  const handleExportSaving = async () => {
    if (!companyId) return
    setSavingLoading(true)
    try {
      const supabase = createClient()
      const range = { from: periodoRange.from, to: periodoRange.to }

      let query = supabase
        .from("purchase_order_items")
        .select(
          "unit_price, quantity, material_code, material_description, quotation_item_id, purchase_orders!inner(code, status, created_at, supplier_name, quotation_id, company_id)",
        )
        .eq("purchase_orders.company_id", companyId)
        .in("purchase_orders.status", ["sent", "processing", "completed"])
        .not("quotation_item_id", "is", null)

      query = query.gte("purchase_orders.created_at", range.from).lte("purchase_orders.created_at", range.to)

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

  const handleExportLeadTime = async () => {
    if (!companyId) return
    setSavingLoading(true)
    try {
      const supabase = createClient()
      const range = { from: periodoRange.from, to: periodoRange.to }

      let query = supabase
        .from("purchase_orders")
        .select(
          "id, code, created_at, requisition_code, supplier_name, total_price, status, created_by, quotation_id",
        )
        .eq("company_id", companyId)
        .in("status", ["sent", "processing", "completed"])
        .not("requisition_code", "is", null)
        .neq("requisition_code", "")

      query = query.gte("created_at", range.from).lte("created_at", range.to)

      const { data: orders } = await query
      const orderList = (orders ?? []) as {
        id: string
        code: string
        created_at: string
        requisition_code: string | null
        supplier_name: string | null
        total_price: number | null
        status: string
        created_by: string | null
        quotation_id: string | null
      }[]

      const reqCodes = [...new Set(orderList.map((o) => o.requisition_code).filter(Boolean))] as string[]
      let reqMap = new Map<string, string>()
      if (reqCodes.length > 0) {
        const { data: reqs } = await supabase
          .from("requisitions")
          .select("code, created_at")
          .eq("company_id", companyId)
          .in("code", reqCodes)
        reqMap = new Map(
          ((reqs ?? []) as { code: string; created_at: string }[]).map((r) => [r.code, r.created_at]),
        )
      }

      const buyerIds = [...new Set(orderList.map((o) => o.created_by).filter(Boolean))] as string[]
      let buyerMap = new Map<string, string>()
      if (buyerIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", buyerIds)
        buyerMap = new Map(
          ((profiles ?? []) as { id: string; full_name: string | null }[]).map((p) => [
            p.id,
            p.full_name ?? "—",
          ]),
        )
      }

      const quotationIds = [...new Set(orderList.map((o) => o.quotation_id).filter(Boolean))] as string[]
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

      const rows = orderList
        .map((po) => {
          const reqDate = po.requisition_code ? reqMap.get(po.requisition_code) : null
          const dias = reqDate
            ? Math.max(
                0,
                Math.round(
                  (new Date(po.created_at).getTime() - new Date(reqDate).getTime()) /
                    (1000 * 60 * 60 * 24),
                ),
              )
            : null
          return {
            pedido: po.code,
            dataPedido: new Date(po.created_at).toLocaleDateString("pt-BR"),
            requisicao: po.requisition_code ?? "—",
            dataReq: reqDate ? new Date(reqDate).toLocaleDateString("pt-BR") : "—",
            dias,
            comprador: po.created_by ? (buyerMap.get(po.created_by) ?? "—") : "—",
            fornecedor: po.supplier_name ?? "—",
            categoria: po.quotation_id ? (categoryMap.get(po.quotation_id) ?? "Sem Categoria") : "—",
            valor: po.total_price ?? 0,
          }
        })
        .filter((r) => r.dias != null)

      const compradorMap = new Map<string, number[]>()
      rows.forEach((r) => {
        if (!compradorMap.has(r.comprador)) compradorMap.set(r.comprador, [])
        compradorMap.get(r.comprador)!.push(r.dias!)
      })

      const categoriaMapAgg = new Map<string, number[]>()
      rows.forEach((r) => {
        if (!categoriaMapAgg.has(r.categoria)) categoriaMapAgg.set(r.categoria, [])
        categoriaMapAgg.get(r.categoria)!.push(r.dias!)
      })

      const ExcelJS = (await import("exceljs")).default
      const wb = new ExcelJS.Workbook()

      const headerFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F46E5" } } as any
      const headerFont = { color: { argb: "FFFFFFFF" }, bold: true }
      const border = {
        top: { style: "thin" as const, color: { argb: "FFDDDDDD" } },
        bottom: { style: "thin" as const, color: { argb: "FFDDDDDD" } },
        left: { style: "thin" as const, color: { argb: "FFDDDDDD" } },
        right: { style: "thin" as const, color: { argb: "FFDDDDDD" } },
      }

      const ws1 = wb.addWorksheet("Por Pedido")
      ws1.views = [{ showGridLines: false }]
      ws1.columns = [
        { header: "Pedido", key: "pedido", width: 18 },
        { header: "Data Pedido", key: "dataPedido", width: 14 },
        { header: "Requisição", key: "requisicao", width: 18 },
        { header: "Data Requisição", key: "dataReq", width: 16 },
        { header: "Dias (Req → Pedido)", key: "dias", width: 20 },
        { header: "Comprador", key: "comprador", width: 24 },
        { header: "Fornecedor", key: "fornecedor", width: 28 },
        { header: "Categoria", key: "categoria", width: 20 },
        { header: "Valor Total (R$)", key: "valor", width: 16 },
      ]
      ws1.getRow(1).eachCell((cell: any) => {
        cell.fill = headerFill
        cell.font = headerFont
        cell.alignment = { horizontal: "center", vertical: "middle" }
        cell.border = border
      })
      rows.forEach((row) => {
        const r = ws1.addRow(row)
        r.getCell("valor").numFmt = '"R$" #,##0.00'
        r.eachCell({ includeEmpty: true }, (cell: any) => {
          cell.border = border
        })
      })
      const mediaGeral =
        rows.length > 0 ? Math.round(rows.reduce((a, r) => a + r.dias!, 0) / rows.length) : null
      const totalRow1 = ws1.addRow({
        pedido: "MÉDIA GERAL",
        dias: mediaGeral ?? "—",
        valor: rows.reduce((a, r) => a + r.valor, 0),
      })
      totalRow1.eachCell({ includeEmpty: true }, (cell: any) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8E8E8" } } as any
        cell.font = { bold: true }
        cell.border = border
      })
      totalRow1.getCell("valor").numFmt = '"R$" #,##0.00'

      const ws2 = wb.addWorksheet("Por Comprador")
      ws2.views = [{ showGridLines: false }]
      ws2.columns = [
        { header: "Comprador", key: "comprador", width: 28 },
        { header: "Total de Pedidos", key: "pedidos", width: 18 },
        { header: "Média de Dias", key: "media", width: 16 },
        { header: "Menor Prazo (dias)", key: "menor", width: 18 },
        { header: "Maior Prazo (dias)", key: "maior", width: 18 },
      ]
      ws2.getRow(1).eachCell((cell: any) => {
        cell.fill = headerFill
        cell.font = headerFont
        cell.alignment = { horizontal: "center", vertical: "middle" }
        cell.border = border
      })
      Array.from(compradorMap.entries())
        .sort(
          (a, b) =>
            a[1].reduce((x, y) => x + y, 0) / a[1].length -
            b[1].reduce((x, y) => x + y, 0) / b[1].length,
        )
        .forEach(([comprador, dias]) => {
          const r = ws2.addRow({
            comprador,
            pedidos: dias.length,
            media: Math.round(dias.reduce((a, b) => a + b, 0) / dias.length),
            menor: Math.min(...dias),
            maior: Math.max(...dias),
          })
          r.eachCell({ includeEmpty: true }, (cell: any) => {
            cell.border = border
          })
        })

      const ws3 = wb.addWorksheet("Por Categoria")
      ws3.views = [{ showGridLines: false }]
      ws3.columns = [
        { header: "Categoria", key: "categoria", width: 28 },
        { header: "Total de Pedidos", key: "pedidos", width: 18 },
        { header: "Média de Dias", key: "media", width: 16 },
        { header: "Menor Prazo (dias)", key: "menor", width: 18 },
        { header: "Maior Prazo (dias)", key: "maior", width: 18 },
      ]
      ws3.getRow(1).eachCell((cell: any) => {
        cell.fill = headerFill
        cell.font = headerFont
        cell.alignment = { horizontal: "center", vertical: "middle" }
        cell.border = border
      })
      Array.from(categoriaMapAgg.entries())
        .sort(
          (a, b) =>
            a[1].reduce((x, y) => x + y, 0) / a[1].length -
            b[1].reduce((x, y) => x + y, 0) / b[1].length,
        )
        .forEach(([categoria, dias]) => {
          const r = ws3.addRow({
            categoria,
            pedidos: dias.length,
            media: Math.round(dias.reduce((a, b) => a + b, 0) / dias.length),
            menor: Math.min(...dias),
            maior: Math.max(...dias),
          })
          r.eachCell({ includeEmpty: true }, (cell: any) => {
            cell.border = border
          })
        })

      await downloadExcel(wb, `tempo_processo_compras_${getTodayDDMMYYYY()}.xlsx`)
    } finally {
      setSavingLoading(false)
    }
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
    setLeadTimeProcessoMensal((prev) => prev.map((row) => ({ ...row, meta: editingTarget })))
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
        <Select
          value={periodo}
          onValueChange={(val) => {
            setPeriodo(val)
            setCustomDateError("")
            if (val !== "personalizado") {
              setCustomDateFrom("")
              setCustomDateTo("")
            }
          }}
        >
          <SelectTrigger className="w-44">
            <Calendar className="mr-2 h-4 w-4" />
            <SelectValue placeholder="Período" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="mes_atual">Mês atual</SelectItem>
            <SelectItem value="30d">Últimos 30 dias</SelectItem>
            <SelectItem value="60d">Últimos 60 dias</SelectItem>
            <SelectItem value="90d">Últimos 90 dias</SelectItem>
            <SelectItem value="personalizado">Personalizado</SelectItem>
          </SelectContent>
        </Select>

        {periodo === "personalizado" && (
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={customDateFrom}
              max={customDateTo || undefined}
              onChange={(e) => {
                setCustomDateFrom(e.target.value)
                setCustomDateError("")
                if (customDateTo && e.target.value) {
                  const diff = Math.round(
                    (new Date(customDateTo).getTime() - new Date(e.target.value).getTime()) /
                      (1000 * 60 * 60 * 24),
                  )
                  if (diff > 90) {
                    setCustomDateError("Intervalo máximo de 90 dias")
                  }
                }
              }}
              className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
            />
            <span className="text-muted-foreground text-sm">até</span>
            <input
              type="date"
              value={customDateTo}
              min={customDateFrom || undefined}
              onChange={(e) => {
                setCustomDateTo(e.target.value)
                setCustomDateError("")
                if (customDateFrom && e.target.value) {
                  const diff = Math.round(
                    (new Date(e.target.value).getTime() - new Date(customDateFrom).getTime()) /
                      (1000 * 60 * 60 * 24),
                  )
                  if (diff > 90) {
                    setCustomDateError("Intervalo máximo de 90 dias")
                  }
                }
              }}
              className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
            />
            {customDateError ? (
              <span className="text-xs text-destructive">{customDateError}</span>
            ) : null}
          </div>
        )}
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

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
                    Tempo Médio do Processo
                  </p>
                  <p className="text-2xl font-bold mt-1">
                    {dashLoading ? "—" : avgLeadTime != null ? `${avgLeadTime} dias` : "—"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Da requisição ao pedido emitido
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Lead Time Médio Fornecedor
                  </p>
                  <p className="text-2xl font-bold mt-1">
                    {dashLoading || leadTimeFornecedorMedio == null
                      ? "—"
                      : `${leadTimeFornecedorMedio} dias`}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Prazo médio prometido nas propostas
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Tempo do Processo de Compras</CardTitle>
                  <CardDescription>
                    <span>Req → Pedido em dias · Meta: </span>
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
                  {!leadTimeProcessoMensal.some((d) => d.media !== null) ? (
                    <div className="h-56 flex items-center justify-center text-sm text-muted-foreground">
                      Nenhum dado disponível
                    </div>
                  ) : (
                    <div className="h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={leadTimeProcessoMensal}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                          <XAxis dataKey="month" className="text-xs" />
                          <YAxis className="text-xs" />
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
                            name="Processo"
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
                  <CardTitle className="text-sm">Lead Time por Fornecedor</CardTitle>
                  <CardDescription>Prazo médio prometido nas propostas (dias)</CardDescription>
                </CardHeader>
                <CardContent>
                  {leadTimeFornecedorPorFornecedor.length === 0 ? (
                    <div className="h-56 flex items-center justify-center text-sm text-muted-foreground">
                      {dashLoading ? "Carregando..." : "Nenhum dado disponível"}
                    </div>
                  ) : (
                    <div className="h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={leadTimeFornecedorPorFornecedor} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                          <XAxis type="number" className="text-xs" unit=" dias" />
                          <YAxis
                            type="category"
                            dataKey="name"
                            className="text-xs"
                            width={110}
                            tickFormatter={(v: string) =>
                              v.length > 14 ? v.slice(0, 14) + "…" : v
                            }
                          />
                          <Tooltip
                            formatter={(v: number) => `${v} dias`}
                            contentStyle={{
                              backgroundColor: "var(--popover)",
                              border: "1px solid var(--border)",
                              borderRadius: "var(--radius)",
                            }}
                          />
                          <Bar dataKey="media" name="Lead Time" fill="var(--color-chart-3)" radius={4} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="lg:col-span-2">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Pedidos por Status</CardTitle>
                  <CardDescription>Distribuição por status no período</CardDescription>
                </CardHeader>
                <CardContent className="p-4">
                  {pedidosPorStatus.length === 0 ? (
                    <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
                      Nenhum dado disponível
                    </div>
                  ) : (
                    <div
                      className="grid w-full items-center gap-2 h-48"
                      style={{ gridTemplateColumns: "minmax(0,1fr) 11rem" }}
                    >
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
          <p className="text-sm text-muted-foreground mb-4">
            Os relatórios abaixo usam os filtros de período, categoria e fornecedor selecionados acima.
          </p>
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
                  <Button
                    variant="outline"
                    className="w-full"
                    type="button"
                    disabled={
                      (relatorio.id === 1 && categoryLoading) ||
                      (relatorio.id === 2 && supplierLoading) ||
                      (relatorio.id === 3 && savingLoading) ||
                      (relatorio.id === 4 && savingLoading)
                    }
                    onClick={() => {
                      if (relatorio.id === 1) return void handleExportSpend()
                      if (relatorio.id === 2) return void handleExportSuppliers()
                      if (relatorio.id === 3) return void handleExportSaving()
                      return void handleExportLeadTime()
                    }}
                  >
                    {(relatorio.id === 1 && categoryLoading) ||
                    (relatorio.id === 2 && supplierLoading) ||
                    ((relatorio.id === 3 || relatorio.id === 4) && savingLoading) ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Gerando...
                      </>
                    ) : (
                      <>
                        <Download className="mr-2 h-4 w-4" />
                        Exportar Excel
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
