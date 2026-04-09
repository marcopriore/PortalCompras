"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { createClient } from "@/lib/supabase/client"
import { useAutoRefresh } from "@/lib/hooks/use-auto-refresh"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
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
  LogOut,
  Clock,
  CheckCircle2,
  XCircle,
  FileText,
  Eye,
} from "lucide-react"

type RequisitionStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "in_quotation"
  | "completed"

type Requisition = {
  id: string
  code: string
  title: string
  status: RequisitionStatus
  priority: string
  created_at: string
  needed_by: string | null
  cost_center: string | null
  quotation_id: string | null
}

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

export default function SolicitantePage() {
  const router = useRouter()
  const [requisitions, setRequisitions] = React.useState<Requisition[]>([])
  const [loading, setLoading] = React.useState(true)
  const [search, setSearch] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState<string[]>([
    "pending",
    "approved",
    "rejected",
    "in_quotation",
  ])
  const [dateFrom, setDateFrom] = React.useState("")
  const [dateTo, setDateTo] = React.useState("")
  const [page, setPage] = React.useState(1)
  const PAGE_SIZE = 20

  const [userId, setUserId] = React.useState<string | null>(null)
  const [userName, setUserName] = React.useState<string>("")

  React.useEffect(() => {
    setPage(1)
  }, [search, statusFilter, dateFrom, dateTo])

  const filtered = React.useMemo(() => {
    return requisitions.filter((r) => {
      if (search.trim()) {
        const s = search.toLowerCase()
        if (
          !r.code.toLowerCase().includes(s) &&
          !r.title.toLowerCase().includes(s)
        ) {
          return false
        }
      }
      if (statusFilter.length > 0 && !statusFilter.includes(r.status)) {
        return false
      }
      if (dateFrom) {
        const from = new Date(dateFrom)
        from.setHours(0, 0, 0, 0)
        if (new Date(r.created_at) < from) return false
      }
      if (dateTo) {
        const to = new Date(dateTo)
        to.setHours(23, 59, 59, 999)
        if (new Date(r.created_at) > to) return false
      }
      return true
    })
  }, [requisitions, search, statusFilter, dateFrom, dateTo])

  const paginated = React.useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return filtered.slice(start, start + PAGE_SIZE)
  }, [filtered, page])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))

  const hasActiveFilters =
    search.trim() !== "" ||
    statusFilter.length !== 4 ||
    dateFrom !== "" ||
    dateTo !== ""

  // Métricas
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
      .select("full_name, profile_type")
      .eq("id", user.id)
      .single()

    if (!profile || profile.profile_type !== "requester") {
      window.location.href = "/login"
      return
    }

    setUserName(profile.full_name ?? user.email ?? "")

    const { data } = await supabase
      .from("requisitions")
      .select(
        "id, code, title, status, priority, created_at, needed_by, cost_center, quotation_id",
      )
      .eq("requester_id", user.id)
      .order("created_at", { ascending: false })

    setRequisitions((data as Requisition[]) ?? [])
    setLoading(false)
  }, [])

  React.useEffect(() => {
    void loadRequisitions()
  }, [loadRequisitions])

  useAutoRefresh({
    intervalMs: 30000,
    onRefresh: () => {
      void loadRequisitions()
    },
    enabled: Boolean(userId),
  })

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = "/login"
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 px-6 py-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-white font-bold text-sm">V</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                Portal do Solicitante
              </p>
              <p className="text-xs text-muted-foreground">{userName}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => void handleLogout()}>
            <LogOut className="w-4 h-4 mr-2" />
            Sair
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {/* Cards de métricas — manter exatamente como estão */}
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

        {/* Filtros */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="md:col-span-2 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por código ou título..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Data De</p>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Data Até</p>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground">Status:</span>
            {[
              {
                value: "pending",
                label: "Aguardando",
                color: "bg-yellow-100 text-yellow-800 border-yellow-200",
              },
              {
                value: "approved",
                label: "Aprovada",
                color: "bg-green-100 text-green-800 border-green-200",
              },
              {
                value: "rejected",
                label: "Reprovada",
                color: "bg-red-100 text-red-800 border-red-200",
              },
              {
                value: "in_quotation",
                label: "Em Cotação",
                color: "bg-blue-100 text-blue-800 border-blue-200",
              },
              {
                value: "completed",
                label: "Concluída",
                color: "bg-gray-100 text-gray-700 border-gray-200",
              },
            ].map((s) => {
              const active = statusFilter.includes(s.value)
              return (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => {
                    setStatusFilter((prev) =>
                      prev.includes(s.value)
                        ? prev.filter((x) => x !== s.value)
                        : [...prev, s.value],
                    )
                  }}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                    active
                      ? s.color
                      : "bg-muted text-muted-foreground border-transparent opacity-50"
                  }`}
                >
                  {s.label}
                </button>
              )
            })}

            {hasActiveFilters && (
              <button
                type="button"
                className="ml-auto text-xs text-primary underline"
                onClick={() => {
                  setSearch("")
                  setStatusFilter([
                    "pending",
                    "approved",
                    "rejected",
                    "in_quotation",
                  ])
                  setDateFrom("")
                  setDateTo("")
                }}
              >
                Limpar filtros
              </button>
            )}
          </div>
        </div>

        {/* Lista */}
        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-4 py-3 border-b border-border">
            <p className="text-sm font-medium text-foreground">
              Minhas Requisições
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-xs text-muted-foreground">
                {filtered.length} resultado{filtered.length !== 1 ? "s" : ""}
              </p>
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
                      <TableHead className="px-4">Centro de Custo</TableHead>
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
                            {r.cost_center || "—"}
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
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                router.push(`/solicitante/${r.id}`)
                              }}
                            >
                              <Eye className="w-4 h-4 mr-1" />
                              Ver
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>

              {totalPages > 1 && (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-4 py-3 border-t border-border">
                  <p className="text-xs text-muted-foreground">
                    Exibindo {(page - 1) * PAGE_SIZE + 1}–
                    {Math.min(page * PAGE_SIZE, filtered.length)} de{" "}
                    {filtered.length}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page === 1}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      ← Anterior
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      Página {page} de {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Próximo →
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  )
}
