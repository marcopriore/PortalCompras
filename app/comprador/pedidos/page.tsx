"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { createClient } from "@/lib/supabase/client"
import { useUser } from "@/lib/hooks/useUser"
import { usePermissions } from "@/lib/hooks/usePermissions"
import { useAutoRefresh } from "@/lib/hooks/use-auto-refresh"
import { usePollingIntervalMs } from "@/lib/hooks/use-polling-interval"
import { formatResponsibleName } from "@/lib/quotations/ownership"
import { LastUpdated } from "@/components/ui/last-updated"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
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
  ShoppingCart,
  Clock,
  CheckCircle,
  Search,
  Eye,
  X,
  ChevronDown,
  ChevronUp,
  Download,
} from "lucide-react"
import { getPOStatusForBuyer, poStatusBadgeClass } from "@/lib/po-status"
import { TABLE_PAGE_SIZE, TablePagination } from "@/components/ui/table-pagination"

type PurchaseOrderStatus =
  | "draft"
  | "processing"
  | "sent"
  | "refused"
  | "error"
  | "integration_error"
  | "completed"
  | "cancelled"

type PurchaseOrder = {
  id: string
  code: string
  supplier_name: string
  supplier_cnpj: string | null
  total_price: number | null
  delivery_days: number | null
  payment_condition: string | null
  quotation_code: string | null
  status: PurchaseOrderStatus
  created_at: string
  updated_at: string | null
  created_by: string | null
  responsible_name?: string
  purchase_order_items: { id: string }[]
}

type Filters = {
  search: string
  status: string[]
  dateFrom: string
  dateTo: string
  responsible: string[]
}

const PAGE_SIZE = TABLE_PAGE_SIZE

const DEFAULT_STATUS: string[] = [
  "draft",
  "sent",
  "refused",
  "processing",
  "error",
  "integration_error",
  "completed",
  "cancelled",
]

const STATUS_OPTIONS = [
  { value: "draft", label: "Rascunho" },
  { value: "sent", label: "Aguardando Aceite" },
  { value: "refused", label: "Recusado pelo Fornecedor" },
  { value: "processing", label: "Processando Integração" },
  { value: "integration_error", label: "Erro de Integração" },
  { value: "error", label: "Pedido Reprovado" },
  { value: "completed", label: "Concluído" },
  { value: "cancelled", label: "Cancelado" },
]

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
})

