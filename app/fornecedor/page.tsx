"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Clock,
  Search,
  Trophy,
  ArchiveX,
  Mail,
  Send,
  XCircle,
  FileSpreadsheet,
  X,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useUser } from "@/lib/hooks/useUser"
import {
  formatDateBR,
  formatDateTimeBR,
  isExpiredDate,
  isUrgentDate,
} from "@/lib/utils/date-helpers"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type OpenQuotationRow = {
  id: string
  code: string
  description: string
  status: string
  created_at: string
  company_id: string
}

type CompanyMapValue = { name: string; cnpj: string | null }

type RoundRow = {
  id: string
  quotation_id: string
  round_number: number
  response_deadline: string | null
  status: string
}

type ProposalRow = {
  quotation_id: string
  round_id: string | null
  status: string
}

type ActivityRow = {
  status: string
  updated_at: string
  quotation_id: string
  quotations: { code: string } | { code: string }[] | null
}

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

function pickQuotationCode(embed: ActivityRow["quotations"]): string {
  if (!embed) return "—"
  if (Array.isArray(embed)) return embed[0]?.code ?? "—"
  return embed.code ?? "—"
}

const proposalStatusLabel: Record<string, string> = {
  invited: "Convite recebido",
  submitted: "Proposta enviada",
  selected: "Proposta selecionada",
  rejected: "Proposta não selecionada",
}

type OpenQuotationItem = {
  id: string
  code: string
  description: string
  status: string
  createdAt: string
  companies: { name: string; cnpj: string | null } | null
  roundNumber: number | null
  responseDeadline: string | null
  activeRoundId: string | null
  hasSubmittedThisRound: boolean
  proposalStatus: string | null
}

const statusBadgeBase =
  "inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full"

function getProposalStatusBadge(
  proposalStatus: string | null | undefined,
  quotationStatus: string,
): { label: string; className: string; showTrophy: boolean; filterKey: string } {
  if (proposalStatus === "selected") {
    return {
      label: "Vencedor",
      className: `${statusBadgeBase} bg-yellow-100 text-yellow-800 border border-yellow-200`,
      showTrophy: true,
      filterKey: "selected",
    }
  }
  if (proposalStatus === "submitted") {
    return {
      label: "Proposta Enviada",
      className: `${statusBadgeBase} bg-blue-100 text-blue-800`,
      showTrophy: false,
      filterKey: "submitted",
    }
  }
  if (proposalStatus === "invited") {
    return {
      label: "Aguardando Resposta",
      className: `${statusBadgeBase} bg-amber-100 text-amber-800`,
      showTrophy: false,
      filterKey: "invited",
    }
  }
  if (proposalStatus === "rejected") {
    return {
      label: "Encerrada",
      className: `${statusBadgeBase} bg-slate-100 text-slate-600`,
      showTrophy: false,
      filterKey: "rejected",
    }
  }
  if (quotationStatus === "completed") {
    return {
      label: "Encerrada",
      className: `${statusBadgeBase} bg-slate-100 text-slate-600`,
      showTrophy: false,
      filterKey: "completed",
    }
  }
  if (quotationStatus === "cancelled") {
    return {
      label: "Cancelada",
      className: `${statusBadgeBase} bg-red-50 text-red-600`,
      showTrophy: false,
      filterKey: "cancelled",
    }
  }
  return {
    label: "Aguardando Resposta",
    className: `${statusBadgeBase} bg-amber-100 text-amber-800`,
    showTrophy: false,
    filterKey: "invited",
  }
}

