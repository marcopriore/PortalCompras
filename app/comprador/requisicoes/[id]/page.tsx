"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"

import { createClient } from "@/lib/supabase/client"
import { useUser } from "@/lib/hooks/useUser"
import { usePermissions } from "@/lib/hooks/usePermissions"
import { logAudit } from "@/lib/audit"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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

function getPriorityMeta(priority: Priority): { label: string; className: string } {
  switch (priority) {
    case "normal":
      return { label: "Normal", className: "bg-gray-100 text-gray-700" }
    case "urgent":
      return { label: "Urgente", className: "bg-orange-100 text-orange-800" }
    case "critical":
      return { label: "Crítica", className: "bg-red-100 text-red-800" }
  }
}

const formatCurrency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format

function formatDateTimeBR(iso: string | null | undefined): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return format(d, "dd/MM/yyyy HH:mm", { locale: ptBR })
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
  const { companyId, userId } = useUser()
  const { hasPermission, hasFeature } = usePermissions()
  const { id } = React.use(params)

  const [requisition, setRequisition] = React.useState<Requisition | null>(null)
  const [items, setItems] = React.useState<RequisitionItem[]>([])
  const [loading, setLoading] = React.useState(true)

  const [approveOpen, setApproveOpen] = React.useState(false)
  const [rejectOpen, setRejectOpen] = React.useState(false)
  const [quotationOpen, setQuotationOpen] = React.useState(false)

  const [rejectReason, setRejectReason] = React.useState("")
  const [actionSubmitting, setActionSubmitting] = React.useState(false)
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

  const priorityMeta = requisition ? getPriorityMeta(requisition.priority) : null
  const statusMeta = requisition ? getStatusMeta(requisition.status) : null

  const totalEstimated = React.useMemo(() => {
    return items.reduce((sum, it) => sum + (it.estimated_price ?? 0) * it.quantity, 0)
  }, [items])

  const originLabel = requisition?.origin === "manual" ? "Manual" : "ERP"

  const fetchFullName = async () => {
    if (!userId) return ""
    const supabase = createClient()
    const { data } = await supabase.from("profiles").select("full_name").eq("id", userId).single()
    return ((data as any)?.full_name ?? "") as string
  }

  const handleApprove = async () => {
    if (!requisition || !userId || !companyId) return
    setActionSubmitting(true)
    try {
      const fullName = await fetchFullName()
      const supabase = createClient()

      await supabase
        .from("requisitions")
        .update({
          status: "approved",
          approver_id: userId,
          approver_name: fullName,
          approved_at: new Date().toISOString(),
        })
        .eq("id", requisition.id)

      await logAudit({
        eventType: "quotation.updated",
        description: `Requisição ${requisition.code} aprovada`,
        companyId,
        userId,
        entity: "requisitions",
        entityId: requisition.id,
      })

      setRequisition((prev) =>
        prev
          ? {
              ...prev,
              status: "approved",
              approver_name: fullName,
              approved_at: new Date().toISOString(),
            }
          : prev,
      )
      setApproveOpen(false)
    } finally {
      setActionSubmitting(false)
    }
  }

  const handleReject = async () => {
    if (!requisition || !userId || !companyId) return
    if (!rejectReason.trim()) return

    setActionSubmitting(true)
    try {
      const fullName = await fetchFullName()
      const supabase = createClient()

      await supabase
        .from("requisitions")
        .update({
          status: "rejected",
          rejection_reason: rejectReason.trim(),
          approver_id: userId,
          approver_name: fullName,
        })
        .eq("id", requisition.id)

      await logAudit({
        eventType: "quotation.updated",
        description: `Requisição ${requisition.code} rejeitada`,
        companyId,
        userId,
        entity: "requisitions",
        entityId: requisition.id,
      })

      setRequisition((prev) =>
        prev
          ? {
              ...prev,
              status: "rejected",
              rejection_reason: rejectReason.trim(),
              approver_name: fullName,
            }
          : prev,
      )
      setRejectOpen(false)
      setRejectReason("")
    } finally {
      setActionSubmitting(false)
    }
  }

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
            <p className="text-muted-foreground">{requisition.title}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {priorityMeta && <Badge className={priorityMeta.className}>{priorityMeta.label}</Badge>}
          {statusMeta && <Badge className={statusMeta.className}>{statusMeta.label}</Badge>}
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

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Informações</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <Label>Solicitante</Label>
              <p className="font-medium">{requisition.requester_name ?? "—"}</p>
            </div>
            <div>
              <Label>Centro de Custo</Label>
              <p className="font-medium">{requisition.cost_center ?? "—"}</p>
            </div>
            <div>
              <Label>Data de Necessidade</Label>
              <p className="font-medium">{formatDateBR(requisition.needed_by)}</p>
            </div>
            <div>
              <Label>Origem</Label>
              <p className="font-medium">{originLabel}</p>
            </div>
            <div>
              <Label>Criado em</Label>
              <p className="font-medium">{formatDateTimeBR(requisition.created_at)}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Aprovação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <Label>Status</Label>
              <div className="mt-1">
                {statusMeta && <Badge className={statusMeta.className}>{statusMeta.label}</Badge>}
              </div>
            </div>
            <div>
              <Label>Aprovador</Label>
              <p className="font-medium">{requisition.approver_name ?? "Aguardando aprovação"}</p>
            </div>
            <div>
              <Label>Data de Aprovação</Label>
              <p className="font-medium">{requisition.approved_at ? formatDateTimeBR(requisition.approved_at) : "—"}</p>
            </div>
            <div>
              <Label>Código ERP</Label>
              <p className="font-medium">{requisition.erp_code ?? "—"}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        {requisition.status === "pending" && hasPermission("requisition.approve") && (
          <>
            <Button
              type="button"
              variant="default"
              className="bg-success/10 text-success hover:bg-success/10"
              onClick={() => setApproveOpen(true)}
              disabled={actionSubmitting}
            >
              Aprovar
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-destructive text-destructive hover:bg-destructive/10"
              onClick={() => setRejectOpen(true)}
              disabled={actionSubmitting}
            >
              Rejeitar
            </Button>
          </>
        )}

        {requisition.status === "approved" && (
          <Button type="button" onClick={() => setQuotationOpen(true)} disabled={actionSubmitting}>
            Gerar Cotação
          </Button>
        )}
      </div>

      <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aprovar Requisição</DialogTitle>
            <DialogDescription>
              Confirmar a aprovação da requisição {requisition.code}?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveOpen(false)} disabled={actionSubmitting}>
              Cancelar
            </Button>
            <Button onClick={handleApprove} disabled={actionSubmitting}>
              {actionSubmitting ? "Aprovando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeitar Requisição</DialogTitle>
            <DialogDescription>
              Informe o motivo da rejeição (obrigatório).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="rejectReason">Motivo</Label>
            <Textarea
              id="rejectReason"
              rows={4}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)} disabled={actionSubmitting}>
              Cancelar
            </Button>
            <Button
              onClick={handleReject}
              disabled={actionSubmitting || !rejectReason.trim()}
            >
              {actionSubmitting ? "Rejeitando..." : "Confirmar Rejeição"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={quotationOpen} onOpenChange={setQuotationOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gerar Cotação</DialogTitle>
            <DialogDescription>
              Confirmar a criação de uma cotação a partir da requisição {requisition.code}?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuotationOpen(false)} disabled={actionSubmitting}>
              Cancelar
            </Button>
            <Button onClick={handleGerarCotacao} disabled={actionSubmitting}>
              {actionSubmitting ? "Gerando..." : "Confirmar"}
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
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Qtd</TableHead>
                  <TableHead>Unidade</TableHead>
                  <TableHead className="text-right">Preço Estimado</TableHead>
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
                    <TableCell className="text-right">
                      {it.estimated_price == null ? "—" : formatCurrency(it.estimated_price)}
                    </TableCell>
                    <TableCell>{it.commodity_group ?? "—"}</TableCell>
                    <TableCell>{it.observations ?? "—"}</TableCell>
                  </TableRow>
                ))}

                <TableRow>
                  <TableCell colSpan={4} className="text-right font-bold">
                    Total Estimado
                  </TableCell>
                  <TableCell className="text-right font-bold">
                    {formatCurrency(totalEstimated)}
                  </TableCell>
                  <TableCell colSpan={2} />
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

