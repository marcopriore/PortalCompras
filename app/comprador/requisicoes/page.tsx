"use client"

import { useState } from "react"
import { Plus, Eye, Edit, MoreHorizontal, CheckCircle, XCircle } from "lucide-react"
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
import { RequisitionForm } from "@/components/forms/requisition-form"

interface Requisition {
  id: string
  titulo: string
  solicitante: string
  departamento: string
  status: "pendente" | "aprovado" | "rejeitado" | "em_andamento"
  valor: number
  dataCriacao: string
  prioridade: "baixa" | "media" | "alta"
}

const statusConfig = {
  pendente: { label: "Pendente", variant: "outline" as const },
  aprovado: { label: "Aprovado", variant: "default" as const },
  rejeitado: { label: "Rejeitado", variant: "destructive" as const },
  em_andamento: { label: "Em Andamento", variant: "secondary" as const },
}

const prioridadeConfig = {
  baixa: { label: "Baixa", className: "bg-muted text-muted-foreground" },
  media: { label: "Média", className: "bg-warning/15 text-warning-foreground" },
  alta: { label: "Alta", className: "bg-destructive/15 text-destructive" },
}

const mockRequisitions: Requisition[] = [
  { id: "REQ-001", titulo: "Computadores para TI", solicitante: "Ana Costa", departamento: "Tecnologia", status: "pendente", valor: 45000, dataCriacao: "13/03/2026", prioridade: "alta" },
  { id: "REQ-002", titulo: "Material de escritório", solicitante: "Carlos Lima", departamento: "Administrativo", status: "aprovado", valor: 2500, dataCriacao: "12/03/2026", prioridade: "baixa" },
  { id: "REQ-003", titulo: "Móveis para sala de reunião", solicitante: "Maria Santos", departamento: "Facilities", status: "em_andamento", valor: 18000, dataCriacao: "11/03/2026", prioridade: "media" },
  { id: "REQ-004", titulo: "Licenças de software", solicitante: "Pedro Oliveira", departamento: "Tecnologia", status: "aprovado", valor: 32000, dataCriacao: "10/03/2026", prioridade: "alta" },
  { id: "REQ-005", titulo: "Equipamentos de segurança", solicitante: "Fernanda Rocha", departamento: "Segurança", status: "rejeitado", valor: 8500, dataCriacao: "09/03/2026", prioridade: "media" },
  { id: "REQ-006", titulo: "Uniformes funcionários", solicitante: "José Silva", departamento: "RH", status: "pendente", valor: 12000, dataCriacao: "08/03/2026", prioridade: "baixa" },
  { id: "REQ-007", titulo: "Ferramentas de manutenção", solicitante: "Roberto Alves", departamento: "Manutenção", status: "aprovado", valor: 5600, dataCriacao: "07/03/2026", prioridade: "media" },
  { id: "REQ-008", titulo: "Ar condicionado", solicitante: "Lucia Mendes", departamento: "Facilities", status: "pendente", valor: 28000, dataCriacao: "06/03/2026", prioridade: "alta" },
]

export default function RequisicoesPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const columns: Column<Requisition>[] = [
    { key: "id", header: "ID", className: "font-medium" },
    { key: "titulo", header: "Título" },
    { key: "solicitante", header: "Solicitante" },
    { key: "departamento", header: "Departamento" },
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
      key: "prioridade",
      header: "Prioridade",
      cell: (item) => (
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${prioridadeConfig[item.prioridade].className}`}>
          {prioridadeConfig[item.prioridade].label}
        </span>
      ),
    },
    {
      key: "valor",
      header: "Valor",
      cell: (item) => `R$ ${item.valor.toLocaleString("pt-BR")}`,
      className: "text-right",
    },
    { key: "dataCriacao", header: "Data" },
  ]

  const filterOptions = [
    { label: "Pendente", value: "pendente" },
    { label: "Aprovado", value: "aprovado" },
    { label: "Rejeitado", value: "rejeitado" },
    { label: "Em Andamento", value: "em_andamento" },
  ]

  const actions = (item: Requisition) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem>
          <Eye className="mr-2 h-4 w-4" />
          Ver Detalhes
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Edit className="mr-2 h-4 w-4" />
          Editar
        </DropdownMenuItem>
        {item.status === "pendente" && (
          <>
            <DropdownMenuItem className="text-success">
              <CheckCircle className="mr-2 h-4 w-4" />
              Aprovar
            </DropdownMenuItem>
            <DropdownMenuItem className="text-destructive">
              <XCircle className="mr-2 h-4 w-4" />
              Rejeitar
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Requisições</h1>
          <p className="text-muted-foreground">
            Gerencie as requisições de compra da empresa
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nova Requisição
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Nova Requisição</DialogTitle>
              <DialogDescription>
                Preencha os dados para criar uma nova requisição de compra
              </DialogDescription>
            </DialogHeader>
            <RequisitionForm onSuccess={() => setIsDialogOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <DataTable
        data={mockRequisitions}
        columns={columns}
        searchPlaceholder="Buscar requisições..."
        searchKey="titulo"
        filterOptions={filterOptions}
        filterKey="status"
        actions={actions}
      />
    </div>
  )
}