export default function PedidosPage() {
  const router = useRouter()
  const { companyId, userId, loading: userLoading } = useUser()
  const { hasPermission, loading: permLoading } = usePermissions()
  const viewAllOrders = hasPermission("order.view_all")

  const [orders, setOrders] = React.useState<PurchaseOrder[]>([])
  const [loading, setLoading] = React.useState(true)
  const [exporting, setExporting] = React.useState(false)
  const [showAllFilters, setShowAllFilters] = React.useState(false)
  const [page, setPage] = React.useState(1)
  const [filters, setFilters] = React.useState<Filters>({
    search: "",
    status: DEFAULT_STATUS,
    dateFrom: "",
    dateTo: "",
    responsible: [],
  })
  const searchInputRef = React.useRef<HTMLDivElement>(null)
  const [lastUpdated, setLastUpdated] = React.useState<Date | null>(null)
  const [isRefreshing, setIsRefreshing] = React.useState(false)
  const companyIdRef = React.useRef(companyId)
  companyIdRef.current = companyId

  const loadOrders = React.useCallback(
    async (silent = false) => {
      if (userLoading || permLoading || !companyId) return
      const started = companyId
      const stillHere = () => companyIdRef.current === started

      if (!silent) setLoading(true)
      const supabase = createClient()
      const viewAll = hasPermission("order.view_all")
      let query = supabase
        .from("purchase_orders")
        .select(
          "id, code, supplier_name, supplier_cnpj, total_price, delivery_days, payment_condition, quotation_code, status, created_at, updated_at, created_by, purchase_order_items(id)",
        )
        .eq("company_id", companyId)
      if (!viewAll && userId) {
        query = query.eq("created_by", userId)
      }
      const { data } = await query.order("created_at", { ascending: false })

      if (!stillHere()) return

      const rows = ((data as unknown) as PurchaseOrder[]) ?? []
      const ownerIds = [
        ...new Set(rows.map((o) => o.created_by).filter((id): id is string => Boolean(id))),
      ]
      let nameById = new Map<string, string>()
      if (ownerIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", ownerIds)
        nameById = new Map(
          ((profiles ?? []) as { id: string; full_name: string | null }[]).map((p) => [
            p.id,
            p.full_name ?? "",
          ]),
        )
      }

      setOrders(
        rows.map((o) => ({
          ...o,
          responsible_name: o.created_by ? nameById.get(o.created_by) ?? "" : "",
        })),
      )
      setLastUpdated(new Date())
      if (!silent) setLoading(false)
    },
    [companyId, userId, userLoading, permLoading, hasPermission],
  )

  React.useEffect(() => {
    void loadOrders(false)
  }, [loadOrders])

  const refreshPedidos = React.useCallback(async () => {
    setIsRefreshing(true)
    try {
      await loadOrders(true)
    } finally {
      setIsRefreshing(false)
    }
  }, [loadOrders])

  const pollingIntervalMs = usePollingIntervalMs()

  useAutoRefresh({
    intervalMs: pollingIntervalMs,
    onRefresh: refreshPedidos,
    enabled: Boolean(companyId) && !userLoading,
  })

  const handleFilterChange =
    (field: keyof Filters) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setFilters((prev) => ({ ...prev, [field]: e.target.value }))
    }

  const clearFilters = () => {
    setFilters({
      search: "",
      status: DEFAULT_STATUS,
      dateFrom: "",
      dateTo: "",
      responsible: [],
    })
  }

  const filteredOrders = React.useMemo(() => {
    return orders.filter((order) => {
      const search = filters.search.trim().toLowerCase()
      const matchesSearch =
        !search ||
        order.code.toLowerCase().includes(search) ||
        order.supplier_name.toLowerCase().includes(search)

      const matchesStatus =
        filters.status.length === 0 || filters.status.includes(order.status)

      let matchesDate = true
      if (filters.dateFrom) {
        matchesDate =
          matchesDate && order.created_at >= `${filters.dateFrom}T00:00:00.000Z`
      }
      if (filters.dateTo) {
        matchesDate =
          matchesDate && order.created_at <= `${filters.dateTo}T23:59:59.999Z`
      }

      const matchesResponsible =
        filters.responsible.length === 0 ||
        (order.created_by != null && filters.responsible.includes(order.created_by))

      return matchesSearch && matchesStatus && matchesDate && matchesResponsible
    })
  }, [orders, filters])

  React.useEffect(() => {
    setPage(1)
  }, [filters])

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / PAGE_SIZE))
  const pageClamped = Math.min(page, totalPages)
  const pageRows = filteredOrders.slice(
    (pageClamped - 1) * PAGE_SIZE,
    pageClamped * PAGE_SIZE,
  )

  const metrics = React.useMemo(() => {
    const total = orders.length
    const awaitingAccept = orders.filter((o) => o.status === "sent").length
    const processingIntegration = orders.filter((o) => o.status === "processing").length
    const completed = orders.filter((o) => o.status === "completed").length
    return { total, awaitingAccept, processingIntegration, completed }
  }, [orders])

  const extraFiltersCount = [
    filters.dateFrom,
    filters.dateTo,
    filters.responsible.length > 0,
  ].filter(Boolean).length
  const filtersExpanded = showAllFilters

  const responsibleOptions = React.useMemo(() => {
    const seen = new Map<string, string>()
    orders.forEach((o) => {
      if (!o.created_by || seen.has(o.created_by)) return
      seen.set(o.created_by, formatResponsibleName(o.responsible_name))
    })
    return Array.from(seen.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"))
  }, [orders])

  const hasActiveFilters =
    filters.search.trim() ||
    filters.dateFrom ||
    filters.dateTo ||
    filters.responsible.length > 0

  const handleExport = async () => {
    setExporting(true)
    try {
      const ExcelJS = (await import("exceljs")).default
      const workbook = new ExcelJS.Workbook()
      const ws = workbook.addWorksheet("Pedidos")

      ws.columns = [
        { header: "Nº Pedido", key: "code", width: 18 },
        { header: "Fornecedor", key: "supplier", width: 32 },
        { header: "CNPJ", key: "cnpj", width: 20 },
        { header: "Data Emissão", key: "createdAt", width: 18 },
        { header: "Itens", key: "items", width: 10 },
        { header: "Valor Total", key: "total", width: 16 },
        { header: "Prazo Entrega", key: "leadTime", width: 16 },
        { header: "Status", key: "status", width: 24 },
        { header: "Responsável", key: "responsible", width: 28 },
        { header: "Cotação", key: "quotation", width: 18 },
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

      filteredOrders.forEach((order, idx) => {
        ws.addRow({
          code: order.code,
          supplier: order.supplier_name,
          cnpj: order.supplier_cnpj ?? "—",
          createdAt: order.created_at
            ? format(new Date(order.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })
            : "—",
          items: order.purchase_order_items?.length ?? 0,
          total: money.format(order.total_price ?? 0),
          leadTime: order.delivery_days != null ? `${order.delivery_days} dias` : "—",
          status: getPOStatusForBuyer(order.status).label,
          responsible: formatResponsibleName(order.responsible_name),
          quotation: order.quotation_code ?? "—",
        })

        const rowNumber = idx + 2
        const row = ws.getRow(rowNumber)
        row.height = 18
        const isEven = rowNumber % 2 === 0
        row.eachCell({ includeEmpty: true }, (cell: { fill: unknown; border: unknown }) => {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: isEven ? "FFF9F9F9" : "FFFFFFFF" },
          }
          cell.border = {
            top: { style: "thin", color: { argb: "FFDDDDDD" } },
            bottom: { style: "thin", color: { argb: "FFDDDDDD" } },
            left: { style: "thin", color: { argb: "FFDDDDDD" } },
            right: { style: "thin", color: { argb: "FFDDDDDD" } },
          }
        })
      })

      const now = new Date()
      const yyyy = String(now.getFullYear())
      const mm = String(now.getMonth() + 1).padStart(2, "0")
      const dd = String(now.getDate()).padStart(2, "0")
      const hh = String(now.getHours()).padStart(2, "0")
      const min = String(now.getMinutes()).padStart(2, "0")
      const filename = `pedidos_export_${yyyy}${mm}${dd}_${hh}${min}.xlsx`

      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  if (userLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
        Carregando...
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="text-2xl font-bold text-foreground">Pedidos de Compra</h1>
          <LastUpdated timestamp={lastUpdated} isRefreshing={isRefreshing} />
        </div>
        <p className="text-muted-foreground">
          Gerencie e acompanhe todos os pedidos de compra
        </p>
      </div>

      <div
        className="grid w-full grid-cols-4 gap-4 mb-6"
        style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}
      >
        <div className="min-w-0 bg-white border border-blue-100 rounded-xl p-5 flex items-center justify-between">
          <div>
            <p className="text-sm text-blue-600 font-medium">Total de Pedidos</p>
            <p className="text-3xl font-bold text-blue-700 mt-1">{metrics.total}</p>
          </div>
          <div className="bg-blue-100 p-3 rounded-full">
            <ShoppingCart className="w-6 h-6 text-blue-600" />
          </div>
        </div>
        <div className="min-w-0 bg-white border border-amber-100 rounded-xl p-5 flex items-center justify-between">
          <div>
            <p className="text-sm text-amber-600 font-medium">Aguardando Aceite</p>
            <p className="text-3xl font-bold text-amber-700 mt-1">{metrics.awaitingAccept}</p>
          </div>
          <div className="bg-amber-100 p-3 rounded-full">
            <Clock className="w-6 h-6 text-amber-600" />
          </div>
        </div>
        <div className="min-w-0 bg-white border border-blue-100 rounded-xl p-5 flex items-center justify-between">
          <div>
            <p className="text-sm text-blue-600 font-medium">Processando Integração</p>
            <p className="text-3xl font-bold text-blue-700 mt-1">
              {metrics.processingIntegration}
            </p>
          </div>
          <div className="bg-blue-100 p-3 rounded-full">
            <CheckCircle className="w-6 h-6 text-blue-600" />
          </div>
        </div>
        <div className="min-w-0 bg-white border border-green-100 rounded-xl p-5 flex items-center justify-between">
          <div>
            <p className="text-sm text-green-600 font-medium">Concluídos</p>
            <p className="text-3xl font-bold text-green-700 mt-1">{metrics.completed}</p>
          </div>
          <div className="bg-green-100 p-3 rounded-full">
            <CheckCircle className="w-6 h-6 text-green-600" />
          </div>
        </div>
      </div>

      <div className="bg-muted/40 border border-border rounded-xl p-4 mb-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-muted-foreground">Filtros</p>
          <button
            type="button"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            onClick={() => setShowAllFilters((open) => !open)}
          >
            {filtersExpanded
              ? "Ocultar filtros"
              : extraFiltersCount > 0
                ? `Mais filtros (${extraFiltersCount})`
                : "Mais filtros"}
            {filtersExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
        </div>
        <div className="flex flex-wrap gap-2 items-end">
          <div className="flex flex-col flex-1 min-w-[200px] max-w-[360px]">
            <Label htmlFor="search" className="text-xs font-medium text-muted-foreground mb-1">
              Buscar
            </Label>
            <div ref={searchInputRef} className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="search"
                placeholder="Buscar por nº do pedido ou fornecedor"
                value={filters.search}
                onChange={handleFilterChange("search")}
                className="pl-9 pr-8"
              />
              {filters.search.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setFilters((prev) => ({ ...prev, search: "" }))
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
            <p className="text-xs font-medium text-muted-foreground mb-1">Status</p>
            <MultiSelectFilter
              label="Status"
              options={STATUS_OPTIONS}
              selected={filters.status}
              onChange={(values) => setFilters((prev) => ({ ...prev, status: values }))}
              width="w-44"
            />
          </div>

          {filtersExpanded && (
            <>
              <div className="flex flex-col w-[140px]">
                <Label htmlFor="dateFrom" className="text-xs font-medium text-muted-foreground mb-1">
                  De
                </Label>
                <Input
                  id="dateFrom"
                  type="date"
                  value={filters.dateFrom}
                  onChange={handleFilterChange("dateFrom")}
                />
              </div>
              <div className="flex flex-col w-[140px]">
                <Label htmlFor="dateTo" className="text-xs font-medium text-muted-foreground mb-1">
                  Até
                </Label>
                <Input
                  id="dateTo"
                  type="date"
                  value={filters.dateTo}
                  onChange={handleFilterChange("dateTo")}
                />
              </div>
              {viewAllOrders && (
                <div className="flex flex-col">
                  <p className="text-xs font-medium text-muted-foreground mb-1">
                    Responsável
                  </p>
                  <MultiSelectFilter
                    label="Responsável"
                    options={responsibleOptions}
                    selected={filters.responsible}
                    onChange={(values) =>
                      setFilters((prev) => ({ ...prev, responsible: values }))
                    }
                    width="w-52"
                  />
                </div>
              )}
            </>
          )}

          {hasActiveFilters && (
            <div className="flex flex-col">
              <span className="text-xs font-medium text-muted-foreground mb-1 block">
                &nbsp;
              </span>
              <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
                Limpar Filtros
              </Button>
            </div>
          )}
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Lista de Pedidos</CardTitle>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span>
              {filteredOrders.length} resultado
              {filteredOrders.length === 1 ? "" : "s"}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void handleExport()}
              disabled={exporting || filteredOrders.length === 0}
              className="gap-1.5"
            >
              <Download className="h-4 w-4" />
              {exporting ? "Exportando..." : "Exportar Excel"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground py-10 text-center">
              Carregando pedidos...
            </p>
          ) : filteredOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
              <ShoppingCart className="h-10 w-10 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">Nenhum pedido encontrado.</p>
              <p className="text-xs text-muted-foreground">
                Os pedidos são criados ao finalizar uma cotação.
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nº Pedido</TableHead>
                      <TableHead>Fornecedor</TableHead>
                      <TableHead>Data Emissão</TableHead>
                      <TableHead>Itens</TableHead>
                      <TableHead>Valor Total</TableHead>
                      <TableHead>Prazo Entrega</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Responsável</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pageRows.map((order) => {
                      const statusMeta = getPOStatusForBuyer(order.status)
                      const itemsCount = order.purchase_order_items?.length ?? 0
                      const created = order.created_at
                        ? format(new Date(order.created_at), "dd/MM/yyyy", {
                            locale: ptBR,
                          })
                        : "—"
                      const prazo =
                        order.delivery_days != null ? `${order.delivery_days} dias` : "—"

                      return (
                        <TableRow key={order.id}>
                          <TableCell>
                            <button
                              type="button"
                              className="font-mono text-sm text-primary underline-offset-2 hover:underline"
                              onClick={() =>
                                router.push(`/comprador/pedidos/${order.id}`)
                              }
                            >
                              {order.code}
                            </button>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium">{order.supplier_name}</span>
                              <span className="text-xs text-muted-foreground">
                                {order.supplier_cnpj ?? "—"}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>{created}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {itemsCount} itens
                          </TableCell>
                          <TableCell className="font-semibold">
                            {money.format(order.total_price ?? 0)}
                          </TableCell>
                          <TableCell>{prazo}</TableCell>
                          <TableCell>
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${poStatusBadgeClass(statusMeta.color)}`}
                            >
                              {statusMeta.label}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm">
                            {formatResponsibleName(order.responsible_name)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                router.push(`/comprador/pedidos/${order.id}`)
                              }
                            >
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
              <TablePagination
                page={pageClamped}
                total={filteredOrders.length}
                pageSize={PAGE_SIZE}
                onPageChange={setPage}
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
