"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { CheckCircle, ChevronLeft, Clock, Download, Package, XCircle } from "lucide-react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { notifyWithEmail } from "@/lib/notify-with-email"
import { getUserEmail } from "@/lib/email/get-user-email"
import {
  templateDeliveryUpdated,
  templateOrderAccepted,
  templateOrderRefused,
} from "@/lib/email/templates"
import { logAudit } from "@/lib/audit"
import { formatDateBR as formatDateBRForNotify } from "@/lib/utils/date-helpers"
import { useUser } from "@/lib/hooks/useUser"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
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
import { getPOStatusForSupplier } from "@/lib/po-status"

type CompanyEmbed = { name: string; cnpj: string | null } | { name: string; cnpj: string | null }[] | null

function companyBlock(embed: CompanyEmbed): { name: string; cnpj: string | null } {
  if (!embed) return { name: "—", cnpj: null }
  if (Array.isArray(embed)) {
    const c = embed[0]
    return { name: c?.name ?? "—", cnpj: c?.cnpj ?? null }
  }
  return { name: embed.name ?? "—", cnpj: embed.cnpj ?? null }
}

type PurchaseOrderDetail = {
  id: string
  code: string
  quotation_code: string | null
  requisition_code: string | null
  erp_code: string | null
  supplier_name: string
  supplier_cnpj: string | null
  payment_condition: string | null
  delivery_address: string | null
  total_price: number | null
  status: string
  observations: string | null
  created_at: string
  created_by: string | null
  quotation_id: string | null
  accepted_at: string | null
  estimated_delivery_date: string | null
  delivery_days: number | null
  accepted_by_supplier: boolean | null
  cancellation_reason: string | null
  updated_at: string | null
  company_id: string
  companies: CompanyEmbed
}

async function getPurchaseOrderBuyerUserId(
  supabase: ReturnType<typeof createClient>,
  order: Pick<PurchaseOrderDetail, "id" | "company_id" | "created_by" | "quotation_id">,
): Promise<string | null> {
  if (order.created_by) return order.created_by
  if (order.quotation_id) {
    const { data, error } = await supabase
      .from("quotations")
      .select("created_by")
      .eq("id", order.quotation_id)
      .single()
    if (error) {
      console.error("getPurchaseOrderBuyerUserId quotation:", error)
      return null
    }
    return data?.created_by ?? null
  }
  return null
}

type POItem = {
  id: string
  material_code: string
  material_description: string
  unit_of_measure: string | null
  quantity: number
  unit_price: number | null
  tax_percent: number | null
  total_price: number | null
  delivery_days: number | null
}

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
})

function formatDateBR(iso: string | null | undefined): string {
  if (!iso) return "—"
  const s = String(iso).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split("-").map(Number)
    return format(new Date(y, m - 1, d), "dd/MM/yyyy", { locale: ptBR })
  }
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return "—"
  return format(d, "dd/MM/yyyy", { locale: ptBR })
}

function toDateInputValue(iso: string | null | undefined): string {
  if (!iso) return ""
  const s = String(iso).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s.slice(0, 10)
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return ""
  return format(d, "yyyy-MM-dd")
}

function formatDateInputToBR(yyyyMmDd: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(yyyyMmDd)) return "—"
  const [y, m, d] = yyyyMmDd.split("-").map(Number)
  return format(new Date(y, m - 1, d), "dd/MM/yyyy", { locale: ptBR })
}

