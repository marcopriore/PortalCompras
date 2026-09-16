/** Status canônicos de requisição (incl. ciclo do pedido). */
export type RequisitionStatus =
  | "draft"
  | "buyer_review"
  | "pending"
  | "approved"
  | "rejected"
  | "in_quotation"
  | "awaiting_buyer"
  | "awaiting_approval"
  | "awaiting_supplier"
  | "completed"
  | "cancelled"

export type RequisitionStatusMeta = {
  label: string
  className: string
}

const STATUS_META: Record<RequisitionStatus, RequisitionStatusMeta> = {
  draft: {
    label: "Rascunho",
    className: "bg-violet-100 text-violet-800",
  },
  buyer_review: {
    label: "Revisão Comprador",
    className: "bg-indigo-100 text-indigo-800",
  },
  pending: {
    label: "Pendente Aprovação",
    className: "bg-yellow-100 text-yellow-800",
  },
  approved: {
    label: "Aprovada",
    className: "bg-green-100 text-green-800",
  },
  rejected: {
    label: "Reprovada",
    className: "bg-red-100 text-red-800",
  },
  in_quotation: {
    label: "Em Cotação",
    className: "bg-blue-100 text-blue-800",
  },
  awaiting_buyer: {
    label: "Pendente Comprador",
    className: "bg-amber-100 text-amber-900",
  },
  awaiting_approval: {
    label: "Pendente Aprovação",
    className: "bg-yellow-100 text-yellow-800",
  },
  awaiting_supplier: {
    label: "Pendente Aceite Fornecedor",
    className: "bg-orange-100 text-orange-900",
  },
  completed: {
    label: "Concluída",
    className: "bg-gray-100 text-gray-700",
  },
  cancelled: {
    label: "Cancelada",
    className: "bg-red-100 text-red-800",
  },
}

export function getRequisitionStatusMeta(
  status: string,
): RequisitionStatusMeta {
  if (status in STATUS_META) {
    return STATUS_META[status as RequisitionStatus]
  }
  return { label: status, className: "bg-gray-100 text-gray-700" }
}

export const REQUISITION_STATUS_FILTER_OPTIONS: Array<{
  value: RequisitionStatus
  label: string
}> = [
  { value: "draft", label: "Rascunho" },
  { value: "pending", label: "Pendente Aprovação" },
  { value: "approved", label: "Aprovada" },
  { value: "rejected", label: "Reprovada" },
  { value: "cancelled", label: "Cancelada" },
  { value: "in_quotation", label: "Em Cotação" },
  { value: "awaiting_buyer", label: "Pendente Comprador" },
  { value: "awaiting_approval", label: "Pendente Aprovação" },
  { value: "awaiting_supplier", label: "Pendente Aceite Fornecedor" },
  { value: "completed", label: "Concluída" },
]

/** Filtro padrão da listagem do solicitante (exclui canceladas). */
export const SOLICITANTE_DEFAULT_STATUS_FILTER: RequisitionStatus[] = [
  "draft",
  "pending",
  "approved",
  "rejected",
  "in_quotation",
  "awaiting_buyer",
  "awaiting_approval",
  "awaiting_supplier",
  "completed",
]

/** Mapeia status do PO → status da REQ (espelha a função SQL). */
export function mapPoStatusToRequisitionStatus(
  poStatus: string,
): RequisitionStatus | null {
  switch (poStatus) {
    case "draft":
    case "error":
    case "refused":
    case "integration_error":
      return "awaiting_buyer"
    case "awaiting_approval":
      return "awaiting_approval"
    case "sent":
    case "processing":
      return "awaiting_supplier"
    case "completed":
      return "completed"
    case "cancelled":
      // Cancelar o único PO ativo libera a REQ (espelha SQL 084/085).
      return "approved"
    default:
      return null
  }
}

/**
 * Rank of remaining work: lower = less advanced (bottleneck of a split REQ).
 * Mirrors `po_status_open_progress_rank` in migration 085.
 */
const PO_OPEN_PROGRESS_RANK: Record<string, number> = {
  draft: 1,
  error: 1,
  refused: 1,
  integration_error: 1,
  awaiting_approval: 2,
  sent: 3,
  processing: 3,
  completed: 4,
}

export type DeriveRequisitionStatusFromPosOptions = {
  origin?: string | null
  quotationId?: string | null
}

/**
 * Status da REQ a partir dos POs da mesma `requisition_code`.
 * Usa o PO ativo **menos avançado** (split por filial: um completed não encerra a REQ).
 * Sem PO ativo: catálogo → cancelled; com cotação → in_quotation; senão approved.
 */
export function deriveRequisitionStatusFromPurchaseOrderStatuses(
  poStatuses: string[],
  options?: DeriveRequisitionStatusFromPosOptions,
): RequisitionStatus | null {
  const active = poStatuses.filter((status) => status !== "cancelled")
  if (active.length === 0) {
    if (options?.origin === "catalog") return "cancelled"
    if (options?.quotationId) return "in_quotation"
    return "approved"
  }

  let leastStatus: string | null = null
  let leastRank = Number.POSITIVE_INFINITY
  for (const status of active) {
    const rank = PO_OPEN_PROGRESS_RANK[status] ?? 9
    if (rank < leastRank) {
      leastRank = rank
      leastStatus = status
    }
  }

  if (!leastStatus) return null
  return mapPoStatusToRequisitionStatus(leastStatus)
}
