"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { createClient } from "@/lib/supabase/client"
import { notifyWithEmail } from "@/lib/notify-with-email"
import { useUser } from "@/lib/hooks/useUser"
import { logAudit } from "@/lib/audit"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
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
  AlertTriangle,
  Calendar,
  CheckCircle,
  CheckCircle2,
  ChevronLeft,
  Download,
  FileEdit,
  FileText,
  Package,
  Pencil,
  Send,
  X,
  XCircle,
} from "lucide-react"
import { toast } from "sonner"
import type { LucideIcon } from "lucide-react"
import { getPOStatusForBuyer, poStatusBadgeClass } from "@/lib/po-status"
import { formatDateBR, formatDateTimeBR } from "@/lib/utils/date-helpers"

type PurchaseOrderStatus =
  | "draft"
  | "processing"
  | "sent"
  | "refused"
  | "error"
  | "completed"
  | "cancelled"

type PurchaseOrder = {
  id: string
  company_id: string
  code: string
  erp_code: string | null
  supplier_id: string | null
  supplier_name: string
  supplier_cnpj: string | null
  payment_condition: string | null
  delivery_days: number | null
  delivery_address: string | null
  quotation_code: string | null
  requisition_code: string | null
  total_price: number | null
  status: PurchaseOrderStatus
  erp_error_message: string | null
  cancellation_reason: string | null
  estimated_delivery_date: string | null
  delivery_date_change_reason: string | null
  accepted_at: string | null
  observations: string | null
  created_at: string
  updated_at: string | null
}

type PurchaseOrderItem = {
  id: string
  material_code: string
  material_description: string
  quantity: number
  unit_of_measure: string | null
  unit_price: number
  tax_percent: number | null
  total_price: number | null
}

type EditItem = {
  id: string
  material_code: string
  material_description: string
  unit_of_measure: string
  unit_price: number
  tax_percent: number | null
  quantity: number
  max_quantity: number | null
}

async function notifySupplierOrderSent(order: {
  id: string
  code: string
  supplier_name: string
  company_id: string
  supplier_id: string | null
}) {
  if (!order.supplier_id) return

  try {
    const supabase = createClient()
    const { data: supplierProfile } = await supabase
      .from("profiles")
      .select("id, full_name")
      .eq("supplier_id", order.supplier_id)
      .eq("company_id", order.company_id)
      .eq("profile_type", "supplier")
      .maybeSingle()

    if (!supplierProfile) return

    await notifyWithEmail({
      userId: supplierProfile.id,
      companyId: order.company_id,
      type: "order.sent",
      title: "Novo pedido de compra recebido",
      body: `O pedido ${order.code} foi emitido para você. Acesse o portal para visualizar e aceitar.`,
      entity: "purchase_order",
      entityId: order.id,
      subject: `Novo Pedido de Compra — ${order.code}`,
      html: `<p>Olá, <strong>${supplierProfile.full_name ?? order.supplier_name}</strong>!</p>
           <p>O pedido <strong>${order.code}</strong> foi emitido para você.</p>
           <p>Acesse o portal do fornecedor para visualizar os detalhes e confirmar o recebimento.</p>`,
      emailPrefKey: "order_approved_email",
    })
  } catch {
    // notificação não deve interromper o fluxo do pedido
  }
}

type PaymentConditionOption = {
  id: string
  code: string
  description: string
}

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
})

type AuditLog = {
  id: string
  event_type: string
  description: string
  created_at: string
  user_name: string | null
  metadata: Record<string, unknown> | null
}

type TimelineEvent = {
  id: string
  date: string
  title: string
  description?: string
  actor?: string
  type: "system" | "buyer" | "supplier" | "error"
  icon: LucideIcon
  iconColor: string
}

