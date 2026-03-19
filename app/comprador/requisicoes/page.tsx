"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"

import { createClient } from "@/lib/supabase/client"
import { useUser } from "@/lib/hooks/useUser"
import { usePermissions } from "@/lib/hooks/usePermissions"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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

import { ClipboardList, Clock, CheckCircle2, ChevronLeft, ChevronRight, FileText, Search, Eye, Plus } from "lucide-react"

type Priority = "normal" | "urgent" | "critical"
type RequisitionStatus = "pending" | "approved" | "rejected" | "in_quotation" | "completed"

type RequisitionItemRel = { id: string }

type Requisition = {
  id: string
  code: string
  title: string
  requester_name: string | null
  cost_center: string | null
  needed_by: string | null
  priority: Priority
  status: RequisitionStatus
  created_at: string
  requisition_items: RequisitionItemRel[]
}

export function getStatusMeta(status: RequisitionStatus): { label: string; className: string } {
  switch (status) {
    case "pending":
      return { label: "Aguardando Aprovação", className: "bg-yellow-100 text-yellow-800" }
    case "approved":
      return { label: "Aprovado", className: "bg-green-100 text-green-800" }
    case "rejected":
      return { label: "Rejeitado", className: "bg-red-100 text-red-800" }
    case "in_quotation":
      return { label: "Em Cotação", className: "bg-blue-100 text-blue-800" }
    case "completed":
      return { label: "Concluído", className: "bg-gray-100 text-gray-700" }
  }
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

function formatDateBR(iso: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return format(d, "dd/MM/yyyy", { locale: ptBR })
}

export default function RequisicoesPage() {
  const router = useRouter()
  const { companyId } = useUser()
  const { hasPermission } = usePermissions()

  const [requisitions, setRequisitions] = React.useState<Requisition[]>([])
  const [loading, setLoading] = React.useState(true)

  const [search, setSearch] = React.useState("")
  const [status, setStatus] = React.useState<string[]>([])
  const [priority, setPriority] = React.useState<string[]>([])
  const [dateFrom, setDateFrom] = React.useState<string>("")
  const [dateTo, setDateTo] = React.useState<string>("")
  const [page, setPage] = React.useState(1)

  React.useEffect(() => {
    setPage(1)
  }, [search, status, priority, dateFrom, dateTo])

  React.useEffect(() => {
    if (!companyId) return
    const supabase = createClient()

    const run = async () => {
      setLoading(true)
      const { data } = await supabase
        .from("requisitions")
        .select("*, requisition_items(id)")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })

      setRequisitions(((data ?? []) as unknown) as Requisition[])
      setLoading(false)
    }

    run()
  }, [companyId])

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

  const PAGE_SIZE = 20
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated = React.useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page],
  )
  const from = filtered.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const to = Math.min(page * PAGE_SIZE, filtered.length)

  const metrics = React.useMemo(() => {
    return {
      total: requisitions.length,
      pending: requisitions.filter((r) => r.status === "pending").length,
      approved: requisitions.filter((r) => r.status === "approved").length,
      inQuotation: requisitions.filter((r) => r.status === "in_quotation").length,
    }
  }, [requisitions])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Requisições</h1>
          <p className="text-muted-foreground">
            Gerencie as requisições de compra da empresa
          </p>
        </div>

        <Button
          onClick={() => router.push("/comprador/requisicoes/nova")}
          disabled={!hasPermission("requisition.create")}
          title={!hasPermission("requisition.create") ? "Sem permissão" : undefined}
        >
          <Plus className="mr-2 h-4 w-4" />
          + Nova Requisição
        </Button>
      </div>

      <Card className="bg-muted/40 border border-border rounded-xl p-4">
        <CardContent className="p-0">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex flex-1 flex-col min-w-[200px]">
              <p className="text-xs font-medium text-muted-foreground mb-1 block">Buscar</p>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por título ou código..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 w-full"
                />
              </div>
            </div>

            <div className="flex flex-col">
              <p className="text-xs font-medium text-muted-foreground mb-1 block">Status</p>
              <MultiSelectFilter
                label="Status"
                options={[
                  { value: "pending", label: "Aguardando Aprovação" },
                  { value: "approved", label: "Aprovado" },
                  { value: "rejected", label: "Rejeitado" },
                  { value: "in_quotation", label: "Em Cotação" },
                  { value: "completed", label: "Concluído" },
                ]}
                selected={status}
                onChange={setStatus}
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
                onChange={setPriority}
                width="w-40"
              />
            </div>

            <div className="flex flex-col w-40 shrink-0">
              <p className="text-xs font-medium text-muted-foreground mb-1 block">Data De</p>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-full" />
            </div>
            <div className="flex flex-col w-40 shrink-0">
              <p className="text-xs font-medium text-muted-foreground mb-1 block">Data Até</p>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-full" />
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
                  setStatus([])
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
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total de Requisições</CardTitle>
            <ClipboardList className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Aguardando Aprovação</CardTitle>
            <Clock className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">{metrics.pending}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Aprovadas</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{metrics.approved}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Em Cotação</CardTitle>
            <FileText className="h-4 w-4 text-indigo-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-indigo-500">{metrics.inQuotation}</div>
          </CardContent>
        </Card>
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
                          <Button variant="outline" size="sm" onClick={() => router.push(`/comprador/requisicoes/${r.id}`)}>
                            <Eye className="mr-2 h-4 w-4" />
                            Ver
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {!loading && filtered.length > 0 && (
            <div className="flex flex-col gap-3 pt-4 border-t border-border mt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                Exibindo {from}–{to} de {filtered.length} resultado(s)
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Anterior
                </Button>
                <span className="text-sm text-muted-foreground px-2">
                  Página {page} de {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  Próximo
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

