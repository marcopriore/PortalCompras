"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  formatDateBR,
  formatDateTimeCompactBR,
  formatDateTimeLongBR,
} from "@/lib/formato-data"

import { toast } from "sonner"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { useUser } from "@/lib/hooks/useUser"
import { queryKeys } from "@/lib/queries/keys"
import {
  requisitionAttachmentsQueryOptions,
  requisitionDetailQueryOptions,
  type RequisitionAttachmentDto,
  type RequisitionDetailAuditLog,
  type RequisitionDetailApprovalHistory,
  type RequisitionDetailPurchaseOrder,
  type RequisitionDetailQuotationInfo,
  type RequisitionDetailRequisition,
} from "@/lib/queries/requisition-detail"
import { usePermissions } from "@/lib/hooks/usePermissions"
import { createDraftFromRequisition } from "@/lib/purchase-orders/create-draft-from-requisition"
import {
  isOwnRequisitionCreator,
  OWN_REQUISITION_ORDER_BLOCKED_MESSAGE,
} from "@/lib/requisitions/own-requisition-guard"

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
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  Circle,
  ClipboardList,
  Clock,
  Download,
  FileText,
  Loader2,
  Paperclip,
  Pencil,
  ShieldAlert,
  ShoppingCart,
  XCircle,
} from "lucide-react"
import {
  getRequisitionStatusMeta,
  type RequisitionStatus,
} from "@/lib/requisitions/status"
import {
  buildCatalogRequisitionTimeline,
  buildStandardRequisitionTimeline,
} from "@/lib/requisitions/timeline"
import {
  RequisitionLineItemsDetailSection,
  type RequisitionDetailLineItem,
} from "@/components/requisitions/requisition-line-items-detail-section"
import { EntityApprovalActions } from "@/components/comprador/entity-approval-actions"

type RequisitionItem = RequisitionDetailLineItem

type Requisition = RequisitionDetailRequisition & {
  requisition_items?: RequisitionItem[]
}

type QuotationInfo = RequisitionDetailQuotationInfo

type PurchaseOrderInfo = RequisitionDetailPurchaseOrder

type ApprovalHistory = RequisitionDetailApprovalHistory

type RequisitionAttachment = RequisitionAttachmentDto

type AuditLog = RequisitionDetailAuditLog

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
      : buildStandardRequisitionTimeline(req, quotation, orders)

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

function getStatusMeta(status: RequisitionStatus): { label: string; className: string } {
  return getRequisitionStatusMeta(status)
}

