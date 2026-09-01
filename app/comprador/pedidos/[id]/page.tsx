"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { formatDateBR, formatDateTimeBR, formatTodayStampDDMMYYYY } from "@/lib/formato-data"
import { createClient } from "@/lib/supabase/client"
import { notifyWithEmail } from "@/lib/notify-with-email"
import { useUser } from "@/lib/hooks/useUser"
import { usePermissions } from "@/lib/hooks/usePermissions"
import { logAudit } from "@/lib/audit"
import { createNotification } from "@/lib/notify"
import {
  formatResponsibleName,
  isBuyerOrHigherProfile,
} from "@/lib/quotations/ownership"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
  ClipboardList,
  Download,
  FileEdit,
  FileText,
  Loader2,
  Package,
  Pencil,
  Search,
  Send,
  Trash2,
  UserRoundPlus,
  X,
  XCircle,
} from "lucide-react"
import { toast } from "sonner"
import type { LucideIcon } from "lucide-react"
import { getPOStatusForBuyer, poStatusBadgeClass } from "@/lib/po-status"
import { getBuyerOrderErrorCopy } from "@/lib/integrations/erp-errors"
import { buildContractItemLineNumberMap } from "@/lib/contracts/contract-balance-helpers"
import { PoItemAccountConfigTableCells } from "@/components/comprador/po-item-account-config-cells"
import { EntityApprovalActions } from "@/components/comprador/entity-approval-actions"
import {
  parseItemAccountConfigFromDb,
  validateAllAccountConfigsForSubmit,
  type ItemAccountConfigEdit,
  type ItemAccountConfigFieldErrors,
} from "@/lib/po-account-assignment"
import { savePurchaseOrderAccountConfigs } from "@/lib/po-account-assignment-persist"
import { copyRequisitionAccountConfigToPurchaseOrderItem } from "@/lib/requisitions/account-config-bridge"
import type { PurchaseOrderItemAccountAssignmentInput } from "@/types/po-account-assignment"
import { useNumericLimits } from "@/lib/hooks/use-numeric-limits"
import { useImplantationConfig } from "@/lib/hooks/use-implantation-config"
import { QuantityInput, PriceInput } from "@/components/ui/numeric-field-inputs"
import {
  computeLineTotal,
  invalidFieldClass,
  isPorValue,
  POR_OPTIONS,
  type PorValue,
  validatePrice,
  validateQuantity,
} from "@/lib/validation/numeric-input"
import { cn } from "@/lib/utils"
import {
  buildPurchaseOrderDetailWorkbook,
  downloadExcelWorkbook,
} from "@/lib/excel/purchase-order-detail-export"

type PurchaseOrderStatus =
  | "draft"
  | "processing"
  | "sent"
  | "refused"
  | "error"
  | "integration_error"
  | "completed"
  | "cancelled"

type PurchaseOrder = {
  id: string
  company_id: string
  code: string
  erp_code: string | null
  external_code: string | null
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
  accepted_by_supplier: boolean | null
  observations: string | null
  created_at: string
  updated_at: string | null
  created_by: string | null
}

type PurchaseOrderItem = {
  id: string
  material_code: string
  material_description: string
  quantity: number
  unit_of_measure: string | null
  unit_price: number
  price_unit: number
  tax_percent: number | null
  total_price: number | null
  contract_id: string | null
  contract_item_id: string | null
  contract_code: string | null
  contract_item_line: number | null
  requisition_item_id: string | null
  source_requisition_code: string | null
  account_assignment_category: string | null
  account_assignment_distribution: string | null
  account_assignments: PurchaseOrderItemAccountAssignmentInput[]
}

type EditItem = {
  id: string
  material_code: string
  material_description: string
  unit_of_measure: string
  unit_price: number
  price_unit: number
  tax_percent: number | null
  quantity: number
  max_quantity: number | null
  requisition_item_id: string | null
  source_requisition_code: string | null
}

type PoLineFieldErrors = {
  quantity?: boolean
  unit_price?: boolean
  price_unit?: boolean
}

type PoHeaderFieldErrors = {
  supplier?: boolean
  payment_condition?: boolean
  delivery_address?: boolean
}

type DraftSupplier = {
  id: string
  name: string
  cnpj: string | null
  code: string
}

type RequisitionOption = {
  id: string
  code: string
  title: string
  created_at: string
  items: {
    id: string
    material_code: string | null
    material_description: string
    unit_of_measure: string | null
    quantity: number
  }[]
}

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = React.useState<T>(value)
  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debouncedValue
}

function formatPersistError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return error.message
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message: unknown }).message
    if (typeof message === "string" && message.trim()) return message
  }
  return fallback
}

function useViewOnceBanner(storageKey: string, active: boolean) {
  const [visible, setVisible] = React.useState(false)

  React.useEffect(() => {
    if (!active) {
      setVisible(false)
      return
    }
    const alreadyViewed = localStorage.getItem(storageKey) === "1"
    if (alreadyViewed) {
      setVisible(false)
      return
    }
    setVisible(true)
    localStorage.setItem(storageKey, "1")
  }, [active, storageKey])

  return visible
}

