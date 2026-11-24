"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { formatDateBR } from "@/lib/formato-data"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { useUser } from "@/lib/hooks/useUser"
import { usePermissions } from "@/lib/hooks/usePermissions"
import { canViewAllByPermission } from "@/lib/quotations/ownership"
import {
  requisitionsListQueryOptions,
  type RequisitionListRow,
  type RequisitionPriority,
} from "@/lib/queries/requisitions-list"
import { queryKeys } from "@/lib/queries/keys"

import { RequisicoesImportExcelDialog } from "@/components/comprador/requisicoes-import-excel-dialog"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import MultiSelectFilter from "@/components/ui/multi-select-filter"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import { ClipboardList, Clock, CheckCircle, FileText, Search, Eye, Pencil, Plus, X } from "lucide-react"
import { TABLE_PAGE_SIZE, TablePagination } from "@/components/ui/table-pagination"
import { TableRowActions } from "@/components/ui/table-row-actions"
import {
  getRequisitionStatusMeta,
  REQUISITION_STATUS_FILTER_OPTIONS,
  type RequisitionStatus,
} from "@/lib/requisitions/status"

type Priority = RequisitionPriority

export function getStatusMeta(status: RequisitionStatus): { label: string; className: string } {
  return getRequisitionStatusMeta(status)
}

export function getPriorityMeta(priority: Priority): { label: string; className: string } {
  switch (priority) {
    case "normal":
      return { label: "Normal", className: "bg-gray-100 text-gray-700" }
    case "urgent":
      return { label: "Urgente", className: "bg-orange-100 text-orange-800" }
    case "critical":
      return { label: "Crítica", className: "bg-red-100 text-red-800" }
  }
}

