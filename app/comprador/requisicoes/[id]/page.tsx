"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"

import { createClient } from "@/lib/supabase/client"
import { usePermissions } from "@/lib/hooks/usePermissions"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import { AlertCircle, ChevronLeft, FileText } from "lucide-react"

type Priority = "normal" | "urgent" | "critical"
type RequisitionStatus = "pending" | "approved" | "rejected" | "in_quotation" | "completed"

type RequisitionItem = {
  id: string
  material_code: string | null
  material_description: string
  quantity: number
  unit_of_measure: string | null
  estimated_price: number | null
  commodity_group: string | null
  observations: string | null
  created_at?: string | null
}

type Requisition = {
  id: string
  code: string
  title: string
  requester_name: string | null
  cost_center: string | null
  needed_by: string | null
  origin: string | null
  created_at: string
  status: RequisitionStatus
  priority: Priority
  rejection_reason?: string | null
  approver_name?: string | null
  approved_at?: string | null
  erp_code?: string | null
  quotation_id?: string | null
  requisition_items?: RequisitionItem[]
}

function getStatusMeta(status: RequisitionStatus): { label: string; className: string } {
  switch (status) {
    case "pending":
      return { label: "Aguardando Aprovação", className: "bg-yellow-100 text-yellow-800" }
    case "approved":
      return { label: "Aprovado", className: "bg-green-100 text-green-800" }
    case "rejected":
      return { label: "Rejeitado", className: "bg-red-100 text-red-800" }
    case "in_quotation":
      return { label: "Em Cotação", className: "bg-blue-100 text-blue-800" }
    case "completed":
      return { label: "Concluído", className: "bg-gray-100 text-gray-700" }
  }
}

function formatDateBR(iso: string | null | undefined): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return format(d, "dd/MM/yyyy", { locale: ptBR })
}

export default function RequisicaoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const router = useRouter()
  const { hasFeature } = usePermissions()
  const { id } = React.use(params)

  const [requisition, setRequisition] = React.useState<Requisition | null>(null)
  const [items, setItems] = React.useState<RequisitionItem[]>([])
  const [loading, setLoading] = React.useState(true)

  const [quotationOpen, setQuotationOpen] = React.useState(false)
  const [linkedQuotation, setLinkedQuotation] = React.useState<{ id: string; code: string } | null>(null)

  React.useEffect(() => {
    if (!id) return
    const supabase = createClient()
    let alive = true

    const run = async () => {
      setLoading(true)
      const [rRes, iRes] = await Promise.all([
        supabase.from("requisitions").select("*").eq("id", id).single(),
        supabase
          .from("requisition_items")
          .select("*")
          .eq("requisition_id", id)
          .order("created_at"),
      ])

      if (!alive) return
      const reqData = ((rRes.data as any) ?? null) as Requisition | null

      let linked: { id: string; code: string } | null = null
      const quotationId = reqData?.quotation_id
      if (quotationId) {
        const { data: qData } = await supabase
          .from("quotations")
          .select("id, code")
          .eq("id", quotationId)
          .single()

        if (qData?.id && qData?.code) {
          linked = { id: qData.id as string, code: qData.code as string }
        }
      }

      setRequisition(reqData)
      setLinkedQuotation(linked)
      setItems(((iRes.data as unknown) as RequisitionItem[]) ?? [])
      setLoading(false)
    }

    run()
    return () => {
      alive = false
    }
  }, [id])

  const statusMeta = requisition ? getStatusMeta(requisition.status) : null

  const originLabel = requisition?.origin === "manual" ? "Manual" : "Integração ERP"

  const handleGerarCotacao = () => {
    if (!requisition) return
    router.push(`/comprador/cotacoes/nova?requisition_id=${requisition.id}`)
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push("/comprador/requisicoes")}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold tracking-tight">Requisição</h1>
            <p className="text-muted-foreground">Carregando pedido...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!requisition) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push("/comprador/requisicoes")}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold tracking-tight">Requisição</h1>
          </div>
        </div>
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Requisição não encontrada.
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/comprador/requisicoes")}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <div className="flex flex-col">
            <h1 className="text-2xl font-bold tracking-tight">{requisition.code}</h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {linkedQuotation && hasFeature("quotations") && (
            <button
              onClick={() => router.push(`/comprador/cotacoes/${linkedQuotation.id}`)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 hover:bg-blue-200 transition-colors cursor-pointer border border-blue-200"
            >
              <FileText className="w-3 h-3" />
              {linkedQuotation.code}
            </button>
          )}
        </div>
      </div>

      {requisition.status === "rejected" && (
        <div className="bg-red-50 border border-red-300 rounded-xl p-4 flex gap-3 items-start">
          <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-red-700">Motivo da rejeição: {requisition.rejection_reason ?? "—"}</p>
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Informações Gerais</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-x-8 gap-y-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Solicitante</p>
              <p className="text-sm text-foreground font-medium">{requisition.requester_name ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Centro de Custo</p>
              <p className="text-sm text-foreground font-medium">{requisition.cost_center ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Data de Criação</p>
              <p className="text-sm text-foreground font-medium">{formatDateBR(requisition.created_at)}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Data de Necessidade</p>
              <p className="text-sm text-foreground font-medium">{formatDateBR(requisition.needed_by)}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</p>
              <div className="mt-0.5">
                {statusMeta && <Badge className={statusMeta.className}>{statusMeta.label}</Badge>}
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Origem</p>
              <p className="text-sm text-foreground font-medium">{originLabel}</p>
            </div>
            {requisition.origin === "erp" && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Código ERP</p>
                <p className="text-sm text-foreground font-medium">{requisition.erp_code ?? "—"}</p>
              </div>
            )}
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Aprovador</p>
              <p className="text-sm text-foreground font-medium">{requisition.approver_name ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Data de Aprovação</p>
              <p className="text-sm text-foreground font-medium">
                {requisition.approved_at ? formatDateBR(requisition.approved_at) : "—"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-end gap-2">
        {requisition.status === "approved" && (
          <Button type="button" onClick={() => setQuotationOpen(true)}>
            Gerar Cotação
          </Button>
        )}
      </div>

      <Dialog open={quotationOpen} onOpenChange={setQuotationOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gerar Cotação</DialogTitle>
            <DialogDescription>
              Confirmar a criação de uma cotação a partir da requisição {requisition.code}?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuotationOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleGerarCotacao}>
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <CardTitle>Itens da Requisição</CardTitle>
          </div>
          <Badge variant="outline" className="text-xs">
            {items.length} item{items.length === 1 ? "" : "s"}
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Descrição Curta</TableHead>
                  <TableHead className="text-right">Qtd</TableHead>
                  <TableHead>Unidade</TableHead>
                  <TableHead>Grupo</TableHead>
                  <TableHead>Observações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((it) => (
                  <TableRow key={it.id}>
                    <TableCell className="font-mono">{it.material_code ?? "—"}</TableCell>
                    <TableCell className="font-medium">{it.material_description}</TableCell>
                    <TableCell className="text-right">{it.quantity}</TableCell>
                    <TableCell>{it.unit_of_measure ?? "—"}</TableCell>
                    <TableCell>{it.commodity_group ?? "—"}</TableCell>
                    <TableCell>{it.observations ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

