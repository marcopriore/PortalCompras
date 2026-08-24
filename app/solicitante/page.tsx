"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { createClient } from "@/lib/supabase/client"
import { useAutoRefresh } from "@/lib/hooks/use-auto-refresh"
import { usePollingIntervalMs } from "@/lib/hooks/use-polling-interval"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import MultiSelectFilter from "@/components/ui/multi-select-filter"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  ClipboardList,
  Plus,
  Search,
  Clock,
  CheckCircle2,
  XCircle,
  FileText,
  Eye,
  Download,
} from "lucide-react"
import { TABLE_PAGE_SIZE, TablePagination } from "@/components/ui/table-pagination"
import { TableRowActions } from "@/components/ui/table-row-actions"

type RequisitionStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "in_quotation"
  | "completed"
  | "cancelled"

type Requisition = {
  id: string
  code: string
  title: string
  status: RequisitionStatus
  priority: string
  created_at: string
  needed_by: string | null
  requester_id: string | null
  requester_name: string | null
  quotation_id: string | null
}

const STATUS_OPTIONS = [
  { value: "pending", label: "Aguardando" },
  { value: "approved", label: "Aprovada" },
  { value: "rejected", label: "Reprovada" },
  { value: "in_quotation", label: "Em Cotação" },
  { value: "cancelled", label: "Cancelada" },
  { value: "completed", label: "Concluída" },
]

const DEFAULT_STATUS = [
  "pending",
  "approved",
  "rejected",
  "in_quotation",
  "cancelled",
]

function getStatusMeta(status: RequisitionStatus) {
  switch (status) {
    case "pending":
      return {
        label: "Aguardando Aprovação",
        color: "bg-yellow-100 text-yellow-800",
        icon: Clock,
      }
    case "approved":
      return {
        label: "Aprovado",
        color: "bg-green-100 text-green-800",
        icon: CheckCircle2,
      }
    case "rejected":
      return {
        label: "Reprovado",
        color: "bg-red-100 text-red-800",
        icon: XCircle,
      }
    case "in_quotation":
      return {
        label: "Em Cotação",
        color: "bg-blue-100 text-blue-800",
        icon: FileText,
      }
    case "completed":
      return {
        label: "Concluído",
        color: "bg-gray-100 text-gray-700",
        icon: CheckCircle2,
      }
    case "cancelled":
      return {
        label: "Cancelada",
        color: "bg-gray-100 text-gray-700",
        icon: XCircle,
      }
  }
}

function getPriorityMeta(priority: string) {
  switch (priority) {
    case "urgent":
      return { label: "Urgente", className: "bg-orange-100 text-orange-800" }
    case "critical":
      return { label: "Crítica", className: "bg-red-100 text-red-800" }
    default:
      return { label: "Normal", className: "bg-gray-100 text-gray-700" }
  }
}

function formatDateBR(iso: string | null | undefined): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return format(d, "dd/MM/yyyy", { locale: ptBR })
}

