"use client"

import { useEffect, useState } from "react"
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
import { createClient } from "@/lib/supabase/client"

interface Quotation {
  id: string
  code: string
  description: string
  status: "draft" | "waiting" | "analysis" | "completed" | "cancelled"
  category: string | null
  payment_condition: string | null
  response_deadline: string | null
  created_at: string
}

const statusConfig = {
  draft: { label: "Rascunho", variant: "outline" as const },
  waiting: { label: "Aguardando Resposta", variant: "default" as const },
  analysis: { label: "Em Análise", variant: "secondary" as const },
  completed: { label: "Concluída", variant: "outline" as const },
  cancelled: { label: "Cancelada", variant: "destructive" as const },
}

const filterOptions = [
  { label: "Rascunho", value: "draft" },
  { label: "Aguardando Resposta", value: "waiting" },
  { label: "Em Análise", value: "analysis" },
  { label: "Concluída", value: "completed" },
  { label: "Cancelada", value: "cancelled" },
]

export default function CotacoesPage() {
  const [quotations, setQuotations] = useState<Quotation[]>([])
  const [loadingData, setLoadingData] = useState(true)

  const columns: Column<Quotation>[] = [
    { key: "code", header: "ID", className: "font-medium" },
    { key: "description", header: "Descrição" },
    { key: "category", header: "Categoria", cell: (item) => item.category ?? "-" },
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
      key: "response_deadline",
      header: "Data Limite",
      cell: (item) =>
        item.response_deadline
          ? new Date(item.response_deadline).toLocaleDateString("pt-BR")
          : "-",
    },
    {
      key: "created_at",
      header: "Criado em",
      cell: (item) => new Date(item.created_at).toLocaleDateString("pt-BR"),
    },
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
        {item.status === "waiting" && (
          <DropdownMenuItem>
            <Users className="mr-2 h-4 w-4" />
            Convidar Fornecedores
          </DropdownMenuItem>
        )}
        {(item.status === "waiting" || item.status === "analysis") && (
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

  useEffect(() => {
    const fetchQuotations = async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("quotations")
        .select(
          "id, code, description, status, category, payment_condition, response_deadline, created_at",
        )
        .eq("company_id", "00000000-0000-0000-0000-000000000001")
        .order("created_at", { ascending: false })

      if (error) {
        console.error("Erro ao buscar cotações:", error)
      } else {
        setQuotations(data ?? [])
      }
      setLoadingData(false)
    }
    fetchQuotations()
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Cotações (RFQ)</h1>
          <p className="text-muted-foreground">
            Gerencie suas solicitações de cotação
          </p>
        </div>
        <Button asChild>
          <Link href="/comprador/cotacoes/nova">
            <Plus className="mr-2 h-4 w-4" />
            Nova Cotação
          </Link>
        </Button>
      </div>

      {loadingData ? (
        <p className="text-sm text-muted-foreground">Carregando cotações...</p>
      ) : (
        <DataTable
          data={quotations}
          columns={columns}
          searchPlaceholder="Buscar cotações..."
          searchKey="description"
          filterOptions={filterOptions}
          filterKey="status"
          actions={actions}
        />
      )}
    </div>
  )
}
