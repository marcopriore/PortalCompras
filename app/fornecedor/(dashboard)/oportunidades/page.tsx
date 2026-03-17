"use client"

import Link from "next/link"
import { Eye, Send, MoreHorizontal, Calendar, Building2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { DataTable, Column } from "@/components/data-table/data-table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface Opportunity {
  id: string
  titulo: string
  comprador: string
  categoria: string
  status: "nova" | "visualizada" | "proposta_enviada" | "expirada"
  dataLimite: string
  valorEstimado: number
  itens: number
}

const statusConfig = {
  nova: { label: "Nova", variant: "default" as const },
  visualizada: { label: "Visualizada", variant: "secondary" as const },
  proposta_enviada: { label: "Proposta Enviada", variant: "outline" as const },
  expirada: { label: "Expirada", variant: "destructive" as const },
}

const mockOpportunities: Opportunity[] = [
  { id: "COT-001", titulo: "Material de escritório 2026", comprador: "Empresa ABC", categoria: "Suprimentos", status: "nova", dataLimite: "20/03/2026", valorEstimado: 15000, itens: 12 },
  { id: "COT-002", titulo: "Equipamentos de TI", comprador: "Corp XYZ", categoria: "Tecnologia", status: "proposta_enviada", dataLimite: "18/03/2026", valorEstimado: 120000, itens: 8 },
  { id: "COT-003", titulo: "Serviços de limpeza anual", comprador: "Tech Inc", categoria: "Serviços", status: "visualizada", dataLimite: "25/03/2026", valorEstimado: 85000, itens: 3 },
  { id: "COT-006", titulo: "Manutenção predial", comprador: "Indústria Beta", categoria: "Serviços", status: "nova", dataLimite: "22/03/2026", valorEstimado: 95000, itens: 15 },
  { id: "COT-008", titulo: "Frota de veículos", comprador: "Transportes Alpha", categoria: "Transporte", status: "visualizada", dataLimite: "15/03/2026", valorEstimado: 350000, itens: 5 },
  { id: "COT-010", titulo: "Uniformes corporativos", comprador: "Empresa ABC", categoria: "Vestuário", status: "expirada", dataLimite: "01/03/2026", valorEstimado: 28000, itens: 6 },
]

export default function OportunidadesPage() {
  const columns: Column<Opportunity>[] = [
    { key: "id", header: "ID", className: "font-medium" },
    { key: "titulo", header: "Título" },
    {
      key: "comprador",
      header: "Comprador",
      cell: (item) => (
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          {item.comprador}
        </div>
      ),
    },
    { key: "categoria", header: "Categoria" },
    {
      key: "status",
      header: "Status",
      cell: (item) => (
        <Badge variant={statusConfig[item.status].variant}>
          {statusConfig[item.status].label}
        </Badge>
      ),
    },
    {
      key: "dataLimite",
      header: "Prazo",
      cell: (item) => (
        <div className="flex items-center gap-1 text-muted-foreground">
          <Calendar className="h-4 w-4" />
          {item.dataLimite}
        </div>
      ),
    },
    {
      key: "valorEstimado",
      header: "Valor Est.",
      cell: (item) => `R$ ${item.valorEstimado.toLocaleString("pt-BR")}`,
      className: "text-right",
    },
  ]

  const filterOptions = [
    { label: "Nova", value: "nova" },
    { label: "Visualizada", value: "visualizada" },
    { label: "Proposta Enviada", value: "proposta_enviada" },
    { label: "Expirada", value: "expirada" },
  ]

  const actions = (item: Opportunity) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href={`/fornecedor/oportunidades/${item.id}`}>
            <Eye className="mr-2 h-4 w-4" />
            Ver Detalhes
          </Link>
        </DropdownMenuItem>
        {item.status !== "expirada" && item.status !== "proposta_enviada" && (
          <DropdownMenuItem asChild>
            <Link href={`/fornecedor/oportunidades/${item.id}/proposta`}>
              <Send className="mr-2 h-4 w-4" />
              Enviar Proposta
            </Link>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Oportunidades</h1>
        <p className="text-muted-foreground">
          Cotações disponíveis para sua empresa
        </p>
      </div>

      <DataTable
        data={mockOpportunities}
        columns={columns}
        searchPlaceholder="Buscar oportunidades..."
        searchKey="titulo"
        filterOptions={filterOptions}
        filterKey="status"
        actions={actions}
      />
    </div>
  )
}
