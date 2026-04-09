"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { createClient } from "@/lib/supabase/client"
import { useAutoRefresh } from "@/lib/hooks/use-auto-refresh"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
  ChevronLeft,
  ClipboardList,
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  ShoppingCart,
  Package,
  Circle,
  Loader2,
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

type TimelineStep = {
  key: string
  label: string
  description: string
  icon: React.ElementType
  status: "completed" | "active" | "pending" | "rejected"
  date?: string | null
  detail?: string | null
}

function buildTimeline(
  req: Requisition,
  quotation: QuotationInfo | null,
  orders: PurchaseOrderInfo[],
): TimelineStep[] {
  const steps: TimelineStep[] = []

  // ETAPA 1: Requisição criada
  steps.push({
    key: "created",
    label: "Requisição Criada",
    description: "Solicitação registrada no sistema",
    icon: ClipboardList,
    status: "completed",
    date: req.created_at,
  })

  // ETAPA 2: Aprovação
  if (req.status === "rejected") {
    steps.push({
      key: "approval",
      label: "Reprovada",
      description: req.rejection_reason ?? "Requisição reprovada pelo aprovador",
      icon: XCircle,
      status: "rejected",
      date: req.approved_at,
      detail: req.approver_name ? `Por: ${req.approver_name}` : null,
    })
  } else if (req.status === "pending") {
    steps.push({
      key: "approval",
      label: "Aguardando Aprovação",
      description: "Sua requisição está aguardando aprovação",
      icon: Clock,
      status: "active",
    })
  } else {
    steps.push({
      key: "approval",
      label: "Aprovada",
      description: "Requisição aprovada",
      icon: CheckCircle2,
      status: "completed",
      date: req.approved_at,
      detail: req.approver_name ? `Por: ${req.approver_name}` : null,
    })
  }

  // ETAPA 3: Cotação (só se aprovada)
  if (!["pending", "rejected"].includes(req.status)) {
    if (!quotation) {
      steps.push({
        key: "quotation",
        label: "Cotação",
        description: "Aguardando abertura de cotação pelo comprador",
        icon: FileText,
        status: "active",
      })
    } else {
      const quotationDone = ["completed", "cancelled"].includes(quotation.status)
      steps.push({
        key: "quotation",
        label: `Cotação ${quotation.code}`,
        description: quotationDone ? "Cotação finalizada" : "Cotação em andamento",
        icon: FileText,
        status: quotationDone ? "completed" : "active",
        date: quotation.created_at,
        detail: quotation.status === "cancelled" ? "Cotação cancelada" : null,
      })
    }
  }

  // ETAPA 4: Pedidos (só se cotação existe)
  if (quotation && !["pending", "rejected"].includes(req.status)) {
    if (orders.length === 0) {
      steps.push({
        key: "orders",
        label: "Pedido de Compra",
        description: "Aguardando emissão do pedido pelo comprador",
        icon: ShoppingCart,
        status: "pending",
      })
    } else {
      orders.forEach((order) => {
        const orderDone = order.status === "completed"
        const orderCancelled = order.status === "cancelled"
        steps.push({
          key: `order_${order.id}`,
          label: `Pedido ${order.code}`,
          description: orderCancelled
            ? "Pedido cancelado"
            : orderDone
              ? "Pedido concluído"
              : `${order.supplier_name} · ${order.status === "sent" ? "Aguardando aceite do fornecedor" : order.status === "processing" ? "Em processamento" : "Em andamento"}`,
          icon: ShoppingCart,
          status: orderDone ? "completed" : orderCancelled ? "rejected" : "active",
          date: order.created_at,
          detail: order.total_price
            ? `R$ ${order.total_price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
            : null,
        })
      })
    }
  }

  // ETAPA 5: Entrega (só se tem pedido completed)
  if (orders.some((o) => o.status === "completed")) {
    const completedOrder = orders.find((o) => o.status === "completed")
    steps.push({
      key: "delivery",
      label: "Entrega Prevista",
      description: completedOrder?.estimated_delivery_date
        ? `Entrega prevista para ${format(new Date(completedOrder.estimated_delivery_date), "dd/MM/yyyy", { locale: ptBR })}`
        : "Aguardando confirmação de entrega",
      icon: Package,
      status: req.status === "completed" ? "completed" : "active",
      date: completedOrder?.estimated_delivery_date,
    })
  }

  return steps
}

function TimelineItem({ step, isLast }: { step: TimelineStep; isLast: boolean }) {
  const Icon = step.icon

  const iconColor = {
    completed: "bg-green-100 text-green-600 border-green-200",
    active: "bg-blue-100 text-blue-600 border-blue-200",
    pending: "bg-muted text-muted-foreground border-border",
    rejected: "bg-red-100 text-red-600 border-red-200",
  }[step.status]

  const lineColor = {
    completed: "bg-green-200",
    active: "bg-blue-200",
    pending: "bg-border",
    rejected: "bg-red-200",
  }[step.status]

  return (
    <div className="flex gap-4">
      {/* Ícone + linha */}
      <div className="flex flex-col items-center">
        <div
          className={`w-9 h-9 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${iconColor}`}
        >
          {step.status === "active" && step.key !== "created" ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Icon className="w-4 h-4" />
          )}
        </div>
        {!isLast && <div className={`w-0.5 flex-1 mt-1 min-h-[2rem] ${lineColor}`} />}
      </div>

      {/* Conteúdo */}
      <div className="pb-6 min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <p
              className={`text-sm font-medium ${
                step.status === "rejected"
                  ? "text-red-700"
                  : step.status === "active"
                    ? "text-blue-700"
                    : step.status === "completed"
                      ? "text-foreground"
                      : "text-muted-foreground"
              }`}
            >
              {step.label}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
            {step.detail && (
              <p className="text-xs text-muted-foreground mt-0.5">{step.detail}</p>
            )}
          </div>
          {step.date && (
            <span className="text-xs text-muted-foreground flex-shrink-0">
              {format(new Date(step.date), "dd/MM/yyyy", { locale: ptBR })}
            </span>
          )}
        </div>
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

    // Carregar cotação vinculada
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

    // Carregar pedidos vinculados via requisition_code
    const { data: ordersData } = await supabase
      .from("purchase_orders")
      .select(
        "id, code, status, supplier_name, total_price, created_at, estimated_delivery_date",
      )
      .eq("requisition_code", req.code)
      .order("created_at")

    setOrders((ordersData as PurchaseOrderInfo[]) ?? [])
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

  const timeline = buildTimeline(requisition, quotation, orders)

  const priorityLabel = {
    normal: "Normal",
    urgent: "Urgente",
    critical: "Crítico",
  }[requisition.priority] ?? requisition.priority

  const priorityColor = {
    normal: "bg-gray-100 text-gray-700",
    urgent: "bg-orange-100 text-orange-700",
    critical: "bg-red-100 text-red-700",
  }[requisition.priority] ?? "bg-gray-100 text-gray-700"

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push("/solicitante")}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div>
            <p className="text-sm font-semibold text-foreground">{requisition.code}</p>
            <p className="text-xs text-muted-foreground">{requisition.title}</p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        {/* Informações resumidas */}
        <Card>
          <CardContent className="p-4 grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Prioridade</p>
              <Badge className={priorityColor}>{priorityLabel}</Badge>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Centro de Custo</p>
              <p className="text-sm font-medium">{requisition.cost_center || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Criada em</p>
              <p className="text-sm font-medium">
                {format(new Date(requisition.created_at), "dd/MM/yyyy", { locale: ptBR })}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Necessário até</p>
              <p className="text-sm font-medium">
                {requisition.needed_by
                  ? format(new Date(requisition.needed_by), "dd/MM/yyyy", {
                      locale: ptBR,
                    })
                  : "—"}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Timeline */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Acompanhamento</CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
            {timeline.map((step, i) => (
              <TimelineItem key={step.key} step={step} isLast={i === timeline.length - 1} />
            ))}
          </CardContent>
        </Card>

        {/* Ação: cancelar (só pending) */}
        {requisition.status === "pending" && (
          <Button
            variant="outline"
            className="w-full text-destructive border-destructive/30 hover:bg-destructive/5"
            onClick={() => setCancelOpen(true)}
          >
            <XCircle className="w-4 h-4 mr-2" />
            Cancelar Requisição
          </Button>
        )}
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
