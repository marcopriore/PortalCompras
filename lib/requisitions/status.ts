/** Status canônicos de requisição (incl. ciclo do pedido). */
export type RequisitionStatus =
  | "draft"
  | "buyer_review"
  | "pending"
  | "approved"
  | "rejected"
  | "in_quotation"
  | "awaiting_buyer"
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
    case "sent":
    case "processing":
      return "awaiting_supplier"
    case "completed":
      return "completed"
    case "cancelled":
      return "cancelled"
    default:
      return null
  }
}
