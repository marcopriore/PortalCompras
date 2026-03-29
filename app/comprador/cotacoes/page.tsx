"use client"

import React, { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  Plus,
  Eye,
  BarChart2,
  MoreHorizontal,
  Search,
  Building2,
  Package,
  Download,
  X,
  FileText,
  Clock,
  CheckCircle,
} from "lucide-react"
import MultiSelectFilter from "@/components/ui/multi-select-filter"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { DataTable, Column } from "@/components/data-table/data-table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { createClient } from "@/lib/supabase/client"
import { useUser } from "@/lib/hooks/useUser"
import { usePermissions } from "@/lib/hooks/usePermissions"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

type QuotationSupplier = { supplier_name: string | null }
type QuotationItem = {
  material_code: string | null
  material_description: string | null
}

interface Quotation {
  id: string
  code: string
  description: string
  status: "draft" | "waiting" | "analysis" | "completed" | "cancelled"
  category: string | null
  payment_condition: string | null
  response_deadline: string | null
  created_at: string
  quotation_suppliers?: QuotationSupplier[] | null
  quotation_items?: QuotationItem[] | null
}

const statusConfig = {
  draft: { label: "Rascunho", variant: "outline" as const },
  waiting: { label: "Aguardando Resposta", variant: "default" as const },
  analysis: { label: "Em Análise", variant: "secondary" as const },
  completed: { label: "Concluída", variant: "outline" as const },
  cancelled: { label: "Cancelada", variant: "destructive" as const },
}

function getStatusLabel(
  status: Quotation["status"],
): "Rascunho" | "Pendente" | "Em Análise" | "Concluída" | "Cancelada" {
  if (status === "draft") return "Rascunho"
  if (status === "waiting") return "Pendente"
  if (status === "analysis") return "Em Análise"
  if (status === "completed") return "Concluída"
  return "Cancelada"
}

