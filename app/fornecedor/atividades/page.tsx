"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { ChevronLeft, Search, X } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useUser } from "@/lib/hooks/useUser"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatDateTimeBR } from "@/lib/utils/date-helpers"
import {
  mapOrderRowsToActivityItems,
  mapProposalRowsToActivityItems,
  mergeActivityByUpdatedAt,
  type ActivityItem,
  type OrderActivityRow,
  type ProposalActivityRow,
} from "@/lib/utils/activity-helpers"

const PAGE_SIZE = 20

type ModuleFilter = "all" | "proposal" | "order"
type PeriodFilter = "all" | "today" | "7" | "30" | "90"

export default function FornecedorAtividadesPage() {
  const router = useRouter()
  const { supplierId, loading: userLoading } = useUser()

  const [combined, setCombined] = React.useState<ActivityItem[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState(false)

  const [search, setSearch] = React.useState("")
  const [moduleFilter, setModuleFilter] = React.useState<ModuleFilter>("all")
  const [periodFilter, setPeriodFilter] = React.useState<PeriodFilter>("all")
  const [page, setPage] = React.useState(1)

  React.useEffect(() => {
    setPage(1)
  }, [search, moduleFilter, periodFilter])

  React.useEffect(() => {
    if (userLoading) return
    if (!supplierId) {
      setCombined([])
      setLoading(false)
      return
    }

    let cancelled = false
    const supabase = createClient()

    const run = async () => {
      setLoading(true)
      setError(false)
      try {
        const [proposalsRes, ordersRes] = await Promise.all([
          supabase
            .from("quotation_proposals")
            .select("status, updated_at, quotation_id, quotations!inner(code)")
            .eq("supplier_id", supplierId)
            .order("updated_at", { ascending: false })
            .limit(200),
          supabase
            .from("purchase_orders")
            .select("id, code, status, updated_at")
            .eq("supplier_id", supplierId)
            .neq("status", "draft")
            .order("updated_at", { ascending: false })
            .limit(200),
        ])

        if (proposalsRes.error) throw proposalsRes.error
        if (ordersRes.error) throw ordersRes.error

        const mappedProposals = mapProposalRowsToActivityItems(
          (proposalsRes.data as ProposalActivityRow[]) ?? [],
        )
        const mappedOrders = mapOrderRowsToActivityItems(
          (ordersRes.data as OrderActivityRow[]) ?? [],
        )
        const merged = mergeActivityByUpdatedAt(mappedProposals, mappedOrders)

        if (!cancelled) setCombined(merged)
      } catch (e) {
        console.error("Erro ao carregar histórico de atividades:", e)
        if (!cancelled) {
          setError(true)
          setCombined([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [supplierId, userLoading])

  const filtered = React.useMemo(() => {
    return combined.filter((item) => {
      if (search && !item.code.toLowerCase().includes(search.trim().toLowerCase())) {
        return false
      }
      if (moduleFilter !== "all" && item.type !== moduleFilter) return false
      if (periodFilter !== "all") {
        const itemDate = new Date(item.updated_at)
        if (periodFilter === "today") {
          const today = new Date()
          if (itemDate.toDateString() !== today.toDateString()) return false
        } else {
          const days = parseInt(periodFilter, 10)
          const cutoff = new Date()
          cutoff.setDate(cutoff.getDate() - days)
          if (itemDate < cutoff) return false
        }
      }
      return true
    })
  }, [combined, search, moduleFilter, periodFilter])

  const totalFiltered = filtered.length
  const totalPages = Math.max(1, Math.ceil(totalFiltered / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageSlice = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  React.useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const clearFilters = () => {
    setSearch("")
    setModuleFilter("all")
    setPeriodFilter("all")
  }

  const hasActiveFilters =
    search.trim() !== "" || moduleFilter !== "all" || periodFilter !== "all"

  return (
    <div className="space-y-6">
      <div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mb-3 -ml-2 h-8 gap-1 px-2 text-muted-foreground hover:text-foreground"
          onClick={() => router.back()}
        >
          <ChevronLeft className="h-4 w-4" />
          Voltar
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">Histórico de Atividades</h1>
        <p className="text-muted-foreground">Todas as suas ações no sistema</p>
      </div>

      {!userLoading && !supplierId && (
        <p className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          Seu usuário ainda não está vinculado a um cadastro de fornecedor. Entre em contato com o
          suporte para concluir o vínculo.
        </p>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          Não foi possível carregar o histórico de atividades. Tente novamente mais tarde.
        </div>
      )}

      {supplierId ? (
        <>
          <div className="mb-6 rounded-xl border border-border bg-muted/40 p-4">
            <div className="flex flex-col gap-4 md:flex-row md:flex-wrap md:items-end">
              <div className="min-w-0 flex-1 space-y-2">
                <Label htmlFor="atividade-busca">Buscar por código</Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="atividade-busca"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Código da cotação ou pedido…"
                    className="pl-9 pr-9"
                  />
                  {search ? (
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                      aria-label="Limpar busca"
                      onClick={() => setSearch("")}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="w-full space-y-2 md:w-44">
                <Label>Tipo / módulo</Label>
                <Select
                  value={moduleFilter}
                  onValueChange={(v) => setModuleFilter(v as ModuleFilter)}
                >
                  <SelectTrigger className="w-full md:w-44">
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="proposal">Cotações</SelectItem>
                    <SelectItem value="order">Pedidos</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="w-full space-y-2 md:w-44">
                <Label>Período</Label>
                <Select
                  value={periodFilter}
                  onValueChange={(v) => setPeriodFilter(v as PeriodFilter)}
                >
                  <SelectTrigger className="w-full md:w-44">
                    <SelectValue placeholder="Período" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="today">Hoje</SelectItem>
                    <SelectItem value="7">Últimos 7 dias</SelectItem>
                    <SelectItem value="30">Últimos 30 dias</SelectItem>
                    <SelectItem value="90">Últimos 90 dias</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span className="text-sm text-muted-foreground">
                {totalFiltered} resultado{totalFiltered === 1 ? "" : "s"}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 text-primary"
                disabled={!hasActiveFilters}
                onClick={clearFilters}
              >
                Limpar filtros
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="overflow-hidden rounded-xl border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-12">#</TableHead>
                    <TableHead className="w-14" />
                    <TableHead>Descrição</TableHead>
                    <TableHead className="w-28">Módulo</TableHead>
                    <TableHead className="w-40 text-right">Data/Hora</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <div className="h-4 w-6 animate-pulse rounded bg-muted" />
                      </TableCell>
                      <TableCell>
                        <div className="h-5 w-5 animate-pulse rounded bg-muted" />
                      </TableCell>
                      <TableCell>
                        <div className="h-4 max-w-md animate-pulse rounded bg-muted" />
                      </TableCell>
                      <TableCell>
                        <div className="h-5 w-16 animate-pulse rounded bg-muted" />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="ml-auto h-4 w-32 animate-pulse rounded bg-muted" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : totalFiltered === 0 ? (
            <p className="rounded-xl border border-border bg-card py-12 text-center text-sm text-muted-foreground">
              Nenhuma atividade encontrada
            </p>
          ) : (
            <>
              <div className="overflow-hidden rounded-xl border border-border">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-12">#</TableHead>
                      <TableHead className="w-14"> </TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="w-32">Módulo</TableHead>
                      <TableHead className="w-44 text-right">Data/Hora</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pageSlice.map((item, idx) => {
                      const Icon = item.icon
                      const rowNum = (safePage - 1) * PAGE_SIZE + idx + 1
                      const description =
                        item.type === "proposal" ? `${item.label} — ${item.code}` : item.label
                      return (
                        <TableRow
                          key={item.id}
                          className="border-b border-border last:border-0 hover:bg-muted/20"
                        >
                          <TableCell className="text-sm text-muted-foreground">{rowNum}</TableCell>
                          <TableCell>
                            <Icon className={`h-5 w-5 shrink-0 ${item.iconClass}`} />
                          </TableCell>
                          <TableCell className="text-sm text-foreground">{description}</TableCell>
                          <TableCell>
                            {item.type === "proposal" ? (
                              <Badge
                                variant="outline"
                                className="border-blue-500/60 text-blue-700 dark:text-blue-400"
                              >
                                Cotação
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="border-violet-500/60 text-violet-700 dark:text-violet-400"
                              >
                                Pedido
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right text-sm text-muted-foreground tabular-nums">
                            {formatDateTimeBR(item.updated_at, true)}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  Página {safePage} de {totalPages} · {totalFiltered} resultado
                  {totalFiltered === 1 ? "" : "s"}
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={safePage <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    ← Anterior
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={safePage >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Próximo →
                  </Button>
                </div>
              </div>
            </>
          )}
        </>
      ) : null}
    </div>
  )
}
