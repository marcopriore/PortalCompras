"use client"

import * as React from "react"
import Link from "next/link"
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
import { createClient } from "@/lib/supabase/client"
import { useUser } from "@/lib/hooks/useUser"
import {
  mapOrderRowsToActivityItems,
  mapProposalRowsToActivityItems,
  mergeActivityByUpdatedAt,
  type ActivityItem,
  type OrderActivityRow,
  type ProposalActivityRow,
} from "@/lib/utils/activity-helpers"

function relativeListDay(iso: string): string {
  const t = new Date(iso)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const day = new Date(t)
  day.setHours(0, 0, 0, 0)
  const diff = Math.round((today.getTime() - day.getTime()) / 86400000)
  if (diff <= 0) return "hoje"
  if (diff === 1) return "ontem"
  return `há ${diff} dias`
}

const STATUS_LABELS: Record<string, string> = {
  invited: "Aguardando Resposta",
  submitted: "Proposta Enviada",
  selected: "Vencedor",
  rejected: "Encerrada",
}

const COLORS: Record<string, string> = {
  "Aguardando Resposta": "#F59E0B",
  "Proposta Enviada": "#3B82F6",
  Vencedor: "#10B981",
  Encerrada: "#94A3B8",
}

type PeriodKey = "30" | "90" | "365" | "all"

function getPeriodStart(period: string): string | null {
  if (period === "all") return null
  const days = parseInt(period, 10)
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date.toISOString()
}

function renderCustomLabel({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  value,
}: {
  cx: number
  cy: number
  midAngle: number
  innerRadius: number
  outerRadius: number
  value: number
}) {
  const RADIAN = Math.PI / 180
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)

  if (value === 0) return null

  return (
    <text
      x={x}
      y={y}
      fill="white"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={13}
      fontWeight="600"
    >
      {value}
    </text>
  )
}