export default function RequisicoesPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const supabase = React.useMemo(() => createClient(), [])
  const { companyId, userId, isSuperAdmin, hasRole, loading: userLoading } = useUser()
  const { hasPermission, canWrite, loading: permLoading } = usePermissions()

  const canViewAll = canViewAllByPermission(
    { isSuperAdmin, hasRole, hasPermission },
    "requisition.view_all",
  )

  const scope = canViewAll ? "all" : (userId ?? "")
  const listEnabled =
    !userLoading &&
    !permLoading &&
    !!companyId &&
    (canViewAll || !!userId)

  const requisitionsQuery = useQuery({
    ...requisitionsListQueryOptions(supabase, companyId ?? "", scope),
    enabled: listEnabled,
  })

  const requisitions: RequisitionListRow[] = requisitionsQuery.data ?? []
  const loading = requisitionsQuery.isLoading

  const [search, setSearch] = React.useState("")
  const searchInputRef = React.useRef<HTMLDivElement>(null)
  const [status, setStatus] = React.useState<string[]>([
    "draft",
    "buyer_review",
    "pending",
    "approved",
    "rejected",
    "in_quotation",
    "awaiting_buyer",
    "awaiting_approval",
  ])
  const [priority, setPriority] = React.useState<string[]>([])
  const [dateFrom, setDateFrom] = React.useState<string>("")
  const [dateTo, setDateTo] = React.useState<string>("")
  const [page, setPage] = React.useState(1)

  const setSearchWithPage = React.useCallback((value: string) => {
    setPage(1)
    setSearch(value)
  }, [])

  const setStatusWithPage = React.useCallback((value: string[]) => {
    setPage(1)
    setStatus(value)
  }, [])

  const setPriorityWithPage = React.useCallback((value: string[]) => {
    setPage(1)
    setPriority(value)
  }, [])

  const setDateFromWithPage = React.useCallback((value: string) => {
    setPage(1)
    setDateFrom(value)
  }, [])

  const setDateToWithPage = React.useCallback((value: string) => {
    setPage(1)
    setDateTo(value)
  }, [])

  const invalidateRequisitionsList = React.useCallback(() => {
    if (!companyId) return
    void queryClient.invalidateQueries({
      queryKey: queryKeys.requisitionsList(companyId, scope),
    })
  }, [queryClient, companyId, scope])

  const hasActiveFilters =
    !!search.trim() || status.length > 0 || priority.length > 0 || !!dateFrom || !!dateTo

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase()

    const fromTs = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null
    const toTs = dateTo ? new Date(`${dateTo}T23:59:59`).getTime() : null

    return requisitions.filter((r) => {
      const matchSearch =
        !q || r.title.toLowerCase().includes(q) || r.code.toLowerCase().includes(q)

      const matchStatus = status.length === 0 || status.includes(r.status)
      const matchPriority = priority.length === 0 || priority.includes(r.priority)

      const createdTs = new Date(r.created_at).getTime()
      const matchFrom = fromTs == null || createdTs >= fromTs
      const matchTo = toTs == null || createdTs <= toTs

      return matchSearch && matchStatus && matchPriority && matchFrom && matchTo
    })
  }, [requisitions, search, status, priority, dateFrom, dateTo])

  const PAGE_SIZE = TABLE_PAGE_SIZE
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageClamped = Math.min(page, totalPages)
  const paginated = React.useMemo(
    () => filtered.slice((pageClamped - 1) * PAGE_SIZE, pageClamped * PAGE_SIZE),
    [filtered, pageClamped],
  )

  const metrics = React.useMemo(() => {
    return {
      total: requisitions.length,
      pending: requisitions.filter((r) => r.status === "pending").length,
      approved: requisitions.filter((r) => r.status === "approved").length,
      inQuotation: requisitions.filter((r) => r.status === "in_quotation").length,
    }
  }, [requisitions])

  if (userLoading || permLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
        Carregando...
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Requisições</h1>
          <p className="text-muted-foreground">
            Gerencie suas requisições de compra
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <RequisicoesImportExcelDialog
            canImportExcel={hasPermission("import.excel")}
            onImported={invalidateRequisitionsList}
          />

          {canWrite("requisition.create.buyer") ? (
            <Button onClick={() => router.push("/comprador/requisicoes/nova")}>
              <Plus className="mr-2 h-4 w-4" />
              + Nova Requisição
            </Button>
          ) : null}
        </div>
      </div>

      <div
        className="grid w-full grid-cols-4 gap-4 mb-6"
        style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}
      >
        <div className="min-w-0 bg-white border border-blue-100 rounded-xl p-5 flex items-center justify-between">
          <div>
            <p className="text-sm text-blue-600 font-medium">Total de Requisições</p>
            <p className="text-3xl font-bold text-blue-700 mt-1">{metrics.total}</p>
          </div>
          <div className="bg-blue-100 p-3 rounded-full">
            <ClipboardList className="w-6 h-6 text-blue-600" />
          </div>
        </div>
        <div className="bg-white border border-yellow-100 rounded-xl p-5 flex items-center justify-between">
          <div>
            <p className="text-sm text-yellow-600 font-medium">Pendente Aprovação</p>
            <p className="text-3xl font-bold text-yellow-700 mt-1">{metrics.pending}</p>
          </div>
          <div className="bg-yellow-100 p-3 rounded-full">
            <Clock className="w-6 h-6 text-yellow-600" />
          </div>
        </div>
        <div className="min-w-0 bg-white border border-green-100 rounded-xl p-5 flex items-center justify-between">
          <div>
            <p className="text-sm text-green-600 font-medium">Aprovadas</p>
            <p className="text-3xl font-bold text-green-700 mt-1">{metrics.approved}</p>
          </div>
          <div className="bg-green-100 p-3 rounded-full">
            <CheckCircle className="w-6 h-6 text-green-600" />
          </div>
        </div>
        <div className="min-w-0 bg-white border border-purple-100 rounded-xl p-5 flex items-center justify-between">
          <div>
            <p className="text-sm text-purple-600 font-medium">Em Cotação</p>
            <p className="text-3xl font-bold text-purple-700 mt-1">{metrics.inQuotation}</p>
          </div>
          <div className="bg-purple-100 p-3 rounded-full">
            <FileText className="w-6 h-6 text-purple-600" />
          </div>
        </div>
      </div>

      <div className="bg-muted/40 border border-border rounded-xl p-4 mb-6">
        <p className="text-sm font-medium text-muted-foreground mb-3">Filtros</p>
        <div>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex flex-1 flex-col min-w-[200px]">
              <p className="text-xs font-medium text-muted-foreground mb-1 block">Buscar</p>
              <div ref={searchInputRef} className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por título ou código..."
                  value={search}
                  onChange={(e) => setSearchWithPage(e.target.value)}
                  className="pl-9 pr-8 w-full"
                />
                {search.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch("")
                      ;(searchInputRef.current?.querySelector("input") as HTMLInputElement)?.focus()
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer p-0 border-0 bg-transparent"
                    aria-label="Limpar busca"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-col">
              <p className="text-xs font-medium text-muted-foreground mb-1 block">Status</p>
              <MultiSelectFilter
                label="Status"
                options={[
                  ...REQUISITION_STATUS_FILTER_OPTIONS,
                  { value: "buyer_review", label: "Revisão Comprador" },
                ]}
                selected={status}
                onChange={setStatusWithPage}
                width="w-44"
              />
            </div>

            <div className="flex flex-col">
              <p className="text-xs font-medium text-muted-foreground mb-1 block">Prioridade</p>
              <MultiSelectFilter
                label="Prioridade"
                options={[
                  { value: "normal", label: "Normal" },
                  { value: "urgent", label: "Urgente" },
                  { value: "critical", label: "Crítica" },
                ]}
                selected={priority}
                onChange={setPriorityWithPage}
                width="w-40"
              />
            </div>

            <div className="flex flex-col w-40 shrink-0">
              <p className="text-xs font-medium text-muted-foreground mb-1 block">Data De</p>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFromWithPage(e.target.value)} className="w-full" />
            </div>
            <div className="flex flex-col w-40 shrink-0">
              <p className="text-xs font-medium text-muted-foreground mb-1 block">Data Até</p>
              <Input type="date" value={dateTo} onChange={(e) => setDateToWithPage(e.target.value)} className="w-full" />
            </div>
          </div>

          <div className="flex justify-end mt-4">
            {hasActiveFilters && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch("")
                  setStatus([
                    "draft",
                    "pending",
                    "approved",
                    "rejected",
                    "in_quotation",
                    "awaiting_buyer",
                    "awaiting_approval",
                  ])
                  setPriority([])
                  setDateFrom("")
                  setDateTo("")
                  setPage(1)
                }}
              >
                Limpar filtros
              </Button>
            )}
          </div>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">Lista de Requisições</CardTitle>
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span>{filtered.length} resultado(s)</span>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
              <ClipboardList className="h-10 w-10 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">Nenhuma requisição encontrada.</p>
              <p className="text-xs text-muted-foreground">
                {hasActiveFilters ? "Nenhuma requisição corresponde aos filtros atuais." : "Crie uma nova requisição ou aguarde importação do ERP."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Título</TableHead>
                    <TableHead>Solicitante</TableHead>
                    <TableHead>Centro de Custo</TableHead>
                    <TableHead>Necessidade</TableHead>
                    <TableHead className="text-center">Itens</TableHead>
                    <TableHead>Prioridade</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.map((r) => {
                    const s = getStatusMeta(r.status)
                    const p = getPriorityMeta(r.priority)
                    const itemsCount = r.requisition_items?.length ?? 0
                    return (
                      <TableRow key={r.id}>
                        <TableCell>
                          <button
                            type="button"
                            className="font-mono text-primary hover:underline underline-offset-2"
                            onClick={() => router.push(`/comprador/requisicoes/${r.id}`)}
                          >
                            {r.code}
                          </button>
                        </TableCell>
                        <TableCell className="font-medium">{r.title}</TableCell>
                        <TableCell>{r.requester_name ?? "—"}</TableCell>
                        <TableCell>{r.cost_center ?? "—"}</TableCell>
                        <TableCell>{formatDateBR(r.needed_by)}</TableCell>
                        <TableCell className="text-center text-muted-foreground">{itemsCount} itens</TableCell>
                        <TableCell>
                          <Badge className={p.className}>{p.label}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={s.className}>{s.label}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <TableRowActions
                            actions={[
                              {
                                label: "Ver Detalhes",
                                icon: Eye,
                                href: `/comprador/requisicoes/${r.id}`,
                              },
                              ...(r.status === "draft" || r.status === "rejected"
                                ? [
                                    {
                                      label:
                                        r.status === "draft"
                                          ? "Continuar edição"
                                          : "Editar e Resubmeter",
                                      icon: Pencil,
                                      href: `/comprador/requisicoes/${r.id}/editar`,
                                    },
                                  ]
                                : []),
                            ]}
                          />
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          <TablePagination
            page={pageClamped}
            total={filtered.length}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
          />
        </CardContent>
      </Card>
    </div>
  )
}

