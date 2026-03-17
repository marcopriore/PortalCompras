 'use client'

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { FileText, ShoppingCart, TrendingDown, Clock, Eye } from "lucide-react"
import { format } from "date-fns"
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

  useEffect(() => {
    if (!companyId) return

    const fetchDashboard = async () => {
      setDashLoading(true)
      const supabase = createClient()

      const [quotationsRes, recentRes] = await Promise.all([
        supabase.from("quotations").select("status").eq("company_id", companyId),
        supabase
          .from("quotations")
          .select("id, code, description, status, created_at")
          .eq("company_id", companyId)
          .order("created_at", { ascending: false })
          .limit(5),
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
          change={-8}
          icon={FileText}
        />
        <MetricsCard
          title="Pedidos em Andamento"
          value={23}
          change={15}
          icon={ShoppingCart}
        />
        <MetricsCard
          title="Saving Acumulado"
          value="R$ 45.2k"
          change={22}
          icon={TrendingDown}
        />
        <MetricsCard
          title="Lead Time Médio"
          value="7 dias"
          change={-12}
          icon={Clock}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SpendAnalysisChart />
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
        <LeadTimeChart />
      </div>
    </div>
  )
}
