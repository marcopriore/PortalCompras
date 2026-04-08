"use client"

import { useEffect, useMemo, useState } from "react"
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

  const { companyId } = useUser()
  const [quotations, setQuotations] = useState<Quotation[]>([])
  const [supplierRows, setSupplierRows] = useState<QuotationSupplierRow[]>([])
  const [dashLoading, setDashLoading] = useState(true)
  const [completedOrdersCount, setCompletedOrdersCount] = useState<number | null>(null)
  const [avgLeadTime, setAvgLeadTime] = useState<number | null>(null)
  const [leadTimeMonthlyData, setLeadTimeMonthlyData] = useState<
    { month: string; media: number | null; meta: number }[]
  >([])

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

  const periodStartIso = useMemo(() => {
    const months = getMonthsBack(periodo)
    const start = new Date()
    start.setMonth(start.getMonth() - months)
    return start.toISOString()
  }, [periodo])

  useEffect(() => {
    if (!companyId) return

    const fetchRealData = async () => {
      setDashLoading(true)
      const supabase = createClient()

      const [
        quotationsRes,
        suppliersRes,
        completedOrdersCountRes,
        ltOrdersRes,
        ltMonthlyRes,
      ] = await Promise.all([
        supabase
          .from("quotations")
          .select("id, code, description, status, category, created_at")
          .eq("company_id", companyId)
          .gte("created_at", periodStartIso)
          .order("created_at", { ascending: false }),
        supabase
          .from("quotation_suppliers")
          .select("quotation_id, supplier_name")
          .eq("company_id", companyId),
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
      ])

      setQuotations((quotationsRes.data as Quotation[]) ?? [])
      setSupplierRows((suppliersRes.data as QuotationSupplierRow[]) ?? [])

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
      setLeadTimeMonthlyData(
        buckets.map((b) => ({
          month: b.month,
          media: b.values.length
            ? Math.round(b.values.reduce((acc, v) => acc + v, 0) / b.values.length)
            : null,
          meta: 10,
        })),
      )

      setDashLoading(false)
    }

    fetchRealData()
  }, [companyId, periodStartIso])

  const totalQuotations = quotations.length
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

  const statusDonutData = useMemo(() => {
    const counts: Record<Quotation["status"], number> = {
      draft: 0,
      waiting: 0,
      analysis: 0,
      completed: 0,
      cancelled: 0,
    }
    quotations.forEach((q) => {
      counts[q.status] += 1
    })
    return (Object.keys(counts) as Quotation["status"][]).map((key) => ({
      name: getStatusLabel(key),
      value: counts[key],
      color: getStatusColor(key),
    }))
  }, [quotations])

  const categoryDonutData = useMemo(() => {
    const map = new Map<string, number>()
    quotations.forEach((q) => {
      const label = q.category?.trim() ? q.category : "Sem Categoria"
      map.set(label, (map.get(label) ?? 0) + 1)
    })
    const entries = Array.from(map.entries()).sort((a, b) => b[1] - a[1])
    return entries.map(([name, value], idx) => ({
      name,
      value,
      color: AVATAR_COLORS[idx % AVATAR_COLORS.length],
    }))
  }, [quotations])

  const topSuppliersData = useMemo(() => {
    const inPeriodIds = new Set(quotations.map((q) => q.id))
    const map = new Map<string, Set<string>>()
    supplierRows.forEach((row) => {
      if (!inPeriodIds.has(row.quotation_id)) return
      const name = row.supplier_name?.trim() || "—"
      if (!map.has(name)) map.set(name, new Set())
      map.get(name)!.add(row.quotation_id)
    })
    return Array.from(map.entries())
      .map(([nome, set]) => ({ nome, count: set.size }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
  }, [supplierRows, quotations])

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
    quotations.forEach((q) => {
      const d = new Date(q.created_at)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
      const bucket = index.get(key)
      if (bucket) bucket.total += 1
    })
    return buckets.map((b) => ({ mes: b.label, total: b.total }))
  }, [quotations, periodo])

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

  const handleExportSaving = () => {
    showUnavailableData(
      "O relatório de Saving estará disponível após configuração de preços de referência por item.",
    )
  }

  const handleExportLeadTime = () => {
    showUnavailableData(
      "O relatório de Lead Time exportará dados reais assim que houver pedidos concluídos com data de entrega estimada.",
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Relatórios</h1>
          <p className="text-muted-foreground">
            Análises e indicadores de compras
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Select value={periodo} onValueChange={setPeriodo}>
            <SelectTrigger className="w-full sm:w-36">
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
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total de Cotações
            </CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {dashLoading ? "—" : totalQuotations}
            </div>
            <p className="text-xs text-muted-foreground">cotações registradas</p>
          </CardContent>
        </Card>
        <Card className="relative border-2 border-border rounded-lg">
          <span className="absolute top-3 right-3 text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded font-medium">
            Indisponível
          </span>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Saving Total
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-muted-foreground">—</div>
            <p className="text-xs text-muted-foreground">Disponível em breve</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pedidos Realizados
            </CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashLoading ? "—" : (completedOrdersCount ?? "—")}</div>
            <p className="text-xs text-muted-foreground">
              {ordersPerMonth ? `${ordersPerMonth} pedidos/mês` : ""}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Lead Time Médio
            </CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {dashLoading ? "—" : avgLeadTime !== null ? `${avgLeadTime} dias` : "—"}
            </div>
            <p className="text-xs text-muted-foreground"></p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="dashboards" className="w-full">
        <TabsList>
          <TabsTrigger value="dashboards">Dashboards</TabsTrigger>
          <TabsTrigger value="exportar">Exportar Relatórios</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboards" className="mt-4">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Evolução de Cotações por Mês</CardTitle>
                <CardDescription>Total de cotações criadas</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={monthlyEvolution}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="mes" className="text-xs" />
                      <YAxis className="text-xs" />
                      <Tooltip
                        formatter={(value: number) => `${value} cotações`}
                        contentStyle={{
                          backgroundColor: "var(--popover)",
                          border: "1px solid var(--border)",
                          borderRadius: "var(--radius)",
                        }}
                      />
                      <Legend />
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
              <CardHeader>
                <CardTitle>Cotações por Status</CardTitle>
                <CardDescription>Distribuição de cotações por status</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusDonutData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                        dataKey="value"
                        label={({ name, percent }) =>
                          `${name} ${(percent * 100).toFixed(0)}%`
                        }
                        labelLine={false}
                      >
                        {statusDonutData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => `${value} cotações`}
                        contentStyle={{
                          backgroundColor: "var(--popover)",
                          border: "1px solid var(--border)",
                          borderRadius: "var(--radius)",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Cotações por Categoria</CardTitle>
                <CardDescription>Distribuição por categoria</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryDonutData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                        dataKey="value"
                        label={({ name, percent }) =>
                          `${name} ${(percent * 100).toFixed(0)}%`
                        }
                        labelLine={false}
                      >
                        {categoryDonutData.map((entry, index) => (
                          <Cell key={`cell-cat-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => `${value} cotações`}
                        contentStyle={{
                          backgroundColor: "var(--popover)",
                          border: "1px solid var(--border)",
                          borderRadius: "var(--radius)",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top 5 Fornecedores por Cotações</CardTitle>
                <CardDescription>Fornecedores com mais cotações</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topSuppliersData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis
                        type="number"
                        className="text-xs"
                      />
                      <YAxis
                        type="category"
                        dataKey="nome"
                        className="text-xs"
                        width={100}
                      />
                      <Tooltip
                        formatter={(value: number) => `${value} cotações`}
                        contentStyle={{
                          backgroundColor: "var(--popover)",
                          border: "1px solid var(--border)",
                          borderRadius: "var(--radius)",
                        }}
                      />
                      <Bar dataKey="count" fill="var(--color-chart-1)" radius={4} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Lead Time vs Meta</CardTitle>
                <CardDescription>Tempo médio de ciclo de compras em dias</CardDescription>
              </CardHeader>
              <CardContent>
                {!leadTimeMonthlyData.some((d) => d.media !== null) ? (
                  <div className="h-80 flex items-center justify-center text-sm text-muted-foreground">
                    Nenhum dado disponível
                  </div>
                ) : (
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={leadTimeMonthlyData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="month" className="text-xs" />
                      <YAxis className="text-xs" domain={[0, 15]} />
                      <Tooltip
                        formatter={(value: number) => `${value} dias`}
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
                        name="Lead Time Médio"
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
          </div>
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
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className="flex-1"
                        type="button"
                        disabled={
                          (relatorio.id === 1 && categoryLoading) ||
                          (relatorio.id === 2 && supplierLoading)
                        }
                        onClick={() => {
                          if (relatorio.id === 1) return handleExportCategory(categoryDateFrom, categoryDateTo)
                          if (relatorio.id === 2) return handleExportSuppliers(supplierDateFrom, supplierDateTo)
                          if (relatorio.id === 3) return handleExportSaving()
                          return handleExportLeadTime()
                        }}
                      >
                        {((relatorio.id === 1 && categoryLoading) ||
                          (relatorio.id === 2 && supplierLoading)) ? (
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
