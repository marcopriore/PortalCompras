 'use client'

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { FileText, ShoppingCart, TrendingDown, Clock, Eye } from "lucide-react"
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

type QuotationStatus = "draft" | "waiting" | "analysis" | "completed" | "cancelled"

export default function CompradorDashboard() {
  const router = useRouter()
  const { companyId } = useUser()

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

  useEffect(() => {
    if (!companyId) return

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
        leadTimeRes,
        quotationsPendingCurrentMonthRes,
        quotationsPendingPrevRes,
        ordersInProgressCurrentMonthRes,
        ordersInProgressPrevRes,
        leadTimeCurrentMonthRes,
        leadTimePrevMonthRes,
        poItemsRes,
        quotationsForSpendRes,
        completedOrdersSixMonthsRes,
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
          .select("created_at, estimated_delivery_date")
          .eq("company_id", companyId)
          .eq("status", "completed")
          .not("estimated_delivery_date", "is", null),
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
          .select("created_at, estimated_delivery_date")
          .eq("company_id", companyId)
          .eq("status", "completed")
          .not("estimated_delivery_date", "is", null)
          .gte("created_at", currentMonthStart),
        supabase
          .from("purchase_orders")
          .select("created_at, estimated_delivery_date")
          .eq("company_id", companyId)
          .eq("status", "completed")
          .not("estimated_delivery_date", "is", null)
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
          .select("created_at, estimated_delivery_date")
          .eq("company_id", companyId)
          .eq("status", "completed")
          .not("estimated_delivery_date", "is", null)
          .gte("created_at", sixMonthsAgo),
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

      const leadRows =
        (leadTimeRes.data as { created_at: string; estimated_delivery_date: string }[] | null) ?? []
      const computedAvgLeadTime =
        leadRows.length > 0
          ? Math.round(
              leadRows.reduce((acc, po) => {
                const days = Math.max(
                  0,
                  Math.round(
                    (new Date(po.estimated_delivery_date).getTime() -
                      new Date(po.created_at).getTime()) /
                      (1000 * 60 * 60 * 24),
                  ),
                )
                return acc + days
              }, 0) / leadRows.length,
            )
          : null
      setAvgLeadTime(computedAvgLeadTime)

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

      const calcAverageDays = (
        rows: { created_at: string; estimated_delivery_date: string }[] | null,
      ): number | null => {
        const list = rows ?? []
        if (!list.length) return null
        return Math.round(
          list.reduce((acc, po) => {
            const days = Math.max(
              0,
              Math.round(
                (new Date(po.estimated_delivery_date).getTime() -
                  new Date(po.created_at).getTime()) /
                  (1000 * 60 * 60 * 24),
              ),
            )
            return acc + days
          }, 0) / list.length,
        )
      }

      const leadCurrent = calcAverageDays(
        (leadTimeCurrentMonthRes.data as { created_at: string; estimated_delivery_date: string }[] | null) ??
          null,
      )
      const leadPrev = calcAverageDays(
        (leadTimePrevMonthRes.data as { created_at: string; estimated_delivery_date: string }[] | null) ??
          null,
      )
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
      ;(
        (completedOrdersSixMonthsRes.data as {
          created_at: string
          estimated_delivery_date: string
        }[] | null) ?? []
      ).forEach((po) => {
        const d = new Date(po.created_at)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
        const bucket = bucketByKey.get(key)
        if (!bucket) return
        const days = Math.max(
          0,
          Math.round(
            (new Date(po.estimated_delivery_date).getTime() - new Date(po.created_at).getTime()) /
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

      setDashLoading(false)
    }

    fetchDashboard()
  }, [companyId])

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
          value="—"
          changeLabel="Disponível em breve"
          icon={TrendingDown}
        />
        <MetricsCard
          title="Lead Time Médio"
          value={avgLeadTime !== null ? `${avgLeadTime} dias` : "—"}
          change={leadTimeChange}
          changeLabel="vs mês anterior (dias)"
          icon={Clock}
        />
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
    </div>
  )
}