export default function FornecedorDashboardPage() {
  const router = useRouter()
  const { supplierId, loading: userLoading } = useUser()
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState(false)

  const [mAwaiting, setMAwaiting] = React.useState(0)
  const [mInAnalysis, setMInAnalysis] = React.useState(0)
  const [mWinners, setMWinners] = React.useState(0)
  const [mClosed, setMClosed] = React.useState(0)

  const [openQuotations, setOpenQuotations] = React.useState<OpenQuotationItem[]>([])
  const [activity, setActivity] = React.useState<ActivityRow[]>([])

  const [filterSearch, setFilterSearch] = React.useState("")
  const [filterStatus, setFilterStatus] = React.useState<string>("all")
  const [filterPeriod, setFilterPeriod] = React.useState<string>("all")

  const filteredQuotations = React.useMemo(() => {
    let rows = openQuotations
    const term = filterSearch.trim().toLowerCase()
    if (term) {
      rows = rows.filter(
        (r) =>
          r.code.toLowerCase().includes(term) ||
          r.description.toLowerCase().includes(term),
      )
    }
    if (filterStatus !== "all") {
      rows = rows.filter((r) => {
        const { filterKey } = getProposalStatusBadge(r.proposalStatus, r.status)
        if (filterStatus === "rejected") {
          return filterKey === "rejected" || filterKey === "completed"
        }
        return filterKey === filterStatus
      })
    }
    if (filterPeriod !== "all") {
      const days = filterPeriod === "30" ? 30 : 90
      const cutoff = new Date()
      cutoff.setHours(0, 0, 0, 0)
      cutoff.setDate(cutoff.getDate() - days)
      rows = rows.filter((r) => {
        const d = new Date(r.createdAt)
        return !Number.isNaN(d.getTime()) && d >= cutoff
      })
    }
    return rows
  }, [openQuotations, filterSearch, filterStatus, filterPeriod])

  const filtersActive =
    filterSearch.trim() !== "" || filterStatus !== "all" || filterPeriod !== "all"

  const clearFilters = () => {
    setFilterSearch("")
    setFilterStatus("all")
    setFilterPeriod("all")
  }

  React.useEffect(() => {
    if (userLoading) return

    if (!supplierId) {
      setLoading(false)
      setError(false)
      setMAwaiting(0)
      setMInAnalysis(0)
      setMWinners(0)
      setMClosed(0)
      setOpenQuotations([])
      setActivity([])
      setFilterSearch("")
      setFilterStatus("all")
      setFilterPeriod("all")
      return
    }

    let cancelled = false
    const supabase = createClient()

    const run = async () => {
      setLoading(true)
      setError(false)

      let quotationIds: string[] = []

      try {
        const invitesRes = await supabase
          .from("quotation_suppliers")
          .select("quotation_id")
          .eq("supplier_id", supplierId)

        if (invitesRes.error) throw invitesRes.error
        quotationIds = [...new Set((invitesRes.data ?? []).map((r) => r.quotation_id))]
      } catch (err) {
        console.error("Erro ao carregar dashboard fornecedor:", err)
        if (!cancelled) setError(true)
        quotationIds = []
      }

      try {
        if (quotationIds.length === 0) {
          if (!cancelled) {
            setMAwaiting(0)
            setMInAnalysis(0)
            setMClosed(0)
          }
          const { count: selOnly, error: selErr } = await supabase
            .from("quotation_proposals")
            .select("id", { count: "exact", head: true })
            .eq("supplier_id", supplierId)
            .eq("status", "selected")
          if (selErr) throw selErr
          if (!cancelled) setMWinners(selOnly ?? 0)
        } else {
          const [roundsRes, selectedCountRes, submittedRowsRes, completedCountRes] =
            await Promise.all([
              supabase
                .from("quotation_rounds")
                .select("id, quotation_id, round_number, response_deadline, status")
                .in("quotation_id", quotationIds)
                .eq("status", "active"),
              supabase
                .from("quotation_proposals")
                .select("id", { count: "exact", head: true })
                .eq("supplier_id", supplierId)
                .eq("status", "selected"),
              supabase
                .from("quotation_proposals")
                .select("quotation_id")
                .eq("supplier_id", supplierId)
                .eq("status", "submitted"),
              supabase
                .from("quotations")
                .select("id", { count: "exact", head: true })
                .in("id", quotationIds)
                .eq("status", "completed"),
            ])

          if (
            roundsRes.error ||
            selectedCountRes.error ||
            submittedRowsRes.error ||
            completedCountRes.error
          ) {
            throw (
              roundsRes.error ||
              selectedCountRes.error ||
              submittedRowsRes.error ||
              completedCountRes.error
            )
          }

          if (!cancelled) {
            setMWinners(selectedCountRes.count ?? 0)
            setMClosed(completedCountRes.count ?? 0)
          }

          const activeRounds = (roundsRes.data ?? []) as RoundRow[]
          const activeRoundIds = activeRounds.map((r) => r.id)

          let awaiting = 0
          if (activeRoundIds.length > 0) {
            const invitedCountRes = await supabase
              .from("quotation_proposals")
              .select("id", { count: "exact", head: true })
              .eq("supplier_id", supplierId)
              .eq("status", "invited")
              .in("round_id", activeRoundIds)
            if (invitedCountRes.error) throw invitedCountRes.error
            awaiting = invitedCountRes.count ?? 0
          }
          if (!cancelled) setMAwaiting(awaiting)

          const submittedRows =
            (submittedRowsRes.data ?? []) as { quotation_id: string }[]
          const submittedQids = [...new Set(submittedRows.map((r) => r.quotation_id))]
          let inAnalysis = 0
          if (submittedQids.length > 0) {
            const { data: qaRows, error: qaErr } = await supabase
              .from("quotations")
              .select("id")
              .in("id", submittedQids)
              .in("status", ["waiting", "analysis"])
            if (qaErr) throw qaErr
            const allowed = new Set((qaRows ?? []).map((q) => q.id))
            inAnalysis = submittedRows.filter((r) => allowed.has(r.quotation_id)).length
          }
          if (!cancelled) setMInAnalysis(inAnalysis)
        }
      } catch (err) {
        console.error("Erro ao carregar dashboard fornecedor:", err)
        if (!cancelled) {
          setError(true)
          setMAwaiting(0)
          setMInAnalysis(0)
          setMWinners(0)
          setMClosed(0)
        }
      }

      try {
        if (quotationIds.length === 0) {
          if (!cancelled) {
            setOpenQuotations([])
          }
        } else {
          const [openQuotationsRes, roundsRes, myProposalsRes] = await Promise.all([
            supabase
              .from("quotations")
              .select("id, code, description, status, created_at, company_id")
              .in("id", quotationIds)
              .in("status", ["waiting", "analysis"]),
            supabase
              .from("quotation_rounds")
              .select("id, quotation_id, round_number, response_deadline, status")
              .in("quotation_id", quotationIds)
              .eq("status", "active"),
            supabase
              .from("quotation_proposals")
              .select("quotation_id, round_id, status")
              .eq("supplier_id", supplierId)
              .in("quotation_id", quotationIds),
          ])

          if (openQuotationsRes.error) throw openQuotationsRes.error
          if (roundsRes.error) throw roundsRes.error
          if (myProposalsRes.error) throw myProposalsRes.error

          const openQuoteRows =
            (openQuotationsRes.data ?? []) as OpenQuotationRow[]
          const openQIds = openQuoteRows.map((q) => q.id)

          const companyIds = [
            ...new Set(openQuoteRows.map((q) => q.company_id).filter(Boolean)),
          ]
          let companyMap: Record<string, CompanyMapValue> = {}
          if (companyIds.length > 0) {
            const { data: companiesData, error: companiesErr } = await supabase
              .from("companies")
              .select("id, name, cnpj")
              .in("id", companyIds)
            if (companiesErr) throw companiesErr
            companyMap = Object.fromEntries(
              (companiesData ?? []).map((c) => [
                c.id,
                { name: c.name, cnpj: c.cnpj ?? null },
              ]),
            )
          }

          const activeRounds = (roundsRes.data ?? []) as RoundRow[]
          const myProposalsRows = (myProposalsRes.data ?? []) as ProposalRow[]

          const roundsForOpen = activeRounds.filter((r) =>
            openQIds.includes(r.quotation_id),
          )
          const roundByQuotation = new Map<string, RoundRow>()
          for (const r of roundsForOpen) {
            roundByQuotation.set(r.quotation_id, r)
          }

          const merged: OpenQuotationItem[] = openQuoteRows.map((q) => {
            const ar = roundByQuotation.get(q.id) ?? null
            const coRaw = q.company_id ? companyMap[q.company_id] : undefined
            const companies = coRaw
              ? { name: coRaw.name, cnpj: coRaw.cnpj }
              : null
            const myProp = ar
              ? myProposalsRows.find(
                  (p) =>
                    p.quotation_id === q.id && p.round_id === ar.id,
                )
              : undefined
            const proposalStatus = myProp?.status ?? null
            const hasSubmittedThisRound = proposalStatus === "submitted"
            return {
              id: q.id,
              code: q.code,
              description: q.description,
              status: q.status,
              createdAt: q.created_at,
              companies,
              roundNumber: ar?.round_number ?? null,
              responseDeadline: ar?.response_deadline ?? null,
              activeRoundId: ar?.id ?? null,
              hasSubmittedThisRound,
              proposalStatus,
            }
          })

          merged.sort((a, b) => {
            const da = a.responseDeadline
              ? new Date(`${a.responseDeadline}T00:00:00`).getTime()
              : Number.POSITIVE_INFINITY
            const db = b.responseDeadline
              ? new Date(`${b.responseDeadline}T00:00:00`).getTime()
              : Number.POSITIVE_INFINITY
            return da - db
          })

          if (!cancelled) {
            setOpenQuotations(merged)
          }
        }
      } catch (err) {
        console.error("Erro ao carregar dashboard fornecedor:", err)
        if (!cancelled) {
          setError(true)
          setOpenQuotations([])
        }
      }

      try {
        const activityRes = await supabase
          .from("quotation_proposals")
          .select("status, updated_at, quotation_id, quotations!inner(code)")
          .eq("supplier_id", supplierId)
          .order("updated_at", { ascending: false })
          .limit(8)

        if (activityRes.error) throw activityRes.error
        if (!cancelled) setActivity((activityRes.data as ActivityRow[]) ?? [])
      } catch (err) {
        console.error("Erro ao carregar dashboard fornecedor:", err)
        if (!cancelled) {
          setError(true)
          setActivity([])
        }
      }

      if (!cancelled) setLoading(false)
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [supplierId, userLoading])

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

      <div
        className="grid w-full grid-cols-4 gap-4 mb-2"
        style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}
      >
        {loading ? (
          <>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-[100px] animate-pulse rounded-xl bg-gray-200" />
            ))}
          </>
        ) : (
          <>
            <div className="min-w-0 bg-white border border-amber-100 rounded-xl p-5 flex items-center justify-between">
              <div>
                <p className="text-sm text-amber-600 font-medium">Aguardando Resposta</p>
                <p className="text-3xl font-bold text-amber-700 mt-1">{mAwaiting}</p>
              </div>
              <div className="bg-amber-100 p-3 rounded-full shrink-0">
                <Clock className="w-6 h-6 text-amber-600" />
              </div>
            </div>
            <div className="min-w-0 bg-white border border-blue-100 rounded-xl p-5 flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600 font-medium">Em Análise</p>
                <p className="text-3xl font-bold text-blue-700 mt-1">{mInAnalysis}</p>
              </div>
              <div className="bg-blue-100 p-3 rounded-full shrink-0">
                <Search className="w-6 h-6 text-blue-600" />
              </div>
            </div>
            <div className="min-w-0 bg-white border border-green-100 rounded-xl p-5 flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600 font-medium">Propostas Vencedoras</p>
                <p className="text-3xl font-bold text-green-700 mt-1">{mWinners}</p>
              </div>
              <div className="bg-green-100 p-3 rounded-full shrink-0">
                <Trophy className="w-6 h-6 text-green-600" />
              </div>
            </div>
            <div className="min-w-0 bg-white border border-slate-100 rounded-xl p-5 flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 font-medium">Encerradas</p>
                <p className="text-3xl font-bold text-slate-700 mt-1">{mClosed}</p>
              </div>
              <div className="bg-slate-100 p-3 rounded-full shrink-0">
                <ArchiveX className="w-6 h-6 text-slate-600" />
              </div>
            </div>
          </>
        )}
      </div>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Cotações Abertas</h2>
          <p className="text-sm text-muted-foreground">Aguardando sua resposta</p>
        </div>

        {loading ? (
          <div className="overflow-x-auto rounded-xl border border-border bg-white">
            <table className="w-full text-sm">
              <tbody>
                {Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} className="px-3 py-3 align-middle">
                        <div className="h-4 min-w-[3rem] animate-pulse rounded bg-gray-200" />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : !supplierId ? null : openQuotations.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-border bg-muted/20 py-16 text-center">
            <FileSpreadsheet className="h-14 w-14 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">Nenhuma cotação aberta no momento</p>
          </div>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap items-end gap-4 rounded-xl border border-border bg-muted/40 p-4">
              <div className="min-w-[200px] flex-1">
                <Label htmlFor="cotacoes-busca" className="mb-1.5 block text-sm font-medium">
                  Buscar
                </Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="cotacoes-busca"
                    value={filterSearch}
                    onChange={(e) => setFilterSearch(e.target.value)}
                    placeholder="Código ou descrição"
                    className="pl-9 pr-9"
                    autoComplete="off"
                  />
                  {filterSearch ? (
                    <button
                      type="button"
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-sm p-1 text-muted-foreground hover:text-foreground"
                      onClick={() => setFilterSearch("")}
                      aria-label="Limpar busca"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
              </div>
              <div className="w-48 shrink-0">
                <Label htmlFor="cotacoes-status" className="mb-1.5 block text-sm font-medium">
                  Status
                </Label>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger id="cotacoes-status" className="w-full" size="sm">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os status</SelectItem>
                    <SelectItem value="invited">Aguardando Resposta</SelectItem>
                    <SelectItem value="submitted">Proposta Enviada</SelectItem>
                    <SelectItem value="selected">Vencedor</SelectItem>
                    <SelectItem value="rejected">Encerrada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="w-44 shrink-0">
                <Label htmlFor="cotacoes-periodo" className="mb-1.5 block text-sm font-medium">
                  Período
                </Label>
                <Select value={filterPeriod} onValueChange={setFilterPeriod}>
                  <SelectTrigger id="cotacoes-periodo" className="w-full" size="sm">
                    <SelectValue placeholder="Período" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="30">Últimos 30 dias</SelectItem>
                    <SelectItem value="90">Últimos 90 dias</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="ml-auto flex flex-wrap items-end gap-3">
                <p className="text-sm text-muted-foreground">
                  {filteredQuotations.length === 1
                    ? "1 resultado"
                    : `${filteredQuotations.length} resultados`}
                </p>
                {filtersActive ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-sm"
                    onClick={clearFilters}
                  >
                    Limpar filtros
                  </Button>
                ) : null}
              </div>
            </div>

            {filteredQuotations.length === 0 ? (
              <div className="rounded-xl border border-border bg-muted/20 py-12 text-center text-sm text-muted-foreground">
                Nenhum resultado com os filtros atuais.
              </div>
            ) : (
              <>
                <div className="overflow-x-auto rounded-xl border border-border bg-white">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/40">
                        <th className="px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Cotação
                        </th>
                        <th className="px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Descrição
                        </th>
                        <th className="px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground whitespace-nowrap">
                          Cliente
                        </th>
                        <th className="px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground whitespace-nowrap">
                          Recebido
                        </th>
                        <th className="px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground whitespace-nowrap">
                          Expira
                        </th>
                        <th className="px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground whitespace-nowrap">
                          Status
                        </th>
                        <th className="px-3 py-2.5 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground whitespace-nowrap">
                          Rodada
                        </th>
                        <th className="px-3 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground whitespace-nowrap">
                          Ações
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredQuotations.slice(0, 5).map((q) => {
                        const urgent = isUrgentDate(q.responseDeadline, 2)
                        const expired = isExpiredDate(q.responseDeadline)
                        const co = q.companies
                        const statusDisplay = getProposalStatusBadge(
                          q.proposalStatus,
                          q.status,
                        )
                        return (
                          <tr
                            key={q.id}
                            className="border-b border-border last:border-0 hover:bg-muted/20"
                          >
                            <td className="px-3 py-3 align-top">
                              <div className="flex flex-col gap-1">
                                <span className="font-semibold text-foreground">{q.code}</span>
                                {expired ? (
                                  <Badge className="w-fit text-xs bg-red-100 text-red-700 border border-red-200">
                                    Expirado
                                  </Badge>
                                ) : urgent ? (
                                  <Badge variant="destructive" className="w-fit text-xs">
                                    Urgente
                                  </Badge>
                                ) : null}
                              </div>
                            </td>
                            <td className="px-3 py-3 align-top max-w-[200px]">
                              <p className="truncate text-foreground" title={q.description}>
                                {q.description}
                              </p>
                            </td>
                            <td className="px-3 py-3 align-top whitespace-nowrap">
                              {co ? (
                                <div className="flex flex-col gap-0.5">
                                  <span className="font-medium text-foreground">{co.name}</span>
                                  {co.cnpj ? (
                                    <span className="text-xs text-muted-foreground">{co.cnpj}</span>
                                  ) : null}
                                </div>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="px-3 py-3 align-top whitespace-nowrap text-foreground">
                              {formatDateTimeBR(q.createdAt)}
                            </td>
                            <td className="px-3 py-3 align-top whitespace-nowrap">
                              {q.responseDeadline ? (
                                <span
                                  className={
                                    urgent ? "text-red-600 font-medium" : "text-foreground"
                                  }
                                >
                                  {formatDateBR(q.responseDeadline)}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">Sem prazo</span>
                              )}
                            </td>
                            <td className="px-3 py-3 align-top whitespace-nowrap">
                              <span className={statusDisplay.className}>
                                {statusDisplay.showTrophy ? (
                                  <Trophy className="mr-1 inline size-3 shrink-0 align-middle" />
                                ) : null}
                                {statusDisplay.label}
                              </span>
                            </td>
                            <td className="px-3 py-3 align-top text-center text-foreground">
                              {q.roundNumber != null ? `Rodada ${q.roundNumber}` : "—"}
                            </td>
                            <td className="px-3 py-3 align-top text-right">
                              {q.hasSubmittedThisRound ? (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => router.push(`/fornecedor/cotacoes/${q.id}`)}
                                >
                                  Ver Proposta
                                </Button>
                              ) : (
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={() => router.push(`/fornecedor/cotacoes/${q.id}`)}
                                >
                                  Responder
                                </Button>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                {!loading && filteredQuotations.length > 5 && (
                  <div>
                    <Link
                      href="/fornecedor/cotacoes"
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      Ver todas as cotações →
                    </Link>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Atividade Recente</h2>
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded bg-gray-200" />
            ))}
          </div>
        ) : (
          <ul className="border-t border-border">
            {activity.length === 0 ? (
              <li className="border-b border-border py-6 text-center text-sm text-muted-foreground">
                Nenhuma atividade no período.
              </li>
            ) : (
              activity.slice(0, 5).map((row, idx) => {
                const code = pickQuotationCode(row.quotations)
                const label =
                  proposalStatusLabel[row.status] ?? `Status: ${row.status}`
                let Icon = Send
                let iconClass = "text-green-600"
                if (row.status === "invited") {
                  Icon = Mail
                  iconClass = "text-blue-600"
                } else if (row.status === "selected") {
                  Icon = Trophy
                  iconClass = "text-amber-500"
                } else if (row.status === "rejected") {
                  Icon = XCircle
                  iconClass = "text-red-600"
                } else if (row.status === "submitted") {
                  Icon = Send
                  iconClass = "text-green-600"
                }

                return (
                  <li
                    key={`${row.quotation_id}-${row.updated_at}-${idx}`}
                    className="flex items-center gap-3 border-b border-border py-3"
                  >
                    <Icon className={`h-5 w-5 shrink-0 ${iconClass}`} />
                    <span className="min-w-0 flex-1 text-sm text-foreground">
                      {label} — {code}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {relativeListDay(row.updated_at)}
                    </span>
                  </li>
                )
              })
            )}
          </ul>
        )}
        {!loading && activity.length > 0 && (
          <Link
            href="#"
            className="text-sm text-primary hover:underline cursor-pointer mt-2 inline-block"
          >
            Ver toda a atividade →
          </Link>
        )}
      </section>
    </div>
  )
}
