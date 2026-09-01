"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  formatDateBR,
  formatDateTimeCompactBR,
  formatDateTimeLongBR,
} from "@/lib/formato-data"
import { createClient } from "@/lib/supabase/client"
import { useAutoRefresh } from "@/lib/hooks/use-auto-refresh"
import { usePollingIntervalMs } from "@/lib/hooks/use-polling-interval"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
  AlertCircle,
  ChevronLeft,
  ClipboardList,
  CheckCircle2,
  XCircle,
  Clock,
  Circle,
  FileText,
  Loader2,
  Pencil,
} from "lucide-react"
import {
  getRequisitionStatusMeta,
  type RequisitionStatus,
} from "@/lib/requisitions/status"
import {
  buildCatalogRequisitionTimeline,
  buildStandardRequisitionTimeline,
} from "@/lib/requisitions/timeline"
import { REQUISITION_ITEM_ACCOUNT_SELECT } from "@/lib/requisitions/line-items-helpers"
import {
  RequisitionLineItemsDetailSection,
  type RequisitionDetailLineItem,
} from "@/components/requisitions/requisition-line-items-detail-section"

type Requisition = {
  id: string
  company_id: string
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
  origin: string | null
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
  accepted_at?: string | null
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

type RequisitionItem = RequisitionDetailLineItem

function getStatusMeta(status: string) {
  return getRequisitionStatusMeta(status)
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
  const steps =
    req.origin === "catalog"
      ? buildCatalogRequisitionTimeline(req, orders)
      : buildStandardRequisitionTimeline(req, quotation, orders, {
          includeCancelledBranch: true,
        })

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
            cancelled: {
              circle: "bg-red-500 border-red-500",
              text: "text-red-700",
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
                {step.status === "cancelled" && (
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
                    {formatDateTimeCompactBR(step.date)}
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
              {formatDateTimeLongBR(req.created_at)}
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
                  {formatDateTimeLongBR(h.decided_at ?? h.created_at)}
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
                  {formatDateTimeLongBR(log.created_at)}
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
  const [auditLogs, setAuditLogs] = React.useState<AuditLog[]>([])
  const [items, setItems] = React.useState<RequisitionItem[]>([])
  const [loading, setLoading] = React.useState(true)
  const [cancelOpen, setCancelOpen] = React.useState(false)
  const [cancelling, setCancelling] = React.useState(false)

  const loadData = React.useCallback(async () => {
    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        window.location.href = "/login"
        return
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("profile_type, is_superadmin, role, roles")
        .eq("id", user.id)
        .maybeSingle()

      const roles = Array.isArray(profile?.roles) ? profile.roles : []
      const viewAll =
        Boolean(profile?.is_superadmin) ||
        profile?.role === "admin" ||
        roles.includes("admin")

      let reqQuery = supabase.from("requisitions").select("*").eq("id", id)
      if (!viewAll) {
        reqQuery = reqQuery.eq("requester_id", user.id)
      }

      const { data: reqData, error: reqError } = await reqQuery.maybeSingle()

      if (reqError || !reqData) {
        toast.error("Requisição não encontrada.")
        router.push("/solicitante")
        return
      }

      const req = reqData as Requisition
      setRequisition(req)

      const [historyResult, itemsResult, ordersResult, auditResult] = await Promise.all([
        supabase
          .from("approval_requests")
          .select("id, status, approver_name, rejection_reason, decided_at, created_at")
          .eq("entity_id", id)
          .eq("flow", "requisition")
          .order("created_at", { ascending: true }),
        supabase
          .from("requisition_items")
          .select(REQUISITION_ITEM_ACCOUNT_SELECT)
          .eq("requisition_id", id)
          .order("created_at"),
        supabase
          .from("purchase_orders")
          .select(
            "id, code, status, supplier_name, total_price, created_at, accepted_at, estimated_delivery_date",
          )
          .eq("requisition_code", req.code)
          .order("created_at"),
        supabase
          .from("audit_logs")
          .select("id, event_type, description, created_at, user_name, metadata")
          .eq("entity", "requisitions")
          .eq("entity_id", id)
          .order("created_at", { ascending: true }),
      ])

      setHistory((historyResult.data as ApprovalHistory[]) ?? [])
      setAuditLogs((auditResult.data ?? []) as AuditLog[])
      setItems((itemsResult.data as RequisitionItem[]) ?? [])
      setOrders((ordersResult.data as PurchaseOrderInfo[]) ?? [])

      let quot: QuotationInfo | null = null
      if (req.quotation_id) {
        const { data: qData } = await supabase
          .from("quotations")
          .select("id, code, status, created_at")
          .eq("id", req.quotation_id)
          .maybeSingle()
        if (qData) quot = qData as QuotationInfo
      }
      setQuotation(quot)
    } catch {
      toast.error("Não foi possível carregar a requisição.")
      router.push("/solicitante")
    } finally {
      setLoading(false)
    }
  }, [id, router])

  React.useEffect(() => {
    void loadData()
  }, [loadData])

  const pollingIntervalMs = usePollingIntervalMs()

  useAutoRefresh({
    intervalMs: pollingIntervalMs,
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
      .update({ status: "cancelled", rejection_reason: "Cancelado pelo solicitante" })
      .eq("id", requisition.id)
      .eq("requester_id", user.id)

    setCancelOpen(false)
    setCancelling(false)
    void loadData()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
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
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push("/solicitante")}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
      </div>

      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{requisition.code}</h1>
            <p className="text-muted-foreground text-sm mt-0.5">{requisition.title}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge className={statusMeta.className}>{statusMeta.label}</Badge>
            {requisition.status === "draft" && (
              <>
                <Button
                  size="sm"
                  onClick={() => router.push(`/solicitante/${id}/editar`)}
                >
                  <Pencil className="w-4 h-4 mr-2" />
                  Continuar edição
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive border-destructive/30 hover:bg-destructive/5"
                  onClick={() => setCancelOpen(true)}
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Descartar Rascunho
                </Button>
              </>
            )}
            {requisition.status === "rejected" && (
              <Button size="sm" onClick={() => router.push(`/solicitante/${id}/editar`)}>
                <Pencil className="w-4 h-4 mr-2" />
                Editar e Resubmeter
              </Button>
            )}
            {requisition.status === "pending" &&
              !requisition.quotation_id &&
              orders.length === 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive border-destructive/30 hover:bg-destructive/5"
                  onClick={() => setCancelOpen(true)}
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Cancelar Requisição
                </Button>
              )}
          </div>
        </div>

        {requisition.status === "pending" &&
          (requisition.quotation_id || orders.length > 0) && (
            <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground text-center">
              Esta requisição já possui cotação ou pedido vinculado e não pode ser cancelada.
              Entre em contato com o comprador para encerrar o processo.
            </div>
          )}

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
                  {formatDateBR(requisition.created_at)}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Data de Necessidade
                </p>
                <p className="text-sm text-foreground font-medium">
                  {requisition.needed_by
                    ? formatDateBR(requisition.needed_by)
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
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Número do Pedido
                </p>
                <p className="text-sm text-foreground font-medium">
                  {orders.length > 0
                    ? orders.map((o) => o.code).join(", ")
                    : "—"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <RequisitionLineItemsDetailSection
          companyId={requisition.company_id}
          items={items}
        />

        <HistorySection history={history} req={requisition} auditLogs={auditLogs} />
      </div>

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {requisition.status === "draft" ? "Descartar Rascunho" : "Cancelar Requisição"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {requisition.status === "draft"
                ? `Tem certeza que deseja descartar o rascunho ${requisition.code}? Esta ação não pode ser desfeita.`
                : `Tem certeza que deseja cancelar a requisição ${requisition.code}? Esta ação não pode ser desfeita.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleCancel()}
              disabled={cancelling}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cancelling
                ? requisition.status === "draft"
                  ? "Descartando..."
                  : "Cancelando..."
                : requisition.status === "draft"
                  ? "Confirmar Descarte"
                  : "Confirmar Cancelamento"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
