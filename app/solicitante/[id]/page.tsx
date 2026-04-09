"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { createClient } from "@/lib/supabase/client"
import { useAutoRefresh } from "@/lib/hooks/use-auto-refresh"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  AlertCircle,
  ChevronLeft,
  ClipboardList,
  CheckCircle2,
  XCircle,
  Clock,
  Circle,
  Loader2,
  Pencil,
} from "lucide-react"

type RequisitionStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "in_quotation"
  | "completed"

type Requisition = {
  id: string
  code: string
  title: string
  status: RequisitionStatus
  priority: string
  created_at: string
  needed_by: string | null
  approved_at: string | null
  approver_name: string | null
  rejection_reason: string | null
  cost_center: string | null
  requester_name: string | null
  quotation_id: string | null
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

type RequisitionItem = {
  id: string
  material_code: string | null
  material_description: string
  quantity: number
  unit_of_measure: string | null
  commodity_group: string | null
  observations: string | null
}

function getStatusMeta(status: string) {
  switch (status) {
    case "pending":
      return { label: "Aguardando Aprovação", className: "bg-yellow-100 text-yellow-800" }
    case "approved":
      return { label: "Aprovada", className: "bg-green-100 text-green-800" }
    case "rejected":
      return { label: "Reprovada", className: "bg-red-100 text-red-800" }
    case "in_quotation":
      return { label: "Em Cotação", className: "bg-blue-100 text-blue-800" }
    case "completed":
      return { label: "Concluída", className: "bg-gray-100 text-gray-700" }
    default:
      return { label: status, className: "bg-gray-100 text-gray-700" }
  }
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
      date: req.approved_at,
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
}: {
  history: ApprovalHistory[]
  req: Requisition
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
      </div>
    </div>
  )
}

