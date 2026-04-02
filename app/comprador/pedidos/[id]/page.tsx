"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { createClient } from "@/lib/supabase/client"
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
  CheckCircle,
  CheckCircle2,
  ChevronLeft,
  Download,
  FileEdit,
  Pencil,
  X,
} from "lucide-react"
import { toast } from "sonner"
import type { LucideIcon } from "lucide-react"
import { getPOStatusForBuyer, poStatusBadgeClass } from "@/lib/po-status"

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

type PaymentConditionOption = {
  id: string
  code: string
  description: string
}

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
})

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
  const { companyId, userId } = useUser()
  const { id } = React.use(params)

  const [order, setOrder] = React.useState<PurchaseOrder | null>(null)
  const [items, setItems] = React.useState<PurchaseOrderItem[]>([])
  const [paymentOptions, setPaymentOptions] = React.useState<PaymentConditionOption[]>([])
  const [loading, setLoading] = React.useState(true)
  const [exporting, setExporting] = React.useState(false)
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
      if (!id || !companyId) return
      const silent = options?.silent ?? false
      if (!silent) setLoading(true)
      try {
        const supabase = createClient()
        const [orderRes, itemsRes, paymentsRes] = await Promise.all([
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
        ])
        setOrder((orderRes.data as PurchaseOrder) ?? null)
        setItems(((itemsRes.data as unknown) as PurchaseOrderItem[]) ?? [])
        setPaymentOptions(((paymentsRes.data as PaymentConditionOption[]) ?? []) as PaymentConditionOption[])
      } finally {
        if (!silent) setLoading(false)
      }
    },
    [companyId, id],
  )

  React.useEffect(() => {
    void fetchOrderData()
  }, [fetchOrderData])

  React.useEffect(() => {
    if (!order) return
    if (order.status !== "refused") setIsEditing(false)
  }, [order])

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

  const steps: {
    key: string
    label: string
    date?: string
    completed: boolean
    Icon?: LucideIcon
  }[] = [
    {
      key: "draft",
      label: "Rascunho criado",
      date: createdAtLabel,
      completed: order.status !== "draft",
      Icon: FileEdit,
    },
    {
      key: "sent",
      label: "Aguardando aceite do fornecedor",
      completed:
        order.status === "processing" ||
        order.status === "completed" ||
        order.status === "error" ||
        order.status === "refused",
    },
    {
      key: "processing",
      label: "Processando integração com o ERP",
      completed: order.status === "completed" || order.status === "error",
    },
    {
      key: "final",
      label:
        order.status === "error"
          ? "Erro na integração"
          : order.status === "completed"
            ? "Concluído"
            : "Pendente",
      completed: order.status === "completed" || order.status === "error",
    },
  ]

  const totalItemsCount = items.length

  const displayedOrderTotal = isEditing
    ? editItems.reduce((s, i) => s + i.quantity * i.unit_price, 0)
    : (order.total_price ?? 0)

  const getStepState = (index: number) => {
    const step = steps[index]
    if (step.completed) return "done" as const
    const previousDone = index === 0 || steps[index - 1].completed
    if (previousDone) return "current" as const
    return "future" as const
  }

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

      <Card>
        <CardHeader>
          <CardTitle>Histórico</CardTitle>
        </CardHeader>
        <CardContent>
          {order.status === "cancelled" ? (
            <p className="text-sm text-muted-foreground">
              O fluxo foi encerrado. O motivo consta no aviso acima.
            </p>
          ) : order.status === "refused" ? (
            <p className="text-sm text-muted-foreground">
              O fornecedor recusou o pedido. Use os botões no topo para reenviar ou cancelar.
            </p>
          ) : (
          <ol className="relative border-l border-border pl-4 space-y-4">
            {steps.map((step, index) => {
              const state = getStepState(index)
              const isDone = state === "done"
              const isCurrent = state === "current"

              return (
                <li key={step.key} className="relative pl-4">
                  <span
                    className={`absolute left-[-10px] top-1 flex h-4 w-4 items-center justify-center rounded-full border ${
                      isDone
                        ? "bg-primary text-primary-foreground border-primary"
                        : isCurrent
                          ? "bg-primary/20 border-2 border-primary text-primary"
                          : "bg-muted border-muted-foreground/20 text-muted-foreground"
                    }`}
                  >
                    {step.Icon ? (
                      <>
                        <step.Icon className="h-3 w-3 shrink-0" aria-hidden />
                        <span className="sr-only">{step.label}</span>
                      </>
                    ) : (
                      <span className="sr-only">{step.label}</span>
                    )}
                  </span>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-foreground">
                      {step.label}
                    </span>
                    {step.date && (
                      <span className="text-xs text-muted-foreground">{step.date}</span>
                    )}
                  </div>
                </li>
              )
            })}
          </ol>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