export default function CotacoesPage() {
  const [quotations, setQuotations] = useState<Quotation[]>([])
  const [loadingData, setLoadingData] = useState(true)

  const { companyId, loading: userLoading } = useUser()
  const { hasFeature, hasPermission } = usePermissions()
  void hasFeature

  const [search, setSearch] = useState("")
  const searchRef = React.useRef<HTMLDivElement>(null)
  const supplierFilterRef = React.useRef<HTMLDivElement>(null)
  const materialFilterRef = React.useRef<HTMLDivElement>(null)
  const [statusFilter, setStatusFilter] = useState<string[]>(['draft', 'waiting', 'analysis'])
  const [dateFrom, setDateFrom] = useState<string>("")
  const [dateTo, setDateTo] = useState<string>("")
  const [supplierFilter, setSupplierFilter] = useState<string>("")
  const [materialFilter, setMaterialFilter] = useState<string>("")

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
        {(item.status === "waiting" || item.status === "analysis") && (
          <DropdownMenuItem
            asChild
            disabled={!hasPermission("quotation.equalize")}
            title={!hasPermission("quotation.equalize") ? "Sem permissão" : undefined}
          >
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
      if (!companyId) {
        return
      }

      const supabase = createClient()
      const { data, error } = await supabase
        .from("quotations")
        .select(
          "*, quotation_suppliers(supplier_name), quotation_items(material_code, material_description)",
        )
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })

      if (error) {
        console.error("Erro ao buscar cotações:", error)
      } else {
        setQuotations(data ?? [])
      }
      setLoadingData(false)
    }

    fetchQuotations()
  }, [companyId])

  const hasActiveFilters =
    !!search ||
    statusFilter.length > 0 ||
    !!dateFrom ||
    !!dateTo ||
    !!supplierFilter ||
    !!materialFilter

  const filtered = useMemo(() => {
    return quotations.filter((q) => {
      const query = search.trim().toLowerCase()
      const matchSearch =
        !query ||
        q.code.toLowerCase().includes(query) ||
        q.description.toLowerCase().includes(query)

      const matchStatus = statusFilter.length === 0 || statusFilter.includes(q.status)

      const matchDateFrom = !dateFrom || new Date(q.created_at) >= new Date(dateFrom)
      const matchDateTo =
        !dateTo || new Date(q.created_at) <= new Date(`${dateTo}T23:59:59`)

      const supplierQ = supplierFilter.trim().toLowerCase()
      const matchSupplier =
        !supplierQ ||
        (q.quotation_suppliers ?? []).some((s) =>
          (s.supplier_name ?? "").toLowerCase().includes(supplierQ),
        )

      const materialQ = materialFilter.trim().toLowerCase()
      const matchMaterial =
        !materialQ ||
        (q.quotation_items ?? []).some((i) => {
          const code = (i.material_code ?? "").toLowerCase()
          const desc = (i.material_description ?? "").toLowerCase()
          return code.includes(materialQ) || desc.includes(materialQ)
        })

      return (
        matchSearch &&
        matchStatus &&
        matchDateFrom &&
        matchDateTo &&
        matchSupplier &&
        matchMaterial
      )
    })
  }, [quotations, search, statusFilter, dateFrom, dateTo, supplierFilter, materialFilter])

  const metrics = useMemo(() => {
    return {
      total: quotations.length,
      waiting: quotations.filter((q) => q.status === "waiting").length,
      analysis: quotations.filter((q) => q.status === "analysis").length,
      completed: quotations.filter((q) => q.status === "completed").length,
    }
  }, [quotations])

  const handleClearFilters = () => {
    setSearch("")
    setStatusFilter(['draft', 'waiting', 'analysis'])
    setDateFrom("")
    setDateTo("")
    setSupplierFilter("")
    setMaterialFilter("")
  }

  const handleExport = async () => {
    const ExcelJS = (await import("exceljs")).default
    const workbook = new ExcelJS.Workbook()
    const ws = workbook.addWorksheet("Cotações")

    ws.columns = [
      { header: "Código", key: "code", width: 20 },
      { header: "Descrição", key: "description", width: 40 },
      { header: "Status", key: "status", width: 15 },
      { header: "Categoria", key: "category", width: 20 },
      { header: "Condição de Pagamento", key: "payment", width: 25 },
      { header: "Prazo de Resposta", key: "deadline", width: 20 },
      { header: "Data de Criação", key: "createdAt", width: 20 },
    ]

    const headerRow = ws.getRow(1)
    headerRow.height = 18
    headerRow.eachCell((cell: any) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF4F46E5" },
      }
      cell.font = { color: { argb: "FFFFFFFF" }, bold: true, size: 11 }
      cell.alignment = { horizontal: "center", vertical: "middle" }
    })

    const formatDateOnly = (value: string | null) => {
      if (!value) return "—"
      const d = new Date(value)
      if (Number.isNaN(d.getTime())) return "—"
      return d.toLocaleDateString("pt-BR")
    }

    const formatDateTime = (value: string) => {
      const d = new Date(value)
      if (Number.isNaN(d.getTime())) return "—"
      const date = d.toLocaleDateString("pt-BR")
      const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
      return `${date} ${time}`
    }

    filtered.forEach((q, idx) => {
      ws.addRow({
        code: q.code,
        description: q.description,
        status: getStatusLabel(q.status),
        category: q.category ?? "—",
        payment: q.payment_condition ?? "—",
        deadline: q.response_deadline ? formatDateOnly(q.response_deadline) : "—",
        createdAt: formatDateTime(q.created_at),
      })

      const rowNumber = idx + 2
      const row = ws.getRow(rowNumber)
      row.height = 18
      const isEven = rowNumber % 2 === 0
      row.eachCell({ includeEmpty: true }, (cell: any) => {
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
    const dd = String(now.getDate()).padStart(2, "0")
    const mm = String(now.getMonth() + 1).padStart(2, "0")
    const yyyy = String(now.getFullYear())
    const filename = `cotacoes_export_${dd}${mm}${yyyy}.xlsx`

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
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Cotações (RFQ)</h1>
          <p className="text-muted-foreground">
            Gerencie suas solicitações de cotação
          </p>
        </div>
        {!hasPermission("quotation.create") ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button
                  asChild
                  disabled
                  title="Sem permissão"
                  onClick={(e) => e.preventDefault()}
                >
                  <Link href="/comprador/cotacoes/nova">
                    <Plus className="mr-2 h-4 w-4" />
                    Nova Cotação
                  </Link>
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>Você não tem permissão para esta ação</TooltipContent>
          </Tooltip>
        ) : (
          <Button asChild>
            <Link href="/comprador/cotacoes/nova">
              <Plus className="mr-2 h-4 w-4" />
              Nova Cotação
            </Link>
          </Button>
        )}
      </div>

      <div
        className="grid w-full grid-cols-4 gap-4 mb-6"
        style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}
      >
        <div className="min-w-0 bg-white border border-blue-100 rounded-xl p-5 flex items-center justify-between">
          <div>
            <p className="text-sm text-blue-600 font-medium">Total de Cotações</p>
            <p className="text-3xl font-bold text-blue-700 mt-1">{metrics.total}</p>
          </div>
          <div className="bg-blue-100 p-3 rounded-full">
            <FileText className="w-6 h-6 text-blue-600" />
          </div>
        </div>
        <div className="min-w-0 bg-white border border-yellow-100 rounded-xl p-5 flex items-center justify-between">
          <div>
            <p className="text-sm text-yellow-600 font-medium">Aguardando Resposta</p>
            <p className="text-3xl font-bold text-yellow-700 mt-1">{metrics.waiting}</p>
          </div>
          <div className="bg-yellow-100 p-3 rounded-full">
            <Clock className="w-6 h-6 text-yellow-600" />
          </div>
        </div>
        <div className="min-w-0 bg-white border border-purple-100 rounded-xl p-5 flex items-center justify-between">
          <div>
            <p className="text-sm text-purple-600 font-medium">Em Análise</p>
            <p className="text-3xl font-bold text-purple-700 mt-1">{metrics.analysis}</p>
          </div>
          <div className="bg-purple-100 p-3 rounded-full">
            <BarChart2 className="w-6 h-6 text-purple-600" />
          </div>
        </div>
        <div className="min-w-0 bg-white border border-green-100 rounded-xl p-5 flex items-center justify-between">
          <div>
            <p className="text-sm text-green-600 font-medium">Concluídas</p>
            <p className="text-3xl font-bold text-green-700 mt-1">{metrics.completed}</p>
          </div>
          <div className="bg-green-100 p-3 rounded-full">
            <CheckCircle className="w-6 h-6 text-green-600" />
          </div>
        </div>
      </div>

      <div className="bg-muted/40 border border-border rounded-xl p-4 mb-6">
        <p className="text-sm font-medium text-muted-foreground mb-3">Filtros</p>
        <div className="flex flex-wrap gap-2 items-end">
          <div className="flex flex-col flex-1 min-w-[200px] max-w-[360px]">
            <p className="text-xs font-medium text-muted-foreground mb-1 block">
              Buscar
            </p>
            <div ref={searchRef} className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por título ou código..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-8"
              />
              {search.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("")
                    ;(searchRef.current?.querySelector("input") as HTMLInputElement)?.focus()
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
            <p className="text-xs font-medium text-muted-foreground mb-1 block">
              Status
            </p>
            <MultiSelectFilter
              label="Status"
              options={[
                { value: "draft", label: "Rascunho" },
                { value: "waiting", label: "Aguardando" },
                { value: "analysis", label: "Em Análise" },
                { value: "completed", label: "Concluída" },
                { value: "cancelled", label: "Cancelada" },
              ]}
              selected={statusFilter}
              onChange={setStatusFilter}
              width="w-44"
            />
          </div>

          <div className="flex flex-col w-[140px]">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              De
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background text-foreground"
            />
          </div>

          <div className="flex flex-col w-[140px]">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Até
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background text-foreground"
            />
          </div>

          <div className="flex flex-col w-[200px]">
            <p className="text-xs font-medium text-muted-foreground mb-1 block">
              Fornecedor
            </p>
            <div ref={supplierFilterRef} className="relative">
              <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Filtrar por fornecedor..."
                value={supplierFilter}
                onChange={(e) => setSupplierFilter(e.target.value)}
                className="pl-9 pr-8"
              />
              {supplierFilter.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setSupplierFilter("")
                    ;(supplierFilterRef.current?.querySelector("input") as HTMLInputElement)?.focus()
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer p-0 border-0 bg-transparent"
                  aria-label="Limpar busca"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-col w-[200px]">
            <p className="text-xs font-medium text-muted-foreground mb-1 block">
              Material / Item
            </p>
            <div ref={materialFilterRef} className="relative">
              <Package className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Filtrar por código ou item..."
                value={materialFilter}
                onChange={(e) => setMaterialFilter(e.target.value)}
                className="pl-9 pr-8"
              />
              {materialFilter.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setMaterialFilter("")
                    ;(materialFilterRef.current?.querySelector("input") as HTMLInputElement)?.focus()
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer p-0 border-0 bg-transparent"
                  aria-label="Limpar busca"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {hasActiveFilters && (
            <div className="flex flex-col">
              <span className="text-xs font-medium text-muted-foreground mb-1 block">
                &nbsp;
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClearFilters}
              >
                Limpar Filtros
              </Button>
            </div>
          )}
        </div>
      </div>

      {userLoading || loadingData ? (
        <p className="text-sm text-muted-foreground">Carregando cotações...</p>
      ) : (
        <DataTable
          data={filtered}
          columns={columns}
          actions={actions}
          toolbarRight={
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleExport}
              className="gap-1.5"
            >
              <Download className="h-4 w-4" />
              Exportar Excel
            </Button>
          }
        />
      )}
    </div>
  )
}
