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
  CheckCircle,
  CheckCircle2,
  ChevronLeft,
  Download,
  FileEdit,
  X,
} from "lucide-react"
import { toast } from "sonner"
import type { LucideIcon } from "lucide-react"

type PurchaseOrderStatus = "draft" | "processing" | "sent" | "error" | "completed"

type PurchaseOrder = {
  id: string
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

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
})

const statusConfig: Record<
  PurchaseOrderStatus,
  { label: string; className: string; Icon?: LucideIcon }
> = {
  draft: {
    label: "Rascunho",
    className: "bg-zinc-100 text-zinc-700 border border-zinc-200",
    Icon: FileEdit,
  },
  processing: {
    label: "Em Processamento",
    className: "bg-yellow-100 text-yellow-800",
  },
  sent: {
    label: "Enviado ao ERP",
    className: "bg-blue-100 text-blue-800",
  },
  error: {
    label: "Erro no ERP",
    className: "bg-red-100 text-red-800",
  },
  completed: {
    label: "Concluído",
    className: "bg-green-100 text-green-800",
  },
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
  const [loading, setLoading] = React.useState(true)
  const [exporting, setExporting] = React.useState(false)
  const [confirmingPedido, setConfirmingPedido] = React.useState(false)
  const [cancellingPedido, setCancellingPedido] = React.useState(false)

  const fetchOrderData = React.useCallback(
    async (options?: { silent?: boolean }) => {
      if (!id || !companyId) return
      const silent = options?.silent ?? false
      if (!silent) setLoading(true)
      try {
        const supabase = createClient()
        const [orderRes, itemsRes] = await Promise.all([
          supabase.from("purchase_orders").select("*").eq("id", id).single(),
          supabase
            .from("purchase_order_items")
            .select("*")
            .eq("purchase_order_id", id)
            .order("material_code", { ascending: true }),
        ])
        setOrder((orderRes.data as PurchaseOrder) ?? null)
        setItems(((itemsRes.data as unknown) as PurchaseOrderItem[]) ?? [])
      } finally {
        if (!silent) setLoading(false)
      }
    },
    [companyId, id],
  )

  React.useEffect(() => {
    void fetchOrderData()
  }, [fetchOrderData])

  const handleConfirmOrder = async () => {
    if (!order || !companyId) return
    setConfirmingPedido(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from("purchase_orders")
        .update({ status: "processing" })
        .eq("id", order.id)
        .eq("company_id", companyId)
      if (error) throw error
      toast.success("Pedido confirmado e enviado para processamento.")
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
          status: "error",
          erp_error_message: "Pedido cancelado pelo comprador",
        })
        .eq("id", order.id)
        .eq("company_id", companyId)
      if (error) throw error
      await fetchOrderData({ silent: true })
    } catch (e) {
      console.error(e)
      toast.error("Não foi possível cancelar o pedido.")
    } finally {
      setCancellingPedido(false)
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

  const statusDisplay = statusConfig[order.status]

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
      label: "Enviado ao ERP",
      completed: order.status === "sent" || order.status === "completed" || order.status === "error",
    },
    {
      key: "final",
      label: order.status === "error" ? "Erro no ERP" : "Integrado",
      completed: order.status === "completed" || order.status === "error",
    },
  ]

  const totalItemsCount = items.length

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
            className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${statusDisplay.className}`}
          >
            {statusDisplay.Icon ? (
              <statusDisplay.Icon className="mr-1.5 h-3.5 w-3.5 shrink-0" aria-hidden />
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
                      O pedido será marcado como cancelado. Esta ação pode ser revisada no histórico do
                      pedido.
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
            <div>
              <p className="text-xs text-muted-foreground">Condição de Pagamento</p>
              <p className="text-sm text-muted-foreground">
                {order.payment_condition ?? "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Prazo de Entrega</p>
              <p className="text-sm text-muted-foreground">
                {order.delivery_days != null ? `${order.delivery_days} dias` : "—"}
              </p>
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
            <div>
              <p className="text-xs text-muted-foreground">Endereço de Entrega</p>
              <p className="text-sm text-muted-foreground">
                {order.delivery_address ?? "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Observações</p>
              <p className="text-sm text-muted-foreground">
                {order.observations ?? "—"}
              </p>
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
            {totalItemsCount} item{totalItemsCount === 1 ? "" : "s"}
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
                  <TableHead className="text-center">Unidade</TableHead>
                  <TableHead className="text-right">Preço Unit.</TableHead>
                  <TableHead className="text-right">Impostos</TableHead>
                  <TableHead className="text-right">Total Item</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
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
                    {money.format(order.total_price ?? 0)}
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
        </CardContent>
      </Card>
    </div>
  )
}