function ViewOnceBanner({
  storageKey,
  active,
  className,
  children,
}: {
  storageKey: string
  active: boolean
  className: string
  children: React.ReactNode
}) {
  const visible = useViewOnceBanner(storageKey, active)
  if (!visible) return null
  return <div className={className}>{children}</div>
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
    const { data: supplierProfiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .eq("supplier_id", order.supplier_id)
      .eq("company_id", order.company_id)
      .eq("profile_type", "supplier")
      .eq("status", "active")

    for (const supplierProfile of supplierProfiles ?? []) {
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
    }
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

  if (order.status === "error" || order.status === "integration_error") {
    const d = order.updated_at ?? order.created_at
    const copy = getBuyerOrderErrorCopy(order.status, order.erp_error_message)
    inferred.push({
      id: "inf-error",
      date: d,
      title: copy.title,
      description: copy.body,
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
    return formatDateBR(order.estimated_delivery_date) || "—"
  }
  if (order.accepted_at && order.delivery_days != null && order.delivery_days > 0) {
    const ymd = addCalendarDaysFromAcceptedAt(order.accepted_at, order.delivery_days)
    return ymd ? formatDateBR(ymd) || "—" : "—"
  }
  return "—"
}

function getTodayDDMMYYYY() {
  return formatTodayStampDDMMYYYY()
}

async function downloadExcel(workbook: Awaited<ReturnType<typeof buildPurchaseOrderDetailWorkbook>>, filename: string) {
  await downloadExcelWorkbook(workbook, filename)
}

export default function PurchaseOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const backHref =
    searchParams.get("from") === "aprovacoes" ? "/comprador/aprovacoes" : "/comprador/pedidos"
  const { companyId, userId, loading: userLoading } = useUser()
  const { hasPermission } = usePermissions()
  const { id } = React.use(params)
  const { maxQuantity, priceDecimalPlaces } = useNumericLimits()
  const {
    accountAssignmentEnabled,
    porEnabled,
  } = useImplantationConfig()

  const linePor = React.useCallback(
    (priceUnit: number) => (porEnabled && isPorValue(priceUnit) ? priceUnit : 1),
    [porEnabled],
  )

  const computePoLineTotal = React.useCallback(
    (quantity: number, unitPrice: number, priceUnit: number) =>
      computeLineTotal(quantity, unitPrice, linePor(priceUnit)),
    [linePor],
  )

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
  const [retryingIntegration, setRetryingIntegration] = React.useState(false)
  const [cancelIntegratedOpen, setCancelIntegratedOpen] = React.useState(false)
  const [cancellingIntegrated, setCancellingIntegrated] = React.useState(false)

  const [isEditing, setIsEditing] = React.useState(false)
  const [editForm, setEditForm] = React.useState({
    payment_condition: "",
    delivery_days: "",
    delivery_address: "",
    observations: "",
  })
  const [editItems, setEditItems] = React.useState<EditItem[]>([])
  const [editSnapshot, setEditSnapshot] = React.useState<{
    form: typeof editForm
    items: EditItem[]
  } | null>(null)
  const [savingEdit, setSavingEdit] = React.useState(false)
  const [savingDraft, setSavingDraft] = React.useState(false)
  const [responsibleName, setResponsibleName] = React.useState("—")
  const [delegateOpen, setDelegateOpen] = React.useState(false)
  const [delegateTargetId, setDelegateTargetId] = React.useState("")
  const [delegateBuyers, setDelegateBuyers] = React.useState<
    { id: string; full_name: string | null }[]
  >([])
  const [delegating, setDelegating] = React.useState(false)
  const [accountConfigs, setAccountConfigs] = React.useState<
    Record<string, ItemAccountConfigEdit>
  >({})
  const [accountConfigErrors, setAccountConfigErrors] = React.useState<
    Record<string, ItemAccountConfigFieldErrors>
  >({})
  const [lineItemFieldErrors, setLineItemFieldErrors] = React.useState<
    Record<string, PoLineFieldErrors>
  >({})
  const [headerFieldErrors, setHeaderFieldErrors] = React.useState<PoHeaderFieldErrors>({})

  const [draftSupplier, setDraftSupplier] = React.useState<DraftSupplier | null>(null)
  const [supplierSearch, setSupplierSearch] = React.useState("")
  const [supplierResults, setSupplierResults] = React.useState<DraftSupplier[]>([])
  const [supplierSearchLoading, setSupplierSearchLoading] = React.useState(false)
  const debouncedSupplierSearch = useDebounce(supplierSearch, 300)

  const [reqDialogOpen, setReqDialogOpen] = React.useState(false)
  const [requisitions, setRequisitions] = React.useState<RequisitionOption[]>([])
  const [requisitionsLoading, setRequisitionsLoading] = React.useState(false)
  const [selectedReqIds, setSelectedReqIds] = React.useState<string[]>([])
  const [requisitionIdByCode, setRequisitionIdByCode] = React.useState<Record<string, string>>(
    {},
  )

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
            .select(
              `id,
              material_code,
              material_description,
              quantity,
              unit_of_measure,
              unit_price,
              price_unit,
              tax_percent,
              total_price,
              contract_id,
              contract_item_id,
              contracts:contract_id (code),
              contract_items:contract_item_id (
                contract_id,
                contracts:contract_id (code)
              ),
              requisition_item_id,
              source_requisition_code,
              account_assignment_category,
              account_assignment_distribution,
              purchase_order_item_account_assignments (
                sequence,
                apportionment_percent,
                currency,
                ledger_account_code,
                business_area,
                controlling_area,
                cost_center_code,
                internal_order_id,
                wbs_element,
                asset_number,
                profit_center
              )`,
            )
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
        const loadedOrder = (orderRes.data as PurchaseOrder) ?? null
        setOrder(loadedOrder)
        if (loadedOrder?.created_by) {
          const { data: ownerProfile } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", loadedOrder.created_by)
            .maybeSingle()
          setResponsibleName(
            formatResponsibleName(
              (ownerProfile as { full_name?: string | null } | null)?.full_name,
            ),
          )
        } else {
          setResponsibleName("—")
        }
        const rawItems = (itemsRes.data ?? []) as Array<
          Record<string, unknown> & {
            contracts?: { code?: string } | { code?: string }[] | null
            contract_items?:
              | {
                  contract_id?: string
                  contracts?: { code?: string } | { code?: string }[] | null
                }
              | {
                  contract_id?: string
                  contracts?: { code?: string } | { code?: string }[] | null
                }[]
              | null
            purchase_order_item_account_assignments?:
              | PurchaseOrderItemAccountAssignmentInput[]
              | null
          }
        >
        let lineNumberMap = new Map<string, number>()
        const contractIds = new Set<string>()
        for (const row of rawItems) {
          if (row.contract_id != null) {
            contractIds.add(String(row.contract_id))
          }
          const itemEmbed = Array.isArray(row.contract_items)
            ? row.contract_items[0]
            : row.contract_items
          if (itemEmbed?.contract_id) {
            contractIds.add(String(itemEmbed.contract_id))
          }
        }
        if (contractIds.size > 0) {
          const { data: contractItemRows } = await supabase
            .from("contract_items")
            .select("id, contract_id, created_at, eliminated")
            .in("contract_id", [...contractIds])
          lineNumberMap = buildContractItemLineNumberMap(
            (contractItemRows ?? []) as Array<{
              id: string
              contract_id: string
              created_at: string
              eliminated: boolean
            }>,
          )
        }
        const poItems: PurchaseOrderItem[] = rawItems.map((row) => {
          const contractEmbed = Array.isArray(row.contracts)
            ? row.contracts[0]
            : row.contracts
          const itemEmbed = Array.isArray(row.contract_items)
            ? row.contract_items[0]
            : row.contract_items
          const nestedContract = itemEmbed?.contracts
            ? Array.isArray(itemEmbed.contracts)
              ? itemEmbed.contracts[0]
              : itemEmbed.contracts
            : null
          const contractItemId =
            row.contract_item_id != null ? String(row.contract_item_id) : null
          const resolvedContractId =
            row.contract_id != null
              ? String(row.contract_id)
              : itemEmbed?.contract_id
                ? String(itemEmbed.contract_id)
                : null
          const assignmentRows = (
            row.purchase_order_item_account_assignments ?? []
          ).map((assignment) => ({
            sequence: Number(assignment.sequence ?? 1),
            apportionment_percent: Number(assignment.apportionment_percent ?? 0),
            currency: assignment.currency != null ? String(assignment.currency) : "BRL",
            ledger_account_code:
              assignment.ledger_account_code != null
                ? String(assignment.ledger_account_code)
                : null,
            business_area:
              assignment.business_area != null ? String(assignment.business_area) : null,
            controlling_area:
              assignment.controlling_area != null
                ? String(assignment.controlling_area)
                : null,
            cost_center_code:
              assignment.cost_center_code != null
                ? String(assignment.cost_center_code)
                : null,
            internal_order_id:
              assignment.internal_order_id != null
                ? String(assignment.internal_order_id)
                : null,
            wbs_element:
              assignment.wbs_element != null ? String(assignment.wbs_element) : null,
            asset_number:
              assignment.asset_number != null ? String(assignment.asset_number) : null,
            profit_center:
              assignment.profit_center != null ? String(assignment.profit_center) : null,
          }))
          return {
            id: String(row.id ?? ""),
            material_code: String(row.material_code ?? ""),
            material_description: String(row.material_description ?? ""),
            quantity: Number(row.quantity ?? 0),
            unit_of_measure:
              row.unit_of_measure != null ? String(row.unit_of_measure) : null,
            unit_price: Number(row.unit_price ?? 0),
            price_unit:
              row.price_unit != null && isPorValue(Number(row.price_unit))
                ? Number(row.price_unit)
                : 1,
            tax_percent: row.tax_percent != null ? Number(row.tax_percent) : null,
            total_price: row.total_price != null ? Number(row.total_price) : null,
            contract_id: resolvedContractId,
            contract_item_id: contractItemId,
            contract_code: contractEmbed?.code
              ? String(contractEmbed.code)
              : nestedContract?.code
                ? String(nestedContract.code)
                : null,
            contract_item_line: contractItemId
              ? (lineNumberMap.get(contractItemId) ?? null)
              : null,
            requisition_item_id:
              row.requisition_item_id != null ? String(row.requisition_item_id) : null,
            source_requisition_code:
              row.source_requisition_code != null
                ? String(row.source_requisition_code)
                : null,
            account_assignment_category:
              row.account_assignment_category != null
                ? String(row.account_assignment_category)
                : null,
            account_assignment_distribution:
              row.account_assignment_distribution != null
                ? String(row.account_assignment_distribution)
                : "",
            account_assignments: assignmentRows,
          }
        })
        const configs = Object.fromEntries(
          poItems.map((item) => [
            item.id,
            parseItemAccountConfigFromDb(
              item.account_assignment_category,
              item.account_assignment_distribution,
              item.account_assignments,
            ),
          ]),
        )
        setItems(poItems)
        setAccountConfigs(configs)
        setPaymentOptions(((paymentsRes.data as PaymentConditionOption[]) ?? []) as PaymentConditionOption[])
        if (logsRes.error) {
          setOrderLogs([])
        } else {
          setOrderLogs((logsRes.data as AuditLog[]) ?? [])
        }

        if (loadedOrder?.status === "draft") {
          const reqItemIds = poItems
            .map((item) => item.requisition_item_id)
            .filter((value): value is string => Boolean(value))
          let maxQtyByReqItem: Record<string, number> = {}
          if (reqItemIds.length > 0) {
            const { data: reqItemsData } = await supabase
              .from("requisition_items")
              .select("id, quantity")
              .in("id", reqItemIds)
            maxQtyByReqItem = Object.fromEntries(
              (reqItemsData ?? []).map((row) => [String(row.id), Number(row.quantity)]),
            )
          }

          setEditItems(
            poItems.map((item) => ({
              id: item.id,
              material_code: item.material_code,
              material_description: item.material_description,
              unit_of_measure: item.unit_of_measure ?? "",
              unit_price: Number(item.unit_price),
              price_unit: item.price_unit,
              tax_percent: item.tax_percent,
              quantity: Number(item.quantity),
              max_quantity: item.requisition_item_id
                ? (maxQtyByReqItem[item.requisition_item_id] ?? null)
                : null,
              requisition_item_id: item.requisition_item_id,
              source_requisition_code: item.source_requisition_code,
            })),
          )

          if (loadedOrder.supplier_id) {
            const { data: supplierRow } = await supabase
              .from("suppliers")
              .select("id, name, cnpj, code")
              .eq("id", loadedOrder.supplier_id)
              .maybeSingle()
            if (supplierRow) {
              setDraftSupplier(supplierRow as DraftSupplier)
            } else {
              setDraftSupplier({
                id: loadedOrder.supplier_id,
                name: loadedOrder.supplier_name,
                cnpj: loadedOrder.supplier_cnpj,
                code: "",
              })
            }
          } else {
            setDraftSupplier(null)
          }

          const reqCodes = new Set<string>()
          for (const item of poItems) {
            if (item.source_requisition_code) reqCodes.add(item.source_requisition_code)
          }
          if (loadedOrder.requisition_code) {
            for (const code of loadedOrder.requisition_code.split(",").map((c) => c.trim())) {
              if (code) reqCodes.add(code)
            }
          }
          if (reqCodes.size > 0 && companyId) {
            const { data: reqRows } = await supabase
              .from("requisitions")
              .select("id, code")
              .eq("company_id", companyId)
              .in("code", [...reqCodes])
            setRequisitionIdByCode(
              Object.fromEntries((reqRows ?? []).map((row) => [String(row.code), String(row.id)])),
            )
          } else {
            setRequisitionIdByCode({})
          }
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
    setEditForm({
      payment_condition: order.payment_condition ?? "",
      delivery_days: order.delivery_days != null ? String(order.delivery_days) : "",
      delivery_address: order.delivery_address ?? "",
      observations: order.observations ?? "",
    })
  }, [
    order?.id,
    order?.payment_condition,
    order?.delivery_days,
    order?.delivery_address,
    order?.observations,
  ])

  React.useEffect(() => {
    if (!order) return
    if (["cancelled", "sent"].includes(order.status)) {
      setIsEditing(false)
    }
  }, [order?.status])

  React.useEffect(() => {
    if (!companyId || debouncedSupplierSearch.trim().length < 2) {
      setSupplierResults([])
      return
    }

    let alive = true
    const run = async () => {
      setSupplierSearchLoading(true)
      const supabase = createClient()
      const term = `%${debouncedSupplierSearch.replace(/%/g, "\\%").replace(/_/g, "\\_")}%`
      const { data } = await supabase
        .from("suppliers")
        .select("id, name, cnpj, code")
        .eq("company_id", companyId)
        .eq("status", "active")
        .or(`name.ilike.${term},code.ilike.${term},cnpj.ilike.${term}`)
        .limit(20)

      if (!alive) return
      setSupplierResults((data as DraftSupplier[]) ?? [])
      setSupplierSearchLoading(false)
    }

    void run()
    return () => {
      alive = false
    }
  }, [companyId, debouncedSupplierSearch])

  React.useEffect(() => {
    if (!order || order.status !== "processing" || !id || !companyId) return
    if (order.external_code?.trim()) return

    const supabase = createClient()
    const channel = supabase
      .channel(`purchase-order-status-${id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "purchase_orders",
          filter: `id=eq.${id}`,
        },
        () => {
          void fetchOrderData({ silent: true })
        },
      )
      .subscribe()

    const timer = window.setInterval(() => {
      void fetchOrderData({ silent: true })
    }, 2000)

    return () => {
      window.clearInterval(timer)
      void supabase.removeChannel(channel)
    }
  }, [order?.status, id, companyId, fetchOrderData])

  const timeline = React.useMemo(
    () => (order ? buildTimeline(order, orderLogs) : []),
    [order, orderLogs],
  )

  const openDelegateDialog = async () => {
    if (!companyId || !order) return
    setDelegateOpen(true)
    setDelegateTargetId("")
    const supabase = createClient()
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, profile_type, roles, is_superadmin")
      .eq("company_id", companyId)
      .order("full_name", { ascending: true })

    const eligible = (
      (data ?? []) as {
        id: string
        full_name: string | null
        profile_type: string | null
        roles: string[] | null
        is_superadmin: boolean | null
      }[]
    ).filter(
      (profile) =>
        profile.id !== order.created_by && isBuyerOrHigherProfile(profile),
    )
    setDelegateBuyers(eligible)
  }

  const handleDelegate = async () => {
    if (!order || !companyId || !delegateTargetId) return
    setDelegating(true)
    try {
      const supabase = createClient()
      const previousOwner = order.created_by
      const { error: updateError } = await supabase
        .from("purchase_orders")
        .update({ created_by: delegateTargetId })
        .eq("id", order.id)
        .eq("company_id", companyId)

      if (updateError) {
        toast.error("Não foi possível delegar o pedido.")
        return
      }

      const nextName =
        delegateBuyers.find((b) => b.id === delegateTargetId)?.full_name ?? null
      setOrder({ ...order, created_by: delegateTargetId })
      setResponsibleName(formatResponsibleName(nextName))

      void createNotification({
        userId: delegateTargetId,
        companyId,
        type: "purchase_order.delegated",
        title: "Pedido atribuído a você",
        body: `O pedido ${order.code} foi delegado para você.`,
        entity: "purchase_order",
        entityId: order.id,
      })

      void logAudit({
        eventType: "purchase_order.delegated",
        description: `Pedido ${order.code} delegado para ${formatResponsibleName(nextName)}`,
        companyId,
        userId: userId ?? null,
        userName: userId ?? null,
        entity: "purchase_orders",
        entityId: order.id,
        metadata: {
          code: order.code,
          from: previousOwner,
          to: delegateTargetId,
        },
      })

      toast.success("Pedido delegado com sucesso.")
      setDelegateOpen(false)
      if (!hasPermission("order.view_all") && delegateTargetId !== userId) {
        router.replace("/comprador/pedidos")
      }
    } finally {
      setDelegating(false)
    }
  }

  const handleConfirmOrder = async () => {
    if (!order || !companyId) return

    const isManualDraft = order.status === "draft" && editItems.length > 0
    if (isManualDraft) {
      if (!validateDraftForConfirm()) return
    } else {
      if (editForm.delivery_days.trim()) {
        const d = parseInt(editForm.delivery_days, 10)
        if (Number.isNaN(d) || d < 1) {
          toast.error("Prazo de entrega deve ser um número inteiro a partir de 1.")
          return
        }
      }
      if (!validateAccountConfigsAndSetErrors()) return
    }

    setConfirmingPedido(true)
    try {
      const supabase = createClient()

      if (isManualDraft) {
        const saved = await persistDraftForConfirm()
        if (!saved) return
        await updateLinkedRequisitionsOnConfirm()
      } else {
        const accountResult = await savePurchaseOrderAccountConfigs(
          supabase,
          companyId,
          accountConfigs,
        )
        if (!accountResult.ok) {
          toast.error(accountResult.message)
          return
        }
        const { error: headerError } = await supabase
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
            updated_at: new Date().toISOString(),
          })
          .eq("id", order.id)
          .eq("company_id", companyId)
        if (headerError) throw headerError
      }

      const { error } = await supabase
        .from("purchase_orders")
        .update({
          status: "sent",
          updated_at: new Date().toISOString(),
        })
        .eq("id", order.id)
        .eq("company_id", companyId)
      if (error) throw error
      void notifySupplierOrderSent({
        id: order.id,
        code: order.code,
        supplier_name: draftSupplier?.name ?? order.supplier_name,
        company_id: order.company_id,
        supplier_id: draftSupplier?.id ?? order.supplier_id ?? null,
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
        .update({
          status: "sent",
          accepted_by_supplier: false,
          accepted_at: null,
          estimated_delivery_date: null,
          erp_error_message: null,
        })
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
    if (!order || !companyId) return

    const initialForm = {
      payment_condition: order.payment_condition ?? "",
      delivery_days: order.delivery_days != null ? String(order.delivery_days) : "",
      delivery_address: order.delivery_address ?? "",
      observations: order.observations ?? "",
    }
    const initialItems = items.map((item) => ({
      id: item.id,
      material_code: item.material_code,
      material_description: item.material_description,
      unit_of_measure: item.unit_of_measure ?? "",
      unit_price: Number(item.unit_price),
      price_unit: item.price_unit,
      tax_percent: item.tax_percent != null ? Number(item.tax_percent) : null,
      quantity: Number(item.quantity),
      max_quantity: null as number | null,
      requisition_item_id: item.requisition_item_id,
      source_requisition_code: item.source_requisition_code,
    }))

    setEditSnapshot({ form: initialForm, items: initialItems })
    setEditForm(initialForm)
    setEditItems(initialItems)
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

  const handleCancelEdit = () => {
    if (editSnapshot) {
      setEditForm(editSnapshot.form)
      setEditItems(editSnapshot.items)
    }
    setAccountConfigs(
      Object.fromEntries(
        items.map((item) => [
          item.id,
          parseItemAccountConfigFromDb(
            item.account_assignment_category,
            item.account_assignment_distribution,
            item.account_assignments,
          ),
        ]),
      ),
    )
    setEditSnapshot(null)
    setIsEditing(false)
  }

  const handleRetryErpIntegration = async (
    operation: "create" | "update" | "delete" = "create",
    options?: { cancellationReason?: string },
  ) => {
    if (!order) return
    setRetryingIntegration(true)
    try {
      const res = await fetch(`/api/purchase-orders/${order.id}/erp-integration`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "buyer",
          operation,
          cancellation_reason: options?.cancellationReason,
        }),
      })
      const json = (await res.json()) as {
        success?: boolean
        errorMessage?: string
        error?: string
      }
      if (!res.ok || json.success === false) {
        toast.error(json.errorMessage ?? json.error ?? "Falha ao reenviar integração com o ERP.")
        return false
      }
      if (operation === "delete") {
        toast.success("Pedido cancelado no ERP e no Valore.")
      } else if (operation === "update") {
        toast.success("Pedido atualizado no ERP. Reenvie ao fornecedor para novo aceite.")
      } else {
        toast.success("Integração reenviada ao ERP com sucesso.")
      }
      await fetchOrderData({ silent: true })
      return true
    } catch (e) {
      console.error(e)
      toast.error("Não foi possível reenviar a integração.")
      return false
    } finally {
      setRetryingIntegration(false)
    }
  }

  const handleCancelIntegratedOrder = async () => {
    if (!order) return
    setCancellingIntegrated(true)
    try {
      const ok = await handleRetryErpIntegration("delete", {
        cancellationReason: "Pedido cancelado pelo comprador",
      })
      if (ok) setCancelIntegratedOpen(false)
    } finally {
      setCancellingIntegrated(false)
    }
  }

  const persistOrderEdits = async () => {
    if (!order || !companyId) return false

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
        updated_at: new Date().toISOString(),
      })
      .eq("id", order.id)
      .eq("company_id", companyId)

    if (orderError) throw orderError

    const itemResults = await Promise.all(
      editItems.map((row) =>
        supabase
          .from("purchase_order_items")
          .update({
            quantity: row.quantity,
            unit_price: row.unit_price,
            price_unit: row.price_unit,
          })
          .eq("id", row.id)
          .eq("company_id", companyId),
      ),
    )
    const firstItemErr = itemResults.find((r) => r.error)?.error
    if (firstItemErr) throw firstItemErr

    const accountResult = await savePurchaseOrderAccountConfigs(
      supabase,
      companyId,
      accountConfigs,
    )
    if (!accountResult.ok) {
      toast.error(accountResult.message)
      return false
    }
    return true
  }

  const validateAccountConfigsAndSetErrors = React.useCallback(() => {
    if (!accountAssignmentEnabled) {
      setAccountConfigErrors({})
      return true
    }
    const sourceItems =
      isEditing || (order?.status === "draft" && editItems.length > 0)
        ? editItems.map((item) => ({ id: item.id, material_code: item.material_code }))
        : items.map((item) => ({ id: item.id, material_code: item.material_code }))

    const result = validateAllAccountConfigsForSubmit(sourceItems, accountConfigs)
    if (!result.ok) {
      setAccountConfigErrors(result.errorsByItemId)
      toast.error(result.firstMessage)
      return false
    }
    setAccountConfigErrors({})
    return true
  }, [accountAssignmentEnabled, accountConfigs, editItems, isEditing, items, order?.status])

  async function loadAvailableRequisitions() {
    if (!companyId) return
    setRequisitionsLoading(true)
    try {
      const supabase = createClient()
      const { data: reqs } = await supabase
        .from("requisitions")
        .select("id, code, title, created_at")
        .eq("company_id", companyId)
        .in("status", ["approved", "in_quotation"])
        .order("created_at", { ascending: false })

      if (!reqs || reqs.length === 0) {
        setRequisitions([])
        return
      }

      const { data: allItems } = await supabase
        .from("requisition_items")
        .select(
          "id, requisition_id, material_code, material_description, unit_of_measure, quantity",
        )
        .in(
          "requisition_id",
          reqs.map((r) => r.id),
        )

      type ReqItemRow = {
        id: string
        requisition_id: string
        material_code: string | null
        material_description: string
        unit_of_measure: string | null
        quantity: number
      }

      const itemsByReq: Record<string, ReqItemRow[]> = {}
      for (const row of (allItems ?? []) as ReqItemRow[]) {
        if (!itemsByReq[row.requisition_id]) itemsByReq[row.requisition_id] = []
        itemsByReq[row.requisition_id].push(row)
      }

      setRequisitions(
        reqs.map((r) => ({
          id: r.id,
          code: r.code,
          title: r.title,
          created_at: r.created_at,
          items: (itemsByReq[r.id] ?? []).map((i) => ({
            id: i.id,
            material_code: i.material_code,
            material_description: i.material_description,
            unit_of_measure: i.unit_of_measure,
            quantity: i.quantity,
          })),
        })),
      )
    } finally {
      setRequisitionsLoading(false)
    }
  }

  const handleImportRequisitions = async () => {
    if (!order || !companyId) return
    const selected = requisitions.filter((r) => selectedReqIds.includes(r.id))
    const existingReqItemIds = new Set(
      editItems.map((line) => line.requisition_item_id).filter(Boolean) as string[],
    )
    const newLines: EditItem[] = []

    for (const req of selected) {
      for (const item of req.items) {
        if (existingReqItemIds.has(item.id)) continue
        existingReqItemIds.add(item.id)
        newLines.push({
          id: `pending-${item.id}`,
          material_code: item.material_code ?? "",
          material_description: item.material_description,
          unit_of_measure: item.unit_of_measure ?? "",
          unit_price: 0,
          price_unit: 1,
          tax_percent: null,
          quantity: item.quantity ?? 1,
          max_quantity: item.quantity ?? 1,
          requisition_item_id: item.id,
          source_requisition_code: req.code,
        })
      }
    }

    if (newLines.length === 0) {
      toast.warning("Todos os itens selecionados já estão no pedido.")
      setReqDialogOpen(false)
      setSelectedReqIds([])
      return
    }

    const supabase = createClient()
    const { data: inserted, error } = await supabase
      .from("purchase_order_items")
      .insert(
        newLines.map((line) => ({
          purchase_order_id: order.id,
          company_id: companyId,
          material_code: line.material_code,
          material_description: line.material_description,
          quantity: line.quantity,
          unit_of_measure: line.unit_of_measure,
          unit_price: 0,
          price_unit: 1,
          tax_percent: null,
          delivery_days: null,
          requisition_item_id: line.requisition_item_id,
          source_requisition_code: line.source_requisition_code,
        })),
      )
      .select("id, requisition_item_id")

    if (error || !inserted) {
      toast.error(error?.message ?? "Não foi possível importar os itens.")
      return
    }

    const copyResults = await Promise.all(
      inserted.map((row) => {
        const requisitionItemId = row.requisition_item_id as string | null
        if (!requisitionItemId) return Promise.resolve({ ok: true as const })
        return copyRequisitionAccountConfigToPurchaseOrderItem(
          supabase,
          companyId,
          requisitionItemId,
          String(row.id),
        )
      }),
    )
    const firstCopyError = copyResults.find(
      (result): result is { ok: false; message: string } => !result.ok,
    )
    if (firstCopyError) {
      toast.error(firstCopyError.message)
      return
    }

    const insertedLines: EditItem[] = newLines.map((line, index) => ({
      ...line,
      id: String(inserted[index]?.id ?? line.id),
    }))

    setEditItems((prev) => [...prev, ...insertedLines])
    setItems((prev) => [
      ...prev,
      ...insertedLines.map((line) => ({
        id: line.id,
        material_code: line.material_code,
        material_description: line.material_description,
        quantity: line.quantity,
        unit_of_measure: line.unit_of_measure,
        unit_price: line.unit_price,
        price_unit: line.price_unit,
        tax_percent: line.tax_percent,
        total_price: computePoLineTotal(line.quantity, line.unit_price, line.price_unit),
        contract_id: null,
        contract_item_id: null,
        contract_code: null,
        contract_item_line: null,
        requisition_item_id: line.requisition_item_id,
        source_requisition_code: line.source_requisition_code,
        account_assignment_category: null,
        account_assignment_distribution: "",
        account_assignments: [],
      })),
    ])

    const reqCodes = new Set<string>()
    for (const line of [...editItems, ...insertedLines]) {
      if (line.source_requisition_code) reqCodes.add(line.source_requisition_code)
    }
    if (order.requisition_code) {
      for (const code of order.requisition_code.split(",").map((c) => c.trim())) {
        if (code) reqCodes.add(code)
      }
    }
    const requisitionCodeHeader = [...reqCodes].sort().join(", ")
    await supabase
      .from("purchase_orders")
      .update({ requisition_code: requisitionCodeHeader || null })
      .eq("id", order.id)
      .eq("company_id", companyId)

    const { data: reqRows } = await supabase
      .from("requisitions")
      .select("id, code")
      .eq("company_id", companyId)
      .in("code", [...reqCodes])
    setRequisitionIdByCode(
      Object.fromEntries((reqRows ?? []).map((row) => [String(row.code), String(row.id)])),
    )

    toast.success(`${insertedLines.length} item(s) importado(s).`)
    setReqDialogOpen(false)
    setSelectedReqIds([])
    await fetchOrderData({ silent: true })
  }

  const removeDraftLine = async (lineId: string) => {
    if (!order || !companyId || editItems.length <= 1) return
    const supabase = createClient()
    const { error } = await supabase
      .from("purchase_order_items")
      .delete()
      .eq("id", lineId)
      .eq("purchase_order_id", order.id)
    if (error) {
      toast.error("Não foi possível remover o item.")
      return
    }
    setEditItems((prev) => prev.filter((line) => line.id !== lineId))
    setItems((prev) => prev.filter((line) => line.id !== lineId))
  }

  const persistDraftData = async (): Promise<boolean> => {
    if (!order || !companyId) return false

    const totalPrice = editItems.reduce(
      (sum, line) => sum + computePoLineTotal(line.quantity, line.unit_price, line.price_unit),
      0,
    )
    const headerDaysRaw = editForm.delivery_days.trim()
    const headerDays = headerDaysRaw ? parseInt(headerDaysRaw, 10) : null

    const supabase = createClient()
    const orderUpdate: Record<string, unknown> = {
      payment_condition: editForm.payment_condition.trim() || null,
      delivery_days:
        headerDays != null && !Number.isNaN(headerDays) && headerDays > 0 ? headerDays : null,
      delivery_address: editForm.delivery_address.trim() || null,
      observations: editForm.observations.trim() || null,
      total_price: Math.round(totalPrice * 100) / 100,
      updated_at: new Date().toISOString(),
    }

    if (draftSupplier) {
      orderUpdate.supplier_id = draftSupplier.id
      orderUpdate.supplier_name = draftSupplier.name
      orderUpdate.supplier_cnpj = draftSupplier.cnpj
    }

    const { data: updatedOrder, error: orderError } = await supabase
      .from("purchase_orders")
      .update(orderUpdate)
      .eq("id", order.id)
      .eq("company_id", companyId)
      .select("id")
      .maybeSingle()

    if (orderError) throw orderError
    if (!updatedOrder) {
      throw new Error("Sem permissão para salvar o pedido neste tenant.")
    }

    if (editItems.length > 0) {
      const itemResults = await Promise.all(
        editItems.map((row) =>
          supabase
            .from("purchase_order_items")
            .update({
              quantity: row.quantity,
              unit_price: row.unit_price,
              price_unit: row.price_unit,
              total_price: computePoLineTotal(
                row.quantity,
                row.unit_price,
                row.price_unit,
              ),
            })
            .eq("id", row.id)
            .eq("company_id", companyId)
            .select("id")
            .maybeSingle(),
        ),
      )
      const firstItemErr = itemResults.find((r) => r.error)?.error
      if (firstItemErr) throw firstItemErr
      const missingItem = itemResults.find((r) => !r.data)
      if (missingItem) {
        throw new Error("Sem permissão para salvar um ou mais itens do pedido.")
      }
    }

    const accountResult = await savePurchaseOrderAccountConfigs(
      supabase,
      companyId,
      accountConfigs,
    )
    if (!accountResult.ok) {
      toast.error(accountResult.message)
      return false
    }
    return true
  }

  const persistDraftForConfirm = async () => {
    if (!draftSupplier) return false
    return persistDraftData()
  }

  const handleSaveDraft = async () => {
    if (!order || !companyId || !isDraftEditable) return
    setSavingDraft(true)
    try {
      const ok = await persistDraftData()
      if (ok) {
        toast.success("Rascunho salvo.")
        await fetchOrderData({ silent: true })
      }
    } catch (e) {
      console.error("handleSaveDraft", e)
      toast.error(formatPersistError(e, "Não foi possível salvar o rascunho."))
    } finally {
      setSavingDraft(false)
    }
  }

  const validateDraftForConfirm = () => {
    const headerErrors: PoHeaderFieldErrors = {}
    const lineErrors: Record<string, PoLineFieldErrors> = {}
    let firstMessage: string | null = null
    const noteError = (message: string) => {
      if (!firstMessage) firstMessage = message
    }

    if (!draftSupplier) {
      headerErrors.supplier = true
      noteError("Selecione um fornecedor.")
    }
    if (!editForm.payment_condition.trim()) {
      headerErrors.payment_condition = true
      noteError("Selecione a condição de pagamento.")
    }
    if (!editForm.delivery_address.trim()) {
      headerErrors.delivery_address = true
      noteError("Informe o endereço de entrega.")
    }
    if (editItems.length === 0) {
      noteError("Adicione ao menos um item ao pedido.")
    }

    for (const item of editItems) {
      const fieldErrors: PoLineFieldErrors = {}

      const qtyCheck = validateQuantity(
        item.quantity,
        Math.min(maxQuantity, item.max_quantity ?? maxQuantity),
      )
      if (!qtyCheck.ok) {
        fieldErrors.quantity = true
        noteError(`${item.material_code}: ${qtyCheck.message}`)
      } else if (item.max_quantity != null && item.quantity > item.max_quantity) {
        fieldErrors.quantity = true
        noteError(
          `${item.material_code}: quantidade excede a requisição (máx: ${item.max_quantity})`,
        )
      }

      const priceCheck = validatePrice(item.unit_price, priceDecimalPlaces)
      if (!priceCheck.ok) {
        fieldErrors.unit_price = true
        noteError(`${item.material_code}: ${priceCheck.message}`)
      }

      if (porEnabled && !isPorValue(item.price_unit)) {
        fieldErrors.price_unit = true
        noteError(`${item.material_code}: selecione um POR válido.`)
      }

      if (Object.keys(fieldErrors).length > 0) {
        lineErrors[item.id] = fieldErrors
      }
    }

    if (editForm.delivery_days.trim()) {
      const d = parseInt(editForm.delivery_days, 10)
      if (Number.isNaN(d) || d < 1) {
        noteError("Prazo de entrega deve ser um número inteiro a partir de 1.")
      }
    }

    setHeaderFieldErrors(headerErrors)
    setLineItemFieldErrors(lineErrors)

    if (!validateAccountConfigsAndSetErrors()) return false

    if (firstMessage) {
      toast.error(firstMessage)
      return false
    }

    setHeaderFieldErrors({})
    setLineItemFieldErrors({})
    return true
  }

  const updateLinkedRequisitionsOnConfirm = async () => {
    if (!order || !companyId) return
    const reqCodes = new Set<string>()
    for (const line of editItems) {
      if (line.source_requisition_code) reqCodes.add(line.source_requisition_code)
    }
    if (order.requisition_code) {
      for (const code of order.requisition_code.split(",").map((c) => c.trim())) {
        if (code) reqCodes.add(code)
      }
    }
    if (reqCodes.size === 0) return

    const supabase = createClient()
    const { data: reqs } = await supabase
      .from("requisitions")
      .select("id")
      .eq("company_id", companyId)
      .in("code", [...reqCodes])

    const ids = (reqs ?? []).map((r) => String(r.id))
    if (ids.length === 0) return

    await supabase
      .from("requisitions")
      .update({ status: "awaiting_buyer" })
      .eq("company_id", companyId)
      .in("id", ids)
  }

  const validateEditForm = () => {
    const lineErrors: Record<string, PoLineFieldErrors> = {}
    let firstMessage: string | null = null
    const noteError = (message: string) => {
      if (!firstMessage) firstMessage = message
    }

    if (editForm.delivery_days.trim()) {
      const d = parseInt(editForm.delivery_days, 10)
      if (Number.isNaN(d) || d < 1) {
        noteError("Prazo de entrega deve ser um número inteiro a partir de 1.")
      }
    }

    for (const item of editItems) {
      const fieldErrors: PoLineFieldErrors = {}

      const qtyCheck = validateQuantity(
        item.quantity,
        Math.min(maxQuantity, item.max_quantity ?? maxQuantity),
      )
      if (!qtyCheck.ok) {
        fieldErrors.quantity = true
        noteError(`${item.material_code}: ${qtyCheck.message}`)
      } else if (item.max_quantity != null && item.quantity > item.max_quantity) {
        fieldErrors.quantity = true
        noteError(
          `${item.material_code}: quantidade excede a requisição (máx: ${item.max_quantity})`,
        )
      }
      if (Object.keys(fieldErrors).length > 0) {
        lineErrors[item.id] = fieldErrors
      }
    }

    setLineItemFieldErrors(lineErrors)
    if (!validateAccountConfigsAndSetErrors()) return false

    if (firstMessage) {
      toast.error(firstMessage)
      return false
    }

    setLineItemFieldErrors({})
    return true
  }

  const handleSaveAndRetryIntegration = async () => {
    if (!order || !companyId) return
    if (!validateEditForm()) return

    setSavingEdit(true)
    try {
      await persistOrderEdits()
      setIsEditing(false)
      await fetchOrderData({ silent: true })
      setSavingEdit(false)
      await handleRetryErpIntegration(order.external_code?.trim() ? "update" : "create")
    } catch (err) {
      console.error(err)
      toast.error("Erro ao salvar: " + (err instanceof Error ? err.message : String(err)))
    } finally {
      setSavingEdit(false)
    }
  }

  const handleSaveIntegratedEdit = async () => {
    if (!order || !companyId) return
    if (!validateEditForm()) return

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
          status: "draft",
          accepted_by_supplier: false,
          accepted_at: null,
          estimated_delivery_date: null,
          erp_error_message: null,
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

      const accountResult = await savePurchaseOrderAccountConfigs(
        supabase,
        companyId,
        accountConfigs,
      )
      if (!accountResult.ok) {
        toast.error(accountResult.message)
        return
      }

      setEditSnapshot(null)
      setIsEditing(false)
      toast.success("Alterações salvas. Reenvie ao fornecedor quando estiver pronto.")
      await fetchOrderData({ silent: true })
    } catch (err) {
      console.error(err)
      toast.error("Erro ao salvar: " + (err instanceof Error ? err.message : String(err)))
    } finally {
      setSavingEdit(false)
    }
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

    if (!validateAccountConfigsAndSetErrors()) return

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

      const accountResult = await savePurchaseOrderAccountConfigs(
        supabase,
        companyId,
        accountConfigs,
      )
      if (!accountResult.ok) {
        toast.error(accountResult.message)
        return
      }

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
      const orderTotal = items.reduce(
        (sum, item) =>
          sum + computePoLineTotal(item.quantity, item.unit_price, item.price_unit),
        0,
      )

      const workbook = await buildPurchaseOrderDetailWorkbook(
        {
          code: order.code,
          erp_code: erpCode,
          supplier_name: order.supplier_name,
          supplier_cnpj: order.supplier_cnpj,
          payment_condition: order.payment_condition,
          delivery_days: order.delivery_days,
          estimated_delivery_label: getOrderEstimatedDeliveryLabel(order),
          quotation_code: order.quotation_code,
          requisition_code: order.requisition_code,
          delivery_address: order.delivery_address,
          observations: order.observations,
          created_at_label: order.created_at
            ? formatDateTimeBR(order.created_at, true)
            : "—",
          items: items.map((item) => ({
            material_code: item.material_code,
            material_description: item.material_description,
            quantity: item.quantity,
            unit_of_measure: item.unit_of_measure,
            price_unit: item.price_unit,
            unit_price: item.unit_price,
            total_price: item.total_price,
          })),
          order_total: order.total_price ?? orderTotal,
        },
        {
          porEnabled,
          lineTotal: (item) =>
            computePoLineTotal(item.quantity, item.unit_price, item.price_unit),
        },
      )

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
    } catch (err) {
      console.error(err)
      toast.error("Não foi possível exportar o pedido para Excel.")
    } finally {
      setExporting(false)
    }
  }

  const handleDownloadPDF = async () => {
    if (!order) return
    setGeneratingPdf(true)
    try {
      const response = await fetch(`/api/purchase-order-pdf?id=${order.id}`)
      if (!response.ok) {
        let message = "Erro ao gerar PDF"
        try {
          const payload = (await response.json()) as { error?: string }
          if (payload.error) message = payload.error
        } catch {
          // resposta não-JSON
        }
        throw new Error(message)
      }

      const contentType = response.headers.get("content-type") ?? ""
      if (!contentType.includes("application/pdf")) {
        throw new Error("Resposta inválida do servidor ao gerar PDF.")
      }

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
      toast.error(
        e instanceof Error ? e.message : "Não foi possível gerar o PDF.",
      )
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
          <Button variant="ghost" size="icon" onClick={() => router.push(backHref)}>
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
          <Button variant="ghost" size="icon" onClick={() => router.push(backHref)}>
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
    ? formatDateTimeBR(order.created_at, true)
    : "—"

  const statusDisplay = getPOStatusForBuyer(order.status)
  const erpCode = order.external_code ?? order.erp_code ?? null
  const integratedOrder = Boolean(erpCode?.trim())

  // Permissão de edição: order.edit = edita qualquer pedido; order.edit_own = só os que criou
  const canEditOrder =
    hasPermission("order.edit") ||
    (hasPermission("order.edit_own") && order.created_by === userId)

  const canEditAccountConfig =
    accountAssignmentEnabled &&
    canEditOrder &&
    (isEditing || (order.status === "draft" && !integratedOrder))

  const isDraftEditable =
    order.status === "draft" && !integratedOrder && canEditOrder

  const showHeaderEdit = isEditing || isDraftEditable

  const handleAccountConfigChange = (
    itemId: string,
    config: ItemAccountConfigEdit,
  ) => {
    setAccountConfigs((prev) => ({ ...prev, [itemId]: config }))
    setAccountConfigErrors((prev) => {
      if (!prev[itemId]) return prev
      const next = { ...prev }
      delete next[itemId]
      return next
    })
  }

  const canDelegate =
    order.status !== "cancelled" &&
    order.status !== "completed" &&
    (order.created_by === userId || hasPermission("order.delegate"))

  const totalItemsCount = items.length

  const showItemEdit = isEditing || isDraftEditable

  const displayedOrderTotal = showItemEdit
    ? editItems.reduce(
        (s, i) => s + computePoLineTotal(i.quantity, i.unit_price, i.price_unit),
        0,
      )
    : items.reduce(
        (s, i) => s + computePoLineTotal(i.quantity, i.unit_price, i.price_unit),
        0,
      ) || (order.total_price ?? 0)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push(backHref)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{order.code}</h1>
          <p className="text-muted-foreground">Criado em {createdAtLabel}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <EntityApprovalActions
            flow="order"
            entityId={id}
            companyId={companyId}
            onDecided={() => fetchOrderData({ silent: true })}
          />
          <span
            className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${poStatusBadgeClass(statusDisplay.color)}`}
          >
            {order.status === "draft" ? (
              <FileEdit className="mr-1.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            ) : null}
            {statusDisplay.label}
          </span>
          {order.status === "draft" && !integratedOrder && canEditOrder && (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void handleSaveDraft()}
                disabled={savingDraft || confirmingPedido || cancellingPedido}
              >
                {savingDraft ? "Salvando..." : "Salvar"}
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleConfirmOrder}
                disabled={confirmingPedido || cancellingPedido || savingDraft}
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
          {order.status === "draft" && integratedOrder && canEditOrder && (
            <>
              {!isEditing ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={resendingOrder || savingEdit}
                    onClick={() => void handleStartEdit()}
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    Editar
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    disabled={resendingOrder || savingEdit}
                    onClick={() => setResendOpen(true)}
                  >
                    Reenviar ao Fornecedor
                  </Button>
                  <AlertDialog open={cancelIntegratedOpen} onOpenChange={setCancelIntegratedOpen}>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        disabled={cancellingIntegrated || savingEdit}
                      >
                        <X className="mr-2 h-4 w-4" />
                        Cancelar Pedido
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Cancelar pedido no ERP?</AlertDialogTitle>
                        <AlertDialogDescription>
                          O cancelamento só será concluído no Valore após confirmação do ERP.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel disabled={cancellingIntegrated}>Voltar</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          disabled={cancellingIntegrated}
                          onClick={(e) => {
                            e.preventDefault()
                            void handleCancelIntegratedOrder()
                          }}
                        >
                          {cancellingIntegrated ? "Cancelando..." : "Confirmar cancelamento"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              ) : (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={savingEdit}
                    onClick={handleCancelEdit}
                  >
                    Cancelar Edição
                  </Button>
                  <Button
                    size="sm"
                    disabled={savingEdit}
                    className="bg-green-600 text-white hover:bg-green-700"
                    onClick={() => void handleSaveIntegratedEdit()}
                  >
                    {savingEdit ? "Salvando..." : "Salvar"}
                  </Button>
                </>
              )}
            </>
          )}
          {order.status === "refused" && canEditOrder && (
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
          {order.status === "error" && canEditOrder && (
            <>
              {!isEditing ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={retryingIntegration || savingEdit}
                    onClick={() => void handleStartEdit()}
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    Editar
                  </Button>
                  <Button
                    size="sm"
                    disabled={retryingIntegration || savingEdit}
                    onClick={() =>
                      void handleRetryErpIntegration(integratedOrder ? "update" : "create")
                    }
                  >
                    {retryingIntegration ? "Reenviando..." : "Reenviar integração"}
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={savingEdit || retryingIntegration}
                    onClick={() => setIsEditing(false)}
                  >
                    Cancelar Edição
                  </Button>
                  <Button
                    size="sm"
                    disabled={savingEdit || retryingIntegration}
                    className="bg-green-600 text-white hover:bg-green-700"
                    onClick={() => void handleSaveAndRetryIntegration()}
                  >
                    {savingEdit || retryingIntegration
                      ? "Salvando..."
                      : "Salvar e reenviar integração"}
                  </Button>
                </>
              )}
            </>
          )}
          {order.status === "completed" && integratedOrder && canEditOrder && (
            <>
              {!isEditing ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={cancellingIntegrated || savingEdit}
                    onClick={() => void handleStartEdit()}
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    Editar
                  </Button>
                  <AlertDialog open={cancelIntegratedOpen} onOpenChange={setCancelIntegratedOpen}>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        disabled={cancellingIntegrated || retryingIntegration || savingEdit}
                      >
                        <X className="mr-2 h-4 w-4" />
                        Cancelar Pedido
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Cancelar pedido no ERP?</AlertDialogTitle>
                        <AlertDialogDescription>
                          O cancelamento só será concluído no Valore após confirmação do ERP.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel disabled={cancellingIntegrated}>Voltar</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          disabled={cancellingIntegrated}
                          onClick={(e) => {
                            e.preventDefault()
                            void handleCancelIntegratedOrder()
                          }}
                        >
                          {cancellingIntegrated ? "Cancelando..." : "Confirmar cancelamento"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              ) : (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={savingEdit}
                    onClick={handleCancelEdit}
                  >
                    Cancelar Edição
                  </Button>
                  <Button
                    size="sm"
                    disabled={savingEdit}
                    className="bg-green-600 text-white hover:bg-green-700"
                    onClick={() => void handleSaveIntegratedEdit()}
                  >
                    {savingEdit ? "Salvando..." : "Salvar"}
                  </Button>
                </>
              )}
            </>
          )}
          <AlertDialog open={resendOpen} onOpenChange={setResendOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reenviar ao fornecedor?</AlertDialogTitle>
                <AlertDialogDescription>
                  Reenviar pedido {order.code} ao fornecedor para novo aceite?
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
          {canDelegate && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void openDelegateDialog()}
            >
              <UserRoundPlus className="mr-2 h-4 w-4" />
              Delegar
            </Button>
          )}
          <Button
            variant="default"
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 text-white"
            onClick={() => void handleDownloadPDF()}
            disabled={generatingPdf}
          >
            <FileText className="mr-2 h-4 w-4" />
            {generatingPdf ? "Gerando PDF..." : "PDF Pedido"}
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
            <Download className="mr-2 h-4 w-4" />
            {exporting ? "Exportando..." : "Exportar"}
          </Button>
        </div>
      </div>

      {(order.status === "error" || order.status === "integration_error") && (
        <div className="bg-destructive/10 border border-destructive/40 rounded-xl p-4 flex gap-3 items-start">
          <AlertCircle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
          <div>
            {(() => {
              const copy = getBuyerOrderErrorCopy(order.status, order.erp_error_message)
              return (
                <>
                  <p className="text-sm font-medium text-destructive">{copy.title}</p>
                  <p className="text-sm text-destructive/90 mt-1">{copy.body}</p>
                  {!copy.allowBuyerRetry ? (
                    <p className="text-sm text-destructive/80 mt-2">
                      Entre em contato com a TI ou com o administrador do portal para regularizar a
                      integração pelo Monitor de Integração.
                    </p>
                  ) : (
                    <p className="text-sm text-destructive/80 mt-2">
                      Revise os dados do pedido, edite se necessário e reenvie a integração ao ERP.
                    </p>
                  )}
                </>
              )
            })()}
          </div>
        </div>
      )}

      {order.status === "completed" && erpCode ? (
        <ViewOnceBanner
          active
          storageKey={`valore:po-banner:${order.id}:erp-success`}
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 flex items-start gap-3"
        >
          <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-emerald-800">
              Pedido integrado ao ERP com sucesso. Código ERP: {erpCode}
            </p>
          </div>
        </ViewOnceBanner>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Dados do Fornecedor</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="space-y-1.5 min-w-0">
              <p className="text-xs text-muted-foreground">
                Fornecedor<span className="text-destructive">*</span>
              </p>
              {isDraftEditable ? (
                draftSupplier ? (
                  <div
                    className={cn(
                      "flex items-center justify-between rounded-lg border px-3 py-2",
                      headerFieldErrors.supplier
                        ? "border-destructive"
                        : "border-border",
                    )}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{draftSupplier.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {draftSupplier.code}
                        {draftSupplier.cnpj ? ` · ${draftSupplier.cnpj}` : ""}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="shrink-0"
                      onClick={() => setDraftSupplier(null)}
                    >
                      Alterar
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div
                      className={cn(
                        "relative rounded-lg",
                        headerFieldErrors.supplier && "ring-1 ring-destructive",
                      )}
                    >
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        className={cn(
                          "pl-9",
                          invalidFieldClass(headerFieldErrors.supplier),
                        )}
                        placeholder="Nome, código ou CNPJ..."
                        value={supplierSearch}
                        onChange={(e) => setSupplierSearch(e.target.value)}
                      />
                    </div>
                    {supplierSearch.trim().length >= 2 && (
                      <div className="rounded-lg border border-border max-h-48 overflow-y-auto">
                        {supplierSearchLoading ? (
                          <p className="p-3 text-sm text-muted-foreground">Buscando...</p>
                        ) : supplierResults.length === 0 ? (
                          <p className="p-3 text-sm text-muted-foreground">
                            Nenhum fornecedor encontrado.
                          </p>
                        ) : (
                          supplierResults.map((s) => (
                            <button
                              key={s.id}
                              type="button"
                              className="w-full text-left px-3 py-2 hover:bg-muted/50 border-b border-border last:border-b-0"
                              onClick={() => {
                                setDraftSupplier(s)
                                setSupplierSearch("")
                                setSupplierResults([])
                                setHeaderFieldErrors((prev) => {
                                  if (!prev.supplier) return prev
                                  const next = { ...prev }
                                  delete next.supplier
                                  return next
                                })
                              }}
                            >
                              <p className="text-sm font-medium">{s.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {s.code}
                                {s.cnpj ? ` · ${s.cnpj}` : ""}
                              </p>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )
              ) : (
                <div>
                  <p className="font-medium">{order.supplier_name}</p>
                  {order.supplier_cnpj ? (
                    <p className="text-xs text-muted-foreground mt-0.5">{order.supplier_cnpj}</p>
                  ) : null}
                </div>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 min-w-0">
                <p className="text-xs text-muted-foreground">
                  Condição de Pagamento<span className="text-destructive">*</span>
                </p>
                {showHeaderEdit ? (
                  paymentOptions.length > 0 ? (
                    <Select
                      value={
                        paymentOptions.find(
                          (o) =>
                            editForm.payment_condition === o.code ||
                            editForm.payment_condition === `${o.code} — ${o.description}`,
                        )?.code ?? undefined
                      }
                      onValueChange={(v) => {
                        const opt = paymentOptions.find((o) => o.code === v)
                        setEditForm((f) => ({
                          ...f,
                          payment_condition: opt ? `${opt.code} — ${opt.description}` : v,
                        }))
                        setHeaderFieldErrors((prev) => {
                          if (!prev.payment_condition) return prev
                          const next = { ...prev }
                          delete next.payment_condition
                          return next
                        })
                      }}
                    >
                      <SelectTrigger
                        className={cn(
                          "w-full",
                          invalidFieldClass(headerFieldErrors.payment_condition),
                        )}
                      >
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {paymentOptions.map((opt) => (
                          <SelectItem key={opt.id} value={opt.code}>
                            {opt.code} — {opt.description}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      value={editForm.payment_condition}
                      onChange={(e) => {
                        setEditForm((f) => ({ ...f, payment_condition: e.target.value }))
                        setHeaderFieldErrors((prev) => {
                          if (!prev.payment_condition) return prev
                          const next = { ...prev }
                          delete next.payment_condition
                          return next
                        })
                      }}
                      className={invalidFieldClass(headerFieldErrors.payment_condition)}
                      placeholder="Condição de pagamento"
                    />
                  )
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {order.payment_condition ?? "—"}
                  </p>
                )}
              </div>

              <div className="space-y-1.5 min-w-0">
                <p className="text-xs text-muted-foreground">Prazo de Entrega</p>
                {showHeaderEdit ? (
                  <QuantityInput
                    value={Number(editForm.delivery_days) || 0}
                    maxQuantity={9999}
                    onValueChange={(val) =>
                      setEditForm((f) => ({ ...f, delivery_days: String(val) }))
                    }
                    placeholder="Dias"
                    className="w-full"
                  />
                ) : (
                  <p className="text-sm font-medium">
                    {order.delivery_days != null ? `${order.delivery_days} dias` : "—"}
                  </p>
                )}
              </div>
            </div>

            {!isDraftEditable ? (
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
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Dados do Pedido</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <p className="text-xs text-muted-foreground">Responsável</p>
                <p className="text-sm text-foreground">{responsibleName}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Código da Cotação</p>
                <p className="text-sm text-foreground">{order.quotation_code ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Código ERP</p>
                <p className="text-sm text-foreground">
                  {erpCode ?? "Aguardando integração"}
                </p>
              </div>
            </div>
            {!isDraftEditable && order.requisition_code ? (
              <div>
                <p className="text-xs text-muted-foreground">Código da Requisição</p>
                <p className="text-sm text-foreground">{order.requisition_code}</p>
              </div>
            ) : null}
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">
                Endereço de Entrega<span className="text-destructive">*</span>
              </p>
              {showHeaderEdit ? (
                <Input
                  value={editForm.delivery_address}
                  onChange={(e) => {
                    setEditForm((f) => ({ ...f, delivery_address: e.target.value }))
                    setHeaderFieldErrors((prev) => {
                      if (!prev.delivery_address) return prev
                      const next = { ...prev }
                      delete next.delivery_address
                      return next
                    })
                  }}
                  className={invalidFieldClass(headerFieldErrors.delivery_address)}
                  placeholder="Endereço de entrega"
                />
              ) : (
                <p className="text-sm text-foreground">{order.delivery_address ?? "—"}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">Observações</p>
              {showHeaderEdit ? (
                <Textarea
                  rows={2}
                  value={editForm.observations}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, observations: e.target.value }))
                  }
                  placeholder="Observações"
                />
              ) : (
                <p className="text-sm text-foreground">{order.observations ?? "—"}</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>Itens do Pedido</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {isDraftEditable && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setReqDialogOpen(true)
                  void loadAvailableRequisitions()
                }}
              >
                <ClipboardList className="h-4 w-4 mr-2" />
                Importar de Requisição
              </Button>
            )}
            <Badge variant="outline" className="text-xs">
              {(showItemEdit ? editItems.length : totalItemsCount)} item
              {(showItemEdit ? editItems.length : totalItemsCount) === 1 ? "" : "s"}
            </Badge>
          </div>
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
                  {isDraftEditable ? <TableHead className="w-10" /> : null}
                  <TableHead className="text-center">Código</TableHead>
                  <TableHead className="text-center min-w-[10rem]">Descrição Curta</TableHead>
                  {isDraftEditable ? (
                    <TableHead className="text-center whitespace-nowrap">Requisição</TableHead>
                  ) : null}
                  <TableHead className="text-center whitespace-nowrap">Contrato</TableHead>
                  <TableHead className="text-center whitespace-nowrap">Item Contr.</TableHead>
                  {accountAssignmentEnabled ? (
                    <>
                      <TableHead className="text-center whitespace-nowrap min-w-[9rem]">
                        Classificação{canEditAccountConfig ? " *" : ""}
                      </TableHead>
                      <TableHead className="text-center whitespace-nowrap min-w-[8.5rem]">
                        Coletor{canEditAccountConfig ? " *" : ""}
                      </TableHead>
                      <TableHead className="text-center whitespace-nowrap min-w-[6.5rem]">
                        Rateio
                      </TableHead>
                    </>
                  ) : null}
                  <TableHead className="text-center">Qtd *</TableHead>
                  <TableHead className="text-center">Unidade</TableHead>
                  {porEnabled ? (
                    <TableHead className="text-center whitespace-nowrap">POR *</TableHead>
                  ) : null}
                  <TableHead className="text-center">Preço Unit. *</TableHead>
                  <TableHead className="text-center">Total Item</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {showItemEdit
                  ? editItems.map((item) => (
                      <TableRow key={item.id}>
                        {isDraftEditable ? (
                          <TableCell className="w-10 px-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              disabled={editItems.length <= 1}
                              onClick={() => void removeDraftLine(item.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        ) : null}
                        <TableCell className="font-mono text-sm text-center">
                          {item.material_code}
                        </TableCell>
                        <TableCell>{item.material_description}</TableCell>
                        {isDraftEditable ? (
                          <TableCell className="text-center">
                            {item.source_requisition_code &&
                            requisitionIdByCode[item.source_requisition_code] ? (
                              <Link
                                href={`/comprador/requisicoes/${requisitionIdByCode[item.source_requisition_code]}`}
                                className="text-xs font-mono text-primary hover:underline"
                              >
                                {item.source_requisition_code}
                              </Link>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                {item.source_requisition_code ?? "—"}
                              </span>
                            )}
                          </TableCell>
                        ) : null}
                        <TableCell className="font-mono text-xs text-center">
                          {items.find((i) => i.id === item.id)?.contract_code ?? "—"}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-center">
                          {items.find((i) => i.id === item.id)?.contract_item_line ?? "—"}
                        </TableCell>
                        {accountAssignmentEnabled ? (
                          <PoItemAccountConfigTableCells
                            companyId={companyId}
                            materialCode={item.material_code}
                            config={
                              accountConfigs[item.id] ?? {
                                category: null,
                                assignments: [],
                                usesApportionment: false,
                              }
                            }
                            editable={canEditAccountConfig}
                            fieldErrors={accountConfigErrors[item.id]}
                            onChange={(config) => handleAccountConfigChange(item.id, config)}
                          />
                        ) : null}
                        <TableCell className="text-center">
                          <div className="inline-flex items-center justify-center gap-1.5">
                            <QuantityInput
                              value={item.quantity}
                              maxQuantity={Math.min(
                                maxQuantity,
                                item.max_quantity ?? maxQuantity,
                              )}
                              invalid={Boolean(lineItemFieldErrors[item.id]?.quantity)}
                              onValueChange={(val) => {
                                setLineItemFieldErrors((prev) => {
                                  if (!prev[item.id]?.quantity) return prev
                                  const next = { ...prev }
                                  const row = { ...next[item.id] }
                                  delete row.quantity
                                  if (Object.keys(row).length === 0) delete next[item.id]
                                  else next[item.id] = row
                                  return next
                                })
                                setEditItems((prev) =>
                                  prev.map((i) =>
                                    i.id === item.id ? { ...i, quantity: val } : i,
                                  ),
                                )
                              }}
                              className="h-8 w-20 text-center"
                            />
                            {item.max_quantity != null ? (
                              <span className="text-xs text-muted-foreground whitespace-nowrap">
                                máx: {item.max_quantity}
                              </span>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          {item.unit_of_measure || "—"}
                        </TableCell>
                        {porEnabled ? (
                          <TableCell className="text-center">
                            {isDraftEditable && !isEditing ? (
                              <Select
                                value={String(item.price_unit)}
                                onValueChange={(value) => {
                                  const parsed = Number(value) as PorValue
                                  setLineItemFieldErrors((prev) => {
                                    if (!prev[item.id]?.price_unit) return prev
                                    const next = { ...prev }
                                    const row = { ...next[item.id] }
                                    delete row.price_unit
                                    if (Object.keys(row).length === 0) delete next[item.id]
                                    else next[item.id] = row
                                    return next
                                  })
                                  setEditItems((prev) =>
                                    prev.map((i) =>
                                      i.id === item.id ? { ...i, price_unit: parsed } : i,
                                    ),
                                  )
                                }}
                              >
                                <SelectTrigger
                                  className={cn(
                                    "h-8 w-24 mx-auto",
                                    invalidFieldClass(
                                      lineItemFieldErrors[item.id]?.price_unit,
                                    ),
                                  )}
                                >
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {POR_OPTIONS.map((por) => (
                                    <SelectItem key={por} value={String(por)}>
                                      {por.toLocaleString("pt-BR")}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              item.price_unit.toLocaleString("pt-BR")
                            )}
                          </TableCell>
                        ) : null}
                        <TableCell className="text-right">
                          {isDraftEditable && !isEditing ? (
                            <PriceInput
                              value={item.unit_price}
                              decimalPlaces={priceDecimalPlaces}
                              invalid={Boolean(lineItemFieldErrors[item.id]?.unit_price)}
                              onValueChange={(val) => {
                                setLineItemFieldErrors((prev) => {
                                  if (!prev[item.id]?.unit_price) return prev
                                  const next = { ...prev }
                                  const row = { ...next[item.id] }
                                  delete row.unit_price
                                  if (Object.keys(row).length === 0) delete next[item.id]
                                  else next[item.id] = row
                                  return next
                                })
                                setEditItems((prev) =>
                                  prev.map((i) =>
                                    i.id === item.id ? { ...i, unit_price: val } : i,
                                  ),
                                )
                              }}
                              className="w-28 text-right ml-auto"
                            />
                          ) : (
                            money.format(item.unit_price)
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {money.format(
                            computePoLineTotal(
                              item.quantity,
                              item.unit_price,
                              item.price_unit,
                            ),
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  : items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono text-sm text-center">
                          {item.material_code}
                        </TableCell>
                        <TableCell>{item.material_description}</TableCell>
                        <TableCell className="font-mono text-xs text-center">
                          {items.find((i) => i.id === item.id)?.contract_code ?? "—"}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-center">
                          {items.find((i) => i.id === item.id)?.contract_item_line ?? "—"}
                        </TableCell>
                        {accountAssignmentEnabled ? (
                          <PoItemAccountConfigTableCells
                            companyId={companyId}
                            materialCode={item.material_code}
                            config={
                              accountConfigs[item.id] ?? {
                                category: null,
                                assignments: [],
                                usesApportionment: false,
                              }
                            }
                            editable={canEditAccountConfig}
                            fieldErrors={accountConfigErrors[item.id]}
                            onChange={(config) => handleAccountConfigChange(item.id, config)}
                          />
                        ) : null}
                        <TableCell className="text-center">{item.quantity}</TableCell>
                        <TableCell className="text-center">
                          {item.unit_of_measure ?? "—"}
                        </TableCell>
                        {porEnabled ? (
                          <TableCell className="text-center">
                            {item.price_unit.toLocaleString("pt-BR")}
                          </TableCell>
                        ) : null}
                        <TableCell className="text-right">
                          {money.format(item.unit_price)}
                        </TableCell>
                        <TableCell className="text-right">
                          {money.format(
                            computePoLineTotal(
                              item.quantity,
                              item.unit_price,
                              item.price_unit,
                            ),
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex justify-end items-center gap-4 border-t border-border pt-3 mt-1 text-sm">
            <span className="font-bold">Total do Pedido</span>
            <span className="font-bold min-w-[6rem] text-right">
              {money.format(displayedOrderTotal)}
            </span>
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

      <Dialog open={delegateOpen} onOpenChange={setDelegateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delegar pedido</DialogTitle>
            <DialogDescription>
              Transfira a responsabilidade deste pedido para outro comprador. O novo responsável passa a ser o dono do pedido.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>Novo responsável</Label>
            <Select value={delegateTargetId || undefined} onValueChange={setDelegateTargetId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um comprador" />
              </SelectTrigger>
              <SelectContent>
                {delegateBuyers.map((buyer) => (
                  <SelectItem key={buyer.id} value={buyer.id}>
                    {formatResponsibleName(buyer.full_name)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {delegateBuyers.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Nenhum comprador disponível para delegação.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDelegateOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => void handleDelegate()}
              disabled={!delegateTargetId || delegating}
            >
              {delegating ? "Delegando..." : "Confirmar delegação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={reqDialogOpen} onOpenChange={setReqDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Importar Itens de Requisições</DialogTitle>
          </DialogHeader>

          {requisitionsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : requisitions.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Nenhuma requisição aprovada disponível para importação.
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {requisitions.map((req) => (
                <div
                  key={req.id}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      setSelectedReqIds((prev) =>
                        prev.includes(req.id)
                          ? prev.filter((x) => x !== req.id)
                          : [...prev, req.id],
                      )
                    }
                  }}
                  className={`rounded-lg border p-4 cursor-pointer transition-colors ${
                    selectedReqIds.includes(req.id)
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/30"
                  }`}
                  onClick={() =>
                    setSelectedReqIds((prev) =>
                      prev.includes(req.id)
                        ? prev.filter((x) => x !== req.id)
                        : [...prev, req.id],
                    )
                  }
                >
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={selectedReqIds.includes(req.id)}
                      onCheckedChange={(checked) => {
                        setSelectedReqIds((prev) =>
                          checked === true
                            ? prev.includes(req.id)
                              ? prev
                              : [...prev, req.id]
                            : prev.filter((x) => x !== req.id),
                        )
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium font-mono text-primary">
                          {req.code}
                        </span>
                        <span className="text-sm text-foreground truncate">{req.title}</span>
                        <span className="text-xs text-muted-foreground ml-auto flex-shrink-0">
                          {formatDateBR(req.created_at)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {req.items.length} item(s):{" "}
                        {req.items
                          .slice(0, 3)
                          .map((i) => i.material_description)
                          .join(", ")}
                        {req.items.length > 3 && ` +${req.items.length - 3} mais`}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <DialogFooter>
            <div className="flex items-center gap-3 w-full flex-wrap">
              <span className="text-sm text-muted-foreground flex-1 min-w-[12rem]">
                {selectedReqIds.length > 0
                  ? `${selectedReqIds.length} requisição(ões) selecionada(s)`
                  : "Selecione as requisições para importar"}
              </span>
              <Button type="button" variant="outline" onClick={() => setReqDialogOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={() => void handleImportRequisitions()}
                disabled={selectedReqIds.length === 0}
              >
                Importar {selectedReqIds.length > 0 ? `(${selectedReqIds.length})` : ""}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