function SolicitantePageInner() {
  const router = useRouter()
  const [requisitions, setRequisitions] = React.useState<Requisition[]>([])
  const [loading, setLoading] = React.useState(true)
  const [exporting, setExporting] = React.useState(false)
  const [search, setSearch] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState<string[]>([...DEFAULT_STATUS])
  const [responsibleFilter, setResponsibleFilter] = React.useState<string[]>([])
  const [dateFrom, setDateFrom] = React.useState("")
  const [dateTo, setDateTo] = React.useState("")
  const [page, setPage] = React.useState(1)
  const PAGE_SIZE = TABLE_PAGE_SIZE

  const [userId, setUserId] = React.useState<string | null>(null)
  const [canViewAll, setCanViewAll] = React.useState(false)

  React.useEffect(() => {
    setPage(1)
  }, [search, statusFilter, responsibleFilter, dateFrom, dateTo])

  const responsibleOptions = React.useMemo(() => {
    const seen = new Map<string, string>()
    for (const r of requisitions) {
      if (!r.requester_id) continue
      const label = r.requester_name?.trim() || "Sem nome"
      if (!seen.has(r.requester_id)) seen.set(r.requester_id, label)
    }
    return Array.from(seen.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"))
  }, [requisitions])

  const filtered = React.useMemo(() => {
    return requisitions.filter((r) => {
      if (search.trim()) {
        const s = search.toLowerCase()
        const responsible = (r.requester_name ?? "").toLowerCase()
        if (
          !r.code.toLowerCase().includes(s) &&
          !r.title.toLowerCase().includes(s) &&
          !responsible.includes(s)
        ) {
          return false
        }
      }
      if (statusFilter.length > 0 && !statusFilter.includes(r.status)) {
        return false
      }
      if (
        responsibleFilter.length > 0 &&
        (!r.requester_id || !responsibleFilter.includes(r.requester_id))
      ) {
        return false
      }
      if (dateFrom) {
        const from = new Date(`${dateFrom}T00:00:00`)
        if (new Date(r.created_at) < from) return false
      }
      if (dateTo) {
        const to = new Date(`${dateTo}T23:59:59`)
        if (new Date(r.created_at) > to) return false
      }
      return true
    })
  }, [requisitions, search, statusFilter, responsibleFilter, dateFrom, dateTo])

  const paginated = React.useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return filtered.slice(start, start + PAGE_SIZE)
  }, [filtered, page, PAGE_SIZE])

  const hasActiveFilters =
    search.trim() !== "" ||
    statusFilter.length !== DEFAULT_STATUS.length ||
    DEFAULT_STATUS.some((s) => !statusFilter.includes(s)) ||
    responsibleFilter.length > 0 ||
    dateFrom !== "" ||
    dateTo !== ""

  const total = requisitions.length
  const pending = requisitions.filter((r) => r.status === "pending").length
  const inProgress = requisitions.filter((r) =>
    ["approved", "in_quotation"].includes(r.status),
  ).length
  const completed = requisitions.filter((r) => r.status === "completed").length

  const loadRequisitions = React.useCallback(async () => {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      window.location.href = "/login"
      return
    }

    setUserId(user.id)

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, profile_type, company_id, is_superadmin, role, roles")
      .eq("id", user.id)
      .single()

    if (!profile) {
      window.location.href = "/login"
      return
    }

    const roles = (profile.roles as string[] | null) ?? []
    const isMaster = Boolean(profile.is_superadmin)
    const isAdmin = profile.role === "admin" || roles.includes("admin")
    const viewAll = isMaster || isAdmin

    if (profile.profile_type !== "requester" && !viewAll) {
      window.location.href = "/login"
      return
    }

    setCanViewAll(viewAll)

    let query = supabase
      .from("requisitions")
      .select(
        "id, code, title, status, priority, created_at, needed_by, requester_id, requester_name, quotation_id",
      )
      .order("created_at", { ascending: false })

    if (profile.company_id) {
      query = query.eq("company_id", profile.company_id)
    }

    if (!viewAll) {
      query = query.eq("requester_id", user.id)
    }

    const { data } = await query
    setRequisitions((data as Requisition[]) ?? [])
    setLoading(false)
  }, [])

  React.useEffect(() => {
    void loadRequisitions()
  }, [loadRequisitions])

  const pollingIntervalMs = usePollingIntervalMs()

  useAutoRefresh({
    intervalMs: pollingIntervalMs,
    onRefresh: () => {
      void loadRequisitions()
    },
    enabled: Boolean(userId),
  })

  const clearFilters = () => {
    setSearch("")
    setStatusFilter([...DEFAULT_STATUS])
    setResponsibleFilter([])
    setDateFrom("")
    setDateTo("")
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const ExcelJS = (await import("exceljs")).default
      const workbook = new ExcelJS.Workbook()
      const ws = workbook.addWorksheet("Requisições")

      ws.columns = [
        { header: "Código", key: "code", width: 18 },
        { header: "Título", key: "title", width: 36 },
        { header: "Responsável", key: "responsible", width: 28 },
        { header: "Necessidade", key: "neededBy", width: 14 },
        { header: "Prioridade", key: "priority", width: 12 },
        { header: "Status", key: "status", width: 22 },
        { header: "Criada em", key: "createdAt", width: 18 },
      ]

      const headerRow = ws.getRow(1)
      headerRow.height = 18
      headerRow.eachCell((cell: { fill: unknown; font: unknown; alignment: unknown }) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF4F3EF5" },
        }
        cell.font = { color: { argb: "FFFFFFFF" }, bold: true, size: 11 }
        cell.alignment = { horizontal: "center", vertical: "middle" }
      })

      filtered.forEach((r) => {
        ws.addRow({
          code: r.code,
          title: r.title,
          responsible: r.requester_name ?? "—",
          neededBy: formatDateBR(r.needed_by),
          priority: getPriorityMeta(r.priority).label,
          status: getStatusMeta(r.status).label,
          createdAt: format(new Date(r.created_at), "dd/MM/yyyy HH:mm", {
            locale: ptBR,
          }),
        })
      })

      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      const stamp = format(new Date(), "yyyyMMdd_HHmm")
      a.href = url
      a.download = `requisicoes_solicitante_${stamp}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-lg border bg-card p-4">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-2xl font-bold text-foreground">{total}</p>
          </div>
          <div className="rounded-lg border border-yellow-100 bg-yellow-50 p-4">
            <p className="text-xs text-yellow-700">Aguardando</p>
            <p className="text-2xl font-bold text-yellow-800">{pending}</p>
          </div>
          <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
            <p className="text-xs text-blue-700">Em Andamento</p>
            <p className="text-2xl font-bold text-blue-800">{inProgress}</p>
          </div>
          <div className="rounded-lg border border-green-100 bg-green-50 p-4">
            <p className="text-xs text-green-700">Concluídas</p>
            <p className="text-2xl font-bold text-green-800">{completed}</p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col min-w-[220px] flex-1">
              <Label className="text-xs font-medium text-muted-foreground mb-1">
                Busca
              </Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Código, título ou responsável..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <div className="flex flex-col w-44">
              <p className="text-xs font-medium text-muted-foreground mb-1">Status</p>
              <MultiSelectFilter
                label="Status"
                options={STATUS_OPTIONS}
                selected={statusFilter}
                onChange={setStatusFilter}
                width="w-44"
              />
            </div>

            <div className="flex flex-col w-[140px]">
              <Label className="text-xs font-medium text-muted-foreground mb-1">
                Data De
              </Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>

            <div className="flex flex-col w-[140px]">
              <Label className="text-xs font-medium text-muted-foreground mb-1">
                Data Até
              </Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>

            {canViewAll ? (
              <div className="flex flex-col">
                <p className="text-xs font-medium text-muted-foreground mb-1">
                  Responsável
                </p>
                <MultiSelectFilter
                  label="Responsável"
                  options={responsibleOptions}
                  selected={responsibleFilter}
                  onChange={setResponsibleFilter}
                  width="w-52"
                />
              </div>
            ) : null}

            {hasActiveFilters ? (
              <div className="flex flex-col">
                <span className="text-xs font-medium text-muted-foreground mb-1 block">
                  &nbsp;
                </span>
                <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
                  Limpar Filtros
                </Button>
              </div>
            ) : null}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-4 py-3 border-b border-border">
            <p className="text-sm font-medium text-foreground">
              {canViewAll ? "Requisições" : "Minhas Requisições"}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-xs text-muted-foreground">
                {filtered.length} resultado{filtered.length !== 1 ? "s" : ""}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => void handleExport()}
                disabled={exporting || filtered.length === 0}
              >
                <Download className="w-4 h-4" />
                {exporting ? "Exportando..." : "Exportar Excel"}
              </Button>
              <Button size="sm" onClick={() => router.push("/solicitante/nova")}>
                <Plus className="w-4 h-4 mr-2" />
                Nova Requisição
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Carregando...
            </div>
          ) : paginated.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <ClipboardList className="w-10 h-10 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">
                {hasActiveFilters
                  ? "Nenhuma requisição encontrada com os filtros aplicados."
                  : "Você ainda não criou requisições."}
              </p>
              {!hasActiveFilters && (
                <Button
                  className="mt-4"
                  onClick={() => router.push("/solicitante/nova")}
                >
                  Criar primeira requisição
                </Button>
              )}
            </div>
          ) : (
            <>
              <div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="px-4">Código</TableHead>
                      <TableHead className="px-4">Título</TableHead>
                      <TableHead className="px-4">Responsável</TableHead>
                      <TableHead className="px-4">Necessidade</TableHead>
                      <TableHead className="px-4">Prioridade</TableHead>
                      <TableHead className="px-4">Status</TableHead>
                      <TableHead className="px-4 text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginated.map((r) => {
                      const statusMeta = getStatusMeta(r.status)
                      const priorityMeta = getPriorityMeta(r.priority)
                      return (
                        <TableRow
                          key={r.id}
                          className="hover:bg-muted/50 cursor-pointer transition-colors"
                          onClick={() => router.push(`/solicitante/${r.id}`)}
                        >
                          <TableCell className="px-4 font-mono text-sm text-primary font-medium">
                            {r.code}
                          </TableCell>
                          <TableCell className="px-4 text-sm font-medium max-w-xs truncate">
                            {r.title}
                          </TableCell>
                          <TableCell className="px-4 text-sm text-muted-foreground">
                            {r.requester_name || "—"}
                          </TableCell>
                          <TableCell className="px-4 text-sm text-muted-foreground">
                            {formatDateBR(r.needed_by)}
                          </TableCell>
                          <TableCell className="px-4">
                            <Badge className={priorityMeta.className}>
                              {priorityMeta.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="px-4">
                            <Badge className={statusMeta.color}>
                              {statusMeta.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="px-4 text-right whitespace-nowrap">
                            <TableRowActions
                              actions={[
                                {
                                  label: "Ver Detalhes",
                                  icon: Eye,
                                  href: `/solicitante/${r.id}`,
                                },
                              ]}
                            />
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>

              <TablePagination
                page={page}
                total={filtered.length}
                pageSize={PAGE_SIZE}
                onPageChange={setPage}
              />
            </>
          )}
        </div>
    </div>
  )
}

export default function SolicitantePage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
          Carregando...
        </div>
      }
    >
      <SolicitantePageInner />
    </React.Suspense>
  )
}