function buildTimeline(order: PurchaseOrder, logs: AuditLog[]): TimelineEvent[] {
  const inferred: TimelineEvent[] = []

  const qCode = order.quotation_code?.trim()
  inferred.push({
    id: "inf-created",
    date: order.created_at,
    title: "Pedido criado",
    description: qCode
      ? `Rascunho gerado a partir da cotação ${qCode}`
      : undefined,
    type: "buyer",
    icon: FileText,
    iconColor: "text-blue-500",
  })

  if (order.status !== "draft") {
    inferred.push({
      id: "inf-sent",
      date: order.created_at,
      title: "Enviado ao fornecedor",
      description: `Aguardando aceite de ${order.supplier_name}`,
      type: "buyer",
      icon: Send,
      iconColor: "text-blue-500",
    })
  }

  const hasAcceptedLog = logs.some((l) => l.event_type === "purchase_order.accepted")
  if (order.accepted_at && !hasAcceptedLog) {
    const est = order.estimated_delivery_date
    inferred.push({
      id: "inf-accepted",
      date: order.accepted_at,
      title: "Pedido aceito pelo fornecedor",
      description: est ? `Entrega prevista: ${formatDateBR(est)}` : undefined,
      type: "supplier",
      icon: CheckCircle,
      iconColor: "text-green-500",
    })
  }

  const deliveryLogs = logs.filter(
    (l) => l.event_type === "purchase_order.delivery_updated",
  )
  if (order.delivery_date_change_reason?.trim() && deliveryLogs.length === 0) {
    const d = order.updated_at ?? order.created_at
    inferred.push({
      id: "inf-delivery",
      date: d,
      title: "Data de entrega atualizada",
      description: `Motivo: ${order.delivery_date_change_reason}`,
      type: "supplier",
      icon: Calendar,
      iconColor: "text-amber-500",
    })
  }

  const hasRefusedLog = logs.some((l) => l.event_type === "purchase_order.refused")
  if (order.status === "refused" && !hasRefusedLog) {
    const d = order.updated_at ?? order.created_at
    inferred.push({
      id: "inf-refused",
      date: d,
      title: "Pedido recusado pelo fornecedor",
      description: order.cancellation_reason
        ? `Motivo: ${order.cancellation_reason}`
        : undefined,
      type: "supplier",
      icon: XCircle,
      iconColor: "text-red-500",
    })
  }

  if (order.status === "cancelled") {
    const d = order.updated_at ?? order.created_at
    inferred.push({
      id: "inf-cancelled",
      date: d,
      title: "Pedido cancelado",
      description: order.cancellation_reason ?? undefined,
      type: "buyer",
      icon: XCircle,
      iconColor: "text-red-500",
    })
  }

  if (order.status === "completed") {
    const d = order.updated_at ?? order.created_at
    inferred.push({
      id: "inf-completed",
      date: d,
      title: "Pedido finalizado",
      type: "system",
      icon: Package,
      iconColor: "text-green-500",
    })
  }

  if (order.status === "error") {
    const d = order.updated_at ?? order.created_at
    inferred.push({
      id: "inf-error",
      date: d,
      title: "Erro na integração ERP",
      description: order.erp_error_message ?? undefined,
      type: "error",
      icon: AlertTriangle,
      iconColor: "text-red-500",
    })
  }

  const fromLogs: TimelineEvent[] = []

  for (const log of logs) {
    const meta = log.metadata ?? {}
    if (log.event_type === "purchase_order.accepted") {
      const est = meta.estimated_delivery_date
      const estStr =
        typeof est === "string" && est.trim()
          ? `Entrega prevista: ${formatDateBR(est)}`
          : undefined
      fromLogs.push({
        id: `log-${log.id}`,
        date: log.created_at,
        title: "Pedido aceito pelo fornecedor",
        description: estStr ?? (log.description?.trim() ? log.description : undefined),
        actor: log.user_name ?? undefined,
        type: "supplier",
        icon: CheckCircle,
        iconColor: "text-green-500",
      })
    } else if (log.event_type === "purchase_order.refused") {
      const reason = meta.cancellation_reason
      const reasonStr =
        typeof reason === "string" && reason.trim() ? `Motivo: ${reason}` : undefined
      fromLogs.push({
        id: `log-${log.id}`,
        date: log.created_at,
        title: "Pedido recusado pelo fornecedor",
        description:
          reasonStr ?? (log.description?.trim() ? log.description : undefined),
        actor: log.user_name ?? undefined,
        type: "supplier",
        icon: XCircle,
        iconColor: "text-red-500",
      })
    } else if (log.event_type === "purchase_order.delivery_updated") {
      const reason = meta.reason
      const newDate = meta.new_date
      const parts: string[] = []
      if (typeof reason === "string" && reason.trim()) {
        parts.push(`Motivo: ${reason}`)
      }
      if (typeof newDate === "string" && newDate.trim()) {
        parts.push(`Nova data: ${formatDateBR(newDate)}`)
      }
      const fromMeta = parts.length > 0 ? parts.join(" · ") : undefined
      fromLogs.push({
        id: `log-${log.id}`,
        date: log.created_at,
        title: "Data de entrega atualizada",
        description:
          fromMeta ?? (log.description?.trim() ? log.description : undefined),
        actor: log.user_name ?? undefined,
        type: "supplier",
        icon: Calendar,
        iconColor: "text-amber-500",
      })
    }
  }

  const merged = [...inferred, ...fromLogs]
  merged.sort(
    (a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime() ||
      a.id.localeCompare(b.id),
  )
  return merged
}

function formatDateBRDateOnly(value: string | null | undefined): string {
  if (!value) return "—"
  const s = String(value).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split("-").map(Number)
    return format(new Date(y, m - 1, d), "dd/MM/yyyy", { locale: ptBR })
  }
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return "—"
  return format(d, "dd/MM/yyyy", { locale: ptBR })
}

