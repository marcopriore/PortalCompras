"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useUser } from "@/lib/hooks/useUser"
import {
  formatDateBR,
  formatDateTimeBR,
  isExpiredDate,
  isUrgentDate,
} from "@/lib/utils/date-helpers"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import MultiSelectFilter from "@/components/ui/multi-select-filter"

import {
  ArchiveX,
  Clock,
  Search,
  Trophy,
  FileSpreadsheet,
  X,
} from "lucide-react"

type QuotationRow = {
  id: string
  code: string
  description: string
  status: string
  created_at: string
  company_id: string | null
}

type RoundRow = {
  id: string
  quotation_id: string
  round_number: number
  response_deadline: string | null
  status: string
}

type CompanyMapValue = { name: string; cnpj: string | null }

type ProposalRow = {
  quotation_id: string
  round_id: string | null
  status: string
}

type QuotationsTableRow = {
  id: string
  code: string
  description: string
  status: string
  createdAt: string
  companies: { name: string; cnpj: string | null } | null
  roundNumber: number | null
  responseDeadline: string | null
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

const statusOptions = [
  { value: "invited", label: "Aguardando Resposta" },
  { value: "submitted", label: "Proposta Enviada" },
  { value: "selected", label: "Vencedor" },
  { value: "rejected", label: "Encerrada" },
  { value: "cancelled", label: "Cancelada" },
]

export default function FornecedorCotacoesPage() {
  const router = useRouter()
  const { supplierId, loading: userLoading } = useUser()

  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState(false)

  const [mAwaiting, setMAwaiting] = React.useState(0)
  const [mInAnalysis, setMInAnalysis] = React.useState(0)
  const [mWinners, setMWinners] = React.useState(0)
  const [mClosed, setMClosed] = React.useState(0)

  const [hasInvites, setHasInvites] = React.useState(false)
  const [tableRows, setTableRows] = React.useState<QuotationsTableRow[]>([])

  const [filterSearch, setFilterSearch] = React.useState("")
  const [filterStatuses, setFilterStatuses] = React.useState<string[]>([])
  const [filterPeriod, setFilterPeriod] = React.useState<string>("all")

  const [page, setPage] = React.useState(1)
  const pageSize = 10

  const filteredQuotations = React.useMemo(() => {
    let rows = tableRows
    const term = filterSearch.trim().toLowerCase()
    if (term) {
      rows = rows.filter(
        (r) =>
          r.code.toLowerCase().includes(term) ||
          r.description.toLowerCase().includes(term),
      )
    }

    if (filterStatuses.length > 0) {
      rows = rows.filter((r) => {
        const { filterKey } = getProposalStatusBadge(r.proposalStatus, r.status)
        const match =
          filterStatuses.includes(filterKey) ||
          (filterStatuses.includes("rejected") && filterKey === "completed")
        return match
      })
    }

    if (filterPeriod !== "all") {
      const days = filterPeriod === "30" ? 30 : filterPeriod === "90" ? 90 : 365
      const cutoff = new Date()
      cutoff.setHours(0, 0, 0, 0)
      cutoff.setDate(cutoff.getDate() - days)
      rows = rows.filter((r) => {
        const d = new Date(r.createdAt)
        return !Number.isNaN(d.getTime()) && d >= cutoff
      })
    }

    return rows
  }, [tableRows, filterSearch, filterStatuses, filterPeriod])

  const filtersActive =
    filterSearch.trim() !== "" || filterStatuses.length > 0 || filterPeriod !== "all"

  const clearFilters = () => {
    setFilterSearch("")
    setFilterStatuses([])
    setFilterPeriod("all")
  }

  const totalPages = Math.ceil(filteredQuotations.length / pageSize) || 1
  const pageClamped = Math.min(Math.max(page, 1), totalPages)
  const paginatedQuotations = React.useMemo(() => {
    const start = (pageClamped - 1) * pageSize
    const end = start + pageSize
    return filteredQuotations.slice(start, end)
  }, [filteredQuotations, pageClamped])

  React.useEffect(() => {
    setPage(1)
  }, [filterSearch, filterStatuses, filterPeriod])

  React.useEffect(() => {
    if (userLoading) return

    if (!supplierId) {
      setLoading(false)
      setError(false)
      setMAwaiting(0)
      setMInAnalysis(0)
      setMWinners(0)
      setMClosed(0)
      setHasInvites(false)
      setTableRows([])
      setFilterSearch("")
      setFilterStatuses([])
      setFilterPeriod("all")
      setPage(1)
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
        quotationIds = [
          ...new Set((invitesRes.data ?? []).map((r) => r.quotation_id)),
        ]
        if (!cancelled) setHasInvites(quotationIds.length > 0)
      } catch (err) {
        console.error("Erro ao carregar cotações fornecedor:", err)
        if (!cancelled) {
          setError(true)
          setHasInvites(false)
          setTableRows([])
        }
        quotationIds = []
      }

      try {
        if (quotationIds.length === 0) {
          if (!cancelled) {
            setMAwaiting(0)
            setMInAnalysis(0)
            setMClosed(0)
            setMWinners(0)
          }
        } else {
          const [roundsRes, selectedCountRes, submittedRowsRes, completedCountRes] =
            await Promise.all([
              supabase
                .from("quotation_rounds")
                .select(
                  "id, quotation_id, round_number, response_deadline, status",
                )
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
        console.error("Erro ao carregar métricas fornecedor:", err)
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
          if (!cancelled) setTableRows([])
        } else {
          const quotationsRes = await supabase
            .from("quotations")
            .select("id, code, description, status, created_at, company_id")
            .in("id", quotationIds)

          if (quotationsRes.error) throw quotationsRes.error

          const quotationRows =
            (quotationsRes.data ?? []) as QuotationRow[]

          const companyIds = [
            ...new Set(quotationRows.map((q) => q.company_id).filter(Boolean)),
          ] as string[]

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

          const roundsRes = await supabase
            .from("quotation_rounds")
            .select(
              "id, quotation_id, round_number, response_deadline, status",
            )
            .in("quotation_id", quotationIds)
            .eq("status", "active")
          if (roundsRes.error) throw roundsRes.error

          const activeRounds = (roundsRes.data ?? []) as RoundRow[]
          const roundByQuotation = new Map<string, RoundRow>()
          for (const r of activeRounds) {
            roundByQuotation.set(r.quotation_id, r)
          }

          const baseRows: QuotationsTableRow[] = quotationRows.map((q) => {
            const ar = roundByQuotation.get(q.id) ?? null
            const coRaw = q.company_id ? companyMap[q.company_id] : undefined
            const companies = coRaw
              ? { name: coRaw.name, cnpj: coRaw.cnpj }
              : null
            return {
              id: q.id,
              code: q.code,
              description: q.description,
              status: q.status,
              createdAt: q.created_at,
              companies,
              roundNumber: ar?.round_number ?? null,
              responseDeadline: ar?.response_deadline ?? null,
              proposalStatus: null,
            }
          })

          baseRows.sort((a, b) => {
            const da = a.responseDeadline
              ? new Date(`${a.responseDeadline}T00:00:00`).getTime()
              : Number.POSITIVE_INFINITY
            const db = b.responseDeadline
              ? new Date(`${b.responseDeadline}T00:00:00`).getTime()
              : Number.POSITIVE_INFINITY
            return da - db
          })

          if (!cancelled) setTableRows(baseRows)
        }
      } catch (err) {
        console.error("Erro ao carregar cotações fornecedor:", err)
        if (!cancelled) {
          setError(true)
          setTableRows([])
        }
      }

      try {
        if (quotationIds.length === 0) return
        const myProposalsRes = await supabase
          .from("quotation_proposals")
          .select("quotation_id, round_id, status")
          .eq("supplier_id", supplierId)
          .in("quotation_id", quotationIds)

        if (myProposalsRes.error) throw myProposalsRes.error
        const myProposalsRows = (myProposalsRes.data ?? []) as ProposalRow[]

        const priority: Record<string, number> = {
          selected: 4,
          submitted: 3,
          invited: 2,
          rejected: 1,
        }

        const proposalStatusByQuotation = new Map<string, string>()
        const proposalRankByQuotation = new Map<string, number>()

        for (const p of myProposalsRows) {
          const cur = proposalRankByQuotation.get(p.quotation_id) ?? 0
          const next = priority[p.status] ?? 0
          if (next > cur) {
            proposalRankByQuotation.set(p.quotation_id, next)
            proposalStatusByQuotation.set(p.quotation_id, p.status)
          }
        }

        if (!cancelled) {
          setTableRows((prev) =>
            prev.map((r) => ({
              ...r,
              proposalStatus: proposalStatusByQuotation.get(r.id) ?? null,
            })),
          )
        }
      } catch (err) {
        console.error("Erro ao carregar propostas fornecedor:", err)
        if (!cancelled) setError(true)
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
        <h1 className="text-2xl font-bold tracking-tight">Cotações</h1>
        <p className="text-muted-foreground">
          Cotações em que você foi convidado
        </p>
      </div>

      {error && <p className="text-sm text-destructive">Não foi possível carregar os dados</p>}

      <div
        className="grid w-full grid-cols-4 gap-4 mb-2"
        style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}
      >
        {loading ? (
          <>
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-[100px] animate-pulse rounded-xl bg-gray-200"
              />
            ))}
          </>
        ) : (
          <>
            <div className="min-w-0 bg-white border border-amber-100 rounded-xl p-5 flex items-center justify-between">
              <div>
                <p className="text-sm text-amber-600 font-medium">
                  Aguardando Resposta
                </p>
                <p className="text-3xl font-bold text-amber-700 mt-1">{mAwaiting}</p>
              </div>
              <div className="bg-amber-100 p-3 rounded-full shrink-0">
                <Clock className="w-6 h-6 text-amber-600" />
              </div>
            </div>

            <div className="min-w-0 bg-white border border-blue-100 rounded-xl p-5 flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600 font-medium">Em Análise</p>
                <p className="text-3xl font-bold text-blue-700 mt-1">
                  {mInAnalysis}
                </p>
              </div>
              <div className="bg-blue-100 p-3 rounded-full shrink-0">
                <Search className="w-6 h-6 text-blue-600" />
              </div>
            </div>

            <div className="min-w-0 bg-white border border-green-100 rounded-xl p-5 flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600 font-medium">
                  Propostas Vencedoras
                </p>
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
          <p className="text-sm text-muted-foreground">
            Acompanhe o status das suas cotações
          </p>
        </div>

        {loading ? (
          <div className="overflow-x-auto rounded-xl border border-border bg-white">
            <table className="w-full text-sm">
              <tbody>
                {Array.from({ length: 5 }).map((_, i) => (
                  <tr
                    key={i}
                    className="border-b border-border last:border-0"
                  >
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
        ) : !hasInvites ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-border bg-muted/20 py-16 text-center">
            <FileSpreadsheet className="h-14 w-14 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">
              Você ainda não foi convidado para nenhuma cotação.
            </p>
          </div>
        ) : (
          <>
            <div className="bg-muted/40 border border-border rounded-xl p-4 mb-6 flex flex-wrap gap-4 items-end">
              <div className="min-w-[200px] flex-1">
                <Label
                  htmlFor="cotacoes-busca"
                  className="mb-1.5 block text-sm font-medium"
                >
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

              <div className="flex w-48 shrink-0 flex-col">
                <p className="mb-1 block text-xs font-medium text-muted-foreground">
                  Status
                </p>
                <MultiSelectFilter
                  label="Status"
                  options={statusOptions}
                  selected={filterStatuses}
                  onChange={setFilterStatuses}
                  width="w-full"
                />
              </div>

              <div className="w-44 shrink-0">
                <Label
                  htmlFor="cotacoes-periodo"
                  className="mb-1.5 block text-sm font-medium"
                >
                  Período
                </Label>
                <Select value={filterPeriod} onValueChange={setFilterPeriod}>
                  <SelectTrigger
                    id="cotacoes-periodo"
                    className="w-full"
                    size="sm"
                  >
                    <SelectValue placeholder="Período" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="30">Últimos 30 dias</SelectItem>
                    <SelectItem value="90">Últimos 90 dias</SelectItem>
                    <SelectItem value="365">Este ano</SelectItem>
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
                        <th className="px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground whitespace-nowrap">
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
                      {paginatedQuotations.map((q) => {
                        const urgent = isUrgentDate(q.responseDeadline, 2)
                        const expired = isExpiredDate(q.responseDeadline)
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
                                <span className="font-semibold text-foreground">
                                  {q.code}
                                </span>
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
                              <p
                                className="truncate text-foreground"
                                title={q.description}
                              >
                                {q.description}
                              </p>
                            </td>
                            <td className="px-3 py-3 align-top whitespace-nowrap">
                              {q.companies ? (
                                <div className="flex flex-col gap-0.5">
                                  <span className="font-medium text-foreground">
                                    {q.companies.name}
                                  </span>
                                  {q.companies.cnpj ? (
                                    <span className="text-xs text-muted-foreground">
                                      {q.companies.cnpj}
                                    </span>
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
                              {q.status === "completed" || q.status === "cancelled" ? (
                                q.responseDeadline ? (
                                  <span
                                    className={
                                      urgent ? "text-red-600 font-medium" : "text-foreground"
                                    }
                                  >
                                    {formatDateBR(q.responseDeadline)}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )
                              ) : q.responseDeadline ? (
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
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => router.push(`/fornecedor/cotacoes/${q.id}`)}
                              >
                                Ver Detalhes
                              </Button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-between items-center mt-4 text-sm">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={pageClamped <= 1}
                  >
                    Anterior
                  </Button>

                  <span className="text-muted-foreground">
                    Página {pageClamped} de {totalPages}
                  </span>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={pageClamped >= totalPages}
                  >
                    Próximo
                  </Button>
                </div>
              </>
            )}
          </>
        )}
      </section>
    </div>
  )
}
