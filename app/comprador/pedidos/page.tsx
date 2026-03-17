"use client"

import { useState } from "react"
import { DataTable } from "@/components/data-table/data-table"
import { StatusBadge } from "@/components/ui/status-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Search, Filter, MoreHorizontal, Eye, FileText, Truck, Package, Clock, CheckCircle2, AlertCircle } from "lucide-react"

const pedidosData = [
  {
    id: "PO-2024-001",
    fornecedor: "Tech Solutions Ltda",
    dataEmissao: "2024-01-15",
    valorTotal: 45780.00,
    status: "entregue",
    prazoEntrega: "2024-01-25",
    itens: 12,
  },
  {
    id: "PO-2024-002",
    fornecedor: "Industrial Parts S.A.",
    dataEmissao: "2024-01-18",
    valorTotal: 89200.00,
    status: "em_transito",
    prazoEntrega: "2024-02-01",
    itens: 8,
  },
  {
    id: "PO-2024-003",
    fornecedor: "Office Supplies Co.",
    dataEmissao: "2024-01-20",
    valorTotal: 12500.00,
    status: "confirmado",
    prazoEntrega: "2024-02-05",
    itens: 25,
  },
  {
    id: "PO-2024-004",
    fornecedor: "Global Materials Inc.",
    dataEmissao: "2024-01-22",
    valorTotal: 156000.00,
    status: "pendente",
    prazoEntrega: "2024-02-10",
    itens: 5,
  },
  {
    id: "PO-2024-005",
    fornecedor: "Safety Equipment Ltd",
    dataEmissao: "2024-01-23",
    valorTotal: 34800.00,
    status: "em_transito",
    prazoEntrega: "2024-02-03",
    itens: 15,
  },
  {
    id: "PO-2024-006",
    fornecedor: "Chemical Solutions",
    dataEmissao: "2024-01-25",
    valorTotal: 67900.00,
    status: "parcial",
    prazoEntrega: "2024-02-08",
    itens: 10,
  },
]

const statusConfig = {
  pendente: { label: "Pendente", variant: "warning" as const },
  confirmado: { label: "Confirmado", variant: "info" as const },
  em_transito: { label: "Em Trânsito", variant: "info" as const },
  parcial: { label: "Entrega Parcial", variant: "warning" as const },
  entregue: { label: "Entregue", variant: "success" as const },
  cancelado: { label: "Cancelado", variant: "destructive" as const },
}

type Pedido = typeof pedidosData[0]

const columns = [
  {
    key: "id",
    header: "Nº Pedido",
    cell: (item: Pedido) => (
      <span className="font-medium text-primary">{item.id}</span>
    ),
  },
  {
    key: "fornecedor",
    header: "Fornecedor",
  },
  {
    key: "dataEmissao",
    header: "Data Emissão",
    cell: (item: Pedido) => (
      <span>{new Date(item.dataEmissao).toLocaleDateString("pt-BR")}</span>
    ),
  },
  {
    key: "itens",
    header: "Itens",
    cell: (item: Pedido) => (
      <span className="text-muted-foreground">{item.itens} itens</span>
    ),
  },
  {
    key: "valorTotal",
    header: "Valor Total",
    cell: (item: Pedido) => (
      <span className="font-semibold">
        {item.valorTotal.toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
        })}
      </span>
    ),
  },
  {
    key: "prazoEntrega",
    header: "Prazo Entrega",
    cell: (item: Pedido) => (
      <span>{new Date(item.prazoEntrega).toLocaleDateString("pt-BR")}</span>
    ),
  },
  {
    key: "status",
    header: "Status",
    cell: (item: Pedido) => {
      const config = statusConfig[item.status as keyof typeof statusConfig]
      return <StatusBadge variant={config.variant}>{config.label}</StatusBadge>
    },
  },
]

const renderActions = (item: Pedido) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" size="icon" className="h-8 w-8">
        <MoreHorizontal className="h-4 w-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuItem>
        <Eye className="mr-2 h-4 w-4" />
        Ver Detalhes
      </DropdownMenuItem>
      <DropdownMenuItem>
        <FileText className="mr-2 h-4 w-4" />
        Gerar PDF
      </DropdownMenuItem>
      <DropdownMenuItem>
        <Truck className="mr-2 h-4 w-4" />
        Rastrear Entrega
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
)

export default function PedidosPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("todos")

  const filteredData = pedidosData.filter((pedido) => {
    const matchesSearch =
      pedido.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pedido.fornecedor.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === "todos" || pedido.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const metrics = {
    total: pedidosData.length,
    pendentes: pedidosData.filter((p) => p.status === "pendente").length,
    emTransito: pedidosData.filter((p) => p.status === "em_transito").length,
    entregues: pedidosData.filter((p) => p.status === "entregue").length,
  }

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
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pendentes
            </CardTitle>
            <Clock className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">{metrics.pendentes}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Em Trânsito
            </CardTitle>
            <Truck className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{metrics.emTransito}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Entregues
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{metrics.entregues}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Lista de Pedidos</CardTitle>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar pedido..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 w-full sm:w-64"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-40">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="confirmado">Confirmado</SelectItem>
                  <SelectItem value="em_transito">Em Trânsito</SelectItem>
                  <SelectItem value="parcial">Entrega Parcial</SelectItem>
                  <SelectItem value="entregue">Entregue</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable columns={columns} data={filteredData} actions={renderActions} />
        </CardContent>
      </Card>
    </div>
  )
}
