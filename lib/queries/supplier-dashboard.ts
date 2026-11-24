import { queryOptions } from "@tanstack/react-query"
import type { SupabaseClient } from "@supabase/supabase-js"
import { queryKeys } from "@/lib/queries/keys"

export type SupplierDashboardPeriod = "30" | "90" | "365" | "all"

const PROPOSAL_STATUS_LABELS: Record<string, string> = {
  invited: "Aguardando Resposta",
  submitted: "Proposta Enviada",
  selected: "Vencedor",
  rejected: "Encerrada",
}

function getPeriodStart(period: string): string | null {
  if (period === "all") return null
  const days = parseInt(period, 10)
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date.toISOString()
}

export type SupplierDashboardChartsDto = {
  donutData: { name: string; value: number }[]
  topClientsData: { name: string; count: number }[]
}

export async function fetchSupplierDashboardCharts(
  supabase: SupabaseClient,
  supplierId: string,
  period: SupplierDashboardPeriod,
): Promise<SupplierDashboardChartsDto> {
  const start = getPeriodStart(period)

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
    const label = PROPOSAL_STATUS_LABELS[raw] ?? raw
    counts[label] = (counts[label] ?? 0) + 1
  }
  const donutData = Object.entries(counts).map(([name, value]) => ({ name, value }))

  const invitesRes = await supabase
    .from("quotation_suppliers")
    .select("quotation_id")
    .eq("supplier_id", supplierId)
  if (invitesRes.error) throw invitesRes.error
  const quotationIds = [...new Set((invitesRes.data ?? []).map((r) => r.quotation_id))]

  if (quotationIds.length === 0) {
    return { donutData, topClientsData: [] }
  }

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
          ? (embed[0]?.name ?? "Desconhecido")
          : (embed.name ?? "Desconhecido")
    if (!companyCounts[row.company_id]) {
      companyCounts[row.company_id] = { name, count: 0 }
    }
    companyCounts[row.company_id].count++
  }

  const topClientsData = Object.values(companyCounts)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map((c) => ({ name: c.name, count: c.count }))

  return { donutData, topClientsData }
}

export type SupabaseClientFactory = () => SupabaseClient

export function supplierDashboardChartsQueryOptions(
  companyId: string,
  supplierId: string,
  period: SupplierDashboardPeriod,
  supabaseFactory: SupabaseClientFactory,
) {
  return queryOptions({
    queryKey: queryKeys.supplierDashboardCharts(companyId, supplierId, period),
    queryFn: () =>
      fetchSupplierDashboardCharts(supabaseFactory(), supplierId, period),
    enabled: Boolean(companyId && supplierId),
  })
}