"use client"

import { useState } from "react"
import Link from "next/link"
import { Plus, Eye, Users, BarChart2, MoreHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { DataTable, Column } from "@/components/data-table/data-table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { QuotationForm } from "@/components/forms/quotation-form"

interface Quotation {
  id: string
  titulo: string
  categoria: string
  status: "rascunho" | "aberta" | "em_analise" | "encerrada" | "cancelada"
  dataLimite: string
  numPropostas: number
  valorEstimado: number
  dataCriacao: string
}

const statusConfig = {
  rascunho: { label: "Rascunho", variant: "outline" as const },
  aberta: { label: "Aberta", variant: "default" as const },
  em_analise: { label: "Em Análise", variant: "secondary" as const },
  encerrada: { label: "Encerrada", variant: "outline" as const },
  cancelada: { label: "Cancelada", variant: "destructive" as const },
}

const mockQuotations: Quotation[] = [
  { id: "COT-001", titulo: "Material de escritório 2026", categoria: "Suprimentos", status: "aberta", dataLimite: "20/03/2026", numPropostas: 5, valorEstimado: 15000, dataCriacao: "13/03/2026" },
  { id: "COT-002", titulo: "Equipamentos de TI", categoria: "Tecnologia", status: "em_analise", dataLimite: "18/03/2026", numPropostas: 8, valorEstimado: 120000, dataCriacao: "10/03/2026" },
  { id: "COT-003", titulo: "Serviços de limpeza anual", categoria: "Serviços", status: "aberta", dataLimite: "25/03/2026", numPropostas: 3, valorEstimado: 85000, dataCriacao: "08/03/2026" },
  { id: "COT-004", titulo: "Móveis corporativos", categoria: "Mobiliário", status: "encerrada", dataLimite: "05/03/2026", numPropostas: 6, valorEstimado: 45000, dataCriacao: "01/03/2026" },
  { id: "COT-005", titulo: "Uniformes funcionários", categoria: "Vestuário", status: "rascunho", dataLimite: "-", numPropostas: 0, valorEstimado: 28000, dataCriacao: "12/03/2026" },
  { id: "COT-006", titulo: "Manutenção predial", categoria: "Serviços", status: "aberta", dataLimite: "22/03/2026", numPropostas: 4, valorEstimado: 95000, dataCriacao: "07/03/2026" },
  { id: "COT-007", titulo: "Licenças Microsoft 365", categoria: "Software", status: "cancelada", dataLimite: "10/03/2026", numPropostas: 2, valorEstimado: 65000, dataCriacao: "28/02/2026" },
  { id: "COT-008", titulo: "Frota de veículos", categoria: "Transporte", status: "em_analise", dataLimite: "15/03/2026", numPropostas: 7, valorEstimado: 350000, dataCriacao: "25/02/2026" },
]

export default function CotacoesPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const columns: Column<Quotation>[] = [
    { key: "id", header: "ID", className: "font-medium" },
    { key: "titulo", header: "Título" },
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
    { key: "dataLimite", header: "Data Limite" },
    {
      key: "numPropostas",
      header: "Propostas",
      cell: (item) => (
        <span className="inline-flex items-center gap-1">
          <Users className="h-4 w-4 text-muted-foreground" />
          {item.numPropostas}
        </span>
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
    { label: "Rascunho", value: "rascunho" },
    { label: "Aberta", value: "aberta" },
    { label: "Em Análise", value: "em_analise" },
    { label: "Encerrada", value: "encerrada" },
    { label: "Cancelada", value: "cancelada" },
  ]

  const actions = (item: Quotation) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href={`/comprador/cotacoes/${item.id}`}>
            <Eye className="mr-2 h-4 w-4" />
            Ver Detalhes
          </Link>
        </DropdownMenuItem>
        {item.status === "aberta" && (
          <DropdownMenuItem>
            <Users className="mr-2 h-4 w-4" />
            Convidar Fornecedores
          </DropdownMenuItem>
        )}
        {(item.status === "aberta" || item.status === "em_analise") && item.numPropostas > 0 && (
          <DropdownMenuItem asChild>
            <Link href={`/comprador/cotacoes/${item.id}/equalizacao`}>
              <BarChart2 className="mr-2 h-4 w-4" />
              Equalizar Propostas
            </Link>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Cotações (RFQ)</h1>
          <p className="text-muted-foreground">
            Gerencie suas solicitações de cotação
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nova Cotação
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Nova Cotação (RFQ)</DialogTitle>
              <DialogDescription>
                Crie uma nova solicitação de cotação para fornecedores
              </DialogDescription>
            </DialogHeader>
            <QuotationForm onSuccess={() => setIsDialogOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <DataTable
        data={mockQuotations}
        columns={columns}
        searchPlaceholder="Buscar cotações..."
        searchKey="titulo"
        filterOptions={filterOptions}
        filterKey="status"
        actions={actions}
      />
    </div>
  )
}