export default function FornecedorDashboardPage() {
  const { supplierId, loading: userLoading } = useUser()
  const [error, setError] = React.useState(false)

  const [period, setPeriod] = React.useState<PeriodKey>("90")
  const [donutData, setDonutData] = React.useState<{ name: string; value: number }[]>([])
  const [topClientsData, setTopClientsData] = React.useState<{ name: string; count: number }[]>([])
  const [chartsLoading, setChartsLoading] = React.useState(false)

  const [activity, setActivity] = React.useState<ActivityItem[]>([])
  const [activityLoading, setActivityLoading] = React.useState(true)

  React.useEffect(() => {
    if (userLoading) return

    if (!supplierId) {
      setActivity([])
      setActivityLoading(false)
      return
    }

    let cancelled = false
    const supabase = createClient()

    const run = async () => {
      setActivityLoading(true)
      setError(false)
      try {
        const [proposalsRes, ordersRes] = await Promise.all([
          supabase
            .from("quotation_proposals")
            .select("status, updated_at, quotation_id, quotations!inner(code)")
            .eq("supplier_id", supplierId)
            .order("updated_at", { ascending: false })
            .limit(8),
          supabase
            .from("purchase_orders")
            .select(
              "id, code, status, updated_at, accepted_at, estimated_delivery_date, cancellation_reason",
            )
            .eq("supplier_id", supplierId)
            .neq("status", "draft")
            .order("updated_at", { ascending: false })
            .limit(8),
        ])

        if (proposalsRes.error) throw proposalsRes.error
        if (ordersRes.error) throw ordersRes.error

        const mappedProposals = mapProposalRowsToActivityItems(
          (proposalsRes.data as ProposalActivityRow[]) ?? [],
        )
        const mappedOrders = mapOrderRowsToActivityItems(
          (ordersRes.data as OrderActivityRow[]) ?? [],
        )
        const combined = mergeActivityByUpdatedAt(mappedProposals, mappedOrders).slice(0, 8)

        if (!cancelled) setActivity(combined)
      } catch (err) {
        console.error("Erro ao carregar atividade fornecedor:", err)
        if (!cancelled) {
          setError(true)
          setActivity([])
        }
      } finally {
        if (!cancelled) setActivityLoading(false)
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [supplierId, userLoading])

  React.useEffect(() => {
    if (userLoading) return

    if (!supplierId) {
      setDonutData([])
      setTopClientsData([])
      setChartsLoading(false)
      return
    }

    let cancelled = false
    const supabase = createClient()
    const start = getPeriodStart(period)

    const run = async () => {
      setChartsLoading(true)
      setError(false)
      try {
        let proposalsQuery = supabase
          .from("quotation_proposals")
          .select("status, created_at")
          .eq("supplier_id", supplierId)
        if (start) proposalsQuery = proposalsQuery.gte("created_at", start)
        const { data: proposalsData, error: proposalsErr } = await proposalsQuery
        if (proposalsErr) throw proposalsErr

        const counts: Record<string, number> = {}
        for (const p of proposalsData ?? []) {
          const raw = (p as { status: string }).status
          const label = STATUS_LABELS[raw] ?? raw
          counts[label] = (counts[label] ?? 0) + 1
        }
        const donut = Object.entries(counts).map(([name, value]) => ({ name, value }))
        if (!cancelled) setDonutData(donut)

        const invitesRes = await supabase
          .from("quotation_suppliers")
          .select("quotation_id")
          .eq("supplier_id", supplierId)
        if (invitesRes.error) throw invitesRes.error
        const quotationIds = [...new Set((invitesRes.data ?? []).map((r) => r.quotation_id))]

        if (quotationIds.length === 0) {
          if (!cancelled) setTopClientsData([])
        } else {
          let qQuery = supabase
            .from("quotations")
            .select("id, company_id, created_at, companies(name)")
            .in("id", quotationIds)
          if (start) qQuery = qQuery.gte("created_at", start)
          const { data: quotationsData, error: qErr } = await qQuery
          if (qErr) throw qErr

          const companyCounts: Record<string, { name: string; count: number }> = {}
          for (const q of quotationsData ?? []) {
            const row = q as {
              company_id: string
              companies: { name: string } | { name: string }[] | null
            }
            const embed = row.companies
            const name =
              embed == null
                ? "Desconhecido"
                : Array.isArray(embed)
                  ? embed[0]?.name ?? "Desconhecido"
                  : embed.name ?? "Desconhecido"
            if (!companyCounts[row.company_id]) {
              companyCounts[row.company_id] = { name, count: 0 }
            }
            companyCounts[row.company_id].count++
          }

          const top = Object.values(companyCounts)
            .sort((a, b) => b.count - a.count)
            .slice(0, 5)
            .map((c) => ({ name: c.name, count: c.count }))
          if (!cancelled) setTopClientsData(top)
        }
      } catch (err) {
        console.error("Erro ao carregar gráficos fornecedor:", err)
        if (!cancelled) {
          setError(true)
          setDonutData([])
          setTopClientsData([])
        }
      } finally {
        if (!cancelled) setChartsLoading(false)
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [supplierId, userLoading, period])

  const donutTotal = donutData.reduce((s, d) => s + d.value, 0)

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Bem-vindo ao Portal Valore</p>
      </div>

      {!userLoading && !supplierId && (
        <p className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          Seu usuário ainda não está vinculado a um cadastro de fornecedor. Entre em contato com o
          suporte para concluir o vínculo.
        </p>
      )}

      {error && (
        <p className="text-sm text-destructive">Não foi possível carregar os dados</p>
      )}

      {supplierId ? (
        <>
          <div className="flex flex-wrap items-center gap-3 mb-6">
            <span className="text-sm font-medium text-muted-foreground">Período:</span>
            {(
              [
                { value: "30" as const, label: "Últimos 30 dias" },
                { value: "90" as const, label: "Últimos 90 dias" },
                { value: "365" as const, label: "Este ano" },
                { value: "all" as const, label: "Tudo" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setPeriod(opt.value)}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  period === opt.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="bg-card border border-border rounded-xl p-6">
              <h3 className="text-sm font-semibold text-foreground mb-1">Status das Propostas</h3>
              <p className="text-xs text-muted-foreground mb-4">Distribuição por status no período</p>
              {chartsLoading ? (
                <div className="h-[240px] animate-pulse rounded-lg bg-muted/50" />
              ) : donutTotal === 0 ? (
                <div className="h-[240px] flex items-center justify-center text-sm text-muted-foreground text-center px-4">
                  Nenhuma proposta no período
                </div>
              ) : (
                <div className="pointer-events-none">
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie
                        data={donutData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={3}
                        dataKey="value"
                        nameKey="name"
                        label={renderCustomLabel}
                        labelLine={false}
                      >
                        {donutData.map((entry, index) => (
                          <Cell
                            key={`cell-${entry.name}-${index}`}
                            fill={COLORS[entry.name] ?? "#94A3B8"}
                          />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => [`${value} proposta(s)`, ""]} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="bg-card border border-border rounded-xl p-6">
              <h3 className="text-sm font-semibold text-foreground mb-1">Top 5 Clientes</h3>
              <p className="text-xs text-muted-foreground mb-4">
                Empresas com maior volume de cotações
              </p>
              {chartsLoading ? (
                <div className="h-[240px] animate-pulse rounded-lg bg-muted/50" />
              ) : topClientsData.length === 0 ? (
                <div className="h-[240px] flex items-center justify-center text-sm text-muted-foreground text-center px-4">
                  Nenhum cliente no período
                </div>
              ) : (
                <div className="pointer-events-none">
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart
                      data={topClientsData}
                      layout="vertical"
                      margin={{ left: 16, right: 16, top: 8, bottom: 8 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={120}
                        tick={{ fontSize: 11 }}
                        tickFormatter={(v) =>
                          String(v).length > 18 ? `${String(v).slice(0, 18)}…` : String(v)
                        }
                      />
                      <Tooltip
                        cursor={false}
                        formatter={(value) => [`${value} cotação(ões)`, "Volume"]}
                      />
                      <Bar
                        dataKey="count"
                        fill="#4F3EF5"
                        radius={[0, 4, 4, 0]}
                        label={{ position: "right", fontSize: 11, fill: "#6B7280" }}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        </>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Atividade Recente</h2>
        {activityLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded bg-muted" />
            ))}
          </div>
        ) : (
          <ul className="border-t border-border">
            {activity.length === 0 ? (
              <li className="border-b border-border py-6 text-center text-sm text-muted-foreground">
                Nenhuma atividade no período.
              </li>
            ) : (
              activity.slice(0, 5).map((item) => {
                const Icon = item.icon
                return (
                  <li
                    key={item.id}
                    className="flex items-center gap-3 border-b border-border py-3"
                  >
                    <Icon className={`h-5 w-5 shrink-0 ${item.iconClass}`} />
                    <span className="min-w-0 flex-1 text-sm text-foreground">
                      {item.type === "proposal" ? `${item.label} — ${item.code}` : item.label}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {relativeListDay(item.updated_at)}
                    </span>
                  </li>
                )
              })
            )}
          </ul>
        )}
        {!activityLoading && activity.length > 5 && (
          <Link
            href="/fornecedor/atividades"
            className="text-sm text-primary hover:underline cursor-pointer mt-2 inline-block"
          >
            Ver toda a atividade →
          </Link>
        )}
      </section>
    </div>
  )
}
