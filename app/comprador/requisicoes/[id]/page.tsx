"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
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

import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  Circle,
  ClipboardList,
  Clock,
  FileText,
  Loader2,
  Pencil,
  XCircle,
} from "lucide-react"

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

type QuotationInfo = {
  id: string
  code: string
  status: string
  created_at: string
}

type PurchaseOrderInfo = {
  id: string
  code: string
  status: string
  supplier_name: string
  total_price: number | null
  created_at: string
  estimated_delivery_date: string | null
}

type ApprovalHistory = {
  id: string
  status: string
  approver_name: string | null
  rejection_reason: string | null
  decided_at: string | null
  created_at: string
}

type AuditLog = {
  id: string
  event_type: string
  description: string
  created_at: string
  user_name: string | null
  metadata: Record<string, unknown> | null
}

function HorizontalTimeline({
  req,
  quotation,
  orders,
}: {
  req: Requisition
  quotation: QuotationInfo | null
  orders: PurchaseOrderInfo[]
}) {
  type StepStatus = "completed" | "active" | "pending" | "rejected"

  const steps: {
    key: string
    label: string
    status: StepStatus
    date?: string | null
  }[] = [
    {
      key: "created",
      label: "Criada",
      status: "completed",
      date: req.created_at,
    },
    {
      key: "approval",
      label: "Aprovação",
      status:
        req.status === "rejected"
          ? "rejected"
          : req.status === "pending"
            ? "active"
            : "completed",
      date: req.approved_at ?? null,
    },
    {
      key: "quotation",
      label: "Cotação",
      status: ["pending", "rejected"].includes(req.status)
        ? "pending"
        : quotation
          ? ["completed", "cancelled"].includes(quotation.status)
            ? "completed"
            : "active"
          : req.status === "approved"
            ? "pending"
            : "active",
      date: quotation?.created_at,
    },
    {
      key: "order",
      label: "Pedido",
      status:
        ["pending", "rejected"].includes(req.status) || !quotation
          ? "pending"
          : orders.length === 0
            ? "pending"
            : orders.some((o) => o.status === "completed")
              ? "completed"
              : "active",
      date: orders[0]?.created_at,
    },
    {
      key: "delivery",
      label: "Entrega",
      status:
        req.status === "completed"
          ? "completed"
          : orders.some((o) => o.status === "completed")
            ? "active"
            : "pending",
      date: orders.find((o) => o.status === "completed")?.estimated_delivery_date,
    },
  ]

  return (
    <div className="bg-card border border-border rounded-xl p-4 overflow-x-auto">
      <div className="flex items-center justify-between relative min-w-[320px]">
        <div className="absolute top-5 left-0 right-0 h-0.5 bg-border mx-8" />

        {steps.map((step) => {
          const colorMap = {
            completed: {
              circle: "bg-blue-500 border-blue-500",
              text: "text-blue-700",
            },
            active: {
              circle: "bg-blue-500 border-blue-500 animate-pulse",
              text: "text-blue-700",
            },
            pending: {
              circle: "bg-background border-border",
              text: "text-muted-foreground",
            },
            rejected: {
              circle: "bg-blue-500 border-blue-500",
              text: "text-blue-700",
            },
          }[step.status]

          return (
            <div key={step.key} className="flex flex-col items-center gap-2 z-10 flex-1 min-w-0">
              <div
                className={`w-10 h-10 rounded-full border-2 flex items-center justify-center shrink-0 ${colorMap.circle}`}
              >
                {step.status === "completed" && (
                  <CheckCircle2 className="w-5 h-5 text-white" />
                )}
                {step.status === "active" && (
                  <Loader2 className="w-4 h-4 text-white animate-spin" />
                )}
                {step.status === "rejected" && (
                  <XCircle className="w-5 h-5 text-white" />
                )}
                {step.status === "pending" && (
                  <Circle className="w-4 h-4 text-muted-foreground" />
                )}
              </div>
              <div className="text-center px-0.5">
                <p className={`text-xs font-medium ${colorMap.text}`}>{step.label}</p>
                {step.date && (
                  <p className="text-xs text-muted-foreground text-center">
                    {format(new Date(step.date), "dd/MM HH:mm", { locale: ptBR })}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function HistorySection({
  history,
  req,
  auditLogs,
}: {
  history: ApprovalHistory[]
  req: Requisition
  auditLogs: AuditLog[]
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <h3 className="text-sm font-semibold text-foreground mb-4">Histórico</h3>
      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
            <ClipboardList className="w-3.5 h-3.5 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">Requisição criada</p>
            <p className="text-xs text-muted-foreground">
              Por {req.requester_name ?? "solicitante"} ·{" "}
              {format(new Date(req.created_at), "dd/MM/yyyy 'às' HH:mm", {
                locale: ptBR,
              })}
            </p>
          </div>
        </div>

        {history.map((h) => {
          const isApproved = h.status === "approved"
          const isRejected = h.status === "rejected"
          const isPending = h.status === "pending"

          return (
            <div key={h.id} className="flex items-start gap-3">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                  isApproved
                    ? "bg-green-100"
                    : isRejected
                      ? "bg-red-100"
                      : "bg-yellow-100"
                }`}
              >
                {isApproved && (
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                )}
                {isRejected && <XCircle className="w-3.5 h-3.5 text-red-600" />}
                {isPending && <Clock className="w-3.5 h-3.5 text-yellow-600" />}
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm font-medium ${
                    isApproved
                      ? "text-green-700"
                      : isRejected
                        ? "text-red-700"
                        : "text-yellow-700"
                  }`}
                >
                  {isPending
                    ? "Enviada para aprovação"
                    : isApproved
                      ? `Aprovada${h.approver_name ? ` por ${h.approver_name}` : ""}`
                      : `Reprovada${h.approver_name ? ` por ${h.approver_name}` : ""}`}
                </p>
                {h.rejection_reason && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Motivo: {h.rejection_reason}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  {format(new Date(h.decided_at ?? h.created_at), "dd/MM/yyyy 'às' HH:mm", {
                    locale: ptBR,
                  })}
                </p>
              </div>
            </div>
          )
        })}

        {auditLogs.map((log) => {
          const isInQuotation = log.event_type === "requisition.in_quotation"
          const isApprovedRelease = log.event_type === "requisition.approved"
          if (!isInQuotation && !isApprovedRelease) return null

          return (
            <div key={log.id} className="flex items-start gap-3">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                  isInQuotation ? "bg-blue-100" : "bg-green-100"
                }`}
              >
                {isInQuotation ? (
                  <FileText className="w-3.5 h-3.5 text-blue-600" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm font-medium ${
                    isInQuotation ? "text-blue-700" : "text-green-700"
                  }`}
                >
                  {isInQuotation
                    ? `Vinculada à cotação ${(log.metadata?.quotation_code as string) ?? ""}`
                    : `Liberada — cotação ${(log.metadata?.quotation_code as string) ?? ""} cancelada`}
                </p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(log.created_at), "dd/MM/yyyy 'às' HH:mm", {
                    locale: ptBR,
                  })}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
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
  const searchParams = useSearchParams()
  const { hasFeature } = usePermissions()
  const { id } = React.use(params)

  const backHref = searchParams.get("from") === "aprovacoes" ? "/comprador/aprovacoes" : "/comprador/requisicoes"

  const [requisition, setRequisition] = React.useState<Requisition | null>(null)
  const [items, setItems] = React.useState<RequisitionItem[]>([])
  const [loading, setLoading] = React.useState(true)

  const [quotationOpen, setQuotationOpen] = React.useState(false)
  const [linkedQuotation, setLinkedQuotation] = React.useState<{ id: string; code: string } | null>(null)
  const [quotationData, setQuotationData] = React.useState<QuotationInfo | null>(null)
  const [orders, setOrders] = React.useState<PurchaseOrderInfo[]>([])
  const [history, setHistory] = React.useState<ApprovalHistory[]>([])
  const [auditLogs, setAuditLogs] = React.useState<AuditLog[]>([])

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
      let quotationInfo: QuotationInfo | null = null
      const quotationId = reqData?.quotation_id
      if (quotationId) {
        const { data: qFull } = await supabase
          .from("quotations")
          .select("id, code, status, created_at")
          .eq("id", quotationId)
          .single()

        if (qFull?.id && qFull?.code) {
          linked = { id: qFull.id as string, code: qFull.code as string }
          quotationInfo = qFull as QuotationInfo
        }
      }

      setLinkedQuotation(linked)
      setQuotationData(quotationInfo)

      if (reqData?.code) {
        const { data: ordersData } = await supabase
          .from("purchase_orders")
          .select(
            "id, code, status, supplier_name, total_price, created_at, estimated_delivery_date",
          )
          .eq("requisition_code", reqData.code)
          .order("created_at")
        if (!alive) return
        setOrders((ordersData as PurchaseOrderInfo[]) ?? [])
      } else {
        setOrders([])
      }

      const { data: historyData } = await supabase
        .from("approval_requests")
        .select("id, status, approver_name, rejection_reason, decided_at, created_at")
        .eq("entity_id", id)
        .eq("flow", "requisition")
        .order("created_at", { ascending: true })

      const { data: auditData } = await supabase
        .from("audit_logs")
        .select("id, event_type, description, created_at, user_name, metadata")
        .eq("entity", "requisitions")
        .eq("entity_id", id)
        .order("created_at", { ascending: true })

      if (!alive) return
      setHistory((historyData as ApprovalHistory[]) ?? [])
      setAuditLogs((auditData ?? []) as AuditLog[])

      setRequisition(reqData)
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
          <Button variant="ghost" size="icon" onClick={() => router.push(backHref)}>
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
          <Button variant="ghost" size="icon" onClick={() => router.push(backHref)}>
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
            onClick={() => router.push(backHref)}
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
              onClick={() =>
                router.push(
                  `/comprador/cotacoes/${linkedQuotation.id}?from=requisicao&requisicaoId=${id}`,
                )
              }
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 hover:bg-blue-200 transition-colors cursor-pointer border border-blue-200"
            >
              <FileText className="w-3 h-3" />
              {linkedQuotation.code}
            </button>
          )}
          {requisition.status === "rejected" && (
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push(`/comprador/requisicoes/${id}/editar`)}
            >
              <Pencil className="h-4 w-4 mr-2" />
              Editar e Resubmeter
            </Button>
          )}
          {requisition.status === "approved" && (
            <Button type="button" onClick={() => setQuotationOpen(true)}>
              Gerar Cotação
            </Button>
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

      <HorizontalTimeline
        req={requisition}
        quotation={quotationData}
        orders={orders}
      />

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

      <HistorySection history={history} req={requisition} auditLogs={auditLogs} />

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
    </div>
  )
}