export default function FornecedorPedidoDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: orderId } = React.use(params)
  const router = useRouter()
  const { userId, supplierId } = useUser()

  const [order, setOrder] = React.useState<PurchaseOrderDetail | null>(null)
  const [items, setItems] = React.useState<POItem[]>([])
  const [loading, setLoading] = React.useState(true)
  const [notFound, setNotFound] = React.useState(false)

  const [estimatedDate, setEstimatedDate] = React.useState("")

  const [acceptOpen, setAcceptOpen] = React.useState(false)
  const [rejectOpen, setRejectOpen] = React.useState(false)
  const [rejectReason, setRejectReason] = React.useState("")
  const [dateChangeDialog, setDateChangeDialog] = React.useState(false)
  const [dateChangeReason, setDateChangeReason] = React.useState("")
  const [saving, setSaving] = React.useState(false)
  const [generatingPdf, setGeneratingPdf] = React.useState(false)

  const handleDownloadPDF = async () => {
    if (!order) return
    setGeneratingPdf(true)
    try {
      const response = await fetch(`/api/purchase-order-pdf?id=${order.id}`)
      if (!response.ok) throw new Error("Erro ao gerar PDF")
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `pedido_${order.code}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error(e)
      toast.error("Não foi possível gerar o PDF.")
    } finally {
      setGeneratingPdf(false)
    }
  }

  const fetchAll = React.useCallback(async () => {
    if (!supplierId || !orderId) return
    const supabase = createClient()
    const [orderResult, itemsResult] = await Promise.all([
      supabase
        .from("purchase_orders")
        .select(
          `
          id, code, quotation_code, requisition_code, erp_code,
          supplier_name, supplier_cnpj, payment_condition,
          delivery_address, total_price, status, observations,
          created_at, created_by, quotation_id,
          accepted_at, estimated_delivery_date, delivery_days,
          accepted_by_supplier, cancellation_reason, updated_at,
          company_id, companies(name, cnpj)
        `,
        )
        .eq("id", orderId)
        .eq("supplier_id", supplierId)
        .single(),
      supabase
        .from("purchase_order_items")
        .select("*")
        .eq("purchase_order_id", orderId)
        .order("material_code", { ascending: true }),
    ])

    if (orderResult.error || !orderResult.data) {
      setNotFound(true)
      setOrder(null)
      setItems([])
      return
    }

    const o = orderResult.data as PurchaseOrderDetail
    setNotFound(false)
    setOrder(o)

    if (itemsResult.error) {
      console.error("purchase_order_items error:", itemsResult.error)
    }
    const rows = (itemsResult.data as POItem[]) ?? []
    if (rows.length === 0) {
      console.log("items result:", itemsResult)
    }
    setItems(rows)

    const maxDaysFromItems = rows.reduce((max, item) => {
      const dd = item.delivery_days
      return dd != null && dd > max ? dd : max
    }, 0)
    const suggestedDays =
      maxDaysFromItems > 0 ? maxDaysFromItems : (o.delivery_days ?? 0)

    if (o.estimated_delivery_date) {
      const raw = String(o.estimated_delivery_date).trim()
      setEstimatedDate(/^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : toDateInputValue(o.estimated_delivery_date))
    } else if (suggestedDays > 0) {
      const suggested = new Date()
      suggested.setDate(suggested.getDate() + suggestedDays)
      const y = suggested.getFullYear()
      const m = String(suggested.getMonth() + 1).padStart(2, "0")
      const d = String(suggested.getDate()).padStart(2, "0")
      setEstimatedDate(`${y}-${m}-${d}`)
    } else {
      setEstimatedDate("")
    }
  }, [orderId, supplierId])

  React.useEffect(() => {
    if (!supplierId) {
      setLoading(false)
      return
    }
    let alive = true
    ;(async () => {
      setLoading(true)
      await fetchAll()
      if (alive) setLoading(false)
    })()
    return () => {
      alive = false
    }
  }, [fetchAll, supplierId])

  const co = order ? companyBlock(order.companies) : { name: "—", cnpj: null }
  const statusMeta = order ? getPOStatusForSupplier(order.status) : null

  const suggestedDays = React.useMemo(() => {
    if (!order) return 0
    const maxDaysFromItems = items.reduce((max, item) => {
      const dd = item.delivery_days
      return dd != null && dd > max ? dd : max
    }, 0)
    return maxDaysFromItems > 0 ? maxDaysFromItems : (order.delivery_days ?? 0)
  }, [order, items])

  const lineTotal = (it: POItem) => {
    if (it.total_price != null) return it.total_price
    const unit = Number(it.unit_price ?? 0)
    const base = Number(it.quantity ?? 0) * unit
    const tax = it.tax_percent != null ? base * (Number(it.tax_percent) / 100) : 0
    return base + tax
  }

  const formatUnitPrice = (it: POItem) =>
    money.format(Number(it.unit_price ?? 0))

  const handleAccept = async () => {
    if (!order || !supplierId || !estimatedDate.trim()) {
      toast.error("Informe a data de entrega prevista.")
      return
    }
    setSaving(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from("purchase_orders")
        .update({
          status: "processing",
          accepted_at: new Date().toISOString(),
          accepted_by_supplier: true,
          estimated_delivery_date: estimatedDate,
        })
        .eq("id", order.id)
        .eq("supplier_id", supplierId)
      if (error) throw error
      if (userId) {
        await logAudit({
          eventType: "purchase_order.accepted",
          description: `Pedido aceito — ${order.code}`,
          userId,
          companyId: order.company_id,
          entity: "purchase_orders",
          entityId: order.id,
          metadata: {
            order_code: order.code,
            estimated_delivery_date: estimatedDate,
            supplier_name: order.supplier_name,
          },
        })
      }
      try {
        const buyerId = await getPurchaseOrderBuyerUserId(supabase, order)
        if (buyerId) {
          const { data: buyerProfile } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", buyerId)
            .maybeSingle()
          const buyerEmail = await getUserEmail(buyerId)
          const { subject, html } = templateOrderAccepted({
            buyerName: buyerProfile?.full_name ?? "Comprador",
            supplierName: order.supplier_name,
            orderCode: order.code,
            estimatedDelivery: estimatedDate
              ? formatDateBRForNotify(estimatedDate)
              : undefined,
          })
          await notifyWithEmail({
            userId: buyerId,
            companyId: order.company_id,
            type: "order.accepted",
            title: "Pedido aceito pelo fornecedor",
            body: `${order.supplier_name} aceitou o ${order.code}`,
            entity: "purchase_orders",
            entityId: order.id,
            toEmail: buyerEmail ?? undefined,
            subject,
            html,
            emailPrefKey: "order_accepted_email",
          })
        }
      } catch (e) {
        console.error("notify order.accepted:", e)
      }
      toast.success("Pedido aceito com sucesso.")
      setAcceptOpen(false)
      await fetchAll()
    } catch (e) {
      console.error(e)
      toast.error("Não foi possível aceitar o pedido.")
    } finally {
      setSaving(false)
    }
  }

  const handleReject = async () => {
    if (!order || !supplierId) return
    const reason = rejectReason.trim()
    if (!reason) {
      toast.error("Informe o motivo da recusa.")
      return
    }
    setSaving(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from("purchase_orders")
        .update({
          status: "refused",
          cancellation_reason: reason,
        })
        .eq("id", order.id)
        .eq("supplier_id", supplierId)
      if (error) throw error
      if (userId) {
        await logAudit({
          eventType: "purchase_order.refused",
          description: `Pedido recusado — ${order.code}`,
          userId,
          companyId: order.company_id,
          entity: "purchase_orders",
          entityId: order.id,
          metadata: {
            order_code: order.code,
            cancellation_reason: reason,
            supplier_name: order.supplier_name,
          },
        })
      }
      try {
        const buyerId = await getPurchaseOrderBuyerUserId(supabase, order)
        if (buyerId) {
          const { data: buyerProfile } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", buyerId)
            .maybeSingle()
          const buyerEmail = await getUserEmail(buyerId)
          const { subject, html } = templateOrderRefused({
            buyerName: buyerProfile?.full_name ?? "Comprador",
            supplierName: order.supplier_name,
            orderCode: order.code,
            reason,
          })
          await notifyWithEmail({
            userId: buyerId,
            companyId: order.company_id,
            type: "order.refused",
            title: "Pedido recusado pelo fornecedor",
            body: `${order.supplier_name} recusou o ${order.code}. Motivo: ${reason}`,
            entity: "purchase_orders",
            entityId: order.id,
            toEmail: buyerEmail ?? undefined,
            subject,
            html,
            emailPrefKey: "order_refused_email",
          })
        }
      } catch (e) {
        console.error("notify order.refused:", e)
      }
      toast.success("Pedido recusado.")
      setRejectOpen(false)
      setRejectReason("")
      await fetchAll()
    } catch (e) {
      console.error(e)
      toast.error("Não foi possível recusar o pedido.")
    } finally {
      setSaving(false)
    }
  }

  const handleConfirmDateChange = async () => {
    const justification = dateChangeReason.trim()
    if (!justification) {
      toast.error("Informe a justificativa.")
      return
    }
    if (!order || !supplierId || !estimatedDate.trim()) {
      toast.error("Informe a nova data.")
      return
    }
    setSaving(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from("purchase_orders")
        .update({
          estimated_delivery_date: estimatedDate,
          delivery_date_change_reason: justification,
        })
        .eq("id", order.id)
        .eq("supplier_id", supplierId)
      if (error) throw error
      if (userId) {
        await logAudit({
          eventType: "purchase_order.delivery_updated",
          description: `Data de entrega atualizada — ${order.code}`,
          userId,
          companyId: order.company_id,
          entity: "purchase_orders",
          entityId: order.id,
          metadata: {
            order_code: order.code,
            new_date: estimatedDate,
            reason: justification,
            supplier_name: order.supplier_name,
          },
        })
      }
      try {
        const buyerId = await getPurchaseOrderBuyerUserId(supabase, order)
        if (buyerId) {
          const { data: buyerProfile } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", buyerId)
            .maybeSingle()
          const buyerEmail = await getUserEmail(buyerId)
          const newDateLabel = formatDateBRForNotify(estimatedDate)
          const { subject, html } = templateDeliveryUpdated({
            buyerName: buyerProfile?.full_name ?? "Comprador",
            supplierName: order.supplier_name,
            orderCode: order.code,
            newDate: newDateLabel,
            reason: justification,
          })
          await notifyWithEmail({
            userId: buyerId,
            companyId: order.company_id,
            type: "order.delivery_updated",
            title: "Data de entrega atualizada",
            body: `${order.supplier_name} atualizou a entrega do ${order.code} para ${newDateLabel}`,
            entity: "purchase_orders",
            entityId: order.id,
            toEmail: buyerEmail ?? undefined,
            subject,
            html,
            emailPrefKey: "delivery_done_email",
          })
        }
      } catch (e) {
        console.error("notify order.delivery_updated:", e)
      }
      toast.success("Data de entrega atualizada.")
      setDateChangeDialog(false)
      setDateChangeReason("")
      await fetchAll()
    } catch (e) {
      console.error(e)
      toast.error("Não foi possível atualizar a data.")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-40 animate-pulse rounded bg-muted" />
        <div className="h-48 animate-pulse rounded-xl bg-muted" />
      </div>
    )
  }

  if (!supplierId || notFound || !order) {
    return (
      <div className="space-y-4">
        <Button type="button" variant="ghost" onClick={() => router.push("/fornecedor/pedidos")}>
          <ChevronLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
        <p className="text-sm text-muted-foreground">Pedido não encontrado.</p>
      </div>
    )
  }

  const badgeColors: Record<string, string> = {
    amber: "bg-amber-50 text-amber-800 border-amber-200",
    blue: "bg-blue-50 text-blue-800 border-blue-200",
    green: "bg-green-50 text-green-800 border-green-200",
    red: "bg-red-50 text-red-800 border-red-200",
    slate: "bg-slate-50 text-slate-800 border-slate-200",
  }

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0 flex-wrap">
            <button
              type="button"
              onClick={() => router.back()}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground shrink-0"
            >
              <ChevronLeft className="w-4 h-4" />
              Voltar
            </button>
            <h1 className="text-2xl font-bold tracking-tight">{order.code}</h1>
            {statusMeta ? (
              <Badge variant="outline" className={badgeColors[statusMeta.color]}>
                {statusMeta.label}
              </Badge>
            ) : null}
            {["completed", "cancelled", "refused"].includes(order.status) ? (
              <Button
                type="button"
                variant="default"
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white"
                disabled={generatingPdf}
                onClick={() => void handleDownloadPDF()}
              >
                <Download className="mr-2 h-4 w-4" />
                {generatingPdf ? "Gerando..." : "PDF Pedido"}
              </Button>
            ) : null}
          </div>

          {order.status === "sent" ? (
            <div className="flex items-center gap-3 shrink-0 flex-wrap justify-end">
              <div className="flex flex-col gap-1">
                <label htmlFor="header-delivery-date" className="text-xs text-muted-foreground">
                  Data de Entrega Prevista *
                </label>
                <input
                  id="header-delivery-date"
                  type="date"
                  value={estimatedDate}
                  onChange={(e) => setEstimatedDate(e.target.value)}
                  className="h-9 border border-border rounded-md bg-background px-2 text-sm w-44"
                />
                {suggestedDays > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Sugerido: {suggestedDays} dias a partir do aceite
                  </p>
                ) : null}
              </div>
              <div className="flex items-center gap-2 mt-4">
                <Button
                  type="button"
                  variant="outline"
                  className="text-destructive border-destructive hover:bg-destructive/5"
                  onClick={() => setRejectOpen(true)}
                >
                  Recusar
                </Button>
                <Button
                  type="button"
                  className="bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => setAcceptOpen(true)}
                >
                  Aceitar Pedido
                </Button>
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                  disabled={generatingPdf}
                  onClick={() => void handleDownloadPDF()}
                >
                  <Download className="mr-2 h-4 w-4" />
                  {generatingPdf ? "Gerando..." : "PDF Pedido"}
                </Button>
              </div>
            </div>
          ) : null}

          {order.status === "processing" ? (
            <div className="flex items-center gap-3 shrink-0 flex-wrap justify-end">
              <div className="flex flex-col gap-1">
                <label htmlFor="header-update-date" className="text-xs text-muted-foreground">
                  Data de Entrega Prevista
                </label>
                <input
                  id="header-update-date"
                  type="date"
                  value={estimatedDate}
                  onChange={(e) => setEstimatedDate(e.target.value)}
                  className="h-9 border border-border rounded-md bg-background px-2 text-sm w-44"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                className="mt-4"
                disabled={saving}
                onClick={() => {
                  setDateChangeReason("")
                  setDateChangeDialog(true)
                }}
              >
                Atualizar Data
              </Button>
              <Button
                type="button"
                variant="default"
                size="sm"
                className="mt-4 bg-blue-600 hover:bg-blue-700 text-white"
                disabled={generatingPdf}
                onClick={() => void handleDownloadPDF()}
              >
                <Download className="mr-2 h-4 w-4" />
                {generatingPdf ? "Gerando..." : "PDF Pedido"}
              </Button>
            </div>
          ) : null}
        </div>

        <p className="text-sm text-muted-foreground mt-1 ml-[calc(theme(spacing.3)+theme(spacing.44))]">
          {co.name}
        </p>
      </div>

      {order.status === "sent" ? (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 mb-4 text-sm text-amber-700">
          <Clock className="w-4 h-4 shrink-0" aria-hidden />
          Este pedido aguarda seu aceite. Revise as condições e confirme.
        </div>
      ) : null}

      {order.status === "processing" ? (
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 mb-4 text-sm text-blue-700">
          <CheckCircle className="w-4 h-4 shrink-0" aria-hidden />
          Pedido aceito em {formatDateBR(order.accepted_at)}. Prepare a entrega conforme acordado.
        </div>
      ) : null}

      {order.status === "completed" ? (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-4 py-2 mb-4 text-sm text-green-700">
          <Package className="w-4 h-4 shrink-0" aria-hidden />
          Pedido finalizado.
        </div>
      ) : null}

      {order.status === "cancelled" ? (
        <div className="flex flex-col gap-1 bg-red-50 border border-red-200 rounded-lg px-4 py-2 mb-4 text-sm text-red-700">
          <div className="flex items-center gap-2">
            <XCircle className="w-4 h-4 shrink-0" aria-hidden />
            Pedido cancelado.
          </div>
          {order.cancellation_reason ? (
            <p className="ml-6 text-red-600">Motivo: {order.cancellation_reason}</p>
          ) : null}
        </div>
      ) : null}

      {order.status === "refused" ? (
        <div className="flex flex-col gap-1 bg-red-50 border border-red-200 rounded-lg px-4 py-2 mb-4 text-sm text-red-700">
          <div className="flex items-center gap-2">
            <XCircle className="w-4 h-4 shrink-0" aria-hidden />
            <span>
              Você recusou este pedido. Motivo: {order.cancellation_reason ?? "—"}
            </span>
          </div>
          <p className="ml-6 text-red-600">
            Aguarde o comprador revisar e reenviar o pedido.
          </p>
        </div>
      ) : null}

      {["draft", "error"].includes(order.status) ? (
        <p className="text-sm text-muted-foreground mb-4">
          Este pedido não está disponível para ações do fornecedor neste status.
        </p>
      ) : null}

      <div className="bg-white border border-border rounded-xl p-6">
        <h2 className="text-sm font-semibold text-foreground mb-4">Informações do Pedido</h2>
        <div className="grid gap-6 md:grid-cols-2 text-sm">
          <div className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground">Cotação de Origem</p>
              <p className="font-medium">{order.quotation_code ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Requisição</p>
              <p>{order.requisition_code ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Código ERP</p>
              <p>{order.erp_code ?? "Aguardando integração"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Condição de Pagamento</p>
              <p>{order.payment_condition ?? "—"}</p>
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground">Data do Pedido</p>
              <p>{formatDateBR(order.created_at)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Data Aceite</p>
              <p>{formatDateBR(order.accepted_at)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Entrega Prevista</p>
              <p>{formatDateBR(order.estimated_delivery_date)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Endereço de Entrega</p>
              <p>{order.delivery_address ?? "—"}</p>
            </div>
          </div>
        </div>
      </div>

      {order.observations?.trim() ? (
        <div className="bg-white border border-border rounded-xl p-6">
          <h2 className="text-sm font-semibold text-foreground mb-2">Observações</h2>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{order.observations}</p>
        </div>
      ) : null}

      <div className="bg-white border border-border rounded-xl p-6">
        <h2 className="text-sm font-semibold text-foreground mb-4">Itens do Pedido</h2>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>Cód. Material</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="text-center">UN</TableHead>
                <TableHead className="text-right">Qtd</TableHead>
                <TableHead className="text-right">Preço Unit.</TableHead>
                <TableHead className="text-right">Imposto %</TableHead>
                <TableHead className="text-right">Total Item</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">
                    Nenhum item retornado para este pedido. Verifique o console se houver erro de
                    permissão ou seed.
                  </TableCell>
                </TableRow>
              ) : (
                items.map((it, i) => (
                  <TableRow key={it.id}>
                    <TableCell>{i + 1}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {it.material_code ?? "—"}
                    </TableCell>
                    <TableCell className="max-w-[220px]">
                      {it.material_description ?? "—"}
                    </TableCell>
                    <TableCell className="text-center">{it.unit_of_measure ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {it.quantity ?? "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatUnitPrice(it)}</TableCell>
                    <TableCell className="text-right">
                      {it.tax_percent == null ? "—" : `${it.tax_percent}%`}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {money.format(lineTotal(it))}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        <div className="mt-4 flex justify-end border-t border-border pt-4">
          <p className="text-lg font-bold tabular-nums">
            Total Geral: {money.format(order.total_price ?? 0)}
          </p>
        </div>
      </div>

      <AlertDialog open={acceptOpen} onOpenChange={setAcceptOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar aceite</AlertDialogTitle>
            <AlertDialogDescription>
              Confirmar aceite do pedido {order.code}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={saving}
              onClick={(e) => {
                e.preventDefault()
                void handleAccept()
              }}
            >
              {saving ? "Salvando…" : "Confirmar aceite"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recusar pedido</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label htmlFor="reject-reason">Motivo da recusa</Label>
            <Textarea
              id="reject-reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={4}
              placeholder="Descreva o motivo..."
              required
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRejectOpen(false)}>
              Voltar
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={saving}
              onClick={() => void handleReject()}
            >
              {saving ? "Enviando…" : "Confirmar recusa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dateChangeDialog} onOpenChange={setDateChangeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar data de entrega</DialogTitle>
            <DialogDescription>
              Informe o motivo da alteração da data de entrega
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <p className="text-sm text-muted-foreground">
              Nova data: <span className="font-medium text-foreground">{formatDateInputToBR(estimatedDate)}</span>
            </p>
            <div className="grid gap-2">
              <Label htmlFor="date-change-reason">Justificativa *</Label>
              <Textarea
                id="date-change-reason"
                value={dateChangeReason}
                onChange={(e) => setDateChangeReason(e.target.value)}
                rows={4}
                placeholder="Ex: Atraso no fornecimento de matéria-prima..."
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDateChangeDialog(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={saving}
              onClick={() => void handleConfirmDateChange()}
            >
              {saving ? "Salvando…" : "Confirmar Alteração"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