function addCalendarDaysFromAcceptedAt(acceptedAtIso: string, days: number): string {
  const d = new Date(acceptedAtIso)
  if (Number.isNaN(d.getTime())) return ""
  d.setDate(d.getDate() + days)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function getOrderEstimatedDeliveryLabel(order: PurchaseOrder): string {
  if (order.estimated_delivery_date) {
    return formatDateBRDateOnly(order.estimated_delivery_date)
  }
  if (order.accepted_at && order.delivery_days != null && order.delivery_days > 0) {
    const ymd = addCalendarDaysFromAcceptedAt(order.accepted_at, order.delivery_days)
    return ymd ? formatDateBRDateOnly(ymd) : "—"
  }
  return "—"
}

function getTodayDDMMYYYY() {
  const now = new Date()
  const dd = String(now.getDate()).padStart(2, "0")
  const mm = String(now.getMonth() + 1).padStart(2, "0")
  const yyyy = String(now.getFullYear())
  return `${dd}${mm}${yyyy}`
}

async function downloadExcel(workbook: any, filename: string) {
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

export default function PurchaseOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const router = useRouter()
  const { companyId, userId, loading: userLoading } = useUser()
  const { id } = React.use(params)

  const [order, setOrder] = React.useState<PurchaseOrder | null>(null)
  const [orderLogs, setOrderLogs] = React.useState<AuditLog[]>([])
  const [items, setItems] = React.useState<PurchaseOrderItem[]>([])
  const [paymentOptions, setPaymentOptions] = React.useState<PaymentConditionOption[]>([])
  const [loading, setLoading] = React.useState(true)
  const [exporting, setExporting] = React.useState(false)
  const [generatingPdf, setGeneratingPdf] = React.useState(false)
  const [confirmingPedido, setConfirmingPedido] = React.useState(false)
  const [cancellingPedido, setCancellingPedido] = React.useState(false)
  const [cancelRefusedOpen, setCancelRefusedOpen] = React.useState(false)
  const [resendOpen, setResendOpen] = React.useState(false)
  const [cancellingRefused, setCancellingRefused] = React.useState(false)
  const [resendingOrder, setResendingOrder] = React.useState(false)

  const [isEditing, setIsEditing] = React.useState(false)
  const [editForm, setEditForm] = React.useState({
    payment_condition: "",
    delivery_days: "",
    delivery_address: "",
    observations: "",
  })
  const [editItems, setEditItems] = React.useState<EditItem[]>([])
  const [savingEdit, setSavingEdit] = React.useState(false)

  const fetchOrderData = React.useCallback(
    async (options?: { silent?: boolean }) => {
      if (userLoading || !id || !companyId) return
      const silent = options?.silent ?? false
      if (!silent) setLoading(true)
      try {
        const supabase = createClient()
        const [orderRes, itemsRes, paymentsRes, logsRes] = await Promise.all([
          supabase
            .from("purchase_orders")
            .select("*")
            .eq("id", id)
            .eq("company_id", companyId)
            .single(),
          supabase
            .from("purchase_order_items")
            .select("*")
            .eq("purchase_order_id", id)
            .order("material_code", { ascending: true }),
          supabase
            .from("payment_conditions")
            .select("id, code, description")
            .eq("company_id", companyId)
            .eq("active", true)
            .order("code", { ascending: true }),
          supabase
            .from("audit_logs")
            .select("id, event_type, description, created_at, user_name, metadata")
            .eq("entity_id", id)
            .in("event_type", [
              "purchase_order.accepted",
              "purchase_order.refused",
              "purchase_order.delivery_updated",
            ])
            .order("created_at", { ascending: true }),
        ])
        setOrder((orderRes.data as PurchaseOrder) ?? null)
        const poItems = ((itemsRes.data as unknown) as PurchaseOrderItem[]) ?? []
        setItems(poItems)
        setPaymentOptions(((paymentsRes.data as PaymentConditionOption[]) ?? []) as PaymentConditionOption[])
        if (logsRes.error) {
          setOrderLogs([])
        } else {
          setOrderLogs((logsRes.data as AuditLog[]) ?? [])
        }
      } finally {
        if (!silent) setLoading(false)
      }
    },
    [companyId, id, userLoading],
  )

  React.useEffect(() => {
    void fetchOrderData()
  }, [fetchOrderData])

  React.useEffect(() => {
    if (!order) return
    if (order.status !== "refused") setIsEditing(false)
  }, [order])

  const timeline = React.useMemo(
    () => (order ? buildTimeline(order, orderLogs) : []),
    [order, orderLogs],
  )

  const handleConfirmOrder = async () => {
    if (!order || !companyId) return
    setConfirmingPedido(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from("purchase_orders")
        .update({ status: "sent" })
        .eq("id", order.id)
        .eq("company_id", companyId)
      if (error) throw error
      void notifySupplierOrderSent({
        id: order.id,
        code: order.code,
        supplier_name: order.supplier_name,
        company_id: order.company_id,
        supplier_id: order.supplier_id ?? null,
      })
      toast.success("Pedido enviado ao fornecedor. Aguardando aceite.")
      await fetchOrderData({ silent: true })
    } catch (e) {
      console.error(e)
      toast.error("Não foi possível confirmar o pedido.")
    } finally {
      setConfirmingPedido(false)
    }
  }

  const handleCancelOrder = async () => {
    if (!order || !companyId) return
    setCancellingPedido(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from("purchase_orders")
        .update({
          status: "cancelled",
          cancellation_reason: "Pedido cancelado pelo comprador",
        })
        .eq("id", order.id)
        .eq("company_id", companyId)
      if (error) throw error
      toast.success("Pedido cancelado.")
      await fetchOrderData({ silent: true })
    } catch (e) {
      console.error(e)
      toast.error("Não foi possível cancelar o pedido.")
    } finally {
      setCancellingPedido(false)
    }
  }

  const handleCancelFromRefused = async () => {
    if (!order || !companyId) return
    setCancellingRefused(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from("purchase_orders")
        .update({ status: "cancelled" })
        .eq("id", order.id)
        .eq("company_id", companyId)
      if (error) throw error
      toast.success("Pedido cancelado.")
      setCancelRefusedOpen(false)
      await fetchOrderData({ silent: true })
    } catch (e) {
      console.error(e)
      toast.error("Não foi possível cancelar o pedido.")
    } finally {
      setCancellingRefused(false)
    }
  }

  const handleResendToSupplier = async () => {
    if (!order || !companyId) return
    setResendingOrder(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from("purchase_orders")
        .update({ status: "sent" })
        .eq("id", order.id)
        .eq("company_id", companyId)
      if (error) throw error
      void notifySupplierOrderSent({
        id: order.id,
        code: order.code,
        supplier_name: order.supplier_name,
        company_id: order.company_id,
        supplier_id: order.supplier_id ?? null,
      })
      toast.success("Pedido reenviado ao fornecedor.")
      setResendOpen(false)
      await fetchOrderData({ silent: true })
    } catch (e) {
      console.error(e)
      toast.error("Não foi possível reenviar o pedido.")
    } finally {
      setResendingOrder(false)
    }
  }

  const handleStartEdit = async () => {
    if (!order) return
    setEditForm({
      payment_condition: order.payment_condition ?? "",
      delivery_days: order.delivery_days != null ? String(order.delivery_days) : "",
      delivery_address: order.delivery_address ?? "",
      observations: order.observations ?? "",
    })
    setEditItems(
      items.map((item) => ({
        id: item.id,
        material_code: item.material_code,
        material_description: item.material_description,
        unit_of_measure: item.unit_of_measure ?? "",
        unit_price: Number(item.unit_price),
        tax_percent: item.tax_percent != null ? Number(item.tax_percent) : null,
        quantity: Number(item.quantity),
        max_quantity: null,
      })),
    )
    setIsEditing(true)

    if (!order.requisition_code?.trim()) return

    const supabase = createClient()
    const { data: reqData } = await supabase
      .from("requisitions")
      .select("id")
      .eq("code", order.requisition_code.trim())
      .eq("company_id", order.company_id)
      .maybeSingle()

    if (!reqData) return

    const { data: reqItems } = await supabase
      .from("requisition_items")
      .select("material_code, quantity")
      .eq("requisition_id", reqData.id)

    if (!reqItems?.length) return

    const reqMap = Object.fromEntries(
      reqItems.map((ri) => [ri.material_code as string, Number(ri.quantity)]),
    )
    setEditItems((prev) =>
      prev.map((row) => ({
        ...row,
        max_quantity: reqMap[row.material_code] ?? null,
      })),
    )
  }

  const handleSaveAndResend = async () => {
    if (!order || !companyId) return

    if (editForm.delivery_days.trim()) {
      const d = parseInt(editForm.delivery_days, 10)
      if (Number.isNaN(d) || d < 1) {
        toast.error("Prazo de entrega deve ser um número inteiro a partir de 1.")
        return
      }
    }

    for (const item of editItems) {
      if (item.max_quantity != null && item.quantity > item.max_quantity) {
        toast.error(
          `${item.material_code}: quantidade excede a requisição (máx: ${item.max_quantity})`,
        )
        return
      }
      if (item.quantity <= 0 || !Number.isFinite(item.quantity)) {
        toast.error(`${item.material_code}: quantidade deve ser maior que zero`)
        return
      }
    }

    setSavingEdit(true)
    try {
      const supabase = createClient()

      const { error: orderError } = await supabase
        .from("purchase_orders")
        .update({
          payment_condition: editForm.payment_condition.trim() || null,
          delivery_days: editForm.delivery_days.trim()
            ? (() => {
                const n = parseInt(editForm.delivery_days, 10)
                return Number.isNaN(n) ? null : n
              })()
            : null,
          delivery_address: editForm.delivery_address.trim() || null,
          observations: editForm.observations.trim() || null,
          status: "sent",
          updated_at: new Date().toISOString(),
        })
        .eq("id", order.id)
        .eq("company_id", companyId)

      if (orderError) throw orderError

      const itemResults = await Promise.all(
        editItems.map((row) =>
          supabase.from("purchase_order_items").update({ quantity: row.quantity }).eq("id", row.id),
        ),
      )
      const firstItemErr = itemResults.find((r) => r.error)?.error
      if (firstItemErr) throw firstItemErr

      void notifySupplierOrderSent({
        id: order.id,
        code: order.code,
        supplier_name: order.supplier_name,
        company_id: order.company_id,
        supplier_id: order.supplier_id ?? null,
      })
      toast.success("Pedido atualizado e reenviado ao fornecedor.")
      setIsEditing(false)
      await fetchOrderData({ silent: true })
    } catch (err) {
      console.error(err)
      toast.error("Erro ao salvar: " + (err instanceof Error ? err.message : String(err)))
    } finally {
      setSavingEdit(false)
    }
  }

  const handleExport = async () => {
    if (!order) return
    setExporting(true)
    try {
      const ExcelJS = (await import("exceljs")).default
      const workbook = new ExcelJS.Workbook()
      const ws = workbook.addWorksheet("Pedido")

      const headerFill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF4F46E5" },
      } as any
      const headerFont = { color: { argb: "FFFFFFFF" }, bold: true }
      const border = {
        top: { style: "thin", color: { argb: "FFDDDDDD" } },
        bottom: { style: "thin", color: { argb: "FFDDDDDD" } },
        left: { style: "thin", color: { argb: "FFDDDDDD" } },
        right: { style: "thin", color: { argb: "FFDDDDDD" } },
      } as any

      ws.columns = [
        { width: 18 },
        { width: 45 },
      ]

      const infoRows: Array<[string, string]> = [
        ["Nº Pedido:", order.code],
        ["Código ERP:", order.erp_code ?? "—"],
        ["Fornecedor:", order.supplier_name],
        ["CNPJ:", order.supplier_cnpj ?? "—"],
        ["Condição de Pagamento:", order.payment_condition ?? "—"],
        ["Prazo de Entrega:", order.delivery_days != null ? `${order.delivery_days} dias` : "—"],
        ["Entrega Prevista:", getOrderEstimatedDeliveryLabel(order)],
        ["Código Cotação:", order.quotation_code ?? "—"],
        ["Código Requisição:", order.requisition_code ?? "—"],
        ["Endereço de Entrega:", order.delivery_address ?? "—"],
        ["Observações:", order.observations ?? "—"],
        [
          "Data Criação:",
          order.created_at
            ? format(new Date(order.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })
            : "—",
        ],
      ]

      ws.mergeCells("A1:B1")
      const titleCell = ws.getCell("A1")
      titleCell.value = `Pedido ${order.code}`
      titleCell.font = { bold: true, size: 13 }
      titleCell.alignment = { horizontal: "center", vertical: "middle" }

      let rowIndex = 3
      infoRows.forEach(([label, value]) => {
        const row = ws.getRow(rowIndex)
        row.getCell(1).value = label
        row.getCell(2).value = value
        row.getCell(1).font = { bold: true }
        row.getCell(1).alignment = { vertical: "top" }
        row.getCell(2).alignment = { vertical: "top", wrapText: true }
        rowIndex += 1
      })

      rowIndex += 1

      const headerRow = ws.getRow(rowIndex)
      const headers = [
        "Código",
        "Descrição Curta",
        "Qtd",
        "Unidade",
        "Preço Unit.",
        "Impostos",
        "Total Item",
      ]
      ws.columns = [
        { header: "Código", key: "codigo", width: 15 },
        { header: "Descrição Curta", key: "descricao", width: 40 },
        { header: "Qtd", key: "qtd", width: 8 },
        { header: "Unidade", key: "unidade", width: 10 },
        { header: "Preço Unit.", key: "unit", width: 15 },
        { header: "Impostos", key: "impostos", width: 12 },
        { header: "Total Item", key: "total", width: 15 },
      ]
      headerRow.values = ["Código", "Descrição Curta", "Qtd", "Unidade", "Preço Unit.", "Impostos", "Total Item"]
      headerRow.height = 18
      headerRow.eachCell((cell: any) => {
        cell.fill = headerFill
        cell.font = { ...headerFont, size: 11 }
        cell.alignment = { horizontal: "center", vertical: "middle" }
        cell.border = border
      })

      let runningRow = rowIndex + 1
      items.forEach((item) => {
        const row = ws.getRow(runningRow)
        row.getCell(1).value = item.material_code
        row.getCell(2).value = item.material_description
        row.getCell(3).value = item.quantity
        row.getCell(4).value = item.unit_of_measure ?? "—"
        row.getCell(5).value = item.unit_price
        row.getCell(6).value = item.tax_percent == null ? "—" : `${item.tax_percent}%`
        row.getCell(7).value =
          item.total_price != null ? item.total_price : item.quantity * item.unit_price

        row.eachCell({ includeEmpty: true }, (cell: any, colNumber: number) => {
          cell.border = border
          cell.alignment = { vertical: "middle" }
          if (colNumber === 5 || colNumber === 7) {
            cell.numFmt = '"R$" #,##0.00'
          }
        })

        runningRow += 1
      })

      const totalRow = ws.getRow(runningRow)
      totalRow.getCell(1).value = "Total do Pedido"
      ws.mergeCells(`A${runningRow}:6${runningRow}`)
      totalRow.getCell(7).value = order.total_price ?? null
      totalRow.eachCell({ includeEmpty: true }, (cell: any, colNumber: number) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8E8E8" } }
        cell.font = { bold: true }
        cell.border = border
        if (colNumber === 7) {
          cell.numFmt = '"R$" #,##0.00'
        }
      })

      const filename = `pedido_${order.code}_${getTodayDDMMYYYY()}.xlsx`
      await downloadExcel(workbook, filename)

      await logAudit({
        eventType: "quotation.updated",
        description: `Pedido ${order.code} exportado em Excel`,
        companyId,
        userId,
        entity: "purchase_order",
        entityId: order.id,
      })
    } finally {
      setExporting(false)
    }
  }

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

  if (userLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
        Carregando...
      </div>
    )
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push("/comprador/pedidos")}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold tracking-tight">Pedido de Compra</h1>
            <p className="text-muted-foreground">Carregando pedido...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push("/comprador/pedidos")}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold tracking-tight">Pedido de Compra</h1>
          </div>
        </div>
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Pedido não encontrado.
          </CardContent>
        </Card>
      </div>
    )
  }

  const createdAtLabel = order.created_at
    ? format(new Date(order.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })
    : "—"

  const statusDisplay = getPOStatusForBuyer(order.status)

  const totalItemsCount = items.length

  const displayedOrderTotal = isEditing
    ? editItems.reduce((s, i) => s + i.quantity * i.unit_price, 0)
    : (order.total_price ?? 0)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push("/comprador/pedidos")}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{order.code}</h1>
          <p className="text-muted-foreground">Criado em {createdAtLabel}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <span
            className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${poStatusBadgeClass(statusDisplay.color)}`}
          >
            {order.status === "draft" ? (
              <FileEdit className="mr-1.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            ) : null}
            {statusDisplay.label}
          </span>
          {order.status === "draft" && (
            <>
              <Button
                variant="default"
                size="sm"
                onClick={handleConfirmOrder}
                disabled={confirmingPedido || cancellingPedido}
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                {confirmingPedido ? "Confirmando..." : "Confirmar Pedido"}
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    disabled={confirmingPedido || cancellingPedido}
                  >
                    <X className="mr-2 h-4 w-4" />
                    Cancelar Pedido
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Cancelar pedido?</AlertDialogTitle>
                    <AlertDialogDescription>
                      O pedido será marcado como cancelado e não seguirá para o fornecedor.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={cancellingPedido}>Voltar</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      disabled={cancellingPedido}
                      onClick={() => void handleCancelOrder()}
                    >
                      {cancellingPedido ? "Cancelando..." : "Confirmar cancelamento"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
          {order.status === "refused" && (
            <>
              <AlertDialog open={cancelRefusedOpen} onOpenChange={setCancelRefusedOpen}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Cancelar pedido?</AlertDialogTitle>
                    <AlertDialogDescription>
                      O pedido será marcado como cancelado definitivamente.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={cancellingRefused}>Voltar</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      disabled={cancellingRefused}
                      onClick={(e) => {
                        e.preventDefault()
                        void handleCancelFromRefused()
                      }}
                    >
                      {cancellingRefused ? "Cancelando..." : "Confirmar cancelamento"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <AlertDialog open={resendOpen} onOpenChange={setResendOpen}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Reenviar ao fornecedor?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Reenviar pedido {order.code} ao fornecedor?
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={resendingOrder}>Voltar</AlertDialogCancel>
                    <AlertDialogAction
                      disabled={resendingOrder}
                      onClick={(e) => {
                        e.preventDefault()
                        void handleResendToSupplier()
                      }}
                    >
                      {resendingOrder ? "Enviando..." : "Confirmar reenvio"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              {!isEditing ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={cancellingRefused || resendingOrder || savingEdit}
                    onClick={() => void handleStartEdit()}
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    Editar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive border-destructive hover:bg-destructive/10"
                    disabled={cancellingRefused || resendingOrder || savingEdit}
                    onClick={() => setCancelRefusedOpen(true)}
                  >
                    <X className="mr-2 h-4 w-4" />
                    Cancelar Pedido
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    disabled={cancellingRefused || resendingOrder || savingEdit}
                    onClick={() => setResendOpen(true)}
                  >
                    Reenviar ao Fornecedor
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={savingEdit}
                    onClick={() => setIsEditing(false)}
                  >
                    Cancelar Edição
                  </Button>
                  <Button
                    size="sm"
                    disabled={savingEdit}
                    className="bg-green-600 text-white hover:bg-green-700"
                    onClick={() => void handleSaveAndResend()}
                  >
                    {savingEdit ? "Salvando..." : "Salvar e Reenviar →"}
                  </Button>
                </>
              )}
            </>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleDownloadPDF()}
            disabled={generatingPdf}
          >
            <FileText className="mr-2 h-4 w-4" />
            {generatingPdf ? "Gerando PDF..." : "PDF"}
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
            <Download className="mr-2 h-4 w-4" />
            {exporting ? "Exportando..." : "Exportar"}
          </Button>
        </div>
      </div>

      {order.status === "error" && order.erp_error_message && (
        <div className="bg-destructive/10 border border-destructive/40 rounded-xl p-4 flex gap-3 items-start">
          <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
          <div>
            <p className="text-sm font-medium text-destructive">Erro ao integrar com o ERP</p>
            <p className="text-sm text-destructive/90">{order.erp_error_message}</p>
          </div>
        </div>
      )}

      {order.status === "refused" && (
        <div className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 flex gap-3 items-start">
          <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5 shrink-0" />
          <div className="space-y-1 text-sm text-orange-900">
            <p className="font-medium">Este pedido foi recusado pelo fornecedor.</p>
            {order.cancellation_reason?.trim() ? (
              <p className="text-orange-800">Motivo: {order.cancellation_reason}</p>
            ) : null}
            <p className="text-orange-800/90">
              Revise as condições e reenvie, ou cancele o pedido.
            </p>
          </div>
        </div>
      )}

      {order.status === "cancelled" && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 flex gap-3 items-start">
          <X className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-red-900">Pedido cancelado</p>
            {order.cancellation_reason?.trim() ? (
              <p className="text-sm text-red-800/90 mt-1">{order.cancellation_reason}</p>
            ) : (
              <p className="text-sm text-red-800/90 mt-1">Este pedido não seguirá no fluxo.</p>
            )}
          </div>
        </div>
      )}

      {order.erp_code && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-emerald-800">
              Pedido integrado ao ERP com sucesso. Código ERP: {order.erp_code}
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Dados do Fornecedor</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Fornecedor</p>
              <p className="font-medium">{order.supplier_name}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">CNPJ</p>
              <p className="text-sm text-muted-foreground">
                {order.supplier_cnpj ?? "—"}
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Condição de Pagamento</p>
              {isEditing ? (
                paymentOptions.length > 0 ? (
                  <div className="space-y-2">
                    <Select
                      value={
                        paymentOptions.some((o) => o.code === editForm.payment_condition)
                          ? editForm.payment_condition
                          : undefined
                      }
                      onValueChange={(v) =>
                        setEditForm((f) => ({ ...f, payment_condition: v }))
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Selecione a condição de pagamento" />
                      </SelectTrigger>
                      <SelectContent>
                        {paymentOptions.map((opt) => (
                          <SelectItem key={opt.id} value={opt.code}>
                            {opt.code} — {opt.description}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {!paymentOptions.some((o) => o.code === editForm.payment_condition) &&
                    editForm.payment_condition.trim() ? (
                      <p className="text-xs text-muted-foreground">
                        Valor atual (fora da lista cadastrada): {editForm.payment_condition}
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <Input
                    value={editForm.payment_condition}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, payment_condition: e.target.value }))
                    }
                    placeholder="Condição de pagamento"
                  />
                )
              ) : (
                <p className="text-sm text-muted-foreground">
                  {order.payment_condition ?? "—"}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Prazo de Entrega</p>
              {isEditing ? (
                <Input
                  type="number"
                  min={1}
                  value={editForm.delivery_days}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, delivery_days: e.target.value }))
                  }
                  placeholder="Dias"
                  className="max-w-[120px]"
                />
              ) : (
                <p className="text-sm font-medium">
                  {order.delivery_days != null ? `${order.delivery_days} dias` : "—"}
                </p>
              )}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Entrega Prevista</p>
              <p className="text-sm font-medium">{getOrderEstimatedDeliveryLabel(order)}</p>
              {order.delivery_date_change_reason ? (
                <p className="text-xs text-amber-600 mt-0.5 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden />
                  Data atualizada pelo fornecedor
                </p>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Dados do Pedido</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Código da Cotação</p>
              <p className="text-sm text-muted-foreground">
                {order.quotation_code ?? "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Código da Requisição</p>
              <p className="text-sm text-muted-foreground">
                {order.requisition_code ?? "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Código ERP</p>
              <p className="text-sm text-muted-foreground">
                {order.erp_code ?? "Aguardando integração"}
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Endereço de Entrega</p>
              {isEditing ? (
                <Input
                  value={editForm.delivery_address}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, delivery_address: e.target.value }))
                  }
                  placeholder="Endereço de entrega"
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  {order.delivery_address ?? "—"}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Observações</p>
              {isEditing ? (
                <Textarea
                  rows={3}
                  value={editForm.observations}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, observations: e.target.value }))
                  }
                  placeholder="Observações"
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  {order.observations ?? "—"}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Itens do Pedido</CardTitle>
          </div>
          <Badge variant="outline" className="text-xs">
            {(isEditing ? editItems.length : totalItemsCount)} item
            {(isEditing ? editItems.length : totalItemsCount) === 1 ? "" : "s"}
          </Badge>
        </CardHeader>
        <CardContent>
          {isEditing ? (
            <div className="mb-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span>
                Alterações na quantidade podem impactar o valor total acordado na proposta.
                {order.requisition_code
                  ? " A quantidade não pode exceder a requisição de origem."
                  : null}
              </span>
            </div>
          ) : null}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Descrição Curta</TableHead>
                  <TableHead className="text-right">Qtd</TableHead>
                  <TableHead className="text-center">Unidade</TableHead>
                  <TableHead className="text-right">Preço Unit.</TableHead>
                  <TableHead className="text-right">Impostos</TableHead>
                  <TableHead className="text-right">Total Item</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isEditing
                  ? editItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono text-sm">
                          {item.material_code}
                        </TableCell>
                        <TableCell>{item.material_description}</TableCell>
                        <TableCell className="text-right">
                          <div className="inline-flex flex-col items-end gap-1">
                            <input
                              type="number"
                              min={1}
                              max={item.max_quantity ?? undefined}
                              value={item.quantity}
                              onChange={(e) => {
                                const raw = e.target.value
                                if (raw === "") return
                                const val = Number(raw)
                                if (!Number.isFinite(val)) return
                                if (
                                  item.max_quantity != null &&
                                  val > item.max_quantity
                                ) {
                                  toast.error(
                                    `Quantidade máxima para ${item.material_code}: ${item.max_quantity}`,
                                  )
                                  return
                                }
                                setEditItems((prev) =>
                                  prev.map((i) =>
                                    i.id === item.id ? { ...i, quantity: val } : i,
                                  ),
                                )
                              }}
                              className="h-8 w-20 rounded border border-input bg-background px-2 text-center text-sm"
                            />
                            {item.max_quantity != null ? (
                              <p className="text-xs text-muted-foreground">
                                máx: {item.max_quantity}
                              </p>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          {item.unit_of_measure || "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {money.format(item.unit_price)}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.tax_percent == null
                            ? "—"
                            : `${item.tax_percent}%`}
                        </TableCell>
                        <TableCell className="text-right">
                          {money.format(item.quantity * item.unit_price)}
                        </TableCell>
                      </TableRow>
                    ))
                  : items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono text-sm">
                          {item.material_code}
                        </TableCell>
                        <TableCell>{item.material_description}</TableCell>
                        <TableCell className="text-right">{item.quantity}</TableCell>
                        <TableCell className="text-center">
                          {item.unit_of_measure ?? "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {money.format(item.unit_price)}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.tax_percent == null ? "—" : `${item.tax_percent}%`}
                        </TableCell>
                        <TableCell className="text-right">
                          {money.format(
                            item.total_price ?? item.quantity * item.unit_price,
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                <TableRow>
                  <TableCell colSpan={6} className="text-right font-bold">
                    Total do Pedido
                  </TableCell>
                  <TableCell className="text-right font-bold">
                    {money.format(displayedOrderTotal)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="bg-card border border-border rounded-xl p-6">
        <h3 className="text-sm font-semibold text-foreground mb-4">
          Histórico do Pedido
        </h3>

        {timeline.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum evento registrado.</p>
        ) : (
          <ol className="relative border-l border-border pl-6 space-y-6">
            {timeline.map((event, idx) => {
              const EventIcon = event.icon
              return (
                <li key={event.id} className="relative">
                  <div
                    className={`absolute -left-[25px] flex items-center justify-center w-5 h-5 rounded-full bg-card border-2 ${
                      idx === timeline.length - 1 ? "border-primary" : "border-border"
                    }`}
                  >
                    <EventIcon
                      className={`w-2.5 h-2.5 ${event.iconColor}`}
                      aria-hidden
                    />
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-foreground">{event.title}</p>
                      {event.type === "supplier" ? (
                        <span className="text-xs bg-purple-50 text-purple-700 border border-purple-100 rounded-full px-2 py-0.5">
                          Fornecedor
                        </span>
                      ) : null}
                      {event.type === "buyer" ? (
                        <span className="text-xs bg-blue-50 text-blue-700 border border-blue-100 rounded-full px-2 py-0.5">
                          Comprador
                        </span>
                      ) : null}
                    </div>
                    {event.description ? (
                      <p className="text-xs text-muted-foreground mt-0.5">{event.description}</p>
                    ) : null}
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <p className="text-xs text-muted-foreground">
                        {formatDateTimeBR(event.date, true)}
                      </p>
                      {event.actor ? (
                        <p className="text-xs text-muted-foreground">· por {event.actor}</p>
                      ) : null}
                    </div>
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </div>
    </div>
  )
}