export default function SolicitanteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const router = useRouter()
  const { id } = React.use(params)

  const [requisition, setRequisition] = React.useState<Requisition | null>(null)
  const [quotation, setQuotation] = React.useState<QuotationInfo | null>(null)
  const [orders, setOrders] = React.useState<PurchaseOrderInfo[]>([])
  const [history, setHistory] = React.useState<ApprovalHistory[]>([])
  const [items, setItems] = React.useState<RequisitionItem[]>([])
  const [loading, setLoading] = React.useState(true)
  const [cancelOpen, setCancelOpen] = React.useState(false)
  const [cancelling, setCancelling] = React.useState(false)

  const loadData = React.useCallback(async () => {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      window.location.href = "/solicitante/login"
      return
    }

    // Carregar requisição (verifica que pertence ao usuário)
    const { data: reqData } = await supabase
      .from("requisitions")
      .select("*")
      .eq("id", id)
      .eq("requester_id", user.id)
      .single()

    if (!reqData) {
      router.push("/solicitante")
      return
    }

    const req = reqData as Requisition
    setRequisition(req)

    const [historyResult, itemsResult, ordersResult] = await Promise.all([
      supabase
        .from("approval_requests")
        .select("id, status, approver_name, rejection_reason, decided_at, created_at")
        .eq("entity_id", id)
        .eq("flow", "requisition")
        .order("created_at", { ascending: true }),
      supabase
        .from("requisition_items")
        .select(
          "id, material_code, material_description, quantity, unit_of_measure, commodity_group, observations",
        )
        .eq("requisition_id", id)
        .order("created_at"),
      supabase
        .from("purchase_orders")
        .select(
          "id, code, status, supplier_name, total_price, created_at, estimated_delivery_date",
        )
        .eq("requisition_code", req.code)
        .order("created_at"),
    ])

    setHistory((historyResult.data as ApprovalHistory[]) ?? [])
    setItems((itemsResult.data as RequisitionItem[]) ?? [])
    setOrders((ordersResult.data as PurchaseOrderInfo[]) ?? [])

    let quot: QuotationInfo | null = null
    if (req.quotation_id) {
      const { data: qData } = await supabase
        .from("quotations")
        .select("id, code, status, created_at")
        .eq("id", req.quotation_id)
        .single()
      if (qData) quot = qData as QuotationInfo
    }
    setQuotation(quot)
    setLoading(false)
  }, [id, router])

  React.useEffect(() => {
    void loadData()
  }, [loadData])

  useAutoRefresh({
    intervalMs: 15000,
    onRefresh: () => {
      void loadData()
    },
    enabled: true,
  })

  async function handleCancel() {
    if (!requisition) return
    setCancelling(true)
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      window.location.href = "/solicitante/login"
      return
    }

    await supabase
      .from("requisitions")
      .update({ status: "rejected", rejection_reason: "Cancelado pelo solicitante" })
      .eq("id", requisition.id)
      .eq("requester_id", user.id)
      .eq("status", "pending")

    setCancelOpen(false)
    setCancelling(false)
    void loadData()
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        Carregando...
      </div>
    )
  }

  if (!requisition) return null

  const priorityLabel = {
    normal: "Normal",
    urgent: "Urgente",
    critical: "Crítico",
  }[requisition.priority] ?? requisition.priority

  const statusMeta = getStatusMeta(requisition.status)

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push("/solicitante")}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{requisition.code}</h1>
            <p className="text-muted-foreground text-sm mt-0.5">{requisition.title}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={statusMeta.className}>{statusMeta.label}</Badge>
            {requisition.status === "rejected" && (
              <Button onClick={() => router.push(`/solicitante/${id}/editar`)}>
                <Pencil className="w-4 h-4 mr-2" />
                Editar e Resubmeter
              </Button>
            )}
            {requisition.status === "pending" && (
              <Button
                variant="outline"
                className="text-destructive border-destructive/30 hover:bg-destructive/5"
                onClick={() => setCancelOpen(true)}
              >
                <XCircle className="w-4 h-4 mr-2" />
                Cancelar
              </Button>
            )}
          </div>
        </div>

        {requisition.status === "rejected" && requisition.rejection_reason && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 flex items-start gap-3">
            <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-800">Motivo da reprovação</p>
              <p className="text-sm text-red-700 mt-0.5">{requisition.rejection_reason}</p>
            </div>
          </div>
        )}

        <HorizontalTimeline req={requisition} quotation={quotation} orders={orders} />

        <Card>
          <CardHeader>
            <CardTitle>Informações Gerais</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Solicitante
                </p>
                <p className="text-sm text-foreground font-medium">
                  {requisition.requester_name ?? "—"}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Centro de Custo
                </p>
                <p className="text-sm text-foreground font-medium">
                  {requisition.cost_center ?? "—"}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Data de Criação
                </p>
                <p className="text-sm text-foreground font-medium">
                  {format(new Date(requisition.created_at), "dd/MM/yyyy", { locale: ptBR })}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Data de Necessidade
                </p>
                <p className="text-sm text-foreground font-medium">
                  {requisition.needed_by
                    ? format(new Date(requisition.needed_by), "dd/MM/yyyy", { locale: ptBR })
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Prioridade
                </p>
                <p className="text-sm text-foreground font-medium">{priorityLabel}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Aprovador
                </p>
                <p className="text-sm text-foreground font-medium">
                  {requisition.approver_name ?? "—"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle>Itens da Requisição</CardTitle>
            <Badge variant="outline" className="text-xs">
              {items.length} {items.length === 1 ? "item" : "itens"}
            </Badge>
          </CardHeader>
          <CardContent>
            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Nenhum item cadastrado.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="text-right">Qtd</TableHead>
                      <TableHead>Unidade</TableHead>
                      <TableHead>Grupo</TableHead>
                      <TableHead>Observações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((it) => (
                      <TableRow key={it.id}>
                        <TableCell className="font-mono text-sm">
                          {it.material_code ?? "—"}
                        </TableCell>
                        <TableCell className="font-medium text-sm">
                          {it.material_description}
                        </TableCell>
                        <TableCell className="text-right text-sm">{it.quantity}</TableCell>
                        <TableCell className="text-sm">{it.unit_of_measure ?? "—"}</TableCell>
                        <TableCell className="text-sm">{it.commodity_group ?? "—"}</TableCell>
                        <TableCell className="text-sm">{it.observations ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <HistorySection history={history} req={requisition} />
      </main>

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar Requisição</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja cancelar a requisição {requisition.code}? Esta ação
              não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleCancel()}
              disabled={cancelling}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cancelling ? "Cancelando..." : "Confirmar Cancelamento"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
