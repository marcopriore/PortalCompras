"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { createClient } from "@/lib/supabase/client"
import { useUser } from "@/lib/hooks/useUser"
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
  Send,
  CheckCircle2,
  Search,
  Eye,
  X,
} from "lucide-react"

type PurchaseOrderStatus = "processing" | "sent" | "error" | "completed"

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
  erp_error_message: string | null
  created_at: string
  updated_at: string | null
  purchase_order_items: { id: string }[]
}

type Filters = {
  search: string
  status: string[]
  dateFrom: string
  dateTo: string
}

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
})

function getStatusMeta(status: PurchaseOrderStatus): { label: string; className: string } {
  if (status === "processing") {
    return {
      label: "Em Processamento",
      className: "bg-yellow-100 text-yellow-800",
    }
  }
  if (status === "sent") {
    return {
      label: "Enviado ao ERP",
      className: "bg-blue-100 text-blue-800",
    }
  }
  if (status === "error") {
    return {
      label: "Erro no ERP",
      className: "bg-red-100 text-red-800",
    }
  }
  return {
    label: "Concluído",
    className: "bg-green-100 text-green-800",
  }
}

export default function PedidosPage() {
  const router = useRouter()
  const { companyId } = useUser()

  const [orders, setOrders] = React.useState<PurchaseOrder[]>([])
  const [loading, setLoading] = React.useState(true)
  const [filters, setFilters] = React.useState<Filters>({
    search: "",
    status: ['processing', 'sent', 'error'],
    dateFrom: "",
    dateTo: "",
  })
  const searchInputRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!companyId) return
    const supabase = createClient()
    let alive = true

    const run = async () => {
      setLoading(true)
      const { data } = await supabase
        .from("purchase_orders")
        .select("id, code, supplier_name, supplier_cnpj, total_price, delivery_days, payment_condition, quotation_code, status, erp_error_message, created_at, updated_at, purchase_order_items(id)")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })

      if (!alive) return
      setOrders(((data as unknown) as PurchaseOrder[]) ?? [])
      setLoading(false)
    }

    run()
    return () => {
      alive = false
    }
  }, [companyId])

  const handleFilterChange =
    (field: keyof Filters) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setFilters((prev) => ({ ...prev, [field]: e.target.value }))
    }

  const clearFilters = () => {
    setFilters({
      search: "",
      status: ['processing', 'sent', 'error'],
      dateFrom: "",
      dateTo: "",
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

      return matchesSearch && matchesStatus && matchesDate
    })
  }, [orders, filters])

  const metrics = React.useMemo(() => {
    const total = orders.length
    const processing = orders.filter((o) => o.status === "processing").length
    const sent = orders.filter((o) => o.status === "sent").length
    const completed = orders.filter((o) => o.status === "completed").length
    return { total, processing, sent, completed }
  }, [orders])

  const hasActiveFilters =
    filters.search.trim() ||
    filters.status.length > 0 ||
    filters.dateFrom ||
    filters.dateTo

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Pedidos de Compra</h1>
        <p className="text-muted-foreground">
          Gerencie e acompanhe todos os pedidos de compra
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total de Pedidos
            </CardTitle>
            <ShoppingCart className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Em Processamento
            </CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.processing}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Enviados ao ERP
            </CardTitle>
            <Send className="h-4 w-4 text-indigo-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.sent}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Concluídos
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.completed}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-muted/40 border border-border rounded-xl">
        <CardHeader>
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="search">Buscar</Label>
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
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <MultiSelectFilter
                label="Status"
                options={[
                  { value: "processing", label: "Processando" },
                  { value: "sent", label: "Enviado" },
                  { value: "error", label: "Erro" },
                  { value: "completed", label: "Concluído" },
                ]}
                selected={filters.status}
                onChange={(values) => setFilters((prev) => ({ ...prev, status: values }))}
                width="w-44"
              />
            </div>
            <div className="space-y-2 md:col-span-1">
              <div className="flex gap-2">
                <div className="space-y-2 flex-1">
                  <Label htmlFor="dateFrom">Data De</Label>
                  <Input
                    id="dateFrom"
                    type="date"
                    value={filters.dateFrom}
                    onChange={handleFilterChange("dateFrom")}
                  />
                </div>
                <div className="space-y-2 flex-1">
                  <Label htmlFor="dateTo">Data Até</Label>
                  <Input
                    id="dateTo"
                    type="date"
                    value={filters.dateTo}
                    onChange={handleFilterChange("dateTo")}
                  />
                </div>
              </div>
            </div>
          </div>
          {hasActiveFilters && (
            <div className="mt-4 flex justify-end">
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Limpar filtros
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Lista de Pedidos</CardTitle>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span>
              {filteredOrders.length} resultado
              {filteredOrders.length === 1 ? "" : "s"}
            </span>
          </div>
        </CardHeader>
        <CardContent>
          {filteredOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
              <ShoppingCart className="h-10 w-10 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">Nenhum pedido encontrado.</p>
              <p className="text-xs text-muted-foreground">
                Os pedidos são criados ao finalizar uma cotação.
              </p>
            </div>
          ) : (
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
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.map((order) => {
                    const statusMeta = getStatusMeta(order.status)
                    const itemsCount = order.purchase_order_items?.length ?? 0
                    const created = order.created_at
                      ? format(new Date(order.created_at), "dd/MM/yyyy", {
                          locale: ptBR,
                        })
                      : "—"
                    const prazo =
                      order.delivery_days != null ? `${order.delivery_days} dias` : "—"

                    return (
                      <React.Fragment key={order.id}>
                        <TableRow>
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
                              className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${statusMeta.className}`}
                            >
                              {statusMeta.label}
                            </span>
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
                        {order.status === "error" && order.erp_error_message && (
                          <TableRow>
                            <TableCell colSpan={8}>
                              <div className="mt-1 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
                                {order.erp_error_message}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
