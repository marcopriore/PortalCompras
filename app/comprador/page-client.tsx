"use client"

import { useCallback } from "react"
import { useQuery } from "@tanstack/react-query"
import { FileText, ShoppingCart, TrendingDown, TrendingUp, Clock, Eye } from "lucide-react"
import { formatDateBR } from "@/lib/formato-data"
import { createClient } from "@/lib/supabase/client"
import { useUser } from "@/lib/hooks/useUser"
import { usePermissions } from "@/lib/hooks/usePermissions"
import { buyerDashboardQueryOptions } from "@/lib/queries/buyer-dashboard"
import { MetricsCard } from "@/components/dashboard/metrics-card"
import { SpendAIInsights } from "@/components/comprador/spend-ai-insights"
import {
  SpendAnalysisChart,
  QuotationStatusChart,
  LeadTimeChart,
} from "@/components/dashboard/dashboard-charts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TableRowActions } from "@/components/ui/table-row-actions"
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
import {
  adaptiveMetricGridClass,
  adaptivePairGridClass,
} from "@/lib/permissions/dashboard-reports"
import { cn } from "@/lib/utils"

export default function CompradorDashboard() {
  const { companyId, loading: userLoading } = useUser()
  const { hasFeature, hasPermission, loading: permissionsLoading } = usePermissions()

  const canMetrics = hasPermission("dashboard.metrics")
  const canSpendCategory = hasPermission("dashboard.spend_category")
  const canQuotationStatus = hasPermission("dashboard.quotation_status")
  const canRecentActivity = hasPermission("dashboard.recent_activity")
  const canLeadTime = hasPermission("dashboard.lead_time")
  const canRoi = hasPermission("dashboard.roi")

  const hasAnyDashboardWidget =
    canMetrics ||
    canSpendCategory ||
    canQuotationStatus ||
    canRecentActivity ||
    canLeadTime ||
    canRoi

  const supabaseFactory = useCallback(() => createClient(), [])

  const dashboardQuery = useQuery({
    ...buyerDashboardQueryOptions(companyId ?? "", supabaseFactory),
    enabled: Boolean(companyId) && !userLoading,
  })

  const dashboardLoading = dashboardQuery.isLoading || dashboardQuery.isPending

  const quotationsPending = dashboardQuery.data?.quotationsPending ?? 0
  const quotationsByStatus = dashboardQuery.data?.quotationsByStatus ?? []
  const recentActivities = dashboardQuery.data?.recentActivities ?? []
  const ordersInProgress = dashboardQuery.data?.ordersInProgress ?? null
  const avgLeadTime = dashboardQuery.data?.avgLeadTime ?? null
  const spendData = dashboardQuery.data?.spendData ?? []
  const leadTimeChartData = dashboardQuery.data?.leadTimeChartData ?? []
  const quotationsChange = dashboardQuery.data?.quotationsChange ?? null
  const ordersChange = dashboardQuery.data?.ordersChange ?? null
  const leadTimeChange = dashboardQuery.data?.leadTimeChange ?? null
  const savingAcumulado = dashboardQuery.data?.savingAcumulado ?? null
  const savingHistorico = dashboardQuery.data?.savingHistorico ?? null
  const savingPorFornecedor = dashboardQuery.data?.savingPorFornecedor ?? []
  const savingPorMesDash = dashboardQuery.data?.savingPorMesDash ?? []
  const coberturaPrecoAlvo = dashboardQuery.data?.coberturaPrecoAlvo ?? null

  const mapActivityStatusLabel = (status: string): string => {
    const labels: Record<string, string> = {
      draft: "Rascunho",
      waiting: "Pendente",
      analysis: "Em análise",
      completed: "Concluída",
      cancelled: "Cancelada",
      sent: "Enviado",
      processing: "Processando",
      refused: "Recusado",
      error: "Erro",
      integration_error: "Erro integração",
      pending: "Pendente",
      approved: "Aprovada",
      rejected: "Rejeitada",
      in_quotation: "Em cotação",
      active: "Ativo",
      expired: "Expirado",
    }
    return labels[status] ?? status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, " ")
  }

  if (userLoading || permissionsLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
        Carregando...
      </div>
    )
  }

  const chartPairCount =
    (canSpendCategory ? 1 : 0) + (canQuotationStatus ? 1 : 0)
  const activityLeadCount =
    (canRecentActivity ? 1 : 0) + (canLeadTime ? 1 : 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Acompanhe suas métricas e atividades de compras
        </p>
      </div>

      {!hasAnyDashboardWidget && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Nenhum indicador liberado para o seu perfil. Solicite ao administrador as
            permissões de Dashboard.
          </CardContent>
        </Card>
      )}

      {canMetrics && (
        <div className={adaptiveMetricGridClass(4)}>
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
            change={undefined}
            changeLabel={
              savingAcumulado == null
                ? "Defina preços alvo nos itens"
                : savingAcumulado >= 0
                  ? "Economia vs. preço alvo"
                  : "Acima do preço alvo"
            }
            icon={TrendingDown}
          />
          <MetricsCard
            title="Tempo Fluxo Compras"
            value={avgLeadTime !== null ? `${avgLeadTime} dias` : "—"}
            change={leadTimeChange}
            changeUnit=" dias"
            changeLabel={
              avgLeadTime != null ? "vs mês anterior" : "Sem vínculo REQ→pedido"
            }
            subtitle="Da requisição até o pedido emitido"
            icon={Clock}
          />
        </div>
      )}

      {chartPairCount > 0 && (
        <div className={adaptivePairGridClass(chartPairCount)}>
          {canSpendCategory && <SpendAnalysisChart data={spendData} />}
          {canQuotationStatus && <QuotationStatusChart data={quotationsByStatus} />}
        </div>
      )}

      {activityLeadCount > 0 && (
        <div
          className={
            canRecentActivity && canLeadTime
              ? "grid gap-4 lg:grid-cols-3"
              : "grid gap-4 grid-cols-1"
          }
        >
          {canRecentActivity && (
            <div className={canLeadTime ? "lg:col-span-2" : undefined}>
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
                        {recentActivities.map((activity) => (
                          <TableRow key={`${activity.type}-${activity.id}`}>
                            <TableCell className="font-medium">{activity.code}</TableCell>
                            <TableCell>{activity.title}</TableCell>
                            <TableCell>
                              <span className="text-muted-foreground">{activity.type}</span>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {mapActivityStatusLabel(activity.status)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {activity.created_at
                                ? formatDateBR(activity.created_at)
                                : "-"}
                            </TableCell>
                            <TableCell className="text-right">
                              <TableRowActions
                                actions={[
                                  {
                                    label: "Ver Detalhes",
                                    icon: Eye,
                                    href: activity.href,
                                  },
                                ]}
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                        {recentActivities.length === 0 && !dashboardLoading && (
                          <TableRow>
                            <TableCell
                              colSpan={6}
                              className="py-6 text-center text-sm text-muted-foreground"
                            >
                              Nenhuma atividade recente encontrada.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
          {canLeadTime && <LeadTimeChart data={leadTimeChartData} />}
        </div>
      )}

      {/* ── Painel de ROI ─────────────────────────────────────── */}
      {canRoi && (
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
                {dashboardLoading
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
                {dashboardLoading || coberturaPrecoAlvo == null ? "—" : `${coberturaPrecoAlvo}%`}
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
                  {dashboardLoading ? "Carregando..." : "Nenhum dado — defina preços alvo nos itens"}
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
                  {dashboardLoading ? "Carregando..." : "Nenhum dado — defina preços alvo nos itens"}
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
        {hasFeature("ai_analytics") && <SpendAIInsights />}
      </div>
      )}
    </div>
  )
}