export default function RequisicaoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { hasFeature, hasPermission } = usePermissions()
  const { companyId, userId } = useUser()
  const { id } = React.use(params)
  const supabase = createClient()
  const queryClient = useQueryClient()

  const backHref = searchParams.get("from") === "aprovacoes" ? "/comprador/aprovacoes" : "/comprador/requisicoes"

  const [quotationOpen, setQuotationOpen] = React.useState(false)
  const [creatingPo, setCreatingPo] = React.useState(false)

  const detailQuery = useQuery({
    ...requisitionDetailQueryOptions(companyId ?? "", id, () => supabase),
    enabled: Boolean(companyId && id),
  })

  const attachmentsQuery = useQuery({
    ...requisitionAttachmentsQueryOptions(id),
    enabled: Boolean(id),
  })

  const loading = detailQuery.isLoading
  const requisition = detailQuery.data?.requisition ?? null
  const items = detailQuery.data?.items ?? []
  const linkedQuotation = detailQuery.data?.linkedQuotation ?? null
  const quotationData = detailQuery.data?.quotation ?? null
  const orders = detailQuery.data?.orders ?? []
  const history = detailQuery.data?.history ?? []
  const auditLogs = detailQuery.data?.auditLogs ?? []
  const attachments = attachmentsQuery.data ?? []
  const attachmentsLoading = attachmentsQuery.isLoading

  const invalidateRequisitionDetail = React.useCallback(async () => {
    if (!companyId || !id) return
    await queryClient.invalidateQueries({
      queryKey: queryKeys.requisitionDetail(companyId, id),
    })
    await queryClient.invalidateQueries({
      queryKey: queryKeys.requisitionAttachments(id),
    })
  }, [companyId, id, queryClient])

  const statusMeta = requisition ? getStatusMeta(requisition.status) : null

  const originLabel =
    requisition?.origin === "catalog"
      ? "Catálogo de Compras"
      : requisition?.origin === "manual"
        ? "Manual"
        : "Integração ERP"

  const handleGerarCotacao = () => {
    if (!requisition) return
    if (isOwnRequisitionCreator(userId, requisition.requester_id)) {
      toast.error(OWN_REQUISITION_ORDER_BLOCKED_MESSAGE)
      return
    }
    router.push(`/comprador/cotacoes/nova?requisition_id=${requisition.id}`)
  }

  const handleGerarPedido = async () => {
    if (!requisition || !companyId || !userId || creatingPo) return
    if (isOwnRequisitionCreator(userId, requisition.requester_id)) {
      toast.error(OWN_REQUISITION_ORDER_BLOCKED_MESSAGE)
      return
    }
    setCreatingPo(true)
    try {
      const supabase = createClient()
      const result = await createDraftFromRequisition(supabase, {
        companyId,
        userId,
        requisitionId: requisition.id,
      })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      if (result.codes && result.codes.length > 1) {
        toast.success(`${result.codes.length} pedidos criados: ${result.codes.join(", ")}`)
        router.push("/comprador/pedidos")
        return
      }
      router.push(`/comprador/pedidos/${result.purchaseOrderId}`)
    } catch {
      toast.error("Não foi possível criar o pedido.")
    } finally {
      setCreatingPo(false)
    }
  }

  const canCreateOrder =
    hasPermission("order.create") &&
    (requisition?.status === "approved" || requisition?.status === "in_quotation")

  const isOwnRequisition = isOwnRequisitionCreator(
    userId,
    requisition?.requester_id,
  )
  const canGenerateOrder = canCreateOrder && !isOwnRequisition

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
          <EntityApprovalActions
            flow="requisition"
            entityId={id}
            companyId={companyId}
            onDecided={() => void invalidateRequisitionDetail()}
          />
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
          {requisition.status === "draft" && (
            <Button
              type="button"
              onClick={() => router.push(`/comprador/requisicoes/${id}/editar`)}
            >
              <Pencil className="h-4 w-4 mr-2" />
              Continuar edição
            </Button>
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
          {requisition.status === "approved" && !isOwnRequisition && (
            <Button type="button" onClick={() => setQuotationOpen(true)}>
              Gerar Cotação
            </Button>
          )}
          {isOwnRequisition &&
            (requisition.status === "approved" || canCreateOrder) && (
            <Badge
              variant="outline"
              className="gap-1 border-amber-300 bg-amber-50 text-amber-900 max-w-full whitespace-normal text-left"
              title={OWN_REQUISITION_ORDER_BLOCKED_MESSAGE}
            >
              <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
              {OWN_REQUISITION_ORDER_BLOCKED_MESSAGE}
            </Badge>
          )}
          {canGenerateOrder && (
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleGerarPedido()}
              disabled={creatingPo}
            >
              {creatingPo ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <ShoppingCart className="h-4 w-4 mr-2" />
              )}
              {creatingPo ? "Criando..." : "Gerar Pedido"}
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
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Número do Pedido</p>
              <p className="text-sm text-foreground font-medium">
                {orders.length === 0
                  ? "—"
                  : orders.map((o, idx) => (
                      <span key={o.id}>
                        {idx > 0 ? ", " : ""}
                        <a
                          href={`/comprador/pedidos/${o.id}`}
                          className="text-primary hover:underline"
                        >
                          {o.code}
                        </a>
                      </span>
                    ))}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <RequisitionLineItemsDetailSection companyId={companyId} items={items} />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Paperclip className="h-4 w-4 text-muted-foreground" />
            <CardTitle>Anexos</CardTitle>
          </div>
          {!attachmentsLoading && (
            <Badge variant="outline" className="text-xs">
              {attachments.length} anexo{attachments.length === 1 ? "" : "s"}
            </Badge>
          )}
        </CardHeader>
        <CardContent>
          {attachmentsLoading ? (
            <p className="text-sm text-muted-foreground">Carregando anexos...</p>
          ) : attachments.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum anexo.</p>
          ) : (
            <ul className="space-y-2">
              {attachments.map((att) => (
                <li
                  key={att.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="text-sm font-medium truncate">{att.file_name}</span>
                  </div>
                  {att.download_url ? (
                    <a
                      href={att.download_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-primary hover:underline shrink-0"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Baixar
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
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

