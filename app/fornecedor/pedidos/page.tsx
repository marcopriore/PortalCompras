"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import {
  CheckCircle,
  Clock,
  Package,
  Search,
  X,
  XCircle,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useUser } from "@/lib/hooks/useUser"
import { useAutoRefresh } from "@/lib/hooks/use-auto-refresh"
import { LastUpdated } from "@/components/ui/last-updated"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  getPOStatusForSupplier,
  poStatusBadgeClass,
} from "@/lib/po-status"

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
})

type CompanyEmbed = { name: string } | { name: string }[] | null

type PurchaseOrderRow = {
  id: string
  code: string
  quotation_code: string | null
  supplier_name: string
  status: string
  total_price: number | null
  payment_condition: string | null
  estimated_delivery_date: string | null
  accepted_at: string | null
  created_at: string
  accepted_by_supplier: boolean | null
  company_id: string
  companies: CompanyEmbed
}

function companyName(embed: CompanyEmbed): string {
  if (!embed) return "—"
  if (Array.isArray(embed)) return embed[0]?.name ?? "—"
  return embed.name ?? "—"
}

function getPeriodStartDays(period: string): string | null {
  if (period === "all") return null
  const days = parseInt(period, 10)
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString()
}

const PAGE_SIZE = 10

export default function FornecedorPedidosPage() {
  const router = useRouter()
  const { supplierId, loading: userLoading } = useUser()

  const [rows, setRows] = React.useState<PurchaseOrderRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState(false)

  const [search, setSearch] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState<string>("all")
  const [period, setPeriod] = React.useState<string>("all")
  const [page, setPage] = React.useState(1)
  const searchInputRef = React.useRef<HTMLDivElement>(null)
  const [lastUpdated, setLastUpdated] = React.useState<Date | null>(null)
  const [isRefreshing, setIsRefreshing] = React.useState(false)

  const loadPedidos = React.useCallback(
    async (silent = false) => {
      if (userLoading) return
      if (!supplierId) {
        setRows([])
        setLoading(false)
        return
      }

      if (!silent) {
        setLoading(true)
      }
      setError(false)
      const supabase = createClient()
      try {
        const { data, error: qErr } = await supabase
          .from("purchase_orders")
          .select(
            `
            id, code, quotation_code, supplier_name, status,
            total_price, payment_condition, estimated_delivery_date,
            accepted_at, created_at, accepted_by_supplier,
            company_id, companies(name)
          `,
          )
          .eq("supplier_id", supplierId)
          .neq("status", "draft")
          .order("created_at", { ascending: false })

        if (qErr) throw qErr
        setRows((data as PurchaseOrderRow[]) ?? [])
        setLastUpdated(new Date())
      } catch (e) {
        console.error(e)
        setError(true)
        setRows([])
      } finally {
        if (!silent) setLoading(false)
      }
    },
    [supplierId, userLoading],
  )

  React.useEffect(() => {
    void loadPedidos(false)
  }, [loadPedidos])

  const refresh = React.useCallback(async () => {
    setIsRefreshing(true)
    try {
      await loadPedidos(true)
    } finally {
      setIsRefreshing(false)
    }
  }, [loadPedidos])

  useAutoRefresh({ intervalMs: 30_000, onRefresh: refresh, enabled: Boolean(supplierId) && !userLoading })

  const metrics = React.useMemo(() => {
    return {
      pending: rows.filter((r) => r.status === "sent").length,
      accepted: rows.filter((r) => r.status === "processing").length,
      done: rows.filter((r) => r.status === "completed").length,
      cancelled: rows.filter((r) => r.status === "cancelled" || r.status === "refused").length,
    }
  }, [rows])

  const filtered = React.useMemo(() => {
    const term = search.trim().toLowerCase()
    const start = getPeriodStartDays(period)
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false
      if (start && r.created_at < start) return false
      if (!term) return true
      const code = (r.code ?? "").toLowerCase()
      const qc = (r.quotation_code ?? "").toLowerCase()
      return code.includes(term) || qc.includes(term)
    })
  }, [rows, search, statusFilter, period])

  React.useEffect(() => {
    setPage(1)
  }, [search, statusFilter, period, rows.length])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageClamped = Math.min(page, totalPages)
  const sliceStart = (pageClamped - 1) * PAGE_SIZE
  const pageRows = filtered.slice(sliceStart, sliceStart + PAGE_SIZE)

  const filtersActive =
    search.trim() !== "" || statusFilter !== "all" || period !== "all"

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Pedidos de Compra
            </h1>
            <LastUpdated timestamp={lastUpdated} isRefreshing={isRefreshing} />
          </div>
          <p className="text-muted-foreground">
            Acompanhe e responda aos pedidos recebidos dos seus clientes
          </p>
        </div>
      </div>

      {!userLoading && !supplierId ? (
        <p className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          Seu usuário não está vinculado a um fornecedor.
        </p>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Não foi possível carregar os pedidos. Tente novamente.
        </div>
      ) : null}

      <div
        className="grid w-full grid-cols-2 gap-4 lg:grid-cols-4 mb-2"
        style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}
      >
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[100px] animate-pulse rounded-xl bg-muted" />
          ))
        ) : (
          <>
            <div className="min-w-0 bg-white border border-amber-100 rounded-xl p-5 flex items-center justify-between">
              <div>
                <p className="text-sm text-amber-600 font-medium">Pendente Aceite</p>
                <p className="text-3xl font-bold text-amber-700 mt-1">{metrics.pending}</p>
              </div>
              <div className="bg-amber-100 p-3 rounded-full shrink-0">
                <Clock className="w-6 h-6 text-amber-600" />
              </div>
            </div>
            <div className="min-w-0 bg-white border border-blue-100 rounded-xl p-5 flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600 font-medium">Aceitos</p>
                <p className="text-3xl font-bold text-blue-700 mt-1">{metrics.accepted}</p>
              </div>
              <div className="bg-blue-100 p-3 rounded-full shrink-0">
                <CheckCircle className="w-6 h-6 text-blue-600" />
              </div>
            </div>
            <div className="min-w-0 bg-white border border-green-100 rounded-xl p-5 flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600 font-medium">Finalizados</p>
                <p className="text-3xl font-bold text-green-700 mt-1">{metrics.done}</p>
              </div>
              <div className="bg-green-100 p-3 rounded-full shrink-0">
                <Package className="w-6 h-6 text-green-600" />
              </div>
            </div>
            <div className="min-w-0 bg-white border border-red-100 rounded-xl p-5 flex items-center justify-between">
              <div>
                <p className="text-sm text-red-600 font-medium">Cancelado / Recusado</p>
                <p className="text-3xl font-bold text-red-700 mt-1">{metrics.cancelled}</p>
              </div>
              <div className="bg-red-100 p-3 rounded-full shrink-0">
                <XCircle className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </>
        )}
      </div>

      <div className="bg-muted/40 border border-border rounded-xl p-4 mb-6">
        <p className="text-sm font-medium text-muted-foreground mb-3">Filtros</p>
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1.5 w-full sm:w-48 md:max-w-xs md:flex-1">
            <Label htmlFor="po-search">Buscar</Label>
            <div ref={searchInputRef} className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="po-search"
                placeholder="Código do pedido ou cotação"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-8 w-full md:max-w-xs"
              />
              {search ? (
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0 border-0 bg-transparent"
                  aria-label="Limpar"
                  onClick={() => {
                    setSearch("")
                    ;(
                      searchInputRef.current?.querySelector("input") as HTMLInputElement
                    )?.focus()
                  }}
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          </div>
          <div className="flex flex-col gap-1.5 w-44">
            <Label>Status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="sent">Pendente Aceite</SelectItem>
                <SelectItem value="processing">Aceito</SelectItem>
                <SelectItem value="completed">Finalizado</SelectItem>
                <SelectItem value="refused">Pedido Recusado</SelectItem>
                <SelectItem value="cancelled">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5 w-44">
            <Label>Período</Label>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="30">Últimos 30 dias</SelectItem>
                <SelectItem value="90">Últimos 90 dias</SelectItem>
                <SelectItem value="365">Último ano</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="ml-auto flex items-center gap-3 text-sm text-muted-foreground">
            <span>
              {filtered.length === 1 ? "1 resultado" : `${filtered.length} resultados`}
            </span>
            {filtersActive ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch("")
                  setStatusFilter("all")
                  setPeriod("all")
                }}
              >
                Limpar filtros
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded bg-muted" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            Nenhum pedido encontrado
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>Pedido</TableHead>
                    <TableHead>Cotação</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-right">Valor Total</TableHead>
                    <TableHead>Cond. Pgto</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageRows.map((r, idx) => {
                    const meta = getPOStatusForSupplier(r.status)
                    const created = r.created_at
                      ? format(new Date(r.created_at), "dd/MM/yyyy", { locale: ptBR })
                      : "—"
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="text-muted-foreground text-sm">
                          {sliceStart + idx + 1}
                        </TableCell>
                        <TableCell className="font-semibold">{r.code}</TableCell>
                        <TableCell className="text-sm">
                          {r.quotation_code ?? "—"}
                        </TableCell>
                        <TableCell className="text-sm max-w-[180px] truncate">
                          {companyName(r.companies)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-medium">
                          {money.format(r.total_price ?? 0)}
                        </TableCell>
                        <TableCell className="text-sm max-w-[140px] truncate">
                          {r.payment_condition ?? "—"}
                        </TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${poStatusBadgeClass(meta.color)}`}
                          >
                            {meta.label}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm whitespace-nowrap">{created}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => router.push(`/fornecedor/pedidos/${r.id}`)}
                          >
                            Ver Detalhes
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
            {totalPages > 1 ? (
              <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm text-muted-foreground">
                <span>
                  Página {pageClamped} de {totalPages}
                </span>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={pageClamped <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Anterior
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={pageClamped >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Próxima
                  </Button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}
